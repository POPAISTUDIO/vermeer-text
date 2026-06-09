# Interpréteur de code L2 — manifests Kubernetes (préparation déploiement)

> **DRAFT de préparation — à relire et déployer par Oussama après la release V1. Durcissement suffisant pour un petit groupe de key users de confiance, à renforcer avant un scale 100+ (notamment isolation sandbox et quotas).**

Traduction K8s durcie du POC local `~/vermeer-l2-poc/` (validé : un agent L2 génère et télécharge un `.xlsx`/`.pdf`/`.pptx`). Cible : le **cluster partagé existant** (namespace `llm`, là où tourne LibreChat), **pas Coder** (cible ultérieure). **Rien n'est déployé** par ce livrable.

Stack = 3 composants, comme le POC :
1. **Interpréteur** (LibreCodeInterpreter, compatible API Code Interpreter de LibreChat) — exécute le code dans des sandboxes nsjail.
2. **Redis** — sessions/état transitoire.
3. **Stockage S3** — fichiers générés, servis via `/download`. Ici **MinIO in-cluster** (option a).

---

## Arborescence et rôle de chaque manifest

| Fichier | Ressource(s) | Rôle |
|---|---|---|
| `kustomization.yaml` | Kustomization | Agrège tout (option a). Point d'entrée `kubectl apply -k .` ou Flux. |
| `configmap.yaml` | ConfigMap | Config **non sensible** (port, limites d'exécution, hôtes Redis/S3, `ENABLE_SANDBOX_NETWORK=false`). |
| `externalsecret.yaml` | ExternalSecret | Secrets **par référence** (clé API, clé master, creds S3) tirés d'AWS Parameter Store via `aws-parameter-store`. Aucun secret en clair. |
| `interpreter-deployment.yaml` | ServiceAccount + Deployment | L'interpréteur. ServiceAccount sans token ni IRSA. `securityContext` détaillé (voir durcissement). |
| `interpreter-service.yaml` | Service (ClusterIP) | Expose l'interpréteur **en interne** sur `:8000`. Pas d'Ingress. |
| `networkpolicy.yaml` | NetworkPolicy | **Pièce critique.** Ingress LibreChat→8000 ; egress DNS+Redis+MinIO uniquement ; tout le reste (dont métadonnées cloud) refusé. |
| `redis-deployment.yaml` | Deployment | Redis durci (non-root, RO rootfs, 0 capability). Données en `emptyDir`. |
| `redis-service.yaml` | Service + NetworkPolicy | Service Redis + n'accepte que l'interpréteur en ingress. |
| `minio-deployment.yaml` | PVC + Deployment | MinIO durci + volume persistant pour les fichiers générés. |
| `minio-service.yaml` | Service + NetworkPolicy | Service S3 interne + ingress restreint (interpréteur + Job bucket). |
| `minio-makebucket-job.yaml` | Job | Crée le bucket `code-interpreter-files` (idempotent). |

---

## Choix de durcissement (et pourquoi)

**Pas de `privileged`.** Le POC a confirmé que c'est inutile : nsjail a juste besoin de capabilities ciblées.

**Capabilities : `drop: [ALL]` puis `add: [SYS_ADMIN, NET_ADMIN]`** sur l'interpréteur.
- `SYS_ADMIN` : requis par nsjail pour créer les namespaces (mount/pid/user) et les cgroups. Non négociable.
- `NET_ADMIN` : requis seulement pour poser les règles iptables d'egress **quand `ENABLE_SANDBOX_NETWORK=true`**. On le garde par parité avec le POC, mais comme on déploie avec le réseau sandbox **désactivé**, il peut être retiré pour réduire encore la surface (à tester).

**`runAsNonRoot: false` (uid 0) sur l'interpréteur — assumé et borné.** Le wrapper REPL exécute `unshare` + `mount` au lancement de chaque sandbox : il lui faut root. **Mais le code utilisateur, lui, est redescendu en uid 1001 par nsjail.** Redis et MinIO, eux, tournent **non-root** (999 / 1000).

**`readOnlyRootFilesystem`** : `true` pour Redis et MinIO ; `false` pour l'interpréteur (le wrapper fait des bind/tmpfs mounts à chaud sur de nombreux chemins). Les chemins inscriptibles connus de l'interpréteur sont quand même isolés en volumes (`/tmp`, `/app/data` en `emptyDir`).

**seccomp / AppArmor `Unconfined` sur l'interpréteur — volontaire, défense en profondeur.** nsjail appelle `mount`/`pivot_root`/`unshare`/`clone`, **bloqués par le profil `RuntimeDefault`**. On laisse donc le **conteneur** unconfined, mais **chaque exécution de code utilisateur tourne SOUS le filtre seccomp strict appliqué par nsjail lui-même** : le confinement est fait au bon niveau (la sandbox), pas au niveau du process superviseur. Redis/MinIO restent en `RuntimeDefault`.

**ServiceAccount sans token monté et sans rôle IRSA AWS.** Même en cas d'évasion, aucun credential cloud ni accès à l'API k8s.

**`automountServiceAccountToken: false`** partout.

**Limites d'exécution** (configmap) : `MAX_EXECUTION_TIME=60s`, `MAX_MEMORY_MB=512`, `MAX_FILE_SIZE_MB=50`, `MAX_OUTPUT_FILES=10`, `SESSION_TTL_HOURS=24`.

**Resources requests/limits** sur les 3 conteneurs (interpréteur 250m→2 CPU / 512Mi→2Gi ; valeurs de départ à ajuster sous charge réelle).

### La NetworkPolicy (le point critique)

Deux barrières contre l'exfiltration / le vol de creds :
1. **`ENABLE_SANDBOX_NETWORK=false`** → le code utilisateur n'a **aucun réseau** (barrière primaire, dans nsjail).
2. **NetworkPolicy sur le pod** → même le process API ne peut sortir que vers **DNS + Redis + MinIO**. Tout le reste est refusé **par omission**, donc l'endpoint **`169.254.169.254` (métadonnées cloud → creds AWS) est inatteignable**, tout comme les autres services internes du cluster et Internet.

> ⚠️ Une NetworkPolicy n'a d'effet que si le **CNI l'applique** (Calico, Cilium…). À confirmer côté cluster. Et le label des pods LibreChat dans l'`ingress` est une **hypothèse** (`app.kubernetes.io/name: librechat`) — à confirmer.

---

## Câblage LibreChat (preprod)

Côté config LibreChat, pointer le code interpreter sur le Service interne, **avec la clé embarquée dans l'URL** (mécanisme identifié au POC : ce build de `@librechat/agents` n'envoie pas de header `x-api-key` ; node-fetch convertit `KEY@host` en `Authorization: Basic`, que l'interpréteur décode) :

```
LIBRECHAT_CODE_BASEURL=http://<CODE_API_KEY>@vermeer-code-interpreter.llm.svc.cluster.local:8000
```

où `<CODE_API_KEY>` = la valeur de `/alpha/llm/code_interpreter_api_key`.

**La clé étant dans l'URL, le BASEURL est lui-même un secret.** Donc :
- créer un paramètre SSM dédié, p. ex. `/alpha/llm/librechat_code_baseurl`, contenant l'URL **complète** (avec la clé) ;
- l'injecter dans LibreChat **via l'ExternalSecret LibreChat existant** (`alpha/llm/external-secrets.yaml`, ajouter une entrée `LIBRECHAT_CODE_BASEURL`), **pas** en clair dans la config Helm.
- `librechat.yaml` n'a **pas** besoin d'être modifié : la capability `execute_code` est déjà active par les défauts upstream (confirmé aux étapes précédentes).

---

## DÉCISIONS qui restent à Oussama

1. **Namespace** : déployé dans `llm` (avec LibreChat). Confirmer ou isoler dans un namespace dédié (`code-interpreter`) — si isolé, adapter les `namespaceSelector` des NetworkPolicy (DNS, ingress LibreChat).
2. **Option de stockage (a) vs (b)** :
   - **(a) MinIO in-cluster** — *implémenté ici*. Avantage : tout reste intra-cluster → NetworkPolicy étanche, pas d'IAM, métadonnées bloquées par construction. Coût : un composant à exploiter (PVC, sauvegardes).
   - **(b) Bucket AWS S3 existant** — cohérent avec l'infra AWS. À faire : retirer les 3 `minio-*`, mettre `S3_ENDPOINT`/`S3_REGION`/`S3_SECURE=true` sur le vrai endpoint S3, fournir les creds (de préférence **clés statiques via external-secrets** plutôt qu'IRSA, pour **éviter d'avoir à autoriser l'egress métadonnées/STS**), et **ajouter un egress NetworkPolicy vers S3 idéalement via un VPC endpoint** (jamais `0.0.0.0/0`, garder `except 169.254.169.254/32`). Plus étanche : préférer un VPC endpoint S3.
   - **→ à trancher.** Le Deployment interpréteur est identique dans les deux cas (il ne consomme que `S3_*`).
3. **StorageClass** du PVC MinIO (`minio-deployment.yaml`) — ex. `gp3` (EBS). Vide = classe par défaut du cluster.
4. **Secrets** : créer les 4 paramètres SSM référencés dans `externalsecret.yaml` (`/alpha/llm/code_interpreter_*`) + le `librechat_code_baseurl`. Confirmer que `creationPolicy: Owner` convient (LibreChat utilise `Merge` sur un secret partagé ; ici secret dédié → `Owner`).
5. **Image interpréteur** : **mirorer** `ghcr.io/usnavy13/librecodeinterpreter:main` sur l'**ECR Vermeer** (`897388551593.dkr.ecr.eu-west-1.amazonaws.com`) et **pinner par digest** (`@sha256:…`) dans `interpreter-deployment.yaml` (placeholder `CHANGEME`). Idem pinner `minio` et `minio/mc`.
6. **CNI applique-t-il les NetworkPolicy ?** Si non (ex. VPC CNI sans add-on policy), prévoir Calico/Cilium **avant** d'exposer aux users — sinon l'isolation réseau est inopérante.
7. **Label réel des pods LibreChat** (ingress de `networkpolicy.yaml`).
8. **Intégration GitOps** : recopier ces manifests sous `vermeer-gitops` (ex. `alpha/llm/code-interpreter/`) et les brancher dans la Kustomization/Flux selon la convention du repo. *(Non fait ici : gitops en lecture seule, pas de push.)*

---

## À renforcer avant un scale 100+ (hors périmètre de ce draft)

- **Isolation sandbox** : aujourd'hui un seul pod partage le noyau entre tous les users. Envisager gVisor/Kata, ou un pod par tenant.
- **Quotas & équité** : ResourceQuota/LimitRange sur le namespace, HPA, taille du pool, anti-abus (un user ne doit pas affamer les autres).
- **Persistance/HA** Redis et MinIO (PVC Redis, MinIO multi-noeud ou bascule S3 managé).
- **Observabilité** : métriques (l'image expose des metrics), logs, alerting sur les exécutions en échec/timeouts.
- **Rotation** des clés API et revue des capabilities (retrait de `NET_ADMIN` si le réseau sandbox reste off).

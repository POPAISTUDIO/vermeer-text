# Package de déploiement RAG — Vermeer Chat

> **DRAFT de préparation — à relire/déployer par Oussama après la release.**
> Suffisant pour les key users ; **renforcer (isolation, quotas, sauvegardes)
> avant le scale 100+**.

Ce package prépare l'**activation** de la recherche de fichiers (RAG) en cluster :
le `rag-api` LibreChat + une base **pgvector**, câblés à LibreChat. Il ne déploie
**rien** et ne touche ni au cluster ni au gitops — c'est un brouillon à relire.

Le chart Helm `librechat-rag-api` **existe déjà** dans le repo
(`helm/librechat-rag-api/`) et est **déjà déclaré comme sous-dépendance** de
`librechat` (`helm/librechat/Chart.yaml`, condition `librechat-rag-api.enabled`,
défaut `false`). On ne reconstruit donc rien : on prépare son **activation**, le
**provisionnement pgvector**, le **câblage** et le **durcissement**.

Bon à savoir : le câblage `RAG_API_URL` est **automatique**. Dès que
`librechat-rag-api.enabled: true`, le chart `librechat` injecte tout seul
`RAG_API_URL` dans le configmap-env de LibreChat
(`http://<release>-librechat-rag-api-rag.<ns>.svc.cluster.local:8000`).
Pas d'URL à écrire à la main.

---

## Contenu du package

| Fichier | Rôle |
|---|---|
| `values-rag.yaml` | **Override Helm** à fusionner dans le bloc `values:` de la HelmRelease `librechat`. Active le rag-api + pgvector (option a), embeddings, resources, securityContext, probes. |
| `external-secrets.yaml` | `ExternalSecret` (par référence, SSM) : mot de passe pgvector (requis) + clé OpenAI embeddings dédiée (optionnel). |
| `networkpolicy.yaml` | 2 `NetworkPolicy` : rag-api joignable **seulement** par LibreChat ; pgvector joignable **seulement** par le rag-api. |
| `kustomization.yaml` | Regroupe les manifests bruts (external-secrets + networkpolicy). |

---

## Étapes d'activation / provisionnement

1. **Fusionner** `values-rag.yaml` dans le bloc `values:` de la HelmRelease
   `librechat` du gitops (`alpha/llm/helm-release`). C'est ce qui passe
   `librechat-rag-api.enabled` de `false` à `true` et configure tout le reste.
2. **Créer les paramètres SSM** référencés par `external-secrets.yaml`
   (au minimum `/alpha/llm/rag_vectordb_password`).
3. **Appliquer les manifests bruts** : `kubectl apply -k .` (ou via Flux).
4. **Valider** avant tout commit gitops :
   ```bash
   # rendu Helm complet, sans déployer
   helm template librechat helm/librechat \
     --set librechat-rag-api.enabled=true \
     -f deploy/vermeer-rag-deploy/values-rag.yaml | less
   ```
   Vérifier en particulier : `RAG_API_URL` présent dans le configmap-env, le
   `DB_HOST` du configmap rag pointe sur le bon Service postgresql, le pod rag-api
   ne crashloop pas sur le `securityContext` (cf. garde-fou ci-dessous).
5. **Alpha d'abord, puis staging** — ne pas activer directement sur staging/prod.

---

## DÉCISIONS qui reviennent à Oussama

- **pgvector in-cluster (option a) vs PostgreSQL managé (option b / RDS).**
  Implémenté ici : **option (a)**, déjà embarquée dans le chart (sous-dépendance
  bitnami `postgresql` avec image pgvector). Plus simple, autonome, pas de coût
  AWS additionnel. **Option (b) RDS** : plus robuste/sauvegardable mais demande de
  désactiver `librechat-rag-api.postgresql.enabled`, de pointer `DB_HOST`/creds sur
  l'instance RDS, de retirer la 2e NetworkPolicy et de borner l'accès côté Security
  Group. **À trancher selon la politique data du cluster.**
- **StorageClass du PVC pgvector** (`postgresql.primary.persistence.storageClassName`
  dans `values-rag.yaml`, laissé vide = StorageClass par défaut du cluster).
- **Namespace** : `llm` par défaut (aligné sur le package L2). À confirmer.
- **Clé embeddings** : par défaut réutilise le secret LibreChat existant
  (`librechat-credentials-env`). Clé **dédiée** `RAG_OPENAI_API_KEY` via SSM/
  ExternalSecret seulement si tu veux isoler le suivi de coût / la rotation
  (bloc optionnel dans `external-secrets.yaml`).
- **Tag d'image rag-api** : `latest` ici ; **épingler un tag immuable en prod**
  (cohérent avec le garde-fou release du CLAUDE.md).
- **securityContext non-root** : posé (runAsUser 1000). Si l'image `lite` exige
  root et crashloop, relâcher et documenter.

---

## DONNÉES & GOUVERNANCE

- **La base pgvector stocke les embeddings des documents uploadés = donnée
  utilisateur.** À traiter comme tel :
  - **Sauvegardes** : option (a) in-cluster → prévoir un backup du PVC (snapshot
    volume ou dump `pg_dump` planifié). Option (b) RDS → snapshots automatiques.
    En l'état, **aucune sauvegarde n'est configurée** dans ce package.
  - **Dimensionnement** : PVC 8Gi par défaut — à revoir selon le volume de docs.
  - **Étanchéité BETC / POP** : ⚠️ **point de vigilance non résolu par ce package.**
    Une base pgvector partagée signifie que les embeddings de toutes les BU
    cohabitent. Il faut garantir que les embeddings d'une BU **ne sont pas
    interrogeables** par un agent d'une autre BU (partition logique côté
    LibreChat/RAG, ou bases/collections séparées). À valider rigoureusement avant
    déploiement, cohérent avec le garde-fou « étanchéité BETC vs POP » du CLAUDE.md.

---

## COÛT

- **Chaque upload de document ET chaque requête RAG déclenche des appels
  d'embeddings OpenAI** (`text-embedding-3-small`). Le coût croît avec le volume
  de docs et l'usage. **À suivre côté consommation à l'échelle** (le tracking
  conso/budget Vermeer ne couvre pas forcément ces appels embeddings — à vérifier).
- pgvector in-cluster : coût = CPU/RAM/stockage du pod (option a). RDS : coût
  d'instance managée (option b).

---

## Durcissement appliqué (spécifique RAG)

- **rag-api strictement interne** : `Service` ClusterIP (jamais exposé hors
  cluster) + NetworkPolicy n'autorisant que LibreChat en ingress. Le rag-api
  **n'a pas d'auth propre** (constaté au POC) → c'est la seule barrière d'accès.
- **pgvector** : NetworkPolicy n'autorisant que le rag-api en ingress.
- **resources requests/limits** sur rag-api **et** pgvector.
- **securityContext non-root** sur le rag-api (à valider contre l'image).
- **Secrets par référence** (ExternalSecret/SSM) : aucune valeur en clair.
- **Idempotence gitops** : mot de passe pgvector fourni via Secret externe (et
  non auto-généré aléatoirement par le chart, ce qui casserait les redéploiements).

### À renforcer avant le scale 100+
- Verrouiller aussi l'**egress** du rag-api (aujourd'hui Ingress-only ; cf. note
  dans `networkpolicy.yaml`).
- **Quotas** d'upload / taille de fichiers / débit d'indexation.
- **Sauvegardes** pgvector automatisées.
- **Étanchéité BETC/POP** durcie (cf. Gouvernance).

---

## Ce que ce package ne fait PAS

- Il ne déploie rien, ne touche pas au cluster, ne push pas sur le gitops.
- Il ne touche pas au POC local (`~/vermeer-rag-poc/`), qui continue de tourner.
- Il ne reconstruit pas le chart `librechat-rag-api` (déjà présent dans le repo).

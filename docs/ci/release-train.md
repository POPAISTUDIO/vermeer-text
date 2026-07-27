# Release train — propagation automatique dev + staging

Workflow : [`.github/workflows/release-train.yml`](../../.github/workflows/release-train.yml)

À chaque merge sur `main`, l'image buildée est propagée automatiquement sur **dev** et
**staging** via le repo `vermeer-gitops`, puis la QA staging est déclenchée.

```
merge main
  └─> Build & Push Vermeer Custom Image to ECR   (vermeer-prod-image.yml)
        pousse :  vermeer-text:latest   +   vermeer-text:sha-<7>
        └─> Release Train — dev + staging          (release-train.yml)
              1. tag = sha-<7 premiers car. du SHA de merge>
              2. clone vermeer-gitops (GITOPS_PUSH_TOKEN)
              3. sed ciblé sur la ligne `tag:` de dev/llm + staging/llm
              4. PR `bump/sha-<7>` -> auto-merge squash
              5. sleep FLUX_WAIT_MINUTES (défaut 8)
              6. gh workflow run "QA Nightly — Staging"
```

## Pourquoi un tag `sha-<7>` et pas `latest`

Le build ECR tague les pushes sur `main` en `latest`, qui est **mutable**. Un tag mutable
ne peut pas être épinglé dans un `HelmRelease` : le premier bump produirait un diff, tous
les suivants un diff vide — Flux ne verrait plus rien changer, et le rollback par tag
deviendrait impossible.

`vermeer-prod-image.yml` pousse donc, **sur `main` uniquement**, un second tag immuable
`sha-<7>` sur la même image (`docker tag`, donc même digest, pas de rebuild). C'est ce tag
que le train propage. `latest` continue d'être poussé à l'identique pour les consommateurs
existants.

Les releases taguées (`v0.10.x`) ne déclenchent **pas** le train : la condition
`head_branch == 'main'` les exclut, elles suivent la procédure manuelle de CLAUDE.md §12.

## Fichiers modifiés dans vermeer-gitops

| Environnement | Fichier | Ligne |
|---|---|---|
| dev | `dev/llm/helm-release.yaml` | `      tag: "<x>"` sous `values.image` |
| staging | `staging/llm/helm-release.yaml` | `      tag: "<x>"` sous `values.image` |

Rien d'autre n'est touché — ni `librechat.yaml`, ni `external-secrets.yaml`, ni
`kustomization.yaml`, ni les `podAnnotations`.

## Garde-fous

1. **Prod intouchable.** La prod vit dans un repo séparé (`POPAISTUDIO/vermeer-gitops-prod`,
   chemins `prod/llm/*`). Le train ne le clone jamais et le PAT n'y donne aucun droit. Une
   assertion supplémentaire échoue si un chemin contenant `prod` apparaît dans le diff.
2. **Diff chirurgical.** Avant tout push, le job vérifie que (a) seuls les deux fichiers de
   la liste blanche sont modifiés, (b) chaque ligne ajoutée/supprimée est de la forme
   `tag: "..."`, (c) la volumétrie correspond, (d) les deux fichiers portent bien le tag visé.
   Toute anomalie fait échouer le job **avant** le push, donc avant la PR et le merge.
3. **Une seule ligne `tag:` par fichier.** Vérifié à l'exécution. Si un fichier gitops en
   contient 0 ou 2+, le train s'arrête plutôt que de deviner laquelle bumper.
4. **Aucun retry.** Un push gitops échoué n'est jamais rejoué automatiquement : l'état du
   repo distant est inconnu. Le train ouvre ou commente une issue `release-train` et s'arrête.
5. **Aucune étape LLM.** Le train est 100 % déterministe (pas de `claude-code-action`), donc
   pas de `id-token: write` dans ses permissions.
6. **`concurrency: release-train`, `cancel-in-progress: false`.** Les bumps se suivent sans
   s'annuler. GitHub ne garde qu'un run en attente par groupe : sur une rafale de merges, les
   trains intermédiaires en file sont abandonnés au profit du plus récent — sans conséquence,
   chaque train bumpe vers le dernier SHA connu.

## Limitation connue — « Point 0 » : l'image réellement servie n'est pas vérifiée

Le CI n'a **aucun accès au cluster**. L'attente de réconciliation est un `sleep` à l'aveugle
(`FLUX_WAIT_MINUTES`, défaut 8 min ; l'`interval` Flux déclaré dans les `HelmRelease` est de
5 min, auquel s'ajoutent le pull ECR et le rolling update).

**Conséquence** : si Flux est lent ou si le rollout échoue, la QA se lance **contre l'ancienne
image** et son verdict est trompeur — un vert ne prouve pas que le nouveau code est bon, un
rouge peut pointer un bug déjà corrigé. Toujours recouper le tag attendu avec l'image
réellement déployée avant de conclure sur un run de QA automatique.

**Amélioration future** : exposer un endpoint `/version` côté application (retournant le tag
d'image / SHA de build), et remplacer le `sleep` par un poll jusqu'à concordance avec le tag
propagé, avec timeout et échec explicite.

Pour rallonger l'attente sans toucher au YAML : *Settings → Secrets and variables → Actions →
Variables* → `FLUX_WAIT_MINUTES`.

## Prérequis — secret `GITOPS_PUSH_TOKEN`

Le train a besoin d'un **fine-grained PAT** stocké dans les secrets Actions de `vermeer-text`
sous le nom `GITOPS_PUSH_TOKEN`. Le `GITHUB_TOKEN` par défaut ne convient pas : il est limité
au repo courant et ne peut pas écrire dans `vermeer-gitops`.

### Portée exacte à accorder

| Paramètre | Valeur |
|---|---|
| Type | Fine-grained personal access token |
| Resource owner | `POPAISTUDIO` |
| Repository access | **Only select repositories** → `vermeer-gitops` **et rien d'autre** |
| Permission `Contents` | Read and write |
| Permission `Pull requests` | Read and write |
| Toute autre permission | **Aucune** |
| Expiration | 90 jours |

> ⚠️ Ne **jamais** inclure `vermeer-gitops-prod` (ni « All repositories ») dans la portée.
> Le cloisonnement du token est la première ligne de défense du garde-fou « prod intouchable » :
> même un bug du workflow ne peut pas atteindre la prod si le token n'y a pas accès.
>
> Les permissions `Contents: write` + `Pull requests: write` suffisent : `vermeer-gitops` n'a
> pas de protection de branche, le merge se fait donc sans `--admin` (donc sans droit admin).

### Expiration et renouvellement

Le token courant expire **fin octobre 2026** (90 jours à compter de sa création fin juillet 2026).

Symptôme d'un token expiré : le train échoue à l'étape **clone gitops** (`fatal: Authentication
failed`) et une issue `release-train` est ouverte. Aucun bump n'est appliqué, la prod et le
gitops restent intacts.

Procédure de renouvellement :

1. GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens*.
2. Ouvrir le token existant → **Regenerate token** (conserve la portée, évite de la ressaisir).
   À défaut, en créer un nouveau avec exactement la portée du tableau ci-dessus.
3. Copier la valeur (affichée une seule fois).
4. `vermeer-text` → *Settings → Secrets and variables → Actions → Secrets* → `GITOPS_PUSH_TOKEN`
   → **Update secret**.
5. Vérifier : relancer manuellement le dernier run du release train (*Actions → Release Train
   → Re-run jobs*). Un re-run sur un SHA déjà propagé est un **no-op sûr** — le bump ne produit
   aucun diff, aucune PR n'est créée, la QA n'est pas déclenchée.
6. Mettre à jour la date d'expiration dans ce document.

> Le token appartient à une personne physique. En cas de départ de son porteur, le régénérer
> depuis un autre compte disposant des droits sur `POPAISTUDIO/vermeer-gitops`, ou basculer sur
> une GitHub App dédiée (plus robuste à long terme : pas d'expiration à 90 jours, portée
> identique, mais installation à cadrer avec Antoine).

## En cas d'échec

Le train ouvre — ou commente, s'il en existe déjà une — l'issue
**« Release train — echecs de propagation dev/staging »**, labellisée `release-train`, avec le
tag visé, le SHA de build, l'étape en échec, l'URL du run et celle de la PR gitops si elle
existe.

Aucune reprise automatique. Reprise manuelle :

1. Lire l'étape en échec dans l'issue.
2. Vérifier l'état de `vermeer-gitops` — une branche `bump/sha-<7>` peut être restée ouverte,
   avec ou sans PR.
3. Corriger la cause, puis soit merger la PR à la main, soit relancer le run du train
   (*Re-run jobs*), qui repartira du même SHA.

La prod n'est jamais impactée par un échec du train.

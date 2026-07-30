---
name: config-drift
description: Réconcilie les sources de configuration Vermeer — librechat.yaml commité, librechat.local.yaml, la config réellement déployée (repos vermeer-gitops / vermeer-gitops-prod), .env.example et ce que décrit CLAUDE.md — puis met à jour docs/CONFIG-DRIFT.md. À utiliser avant une MEP, après un changement de config déployée, ou quand on doute de ce qui est réellement actif sur un environnement (balance, memory, web search, RAG, agents).
---

# Écarts de configuration Vermeer

Vermeer a quatre environnements (alpha, dev, staging, prod) et une config qui vit dans **trois
dépôts**. Le yaml commité dans `vermeer-text` ne décrit pas ce qui tourne : la source de vérité
du déployé est le gitops, pas ce repo. `librechat.gitops.yaml` à la racine n'est qu'une **copie
de travail**, potentiellement périmée — ne jamais la traiter comme le déployé.

Enjeu : chaque écart non documenté est une démo qui déraille (« la BudgetCard ne s'affiche
pas ») ou une MEP qui régresse une feature qu'on croyait désactivée.

## Sources à confronter

| Source | Ce qu'elle dit | Où |
|---|---|---|
| yaml commité | l'intention versionnée | `librechat.yaml` |
| yaml local | ce que tourne le poste | `librechat.local.yaml` |
| gitops dev / staging | le déployé hors prod | `POPAISTUDIO/vermeer-gitops` → `dev/llm/`, `staging/llm/` |
| gitops prod | le déployé prod | `POPAISTUDIO/vermeer-gitops-prod` → `prod/llm/` |
| env | les variables et secrets attendus | `.env.example`, ExternalSecrets côté gitops |
| doc | ce qu'on croit vrai | `CLAUDE.md` §7/§9/§11, `docs/FONCTIONNALITES.md` |

Lecture du déployé, sans cloner. Les yaml récupérés sont des fichiers de travail : ils vont dans
le **scratchpad de session** (chemin donné en tête de session), jamais dans `/tmp` ni dans le
dépôt — un yaml de staging oublié à la racine finit par être pris pour la config du repo.

```bash
SCRATCH="<scratchpad de session>"
gh api repos/POPAISTUDIO/vermeer-gitops/contents/staging/llm --jq '.[].name'
gh api repos/POPAISTUDIO/vermeer-gitops/contents/staging/llm/librechat.yaml --jq '.content' \
  | base64 -d > "$SCRATCH/staging-librechat.yaml"
gh api repos/POPAISTUDIO/vermeer-gitops-prod/contents/prod/llm --jq '.[].name'
```

Puis diffs ciblés, bloc par bloc, plutôt qu'un diff brut (les yaml n'ont pas le même ordre) :
`balance`, `transactions`, `memory`, `webSearch`, `interface`, `endpoints`, `fileStrategy`,
`registration`, `ocr`, `rateLimits`, et le tag d'image dans `helm-release.yaml`.

## Ce qu'on produit

Mise à jour de `docs/CONFIG-DRIFT.md`, une section par écart, dans le format déjà en place :

```
## N. `<clé>`
- **yaml commité** (`librechat.yaml:LIGNE`) : …
- **gitops** (`chemin:LIGNES`) : …
- **local** (`librechat.local.yaml:LIGNE`) : …
- **CLAUDE.md** (§X) : …
- **Constat** : ce qui est vrai.
- **À réaligner** : l'action, et sur quelle source on aligne.
```

Règles de tenue :

- **Le réel gagne.** Quand la doc et le déployé se contredisent, c'est la doc qui est fausse.
- **Étiquettes de preuve** (convention `docs/GOVERNANCE.md`) : OBSERVED avec sa source et sa
  date, INFERRED, UNKNOWN. Une ligne sans preuve n'est pas un constat.
- **Jamais de valeur de secret**, jamais de fragment — noms de variables uniquement.
- Mettre à jour l'en-tête de version / date du document, et signaler en fin de passe les
  écarts qui appellent une correction de `CLAUDE.md` (à faire dans la même PR si c'est petit).

## Pièges connus

- `balance.enabled: true` force `transactions` à `true` au runtime, quelle que soit la valeur
  écrite : un bloc `transactions` commenté ne prouve pas que transactions est inactif.
- Un bloc commenté dans `librechat.yaml` n'implique rien sur le déployé (c'est exactement le
  cas historique de `balance` et de `memory`).
- Le pricing des modèles est en dur dans `packages/data-schemas/src/methods/tx.ts`, pas dans le
  yaml : un modèle sans rate n'est pas tracké, donc pas décompté du budget.
- Le tag d'image (`helm-release.yaml`) fait partie de l'état déployé : un écart de config peut
  n'être qu'un environnement en retard d'un wagon.
- Un yaml invalide sort le process en code 1 (pas de mode dégradé) : valider tout yaml touché
  avant de le proposer.

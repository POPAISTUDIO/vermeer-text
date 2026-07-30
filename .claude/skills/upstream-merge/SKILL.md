---
name: upstream-merge
description: Conduit un merge ou rebase depuis upstream LibreChat sur le fork Vermeer — intersection avec la watchlist des fichiers natifs modifiés (CLAUDE.md §11), revalidation des 3 patches patch-package épinglés, batterie de tests des concerns, rapport fichier par fichier. À utiliser dès qu'il est question de merger upstream, de rebaser sur upstream/main, de suivre une version amont de LibreChat, ou de bumper @librechat/agents / @langchain/*.
---

# Merge upstream LibreChat → Vermeer

Le fork porte une trentaine de fichiers **natifs modifiés** : chacun contient du code Vermeer
qui corrige un bug réel (400 provider, modale qui écrase un assistant, suppression sans
confirmation…). Un merge upstream qui écrase silencieusement un de ces concerns ne casse pas
le build : il rouvre le bug en production, des semaines plus tard. C'est le seul risque que
cette procédure traite.

CLAUDE.md §11 est la **seule source de vérité** de la watchlist. Ne jamais recopier la liste
ici : elle est extraite à l'exécution.

## Phase 1 — investigation (avant de toucher à git)

```bash
git status --short && git stash list          # l'arbre DOIT être propre
git rev-parse HEAD                            # noter le point de départ
git fetch upstream
git log --oneline HEAD..upstream/main | wc -l  # volume amont
.claude/scripts/watchlist.sh upstream/main     # ⚠️ le cœur : fichiers à concern touchés en amont
.claude/scripts/patches-status.sh              # état des 3 patches épinglés
```

Pour chaque fichier de l'intersection, lire **le concern dans CLAUDE.md §11** puis le diff
amont :

```bash
git log --oneline HEAD..upstream/main -- <fichier>
git diff HEAD...upstream/main -- <fichier>
```

Si l'intersection est large (> 6 fichiers), déléguer l'audit par lot à l'agent
`watchlist-auditor` (un lot de 2-3 fichiers par agent, en parallèle).

Vérifier aussi les dépendances patchées : `@librechat/agents` et `@langchain/*` sont épinglés
à une version exacte par le nom des patches. Un bump amont — même **transitif**, via
`@librechat/agents` — déplace les lignes ciblées et fait échouer `patch-package` en simple
warning de postinstall.

```bash
git diff HEAD...upstream/main -- package.json package-lock.json | grep -E '@librechat/agents|@langchain/' | head -30
```

## Phase 2 — plan (validation explicite de Loïse avant d'exécuter)

Un tableau, une ligne par fichier de l'intersection :

| Fichier | Concern §11 | Ce que fait l'amont | Décision | Risque si on se trompe |
|---|---|---|---|---|

Décisions admises : **conserver** (le concern reste tel quel), **adapter** (le concern est
réécrit sur la nouvelle base amont), **retirer** (l'amont couvre nativement le besoin —
à prouver, pas à supposer), **escalader** (choix structurant → Antoine).

Signaler séparément : bump de dépendance patchée, changement de contrat sur un fichier dont
un helper Vermeer dépend (`clamp.ts`, `providerError.ts`, `isNativeWebSearchEndpoint`,
`resolveUserMaxContextTokens`, `shouldDefaultAgentWebSearch`), et toute suppression amont
d'un point de branchement (le fallback de `Error.tsx`, les 3 handlers Radix de
`SectionModal.tsx`, les `onSuccess` de `AgentPanel.tsx`).

## Phase 3 — exécution

Sur une branche dédiée, jamais sur `main` :

```bash
git checkout -b chore/merge-upstream-$(date +%Y%m%d)
git merge upstream/main      # ou rebase, selon le plan validé
```

Règle de résolution de conflit : **le concern Vermeer gagne par défaut**. On ne retire un
garde-fou documenté qu'en le remplaçant par un équivalent, et on l'écrit dans le plan.

Puis, dans l'ordre :

```bash
npm run smart-reinstall                        # rejoue le postinstall → patch-package
.claude/scripts/patches-status.sh              # doit être 100 % OK + uuid v4 = function
npm run build                                  # turborepo
cd packages/api && npx jest src/endpoints/google/llm.spec.ts src/endpoints/anthropic/llm.spec.ts src/endpoints/openai/llm.spec.ts src/agents/validation.spec.ts src/agents/initialize.websearch.spec.ts && cd ../..
cd client && npx jest src/components/Messages/Content/providerError.spec.ts src/components/Agents/tests/AgentCard.spec.tsx && cd ..
node .claude/scripts/i18n-parity.mjs           # les traductions sont un fichier de la watchlist
node -e "require('js-yaml').load(require('fs').readFileSync('librechat.yaml','utf8'))" && echo "yaml OK"
```

Un patch en dérive de version se régénère : corriger la source dans `node_modules`, puis
`npx patch-package <paquet>`, puis rejouer `smart-reinstall` et vérifier que le nouveau
`.patch` s'applique proprement.

## Vérifications qui ne se voient pas dans les tests

- **checkBalance** : le gating Vermeer est un budget mensuel, pas un porte-monnaie. Si l'amont
  a réintroduit `tokenCredits` / auto-refill, c'est une régression fonctionnelle silencieuse.
- **maxContextTokens** : `getSaveOptions` doit persister `userMaxContextTokens` (valeur brute),
  jamais la valeur calculée — sinon « Système » se fige à ~68400 et la conso explose.
- **web_search** : le set `nativeWebSearchEndpoints` ne doit exister qu'une fois
  (`parsers.ts`), consommé par `initialize.ts` via `isNativeWebSearchEndpoint`.
- **thinkingConfig Google** : la garde par modèle (omission pure pour 1.5/2.0, non-émission sur
  défauts pour flash-lite) ne doit pas redevenir un pass-through.

## Rapport final

Trois blocs : (1) le tableau de Phase 2 complété d'une colonne « preuve » (test passé, ligne
de code, diff) ; (2) les concerns dont le libellé §11 doit être mis à jour → enchaîner sur la
skill `watchlist` ; (3) ce qui reste ouvert (patch à régénérer, décision escaladée, test non
rejouable en local).

Rappel garde-fou §6 : la branche part en PR, jamais un push direct sur `main`.

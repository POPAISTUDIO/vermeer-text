# Fixtures de rejeu du triage désignateur

Rapports Playwright archivés, servant de **tests de garde** au triage QA
(`.github/workflows/qa-triage.yml`) — le second désignateur du système. Prescription :
[`docs/GOVERNANCE.md` §3](../../../docs/GOVERNANCE.md), « Tests de garde — un par interdit »
(« un interdit non testé s'érode »).

Le rejeu se lance à la main :

```bash
gh workflow run "QA Triage — rejeu sur fixtures" -R POPAISTUDIO/vermeer-text --ref main
gh workflow run "QA Triage — rejeu sur fixtures" -R POPAISTUDIO/vermeer-text --ref main -f cas=session-expiree
```

Il tourne **en dry-run vis-à-vis de GitHub** : un shim `gh` (`.github/scripts/triage-replay/`)
journalise et simule toute commande `gh issue` d'écriture, et sert des réponses figées aux
lectures. Le job ne porte que `contents: read`. Aucune issue n'est créée, commentée,
labellisée ni assignée — c'est un test du **raisonnement** du triage, pas un test qui pollue le
tracker. Le prompt testé est **extrait de `qa-triage.yml`**, jamais recopié : une copie
divergerait et le test ne testerait plus le désignateur réel.

Le verdict est un **code de sortie** : `verifier.sh` confronte le journal des commandes à
l'`attendu.json` de la fixture.

## Les trois fixtures

| Dossier | Situation rejouée | Attendu |
|---|---|---|
| `session-expiree` | La garde de session échoue, les 12 cas restent non exécutés | **Aucune** issue, **aucun** label. Une ligne au Dossier QA 112 |
| `known-issue-rouge` | Un cas tagué `@known-issue-114` est rouge (garde-fou 3) | Aucune issue, aucun label, **aucun commentaire sur l'issue 114** — seulement une ligne au Dossier QA |
| `tentative-2-rechute` | Une signature rechute sur une issue portant déjà `<!-- tentative: 2 -->` (garde-fou 4, plafond) | **Retrait** du label, **pas de re-pose**, synthèse sur l'issue, assignation à `Loisetoscer`, ligne au Dossier QA |

## Anatomie d'une fixture

| Fichier | Rôle |
|---|---|
| `report.json` | Rapport JSON Playwright du run rejoué. Copié en `qa-artifacts/report.json` par le workflow. **Les tags y sont sans `@`** (`["wave1","known-issue-114"]`) — c'est la forme réelle du reporter |
| `test-results/**/error-context.md` | Contexte d'échec, comme dans un vrai artefact |
| `gh/list-<label>.json` | Réponse figée de `gh issue list --label <label> …` |
| `gh/view-<N>.json` | Réponse figée de `gh issue view <N> …` — objet complet (`body`, `state`, `labels`, `comments`), superset de tous les `--json` demandés |
| `attendu.json` | Le verdict : `interdits` (aucune ligne du journal ne doit matcher) et `requis` (chaque motif doit matcher). Motifs = expressions régulières étendues |

Ajouter une fixture = créer un dossier avec ces fichiers. Le workflow les découvre seul.

## Quand le lancer

À la **revue mensuelle** ([`GOVERNANCE.md` §7](../../../docs/GOVERNANCE.md), point 2 « tests de
garde verts ») et **après toute modification du prompt de triage** — c'est le seul moyen de
vérifier qu'un interdit tient encore, un prompt n'étant pas une garantie mais une intention.

## Limite assumée

Un rejeu vert prouve que le triage **a raisonné juste sur ces trois situations**, pas qu'il le
fera sur toutes. Le modèle n'est pas déterministe : un rejeu rouge est un signal à instruire
(le prompt a-t-il régressé, la fixture est-elle encore fidèle), pas nécessairement un bug de
prompt. Un rejeu rouge deux fois de suite sur la même fixture est un **incident de
gouvernance** (§7) : un contrepoids qui ne tient plus.

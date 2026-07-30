# Fixtures de rejeu du verdict de livrable

Situations figées servant de **tests de garde** au gate « Verdict livrable » du job
`claude-autofix` (`.github/workflows/claude.yml`) — celui qui décide si un run d'agent codeur a
livré quelque chose. Prescription : [`docs/GOVERNANCE.md` §3](../../../../docs/GOVERNANCE.md),
« Tests de garde — un par interdit » (« un interdit non testé s'érode »).

Le rejeu se lance à la main, **en local**, sans jeton :

```bash
.github/scripts/verdict-replay/rejouer.sh              # les 4 fixtures
.github/scripts/verdict-replay/rejouer.sh pr-draft     # une seule
```

## Ce que ce rejeu a de particulier

Le gate de livrable n'est **pas un prompt** : c'est du shell. Il est donc directement
exécutable, donc directement testable — sans modèle, sans jeton, sans runner. C'est la
différence avec le [rejeu du triage](../triage/README.md), qui doit rejouer un modèle pour
éprouver un prompt.

Deux propriétés à ne pas perdre :

1. **DRY-RUN vis-à-vis de GitHub.** Un shim `gh`
   (`.github/scripts/verdict-replay/gh-dryrun.sh`) journalise et simule toute écriture
   (`gh issue comment/edit`, `gh pr edit`) ; les lectures (`gh pr list`, `gh api …/comments`)
   reçoivent des réponses figées servies depuis la fixture. Le tracker n'est jamais touché, et
   aucun jeton n'est requis.
2. **Le shell testé est EXTRAIT de `claude.yml`**, jamais recopié
   (`extraire-etape.mjs`). Une copie divergerait, et le test ne testerait plus le gate réel
   mais son fossile. Le bloc `env:` de l'étape est extrait avec elle : la fixture pilote le
   contexte, pas une réécriture du câblage.

Le verdict est double : le **code de sortie** du gate (`rejouer.sh`) **et** le journal des
commandes `gh`, confronté à l'`attendu.json` par le `verifier.sh` du rejeu de triage — partagé
tel quel, format de journal identique.

## Les quatre fixtures

| Dossier | Situation rejouée | Attendu |
|---|---|---|
| `pr-ready` | Une PR **ready** sur `fix/issue-141`, **plus un leurre** : PR #143 sur `fix/issue-1410` dont le corps mentionne `#141` en prose | **Vert.** Review demandée à `Loisetoscer` **sur la vraie PR (#144)**, aucune écriture sur l'issue, le leurre jamais sélectionné |
| `pr-draft` | Une PR **draft** sur `fix/issue-141` | **Rouge.** Commentaire sur l'issue disant **où** est le travail + assignation à `Loisetoscer`. **Aucune review demandée** sur un brouillon |
| `verdict-analyse` | Aucune PR ; dernier commentaire de `claude[bot]` portant `<!-- verdict: analyse-seule -->` | **Vert.** Arrêt réfléchi, **aucune** écriture. Cas (b), inchangé par le verdict draft/ready |
| `rien-livre` | Aucune PR, aucun marqueur — reproduction du run 77 du 30/07/2026 (annonce d'implémentation, puis rien) | **Rouge.** Commentaire de relance + assignation. Cas (c), inchangé par le verdict draft/ready |

Le leurre de `pr-ready` n'est pas décoratif : **c'est lui qui a trouvé un défaut réel** au
premier passage du rejeu, le 30/07/2026. L'ancienne sélection
`select(branche or renvoi) | first` prenait le premier de la liste retournée par `gh pr list`
(le plus récent d'abord), donc une PR étrangère mentionnant `#141` masquait la vraie et faisait
lire le mauvais état draft/ready. La branche prime désormais sur le renvoi dans le corps. Ne pas
retirer ce leurre.

## Anatomie d'une fixture

| Fichier | Rôle |
|---|---|
| `gh/pr-list.json` | Réponse figée de `gh pr list --json number,url,headRefName,body,isDraft` — un tableau, superset de tous les champs demandés |
| `gh/comments.json` | Réponse figée de `gh api repos/…/issues/N/comments` — tableau d'objets `{ user: { login }, body }`. Inutile quand une PR est trouvée (le gate sort avant) |
| `attendu.json` | Le verdict : `issue` (le numéro à rejouer), `code_sortie` (attendu du gate), `interdits` (aucune ligne du journal ne doit matcher) et `requis` (chaque motif doit matcher). Motifs = expressions régulières étendues |

Ajouter une fixture = créer un dossier avec ces fichiers. `rejouer.sh` les découvre seul.

## Quand le lancer

**Après toute modification du gate de livrable** — un gate non rejoué est une intention — et à la
**revue mensuelle** ([`GOVERNANCE.md` §7](../../../../docs/GOVERNANCE.md), point 2 « tests de
garde verts »).

## Reste à faire

**Câbler ce rejeu en CI.** Il ne tourne aujourd'hui qu'à la main : créer le workflow de rejeu
sortait du périmètre autorisé de la PR qui a introduit ce harnais (`claude.yml` seul).
Contrairement au rejeu de triage, ce workflow n'aura besoin **ni** de `id-token: write`, **ni**
d'un jeton de modèle — aucun agent n'y tourne.

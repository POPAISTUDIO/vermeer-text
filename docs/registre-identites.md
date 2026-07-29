# Registre des identités et pouvoirs

*Annexe vivante du [§1 de `GOVERNANCE.md`](GOVERNANCE.md#1--identités-et-pouvoirs). Un tableau par acteur : qui il est, ce qu'il ouvre, jusqu'où il va, ce qu'il n'a pas le droit de faire.*

**Établi le 29/07/2026.**

---

## Consignes de tenue

1. **Jamais de valeur de secret, jamais de fragment.** Ce fichier ne contient que des **noms** de secrets. Un jeton, même partiel, même tronqué, même « inoffensif », n'entre pas ici — et s'il y entrait par accident, il serait à considérer comme exposé et à roter immédiatement.
2. **Mise à jour au moment du changement**, pas à la revue suivante. Toute création, rotation, extension ou suppression de jeton se répercute ici **dans la même PR** que le changement qui l'a rendue nécessaire. Créer un pouvoir hors registre est un incident de gouvernance ([§7](GOVERNANCE.md#7--boucle-de-correction)).
3. **⚠️ Expirations à préciser à la prochaine rotation.** Aucune date d'expiration n'est lisible via l'API : `gh secret list` ne retourne que la date de dernière mise à jour, jamais l'échéance du jeton qu'il contient. Toutes les échéances ci-dessous sont donc **INFERRED** (« ~juillet 2027 », par défaut d'un an à compter de la rotation du 26-29/07/2026). **Consigne : à la prochaine rotation, relever la date exacte choisie dans l'interface GitHub / Grafana et la consigner ici, étiquetée OBSERVED.**
4. **Étiquettes de preuve** sur chaque ligne factuelle : **OBSERVED** (avec source et date), **INFERRED**, **UNKNOWN**. Ce qui n'est vérifiable nulle part est écrit `UNKNOWN` — sans broder.

### Sources de ce relevé

| Source | Ce qu'elle a établi | Date |
|---|---|---|
| `gh secret list -R POPAISTUDIO/{vermeer-text,vermeer-gitops,vermeer-gitops-prod}` | Noms des secrets et dates de dernière mise à jour — **OBSERVED** | 29/07/2026 |
| `gh variable list` sur les trois dépôts | **Aucune variable de dépôt** définie nulle part — OBSERVED. *(À noter : `release-train.yml` lit `vars.FLUX_WAIT_MINUTES` avec un défaut à `8` ; la variable n'étant pas définie, c'est le défaut qui s'applique.)* | 29/07/2026 |
| Fichiers de workflow des trois dépôts (`.github/workflows/`, local + `gh api …/contents/…`) | Quel secret est consommé par quel job, permissions déclarées, budgets | 29/07/2026 |
| `gh api repos/POPAISTUDIO/vermeer-gitops-prod/rulesets/9169830` | Écluse de production, bypass actors | 29/07/2026 |
| `gh api repos/POPAISTUDIO/vermeer-text/rulesets/19987595` | Écluse « Écluse main » de `vermeer-text`, relue en GET après création — **OBSERVED** | 29/07/2026 |
| `gh api repos/POPAISTUDIO/vermeer-gitops/{rulesets,collaborators,commits}` | Absence de ruleset, 27 collaborateurs (9 en `push` sans `admin`), régime de poussée directe sur `main` — **OBSERVED** | 29/07/2026 |
| `gh auth status` (Mac de l'atelier) | Scopes du `gh` local | 29/07/2026 |
| `ls -la ~/hermes-workspace/{bin,secrets}` + lecture des wrappers | Wrappers Loki et noms des fichiers de jetons Grafana (**contenu jamais lu**) | 29/07/2026 |

**État global des secrets — OBSERVED (29/07/2026)**

| Dépôt | Secrets présents | Dernière mise à jour |
|---|---|---|
| `POPAISTUDIO/vermeer-text` | `CLAUDE_CODE_OAUTH_TOKEN` · `GITOPS_PUSH_TOKEN` · `QA_STAGING_URL` · `QA_STORAGE_STATE` · `VERMEER_SECRETS_TOKEN` | `2026-07-29T14:56:37Z` · `2026-07-26T15:31:41Z` · `2026-07-26T15:04:55Z` · `2026-07-29T05:59:42Z` · `2026-07-26T19:05:24Z` |
| `POPAISTUDIO/vermeer-gitops` | `CLAUDE_CODE_OAUTH_TOKEN` | `2026-07-29T14:56:38Z` |
| `POPAISTUDIO/vermeer-gitops-prod` | **aucun** | — |

> **Écart résolu — les trois jetons du chantier 1 ne sont pas ceux qu'on lit ici.** Le chantier 1 (hygiène, 29/07/2026) a régénéré trois jetons exposés : **`CLAUDE_CODE_OAUTH_TOKEN` sur les deux dépôts** GitHub, et **les deux jetons Grafana d'Hermes** — ces derniers stockés en fichiers sur le Mac local, donc **structurellement invisibles à `gh secret list`** (voir acteur n° 8). Les dates du 29/07 relevées ci-dessus (`2026-07-29T14:56:37Z` et `…:38Z`) sont exactement la trace du premier ; les horodatages des fichiers `~/hermes-workspace/secrets/` (29/07, 17h38 et 17h40 — OBSERVED) sont celle des deux autres.
>
> **`GITOPS_PUSH_TOKEN` et `VERMEER_SECRETS_TOKEN` ne faisaient donc pas partie du périmètre du chantier 1.** Leurs dates du **26/07/2026** sont **INFERRED** cohérentes avec la campagne générale de renouvellement conduite avant la MEP v0.10.23 — et non avec un oubli de rotation. Expiration : **INFERRED** ~juillet 2027, comme le reste du parc. *(Ce point était marqué UNKNOWN à l'établissement du registre le 29/07/2026 ; tranché le jour même par la personne ayant conduit le chantier 1.)*
>
> **`QA_STORAGE_STATE`** (29/07 à 05h59) reste hors de ce raisonnement : il est réécrit **automatiquement à chaque run de QA** (rotation de session), sa date ne dit jamais rien d'une rotation de jeton.

> **`vermeer-gitops-prod` ne porte aucun secret — OBSERVED.** Ce n'est pas un manque de configuration : c'est la règle « aucun agent n'écrit vers la production » telle qu'elle se lit dans l'infrastructure. Le jeton branches-only de l'agent MEP (⏳ chantier 7) y sera **le premier secret**, et il n'y entrera qu'après le ruleset — lequel existe depuis le 29/07/2026 ([GOVERNANCE.md §1](GOVERNANCE.md#amendement-acté--le-jeton-de-lagent-mep)).

**Note transversale sur `GITHUB_TOKEN`** — jeton éphémère fourni par GitHub Actions à chaque run, périmé à la fin du job, jamais stocké, jamais rotable. Son périmètre est celui du bloc `permissions:` du workflow qui le consomme. Il n'est donc pas listé comme secret de dépôt, mais il est le vecteur d'écriture réel de plusieurs acteurs ci-dessous : c'est son bloc `permissions:` qui fait foi, pas son nom.

---

## Acteurs vivants

### 1. Agent codeur — `vermeer-text`

| | |
|---|---|
| **Identité** | GitHub App Claude, exécutée par `anthropics/claude-code-action@v1` dans `.github/workflows/claude.yml` (dépôt `POPAISTUDIO/vermeer-text`), jobs `claude-interactive` et `claude-autofix` |
| **Secrets utilisés** | `CLAUDE_CODE_OAUTH_TOKEN` · `GITHUB_TOKEN` (éphémère) — **OBSERVED** |
| **Scopes / permissions** | Bloc `permissions:` du workflow : `contents: write` · `pull-requests: write` · `issues: write` · `actions: read` · `id-token: write` — **OBSERVED** |
| **Stockage** | `CLAUDE_CODE_OAUTH_TOKEN` : secret Actions du dépôt `vermeer-text` — **OBSERVED** (`gh secret list`, mis à jour `2026-07-29T14:56:37Z`) |
| **Expiration** | **INFERRED** ~juillet 2027 (jeton OAuth Claude Code, rotation du 29/07/2026). Durée réelle **UNKNOWN** — non exposée par l'API |
| **Permis** | Lire tout le dépôt · créer une branche `fix/issue-N` · committer dessus · ouvrir une PR référençant l'issue · commenter issues et PRs · faire tourner `typecheck` et les tests unitaires |
| **Interdits** | **Merger une PR** (quelle qu'elle soit) · pousser sur `main` · ouvrir une PR sans avoir identifié la cause racine avec confiance (→ commentaire d'analyse à la place) · fix symptomatique · introduire une régression par rapport aux baselines de `CLAUDE.md` · toucher aux dépôts gitops (hors de son atteinte) |
| **Fiabilité** | **Écriture forte, désormais bornée côté serveur.** Le jeton reste en `contents: write`, mais depuis le **29/07/2026** le ruleset **« Écluse main »** (`19987595`) rend `main` inatteignable sans PR — **OBSERVED**, `gh api repos/POPAISTUDIO/vermeer-text/rulesets/19987595`. L'interdiction de pousser sur `main` ne repose donc plus sur le seul prompt : elle est opposable par le serveur. La relecture humaine de PR reste le contrôle du **contenu** ([GOVERNANCE.md §4, régime 2](GOVERNANCE.md#4--lécluse)) |

### 2. Agent config — `vermeer-gitops`

| | |
|---|---|
| **Identité** | GitHub App Claude, `anthropics/claude-code-action@v1` dans `.github/workflows/claude.yml` du dépôt `POPAISTUDIO/vermeer-gitops`, jobs `claude-interactive` et `claude-autofix` |
| **Secrets utilisés** | `CLAUDE_CODE_OAUTH_TOKEN` · `GITHUB_TOKEN` (éphémère) — **OBSERVED** |
| **Scopes / permissions** | `contents: write` · `pull-requests: write` · `issues: write` · `actions: read` · `id-token: write` — **OBSERVED** |
| **Stockage** | Secret Actions du dépôt `vermeer-gitops` — **OBSERVED** (mis à jour `2026-07-29T14:56:38Z`) |
| **Expiration** | **INFERRED** ~juillet 2027. Durée réelle **UNKNOWN** |
| **Permis** | Éditer, **uniquement sous `dev/llm/` et `staging/llm/`** : `helm-release.yaml` (hors ligne de tag), `librechat.yaml`, `kustomization.yaml`, `external-secrets.yaml`, `oci-repository.yaml` · branche `config/issue-N` · PR argumentée · commenter l'issue · valider la syntaxe YAML de chaque fichier touché |
| **Interdits** | La clé `image.tag` de `dev/llm/` et `staging/llm/helm-release.yaml` · l'annotation `kubectl.kubernetes.io/restartedAt` · **tout fichier hors `dev/llm/` et `staging/llm/`** (`*/app/`, `alpha/`, `abstraction-layer`, `scripts/`) · **toute demande touchant la prod** (→ refus + commentaire, pas de PR) · merger · pousser sur `main` · restructurer, réordonner, reformater un YAML · supprimer un commentaire existant, en particulier `# Vermeer:` |
| **Fiabilité** | **C'est le point faible du système — le seul acteur en écriture sans barrière technique.** `contents: write` sur un dépôt **sans ruleset** (**OBSERVED**, 29/07/2026 : `gh api …/rulesets` → vide, `…/branches/main/protection` → 404) : ici l'interdiction de pousser sur `main` ne vit **que dans son prompt** et dans le merge humain. `vermeer-gitops` est un dépôt **partagé** où la poussée directe est le régime de travail d'autres équipes, donc y poser un ruleset est une décision multi-équipes — voir [GOVERNANCE.md §4, régime 3](GOVERNANCE.md#4--lécluse) et le point de vigilance mensuel dédié. Réserve aggravée par la nature du dépôt : un `librechat.yaml` invalide fait sortir le process en code 1, **application down sans mode dégradé**. D'où l'exigence d'édition chirurgicale + validation `yaml.safe_load` inscrite au prompt |

### 3. QA nightly — `vermeer-text`

| | |
|---|---|
| **Identité** | Workflow `qa-nightly.yml`, job `wave1` (dépôt `vermeer-text`). Suite Playwright + une étape d'analyse `claude-code-action` |
| **Secrets utilisés** | `QA_STORAGE_STATE` · `QA_STAGING_URL` · `VERMEER_SECRETS_TOKEN` · `CLAUDE_CODE_OAUTH_TOKEN` · `GITHUB_TOKEN` — **OBSERVED** |
| **Scopes / permissions** | Workflow : `contents: read` · `issues: write` · `id-token: write` — **OBSERVED**. Analyse Claude bridée par `--allowedTools "Read,Glob,Grep,Bash(gh issue *)"` |
| **Stockage** | Secrets Actions de `vermeer-text` — **OBSERVED**. `QA_STORAGE_STATE` : `2026-07-29T05:59:42Z`, **réécrit par le job lui-même à chaque run** (la session staging rote son refresh token à chaque chargement, donc à usage unique) |
| **Expiration** | `QA_STORAGE_STATE` : **usage unique**, périmé après un chargement — republié en fin de job (OBSERVED). `VERMEER_SECRETS_TOKEN` : **INFERRED** ~juillet 2027 (mis à jour `2026-07-26T19:05:24Z`). `QA_STAGING_URL` : n'expire pas (URL, pas un jeton) |
| **Permis** | Jouer les 12 cas P0 `@wave1` contre staging · lire `report.json`, les `error-context.md` et `e2e/staging/README.md` · créer / commenter **le seul** Dossier QA (issue 112, label `qa-nightly`) · créer le label `qa-nightly` s'il manque · **republier `QA_STORAGE_STATE`** via `VERMEER_SECRETS_TOKEN` |
| **Interdits** | Modifier un fichier du dépôt · déduire un PASS d'une absence d'information · compter un `skipped` comme un succès · présenter une session expirée comme un défaut produit · créer ou fermer **toute autre issue** que le Dossier QA (le triage est un autre workflow) |
| **Fiabilité** | **Le point sensible est `VERMEER_SECRETS_TOKEN`** : il permet d'**écrire les secrets** du dépôt (`gh secret set`) — le pouvoir le plus élevé du registre côté `vermeer-text`. Il n'est utilisé que pour republier la session QA. **INFERRED** : jeton fine-grained portant `secrets: write` sur `vermeer-text` ; scopes exacts **UNKNOWN** (non exposés par l'API). ⏳ Le compte de service du **chantier 5** supprime le besoin de `QA_STORAGE_STATE` — et donc l'essentiel de la raison d'être de ce jeton |

### 4. Canary providers — `vermeer-text`

| | |
|---|---|
| **Identité** | Workflow `canary-providers.yml`, job `canary` (dépôt `vermeer-text`). **Aucun agent Claude** — assertions déterministes seules |
| **Secrets utilisés** | `QA_STORAGE_STATE` · `QA_STAGING_URL` · `VERMEER_SECRETS_TOKEN` · `GITHUB_TOKEN` — **OBSERVED** |
| **Scopes / permissions** | `contents: read` · `issues: write` — **OBSERVED** (le plus étroit des workflows QA : pas d'`id-token`) |
| **Stockage** | Secrets Actions de `vermeer-text` (partagés avec la QA nightly) — **OBSERVED**. Groupe de concurrence `qa-session` partagé avec `qa-nightly.yml` : les deux ne tournent jamais en parallèle |
| **Expiration** | Identique à la QA nightly |
| **Permis** | Jouer les 4 cas `@canary` (GEN-02, GEN-03, GEN-06, SEL-01) · créer les labels `canary` et `infra` s'ils manquent · ouvrir une issue d'alerte quand le canary est rouge (avec la consigne « Point 0 avant tout diagnostic ») · republier `QA_STORAGE_STATE` |
| **Interdits** | Modifier un fichier du dépôt · poser un **label déclencheur** — il pose `canary` + `infra`, deux labels de classement, **jamais `claude-fix`** ([règle « l'observation ne désigne pas »](GOVERNANCE.md#6--observation)) · conclure quoi que ce soit avant le Point 0 |
| **Fiabilité** | **Élevée.** Aucun jugement de modèle dans la boucle, verdict = code de sortie, gate final explicite (`exit 1` si rouge). Porte le même `VERMEER_SECRETS_TOKEN` que la QA nightly, avec les mêmes réserves |

### 5. Triage QA — `vermeer-text`

| | |
|---|---|
| **Identité** | Workflow `qa-triage.yml`, job `triage` (dépôt `vermeer-text`). **Second désignateur du système** |
| **Secrets utilisés** | `CLAUDE_CODE_OAUTH_TOKEN` · `GITHUB_TOKEN` — **OBSERVED** |
| **Scopes / permissions** | `contents: read` · `issues: write` · `actions: read` · `id-token: write` — **OBSERVED**. Bridé par `--allowedTools "Read,Glob,Grep,Bash(gh issue *)"` |
| **Stockage** | Secrets Actions de `vermeer-text` — **OBSERVED** |
| **Expiration** | **INFERRED** ~juillet 2027 (`CLAUDE_CODE_OAUTH_TOKEN`) |
| **Permis** | Télécharger et lire les artefacts du run échoué · classer chaque échec en **BUG PRODUIT / FLAKY-INFRA / SESSION EXPIRÉE / INDÉTERMINÉ** · commenter le Dossier QA · **créer une issue labellisée `claude-fix`** — c'est-à-dire **mettre l'agent codeur en marche** — dans la seule catégorie BUG PRODUIT, plafond **3 issues par run** · commenter une issue existante quand le cas rechute |
| **Interdits** | Corriger quoi que ce soit · modifier un fichier du dépôt · fermer une issue · deviner (artefacts absents ou `report.json` illisible → commentaire au Dossier QA puis arrêt) · labelliser sur un verdict `test`, `infra`, `SESSION EXPIRÉE` ou `INDÉTERMINÉ` · instruire `CTX-02` comme un bug (SKIP motivé documenté) |
| **Fiabilité** | **C'est le pouvoir le plus sensible du système — et il tourne avec deux contrepoids manquants.** OBSERVED (`qa-triage.yml`, 29/07/2026) : garde-fous **1** (bug prouvé), **2** (dédup, par identifiant de cas et non par signature stricte), **5** (veto) et **6** (plafond 3/run) câblés ; garde-fous **3** (exclusion `@known-issue-N`) et **4** (plafond de 2 tentatives, retrait de label, notification) **non câblés**. ⏳ **chantier 4**. Détail : [GOVERNANCE.md §2](GOVERNANCE.md#le-second-désignateur--la-désignation-automatique-du-triage) |

### 6. Release train — `vermeer-text` → `vermeer-gitops`

| | |
|---|---|
| **Identité** | Workflow `release-train.yml`, job `propagate` (dépôt `vermeer-text`). Commits signés `vermeer-release-train[bot]` / `vermeer-release-train@users.noreply.github.com`. **Aucun agent Claude** — shell déterministe |
| **Secrets utilisés** | `GITOPS_PUSH_TOKEN` · `GITHUB_TOKEN` — **OBSERVED** |
| **Scopes / permissions** | Workflow : `contents: read` · `issues: write` · `actions: write` (dispatch de la QA) — **OBSERVED**. `GITOPS_PUSH_TOKEN` : **INFERRED** — jeton fine-grained `Contents: write` + `Pull requests: write` sur `vermeer-gitops` (déduit de l'usage réel : clone HTTPS, `push --force` sur `bump/sha-*`, `gh pr create`, `gh pr merge --squash` **sans `--admin`**, et du commentaire du workflow qui le dit explicitement). Scopes exacts **UNKNOWN** |
| **Stockage** | `GITOPS_PUSH_TOKEN` : secret Actions de `vermeer-text` — **OBSERVED** (mis à jour `2026-07-26T15:31:41Z`) |
| **Expiration** | **INFERRED** ~juillet 2027 |
| **Permis** | Résoudre le tag `sha-<7>` depuis le SHA de build · cloner `vermeer-gitops` · éditer **la seule ligne `tag:`** de `dev/llm/helm-release.yaml` et `staging/llm/helm-release.yaml` · pousser `bump/sha-*` (`--force` assumé : contenu reproductible, aucun autre auteur sur ces branches) · ouvrir la PR · **la merger en squash** — **cas conforme** à l'invariant, pas une exception : aucun modèle dans la boucle, diff mécanique borné à la ligne de version ([GOVERNANCE.md §3](GOVERNANCE.md#release-train-vermeer-text--vermeer-gitops)) · attendre Flux · dispatcher la QA staging · ouvrir/commenter l'issue `release-train` en cas d'échec |
| **Interdits** | Tout diff autre que des lignes de tag (**cinq gardes de diff**, abandon du job sur chacune) · tout fichier hors des deux `helm-release.yaml` · **tout chemin contenant `prod`** (ceinture et bretelles) · partir sur autre chose qu'un build vert issu d'un `push` sur `main` (les tags `v0.10.x` sont nativement exclus) · **tout retry automatique** — il trace et s'arrête, la reprise est une décision humaine |
| **Fiabilité** | **La plus haute du registre.** Aucun modèle dans la boucle, deux familles de gardes — cinq de diff, deux d'amont — **avant** la poussée, vérification de l'état final, aucun retry, échec tracé en issue. Limite connue et documentée dans le fichier : si le job dépasse `timeout-minutes` (25), il est annulé et l'étape de rapport d'échec **peut ne pas s'exécuter** — surveiller aussi l'onglet Actions |

### 7. Checks digest — `vermeer-gitops-prod`

| | |
|---|---|
| **Identité** | Workflow `checks-digest.yml`, job `yaml-valide` (dépôt `POPAISTUDIO/vermeer-gitops-prod`). **Seul workflow du dépôt de production** — OBSERVED |
| **Secrets utilisés** | **Aucun** — OBSERVED (le dépôt n'en porte aucun) |
| **Scopes / permissions** | Aucun bloc `permissions:` déclaré → défaut du dépôt appliqué. Le job ne fait que lire le checkout et publier son statut : **aucune écriture** — OBSERVED |
| **Stockage** | — |
| **Expiration** | — |
| **Permis** | Valider récursivement (`yaml.safe_load_all`) **tous** les `.yaml`/`.yml` du dépôt sur chaque `pull_request` vers `main`, et publier le contexte de check **`yaml-valide`** — le seul required status check de l'écluse prod |
| **Interdits** | Écrire quoi que ce soit · merger · commenter |
| **Fiabilité** | **Élevée, et critique par position** : c'est la porte mécanique de l'écluse prod. **Conséquence à connaître** — le désactiver **bloquerait toute PR vers `main`** (check requis manquant). Il est donc explicitement **exclu du coupe-circuit** ([GOVERNANCE.md §7](GOVERNANCE.md#coupe-circuit--endormir-tout-le-système)) |

### 8. Hermes — capteur interactif (Mac de l'atelier)

| | |
|---|---|
| **Identité** | Session Claude Code locale sur le Mac, **hors GitHub Actions**. Capteur à la voix, diagnostics, sessions sur ordre. Rien ne migre en CI côté interactif |
| **Secrets utilisés** | Fichiers locaux `~/hermes-workspace/secrets/grafana-token` (staging) et `~/hermes-workspace/secrets/grafana-token-prod` (production) — **OBSERVED** (`ls -la`, 29/07/2026 : mode `-rw-------`, propriétaire seul ; **contenu jamais lu**). Côté GitHub : l'authentification `gh` du compte humain |
| **Scopes / permissions** | **Grafana** : jetons **read-only** — **INFERRED** (les wrappers n'émettent que des `POST /api/ds/query`, une API de lecture ; le rôle exact du jeton côté Grafana est **UNKNOWN**, non vérifiable depuis le poste). **GitHub** : `gist, read:org, repo, workflow` — **OBSERVED** (`gh auth status`, 29/07/2026, jeton en keyring). ⚠️ **`repo` inclut l'écriture** |
| **Stockage** | Jetons Grafana : fichiers locaux ci-dessus, permissions `600`. Jeton GitHub : **keyring macOS** du compte `Loisetoscer` — **OBSERVED** |
| **Expiration** | Jetons Grafana : **UNKNOWN** (créés/mis à jour le 29/07/2026 à 17h38 et 17h40 — OBSERVED sur l'horodatage des fichiers ; l'échéance côté Grafana n'est pas lisible depuis le poste). Jeton `gh` : **UNKNOWN** |
| **Outils d'observation** | **`lokiq '<logql>' [heures=1] [max_lignes=100]`** → Grafana staging `https://ht7pcjaa.staging.vermeer.cloud`, datasource `loki`, `POST /api/ds/query` — OBSERVED. **`lokiq-prod`** → même contrat sur `https://gca86pfp.vermeer.ai` (production) — OBSERVED. Les deux en `set -euo pipefail`, jeton lu depuis son fichier au moment de l'appel, jamais dans l'environnement |
| **Familles `gh` utilisées** | **INFERRED** — aucune allowlist n'est configurée (`~/.claude/settings.json` ne contient que `theme` et `tui` ; `.claude/settings.local.json` du dépôt n'autorise que `Skill(claude-api*)`) — OBSERVED. Les familles réellement employées se déduisent de l'usage : `gh api` (lecture : rulesets, contents, secrets, variables) · `gh issue` (view/list/create/comment) · `gh pr` (list/view) · `gh run` / `gh workflow` (list/view/run) · `gh secret list` (**noms seuls**) · `gh label list`. **Il n'y a pas de restriction technique à ces familles** : le périmètre d'Hermes est son mandat, pas une configuration |
| **Permis** | Lire Loki staging et prod · lire l'état GitHub des trois dépôts · diagnostiquer · rendre compte avec la discipline OBSERVED / INFERRED / UNKNOWN · **annoncer chaque commande avant de l'exécuter** · ⏳ *chantier 4* : créer une issue labellisée **sur ordre explicite**, avec réflexe de cadrage (2-3 questions : comportement attendu, emplacement UI, critère d'acceptation) |
| **Interdits** | Écrire vers la production, par quelque voie que ce soit · merger une PR · pousser sur `main` · **désigner du travail de sa propre initiative** (le label ne se pose que sur ordre) · présenter une déduction comme un fait · combler un `UNKNOWN` par une hypothèse plausible |
| **Fiabilité** | **Lecture seule conventionnelle, pas technique** — et c'est explicite : le scope `repo` du `gh` local autorise l'écriture, les jetons Grafana ne sont read-only qu'en INFERRED. La garantie réelle est la **règle d'annonce** : une commande annoncée est une commande arbitrable avant exécution. C'est un contrepoids humain, assumé comme tel ([GOVERNANCE.md §6](GOVERNANCE.md#hermes--le-capteur)) |

### 9. Claude Code atelier (Mac de l'atelier)

| | |
|---|---|
| **Identité** | Sessions Claude Code de développement, dans les clones locaux (`~/vermeer-text`, `~/vermeer-gitops`, …). C'est l'identité qui **écrit ce document** |
| **Secrets utilisés** | Aucun secret de dépôt. Authentification `gh` du compte humain (keyring), clés SSH/HTTPS Git locales |
| **Scopes / permissions** | `gist, read:org, repo, workflow` — **OBSERVED** (`gh auth status`, 29/07/2026). **Droits d'écriture complets** sur les trois dépôts, plus le rôle Admin sur `vermeer-gitops-prod` (**INFERRED** de `current_user_can_bypass: "always"` sur le ruleset 9169830 — OBSERVED) |
| **Stockage** | Keyring macOS. **Aucun jeton dans un fichier du dépôt, aucun dans l'environnement du shell** |
| **Expiration** | **UNKNOWN** |
| **Permis** | Tout ce que l'humaine demande explicitement dans la session : créer une branche, committer, ouvrir une PR, ouvrir une issue, lire l'état des dépôts |
| **Interdits** | Pousser sur `main` sans revue (garde-fou [`CLAUDE.md` §6](../CLAUDE.md)) · committer le `.env` · écrire une clé en clair dans un fichier versionné · **utiliser le bypass admin sans issue de traçage** ([GOVERNANCE.md §4](GOVERNANCE.md#4--lécluse)) |
| **Hors mandat** | Porter le rôle Admin sur un dépôt partagé **n'en fait pas la garante des contributions des autres équipes**. Les promotions `prod/app/` et `*/app/` relèvent de leurs relecteurs ; le devoir de traçage du bypass ne couvre que ses propres usages, sur le périmètre Vermeer Chat |
| **Fiabilité** | **C'est l'identité la plus puissante du système, et la moins bridée techniquement.** C'est cohérent — c'est celle de l'humaine à l'écluse — mais il faut le nommer : la sûreté de l'ensemble repose sur la discipline de cette session, pas sur une configuration. C'est aussi elle qui porte le pouvoir de bypass prod |

### 10. Flux — dev et staging

| | |
|---|---|
| **Identité** | Contrôleur Flux dans le cluster, réconciliant `POPAISTUDIO/vermeer-gitops` (chemins `dev/llm/`, `staging/llm/`) |
| **Secrets utilisés** | **UNKNOWN** — credentials in-cluster (deploy key ou App), gérés côté Ops, non lisibles depuis les dépôts applicatifs |
| **Scopes / permissions** | Lecture du dépôt gitops + droits d'application dans le cluster. Détail **UNKNOWN** |
| **Stockage** | Secrets Kubernetes du cluster — **UNKNOWN** en détail |
| **Expiration** | **UNKNOWN** |
| **Permis** | Appliquer l'état mergé. Intervalle de réconciliation : **5 min en dev, 2 min en staging** — **INFERRED** (valeurs inscrites dans le prompt de l'agent config, `vermeer-gitops/claude.yml`, OBSERVED ; non revérifiées dans les manifestes). Le release train attend `FLUX_WAIT_MINUTES` (défaut **8**) avant de lancer la QA — OBSERVED |
| **Interdits** | Rien à interdire : Flux n'a **aucune initiative**. Il applique ce qui a franchi l'écluse, et rien d'autre. Il n'ouvre pas de PR, ne juge pas, ne désigne pas |
| **Fiabilité** | **Machinerie déterministe.** Il n'est **pas** touché par le coupe-circuit ([GOVERNANCE.md §7](GOVERNANCE.md#coupe-circuit--endormir-tout-le-système)) : on gèle les nouvelles propositions, pas l'infrastructure en place |

### 11. Flux — production

| | |
|---|---|
| **Identité** | Contrôleur Flux du cluster de production, réconciliant `POPAISTUDIO/vermeer-gitops-prod` |
| **Secrets utilisés** | **UNKNOWN** — in-cluster, côté Ops |
| **Scopes / permissions** | **UNKNOWN** |
| **Stockage** | **UNKNOWN** |
| **Expiration** | **UNKNOWN** |
| **Permis** | Appliquer l'état mergé sur `main` de `vermeer-gitops-prod`. Intervalle de réconciliation : **UNKNOWN** (non relevé ; à préciser lors du chantier 5, où le smoke automatique devra l'attendre) |
| **Interdits** | Aucune initiative, comme ci-dessus |
| **Fiabilité** | **Machinerie déterministe.** C'est le **seul** chemin par lequel un changement atteint la production — et il ne part que d'un merge protégé par le ruleset ([GOVERNANCE.md §4, régime 1](GOVERNANCE.md#4--lécluse)). Il réconcilie `prod/llm/` **et** `prod/app/` : pour le premier, le merge est relu selon cette gouvernance ; pour le second, il relève des relectures des autres équipes. Flux ne fait pas la différence — la gouvernance, si |

### 12. `gitops-bot` — hotswap staging (acteur hors périmètre)

| | |
|---|---|
| **Identité** | Workflow `deploy-staging.yml`, job `hotswap` (dépôt `vermeer-gitops`). Commits `gitops-bot` / `gitops-bot@users.noreply.github.com`. **N'appartient pas au système d'orchestration Vermeer-LLM** |
| **Secrets utilisés** | `GITHUB_TOKEN` (éphémère) — **OBSERVED**. Aucun secret de dépôt |
| **Scopes / permissions** | `permissions: contents: write` — **OBSERVED** |
| **Stockage** | — |
| **Expiration** | — (jeton éphémère de run) |
| **Permis** | Sur `repository_dispatch` de type `deploy-staging` : exécuter `scripts/hotswap.sh -r <service> -b <tag> -e staging`, qui **pousse directement** dans le dépôt. Groupe de concurrence `gitops-staging-deploy` (sérialisé pour éviter un push non fast-forward) |
| **Interdits** | Rien n'est défini par cette gouvernance : **il ne relève pas d'elle** |
| **Fiabilité** | **Inscrit pour mémoire, pas pour contrôle.** Il sert d'autres produits du dépôt (`*/app/`, `abstraction-layer`) et écrit dans le dépôt où travaille l'agent config. Son existence est la raison pour laquelle l'agent config a un périmètre **explicitement borné** à `dev/llm/` et `staging/llm/`. Toute intervention sur son périmètre est une décision d'équipe — **UNKNOWN** : qui l'opère et qui déclenche ses dispatchs |

---

## Identités futures (placeholders)

*Elles n'existent pas encore. Elles sont inscrites d'avance pour que le pouvoir soit décrit **avant** d'être créé — c'est l'ordre imposé par [GOVERNANCE.md §1](GOVERNANCE.md#1--identités-et-pouvoirs).*

### 13. Compte de service de test — ⏳ chantier 5

| | |
|---|---|
| **Identité** | Compte applicatif dédié à la vérification automatique (QA staging, Point 0 + smoke prod). **Identifiable** : son trafic doit être isolable dans les logs et distinguable d'un utilisateur réel |
| **Secrets utilisés** | À définir. **Nommage attendu** : identifiants du compte en secrets Actions, noms explicites. **Ne jamais réutiliser** un compte réel |
| **Scopes / permissions** | Périmètre **read-only fonctionnel** : se connecter, envoyer une requête minimale, lire une réponse. **Aucun droit d'administration applicative** |
| **Stockage** | Secrets Actions de `vermeer-text` (**INFERRED** — le workflow de smoke y vivra) |
| **Expiration** | À consigner **OBSERVED** à la création |
| **Permis** | Exercer la production **par l'application** (HTTP), et **nettoyer derrière lui** — aucune conversation, aucun fichier, aucun état résiduel |
| **Interdits** | Toute écriture d'infrastructure · tout accès gitops · tout jeton d'écriture GitHub · laisser un état en production |
| **Bénéfice attendu** | Supprime la fragilité `QA_STORAGE_STATE` (session à usage unique capturée à la main) et, avec elle, l'essentiel du besoin de `VERMEER_SECRETS_TOKEN` |

### 14. Crons d'observation — ⏳ chantier 6

| | |
|---|---|
| **Identité** | Missions récurrentes d'Hermes migrées en crons GitHub Actions, pour tourner Mac éteint : scan de nuit quotidien · canary providers **prod** · check de drift hebdomadaire staging ↔ prod |
| **Secrets utilisés** | Jetons Grafana/Loki **read-only** en secrets Actions (équivalents des fichiers locaux d'Hermes) + identifiants du compte de service (n° 13) pour le canary prod |
| **Scopes / permissions** | **Lecture seule, sans exception.** `contents: read` · `issues: write` (pour l'issue instruite). **Jamais** de jeton d'écriture |
| **Stockage** | Secrets Actions — dépôt à arbitrer au chantier 6 |
| **Expiration** | À consigner **OBSERVED** à la création |
| **Permis** | Lire les journaux · comparer `librechat.yaml` + `configEnv` staging ↔ prod · **ouvrir une issue instruite** (preuves, contexte, taux) et notifier · journaliser un « RAS » horodaté quand tout va bien |
| **Interdits** | **Poser un label déclencheur** — l'issue est ouverte **sans label** ([règle « l'observation ne désigne pas »](GOVERNANCE.md#6--observation)) · toute écriture · tout accès gitops en écriture |
| **À ajouter** | À l'étape 1 du coupe-circuit ([GOVERNANCE.md §7](GOVERNANCE.md#coupe-circuit--endormir-tout-le-système)) |

### 15. Agent MEP — jeton branches-only — ⏳ chantier 7

| | |
|---|---|
| **Identité** | Workflow de préparation de MEP (`workflow_dispatch` **uniquement, jamais de cron**), produisant le tag et le digest en PR sur `vermeer-gitops-prod` |
| **Secrets utilisés** | Un jeton `contents:write` sur `vermeer-gitops-prod` **limité aux branches** + `pull-requests: write`. **Ce sera le premier secret du dépôt de production** (aujourd'hui : aucun — OBSERVED) |
| **Scopes / permissions** | Écriture de branches et de PRs. **`main` inatteignable** — non par la configuration du jeton seule, mais par le **ruleset 9169830** |
| **Stockage** | Secret Actions — dépôt à arbitrer (`vermeer-text` si le workflow y vit) |
| **Expiration** | À consigner **OBSERVED** à la création |
| **Permis** | Vérifier les préconditions (dernière QA train verte + canary du matin vert + aucun incident ouvert) · poser le tag · pousser une branche de digest · ouvrir la PR (état des lieux, arbitrages soumis) · **puis STOP** · journaliser au Dossier MEP |
| **Interdits** | **Merger** · atteindre `main` · **tout cron** (invariant) · créer quoi que ce soit si une seule précondition manque → **STOP motivé** |
| **Ordre obligatoire** | **Le ruleset existe AVANT le jeton.** Il existe depuis le 29/07/2026 (OBSERVED) : la condition est remplie. **Test de garde à la création et à chaque rotation** : tentative de poussée directe sur `main` → doit être refusée ([GOVERNANCE.md §3](GOVERNANCE.md#tests-de-garde--un-par-interdit)) |

### 16. Agent comm' — ⏳ chantier 8

| | |
|---|---|
| **Identité** | Workflow de comm' de release, déclenché par le rapport MEP vert (ou en `workflow_dispatch` dégradé) |
| **Secrets utilisés** | `CLAUDE_CODE_OAUTH_TOKEN` · `GITHUB_TOKEN`. **Aucun secret d'envoi** (pas de SMTP) : la notification passe par le mécanisme GitHub natif du Dossier Releases |
| **Scopes / permissions** | `contents: write` **restreint par convention et par test de garde à `docs/comm/`** · `pull-requests: write` · `issues: write` |
| **Stockage** | Secret Actions de `vermeer-text` (**INFERRED** — `docs/comm/` y vivra) |
| **Expiration** | À consigner **OBSERVED** à la création |
| **Permis** | Calculer le delta **depuis les tags et le digest** (`git log --oneline` entre tags + diff du digest gitops-prod) · produire deck fonctionnalités + `CHANGELOG.md` **sous `docs/comm/`** · ouvrir une PR (le merge est un contrôle **éditorial**) · poster la note au Dossier Releases |
| **Interdits** | **Écrire hors de `docs/comm/`** · **envoyer quoi que ce soit aux utilisateurs** (c'est l'humaine qui annonce) · rédiger le delta **de mémoire** — il se calcule, sinon la comm' colle au prévu et non au déployé · merger sa PR |
| **Test de garde associé** | Check de PR : `git diff --name-only` entièrement sous `docs/comm/`, sinon échec |

# GOVERNANCE.md — Gouvernance du système d'orchestration agentique Vermeer

*Source de vérité **prescriptive**. Le [manifeste](#renvois) raconte l'existant, [`architecture-cible-v2.md`](architecture-cible-v2.md) décrit la cible et la feuille de route, **ce document prescrit**. En cas de contradiction entre un document et un workflow réel, c'est le réel qui gagne et l'écart est signalé en PR ; en cas de contradiction entre un document et ce fichier sur une règle, c'est ce fichier qui gagne.*

**Version 1 — 29/07/2026**, au lendemain de la première MEP conduite par le système (v0.10.23, 28-29/07/2026).

---

## Comment lire ce document

**Il prescrit la CIBLE.** Une partie des dispositions ci-dessous n'est pas encore câblée. Chacune de celles-là porte un marqueur explicite :

> ⏳ **entre en vigueur au chantier N** — *(feuille de route : [`architecture-cible-v2.md` §5](architecture-cible-v2.md#5-feuille-de-route--sept-chantiers-dans-lordre-des-dépendances), huit chantiers)*

Tout ce qui ne porte pas ce marqueur est **vivant aujourd'hui** et opposable dès maintenant. À la revue mensuelle (§7), cette distinction est le premier tri : une règle vivante qui n'est pas respectée est un incident ; une règle en attente ne l'est pas.

**Étiquettes de preuve.** Les constats factuels portent leur étiquette : **OBSERVED** (avec sa source et sa date), **INFERRED**, **UNKNOWN**. Une affirmation sans étiquette est une *règle*, pas un constat — elle n'a pas à être prouvée, elle a à être respectée.

**Ce qu'il régit, et ce qu'il ne régit pas.** Ce document gouverne le **système d'orchestration agentique de Vermeer Chat** : ses agents, ses jetons, ses écluses. Deux des trois dépôts sont **partagés avec d'autres équipes** — `vermeer-gitops` (`*/app/`, `abstraction-layer`) et `vermeer-gitops-prod` (`prod/app/`). Sur ceux-là, les règles ci-dessous ne s'appliquent qu'au **périmètre Vermeer Chat** :

| Dépôt | Périmètre régi par ce document | Hors périmètre |
|---|---|---|
| `vermeer-text` | tout le dépôt | — |
| `vermeer-gitops` | `dev/llm/` · `staging/llm/` | `*/app/`, `abstraction-layer`, `scripts/` |
| `vermeer-gitops-prod` | `prod/llm/` | `prod/app/` |

*(OBSERVED — `gh api repos/POPAISTUDIO/vermeer-gitops-prod/contents/prod` → `prod/app`, `prod/llm`, 29/07/2026.)*

Ce que les rulesets imposent aux autres équipes — la PR, et sur la prod le check `yaml-valide` — leur est **techniquement** opposable. Ce que ce document prescrit **en plus** — qui relit, qui merge, sous quelles conditions — ne concerne **que le flux Vermeer Chat**. Les promotions des autres équipes relèvent de **leurs** relectures et de **leurs** merges.

**Les workflows ne sont pas décrits ici.** Leur représentation canonique — portes de décision, acteurs, chemins de retour — est l'annexe de l'architecture cible : [`architecture-cible-v2.md` — Annexe, Workflows formalisés](architecture-cible-v2.md#annexe--workflows-formalisés-portes-de-décision-et-acteurs), circuits **A** (désignation), **B** (exécution), **C** (préparation MEP), **D** (post-merge MEP + comm'), **E** (observation). Ce document y **renvoie** et ne les recopie pas : un schéma dupliqué est un schéma qui divergera.

---

## Le principe, en une phrase

Les agents **réagissent** sur événement, **proposent** en PR, et **rien de ce qu'ils produisent n'atteint le réel sans un merge humain**.

Formulé comme un invariant opposable (§4) : **aucune sortie de modèle n'atteint le réel sans merge humain.** La machinerie déterministe — celle qui n'a aucun modèle dans sa boucle — n'est pas visée : elle ne juge pas, elle applique.

**Portée de l'invariant** : les agents de **ce** système, sur le périmètre Vermeer Chat défini ci-dessus. Il ne dit rien du travail des autres équipes des dépôts partagés — leurs promotions ne sortent pas d'un modèle de ce système, et leur relecture leur appartient.

Chaque pouvoir d'agent traverse **sept étages** pour atteindre le réel. Un étage manquant est une faille, pas un raccourci.

| Étage | Question à laquelle il répond |
|---|---|
| §1 Identités et pouvoirs | *Qui agit, avec quel jeton, jusqu'où ?* |
| §2 Réveil et budget | *Qui l'a réveillé, pour combien de temps, et que se passe-t-il s'il déborde ?* |
| §3 Proposition | *Sous quelle forme sort son travail, et qu'a-t-il interdiction de produire ?* |
| §4 L'écluse | *Qui décide que ça entre dans le réel ?* |
| §5 Re-vérification | *Qu'est-ce qui prouve, après coup, que ça n'a rien cassé ?* |
| §6 Observation | *Qui a le droit de regarder, et pourquoi ne peut-il pas agir ?* |
| §7 Boucle de correction | *Que fait-on quand la gouvernance elle-même défaille ?* |

---

## §1 — Identités et pouvoirs

**Règle fondatrice : un agent = une identité = des jetons au périmètre minimal.**

Un agent ne partage jamais l'identité d'un humain. Il ne réutilise jamais un jeton taillé pour un autre usage. Son périmètre est le plus petit qui lui permette de faire son travail — et pas un scope de plus.

### Les règles

1. **Un jeton par usage.** Un jeton dont le périmètre couvre deux agents est un jeton mal taillé : il faut le scinder.
2. **Périmètre minimal, y compris en écriture.** Un agent qui n'a besoin d'écrire que dans des branches n'a pas de droit sur `main`. Un agent qui ne lit que des journaux n'a aucun droit d'écriture, nulle part.
3. **Nommage explicite.** Le nom du secret dit ce qu'il ouvre (`GITOPS_PUSH_TOKEN`, `QA_STORAGE_STATE`). Un nom générique masque un pouvoir.
4. **Aucune valeur de secret ne sort de son coffre.** Ni dans un document, ni dans une issue, ni dans un log, ni sous forme de fragment. La rotation d'un secret exposé — même partiellement, même dans un canal privé — n'est pas négociable.
5. **Le registre est tenu à jour au moment où le pouvoir change**, pas à la revue suivante. Créer un jeton sans l'inscrire au registre est un incident de gouvernance (§7).
6. **Tout support de gouvernance d'un acteur — mandat, prompt, skill — est un fichier persistant, identifié au registre : un pouvoir défini dans un texte volatil est un pouvoir non gouverné.** Incident fondateur : le mandat d'Hermes n'existait dans aucun fichier — il était collé en session — et le seul support persistant autorisait la désignation sans conditions ([issue 135](https://github.com/POPAISTUDIO/vermeer-text/issues/135), 30/07/2026).

### Le registre

L'annexe vivante de cet étage est **[`registre-identites.md`](registre-identites.md)** : un tableau par acteur — identité, secrets utilisés (noms seuls), scopes, stockage, expiration, permis, interdits, étiquette de fiabilité. Il couvre les acteurs vivants **et** les identités futures en placeholder.

Toute création, rotation, extension ou suppression de jeton se répercute dans ce fichier **dans la même PR** que le changement qui l'a rendue nécessaire.

### Amendement acté — le jeton de l'agent MEP

⏳ **entre en vigueur au chantier 7**

L'agent MEP recevra un jeton `contents:write` sur `vermeer-gitops-prod`, **limité aux branches**. Il pourra pousser une branche de digest et ouvrir une PR ; il ne pourra pas atteindre `main`.

**L'ordre de solidité, à graver :** la protection ne vient pas du jeton, elle vient du **ruleset** (§4). Un jeton « limité aux branches » est une intention côté GitHub App ; le ruleset est un refus côté serveur, opposable même à un jeton mal configuré ou élargi par erreur. Les deux se cumulent, mais **dans cet ordre** :

> **Le ruleset existe AVANT le jeton.** Jamais l'inverse. Un jeton d'écriture créé sur un repo dont l'écluse n'est pas encore posée est un pouvoir sans contrepoids — et il n'y a aucune urgence qui justifie cette inversion.

C'est la raison pour laquelle le chantier 2 (ruleset, fait le 29/07/2026) précède le chantier 7 dans la feuille de route, et non l'inverse.

---

## §2 — Réveil et budget

**Règle fondatrice : aucun agent ne se réveille spontanément.**

Chaque agent déclare, dans son propre fichier de workflow : **son déclencheur**, **son budget de tours** (`--max-turns`), **son timeout**, et **son comportement en dépassement**.

### Les règles

1. **Cinq familles de déclencheurs, et cinq seulement** : un **label** posé sur une issue · un **cron** · l'**échec** d'un autre workflow · la **fin d'un autre workflow** (`workflow_run`) · un **`workflow_dispatch`** humain. Rien d'autre. Un agent qui se déclenche sur un événement non déclaré est à désarmer immédiatement (§7, coupe-circuit).
2. **Aucun cron sur un agent qui touche la production.** Invariant, sans exception ni dérogation temporaire.
3. **Tout run est borné deux fois** : par `--max-turns` (le raisonnement) et par `timeout-minutes` (le mur). Les deux sont obligatoires ; l'absence de l'un des deux est un défaut à corriger.
4. **En dépassement : échouer bruyamment.** Jamais continuer en silence, jamais retenter tout seul, jamais dégrader la sortie sans le dire. Un job qui déborde sort en erreur, et l'erreur remonte : job rouge et, pour les workflows qui en tiennent un, une trace écrite dans le dossier concerné.
   > **Ce que « bruyant » veut dire, exactement.** Une notification que l'humaine **reçoit**, sans consulter l'onglet Actions. Le canal de référence est le **commentaire d'issue accompagné d'une assignation**, comme au garde-fou 4 du triage. **Un statut de run rouge, seul, n'est pas bruyant** — c'est une information qu'il faut aller chercher, donc une information que personne ne reçoit. *(Incident du 30/07/2026, run 80 : `claude-interactive` est mort à `max-turns`, le job est bien sorti rouge, et rien n'est arrivé à Loïse — elle a dû ouvrir l'onglet Actions pour le découvrir. La formulation précédente de cette règle assimilait « job rouge » à « notification GitHub native » : c'était faux, et c'est corrigé ici.)*
5. **Aucun retry automatique sur un agent qui écrit.** Une reprise après échec de poussée est une décision humaine : l'état du dépôt distant est inconnu. *(Règle déjà appliquée par le release train — OBSERVED, `.github/workflows/release-train.yml`, étape « Signaler l'échec », 29/07/2026.)*
6. **La sérialisation est un garde-fou, pas une optimisation.** Deux workflows qui consomment la même ressource à usage unique partagent un groupe de concurrence et **ne s'annulent pas** l'un l'autre. *(Cas réel : la session QA staging, rotée à chaque chargement.)*

### Recensement des budgets réels

**OBSERVED — valeurs relevées le 29/07/2026 dans les fichiers de workflow des trois dépôts** (`.github/workflows/` de `vermeer-text` en local ; `vermeer-gitops` et `vermeer-gitops-prod` via `gh api …/contents/.github/workflows/…`). Aucune valeur n'est reprise de mémoire ou d'un document.

#### `POPAISTUDIO/vermeer-text`

| Workflow (fichier) | Déclencheur | Budget | Timeout | Comportement en échec |
|---|---|---|---|---|
| **Claude Code** — mode interactif (`claude.yml`, job `claude-interactive`) | `issue_comment` / `pull_request_review_comment` / `issues` (opened, assigned) contenant `@claude` ; exclut `github-actions[bot]` **et `claude[bot]`** (runs en écho sur ses propres commentaires — OBSERVED 30/07/2026, runs 79 et 81) | `--max-turns 40` | 45 min | **Étape « Échec bruyant »** (`if: failure()`) — **OBSERVED, `claude.yml`, 30/07/2026**. Job rouge **plus** un canal que Loïse reçoit : commentaire sur le fil d'origine (avec le lien du run et le conseil de relancer par cycle de label — 150 tours — plutôt que par `@claude` — 40 tours) **et assignation à `Loisetoscer`**. Sur une PR : commentaire + demande de review, avec repli sur l'assignation si Loïse en est l'autrice (GitHub refuse une review de l'auteur). L'épuisement de `--max-turns` fait bien sortir ce job en erreur — **OBSERVED, run 80 du 30/07/2026** : le motif de l'incident n'était pas un job vert, c'était un rouge que personne ne recevait |
| **Claude Code** — mode autonome (`claude.yml`, job `claude-autofix`) | `issues` action `labeled`, label **exactement** `claude-fix` ; exclut `claude[bot]` | `--max-turns 150` | 90 min | **Séquence draft-first** (prompt + `--append-system-prompt`) **et gate « Verdict livrable »** à trois verdicts — **OBSERVED, `claude.yml`, 30/07/2026**. Détail ci-dessous |
| **QA Nightly — Staging** (`qa-nightly.yml`, job `wave1`) | `schedule` `30 4 * * 1-5` (04h30 UTC = **06h30 Paris** en heure d'été) + `workflow_dispatch` | `--max-turns 25` (étape d'analyse Claude uniquement) | 40 min | Gate final « la Vague 1 est la porte de release » : `exit 1` si Playwright n'est pas `success`. L'analyse tourne en `if: always()` et journalise au Dossier QA **avant** le gate |
| **QA Triage** (`qa-triage.yml`, job `triage`) | `workflow_run` sur `["QA Nightly — Staging"]`, `types: [completed]`, gardé par `conclusion == 'failure'` | `--max-turns 70` | 25 min | Job rouge. Si les artefacts sont absents ou `report.json` illisible : **ne devine pas** — commentaire au Dossier QA puis arrêt |
| **QA Triage — rejeu sur fixtures** (`qa-triage-replay.yml`, jobs `fixtures` + `rejeu`) | `workflow_dispatch` seul | `--max-turns 70` | 5 min (recensement) · 25 min (rejeu, un job par fixture) | **Test de garde du triage**, pas un acteur : rejoue le prompt **vivant** du triage sur fixtures archivées, en **dry-run** vis-à-vis de GitHub (shim `gh`, `permissions: contents: read` seul). Verdict = code de sortie du vérificateur ; `fail-fast: false` pour que chaque fixture rende son verdict. **⚠️ OBSERVED 30/07/2026 — ce harnais n'a jamais pu être vert.** Son premier et unique run ([30580016629](https://github.com/POPAISTUDIO/vermeer-text/actions/runs/30580016629)) échoue sur les 3 fixtures : `permissions: contents: read` **seul** empêche `anthropics/claude-code-action@v1` d'obtenir son jeton OIDC (« Could not fetch an OIDC token… `id-token: write` »), donc le modèle ne tourne pas, donc le journal est vide, donc tous les `requis` manquent. Le durcissement dry-run a coupé l'authentification de l'agent qu'il devait éprouver. Faux **rouge** (direction sûre), mais un test qui ne peut pas passer ne garde rien. **Correctif : ajouter `id-token: write` aux permissions du job de rejeu** — hors périmètre de la PR qui a fait ce constat (`claude.yml` seul autorisé) |
| **Canary Providers** (`canary-providers.yml`, job `canary`) | `schedule` `0 5 * * 1-5` (05h00 UTC = **07h00 Paris** en heure d'été) + `workflow_dispatch` | *aucun agent Claude — assertions déterministes seules* | 20 min | Issue `canary` + `infra` ouverte si rouge, puis gate « un canary rouge doit être rouge » : `exit 1` |
| **Release Train — dev + staging** (`release-train.yml`, job `propagate`) | `workflow_run` sur `["Build & Push Vermeer Custom Image to ECR"]`, gardé par `conclusion == 'success'` **et** `event == 'push'` **et** `head_branch == 'main'` | *aucun agent Claude — shell déterministe* | 25 min | **Aucun retry.** Étape `if: failure() \|\| cancelled()` → issue `release-train` (créée ou commentée), avec l'étape en échec, le tag visé et l'URL de la PR gitops éventuellement restée ouverte |
| **Build & Push … to ECR** (`vermeer-prod-image.yml`) | `push` sur `branches: ["**"]` et `tags: ["*"]` | *machinerie de build* | *non déclaré au niveau du job* | Job rouge ; le train ne part pas (son `if` exige `conclusion == 'success'`) |

##### `claude-autofix` — la séquence draft-first et les trois verdicts

**OBSERVED — `claude.yml`, 30/07/2026.** Ce job porte deux dispositifs distincts, écrits le même
jour après trois runs consécutifs sans PR sur l'issue 141.

**Le principe : le travail d'un agent ne doit jamais être invisible, perdu ou non reprenable.**
Incident fondateur, le run 83 du 30/07/2026 : **67 tours, 9m38 de modèle, 3,90 $, conclusion
Success, et aucune trace** — ni branche poussée, ni PR, ni même un commentaire. Le run 77 du même
jour avait au moins laissé une analyse ; le 83 n'a rien laissé. Un budget consommé sans trace
n'est pas un échec technique, c'est un défaut de conception : rien n'obligeait l'agent à rendre
son travail visible avant de l'avoir fini.

**Séquence imposée** (prompt **et** `--append-system-prompt`, les deux, pour qu'aucun des deux
chemins ne l'affaiblisse) : (1) branche `fix/issue-N` ; (2) premier commit minimal ; (3) **PR en
DRAFT ouverte immédiatement**, référençant l'issue, **avant toute implémentation
substantielle** ; (4) implémentation par commits réguliers poussés — jamais plus de quelques
minutes de travail non poussé ; (5) description complétée puis **PR passée ready for review**.
Une PR laissée en draft est un état **légitime** : elle dit « travail inachevé », et se reprend
par un `@claude continue` sur la PR — le contexte du diff y est déjà.

**Budget dimensionné pour des features, pas pour des retouches** : `--max-turns 150` / 90 min.
Le run 83 avait consommé 67 tours sur un bouton de thème sous un plafond de 80 — donc au bord,
et la séquence draft-first coûte des tours de `git` et de `gh` en plus de l'implémentation.
`claude-interactive` reste à 40 tours : reprises et petits gestes.

**Gate « Verdict livrable »** (`if: always()`) — **trois** verdicts, plus deux :

| Ce que le gate trouve | Verdict | Canal |
|---|---|---|
| **PR ready** référençant l'issue | **vert** | Review demandée à `Loisetoscer` — seul canal qui notifie à coup sûr l'ouverture d'une PR, et il dit la vérité du système : **toute PR d'agent attend la relecture de l'écluse** ([§4](#4--lécluse)) |
| **PR draft** | **rouge** | Le contrat n'est pas rempli, mais le travail est visible : commentaire sur l'issue « ⚠️ Travail partiel visible en PR #N (draft). Reprise : commenter @claude continue sur la PR. » + assignation à `Loisetoscer`. **Le rouge dit désormais OÙ est le travail** au lieu de constater une disparition. Aucune review demandée sur un brouillon |
| Ni PR, ni marqueur | **rouge** | Commentaire de relance sur l'issue + assignation à `Loisetoscer` |
| Dernier commentaire de `claude[bot]` portant `<!-- verdict: analyse-seule -->` | **vert** | Arrêt réfléchi, aucune écriture |
| Une lecture d'API en échec | **rouge sans commentaire** | Verdict déclaré **indéterminable** — plutôt qu'une accusation fausse |

La PR est reconnue par sa **branche** `fix/issue-N` (suffixe toléré) ou, à défaut, par un corps
qui référence l'issue. **La branche prime** : les deux signaux ne valent pas pareil, un corps
pouvant mentionner « #N » en prose sans être la PR de l'issue. Défaut trouvé par le rejeu du
verdict, pas par une relecture — voir ci-dessous.

**Test de garde** : `.github/scripts/verdict-replay/rejouer.sh`, 4 fixtures sous
`e2e/staging/fixtures/verdict/`. Le gate est du **shell**, donc directement exécutable, donc
directement testable — contrairement à un prompt, qui ne se teste qu'en rejouant un modèle. Le
shell testé est **extrait** de `claude.yml`, jamais recopié. Dès son premier passage, ce rejeu a
trouvé le défaut d'ordonnancement branche/corps décrit ci-dessus : la fixture `pr-ready` place un
leurre (branche `fix/issue-1410`, corps mentionnant `#141`) que l'ancien `select(A or B) | first`
sélectionnait avant la vraie PR. **Reste à câbler en CI** — la création d'un workflow de rejeu
sortait du périmètre autorisé de la PR qui a introduit ce harnais.

#### `POPAISTUDIO/vermeer-gitops`

| Workflow (fichier) | Déclencheur | Budget | Timeout | Comportement en échec |
|---|---|---|---|---|
| **Claude Code** — interactif (`claude.yml`, job `claude-interactive`) | `@claude` sur issue / PR / commentaire de revue | `--max-turns 40` | **30 min** | Job rouge → notification native |
| **Claude Code** — autonome (`claude.yml`, job `claude-autofix`) | `issues` action `labeled`, label `claude-fix` | `--max-turns 40` | **30 min** | Idem. Consigne : demande ambiguë ou irrecevable → **pas de PR**, commentaire d'analyse sur l'issue |
| **Deploy to staging** (`deploy-staging.yml`, job `hotswap`) | `repository_dispatch` type `deploy-staging` | *shell (`scripts/hotswap.sh`)* | 10 min | Job rouge. **Acteur hors périmètre Vermeer-LLM** — voir la mise en garde ci-dessous |

> **Mise en garde — `deploy-staging.yml` n'appartient pas à ce système.** OBSERVED (29/07/2026) : ce workflow porte `permissions: contents: write` et pousse directement via `scripts/hotswap.sh`, sous l'identité `gitops-bot`. Il sert d'autres produits hébergés dans le même dépôt (`*/app/`, `abstraction-layer`). Il est inscrit au registre pour mémoire, parce qu'il écrit dans le dépôt où travaille l'agent config — mais il ne relève pas de cette gouvernance et n'est pas couvert par ses garde-fous. Toute intervention sur son périmètre est une décision d'équipe, pas une décision de gouvernance agentique.

#### `POPAISTUDIO/vermeer-gitops-prod`

| Workflow (fichier) | Déclencheur | Budget | Timeout | Comportement en échec |
|---|---|---|---|---|
| **Checks digest** (`checks-digest.yml`, job `yaml-valide`) | `pull_request` vers `main` | *shell + `pyyaml`* | *non déclaré* | Sortie non nulle → le check `yaml-valide` est rouge → **le ruleset bloque physiquement le bouton merge** (§4) |

**OBSERVED — c'est le seul workflow du dépôt de production** (`gh api repos/POPAISTUDIO/vermeer-gitops-prod/contents/.github/workflows`, 29/07/2026). Aucun agent n'y tourne. Ce n'est pas un manque : c'est la règle §6, appliquée.

### Le second désignateur — la désignation automatique du triage

Une issue sans label dort. Poser un label, c'est **désigner du travail** — c'est mettre un agent en marche. Ce pouvoir est le plus sensible du système, parce qu'il est le point d'entrée de tout le reste.

> **Deux désignateurs, et deux seulement : l'humain (via Hermes) et le triage QA (régressions prouvées uniquement).**

Aucun autre acteur ne pose de label déclencheur. Toute extension de cette liste est un amendement explicite de ce document, discuté avant d'être câblé — jamais une conséquence de bord d'un chantier.

**Les six garde-fous du triage désignateur** *(repris intégralement de [`architecture-cible-v2.md` §2.1](architecture-cible-v2.md#21-boucle-continue--dev--staging))* :

1. **Label posé uniquement sur verdict « bug » avec preuves** — jamais sur un doute, jamais sur les verdicts « test » ou « infra ».
2. **Déduplication par signature d'échec** — une signature d'échec = une issue. Un cas qui rechute **commente l'issue existante**, il n'en ouvre pas une nouvelle chaque nuit.
3. **Exclusion des cas tagués `@known-issue-N`** — un défaut connu et dépriorisé ne déclenche rien. Le tag est le veto persistant de l'humain.
4. **Plafond de 2 tentatives** — si deux PRs successives ne reverdissent pas le cas, le triage **retire le label**, documente l'échec dans le Dossier QA et notifie l'humain. L'issue redevient sienne.
5. **Veto par exception** — retirer un label rendort l'issue à tout moment. La priorité reste humaine ; elle s'exerce par exception, plus par défaut.
6. **Budget nightly inchangé** — maximum **3 dossiers instruits par run** de triage.

**État de câblage — OBSERVED, `.github/workflows/qa-triage.yml`, 29/07/2026 :**

| Garde-fou | État réel |
|---|---|
| 1 — bug prouvé seulement | **Câblé.** Classement en quatre catégories (BUG PRODUIT / FLAKY-INFRA / SESSION EXPIRÉE / INDÉTERMINÉ) ; seul BUG PRODUIT crée une issue labellisée. `SESSION EXPIRÉE` est explicitement exclu (« AUCUNE issue `claude-fix`. C'est une opération d'exploitation, pas un bug ») |
| 2 — déduplication par signature | **Câblé** *(OBSERVED — `qa-triage.yml`, étape 2 « BUG PRODUIT », points (a) et (b), 29/07/2026)*. La **signature d'échec** est `identifiant de cas \| chemin du fichier de spec \| assertion normalisée` — première ligne d'erreur d'assertion débarrassée des horodatages, durées, UUID, URL de run, numéros de ligne et valeurs mesurées. Elle est inscrite dans le corps de l'issue en commentaire HTML machine-lisible : `<!-- signature: … -->`. Déduplication **en deux passes** : filtre grossier par identifiant de cas dans les titres (`gh issue list --label claude-fix --state all --limit 50`, mécanisme conservé), puis confrontation de la signature (`gh issue view <N> --json body,state,labels,comments`). Signature identique → commentaire sur l'existante, rien de créé. Signature différente sur le même cas → nouvelle issue, c'est un **échec différent**. Candidate sans ligne de signature (issue ouverte à la main) → comparaison sur le symptôme, dite comme telle |
| 3 — exclusion `@known-issue-N` | **Câblé, aux deux bouts** *(OBSERVED — `qa-nightly.yml` étape « Recette Vague 1 » + `qa-triage.yml` étape 0, 29/07/2026)*. Côté suite : le filtre de la nightly est `--grep @wave1 --grep-invert @known-issue`, donc un cas tagué **ne tourne pas et ne compte pas dans le verdict P0** — sans quitter son tag `@wave1`, qu'il retrouve dès que le tag `@known-issue-N` est retiré (diff d'un mot). Côté triage : l'**étape 0** écarte tout échec dont le cas porte un tag `@known-issue-N` — **ni issue, ni label**, pas même un commentaire sur l'issue N, seulement une ligne au Dossier QA avec renvoi à N. Le SKIP motivé `CTX-02` reste par ailleurs nommément exclu, inchangé. Convention et emploi : `e2e/staging/README.md` §5 |
| 4 — plafond de 2 tentatives | **Câblé** *(OBSERVED — `qa-triage.yml`, point (d), 29/07/2026)*. Comptage par **marqueurs machine-lisibles** `<!-- tentative: X -->` écrits par le triage dans un commentaire daté de l'issue, **avant** chaque désignation, et relus par `gh issue view <N> --json comments` — **jamais** par recherche de PRs liées. Une signature qui rechute sur une issue labellisée à la tentative 1 déclenche le **cycle du label** (ci-dessous). Une rechute alors que `tentative: 2` existe déjà est le **plafond** : retrait définitif du label, commentaire de synthèse (les deux tentatives, les PRs référencées dans l'issue — ou l'aveu qu'aucune n'y figure), ligne au Dossier QA, et **assignation de l'issue à `Loisetoscer`** — seule notification humaine du mécanisme, aucun autre canal, zéro secret |
| 5 — veto par exception | **Vivant par construction** — retirer le label empêche tout nouveau déclenchement (le job `claude-autofix` ne se déclenche que sur l'action `labeled`). **Premier exercice réel le 29/07/2026** : retrait du label sur l'issue 114 (§7) |
| 6 — plafond 3 dossiers / run | **Câblé.** « PLAFOND : 3 issues maximum pour ce run » ; au-delà, les 3 plus graves puis une liste au Dossier QA |

**Les six garde-fous sont désormais câblés** *(chantier 4, 29/07/2026)*. Ce qui reste à surveiller n'est plus un contrepoids manquant mais la **tenue** de trois interdits qui vivent dans un prompt : d'où leur test de garde, `qa-triage-replay.yml` (§3), et le point 2 de la revue mensuelle (§7).

### Le cycle du label — amendement acté

Reposer un label est une **désignation**, pas un détail technique. C'est un geste nouveau du triage, assumé comme tel :

> Quand une signature rechute sur une issue **encore labellisée** à la tentative 1, l'événement `labeled` ne se re-déclenche pas tout seul — l'agent codeur ne se réveille que sur l'**événement de pose**, et réajouter un label déjà présent n'en produit aucun. Le triage écrit alors le marqueur `<!-- tentative: 2 -->`, **retire** le label puis le **repose** (`gh issue edit <N> --remove-label claude-fix` puis `--add-label claude-fix`). C'est la deuxième et **dernière** désignation sur cette signature.

Trois bornes, non négociables, parce que ce geste est un pouvoir de réveil :

1. **Le compteur d'abord.** Le marqueur s'écrit **avant** le cycle. Un cycle sans marqueur préalable est une désignation hors comptage — donc un plafond inopérant. Même ordre à la création : issue créée sans label → marqueur `tentative: 1` → pose du label. Si le job meurt entre les deux, il reste une issue instruite et **endormie** ; jamais un agent lancé hors compteur.
2. **Le cycle ne franchit jamais le veto.** Un label **absent** d'une issue ouverte signifie qu'un humain l'a retiré (§7, issue 114) ou que le plafond a été atteint : le triage **ne repose jamais** un label retiré. Il commente, il écrit une ligne au Dossier QA, il s'arrête. Le garde-fou 5 est en amont du garde-fou 4, pas à côté.
3. **Le plafond est un mur, pas un ralentisseur.** Au-delà de deux tentatives, le label est retiré définitivement et l'issue est **assignée à l'humaine**. Elle redevient sienne : le triage n'y touche plus.

Cette extension ne change pas la liste des désignateurs : ils restent **deux**. Elle borne le second.

La voie humaine (Loïse via Hermes) est vivante et sans réserve. **Greffier câblé le 30/07/2026 — OBSERVED** : sur ordre explicite d'elle seule, Hermes rédige un brouillon (repo, titre, corps, label), le lui soumet, et ne crée l'issue labellisée qu'après validation explicite ; le label part avec la création, porté par cette validation. Le réflexe de cadrage est obligatoire pour une fonctionnalité (comportement attendu, emplacement UI, critère d'acceptation). Rien de tout cela ne s'enclenche depuis une observation : cette voie-là ouvre une issue **sans label** (§6). Permis, contrepoids et support du mandat : [registre](registre-identites.md#8-hermes--capteur-interactif-mac-de-latelier).

---

## §3 — Proposition

**Règle fondatrice : un agent propose, il ne dispose pas. La proposition prend la forme d'une PR, et rien d'autre.**

### Les règles

1. **PR uniquement.** Jamais de poussée directe sur `main`, jamais de merge de sa propre PR, jamais de commit sur une branche qu'un humain n'a pas demandée. Un agent qui ne sait pas quoi proposer ne propose rien : il commente et s'arrête.
2. **Une PR argumentée, ou pas de PR.** La description dit : ce qui était demandé · ce qui change (fichier, clé, avant/après) · l'effet concret attendu et sur quel environnement · comment vérifier. Une PR sans argumentaire est irrecevable en revue — elle ne se merge pas, elle se renvoie.
3. **Doute = arrêt, pas approximation.** Cause racine non identifiée, périmètre ambigu, effet incertain : commenter l'issue avec l'analyse et le point de blocage. Une PR à côté coûte un tour de boucle complet ; un commentaire honnête n'en coûte aucun.
4. **Diff minimal.** Aucun changement opportuniste, aucun nettoyage collatéral, aucun renommage, aucune restructuration. Un diff qui dépasse la demande est un diff qu'on ne peut plus relire ligne à ligne — et la relecture est l'unique contrôle humain (§4).
5. **Les interdits sont codés, pas seulement écrits.** Un interdit qui ne vit que dans un prompt est une intention. Il doit être doublé d'une vérification mécanique dès qu'un tel doublage est possible (§3, tests de garde).

### Les interdits, par acteur

#### Agent config (`vermeer-gitops`)

*OBSERVED — les huit règles sont inscrites dans le prompt des deux jobs de `claude.yml` (`vermeer-gitops`), 29/07/2026, et déclarées prioritaires sur toute demande formulée dans une issue ou un commentaire.*

- **Jamais une ligne de tag d'image.** La clé `image.tag` de `dev/llm/helm-release.yaml` et `staging/llm/helm-release.yaml` appartient au release train. Demande de bump reçue → **pas de PR**, un commentaire qui renvoie au train, arrêt.
- **Jamais l'annotation `restartedAt`** (`kubectl.kubernetes.io/restartedAt`), qui accompagne le tag et relève du même propriétaire.
- **Jamais hors de `dev/llm/` et `staging/llm/`.** Le dépôt héberge d'autres produits (`dev/app/`, `staging/app/`, `alpha/app/`, `abstraction-layer`, `scripts/`). `alpha/` est hors périmètre.
- **Jamais la production.** Elle vit dans un autre dépôt, inaccessible depuis celui-là. Un chemin, un fichier ou une demande qui fait intervenir la prod → refus, commentaire, pas de PR.
- **Jamais de merge, jamais de poussée sur `main`** — y compris dans un dépôt sans protection de branche, où la poussée directe est historiquement l'usage.
- **Édition YAML chirurgicale.** Pas de restructuration, pas de réordonnancement de clés, pas de reformatage, aucune suppression de commentaire existant — en particulier les `# Vermeer:`, qui documentent des choix délibérés. Un `librechat.yaml` invalide fait sortir le process en code 1 : l'application est **down**, sans mode dégradé.

#### Release train (`vermeer-text` → `vermeer-gitops`)

*OBSERVED — deux familles de gardes dans `release-train.yml` : cinq gardes de diff dans l'étape « Verifier que le diff est strictement limite aux lignes de tag », deux gardes d'amont. Relevé le 29/07/2026.*

- **La ligne de version, et rien d'autre.** Tout autre diff = abandon du job, pas de tentative de correction. **Les cinq gardes, vérifiées une par une dans le fichier — OBSERVED, `release-train.yml`, 29/07/2026** : elles vivent toutes dans le step nommé **« Verifier que le diff est strictement limite aux lignes de tag »** (l. 200), que le fichier annote lui-même `# --- Garde-fou 2 : le diff ne contient QUE les deux lignes de tag` (l. 199), et sont numérotées à la source :
  - **`2a`** (l. 211, `# 2a. Aucun fichier hors de la liste blanche`) — aucun fichier hors liste blanche (`dev/llm/helm-release.yaml`, `staging/llm/helm-release.yaml`) ; tolère qu'un seul des deux bouge, jamais un troisième ;
  - **`2b`** (l. 226, `# 2b. Aucun chemin touche ne releve de la prod`) — aucun chemin contenant `prod`, en ceinture et bretelles : le dépôt n'en a pas, mais s'il en avait un le job s'arrêterait net plutôt que d'y toucher ;
  - **`2c`** (l. 234, `# 2c. Chaque ligne ajoutee/supprimee est une ligne de tag`) — un commentaire, une variable d'environnement, une annotation font échouer le job ;
  - **`2d`** (l. 246, `# 2d. Volumetrie : 1 suppression + 1 ajout par fichier touche`) — volumétrie exacte, en-têtes de diff déduits ;
  - **`2e`** (l. 255, `# 2e. Etat final : les DEUX fichiers portent le tag vise`) — état final vérifié, qu'un fichier ait été modifié à l'instant ou qu'il y soit déjà.
- **Deux gardes d'amont**, distinctes des cinq précédentes par leur rôle : elles ne vérifient pas le diff produit, elles **empêchent de produire le mauvais diff** — OBSERVED : le fichier nomme **`Garde-fou 1`** (l. 151), qui **refuse catégoriquement de cloner le dépôt gitops de prod** (`case "$GITOPS_REPO" in *vermeer-gitops-prod*) → exit 1`), et le step « Bumper le tag dev et staging » vérifie **avant d'écrire** que chaque fichier contient **exactement une** ligne `tag: "…"` — zéro, deux ou plus → abandon (l. 175 : « mieux vaut un train cassé qu'un `sed` qui touche la mauvaise ligne »).

Soit **deux familles** : **cinq gardes de diff** (`2a`–`2e`, un seul step, l. 200) qui valident ce qui a été produit, et **deux gardes d'amont** (l. 151, l. 175) qui bornent ce qui peut l'être. C'est cet ensemble qui rend le chemin déterministe — et donc conforme à l'invariant du §4.
- **Jamais les tags Git de version.** Le `if` du job exige `head_branch == 'main'` : les releases taguées `v0.10.x` sont nativement exclues et suivent la procédure de déploiement documentée en [`CLAUDE.md` §12](../CLAUDE.md).

> **Le train auto-merge sa PR, et c'est conforme — pas une exception.** OBSERVED (`release-train.yml`, étape « Ouvrir et merger la PR gitops », 29/07/2026) : le train ouvre puis merge sa propre PR sur `vermeer-gitops` (`gh pr merge --squash --delete-branch`). Au regard de l'invariant du §4 — *aucune sortie de modèle n'atteint le réel sans merge humain* — cette PR est **conforme** : il n'y a **aucun modèle dans sa boucle** (aucune étape `claude-code-action` dans ce workflow), le diff est **mécanique** (un `sed` sur une seule ligne), il est **borné à la ligne de version**, **vérifié par les cinq gardes ci-dessus avant la poussée**, et **limité à dev et staging**.
>
> Ce qui est automatisé ici, c'est un geste déterministe, pas un jugement. Le corollaire est strict et ne se négocie pas : **toute PR contenant du texte produit par un modèle se merge par un humain**, et rien de ce chemin ne franchit jamais la frontière de la production. Retirer un seul des cinq gardes, élargir le diff au-delà de la ligne de version, ou introduire une étape de modèle dans ce workflow le ferait basculer hors conformité — et exigerait alors un merge humain.

#### Agent codeur (`vermeer-text`)

- **Jamais de merge de PR.** Toute modification passe par une branche + une PR avec description structurée. *(OBSERVED — `--append-system-prompt` du job `claude-interactive`, `claude.yml`, 29/07/2026.)*
- **Jamais de fix symptomatique** : cause racine, ou pas de PR.
- **Aucune régression nouvelle** : `typecheck` et tests unitaires concernés passés, comparés aux baselines documentées dans `CLAUDE.md`.
- **Jamais les fichiers gitops** — ils vivent dans d'autres dépôts, hors de son atteinte.

#### Triage QA (`vermeer-text`)

- **Ne corrige rien, ne modifie aucun fichier du dépôt, ne ferme aucune issue.** *(OBSERVED — prompt + `--allowedTools "Read,Glob,Grep,Bash(gh issue *)"`, `qa-triage.yml`, 29/07/2026.)*
- **Ne devine pas.** Artefacts absents ou `report.json` illisible → commentaire au Dossier QA, arrêt. Pas de conclusion produite sur un run sans rapport exploitable.
- **Ne labellise que sur preuve** (§2, six garde-fous).

#### QA nightly (`vermeer-text`)

- **Lecture seule sur le code**, mêmes `--allowedTools` que le triage. Elle tient un dossier, elle ne corrige rien.
- **Jamais un PASS déduit d'une absence d'information.** Un cas n'est vert que si le rapport JSON le dit. Un test *skipped* n'est pas un test qui passe.
- **Jamais une session expirée présentée comme un défaut produit.**
- **Ne crée ni ne ferme aucune autre issue que le Dossier QA** — le triage des bugs est le travail d'un autre workflow.

#### Agent comm' (futur)

⏳ **entre en vigueur au chantier 8**

- **Écriture limitée à `docs/comm/`.** Aucun autre chemin, dans aucun dépôt.
- **Jamais d'envoi direct aux utilisateurs.** La note arrive à l'humain via le Dossier Releases (notification GitHub native) ; c'est l'humain qui annonce. Un envoi SMTP formaté pourra s'ajouter plus tard — il restera adressé à l'humain, jamais aux utilisateurs.
- **Le delta est calculé, jamais rédigé de mémoire** : `git log --oneline` entre tags + diff du digest gitops-prod. La comm' colle au déployé, pas au prévu.
- **PR obligatoire** : ici, le merge est un contrôle **éditorial** — ce contenu finit devant les utilisateurs.

#### Agent MEP (futur)

⏳ **entre en vigueur au chantier 7**

- **Jamais de cron.** `workflow_dispatch` uniquement. Invariant.
- **Préconditions ou STOP motivé** : dernière QA train verte + canary du matin vert + aucun incident ouvert. Un seul manque → rien n'est créé.
- **S'arrête à la PR de digest.** Il ne merge pas, il ne réconcilie pas, il ne touche pas `main` (§1, §4).

### Tests de garde — un par interdit

Un interdit non testé s'érode : le prompt évolue, le modèle change, le fichier bouge. **Tout interdit doit être vérifié périodiquement.** Couverture — une ligne par interdit ; **les trois premiers tests sont implémentés depuis le chantier 4** (colonne « État »), les autres restent à câbler par le chantier qui câble leur interdit.

| Interdit | Test de garde | État |
|---|---|---|
| Triage — pas de label sur doute | Rejeu du triage sur un run archivé à session expirée → aucune issue `claude-fix` créée, aucun label posé | **Écrit, jamais vert** — `qa-triage-replay.yml`, fixture `session-expiree`. Voir la mise en garde ci-dessous *(OBSERVED, 30/07/2026)* |
| Triage — exclusion `@known-issue-N` (garde-fou 3) | Rejeu sur un run où un cas tagué `@known-issue-N` est rouge → ni issue, ni label, ni commentaire sur l'issue N ; une ligne au Dossier QA | **Écrit, jamais vert** — `qa-triage-replay.yml`, fixture `known-issue-rouge` *(OBSERVED, 30/07/2026)* |
| Triage — plafond de 2 tentatives (garde-fou 4) | Rejeu sur une rechute de signature contre une issue portant déjà `<!-- tentative: 2 -->` → retrait du label, **pas de re-pose**, synthèse et assignation à l'humaine | **Écrit, jamais vert** — `qa-triage-replay.yml`, fixture `tentative-2-rechute` *(OBSERVED, 30/07/2026)* |
| Agent codeur — un run ne peut pas finir sans livrable visible | Rejeu du gate « Verdict livrable » **extrait de `claude.yml`** sur 4 situations figées : PR ready → vert + review ; PR draft → rouge qui dit où est le travail ; marqueur d'analyse → vert sans écriture ; rien → rouge + relance. Verdict = code de sortie **et** journal des `gh` | **Implémenté et vert (4/4)** — `.github/scripts/verdict-replay/rejouer.sh`, fixtures sous `e2e/staging/fixtures/verdict/`. Tourne en local, sans jeton ni modèle. **Reste à câbler en CI** *(OBSERVED, 30/07/2026)* |
| Agent config — ligne de tag d'image / `restartedAt` | Check de PR sur `vermeer-gitops` : échec si le diff touche une ligne `tag:` ou l'annotation `restartedAt` sous `*/llm/` | *à câbler* |
| Agent config — périmètre `dev/llm/` + `staging/llm/` | Check de PR : `git diff --name-only` entièrement inclus dans la liste blanche, sinon échec | *à câbler* |
| Agent config — prod hors de portée | Check de PR : échec si un chemin du diff matche `prod` (insensible à la casse) | *à câbler* |
| Agent config / agent codeur — jamais de merge | Audit mensuel : `gh pr list --state merged --json mergedBy` sur les deux dépôts → aucun merge par un acteur non humain (hors PRs `bump/sha-*` du train) | *audit de revue (§7, point 3)* |
| Release train — ligne de version uniquement | Rejeu du workflow sur une copie gitops volontairement polluée (commentaire ajouté, second `tag:`, chemin hors liste) → le job **doit** sortir en échec sur chacun des cinq gardes | *à câbler* |
| Release train — jamais la prod | Test de la garde (b) : chemin contenant `prod` injecté dans le diff → abandon attendu | *à câbler* |
| QA nightly / triage — lecture seule | Audit mensuel des `--allowedTools` des deux workflows : toute extension au-delà de `Read,Glob,Grep,Bash(gh issue *)` est un écart à justifier | *audit de revue (§7, point 2)* |
| Agent MEP — `main` inatteignable ⏳7 | À la création **et à chaque rotation** du jeton : tentative de poussée directe sur `main` de `vermeer-gitops-prod` → doit être refusée par le ruleset | *à câbler ⏳7* |
| Agent MEP — jamais de cron ⏳7 | Audit mensuel : `grep -L schedule` sur le workflow MEP → aucune clé `schedule` présente | *à câbler ⏳7* |
| Agent comm' — écriture limitée à `docs/comm/` ⏳8 | Check de PR : `git diff --name-only` entièrement sous `docs/comm/`, sinon échec | *à câbler ⏳8* |

**Comment tournent les trois tests implémentés.** Un seul workflow, `qa-triage-replay.yml`, en `workflow_dispatch` (`gh workflow run "QA Triage — rejeu sur fixtures"`, éventuellement `-f cas=<fixture>`). Il rejoue le prompt **extrait de `qa-triage.yml`** — jamais une copie, qui divergerait et ne testerait plus le désignateur réel — sur les rapports Playwright archivés de `e2e/staging/fixtures/triage/`. Le rejeu est en **dry-run vis-à-vis de GitHub** : un shim `gh` journalise et simule toute commande `gh issue` d'écriture, sert des réponses figées aux lectures, et le job ne porte que `contents: read`. C'est un test du **raisonnement** du triage, pas un test qui pollue le tracker. Le verdict est un **code de sortie** : le journal des commandes est confronté aux `interdits` / `requis` de la fixture. À lancer **à la revue mensuelle** (§7, point 2) et **après toute modification du prompt de triage**. Limite assumée, écrite dans `e2e/staging/fixtures/triage/README.md` : un rejeu vert prouve que le triage a raisonné juste **sur ces trois situations**, pas sur toutes — et le modèle n'étant pas déterministe, un rejeu rouge **deux fois de suite** sur la même fixture est un incident de gouvernance (§7), pas un aléa.

**⚠️ OBSERVED 30/07/2026 — ces trois tests n'ont jamais pu être verts.** Premier et unique run du
harnais, [30580016629](https://github.com/POPAISTUDIO/vermeer-text/actions/runs/30580016629),
déclenché le 30/07 : **échec sur les 3 fixtures**, pour une raison qui n'a rien à voir avec le
raisonnement du triage. `permissions: contents: read` **seul** empêche
`anthropics/claude-code-action@v1` d'obtenir son jeton OIDC (« Could not fetch an OIDC token. Did
you remember to add `id-token: write`… »), donc le modèle ne tourne pas, donc le journal reste
vide, donc tous les `requis` manquent — tandis que tous les `interdits` passent trivialement. Le
durcissement dry-run a coupé l'authentification de l'agent qu'il devait éprouver. La direction de
l'erreur est sûre (faux **rouge**, jamais faux vert), mais **un test qui ne peut pas passer ne
garde rien** : les trois lignes ci-dessus doivent se lire « écrit », pas « couvert ».
**Correctif : ajouter `id-token: write` aux `permissions` du job de rejeu** — un jeton OIDC ne
donne aucun droit d'écriture sur le dépôt, la propriété dry-run est préservée. Hors périmètre de
la PR qui a fait ce constat (`claude.yml` seul autorisé côté workflows).

**Le rejeu du verdict de livrable, lui, ne dépend d'aucun modèle** — le gate est du shell. Il
tourne en local, sans jeton, et son verdict est déterministe :
`.github/scripts/verdict-replay/rejouer.sh`. Détail et limites :
`e2e/staging/fixtures/verdict/README.md`.

---

## §4 — L'écluse

**Règle fondatrice : aucune sortie de modèle n'atteint le réel sans merge humain.**

*Portée : les agents de ce système, sur le périmètre Vermeer Chat (voir « Ce qu'il régit, et ce qu'il ne régit pas », en tête). Sur les dépôts partagés, les contributions des autres équipes sont soumises aux rulesets, pas à l'écluse humaine décrite ici.*

C'est la formulation exacte de l'invariant, et elle vaut mieux que « aucun merge automatique, jamais » — qu'elle remplace dans tout ce document. Ce qui est dangereux n'est pas l'automatisation d'un merge : c'est l'automatisation d'un **jugement**. Un `sed` sur une ligne de version, vérifié par des gardes mécaniques, ne juge rien ; un diff produit par un modèle juge à chaque ligne. La règle porte donc sur la nature de ce qui franchit l'écluse, pas sur le geste qui l'ouvre.

**Conséquence directe** : le release train est un cas **conforme**, et non une exception (§3). Machinerie déterministe, aucun modèle dans la boucle, diff mécanique borné à la ligne de version, gardes vérifiés avant la poussée. À l'inverse, **toute PR contenant du texte produit par un modèle** — code, configuration, documentation, comm' — **se merge par un humain, sans exception d'aucune sorte**.

L'écluse est le point où une proposition devient réalité. C'est un geste **humain**, et c'est le seul.

### Trois régimes d'écluse, un par dépôt

Les trois dépôts ne sont pas protégés de la même façon, et ce n'est pas une négligence : chacun a un usage et des co-usagers différents. La règle est identique partout — **le merge est humain** ; ce qui varie, c'est **ce qui l'impose techniquement**.

| Dépôt | Régime | Ruleset | Check requis | Ce qui tient la règle |
|---|---|---|---|---|
| `vermeer-gitops-prod` | **Écluse complète** | « Écluse main — prod » (`9169830`) | **`yaml-valide`** | Le serveur : PR obligatoire **et** YAML validé avant que le bouton s'ouvre |
| `vermeer-text` | **Écluse jumelle, sans check** | « Écluse main » (`19987595`) | *aucun* — dette CI (issue 86) | Le serveur pour la PR ; la relecture humaine pour le contenu |
| `vermeer-gitops` | **Écluse conventionnelle** — dépôt **partagé** | *aucun* | *aucun* | Les interdits codés des agents + le merge humain. **Aucune barrière technique côté dépôt** |

### Régime 1 — `vermeer-gitops-prod` : écluse complète

**OBSERVED — source : `gh api repos/POPAISTUDIO/vermeer-gitops-prod/rulesets/9169830`, relevé le 29/07/2026.**

| Champ | Valeur observée |
|---|---|
| Nom / id | **« Écluse main — prod »** / `9169830` |
| Dépôt | `POPAISTUDIO/vermeer-gitops-prod` |
| Enforcement | `active` |
| Cible | `~DEFAULT_BRANCH`, aucune exclusion — **`main` seule ; les branches restent libres** |
| Règle `deletion` | Suppression de `main` **bloquée** |
| Règle `non_fast_forward` | Réécriture d'historique **bloquée** |
| Règle `pull_request` | PR **obligatoire** · `required_approving_review_count: 0` · `dismiss_stale_reviews_on_push: false` · `require_code_owner_review: false` · `require_last_push_approval: false` · `allowed_merge_methods: [merge, squash, rebase]` |
| Règle `required_status_checks` | `strict_required_status_checks_policy: true` · un contexte unique : **`yaml-valide`** |
| `bypass_actors` | Un seul : `actor_type: RepositoryRole`, `actor_id: 5` (**rôle Admin du dépôt**), `bypass_mode: always` |
| Dates | Créé le 2025-10-24 · **mis à jour le 2026-07-29T18:02:04+02:00** (la régularisation du chantier 2) |

Le check `yaml-valide` est publié par `checks-digest.yml` du même dépôt : job `yaml-valide`, déclenché sur `pull_request` vers `main`, validation `yaml.safe_load_all` récursive sur **tous** les fichiers `.yaml`/`.yml` du dépôt, sortie non nulle sur la première erreur. *(OBSERVED — `gh api repos/POPAISTUDIO/vermeer-gitops-prod/contents/.github/workflows/checks-digest.yml`, 29/07/2026.)*

**Ce que cette configuration produit, en clair :** un agent qui pousse une branche et ouvre une PR peut aller jusque-là et pas plus loin. Le bouton merge ne s'ouvre que si le YAML est valide, et il ne s'actionne que par un humain. `required_approving_review_count: 0` n'affaiblit pas l'écluse : la PR reste **obligatoire**, et en solo une exigence d'approbation ne fait qu'ajouter un bypass de plus à chaque MEP — c'est précisément ce que l'incident du 28/07 a démontré (§7).

**Où s'arrête l'écluse décrite ici — la distinction à ne pas confondre.** OBSERVED : `vermeer-gitops-prod` est un dépôt **partagé**, structuré en `prod/llm/` (Vermeer Chat) et `prod/app/` (autres produits) — `gh api …/contents/prod`, 29/07/2026 ; d'autres équipes y ouvrent régulièrement des PRs de promotion `abstraction-layer` et frontend — `gh pr list -R POPAISTUDIO/vermeer-gitops-prod --state all`, 29/07/2026.

Deux choses s'y superposent, et elles n'ont pas la même portée :

| | Portée | Qui l'impose |
|---|---|---|
| **Le ruleset `9169830`** — PR obligatoire + check `yaml-valide` | **tout le dépôt**, toutes les équipes | GitHub, mécaniquement |
| **L'écluse humaine décrite dans ce document** — qui relit, comment, sous quelles conditions | **le seul périmètre `prod/llm/`** | Cette gouvernance |

Autrement dit : le ruleset s'applique aux promotions des autres équipes, **la relecture prescrite ici non**. Leurs PRs relèvent de **leurs** relecteurs et de **leurs** merges — ce document ne désigne aucun garant de leurs promotions, et n'a pas à en désigner. Ce qu'il garantit, c'est que **rien ne franchit `main` sans PR ni YAML valide**, quelle que soit l'équipe ; et que **sur `prod/llm/`**, la PR est en outre relue ligne à ligne selon le §4 avant merge.

Corollaire déjà éprouvé (§3, régime 3) : toute évolution de l'écluse prod est une **décision inter-équipes**, jamais un réglage interne Vermeer.

### Doctrine du bypass — commune aux régimes 1 et 2

Les deux rulesets portent **le même** `bypass_actors` : `RepositoryRole` `actor_id: 5`, `bypass_mode: always`. La doctrine qui suit s'applique identiquement aux deux dépôts — **pour les usages relevant du flux Vermeer Chat**. Le rôle Admin de `vermeer-gitops-prod` est porté par des personnes hors équipe Vermeer : leurs éventuels bypass sur `prod/app/` ne relèvent ni de cette doctrine ni de ce traçage. On ne trace que ce dont on est responsable.

1. **Le bypass est réservé aux urgences.** Une urgence, c'est un service dégradé ou une correction qui ne peut pas attendre le circuit normal. Ce n'est ni la commodité, ni la fatigue, ni « le check met trois minutes ».
2. **Chaque usage est tracé dans une issue dédiée**, ouverte sur le dépôt concerné, contenant : la date, la PR concernée, ce qui empêchait le circuit normal, ce qui a été mergé sans le contrôle, et la règle ou le correctif qui en découle. Le premier exemplaire de cette trace est l'issue d'incident citée en §7.
3. **Le bypass ne se normalise pas.** Deux bypass pour la même cause, c'est une cause à corriger — pas un troisième bypass. La revue mensuelle est l'endroit où ce comptage se fait. *(L'incident fondateur en a compté **trois** : deux subis, et un troisième assumé pour installer le correctif — §7. C'est la seule figure où un troisième bypass se justifie : celui qui supprime la cause des deux premiers.)*

> **Limite assumée, à connaître exactement.** Le bypass est attaché au **rôle Admin du dépôt** (`RepositoryRole`, `actor_id: 5`), pas à une personne nominative — et `bypass_mode: always` couvre **aussi les poussées directes sur `main`**, pas seulement le bouton merge des PRs. Conséquences, sans euphémisme : (a) toute personne portant le rôle Admin dispose du même pouvoir — sur `vermeer-gitops-prod`, dépôt partagé, cela inclut des porteurs hors équipe Vermeer ; (b) la discipline de traçage est **conventionnelle, pas technique** : rien n'empêche mécaniquement un bypass non tracé.
>
> C'est un choix, pas un oubli : en solo, un bypass verrouillé plus finement produirait un blocage dur sans recours un jour de MEP. **Le contrepoids est donc humain et périodique** : la revue mensuelle (§7) confronte les merges de `main` **des deux dépôts sous ruleset** aux issues de traçage, et tout écart est un incident de gouvernance.

### Régime 2 — `vermeer-text` : écluse jumelle, sans check requis

**OBSERVED — source : `gh api repos/POPAISTUDIO/vermeer-text/rulesets/19987595`, relevé le 29/07/2026 immédiatement après création.**

| Champ | Valeur observée |
|---|---|
| Nom / id | **« Écluse main »** / `19987595` |
| Dépôt | `POPAISTUDIO/vermeer-text` (`source_type: Repository`) |
| Enforcement | `active` |
| Cible | `~DEFAULT_BRANCH`, aucune exclusion — **`main` seule ; les branches restent libres** |
| Règle `deletion` | Suppression de `main` **bloquée** |
| Règle `non_fast_forward` | Réécriture d'historique **bloquée** |
| Règle `pull_request` | PR **obligatoire** · `required_approving_review_count: 0` · `dismiss_stale_reviews_on_push: false` · `require_code_owner_review: false` · `require_last_push_approval: false` · `required_review_thread_resolution: false` · `allowed_merge_methods: [merge, squash, rebase]` |
| `required_status_checks` | **Aucune règle de ce type** — divergence assumée avec la prod, voir ci-dessous |
| `bypass_actors` | Un seul : `actor_type: RepositoryRole`, `actor_id: 5` (**rôle Admin du dépôt**), `bypass_mode: always` |
| Créé le | `2026-07-29T19:31:41+02:00` |

**Pourquoi pas de check requis ici.** La dette CI du dépôt (**issue 86**) fait qu'un gate CI n'est pas fiable aujourd'hui : l'imposer comme *required status check* produirait un blocage **sans signal** — exactement le défaut que l'incident du 28/07 a démontré au §7 (un contrôle qu'on ne peut pas satisfaire n'est pas un contrôle). L'écluse impose donc la **PR**, et c'est la relecture humaine qui juge le contenu. **Candidat naturel dès que la dette 86 est soldée : passer le gate CI en check requis**, ce qui alignerait ce régime sur celui de la prod.

**Trace historique — un deuxième exemple vivant du §7.** L'absence d'écluse sur ce dépôt n'a pas été détectée par un incident mais **par la rédaction du présent document, le 29/07/2026** : décrire l'étage 4 a obligé à aller lire l'état réel (`gh api …/rulesets` → vide), et l'écart a été **fermé le jour même** par le ruleset ci-dessus. C'est exactement le mécanisme du §7 — un manque de gouvernance constaté devient une règle opposable — à ceci près qu'ici l'écriture de la règle a précédé le dommage au lieu de le suivre.

**Ce que la pose de cette écluse ne casse pas — vérifié avant, pas après.** OBSERVED (29/07/2026) : balayage des **24** fichiers de `.github/workflows/` (`grep -nE "git push|git commit|create-pull-request|gh pr merge|git/refs/heads/main|--admin"`) — **aucun workflow n'écrit sur le `main` de ce dépôt**. La seule écriture Git de tout le parc est celle du release train, et elle cible une **branche** (`bump/sha-*`) d'un **autre** dépôt (l. 288), suivie d'un merge de PR (l. 319). Côté humain, 11 des 12 derniers commits de `main` étaient déjà des merges de PR ; le douzième était une poussée directe de documentation, désormais couverte par le bypass du rôle Admin — et donc soumise à la doctrine de traçage ci-dessus.

### Régime 3 — `vermeer-gitops` : dépôt partagé, écluse conventionnelle

**Aucun ruleset, et c'est une décision, pas un oubli.** OBSERVED, 29/07/2026 : `gh api repos/POPAISTUDIO/vermeer-gitops/rulesets` → tableau vide ; `…/branches/main/protection` → HTTP 404 « Branch not protected ».

**La raison : sur ce dépôt, la poussée directe sur `main` est le régime de travail normal d'autres équipes.** OBSERVED (`gh api …/commits?sha=main`, 29/07/2026) : sur les 12 derniers commits, **un seul** est un merge de PR — celui du release train (`chore(dev+staging): bump image vers sha-a4902c6 (#84)`) ; les onze autres sont des poussées directes signées `jaks`, `Arnaud Rocca`, `Sheoak`, `arthurgoldfr` et `gitops-bot`. Cette dernière identité est celle de `deploy-staging.yml`, dont le script `scripts/hotswap.sh` fait `git commit` (l. 181) puis `git push` **sans argument de branche** (l. 204) sur la branche par défaut — le `actions/checkout@v4` du workflow n'a pas de `ref:` et le dépôt a `default_branch: main`. Ce pipeline sert `*/app/` et `abstraction-layer`, pas Vermeer-LLM.

Un ruleset exigeant la PR **couperait ces flux** : le `GITHUB_TOKEN` de ce workflow ne porte pas le rôle Admin, donc le bypass ne le couvrirait pas, et **9 des 27 collaborateurs sont `push: true` / `admin: false`** (`gh api …/collaborators`). **Régulariser est une décision multi-équipes, pas un geste unilatéral** — à ouvrir en conversation avec les co-usagers du dépôt et à tracer au backlog. Hors périmètre du chantier 3.

**Le flux Vermeer, lui, passe intégralement par PR** — vérifié, pas supposé. OBSERVED : l'agent config (`claude.yml`) n'a aucune écriture Git dans son workflow et son prompt lui interdit huit fois la poussée sur `main` (§3) ; le release train pousse une branche `bump/sha-*` puis merge une PR. Aucun des deux ne pousse sur `main`.

> **Risque résiduel, sans euphémisme.** L'agent config tourne avec `permissions: contents: write` sur un dépôt **sans barrière technique**. Ce qui l'empêche de pousser sur `main`, ce sont ses **interdits codés** (§3) et le **merge humain** — rien du côté serveur. Si son prompt régressait, si un merge upstream écrasait ses consignes, ou si un jeton était réutilisé hors de son cadre, il n'y aurait **aucun filet**. C'est le seul endroit du système où la règle repose entièrement sur la convention. La contrepartie est un point de vigilance mensuel dédié (§7) : le flux Vermeer sur ce dépôt est-il **toujours** à 100 % en PR ?

### La relecture de PR, dans les trois régimes

Le review count est à 0 sur les deux rulesets, assumé en solo. La relecture décrite ci-dessous est celle du **flux Vermeer Chat** — les PRs des autres équipes sur les dépôts partagés ont leurs propres relecteurs. Pour ce qui nous concerne, il faut en tirer la conséquence sans la diluer :

> **La relecture de PR est l'unique contrôle qualité humain de la boucle continue.** Avec la désignation automatique (§2), personne n'a relu l'issue en amont : le modèle a jugé un rouge, il a désigné, un autre agent a codé. Le premier — et le seul — regard humain est celui posé sur le diff. Il se donne en conséquence : diff lu ligne à ligne, argumentaire confronté au code, effet attendu vérifiable. Un diff trop gros pour être relu se renvoie ; il ne se merge pas au bénéfice du doute.

Ce que les rulesets ajoutent n'est pas un jugement, c'est une **garantie de passage** : ils rendent impossible de contourner l'endroit où ce regard se pose. Le régime 3 ne l'a pas — d'où la vigilance dédiée.

---

## §5 — Re-vérification

**Règle fondatrice : aucun déploiement sans vérification automatique du même niveau.**

Un déploiement automatisé vérifié à la main n'est pas automatisé : c'est un déploiement rapide suivi d'un contrôle lent. Le niveau de la vérification doit égaler le niveau du déploiement — automatique pour automatique.

### Dev et staging — vivant

- **QA nightly** : cron **06h30 Paris** (`30 4 * * 1-5` UTC), du lundi au vendredi · **+ post-train** : le release train déclenche la même QA après le bump et l'attente de réconciliation Flux (`FLUX_WAIT_MINUTES`, défaut **8** min, surchargeable par variable de dépôt). *(OBSERVED — `qa-nightly.yml` et `release-train.yml`, 29/07/2026.)*
- **Périmètre** : **11 cas P0 au verdict**. Treize cas portent `@wave1` ; **deux dorment sous `@known-issue-114`** (WEB-01a et WEB-01b, les deux moitiés de WEB-01 — voir la règle du rouge ci-dessous) et sont exclus par le `--grep-invert @known-issue` du gate. Le canary complète avec 4 cas `@canary` (GEN-02, GEN-03, GEN-06, SEL-01) à **07h00 Paris**.
- **Le verdict est un code de sortie**, jamais une opinion. Gate final : `exit 1` si l'étape Playwright n'est pas `success` — « la Vague 1 est la porte de release ».
- **Journal** : Dossier QA, **issue 112 de `vermeer-text`** (« Dossier QA nightly », label `qa-nightly`, ouverte — OBSERVED `gh issue view 112`, 29/07/2026). Un commentaire daté par run : verdict, décompte réel lu dans le JSON, nature de chaque échec, assertion exacte citée, lien du run.
- **Test de garde en préalable** : la session QA est un `storageState` capturé à la main (SSO, aucun login par formulaire possible) et **à usage unique** — l'application rote le refresh token à chaque chargement. Le garde tourne avant tout le reste ; s'il échoue, les 11 cas restent **non exécutés** et le motif est « session expirée », jamais un bug produit. La session rotée est republiée en fin de job. *(La fragilité structurelle que cela introduit disparaît avec le compte de service du chantier 5.)*

### Production — manuel aujourd'hui

- **Point 0** : vérifier l'image réellement servie par le pod, via Loki, **avant tout diagnostic**. Un rouge signifie très souvent que l'environnement ne fait pas tourner le build attendu — pas que le code est cassé. Tant que l'image n'est pas confirmée, **aucune conclusion produit n'est valide**. *(Cette consigne est déjà inscrite automatiquement dans chaque issue de canary rouge — OBSERVED, `canary-providers.yml`, 29/07/2026.)*
- **Smoke 9 points** après réconciliation Flux.
- **Aujourd'hui : joués à la main** (Hermes en capteur + l'humaine). C'est l'écart le plus coûteux du système : la voie MEP est instrumentée jusqu'au merge, puis redevient artisanale.

⏳ **Point 0 et smoke automatisés au chantier 5** — compte de service de test dédié, workflow GitHub, rapport avec verdict. Le compte de service supprime au passage la fragilité `QA_STORAGE_STATE` ci-dessus.

⏳ **Dossier MEP au chantier 7** — jumeau du Dossier QA : un run de MEP, une entrée journalisée.

### La règle du rouge — à graver

*Reprise de [`architecture-cible-v2.md` §6](architecture-cible-v2.md#6-qa--actualisation-post-v01023).*

> **Tout cas rouge est soit un bug qui déclenche la boucle, soit un défaut connu tracé `@known-issue-N` hors verdict. Jamais un rouge d'habitude.**

Un cas qui échoue en permanence n'apporte aucun signal : il transforme un verdict déterministe en bruit et habitue l'œil au rouge. Avec la désignation automatique (§2), ce principe cesse d'être une question d'hygiène : **chaque rouge non tracé déclenche du travail d'agent**. Le filet doit être vert quand le produit tient ses promesses réelles, rouge quand il les casse — et chaque rouge doit mériter la machine qu'il met en marche.

Corollaire pratique : un cas qui vérifie une promesse que le produit ne tient pas encore se **scinde** (la part tenue reste au verdict P0, la part non tenue passe en `@known-issue-N`, documentée au Dossier QA avec renvoi à l'issue) ; il ne se supprime pas et ne se laisse pas rougir.

**Le tag `@known-issue-N` est câblé aux deux bouts depuis le chantier 4** (§2, garde-fou 3) : il sort le cas du verdict P0 — `qa-nightly.yml` filtre `--grep @wave1 --grep-invert @known-issue` — **et** de la désignation automatique (étape 0 du triage). Poser le tag suffit ; le cas garde son `@wave1` et y revient dès que le tag part. Convention d'emploi, bornes et limites : `e2e/staging/README.md` §5. **Premier exercice réel** : la scission de WEB-01 en WEB-01a (réponse appuyée sur le web) et WEB-01b (citations affichées), 29/07/2026 — documentée au Dossier QA #112 avec renvoi à l'issue 114. **Et sa leçon, le soir même** : la scission n'a pas suffi. Éprouvé sur staging (run local unique), WEB-01a est rouge lui aussi — #114 couvre le **service**, pas seulement l'affichage des citations. **Les deux moitiés portent donc `@known-issue-114`**, et le périmètre du verdict tombe à 11 cas. Ce n'est pas un échec de la règle du rouge, c'est son application : on ne scinde pas pour sauver un cas, on scinde pour ne garder au verdict que ce que le produit tient — et quand il ne tient rien, le verdict rétrécit plutôt que de rougir chaque nuit.

---

## §6 — Observation

**Règle fondatrice : l'observation est en lecture seule, strictement.**

### Hermes — le capteur

- **Annonce chaque commande avant de l'exécuter.** L'observateur qui agit sans dire ce qu'il fait n'est plus observable lui-même.
- **Discipline OBSERVED / INFERRED / UNKNOWN**, sans exception. Un fait relevé porte sa source et sa date. Une déduction se déclare comme telle. Ce qui n'est pas vérifiable se dit **UNKNOWN** — on ne brode pas, on ne comble pas un trou par une hypothèse plausible.
- **Jetons en lecture seule.** Accès Loki/Grafana via les wrappers `lokiq` (staging) et `lokiq-prod` (production), jetons Grafana read-only stockés localement. *(Détail au [registre](registre-identites.md).)*

> **Limite assumée — OBSERVED, `gh auth status`, 29/07/2026** : le `gh` local est authentifié sur le compte humain, scopes `gist, read:org, repo, workflow`. Le scope `repo` inclut l'**écriture**. La lecture seule d'Hermes côté GitHub est donc **conventionnelle** (elle vit dans son mandat), pas technique. Elle tient parce qu'Hermes annonce ses commandes — ce qui est exactement la raison d'être de la règle d'annonce.

### Principe d'extension

Toute nouvelle capacité d'observation suit le même cadre, sans dérogation : **compte dédié · jamais de jeton d'écriture · discipline d'étiquetage · journal horodaté même quand tout va bien** (un « RAS » daté est une information ; un silence n'en est pas une).

⏳ **entre en vigueur au chantier 6** — migration des missions récurrentes d'Hermes en crons GitHub Actions, pour qu'elles tournent Mac éteint : scan de nuit quotidien · canary providers prod (un appel minimal par provider, compte dédié) · check de drift hebdomadaire staging ↔ prod (diff des `librechat.yaml` + `configEnv`, issue instruite sur écart non documenté).

### Amendement acté — lire la prod par l'application

Le smoke et le canary prod **lisent** la production **via l'application** : requêtes HTTP, compte de service identifiable, périmètre read-only, nettoyage derrière eux. **Jamais via gitops. Jamais avec un jeton d'écriture.**

La règle « **aucun agent n'écrit vers la production** » reste **intacte au sens infra** : aucun agent ne modifie un manifeste, un HelmRelease, un secret ou un état de cluster de production. Lire la prod par la porte d'entrée utilisateur n'est pas y écrire — c'est s'en servir comme n'importe quel client, avec une identité qu'on peut nommer dans un journal et un état qu'on remet en place après passage.

Deux exigences en découlent, non négociables : le compte de service est **identifiable** (on doit pouvoir isoler son trafic dans les logs et le distinguer d'un utilisateur réel), et il **nettoie derrière lui** (aucune conversation, aucun fichier, aucun état résiduel laissé en production).

⏳ *Le compte de service arrive au chantier 5 ; le canary prod au chantier 6.*

### Règle « l'observation ne désigne pas »

> Une mission récurrente qui détecte une anomalie ouvre une issue **instruite** — preuves, contexte, taux — **sans label**, et notifie l'humain.

La désignation reste humaine sur cette voie. La raison est de fond, pas de prudence : le triage QA juge des **régressions prouvées contre des promesses déterministes** (un cas asservit une assertion, elle passe ou elle casse) ; l'observation produit des **faits qui demandent un jugement** — gravité, urgence, périmètre, coût d'opportunité. Un pic d'erreurs à 3 % peut être un incident ou un bruit connu ; seul un humain arbitre.

**Toute auto-désignation future d'un type d'anomalie précis sera un amendement explicite de ce document** — jamais un effet de bord d'un chantier, jamais une extension silencieuse d'un prompt.

*État vivant, OBSERVED (`canary-providers.yml`, 29/07/2026) : le canary rouge ouvre une issue labellisée `canary` + `infra` — deux labels de classement, aucun label déclencheur. La règle est déjà appliquée.*

---

## §7 — Boucle de correction

**Règle fondatrice : un incident de gouvernance est un bug.** Il se trace, il se corrige à la source, et il se transforme en règle.

Un incident de gouvernance, ce n'est pas un bug applicatif : c'est le système de contrôle qui a cédé, été contourné, ou s'est révélé intenable. Le traiter comme une fatalité l'installe ; le traiter comme un bug le supprime.

**Sont des incidents de gouvernance** — pour les acteurs et le périmètre régis par ce document, jamais pour le travail des autres équipes des dépôts partagés : un bypass utilisé · un bypass non tracé · un agent qui dépasse son périmètre · un jeton créé hors registre ou trop large · un budget dépassé sans échec bruyant · **une sortie de modèle mergée sans relecture humaine** · un rouge d'habitude installé au verdict · **et les ratés de la désignation automatique** — faux positif labellisé (un agent mis en marche pour rien), boucle stoppée au plafond de tentatives, cas connu non exclu qui relance l'agent chaque nuit.

### Le premier cas réel — le bypass de la MEP v0.10.23

**OBSERVED — `gh pr list -R POPAISTUDIO/vermeer-gitops-prod` et `gh api …/rulesets/9169830`, relevés le 29/07/2026.**

- **28/07/2026, 16h09 UTC** — PR **64** (« MEP v0.10.23 — image + 7 alignements de config certifiés staging ») mergée sur `main` de `vermeer-gitops-prod`. Le ruleset exigeait alors **2 approbations**, exigence **intenable en solo** : personne ne pouvait approuver. Le merge est passé par le **bypass admin**.
- **29/07/2026, 08h14 UTC** — PR **66** (`HELP_AND_FAQ_URL` en variable d'environnement) mergée dans les **mêmes conditions**. Deuxième bypass pour la même cause : le signal que la cause devait être corrigée à la source. Elle l'a été le jour même — mais au prix d'un troisième bypass (ci-dessous).
- **29/07/2026, 16h01:49 UTC** — PR **67** (« CI : check yaml-valide sur les PR vers main ») mergée : le check devient publiable. **C'est le troisième et dernier bypass de l'incident** — et le plus révélateur. OBSERVED (`gh pr view 67 …--json mergedAt,mergedBy,reviews`, 29/07/2026) : `reviews: []`, `reviewDecision` vide, mergée par `Loisetoscer` **quinze secondes avant** la reconfiguration du ruleset (`16:02:04 UTC`). L'exigence de 2 approbations était donc encore active : sans review, seul le bypass admin pouvait ouvrir ce merge. **Il a fallu contourner le contrôle pour installer le correctif qui le rend satisfaisable** — la démonstration la plus nette qu'un contrôle inapplicable ne protège rien : il bloque jusqu'à sa propre réparation.
- **29/07/2026, 18h02 (heure de Paris)** — ruleset **9169830** reconfiguré : approbations à **0**, required status check **`yaml-valide`**, bypass réservé aux urgences et tracé. La cause racine — une exigence d'approbation inapplicable en solo, qui transformait le bypass en passage obligé — est supprimée.
- **Traçage rétroactif** : issue **`POPAISTUDIO/vermeer-gitops-prod` n° 69** — « Incident de gouvernance — bypass merge MEP v0.10.23 », ouverte à l'issue du chantier 3. C'est le **premier exemplaire** de la trace exigée par la doctrine du bypass (§4) ; les suivantes prennent le même format : date, PR concernée, ce qui empêchait le circuit normal, ce qui a été mergé sans le contrôle, la règle qui en découle.

**La règle née de l'incident**, et c'est tout l'intérêt de la tracer : **une exigence de contrôle qu'un seul humain ne peut pas satisfaire n'est pas un contrôle, c'est un bypass déguisé.** Elle produit deux effets pervers : elle rend le contournement routinier, et elle masque les vrais contrôles derrière un rituel qu'on apprend à sauter. Le contrôle utile en solo est celui qu'une machine vérifie (`yaml-valide`) doublé d'un geste que l'humain **peut** poser (le merge). Voir §4 (doctrine du bypass) et §3 (interdits testés).

### Le premier exercice du veto par exception — issue 114, 29/07/2026

Le garde-fou **5** du triage désignateur (§2) prévoit que *retirer un label rendort l'issue à tout moment*. **Il a été exercé pour la première fois le 29/07/2026** : retrait du label `claude-fix` de l'**issue 114 de `vermeer-text`** (« [QA] WEB-01 — recherche web non déclenchée malgré toggle ON (GPT-5.2) »), par l'humaine, à la main.

**Le motif est une question de séquence, pas de gravité** : ce cas est celui que [`architecture-cible-v2.md` §6](architecture-cible-v2.md#6-qa--actualisation-post-v01023) destine au tag `@known-issue-114` — un défaut connu et dépriorisé, à sortir du verdict P0 **et** de la désignation automatique, le temps que WEB-01 phase 2 (observabilité, puis correctif) livre. Laisser le label posé, c'était garder du travail désigné sur un cas dont on a décidé qu'il attendrait.

**Ce que ce cas enseigne, et qui devient une règle** : le veto n'est pas un désaveu de l'agent ni du triage. C'est **l'instrument par lequel la priorité humaine s'exerce par exception**.

**Ce veto est désormais relayé par le tag — chantier 4, 29/07/2026.** Le retrait manuel du label sur l'issue 114 protégeait un cas rouge tant que rien ne l'excluait mécaniquement ; ce n'était pas tenable, parce qu'un retrait de label ne survit pas à la nuit suivante si le cas rougit encore. Le relais est pris par le tag `@known-issue-114`, porté par le cas **WEB-01b** issu de la scission de WEB-01 (§5) : le cas sort du verdict P0 *et* de la désignation, sans geste humain à répéter. Deux conséquences à tenir :

- **Le veto redevient ce qu'il doit être : rare.** Retirer un label reste possible à tout moment, mais ce n'est plus le seul rempart d'un défaut connu — c'est un geste d'exception, pas une astreinte.
- **Un label retiré à la main n'est jamais reposé par le triage** (§2, cycle du label, borne 2). C'est ce qui rend le veto opposable au garde-fou 4 : la relance automatique s'arrête devant une décision humaine, et le prompt le dit nommément. Le test de garde `known-issue-rouge` (§3) vérifie que la porte tient.

Reste que le tag et le retrait de label ne couvrent pas la même chose : le tag protège **un cas de QA**, le retrait de label protège **une issue**. Une issue dépriorisée dont aucun cas ne porte le tag correspondant se rendort à la main — et se retrouve désignée à la première rechute, sauf plafond atteint.

### Revue mensuelle — 30 minutes, checklist

Une fois par mois, 30 minutes, cette liste dans l'ordre. Elle n'est pas un audit : c'est le moment où les règles vivantes sont confrontées au réel, et où les règles en attente (⏳) sont regardées pour ce qu'elles sont — des trous connus.

1. **Registre à jour** — [`registre-identites.md`](registre-identites.md) confronté à `gh secret list` sur les trois dépôts. Tout secret présent hors registre, ou inscrit mais disparu, est un écart. Vérifier les échéances qui approchent (moins de 3 mois → planifier la rotation).
2. **Tests de garde verts** — les tests du §3 qui existent ont tourné et sont verts. Ceux qui n'existent pas encore sont nommés et rattachés à un chantier. **Geste concret du mois** : `gh workflow run "QA Triage — rejeu sur fixtures" -R POPAISTUDIO/vermeer-text --ref main`, puis lire les trois verdicts (un job par fixture, `fail-fast: false`). Il rejoue le prompt vivant du triage en dry-run — il n'écrit rien, il ne touche pas le tracker. À relancer aussi **hors revue, après toute modification du prompt de triage**. Rouge deux fois de suite sur la même fixture = incident, pas aléa. **⚠️ Tant que `id-token: write` n'est pas ajouté aux permissions de ce workflow, ce geste rend un rouge structurel qui ne dit rien du triage** (§3, mise en garde du 30/07/2026). Second geste du mois, celui-là déterministe et local : `.github/scripts/verdict-replay/rejouer.sh` (4 fixtures, gate de livrable de `claude.yml`). Contrôler dans la même minute les `--allowedTools` de `qa-nightly.yml` et `qa-triage.yml` (audit de la ligne « lecture seule » du §3).
3. **Bypass utilisés et tracés** — les merges de `main` du mois **touchant le périmètre Vermeer Chat** (`prod/llm/` sur `vermeer-gitops-prod`, tout le dépôt sur `vermeer-text`) confrontés aux issues de traçage. Un merge sans trace est un incident à ouvrir. Deux bypass de même cause → corriger la cause. **Les promotions des autres équipes (`prod/app/`) ne sont pas auditées ici** : elles relèvent de leurs propres relectures.
4. **Intégrité des écluses** — deux vérifications, l'une mécanique, l'autre par lecture (§4) :
   - **Les deux rulesets sont-ils intacts ?** `gh api repos/POPAISTUDIO/vermeer-gitops-prod/rulesets/9169830` et `gh api repos/POPAISTUDIO/vermeer-text/rulesets/19987595` → confronter `enforcement`, `rules` et `bypass_actors` aux tableaux du §4. Un ruleset désactivé, une règle disparue ou un `bypass_actors` élargi est un **incident de gouvernance**, pas un réglage.
   - **Le flux Vermeer sur `vermeer-gitops` est-il toujours à 100 % en PR ?** Ce dépôt n'a pas de ruleset (régime 3, décision multi-équipes). Vérification par lecture : `git log` / `gh api …/commits?sha=main` sur les derniers commits touchant le **périmètre Vermeer** (`dev/llm/`, `staging/llm/`) → chacun doit être un merge de PR. Une poussée directe dans ce périmètre est un incident. Les commits des autres équipes hors de ce périmètre ne sont pas concernés.
   - **Si la dette CI (issue 86) est soldée** : passer le gate CI en `required_status_checks` sur `vermeer-text`, ce qui aligne le régime 2 sur le régime 1.
5. **Budgets dépassés** — runs sortis en timeout ou en épuisement de `--max-turns` sur le mois. Un dépassement récurrent est un budget mal taillé ou une tâche mal découpée, jamais une raison d'élargir sans réfléchir.
6. **Faux positifs du triage désignateur** — issues `claude-fix` créées automatiquement qui n'étaient pas des bugs, ou boucles stoppées au plafond. Chacune est un incident : combien d'agents mis en marche pour rien, et quelle porte manquait. Les plafonds atteints se lisent aux issues **assignées à Loïse** portant un marqueur `<!-- tentative: 2 -->` (§2, garde-fou 4).
7. **Rouges d'habitude** — cas rouges au verdict depuis plus de deux semaines sans tag `@known-issue-N` ni PR en cours (§5).
8. **Coûts** — minutes GitHub Actions et consommation de jetons des agents sur le mois, comparées au mois précédent. Une dérive s'explique ou se corrige.

Chaque point qui accroche produit soit une issue, soit une ligne dans ce document. **Une revue qui ne produit rien n'a pas eu lieu.**

### Coupe-circuit — endormir tout le système

À utiliser sans hésiter : agent qui boucle, désignation qui s'emballe, doute sur un jeton, incident en cours. **Endormir coûte quelques minutes ; laisser tourner peut coûter une journée.** Aucune de ces commandes ne détruit quoi que ce soit — tout est réversible par la procédure de réveil.

**Prérequis** : `gh` authentifié sur un compte ayant les droits d'administration des Actions des trois dépôts.

```bash
# ── 1. Désarmer les agents de vermeer-text (dans cet ordre : les désignateurs d'abord)
gh workflow disable qa-triage.yml         -R POPAISTUDIO/vermeer-text   # second désignateur
gh workflow disable claude.yml            -R POPAISTUDIO/vermeer-text   # agent codeur
gh workflow disable release-train.yml     -R POPAISTUDIO/vermeer-text   # propagation dev+staging
gh workflow disable qa-nightly.yml        -R POPAISTUDIO/vermeer-text   # QA (déclenche le triage)
gh workflow disable canary-providers.yml  -R POPAISTUDIO/vermeer-text   # sonde fournisseurs

# ── 2. Désarmer l'agent config
gh workflow disable claude.yml            -R POPAISTUDIO/vermeer-gitops

# ── 3. Retirer les labels actifs : une issue labellisée relance un agent au réarmement
gh issue list -R POPAISTUDIO/vermeer-text   --label claude-fix --state open \
  --json number --jq '.[].number' \
  | xargs -I{} gh issue edit {} -R POPAISTUDIO/vermeer-text   --remove-label claude-fix
gh issue list -R POPAISTUDIO/vermeer-gitops --label claude-fix --state open \
  --json number --jq '.[].number' \
  | xargs -I{} gh issue edit {} -R POPAISTUDIO/vermeer-gitops --remove-label claude-fix

# ── 4. Annuler ce qui tourne encore ET ce qui attend son tour.
#    Désactiver un workflow n'annule pas les runs déjà créés : un run `queued`
#    démarrera quand un runner se libère, même workflow désactivé.
gh run list -R POPAISTUDIO/vermeer-text   --status in_progress --json databaseId \
  --jq '.[].databaseId' | xargs -I{} gh run cancel {} -R POPAISTUDIO/vermeer-text
gh run list -R POPAISTUDIO/vermeer-text   --status queued      --json databaseId \
  --jq '.[].databaseId' | xargs -I{} gh run cancel {} -R POPAISTUDIO/vermeer-text
gh run list -R POPAISTUDIO/vermeer-gitops --status in_progress --json databaseId \
  --jq '.[].databaseId' | xargs -I{} gh run cancel {} -R POPAISTUDIO/vermeer-gitops
gh run list -R POPAISTUDIO/vermeer-gitops --status queued      --json databaseId \
  --jq '.[].databaseId' | xargs -I{} gh run cancel {} -R POPAISTUDIO/vermeer-gitops

# ── 5. Vérifier — tout doit afficher `disabled_manually`
gh workflow list -R POPAISTUDIO/vermeer-text   --all
gh workflow list -R POPAISTUDIO/vermeer-gitops --all
```

**Ce que le coupe-circuit ne touche pas, volontairement** : le ruleset de production (une écluse ne se désarme pas en cas d'incident — c'est le moment où elle sert le plus), `checks-digest.yml` (il publie le check requis ; le désactiver **bloquerait** toute PR prod), `vermeer-prod-image.yml` (build d'image, pas un agent), et Flux (il continue de réconcilier l'état déjà mergé — c'est voulu : on gèle les **nouvelles** propositions, pas l'infrastructure en place).

⏳ **Au chantier 6**, ajouter les crons d'observation à l'étape 1. ⏳ **Au chantier 7**, ajouter le workflow MEP — il est en `workflow_dispatch` seul, donc inerte sans ordre, mais on le désarme quand même par principe.

**Réveil — symétrique, et dans l'ordre inverse :**

```bash
# ── 1. Réarmer la machinerie déterministe et les capteurs d'abord
gh workflow enable canary-providers.yml  -R POPAISTUDIO/vermeer-text
gh workflow enable qa-nightly.yml        -R POPAISTUDIO/vermeer-text
gh workflow enable release-train.yml     -R POPAISTUDIO/vermeer-text

# ── 2. Vérifier que le filet est vert AVANT de réarmer les agents qui écrivent
gh workflow run "QA Nightly — Staging" -R POPAISTUDIO/vermeer-text --ref main
#    → attendre le verdict et lire le Dossier QA (issue 112). Rouge : ne pas réarmer, traiter.

# ── 3. Réarmer les agents qui proposent
gh workflow enable claude.yml            -R POPAISTUDIO/vermeer-text
gh workflow enable claude.yml            -R POPAISTUDIO/vermeer-gitops

# ── 4. Le second désignateur en DERNIER — il met les autres en marche
gh workflow enable qa-triage.yml         -R POPAISTUDIO/vermeer-text

# ── 5. Reposer les labels retirés à l'étape 3 du coupe-circuit, un par un,
#       après relecture de chaque issue (elles ont pu être traitées entre-temps).
```

**Toujours** : ouvrir une issue d'incident au moment du coupe-circuit — pourquoi, quoi désarmé, quand — et la clore au réveil avec la règle qui en découle (§7, en tête).

---

## Renvois

| Document | Rôle | Statut |
|---|---|---|
| [`architecture-cible-v2.md`](architecture-cible-v2.md) | La cible et la feuille de route ; **annexe = représentation canonique des circuits A-E** | Vivant (29/07/2026) |
| [`registre-identites.md`](registre-identites.md) | Annexe vivante du §1 — identités, jetons, permis/interdits | Vivant, tenu à jour au changement |
| [`ci/release-train.md`](ci/release-train.md) | Manuel d'exploitation du release train | Vivant |
| `e2e/staging/README.md` | Manuel d'exploitation de la QA (§4 tags, §5 cas, §8 divergences, §9 limites) | Vivant |
| [`CLAUDE.md`](../CLAUDE.md) | Mémoire institutionnelle projet — §6 garde-fous, §12 déploiement | Vivant |
| Manifeste de l'orchestration agentique | Le récit de l'existant | **Absent du dépôt au 29/07/2026** — voir la note ci-dessous |

> **Note d'écart — OBSERVED, 29/07/2026.** Deux documents cités comme sources de ce chantier n'existent pas dans le dépôt : le **manifeste** (`docs/orchestration-agentique-vermeer.md`) — introuvable dans `docs/`, dans l'historique Git et sur le disque de l'atelier — et le **manuel d'exploitation** (`docs/AGENTS-CI.md`). Le plus proche parent du second est `SETUP-AGENTS-CI.md`, hors dépôt, 58 lignes, **périmé** : il décrit trois agents (le triage et le release train n'existaient pas), cite des secrets qui n'existent pas (`ANTHROPIC_API_KEY`, `QA_USER_EMAIL`, `QA_USER_PASSWORD`) et affirme qu'« aucun workflow n'existe dans `vermeer-gitops-prod` » — `checks-digest.yml` y tourne depuis le 29/07/2026. **Il ne fait pas foi.** Le manuel d'exploitation réel et vivant est le couple [`ci/release-train.md`](ci/release-train.md) + `e2e/staging/README.md`. Rapatrier un manifeste à jour dans `docs/` reste à faire ; ce document ne s'y substitue pas — il prescrit, il ne raconte pas.

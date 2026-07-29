# GOVERNANCE.md — Gouvernance du système d'orchestration agentique Vermeer

*Source de vérité **prescriptive**. Le [manifeste](#renvois) raconte l'existant, [`architecture-cible-v2.md`](architecture-cible-v2.md) décrit la cible et la feuille de route, **ce document prescrit**. En cas de contradiction entre un document et un workflow réel, c'est le réel qui gagne et l'écart est signalé en PR ; en cas de contradiction entre un document et ce fichier sur une règle, c'est ce fichier qui gagne.*

**Version 1 — 29/07/2026**, au lendemain de la première MEP conduite par le système (v0.10.23, 28-29/07/2026).

---

## Comment lire ce document

**Il prescrit la CIBLE.** Une partie des dispositions ci-dessous n'est pas encore câblée. Chacune de celles-là porte un marqueur explicite :

> ⏳ **entre en vigueur au chantier N** — *(feuille de route : [`architecture-cible-v2.md` §5](architecture-cible-v2.md#5-feuille-de-route--sept-chantiers-dans-lordre-des-dépendances), huit chantiers)*

Tout ce qui ne porte pas ce marqueur est **vivant aujourd'hui** et opposable dès maintenant. À la revue mensuelle (§7), cette distinction est le premier tri : une règle vivante qui n'est pas respectée est un incident ; une règle en attente ne l'est pas.

**Étiquettes de preuve.** Les constats factuels portent leur étiquette : **OBSERVED** (avec sa source et sa date), **INFERRED**, **UNKNOWN**. Une affirmation sans étiquette est une *règle*, pas un constat — elle n'a pas à être prouvée, elle a à être respectée.

**Les workflows ne sont pas décrits ici.** Leur représentation canonique — portes de décision, acteurs, chemins de retour — est l'annexe de l'architecture cible : [`architecture-cible-v2.md` — Annexe, Workflows formalisés](architecture-cible-v2.md#annexe--workflows-formalisés-portes-de-décision-et-acteurs), circuits **A** (désignation), **B** (exécution), **C** (préparation MEP), **D** (post-merge MEP + comm'), **E** (observation). Ce document y **renvoie** et ne les recopie pas : un schéma dupliqué est un schéma qui divergera.

---

## Le principe, en une phrase

Les agents **réagissent** sur événement, **proposent** en PR, et **rien n'atteint le réel sans un merge humain**.

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
4. **En dépassement : échouer bruyamment.** Jamais continuer en silence, jamais retenter tout seul, jamais dégrader la sortie sans le dire. Un job qui déborde sort en erreur, et l'erreur remonte : job rouge (notification GitHub native) et, pour les workflows qui en tiennent un, une trace écrite dans le dossier concerné.
5. **Aucun retry automatique sur un agent qui écrit.** Une reprise après échec de poussée est une décision humaine : l'état du dépôt distant est inconnu. *(Règle déjà appliquée par le release train — OBSERVED, `.github/workflows/release-train.yml`, étape « Signaler l'échec », 29/07/2026.)*
6. **La sérialisation est un garde-fou, pas une optimisation.** Deux workflows qui consomment la même ressource à usage unique partagent un groupe de concurrence et **ne s'annulent pas** l'un l'autre. *(Cas réel : la session QA staging, rotée à chaque chargement.)*

### Recensement des budgets réels

**OBSERVED — valeurs relevées le 29/07/2026 dans les fichiers de workflow des trois dépôts** (`.github/workflows/` de `vermeer-text` en local ; `vermeer-gitops` et `vermeer-gitops-prod` via `gh api …/contents/.github/workflows/…`). Aucune valeur n'est reprise de mémoire ou d'un document.

#### `POPAISTUDIO/vermeer-text`

| Workflow (fichier) | Déclencheur | Budget | Timeout | Comportement en échec |
|---|---|---|---|---|
| **Claude Code** — mode interactif (`claude.yml`, job `claude-interactive`) | `issue_comment` / `pull_request_review_comment` / `issues` (opened, assigned) contenant `@claude` ; exclut `github-actions[bot]` | `--max-turns 40` | 45 min | Job rouge → notification GitHub native. Aucune étape de rattrapage dédiée *(INFERRED pour l'épuisement de `--max-turns` : aucun gate explicite dans le fichier, contrairement aux workflows QA)* |
| **Claude Code** — mode autonome (`claude.yml`, job `claude-autofix`) | `issues` action `labeled`, label **exactement** `claude-fix` | `--max-turns 80` | 60 min | Idem. Consigne de prompt : si la cause racine n'est pas identifiée avec confiance, **pas de PR** — un commentaire d'analyse sur l'issue |
| **QA Nightly — Staging** (`qa-nightly.yml`, job `wave1`) | `schedule` `30 4 * * 1-5` (04h30 UTC = **06h30 Paris** en heure d'été) + `workflow_dispatch` | `--max-turns 25` (étape d'analyse Claude uniquement) | 40 min | Gate final « la Vague 1 est la porte de release » : `exit 1` si Playwright n'est pas `success`. L'analyse tourne en `if: always()` et journalise au Dossier QA **avant** le gate |
| **QA Triage** (`qa-triage.yml`, job `triage`) | `workflow_run` sur `["QA Nightly — Staging"]`, `types: [completed]`, gardé par `conclusion == 'failure'` | `--max-turns 50` | 20 min | Job rouge. Si les artefacts sont absents ou `report.json` illisible : **ne devine pas** — commentaire au Dossier QA puis arrêt |
| **Canary Providers** (`canary-providers.yml`, job `canary`) | `schedule` `0 5 * * 1-5` (05h00 UTC = **07h00 Paris** en heure d'été) + `workflow_dispatch` | *aucun agent Claude — assertions déterministes seules* | 20 min | Issue `canary` + `infra` ouverte si rouge, puis gate « un canary rouge doit être rouge » : `exit 1` |
| **Release Train — dev + staging** (`release-train.yml`, job `propagate`) | `workflow_run` sur `["Build & Push Vermeer Custom Image to ECR"]`, gardé par `conclusion == 'success'` **et** `event == 'push'` **et** `head_branch == 'main'` | *aucun agent Claude — shell déterministe* | 25 min | **Aucun retry.** Étape `if: failure() \|\| cancelled()` → issue `release-train` (créée ou commentée), avec l'étape en échec, le tag visé et l'URL de la PR gitops éventuellement restée ouverte |
| **Build & Push … to ECR** (`vermeer-prod-image.yml`) | `push` sur `branches: ["**"]` et `tags: ["*"]` | *machinerie de build* | *non déclaré au niveau du job* | Job rouge ; le train ne part pas (son `if` exige `conclusion == 'success'`) |

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
| 2 — déduplication | **Câblé partiellement.** La dédup se fait par **identifiant de cas** (`GEN-02`, `FILE-01`…) confronté au même symptôme, via `gh issue list --label claude-fix --state all --limit 50`, avec commentaire sur l'existante. Ce n'est pas encore une signature d'échec au sens strict *(assertion + fichier + cas)* |
| 3 — exclusion `@known-issue-N` | **Non câblé.** Seul le SKIP motivé `CTX-02` est nommément exclu ; le mécanisme de tag générique n'existe pas encore |
| 4 — plafond de 2 tentatives | **Non câblé.** Aucun comptage de tentatives, aucun retrait de label, aucune notification de plafond |
| 5 — veto par exception | **Vivant par construction** — retirer le label empêche tout nouveau déclenchement (le job `claude-autofix` ne se déclenche que sur l'action `labeled`) |
| 6 — plafond 3 dossiers / run | **Câblé.** « PLAFOND : 3 issues maximum pour ce run » ; au-delà, les 3 plus graves puis une liste au Dossier QA |

⏳ **Les garde-fous 2 (signature stricte), 3 et 4 entrent en vigueur au chantier 4.** Jusque-là, **la désignation automatique tourne sans plafond de tentatives et sans mécanisme d'exclusion générique** : c'est un pouvoir en fonctionnement avec deux contrepoids manquants. Conséquence opérationnelle, à tenir jusqu'au chantier 4 : un cas rouge récurrent doit être soit corrigé, soit sorti du verdict à la main, soit surveillé — sous peine de relancer l'agent codeur chaque nuit sur le même mur (§5, règle du rouge d'habitude).

La voie humaine (Loïse via Hermes) est vivante et sans réserve.

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

*OBSERVED — cinq gardes successifs dans `release-train.yml`, étape « Verifier que le diff est strictement limite aux lignes de tag », 29/07/2026.*

- **La ligne de version, et rien d'autre.** Tout autre diff = abandon du job, pas de tentative de correction :
  - **(a)** aucun fichier hors liste blanche (`dev/llm/helm-release.yaml`, `staging/llm/helm-release.yaml`) ;
  - **(b)** aucun chemin contenant `prod`, en ceinture et bretelles — le dépôt n'en a pas, mais s'il en avait un le job devrait s'arrêter net plutôt que d'y toucher ;
  - **(c)** chaque ligne ajoutée ou supprimée est une ligne `tag: "…"` — un commentaire, une variable d'environnement, une annotation font échouer le job ;
  - **(d)** volumétrie exacte : une suppression + un ajout par fichier touché ;
  - **(e)** état final : les **deux** fichiers portent le tag visé.
- **Avant d'écrire** : chaque fichier doit contenir exactement **une** ligne `tag: "…"`. Zéro ou deux et plus → abandon (« mieux vaut un train cassé qu'un `sed` qui touche la mauvaise ligne »).
- **Jamais les tags Git de version.** Le `if` du job exige `head_branch == 'main'` : les releases taguées `v0.10.x` sont nativement exclues et suivent la procédure de déploiement documentée en [`CLAUDE.md` §12](../CLAUDE.md).

> **Exception assumée à « aucun merge automatique » — à connaître.** OBSERVED (`release-train.yml`, étape « Ouvrir et merger la PR gitops », 29/07/2026) : le train **auto-merge sa propre PR** sur `vermeer-gitops` (`gh pr merge --squash --delete-branch`). C'est la seule exception du système, et elle est bornée : diff **mécanique** (un `sed` sur une ligne) · vérifié par les cinq gardes ci-dessus **avant** la poussée · limité à **dev et staging** · sans aucun jugement de modèle dans la boucle (pas d'agent Claude sur ce workflow). Elle ne s'étend à rien d'autre : **aucune PR contenant du texte produit par un modèle ne se merge sans humain**, et l'exception ne franchit jamais la frontière de la production. Toute extension de cette exception est un amendement explicite de ce document.

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

Un interdit non testé s'érode : le prompt évolue, le modèle change, le fichier bouge. **Tout interdit doit être vérifié périodiquement.** Proposition de couverture — une ligne par interdit, **non implémentée à ce jour** ; le chantier qui câble l'interdit câble son test.

| Interdit | Test de garde proposé |
|---|---|
| Agent config — ligne de tag d'image / `restartedAt` | Check de PR sur `vermeer-gitops` : échec si le diff touche une ligne `tag:` ou l'annotation `restartedAt` sous `*/llm/` |
| Agent config — périmètre `dev/llm/` + `staging/llm/` | Check de PR : `git diff --name-only` entièrement inclus dans la liste blanche, sinon échec |
| Agent config — prod hors de portée | Check de PR : échec si un chemin du diff matche `prod` (insensible à la casse) |
| Agent config / agent codeur — jamais de merge | Audit mensuel : `gh pr list --state merged --json mergedBy` sur les deux dépôts → aucun merge par un acteur non humain (hors PRs `bump/sha-*` du train) |
| Release train — ligne de version uniquement | Rejeu du workflow sur une copie gitops volontairement polluée (commentaire ajouté, second `tag:`, chemin hors liste) → le job **doit** sortir en échec sur chacun des cinq gardes |
| Release train — jamais la prod | Test de la garde (b) : chemin contenant `prod` injecté dans le diff → abandon attendu |
| QA nightly / triage — lecture seule | Audit mensuel des `--allowedTools` des deux workflows : toute extension au-delà de `Read,Glob,Grep,Bash(gh issue *)` est un écart à justifier |
| Triage — pas de label sur doute | Rejeu du triage sur un run archivé à session expirée → aucune issue `claude-fix` créée |
| Agent MEP — `main` inatteignable ⏳7 | À la création **et à chaque rotation** du jeton : tentative de poussée directe sur `main` de `vermeer-gitops-prod` → doit être refusée par le ruleset |
| Agent MEP — jamais de cron ⏳7 | Audit mensuel : `grep -L schedule` sur le workflow MEP → aucune clé `schedule` présente |
| Agent comm' — écriture limitée à `docs/comm/` ⏳8 | Check de PR : `git diff --name-only` entièrement sous `docs/comm/`, sinon échec |

---

## §4 — L'écluse

**Règle fondatrice : aucun merge automatique, jamais.** *(Unique exception, bornée et sans modèle dans la boucle : la PR de bump du release train sur dev/staging — §3.)*

L'écluse est le point où une proposition devient réalité. C'est un geste **humain**, et c'est le seul.

### L'écluse de la production — ruleset « Écluse main — prod »

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

**OBSERVED, et à savoir : `vermeer-gitops-prod` est un dépôt partagé.** D'autres équipes y ouvrent des PRs de promotion (`abstraction-layer`, frontend) — `gh pr list -R POPAISTUDIO/vermeer-gitops-prod --state all`, 29/07/2026. Le ruleset et le check `yaml-valide` s'appliquent donc **à elles aussi**. Toute évolution de l'écluse prod se pense comme une décision inter-équipes, jamais comme un réglage interne Vermeer.

### Doctrine du bypass

1. **Le bypass est réservé aux urgences.** Une urgence, c'est un service dégradé ou une correction qui ne peut pas attendre le circuit normal. Ce n'est ni la commodité, ni la fatigue, ni « le check met trois minutes ».
2. **Chaque usage est tracé dans une issue dédiée**, ouverte sur le dépôt concerné, contenant : la date, la PR concernée, ce qui empêchait le circuit normal, ce qui a été merdé sans le contrôle, et la règle ou le correctif qui en découle. Le premier exemplaire de cette trace est l'issue d'incident citée en §7.
3. **Le bypass ne se normalise pas.** Deux bypass pour la même cause, c'est une cause à corriger — pas un troisième bypass. La revue mensuelle est l'endroit où ce comptage se fait.

> **Limite assumée, à connaître exactement.** Le bypass est attaché au **rôle Admin du dépôt** (`RepositoryRole`, `actor_id: 5`), pas à une personne nominative — et `bypass_mode: always` couvre **aussi les poussées directes sur `main`**, pas seulement le bouton merge des PRs. Conséquences, sans euphémisme : (a) toute personne portant le rôle Admin sur `vermeer-gitops-prod` — y compris hors équipe Vermeer, le dépôt étant partagé — dispose du même pouvoir ; (b) la discipline de traçage est **conventionnelle, pas technique** : rien n'empêche mécaniquement un bypass non tracé.
>
> C'est un choix, pas un oubli : en solo, un bypass verrouillé plus finement produirait un blocage dur sans recours un jour de MEP. **Le contrepoids est donc humain et périodique** : la revue mensuelle (§7) confronte les merges de `main` sur `vermeer-gitops-prod` aux issues de traçage, et tout écart est un incident de gouvernance.

### L'écluse des deux autres dépôts

Sur `vermeer-text` et `vermeer-gitops`, l'écluse est **le merge humain des PRs d'agents**. Le review count 0 est assumé en solo — et il faut en tirer la conséquence sans la diluer :

> **La relecture de PR est l'unique contrôle qualité humain de la boucle continue.** Avec la désignation automatique (§2), personne n'a relu l'issue en amont : le modèle a jugé un rouge, il a désigné, un autre agent a codé. Le premier — et le seul — regard humain est celui posé sur le diff. Il se donne en conséquence : diff lu ligne à ligne, argumentaire confronté au code, effet attendu vérifiable. Un diff trop gros pour être relu se renvoie ; il ne se merge pas au bénéfice du doute.

> **Limite assumée — OBSERVED, 29/07/2026** (`gh api repos/POPAISTUDIO/{vermeer-text,vermeer-gitops}/rulesets` → tableau vide ; `…/branches/main/protection` → HTTP 404 « Branch not protected ») : **ces deux dépôts n'ont ni ruleset ni protection de branche sur `main`.** L'interdiction de merger et de pousser sur `main` n'y vit **que dans les prompts** des agents (§3) et dans le garde-fou de [`CLAUDE.md` §6](../CLAUDE.md). Or les deux jobs `claude.yml` tournent avec `permissions: contents: write` : **techniquement, un agent pourrait y pousser sur `main`** ; seule sa consigne l'en empêche. C'est le principal contrepoids manquant du système à ce jour. Il est inscrit comme point de vigilance permanent de la revue mensuelle (§7) ; poser une écluse technique sur ces deux dépôts — même minimale, PR obligatoire avec 0 approbation, sur le modèle de la prod — est le candidat le plus rentable du prochain arbitrage. *(Décision non prise à ce jour : hors périmètre du chantier 3, qui documente et ne modifie aucune configuration.)*

---

## §5 — Re-vérification

**Règle fondatrice : aucun déploiement sans vérification automatique du même niveau.**

Un déploiement automatisé vérifié à la main n'est pas automatisé : c'est un déploiement rapide suivi d'un contrôle lent. Le niveau de la vérification doit égaler le niveau du déploiement — automatique pour automatique.

### Dev et staging — vivant

- **QA nightly** : cron **06h30 Paris** (`30 4 * * 1-5` UTC), du lundi au vendredi · **+ post-train** : le release train déclenche la même QA après le bump et l'attente de réconciliation Flux (`FLUX_WAIT_MINUTES`, défaut **8** min, surchargeable par variable de dépôt). *(OBSERVED — `qa-nightly.yml` et `release-train.yml`, 29/07/2026.)*
- **Périmètre** : **12 cas P0** tagués `@wave1`. Le canary complète avec 4 cas `@canary` (GEN-02, GEN-03, GEN-06, SEL-01) à **07h00 Paris**.
- **Le verdict est un code de sortie**, jamais une opinion. Gate final : `exit 1` si l'étape Playwright n'est pas `success` — « la Vague 1 est la porte de release ».
- **Journal** : Dossier QA, **issue 112 de `vermeer-text`** (« Dossier QA nightly », label `qa-nightly`, ouverte — OBSERVED `gh issue view 112`, 29/07/2026). Un commentaire daté par run : verdict, décompte réel lu dans le JSON, nature de chaque échec, assertion exacte citée, lien du run.
- **Test de garde en préalable** : la session QA est un `storageState` capturé à la main (SSO, aucun login par formulaire possible) et **à usage unique** — l'application rote le refresh token à chaque chargement. Le garde tourne avant tout le reste ; s'il échoue, les 12 cas restent **non exécutés** et le motif est « session expirée », jamais un bug produit. La session rotée est republiée en fin de job. *(La fragilité structurelle que cela introduit disparaît avec le compte de service du chantier 5.)*

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

Corollaire pratique : un cas qui vérifie une promesse que le produit ne tient pas encore se **scinde** (la part tenue reste au verdict P0, la part non tenue passe en `@known-issue-N`, documentée au Dossier QA avec renvoi à l'issue) ; il ne se supprime pas et ne se laisse pas rougir. ⏳ *Le mécanisme d'exclusion `@known-issue-N` côté triage est câblé au chantier 4 (§2) ; d'ici là, la mise hors verdict se fait à la main dans la suite.*

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

**Sont des incidents de gouvernance** : un bypass utilisé · un bypass non tracé · un agent qui dépasse son périmètre · un jeton créé hors registre ou trop large · un budget dépassé sans échec bruyant · un merge automatique hors de l'exception du §3 · un rouge d'habitude installé au verdict · **et les ratés de la désignation automatique** — faux positif labellisé (un agent mis en marche pour rien), boucle stoppée au plafond de tentatives, cas connu non exclu qui relance l'agent chaque nuit.

### Le premier cas réel — le bypass de la MEP v0.10.23

**OBSERVED — `gh pr list -R POPAISTUDIO/vermeer-gitops-prod` et `gh api …/rulesets/9169830`, relevés le 29/07/2026.**

- **28/07/2026, 16h09 UTC** — PR **64** (« MEP v0.10.23 — image + 7 alignements de config certifiés staging ») mergée sur `main` de `vermeer-gitops-prod`. Le ruleset exigeait alors **2 approbations**, exigence **intenable en solo** : personne ne pouvait approuver. Le merge est passé par le **bypass admin**.
- **29/07/2026, 08h14 UTC** — PR **66** (`HELP_AND_FAQ_URL` en variable d'environnement) mergée dans les **mêmes conditions**. Deuxième bypass pour la même cause : le signal que la cause devait être corrigée, pas contournée une troisième fois.
- **29/07/2026, 16h01 UTC** — PR **67** (« CI : check yaml-valide sur les PR vers main ») mergée : le check devient publiable.
- **29/07/2026, 18h02 (heure de Paris)** — ruleset **9169830** reconfiguré : approbations à **0**, required status check **`yaml-valide`**, bypass réservé aux urgences et tracé. La cause racine — une exigence d'approbation inapplicable en solo, qui transformait le bypass en passage obligé — est supprimée.
- **Traçage rétroactif** : issue **`POPAISTUDIO/vermeer-gitops-prod` n° 69** — « Incident de gouvernance — bypass merge MEP v0.10.23 », ouverte à l'issue du chantier 3. C'est le **premier exemplaire** de la trace exigée par la doctrine du bypass (§4) ; les suivantes prennent le même format : date, PR concernée, ce qui empêchait le circuit normal, ce qui a été mergé sans le contrôle, la règle qui en découle.

**La règle née de l'incident**, et c'est tout l'intérêt de la traçer : **une exigence de contrôle qu'un seul humain ne peut pas satisfaire n'est pas un contrôle, c'est un bypass déguisé.** Elle produit deux effets pervers : elle rend le contournement routinier, et elle masque les vrais contrôles derrière un rituel qu'on apprend à sauter. Le contrôle utile en solo est celui qu'une machine vérifie (`yaml-valide`) doublé d'un geste que l'humain **peut** poser (le merge). Voir §4 (doctrine du bypass) et §3 (interdits testés).

### Revue mensuelle — 30 minutes, checklist

Une fois par mois, 30 minutes, cette liste dans l'ordre. Elle n'est pas un audit : c'est le moment où les règles vivantes sont confrontées au réel, et où les règles en attente (⏳) sont regardées pour ce qu'elles sont — des trous connus.

1. **Registre à jour** — [`registre-identites.md`](registre-identites.md) confronté à `gh secret list` sur les trois dépôts. Tout secret présent hors registre, ou inscrit mais disparu, est un écart. Vérifier les échéances qui approchent (moins de 3 mois → planifier la rotation).
2. **Tests de garde verts** — les tests du §3 qui existent ont tourné et sont verts. Ceux qui n'existent pas encore sont nommés et rattachés à un chantier.
3. **Bypass utilisés et tracés** — merges de `main` sur `vermeer-gitops-prod` du mois confrontés aux issues de traçage. Un merge sans trace est un incident à ouvrir. Deux bypass de même cause → corriger la cause.
4. **Point de vigilance permanent** — `vermeer-text` et `vermeer-gitops` sont-ils toujours sans écluse technique (§4) ? Si oui : décision reportée, notée, ou prise. Ce point ne se raye pas de la checklist tant qu'il n'est pas résolu.
5. **Budgets dépassés** — runs sortis en timeout ou en épuisement de `--max-turns` sur le mois. Un dépassement récurrent est un budget mal taillé ou une tâche mal découpée, jamais une raison d'élargir sans réfléchir.
6. **Faux positifs du triage désignateur** — issues `claude-fix` créées automatiquement qui n'étaient pas des bugs, ou boucles stoppées au plafond (⏳4). Chacune est un incident : combien d'agents mis en marche pour rien, et quelle porte manquait.
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

# ── 4. Annuler ce qui tourne encore (les jobs en cours ne s'arrêtent pas tout seuls)
gh run list -R POPAISTUDIO/vermeer-text   --status in_progress --json databaseId \
  --jq '.[].databaseId' | xargs -I{} gh run cancel {} -R POPAISTUDIO/vermeer-text
gh run list -R POPAISTUDIO/vermeer-gitops --status in_progress --json databaseId \
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

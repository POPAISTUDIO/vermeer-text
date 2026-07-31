# Architecture cible v2 — Orchestration agentique Vermeer
*Vision arrêtée le 29/07/2026 (fil « Orchestration v2 — architecture cible & feuille de route »), au lendemain de la MEP v0.10.23. Amendée le jour même : désignation automatique des régressions QA (§2.1), quatrième circuit comm' de release (§2.4), règle « l'observation ne désigne pas » (§2.3) et annexe des workflows formalisés. Ce document décrit le système visé et la feuille de route pour l'atteindre. Il complète le manifeste (qui raconte l'existant) et sera remplacé, chantier par chantier, par GOVERNANCE.md (qui prescrira).*

## 1. Le principe — l'humain à l'écluse, et seulement là

La doctrine tient sur son pivot : les agents réagissent sur événement, proposent en PR, et **rien n'atteint le réel sans un merge humain**. Ce que la v2 change, c'est tout ce qui s'automatise *autour* de l'écluse — y compris, désormais, la désignation du travail quand c'est la QA qui découvre le problème.

**Le rôle humain, en entier** : parler à Hermes (« dev X », « fix Y », « prépare la MEP ») · merger les PRs · annoncer aux utilisateurs après une MEP. Rien d'autre. Les régressions détectées par la QA ne passent plus par sa voix : le triage les désigne automatiquement (§2.1).

## 2. Les quatre circuits cibles

### 2.1 Boucle continue — dev + staging
`Ta phrase → Hermes crée l'issue labellisée → agent (code ou config) → PR argumentée → ⚿ MERGE → release train (build + bump dev/staging) → QA post-train → vert : livré / rouge : triage → label automatique → agent ↻`

**Nouveau — Hermes greffier** : sur ordre explicite uniquement, il crée l'issue avec le bon label (`claude-fix` ou label config). Avant création, réflexe de cadrage obligatoire pour les fonctionnalités : 2-3 questions (comportement attendu, emplacement UI, critère d'acceptation) intégrées à l'issue. Une phrase floue produit une PR à côté ; trente secondes de cadrage économisent un tour de boucle complet.

**Nouveau — désignation automatique des régressions QA** (amendement de la règle « un humain désigne ») : quand la QA passe au rouge, le triage instruit *et labellise* dans la foulée — l'agent codeur travaille et pousse sa PR sans intervention humaine. Il y a désormais deux désignateurs : l'humain (via Hermes) et le triage (régressions QA uniquement). Garde-fous codés :
1. Label posé uniquement sur verdict **« bug » avec preuves** — jamais sur un doute (règle existante du triage), jamais sur les verdicts « test » ou « infra ».
2. **Déduplication** : une signature d'échec = une issue. Un cas qui rechute commente l'issue existante, il n'en ouvre pas une nouvelle chaque nuit.
3. **Exclusion des cas tagués `@known-issue-N`** : un défaut connu et dépriorisé ne déclenche rien (voir §6 — le tag est le veto persistant de l'humain).
4. **Plafond de 2 tentatives** : si deux PRs successives ne reverdissent pas le cas, le triage retire le label, documente l'échec dans le Dossier QA et notifie l'humain — l'issue redevient sienne.
5. **Veto par exception** : retirer un label rendort l'issue à tout moment. La priorité reste humaine ; elle s'exerce par exception, plus par défaut.
6. **Budget nightly inchangé** : max 3 dossiers instruits par run de triage.

### 2.2 Voie MEP — prod, sur ordre, instrumentée
`« Prépare la MEP » → agent MEP : préconditions (QA train verte, canary vert, pas d'incident ouvert — sinon STOP motivé) → tag + digest en PR sur gitops-prod (état des lieux, arbitrages soumis, doctrine des digests du 28/07) → checks automatiques (diff dans le périmètre, YAML valide, QA verte) → ⚿ MERGE relu ligne à ligne → Flux → Point 0 automatique → smoke automatique → rapport avec verdict → feu vert humain`

**Nouveau** : l'agent MEP (workflow_dispatch, jamais de cron) et l'automatisation du post-merge. La MEP passe d'une soirée + une matinée à : une phrase, une relecture-merge, la lecture d'un rapport vert. Chaque run journalisé dans un « Dossier MEP » jumeau du Dossier QA #112.

### 2.3 Observation prod — lecture seule
- **Hermes interactif** reste sur le Mac : capteur à la voix, diagnostics, sessions sur ordre. Rien ne migre.
- **Ses missions récurrentes migrent en crons GitHub Actions** (tokens Loki read-only en secrets) : scan de nuit quotidien, plus tard canary providers prod (un appel minimal par provider, compte dédié) et check de drift hebdomadaire staging↔prod (diff des librechat.yaml + configEnv, issue instruite sur écart non documenté). Elles tournent Mac éteint.
- **L'observation ne désigne pas** : quand une mission récurrente détecte une anomalie, elle ouvre une issue instruite (preuves, contexte, taux) **sans label** et notifie l'humain. La désignation reste humaine — contrairement au triage QA, qui juge des régressions prouvées contre des promesses déterministes, l'observation produit des faits qui demandent un jugement (gravité, urgence, périmètre). Toute auto-désignation future d'un type d'anomalie précis sera un amendement explicite de GOVERNANCE.md.
- **AWS : non nécessaire.** Les agents GitHub tournent déjà dans le cloud ; les endpoints Loki/Grafana sont joignables publiquement (avec token) puisque le Mac les interroge déjà. Runners GitHub + Mac interactif couvrent tout, zéro infra en plus.

### 2.4 Comm' de release — déclenchée par la fin de la voie MEP
`Rapport MEP vert → agent comm' : delta prod calculé (git log --oneline entre tags + diff du digest gitops-prod) → traduction en langage utilisateur → PR : deck fonctionnalités + CHANGELOG.md → ⚿ MERGE (relecture éditoriale) → note de release postée au « Dossier Releases » → notification mail à l'humain → l'humain annonce`

Garde-fous : le delta est **calculé depuis les tags et le digest**, jamais rédigé de mémoire — la comm' colle au déployé, pas au prévu. Le deck et le changelog passent par **PR** (le merge est ici un contrôle éditorial : ce contenu finit devant les utilisateurs). L'agent **n'envoie jamais rien aux utilisateurs** — la note arrive à l'humain via le Dossier Releases (notification GitHub native, zéro secret mail ; un envoi SMTP formaté pourra s'ajouter plus tard). Écriture limitée à `docs/comm/`. Prérequis : le deck fonctionnalités entre dans le repo (`docs/comm/`) comme source de vérité ; consignes python-pptx du backlog (snapshot des shapes, suppression des formes et non du seul texte) intégrées au prompt de l'agent.

## 3. Points de doctrine à graver

Le smoke et le canary prod *lisent* la prod via l'application (requêtes HTTP, compte de service identifiable, périmètre read-only, nettoyage derrière eux) — jamais via gitops, jamais avec un token d'écriture. La règle « aucun agent n'écrit vers la production » reste intacte au sens infra ; cette précision entre dans GOVERNANCE.md §6.

Deuxième amendement assumé : l'agent MEP exige un token `contents:write` sur vermeer-gitops-prod, **limité aux branches** — main reste inatteignable grâce au ruleset régularisé (chantier 2). La protection passe du token au ruleset ; c'est solide uniquement dans cet ordre.

Troisième amendement assumé : la désignation automatique (§2.1). Le principe de sûreté ne repose plus sur « qui désigne » mais sur « qui merge » — et ça, c'est l'humain, toujours. Conséquence pratique : la relecture des PRs devient l'unique contrôle qualité humain de la boucle continue ; elle se fait avec d'autant plus de soin que personne n'a relu l'issue en amont.

## 4. Gouvernance — GOVERNANCE.md, sept étages

La source de vérité prescriptive (chantier 3). Chaque pouvoir d'agent traverse sept étages pour atteindre le réel : **1** identités et pouvoirs (registre des identités : tokens, scopes, stockage, expiration, permis/interdit) · **2** réveil et budget (déclencheur déclaré, max-turns, timeout, échec bruyant) · **3** proposition (PR uniquement, interdits codés et *testés* périodiquement) · **4** l'écluse (ruleset : approvals 0 + required status checks, bypass tracé en issue, réservé aux urgences) · **5** re-vérification (aucun déploiement sans vérification automatique du même niveau) · **6** observation (lecture seule, OBSERVED/INFERRED/UNKNOWN, cadre étendu aux nouvelles capacités) · **7** boucle de correction (incident de gouvernance = bug ; revue mensuelle 30 min ; coupe-circuit documenté pas à pas). La désignation automatique du triage entre à l'étage 2 (réveil déclaré, budgets) et à l'étage 7 (ses ratés — faux positifs labellisés, boucles stoppées au plafond — sont des incidents de gouvernance à transformer en règles).

## 5. Feuille de route — état réel au 31/07/2026, sous standby

> **Cette section a été réécrite le 31/07/2026.** Elle annonçait « sept chantiers dans l'ordre des dépendances » — et en listait huit. Surtout, elle décrivait une trajectoire qui n'est plus la vraie : le projet est **en standby**, trois chantiers sont **gelés par décision**, un est **absorbé de moitié** par ce qui a été livré, et une mission a été **abandonnée**. Ce qui suit dit ce qui est, pas ce qui était prévu.
>
> Un chantier gelé n'est pas un chantier en retard : c'est une décision datée, avec ce qui tient sa place. Un texte qui laisserait croire à un plan en cours serait plus nuisible qu'un texte qui dit « gelé ».

### Livré

| # | Chantier | État |
|---|---|---|
| **1** | **Hygiène** | ✅ 29/07/2026 — trois jetons exposés régénérés |
| **2** | **Ruleset `gitops-prod`** | ✅ 29/07/2026 — écluse de production en vigueur |
| **3** | **`GOVERNANCE.md` + registre des identités** | ✅ 29/07/2026, tenus à jour depuis |
| **4** | **Hermes greffier + triage désignateur** | ✅ **socle livré** 29-31/07/2026 : six garde-fous câblés, test de garde `qa-triage-replay.yml` **vert** (premier rejeu OBSERVED 31/07). Les **extensions** prévues sont **gelées** (voir ci-dessous) |
| **5** | **Vérification prod** | ✅ **livré 31/07/2026, phases 1 et 2.** Comptes de service staging (**13a**) et production (**13b**) vivants ; `QA_STORAGE_STATE` et le PAT en écriture sur les secrets **éteints** ; sonde de production avec cron quotidien, verdict, nettoyage vérifié et **canal d'alerte prouvé** |

### Gelé — par décision, pas par oubli

| # | Chantier | Décision | Ce qui tient sa place |
|---|---|---|---|
| **7** | **Agent MEP** | 🔴 gelé | [`RUNBOOK-MEP-MANUEL.md`](RUNBOOK-MEP-MANUEL.md). Le jeton branches-only **n'a jamais été créé** : `vermeer-gitops-prod` ne porte donc **aucun secret**, et l'invariant « aucun agent n'écrit vers la production » se lit dans l'infrastructure elle-même. Le **Dossier MEP** n'existe pas : la trace d'une MEP est la PR du digest, et son issue d'incident en cas de bypass |
| **8** | **Agent comm'** | 🔴 gelé | rien. Les communications de release restent manuelles |
| **4+** | **Extensions du triage** | 🔴 gelées | le socle livré suffit au régime de standby, où il n'y a pas de flux de rouges à trier |

### Absorbé, réduit, abandonné

**Chantier 6 — migration des crons Hermes : absorbé de moitié, et amputé du reste.**

| Mission prévue | Devenu |
|---|---|
| Canary providers prod (un appel minimal par provider, compte dédié) | ✅ **livré par la sonde unifiée** du chantier 5 — `prod-sonde.yml`, cron quotidien, un seul code pour le canary *et* le smoke post-MEP. Le chantier 6 n'a plus à le porter |
| Scan de nuit quotidien (Loki) | ❌ **abandonné**, pas reporté. Il supposait un flux de développement continu à surveiller ; sous standby il n'a rien à scanner, et son coût de maintenance serait payé pour du bruit. À ré-instruire de zéro si le besoin revient — ne pas le déterrer tel quel |
| Check de drift hebdomadaire staging ↔ prod (diff `librechat.yaml` + `configEnv`) | 🟡 **au backlog, avec son motif** : l'écart entre commité et déployé est réel et déjà connu — il est tracé dans [`CONFIG-DRIFT.md`](CONFIG-DRIFT.md), et la clôture du 31/07 y a corrigé une affirmation fausse sur `balance`, valable dans **les deux** environnements. Un check automatique serait utile ; il n'est pas urgent tant que la configuration ne bouge pas, ce qui est le cas sous standby. Condition de reprise : la configuration redevient mouvante |

**Coupe-circuit du §7 : au backlog, avec son motif.** Il suppose un dispositif en fonctionnement continu à interrompre. Sous standby, ce qui tourne se compte sur les doigts d'une main et se désarme à la main en désactivant deux workflows — un coupe-circuit outillé serait un mécanisme de plus à maintenir pour un geste qui prend deux minutes. Condition de reprise : le réveil du développement quotidien, c'est-à-dire le moment où plusieurs acteurs tournent de nouveau sans surveillance.

### Le backlog, qui ne dépend de rien ci-dessus

Vague 2 de la QA (voir §6) · config auto-reload · relance Loki staging côté infra (`GATEWAY_TIMEOUT` + rétention) · nettoyages post-MEP · WEB-01/#114 · dette CI #86.

**Les dettes ouvertes du dispositif** — noyau partagé, déduplication divergente des alertes, jeton orphelin non instruit, `addTitle` hors verdict, `BAN_VIOLATIONS` et Redis UNKNOWN, interdits du triage vivant dans un prompt, contrôle Loki reporté, `401` Grafana staging — sont rassemblées, chacune avec son motif et sa condition de levée, dans [`DETTES-OUVERTES.md`](DETTES-OUVERTES.md).

**Pour reprendre après standby** : [`RUNBOOK-REVEIL.md`](RUNBOOK-REVEIL.md), dont le premier geste est de **vérifier le canal d'alerte** — un silence de la sonde ne prouve rien tant que sa voix n'a pas été vérifiée.

## 6. QA — actualisation post-v0.10.23

**Principe directeur** (déjà éprouvé avec la dette CI #86) : *un cas qui échoue en permanence n'apporte aucun signal* — il transforme le verdict déterministe en bruit et habitue l'œil au rouge. Avec la désignation automatique (§2.1), ce principe devient une exigence de fonctionnement : chaque rouge non tracé déclenche désormais du travail d'agent. Le filet doit être vert quand le produit tient ses promesses réelles, rouge quand il les casse — et chaque rouge doit mériter la machine qu'il met en marche.

**Cas « recherche web d'assistant »** — état constaté : le cas échoue systématiquement sur l'absence de citations de sources, alors que la fonctionnalité rend bien des réponses sourcées depuis Internet. Le test vérifie une promesse (l'affichage des citations) qui relève du défaut connu WEB-01/#114, pas du service rendu. Décision :
- **Scinder le cas en deux.** Cas A « réponse web sourcée » (P0, @wave1) : vérifie ce que le produit promet réellement aujourd'hui — la réponse s'appuie sur des résultats web et le mentionne. Doit être vert ; s'il rougit, il déclenche la boucle automatique. Cas B « citations affichées » : tagué `@known-issue-114`, **exclu du verdict P0 et de la désignation automatique**, documenté dans le Dossier QA avec renvoi à l'issue. Il réintègre @wave1 le jour où WEB-01 phase 2 (observabilité puis fix) livre.
- Règle générale, à graver dans le manuel QA : tout cas rouge doit être soit un bug qui déclenche la boucle (→ triage → label → agent), soit un défaut connu tracé (→ tag `@known-issue-N`, hors verdict et hors déclenchement) — jamais un rouge d'habitude.

**Vague 2 — enrichissement** (issue à ouvrir) : épinglage de conversations · catégories marketplace + filtre « Mes assistants » · drag & drop builder · **+ le cas A ci-dessus refondu** · candidats issus de la MEP : bloc summarization, consigne mémoire. Objectif inchangé : l'humain ne garde que l'exploratoire et le multi-comptes (recette manuelle → 20 min).

## 7. Invariants — ce qui ne bougera jamais

Aucun merge automatique. Aucun cron sur l'agent MEP. La prod hors d'écriture infra pour tout agent. Une issue sans label dort — et seuls deux acteurs posent des labels : Loïse (via Hermes) et le triage (régressions QA, sous les garde-fous du §2.1). Le verdict est un code de sortie, pas une opinion. Les incidents de gouvernance deviennent des règles. Et l'écluse, c'est Loïse.

## Annexe — Workflows formalisés (portes de décision et acteurs)

*Représentation canonique des circuits, validée le 29/07/2026. Les schémas SVG correspondants vivent dans `docs/schemas/`. Convention : ⚿ = écluse humaine · ◇ = porte de décision automatique.*

### A. Désignation — qui pose un label
- **Voie humaine** : Loïse → Hermes (« dev X » / « fix Y ») → réflexe de cadrage (2-3 questions : comportement attendu, emplacement UI, critère d'acceptation) → Hermes crée l'issue labellisée (`claude-fix` ou label config).
- **Voie automatique** : QA rouge (nightly 6h30 ou post-train) → triage instruit avec preuves → ◇ **Bug prouvé ?** (verdict bug/test/infra, jamais sur un doute ; test et infra → dossier instruit, pas de label) → ◇ **Connu ou ≥ 2 essais ?** (cas `@known-issue-N`, issue existante — déduplication par signature d'échec, il commente au lieu de dupliquer — ou 2 PRs déjà échouées → pas de label, notification à Loïse) → sinon : label posé automatiquement.
- Invariant : deux désignateurs et deux seulement — Loïse (via Hermes) et le triage (régressions QA, sous ces deux portes).

### B. Exécution — boucle continue dev + staging
Issue labellisée → agent codeur (vermeer-text) ou agent config (vermeer-gitops, interdits : tags d'image, prod) : cause racine → PR argumentée → ⚿ **MERGE Loïse** (seul geste humain du circuit) → release train (build ECR `sha-<7>`, bump dev + staging) + Flux applique → QA post-train (12 cas P0, verdict = code de sortie) → ◇ **Verte ?** — oui : livré, journal Dossier QA #112 · non : retour triage (voie automatique du A, plafond 2 tentatives).

### C. Voie MEP — préparation
Loïse : « Prépare la MEP » → Hermes dispatch (workflow_dispatch, jamais de cron) → agent MEP → ◇ **Préconditions réunies ?** (dernière QA train verte + canary du matin vert + aucun incident ouvert — un seul manque : STOP motivé, rien n'est créé) → tag + digest en PR sur vermeer-gitops-prod (doctrine des digests du 28/07, état des lieux, arbitrages soumis, puis STOP) → checks automatiques = required status checks du ruleset → ◇ **Conformes ?** (diff strictement dans le périmètre annoncé, YAML valide, QA verte — non : le ruleset bloque physiquement le bouton merge) → ⚿ **MERGE Loïse**, digest relu ligne à ligne.

### D. Post-merge MEP + comm' de release
Flux déploie la prod (rolling suivi par Hermes/cron) → Point 0 automatique + smoke (compte de service, 9 points) → ◇ **Rapport vert ?** — non : retour à Loïse (fix ciblé via la boucle continue, ou rollback) · oui : agent comm' → delta calculé (git log --oneline entre tags + diff du digest — jamais de mémoire) → PR deck fonctionnalités + CHANGELOG.md → ⚿ **MERGE Loïse** (relecture éditoriale) → note postée au Dossier Releases (notification mail native) → **Loïse annonce** (feu vert utilisateurs — toujours elle).

### E. Observation prod — lecture seule
Quatre capteurs : scan de nuit (cron quotidien) · canary prod (un appel minimal par provider, compte dédié) · check de drift (hebdo, diff librechat.yaml + configEnv staging↔prod) · Hermes interactif (Mac, session sur ordre). Tous en lecture seule, tokens read-only, discipline OBSERVED/INFERRED/UNKNOWN → ◇ **Anomalie ?** — non : journal RAS horodaté · oui : issue instruite **sans label** + notification → Loïse pose le label (voie A) ou laisse dormir. L'observation ne désigne jamais.

### Table des acteurs
Loïse : trois ordres (dev/fix, MEP, annonce), trois merges (PR code/config, digest MEP, comm') · Hermes : greffier d'issues, dispatcher MEP, capteur interactif · Triage : second désignateur, borné par ses deux portes · Agents codeur/config : de l'issue à la PR, jamais au-delà · Agent MEP : jusqu'à la PR de digest, STOP · Agent comm' : jusqu'à la PR de deck, STOP · Train, Flux, QA, Point 0, smoke, crons : machinerie déterministe entre les écluses. Aucune case rouge n'est une impasse : chacune revient soit à la boucle continue, soit à Loïse.

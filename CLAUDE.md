# Vermeer Chat — Mémoire projet

Mémoire institutionnelle du projet Vermeer Chat, à destination de tout nouveau lecteur (humain ou IA). Ce fichier est **stratégique** : contexte, stack, conventions, décisions, garde-fous, état d'avancement. Il ne contient pas l'historique détaillé des décisions et conversations — celui-ci est tracké sur Notion.

Dernière mise à jour : 2026-06-09
Dernière passe : mémoire-assistant partagée (approche B) mergée sur `main` + consolidation de la watchlist mémoire §11 (trois chantiers mémoire désormais mergés, fichiers natifs en watchlist active), décision étanchéité cross-BU de la mémoire partagée §5.3, transition de la propriété déploiement (départ progressif d'Oussama) §3.

La Partie 1 ci-dessous couvre le projet Vermeer. La [Partie 2](#partie-2--conventions-techniques-librechat) reprend les conventions techniques LibreChat (workspaces, code style, tests) — à lire après le contexte projet.

## Sommaire (Partie 1)

1. Vue d'ensemble
2. Stack technique
3. Équipe et rôles
4. Conventions de code et de workflow
5. Décisions architecturales clés
6. Garde-fous
7. État actuel V1
8. Roadmap V1 / V2 / V3
9. Limitations connues et travaux en cours
10. Documentation et ressources externes
11. Risques techniques connus
12. Déploiement et CI/CD

---

## 1. Vue d'ensemble

Vermeer Chat est un **fork de LibreChat (base v0.8.5)** adapté pour un usage interne agence. Ce n'est pas un produit développé de zéro : on étend LibreChat upstream en personnalisant l'UX, le design et la configuration, et en activant progressivement les capacités natives.

- **Pour qui** : les équipes **BETC Fullsix** et **POP** (Proseonpixels). Les utilisateurs sont organisés en 2 groupes BETC et POP au sein d'une instance unique (voir décision 5.3).
- **Promesse produit** : un assistant IA d'entreprise premium, francisé et orienté métier agence, donnant accès aux modèles Anthropic et OpenAI dans un cadre authentifié et sécurisé, avec agents, mémoire et recherche de fichiers.

Le repo a deux remotes : `origin` (Vermeer) et `upstream` (LibreChat officiel). On rebase/merge depuis `upstream` pour suivre les versions amont.

## 2. Stack technique

- **Backend** : Express (`/api`, JS legacy à toucher au minimum) + packages TypeScript (`packages/api`, `packages/data-schemas`, `packages/data-provider`). Dépendance majeure `@librechat/agents`.
- **Frontend** : SPA React/TypeScript (`/client`) + `packages/client`. i18n via `useLocalize()`.
- **Auth** : email/mot de passe. SSO/social login désactivés (`ALLOW_SOCIAL_LOGIN=false`, `registration.socialLogins: []`). Inscription ouverte en dev (`ALLOW_REGISTRATION=true`).
- **Base de données** : MongoDB (`mongodb://127.0.0.1:27017/LibreChat` en local). Recherche full-text via Meilisearch.
- **Stockage fichiers** : S3 (`fileStrategy: "s3"`, bucket AWS `eu-west`). Azure Storage également configuré.
- **Modèles consommés** (via `.env`) :
  - Anthropic : `claude-opus-4-6`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`
  - OpenAI : `gpt-5.2`, `gpt-5.1`, `gpt-5-mini`, `gpt-4o`
  - Endpoint custom `French Models` (Featherless) défini dans `librechat.yaml`.

### Lancer le projet en local

Prérequis : Node.js (v20.19+ / v22.12+ / >=23) et MongoDB. Sur macOS, MongoDB s'installe via Homebrew (`brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`).

```bash
npm run backend:dev     # backend Express avec watch (port 3080)
npm run frontend:dev    # frontend Vite/HMR (port 3090, requiert le backend)
```

Backend : `http://localhost:3080/`. Frontend dev : `http://localhost:3090/`. Le détail des commandes de build et la structure des workspaces sont en Partie 2.

## 3. Équipe et rôles

Interlocuteurs directs côté technique :

- **Loïse Toscer** — PMO du projet, pilote produit + app builder. Écrit le code en collaboration avec Claude Code.
- **Antoine** — directeur Studio IA, pilote l'architecture technique. Valide les décisions structurantes (config, déploiement, choix d'archi) ; c'est lui qui valide les choix techniques de fond.

Contributions ponctuelles à venir :

- **Adilet** — dev POP, viendra en renfort sur le Credit Management (V2).
- **Oussama** (sous **Aurélie**) — dev POP, a piloté le branchement du déploiement staging/prod ; se désengage progressivement. La propriété du déploiement (staging/prod, gitops) est en cours de passation. Un nouveau développeur est en onboarding pour reprendre ce périmètre — nom et rôle exacts à préciser une fois confirmés.

Les autres intervenants (UX, chefferie de projet, business, PMO BETC, documentation) relèvent du pilotage humain de Loïse et ne concernent pas le travail technique.

## 4. Conventions de code et de workflow

- **Branches** : `main` côté `origin`. Le build d'image se déclenche sur push de n'importe quelle branche (tag d'image dérivé du nom de branche, cf. §12).
- **Environnements** : **4 environnements** avec auth distincte, chacun avec son dossier dans le gitops (`alpha/llm/`, `staging/llm/`, etc.).
  - **alpha** : grosses features / intégrations en cours, auth **Keycloak interne** (LibreChat y tourne actuellement) ; le gitops alpha pull l'image `feat-build`.
  - **dev** : développement.
  - **staging** : test / QA, auth **SSO Havas + BETC** ; cible du beta-test des key users BETC.
  - **prod** : production.
- **Release / déploiement** : l'image Docker est buildée/poussée sur **ECR** via OIDC. Procédure complète en [section 12](#12-déploiement-et-cicd).
- **Commits** : convention `type(scope): sujet` en français (ex. `feat(ux/agents): …`), corps détaillé en français expliquant le pivot et les hors-scope, signature `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Méthode de travail** : approche **Phase 1 (investigation) → Phase 2 (plan) → Phase 3 (exécution)** avec validation explicite entre chaque phase pour tout chantier conséquent (voir garde-fou dédié section 6).
- **Design system Vermeer V1** : dark mode global par défaut (forcé via `FORCE_VERMEER_DARK=true`), accent rouge Vermeer `#E5384A` (hover `#C52838`), fond noir principal `#0A0A0B` (`--surface-primary`) avec surfaces anthracite `#141416` / `#1A1A1C`. Variables définies dans la section `.dark` de `client/src/style.css`. Valeurs V1 best-guess, à raffiner en atelier specs avec Antoine.
- **Posture éditoriale** : premium, registre « atelier d'art ». Wordings francisés et orientés métier agence. L'IA parle à la première personne (« Comment veux-tu que je t'appelle ? »).
- **i18n FR** : depuis le retrait de Locize, les traductions FR sont ajoutées manuellement par CC après validation terminologique par le PMO. Procédure complète : voir Partie 2 → Localization.
- Les conventions de code détaillées (nommage, typage, imports, perf) sont en Partie 2 et s'appliquent intégralement.

### Helpers & patterns partagés Vermeer

Quatre conventions à respecter pour toute nouvelle feature touchant budgets / analytics / mise en page composer.

1. **`currentMonthStartUTC()` — début du mois courant en UTC** (helper exporté de `packages/data-schemas/src/methods/transaction.ts`). Utilisé par 4 méthodes : `aggregateMonthlyUsage`, `aggregateUsageByModel`, `getUserBudget`, `getAllBudgets`. **Règle** : toute nouvelle méthode qui calcule le début du mois courant UTC DOIT importer et appeler ce helper. Ne JAMAIS reconstruire avec `new Date(Date.UTC(...))` à la main. Réf : commit `635651451`.

2. **`budgetColor(ratio)` — couleurs cohérentes pour toute jauge budget** (helper exporté de `client/src/components/Admin/credits.ts`). Retourne `{bg, text, bar}` selon le ratio `consommé / budget`. **Règle** : toute jauge, barre de progression ou indicateur visuel de budget DOIT utiliser ce helper pour garder une cohérence de couleurs cross-features. Actuellement utilisé par : admin Seuils (table de progression), BudgetCard user-facing (barre sous le composer).

3. **Pattern responsive du composer** — Le wrapper `ChatForm` utilise `md:max-w-3xl xl:max-w-4xl sm:px-2`. **Règle** : tout composant qui doit s'aligner visuellement avec le composer (BudgetCard sous la barre, SuggestionGrid au-dessus, etc.) DOIT répliquer exactement ces classes pour garder l'alignement bord-à-bord à toutes les tailles d'écran. Réfs : commits `e5959eac2`, `b8994e2e1`.

4. **Convention BU casing — toujours en majuscules côté UI** — Côté UI et côté types frontend, les BU sont toujours en majuscules : `'POP'`, `'BETC'`, `'Other'`. **Jamais** en minuscules. `'Vermeer'` n'apparaît pas côté UI (le mapping backend dans `buExpression` peut produire `'Vermeer'` à partir de `tenantId`/email, mais ce n'est pas exposé). Le filtre admin Analytics a 4 valeurs : `'all'`, `'POP'`, `'BETC'`, `'Other'`. Cohérent avec les clés i18n `com_usage_filter_bu_pop/betc/other`.

## 5. Décisions architecturales clés

Chaque décision est donnée au format **Décision → Pourquoi → Conséquence pratique**.

**5.1 Extension de LibreChat plutôt que développement from-scratch**
- Pourquoi : environ 50 % des fonctionnalités visées (dont le credit management) sont déjà natives dans LibreChat.
- Conséquence pratique : pour tout nouveau besoin, vérifier d'abord ce qui existe nativement dans LibreChat upstream avant d'envisager du custom.

**5.2 Credit management via le système natif LibreChat**
- Pourquoi : LibreChat fournit déjà `balance`, `autoRefill`, le tracking de tokens et le hard block ; réimplémenter serait redondant et risqué.
- Conséquence pratique : activer et configurer `balance`/`transactions` dans `librechat.yaml` plutôt que développer un module de crédits maison.

**5.3 Une instance unique avec 2 groupes BETC / POP + config overrides natifs**
- Pourquoi : LibreChat v0.8.5 fait nativement de la séparation par Groups + config overrides DB-backed. Une seule infrastructure à maintenir, partage cross-BU possible, users multi-BU possibles, trajectoire alignée sur le natif v0.8.5. (Révise la décision initiale « 2 environnements distincts ».)
- Conséquence pratique : ne pas déployer 2 environnements distincts ; utiliser les Groups et config overrides via l'Admin Panel ClickHouse en V2. L'étanchéité des données BETC vs POP est à valider rigoureusement avant déploiement.
- **Décision actée — étanchéité BU vs mémoire-assistant partagée** : la **mémoire-assistant partagée** (approche B, §11) peut voyager **cross-BU** (BETC ↔ POP) **par design**. Elle hérite de la portée de l'assistant — comme les `instructions` et le knowledge (`tool_resources`) — et circule via l'ACL de l'agent au partage explicite. Ce n'est **pas** une fuite : c'est de la curation propriétaire portée par un partage volontaire de l'assistant. En revanche, la **mémoire perso** (par utilisateur, `MemoryEntry` scopée `userId`) reste strictement user-scoped et ne traverse **jamais** ni les utilisateurs ni les BU.

**5.4 Recherche web native des providers (param `web_search` LLM), pas le pipeline tiers LibreChat**
- Pourquoi : il s'agit de la web search **native** des providers (mécanisme natif Anthropic / OpenAI Responses API / Google Grounding), distincte du pipeline tiers LibreChat (Serper/Firecrawl/Jina). On évite la dépendance et le coût des services tiers côté utilisateur.
- Architecture cible — double exposition : (a) web search native providers en toggle utilisateur (livrée V1 dans le panel Paramètres) ; (b) pipeline LibreChat conservé mais **gating ADMIN uniquement**, accessible en paramètres avancés via l'Admin Panel en V2.
- Conséquence pratique : pas de clés tierces (Serper/Firecrawl/Jina) ajoutées en V1 ; Tavily déjà présent reste actif en `.env` mais **inaccessible aux utilisateurs en V1** ; les utilisateurs accèdent à la native via le toggle du panel Paramètres pour Claude et GPT (gated sur endpoints custom).

**5.5 Deux niveaux d'agents : L1 vs L2**
- Pourquoi : distinguer un assistant qui **produit du texte** (L1) d'un agent qui **agit via des outils** (L2) clarifie le périmètre fonctionnel et la roadmap.
- Conséquence pratique : V1 cible le L1 ; le L2 (action via outils) est planifié pour V2 via Codeur (voir roadmap).

**5.6 Système d'admin natif LibreChat plutôt que feature flags hardcodés — trajectoire en 2 temps**
- Pourquoi : les flags `SHOW_*` qui ont un équivalent natif sont des raccourcis temporaires ; l'admin natif (permissions, capabilities) est la voie pérenne et configurable sans redéploiement.
- Trajectoire actée : **V1 (3 juin)** — revert progressif des flags concernés vers le yaml `interface` (étape intermédiaire propre mais legacy upstream). **V2 (mi-juin)** — bascule vers l'**Admin Panel ClickHouse** (service séparé à déployer), cible vraie pour gérer permissions par rôle/groupe avec config overrides DB-backed.
- Conséquence pratique : pour le revert des flags (sujet 2 du retroplanning), appliquer la trajectoire standard V1 yaml + V2 Admin Panel. Seuls les flags à équivalent natif sont concernés (cf. garde-fou §6 et inventaire §7).

## 6. Garde-fous (NE JAMAIS faire sans validation explicite)

Chaque règle est suivie d'un exemple concret de ce qu'il faut éviter.

- **Ne pas pousser sur `main` sans review.** Éviter : `git push origin main` directement après un commit local non relu.
- **Ne pas commit le `.env`.** Éviter : `git add .env` — il contient les clés API (Anthropic, OpenAI, AWS, etc.). Le template versionné est `.env.example`.
- **Ne pas mettre de clés API en clair dans un fichier versionné.** Éviter : coller une clé dans `librechat.yaml` au lieu d'utiliser une variable `${NOM_VAR}`.
- **Ne pas modifier la structure des collections MongoDB existantes** (User, Transactions, Conversations, Messages, Agents). Éviter : renommer/supprimer un champ de `User` — cela casse la migration des données depuis la prod existante.
- **Ne pas ajouter de feature flags hardcodés qui ont un équivalent admin natif.** Si la doc LibreChat propose un toggle équivalent (yaml `interface` ou Admin Panel), reverter/utiliser le natif est **obligatoire** (ex. items sidebar, toggles UI, permissions de feature). Éviter : `const SHOW_NEW_THING = false` pour masquer une feature gérable nativement. **Ne vise PAS** les flags de branding/cosmétique sans équivalent natif (ex. `FORCE_VERMEER_DARK`, `SHOW_LANDING_SUGGESTIONS`, `SHOW_LEGACY_COMPOSER_MENUS`), qui restent légitimement en code et doivent être documentés.
- **Ne pas casser le système d'admin natif LibreChat.** Éviter : court-circuiter une permission (`hasAccessTo…`) par un flag ou une condition en dur.
- **Méthode Phase 1 / 2 / 3 obligatoire pour tout chantier > 50 lignes de code.** Éviter : se lancer dans l'implémentation sans investigation ni plan validé.

## 7. État actuel V1 (refonte UX)

Base LibreChat v0.8.5, HEAD `a98a8d6cd`. La refonte UX V1 est livrée via les commits structurants suivants (12–27 mai 2026) :

- `a3315c1a6` — design system Vermeer : dark mode + accent rouge.
- `cb73a8f7d` — Skills : francisation + bouton « + » scindé en « Créer » / « Importer ».
- `f3a5219c6` — sidebar : items Prompts et MCP masqués via feature flags.
- `daba3523a` — panel Paramètres « light » : sections + tooltips + accordéon avancé.
- `5042144da` — modale Créer une mémoire : vocabulaire humain (Claude-pur).
- `0c91ee7ea` — agents : « Constructeur d'agents » → « Mes agents » + accès Marketplace.
- `57cad180f` — builder agent : réordonnancement + zone d'upload unifiée sous Instructions.
- `a2d14b36d` — picker de modèle : section « Agents » retirée (sélection via le panel « Mes agents »).
- `ca79924db` — landing : 4 cartes de suggestions orientées usages agence.
- `22519dd92` — ajout du CLAUDE.md projet (mémoire institutionnelle).
- `a98a8d6cd` — web search native exposée dans le panel Paramètres pour Claude et GPT, gated sur endpoints custom.

**Couverture des features upstream** (`librechat.yaml`) : activées — agents, marketplace, fileSearch, fileCitations, memory, peoplePicker, presets, prompts, bookmarks, multiConvo, speech (TTS/STT). Non activées — `balance` et `transactions` sont **présents nativement mais laissés commentés en config** ; le système de crédits natif est donc disponible mais pas encore branché (point à acter en V1, voir section 8).

**Feature flags hardcodés — inventaire (audit CC)** : 10 noms distincts / 12 déclarations recensés à l'origine ; après le revert de `a98a8d6cd`, 9 noms / 11 déclarations restent dans le code.

_Catégorie A — équivalent admin natif → à reverter (trajectoire 5.6 : V1 yaml `interface` + V2 Admin Panel). 5 noms / 6 déclarations :_
- `SHOW_PROMPTS_SIDEBAR_ITEM` (`hooks/Nav/useSideNavLinks.ts`)
- `SHOW_MCP_SIDEBAR_ITEM` (`hooks/Nav/useSideNavLinks.ts`)
- `SHOW_PRESETS_BUTTON` (`Chat/Header.tsx`)
- `SHOW_WEB_SEARCH_TOOL` ×2 (`Chat/Input/ActiveToolChips.tsx`, `ToolsMenu.tsx`) — pipeline tiers, cible gating ADMIN (cf. 5.4)
- ~~`SHOW_USER_WEB_SEARCH_SETTING`~~ — **reverté dans `a98a8d6cd`** (web search native exposée) ; il reste donc 4 noms / 5 déclarations à traiter en catégorie A.

_Catégorie B — branding/cosmétique, sans équivalent natif → restent légitimement en code, à documenter. 5 noms / 6 déclarations :_
- `FORCE_VERMEER_DARK` ×2 (`App.jsx`, `General.tsx`)
- `SHOW_LANDING_SUGGESTIONS` (`Chat/Landing/SuggestionGrid.tsx`)
- `SHOW_LEGACY_COMPOSER_MENUS` (`Chat/Input/ChatForm.tsx`)
- `SHOW_AGENT_VARIABLES_BUTTON` (`SidePanel/Agents/Instructions.tsx`)
- `SHOW_AGENT_ID` (`SidePanel/Agents/AgentConfig.tsx`)

### V1.5 — Credit management & budgets (livré sur main depuis le 29 mai)

HEAD actuel : 4eef9d165.

Features livrées (commits clés) :
- **Admin Seuils & gestion** (55dbf9028 → a8c814f5d → dabb03d73 → 21a26bda6) : nouveau schéma Balance avec monthlyBudget/monthlyBudgetBaseline, routes API admin/budgets, UI onglet Seuils & gestion, modale d'édition, tous users listés (même sans transactions).
- **Analytics admin enrichi** (648f5721c → 72fa04597 → fb7e48421 → 4899e1d8a → 48e8af0bf → 2a5ffe966 → 644d9cd30 → 6df2e7268 → f69060100) : page Consommation MVP, scission Analytics/Seuils, 4 KPI cards, filtres BU, segmentation par intensité, agrégation Model Mix backend, UI Model Mix donut+tableau, User details collapsible + export CSV.
- **Jauge BudgetCard user-facing** (7c5fd9bad → 276ba7a49 → 7772bf0f5 → 601b5f753 → 77208a80f → e5959eac2 → b8994e2e1) : enrichissement /api/balance avec currentMonthSpend, refetch SSE, BudgetCard sous le composer alignée + responsive, FR + EN.
- **Dettes techniques résorbées** (635651451 → 7fd9af216 → 6068ec993 → 4eef9d165) : DRY currentMonthStartUTC dans getAllBudgets, i18n FR complète admin Seuils (27 clés) + Analytics (40 clés), accord pluriel USD consommés.

État déploiement : main est à 4eef9d165 ; **preprod en attente de mise à jour côté Oussama** (image Docker / variables d'env à vérifier). Démo Jonathan/Yvan/Eugénie planifiée après validation preprod.

## 8. Roadmap V1 / V2 / V3

- **V1 — mercredi 3 juin 2026** : premier déploiement en production + première version du credit management (acter l'activation de `balance`/`transactions` dans `librechat.yaml`).
- **V2 — mi-juin 2026** : intégration des agents L2 via Codeur (environnement sandbox de Damien/Benoit), c'est-à-dire des agents qui agissent via des outils. **Faisabilité prouvée en local (POC).** Auth code interpreter : ce build ne lit **pas** le header `LIBRECHAT_CODE_API_KEY` ; la clé est embarquée dans `LIBRECHAT_CODE_BASEURL` (userinfo de l'URL → Basic auth). Le `BASEURL` contient donc un secret → à injecter via **ExternalSecret**, jamais en clair. ⚠️ Le service hébergé Code Interpreter de LibreChat est en **fin de vie** (rachat ClickHouse) ; prévoir un backend self-hosted. Renvois : doc Notion L2 + package de déploiement K8s dans `~/vermeer-l2-deploy/k8s/`.
- **V2 — BudgetCard auto-création Balance** : créer le doc Balance automatiquement à la première transaction OU au premier login user, pour que la BudgetCard soit visible sans intervention admin préalable (limitation V1 documentée en §9).
- **V3 — à définir** : capacités agentiques étendues, refacturation interne entre BU.

## 9. Limitations connues et travaux en cours

- **Mode comparaison** : le dysfonctionnement observé venait d'une clé OpenAI invalide en local, pas d'un vrai bug applicatif.
- **Recherche web** : native exposée en V1 dans le panel Paramètres (Claude/GPT, cf. `a98a8d6cd`). Le pipeline tiers reste masqué (`SHOW_WEB_SEARCH_TOOL=false`), cible gating ADMIN en V2 (cf. 5.4).
- **RAG vs File context** : l'UX du dispatch entre recherche de fichiers (RAG) et contexte permanent reste à clarifier ; en V1, le builder agent expose une zone d'upload unifiée (RAG par défaut).
- **Feature flags hardcodés** : audit fait (10 noms / 12 déclarations à l'origine, cf. §7). Les flags à équivalent natif suivent la trajectoire 5.6 (V1 yaml + V2 Admin Panel) ; les flags branding/cosmétique restent documentés en code.
- **RAG API non opérationnelle en V1** : `RAG_API_URL` est undefined dans le `.env`. File Search est exposée dans l'UI builder agent mais l'indexation échoue silencieusement (warning dans les logs backend). À activer en V1 : lancer le conteneur RAG API (port 8000 + PostgreSQL/PGVector), définir `RAG_API_URL`, vérifier les embeddings OpenAI déjà câblés (`RAG_OPENAI_API_KEY` présent). À coordonner avec Oussama (infra Docker / déploiement).
- **Gap UX boutons d'upload** : LibreChat upstream propose 4 modes (Upload Images, Upload as Text/File Context, Upload for File Search/RAG, Upload for Code Interpreter). Vermeer V1 n'expose qu'un bouton « joindre un fichier » (= File Context) ; les 3 autres modes sont absents de l'UI. À enrichir en V1/V1.1 pour bénéficier du RAG et du Code Interpreter une fois activés.
- **Builder agent — web search native non exposée** : l'accordéon « Recherche web » du builder pointe vers le pipeline tiers (trop technique pour les users). La native (param `web_search`, livrée V1 dans le panel Paramètres de la conversation) n'est pas exposable simplement dans le builder — upstream ne propose pas de capability « web search native » au niveau agent. Sujet V1.1+ : investiguer le stockage de `web_search` dans la config d'un agent + exposition builder (chantier custom potentiellement non trivial).

- **BudgetCard user-facing — V1** : visible uniquement pour les users ayant un document Balance en base. Comme le bloc `balance` est commenté dans librechat.yaml, la Balance n'est PAS créée à la première transaction. Workaround V1 : un admin doit éditer un seuil pour le user (onglet Seuils & gestion), ce qui crée le doc Balance et débloque l'affichage. Comportement contre-intuitif, à mentionner lors des démos. Backlog V2 : voir §8.

## 10. Documentation et ressources externes

- Doc LibreChat upstream : https://www.librechat.ai/docs
- Token usage : https://www.librechat.ai/docs/configuration/token_usage
- Notion projet (privé) — historique détaillé des décisions et conversations.
- Documentation utilisateur Vermeer Chat V1 (document Word, en cours, par Nolan).

## 11. Risques techniques connus

- **Fail-fast yaml** : toute erreur de validation dans `librechat.yaml` fait sortir le process en code 1 (boot cassé, pas de mode dégradé). Tester systématiquement le yaml en local avant tout déploiement prod (un yaml invalide = appli down).
- **`balance.enabled` force `transactions.enabled`** : activer le bloc `balance` réécrit automatiquement `transactions` à true quelle que soit sa valeur. Le solde a besoin de l'historique, c'est by-design.
- **Pricing en dur dans `packages/data-schemas/src/methods/tx.ts`** : les rates input/completion par modèle (`tokenValues`, `getMultiplier`) vivent dans ce fichier, pas dans le yaml. Avant d'activer la balance en V1, vérifier que les modèles utilisés (gpt-5.x, claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5) ont un rate défini, sinon la consommation n'est pas trackée (donc pas comptée dans le budget mensuel).
- **Synchro balance au login** : le solde se réaligne sur la config globale (`startBalance`) à chaque connexion. Attention à la migration des users existants — un `startBalance` global mal réglé peut écraser les soldes attendus.
- **`CREDS_KEY` / `CREDS_IV`** : présents dans le `.env`, à ne JAMAIS perdre ni régénérer lors d'une migration MongoDB. Ces clés chiffrent les credentials user en base ; sans elles, les données existantes deviennent illisibles.
- **Code natif LibreChat modifié — watchlist merge upstream**. À chaque merge depuis upstream LibreChat, contrôler ces 15 fichiers en priorité, car nous y avons ajouté du code Vermeer susceptible de conflit :
  - `api/server/controllers/Balance.js` (enrichi avec currentMonthSpend dans la réponse /api/balance)
  - `packages/api/src/middleware/checkBalance.ts` (gating réécrit Vermeer : modèle **budget mensuel** et non porte-monnaie — `canSpend = currentMonthSpend + tokenCost <= monthlyBudget`, fallback `DEFAULT_MONTHLY_BUDGET` si pas de doc Balance, payload de violation `TOKEN_BALANCE` reformulé `{ currentMonthSpend, monthlyBudget, tokenCost }` ; ne lit plus `tokenCredits`, logique auto-refill/lazy-init wallet retirée. Dep `getCurrentMonthSpend` ajoutée et câblée aux 3 call sites `BaseClient.js`/`assistants/chatV1.js`/`chatV2.js`)
  - `client/src/hooks/SSE/useSSE.ts` (retrait du gate balance.enabled sur le refetch balanceQuery)
  - `client/src/components/Chat/ChatView.tsx` (BudgetCard inséré dans le layout, gestion footer)
  - `client/src/locales/en/translation.json` (clés com_budget_* + com_usage_* ajoutées + subtitle com_usage_subtitle modifié)
  - `packages/data-provider/src/parsers.ts` (helper `applyWebSearchDefault` : web_search ON par défaut sur endpoints natifs + strip pour custom, appliqué dans `parseConvo`/`parseCompactConvo`. **Ajout** : prédicat exporté `isNativeWebSearchEndpoint(endpoint)` sur le set `nativeWebSearchEndpoints` — source unique réutilisée par le miroir agent-path côté `packages/api/src/agents/initialize.ts` ; `applyWebSearchDefault` consomme désormais ce prédicat pour `isNative`. Ne pas dupliquer le set en dur : les deux chemins doivent rester synchronisés.)
  - `packages/data-provider/src/schemas.ts` (`anthropicSettings.web_search.default = true` ; le champ `web_search` reste `.optional()` volontairement, le défaut est appliqué au runtime côté parsers ; **aussi** `shared_memory: []` ajouté à `defaultAgentFormValues` pour la mémoire-assistant partagée, cf. watchlist mémoire ci-dessous)
  - `packages/data-provider/src/parameterSettings.ts` (`openai`/`google` `web_search.default = true`)
  - `packages/api/src/endpoints/google/llm.ts` (**garde thinkingConfig par modèle — ne pas émettre pour flash-lite sur défauts** ; fix 400 Google QA v0.10.22, wagon v0.10.23). Dans la branche `!isGemini3Plus`, deux régimes (les valeurs `thinking`/`thinkingBudget` peuvent venir des défauts du schéma `true`/`-1` OU être **persistées** sur d'anciennes conversations/presets d'avant le retrait des toggles UI) : (a) `isNoThinkingModel = /gemini-(1\.5|2\.0)/i` → **omission pure** de `thinkingConfig`, quelle que soit la source (ces familles ne supportent pas thinking ; un clamp émettrait un thinkingConfig → 400 résiduel) ; (b) `isThinkingLimitedModel` (flash-lite 2.5) → on N'ÉMET PAS quand `thinking`/`thinkingBudget` viennent des défauts (`options.modelOptions?.thinking`/`thinkingBudget === undefined`), et sur valeurs explicites (persistées / toggle ré-exposé) → clamp défensif `[512, 24576]`. Cause : les toggles thinking retirés de l'UI → défauts (`true`/`-1`) toujours envoyés, et `thinkingBudget: -1` rejeté en 400 INVALID_ARGUMENT par Vertex sur `gemini-2.5-flash-lite` (thinking OFF par défaut, plancher 512). La branche Gemini 3+ et les autres 2.5 (pro, flash) sont **inchangés** (`effectiveThinkingBudget === thinkingBudget`, `shouldEnableThinking` identique à l'upstream). Ne pas retirer cette garde sans ré-exposer un toggle thinking capable de désactiver/borner le budget. **Concern supplémentaire — clamp défensif params à range (fix QA n°4, volet 2 de l'issue #52)** : bloc `// Vermeer:` en fin de `getGoogleConfig` (avant le `return`) clampe `temperature`/`topP`/`topK`/`maxOutputTokens` dans `googleSettings.*.[min,max]` via `clampNumericParam` (helper partagé `packages/api/src/endpoints/clamp.ts`). **DISJOINT de la garde thinkingConfig ci-dessus** : celle-ci ne touche QUE `thinking`/`thinkingBudget`/`thinkingConfig` et clampe déjà le budget `[512, 24576]` ; le nouveau bloc ne touche QUE les 4 params de sampling (aucun double-clamp sur `thinkingBudget`, absent de la table), et est placé APRÈS la garde. Divergence assumée du pass-through upstream (tests `google/llm.spec.ts` `topK=0 → 1` adaptés). Garde `if (typeof … !== 'number') continue` obligatoire : `getGoogleConfig` fait `removeNullishValues` AVANT le clamp, donc réassigner une clé `undefined` la réinjecterait.)
  - `packages/api/src/endpoints/anthropic/llm.ts` (**clamp défensif params à range — fix QA n°4, volet 2 de l'issue #52 ; divergence assumée du pass-through upstream, tests adaptés**). Bloc `// Vermeer:` avant le `return` de `getLLMConfig` : clampe `temperature`/`topP`/`topK` dans `anthropicSettings.*.[min,max]` via `clampNumericParam` (helper partagé `packages/api/src/endpoints/clamp.ts`). `maxTokens` **non clampé** ici (borne spécifique au modèle via `anthropicSettings.maxOutputTokens.set` — un clamp statique serait faux). Pourquoi : upstream ne clampe pas les params de sampling (`llm.spec.ts` « above max should pass through ») → une valeur hors bornes persistée (ex. `temperature=2` réglée sous OpenAI puis basculée Anthropic, cf. #52) partait verbatim → 400 différé (cousin du fix Gemini #50). Le clamp frontend #54 ne couvre que la modale ; ce garde-fou couvre les agents pollués en base + tout chemin non-UI. Conservateur (valeurs in-bornes/undefined/NaN intactes, log `warn` Loki). Tests `anthropic/llm.spec.ts` adaptés (boundary temperature/topP/topK + edge cases large/negative/special). Ici `removeNullishValues` tourne APRÈS le clamp (dans le `return`), mais la garde `typeof … === 'number'` est conservée pour l'uniformité cross-provider. Ne pas retirer sans le volet 1 (#54) ou un clamp équivalent.)
  - `packages/api/src/endpoints/openai/llm.ts` (**clamp défensif params à range — fix QA n°4 ; divergence assumée du pass-through upstream**). Bloc `// Vermeer:` avant les `return` (placé après `if (hasModelKwargs)`, donc AVANT les deux sorties azure/non-azure) : clampe `temperature`/`top_p` dans `openAISettings.*.[min,max]` via `clampNumericParam`. Risque moindre (bornes OpenAI larges, temperature 0-2) mais symétrie cross-provider + protection des données historiques. Placé après les suppressions reasoning/search (o1/o3/gpt-5) → param retiré = `undefined` = ignoré. Garde `if (typeof … !== 'number') continue` obligatoire (`removeNullishValues`/`cleanedModelOptions` en amont). Aucun test spec OpenAI à adapter (les tests existants n'asservent que des valeurs in-bornes / empty-string).)
  - _Helper partagée (nouveau fichier Vermeer, pas du code natif — pas de risque de conflit merge, hors décompte) : `packages/api/src/endpoints/clamp.ts` (`clampNumericParam<T>(value, {min,max}, {provider,param,model})` : clampe si nombre fini hors bornes, log `warn`, laisse passer `undefined`/`null`/`NaN`). Consommée par les trois `llm.ts` ci-dessus._
  - `client/src/components/SidePanel/Agents/FileSearch.tsx` (zone d'upload « Glissez vos fichiers ici » du builder d'agent, custom Vermeer commit `57cad180f` qui a retiré la `FileSearchCheckbox` de l'UI au profit d'un `useEffect` forçant `file_search=true`. **Régression corrigée** : ce `useEffect` ne se rejouait qu'au montage et `AgentConfig` n'a pas de `key` → à la re-sélection/au rechargement d'un agent, `resetAgentForm` remettait `file_search` à `false` et le bouton d'upload restait grisé pour tout user. Fix : `agent_id` ajouté aux dépendances du `useEffect` pour ré-armer la capability à chaque changement d'agent. Comme il n'y a pas de case visible pour réactiver `file_search`, ne pas retirer ce force-true sans ré-exposer la `FileSearchCheckbox`.)
  - `client/src/components/SidePanel/Agents/AgentPanel.tsx` (`key={agent_id}` ajouté sur `<AgentConfig />` pour forcer le remontage du builder à chaque changement d'agent — complément du fix FileSearch ci-dessus : garantit que le `useEffect` force-true de `file_search` se rejoue à la re-sélection/au rechargement. L'instance `useForm` vit dans `AgentPanel` (parent), donc le remount préserve les valeurs du formulaire et ne réinitialise que l'état local des sous-composants. Ne pas retirer cette `key` sans le fix FileSearch équivalent. **Concern supplémentaire — fermeture modale au create ET update success, gatée sur `hideHeader` (fix P0 QA v0.10.22, wagon v0.10.23)** : `create.onSuccess` ET `update.onSuccess` appellent `setOpenBuilder(null)` (`useSetRecoilState(store.openBuilderModal)`) **uniquement si `hideHeader`** (contexte modale Vermeer), APRÈS le `await handleAvatarUpload` (upload avatar asynchrone porté par les deux `onSuccess`). Origine : sans fermeture au create, la modale restait ouverte et le `setCurrentAgentId(data.id)` réinjectait l'id créé dans le formulaire (refetch → `resetAgentForm`), routant la soumission suivante en `update` (écrasement silencieux du 1er assistant). Décision UX : la modale Vermeer est un wrapper one-shot, donc « Enregistrer » (update) doit fermer comme « Créer » — deux boutons de la même modale ne peuvent pas avoir deux comportements de fermeture différents. Fermer démonte le sous-arbre → réouverture vierge, pas de reset manuel. Ne PAS étendre au side-panel upstream (`hideHeader=false`, édition continue voulue).)
  - `client/src/components/SidePanel/Agents/AgentConfig.tsx` (page principale du builder d'agent, fortement customisée Vermeer). Concerns : (a) **split essentiels/avancés** — `ESSENTIAL_PARAM_KEYS = ['temperature', 'thinking', 'web_search']` rendus inline, le reste en accordéon avancé ; (b) **cleanup web_search** — `useEffect` retirant `model_parameters.web_search` sur endpoint custom (400 sinon) ; (c) **clamp params à la bascule provider (fix QA wagon v0.10.23)** — `useEffect` `// Vermeer:` qui, quand `essentialParams`/`advancedParams` sont recalculés (bascule provider/modèle), parcourt les `SettingDefinition` numériques à `range`, lit `model_parameters[key]` via `methods.getValues` (JAMAIS via le watch → pas de cascade) et clampe toute valeur définie hors `[min, max]` (`setValue(..., { shouldDirty: true })`). Corrige le pass-through upstream (temperature OpenAI 0-2 réglée à 2 → bascule Anthropic 0-1 → survivait verbatim → 400 différé à la 1re conversation, cousin du fix Gemini `google/llm.ts`). Idempotent (valeurs dans les bornes intactes, `undefined` intact, non numériques ignorés) ; tolère les états intermédiaires car les deps sont downstream de `providerValue` ET `model` (le `useEffect` de reset `model` recalcule le memo → le clamp voit les bornes du provider/modèle final). Volet 2 (clamp défensif backend, `anthropic/llm.ts`) traité séparément. Ne pas retirer ce clamp sans réintroduire une réconciliation valeur/bornes ; (d) **rules RHF maxLength Name/Description (fix QA n°10 AST-05)** — le `Controller` `name` porte `maxLength: { value: 256, message: com_ui_agent_name_max_length }` (en plus du `required` existant) et le `Controller` `description` porte `maxLength: { value: 512, message: com_ui_agent_description_max_length }` + un bloc d'erreur en miroir de celui de Name (`aria-invalid`/`aria-describedby`/`role="alert"`, id `agent-description-error`). Les `maxLength` HTML (256/512) restent la 1re ligne de défense à la saisie ; les rules RHF donnent l'erreur explicite qui manquait (le HTML tronquait en silence) et couvrent les valeurs injectées programmatiquement (édition d'un agent hors bornes créé via API). Volet backend = bornes `.max()` dans `validation.ts`. Ne pas retirer une rule sans son bloc d'erreur associé.)
  - `client/src/components/SidePanel/Agents/AgentFooter.tsx` (pied du builder d'agent, natif modifié Vermeer). Concerns : (a) **`SHOW_ADVANCED_SETTINGS = false`** — masque le bouton « Réglages avancés » (`AdvancedButton`), seul point d'entrée vers l'`AdvancedPanel` (wagon B v0.10.21) ; masquage UI seul, valeurs conservées ; (b) **bouton « discussions partagées » + fermeture modale avant navigation (fix QA n°5)** — bouton Vermeer navigant vers la route pleine page `/agents/:agentId/shared-conversations` ; le `onClick` fait `setOpenBuilder(null)` (recoil `store.openBuilderModal`) **AVANT** `navigate`, sinon la modale builder (`SectionModal` `nonModal` de `MonoSidebar.tsx`) reste montée et recouvre la vue. Fermeture **inconditionnelle** (pas de gate `hideHeader`) : no-op quand la modale est déjà fermée (side-panel upstream), aucun comportement upstream à protéger — à la différence du #49 où la fermeture touchait l'édition continue du side-panel. Même parade que le chemin logo (`AgentDetailContent` → `onRequestClose` puis `navigate`). Ne pas retirer cette fermeture sans une alternative de démontage de la modale.)
  - `client/src/components/SidePanel/Parameters/DynamicSwitch.tsx` (composant switch des params, **upstream — première modification Vermeer**, fix QA n°7 wagon rc3). Concern : **`w-fit` sur le `<Label>`**. La primitive `Label` (`@librechat/client`, `packages/client/src/components/Label.tsx`) impose `block w-full` → le `<label htmlFor>` couvrait toute la ligne et, par comportement natif du `htmlFor`, tout clic dans l'espace vide basculait le switch (clics accidentels). `w-fit` (gagne sur `w-full` via `cn`/tailwind-merge) restreint la zone cliquable au libellé ; `htmlFor` intact = clic-libellé accessible préservé ; aucun changement de layout (texte déjà `text-left`, l'espacement est géré par le grid/flex parent). Aggravation post-#61 : un clic fantôme sur « Recherche web » persistait un `false` **explicite** que le miroir runtime `web_search` respecte durablement. Composant partagé → corrige d'un coup toutes les surfaces de params (modale builder via `componentMapping` + panneau Paramètres de conversation). Ne PAS « corriger » le clic-libellé (voulu) ni modifier la primitive `Label` (ripple layout large). Même correctif appliqué au `<Label>` custom Vermeer de `MemorySwitch.tsx`. Toggles de capabilities agent (Retrieval/Artifacts/ImageVision/Code…) laissés HORS périmètre (issue de suivi d'audit).)
  - `client/src/components/SidePanel/Agents/DeleteButton.tsx` + `client/src/components/SidePanel/Agents/DuplicateAgent.tsx` (triggers icône du footer builder d'agent, **upstream modifié Vermeer**, fix QA n°8 wagon rc4). Concern : **`group` + `group-hover:text-accent-foreground` (collision remap `--accent` Vermeer)**. Les deux boutons utilisent `variant="outline"` (`packages/client/src/components/Button.tsx`) dont le hover est `hover:bg-accent hover:text-accent-foreground` ; or Vermeer remappe `--accent` (dark) vers le rouge brand `#E5384A` (`style.css`), donc le fond vire au rouge au survol. L'icône a une couleur épinglée sur le `<div>` enfant (`text-red-500` pour Delete, `text-primary` = accent pour Duplicate) qui **gagne sur le `hover:text` du parent** → icône rouge sur fond rouge = invisible (identité de couleur totale pour Duplicate). Fix : `className="group"` sur le `Button` + `group-hover:text-accent-foreground` (blanc) sur le `<div>` → l'icône passe au blanc au survol, y compris sur le padding `px-3` (le simple `hover:` sur le div ne couvrirait pas le padding). Couleur épinglée au repos conservée (branding : icône rouge sur fond transparent). Ne PAS toucher le variant `outline` partagé (`Button.tsx`, utilisé partout) ni les autres boutons destructifs de l'app (`variant="destructive"`, sains — fond `--surface-destructive` plein + `text-destructive-foreground`). **Concern supplémentaire — `DeleteButton.tsx` seul, fermeture modale au delete success (fix QA n°9 wagon rc4)** : `deleteAgent.onSuccess` appelle `setOpenBuilder(null)` (recoil `store.openBuilderModal`) **en tête**, juste après le `showToast` succès et **avant** les trois `return` anticipés (dernier agent supprimé / agent = agent de conversation / cas nominal), afin de fermer la modale dans tous les cas de sortie. Origine : le comportement upstream qui suit — `setCurrentAgentId(updatedList[0])` = « sélectionner le voisin » — est conçu pour le side-panel persistant ; en modale one-shot Vermeer il laissait la modale montée sur l'assistant voisin au lieu de revenir à la grille. **Troisième exemplaire du pattern de fermeture** (cf. `create`/`update` dans `AgentPanel.tsx` #49, discussions partagées dans `AgentFooter.tsx` #55). Fermeture **INCONDITIONNELLE** (pas de gate `hideHeader`) : no-op quand `openBuilderModal` est déjà `null` (side-panel upstream `hideHeader=false`), donc la sélection du voisin y reste préservée ; seule la modale Vermeer est affectée. Les `setCurrentAgentId`/`setConversation` exécutés après sont batchés dans le même handler (React 18) → pas d'unmount en plein callback ; `setCurrentAgentId` (useState de `AgentPanelProvider`, dans le sous-arbre démonté) ne déclenche pas de warning (batch + warning retiré en React 18), `setConversation`/`setOpenBuilder` sont des setters Recoil globaux (toujours sûrs). Ne pas retirer cette fermeture sans une alternative de démontage de la modale.

- **Mémoire (3 chantiers) — TOUS MERGÉS sur `main`, watchlist active.** Les trois chantiers mémoire sont désormais mergés et en production sur `main` ; leurs fichiers natifs passent en **watchlist active** (à contrôler à chaque merge upstream, en plus des 10 ci-dessus). Refs de merge :
  - **Mémoire perso par assistant — approche A** (POC `agentId`, commit `91a9bf6fa` + UI builder, commit `72a9f49a1`) — mergée via **PR #5** (`69263aefe`) le **2026-06-08**.
  - **Mémoire-assistant partagée — approche B** (backend+runtime `0ec14b209` + UI `373d626e3` + fix intégration form `bfab44dcc`) — mergée via **PR #6** (`6572c22b3`) le **2026-06-09**.

  **Décisions produit rappelées.** Approche A — champ `agentId` nullable sur `MemoryEntry` (`null` = mémoire globale/transverse, sinon scopée à l'assistant) ; scope déterministe (pas de décision LLM) : écritures en conversation avec un assistant réel taguées avec son id, chat par défaut (éphémère) → `null`, lecture = global ∪ assistant courant ; côté builder, entrées globales en lecture seule (badge « Global »), seules les entrées de l'assistant éditables/supprimables (badge « Cet assistant »). Approche B — 3e dimension de mémoire, **distincte** de la mémoire perso (MemoryEntry/buildReadFilter **inchangée**), stockée dans la **définition de l'agent** (`shared_memory: [{ key, value, updated_at }]`) et voyageant nativement au partage via l'ACL de l'agent ; écriture = owner/editor (droit EDIT, via le flux d'édition d'agent), lecture = tout destinataire VIEW, **jamais** d'auto-capture LLM (le memory-agent reste scopé `userId`) ; section builder réorganisée en 2 groupes (partagée au-dessus, perso en dessous) et **intégrée au FORMULAIRE d'agent** (pas de PATCH immédiat : add/edit/delete écrivent `shared_memory` via `setValue(..., { shouldDirty: true })`, persisté au Save de l'assistant). Étanchéité cross-BU : la partagée voyage cross-BU par design, la perso jamais — cf. §5.3.

  _Watchlist active — 20 fichiers natifs dédupliqués (en plus des 7 du bloc précédent). `packages/data-provider/src/schemas.ts` n'est PAS recompté ici : son concern `shared_memory` est noté dans le bloc précédent._

  _Approche A — mémoire perso par assistant (11 fichiers) :_
  - `packages/data-schemas/src/schema/memory.ts` (champ `agentId: { type: String, index: true, default: null }`)
  - `packages/data-schemas/src/types/memory.ts` (`agentId?: string | null` sur `IMemoryEntry`/`IMemoryEntryLean`/`SetMemoryParams`/`DeleteMemoryParams`/`GetFormattedMemoriesParams`)
  - `packages/data-schemas/src/methods/memory.ts` (helper `buildReadFilter` ; `agentId` dans les filtres `createMemory`/`setMemory`/`deleteMemory` et la lecture union `getAllUserMemories`/`getFormattedMemories` ; court-circuit `key === 'nothing'` préservé)
  - `packages/api/src/agents/memory.ts` (`agentId` threadé dans `createMemoryProcessor` → vue scopée du memory agent + `processMemory` → tools `set_memory`/`delete_memory`)
  - `api/server/routes/memories.js` (helpers `readScope`/`writeScope`/`sameScope` ; `agentId` lu en query pour GET/DELETE, en body pour POST/PATCH ; lookups post-écriture scopés par `sameScope`)
  - `packages/data-provider/src/api-endpoints.ts` (`memories(agentId?)`/`memory(key, agentId?)` via `buildQuery`)
  - `packages/data-provider/src/data-service.ts` (`agentId` sur `getMemories`/`deleteMemory`/`updateMemory`/`createMemory`)
  - `packages/data-provider/src/types/queries.ts` (`TUserMemory.agentId?: string | null`)
  - `client/src/data-provider/Memories/queries.ts` (clé de cache scopée `[QueryKeys.memories, agentId ?? 'global']` ; invalidation par préfixe `[QueryKeys.memories]` ; optimistic create sur la clé scopée)
  - `client/src/components/SidePanel/Memories/{MemoryCardActions,MemoryEditDialog,MemoryCreateDialog}.tsx` (delete/edit lisent `memory.agentId` ; create reçoit `agentId` optionnel — backward-compat sidebar)
  - `client/src/components/SidePanel/Agents/AgentMemory.tsx` (+ ancrage dans `AgentConfig.tsx` après FileSearch ; clés i18n `com_assistants_memory_*` FR+EN) — ultérieurement restructuré en 2 groupes par l'approche B (rend `<AgentSharedMemory canEdit>` puis la liste perso)

  _Approche B — mémoire-assistant partagée (8 fichiers) :_
  - `packages/data-schemas/src/schema/agent.ts` (sous-schéma typé `sharedMemorySchema` `{ _id: false }` + champ `shared_memory` défaut `[]`)
  - `packages/data-schemas/src/types/agent.ts` (interface `IAgentSharedMemory` + `shared_memory?: IAgentSharedMemory[]` sur `IAgent`)
  - `packages/data-provider/src/types/assistants.ts` (type `AgentSharedMemory` + `shared_memory?` sur le type `Agent` ; `'shared_memory'` ajouté au `Pick<Agent, …>` de `AgentUpdateParams` = body PATCH typé)
  - `packages/api/src/agents/validation.ts` (`agentSharedMemorySchema` ajouté à `agentBaseSchema` = whitelist d'édition PATCH/POST ; pas de nouvelle route. **Concern supplémentaire — bornes de longueur Name/Description (fix QA n°10 AST-05)** : bloc `// Vermeer:` sur `agentBaseSchema`, `name: z.string().max(256)…` et `description: z.string().max(512)…` (hérité par `agentCreateSchema`/`agentUpdateSchema`, appliqués via `.parse(req.body)` dans `api/server/controllers/agents/v1.js` create:235/update:440). Ferme le vecteur non-UI (API/import) que le `maxLength` HTML du builder ne couvrait pas ; un agent existant hors bornes est bloqué au save par un 400 zod explicite (audit du stock pollué en backlog). Volet frontend = rules RHF dans `AgentConfig.tsx`. Specs : `validation.spec.ts` (256/257 name, 512/513 description, null/undefined). Ne pas retirer sans un garde-fou de longueur équivalent.)
  - `client/src/common/agents-types.ts` (`shared_memory?: AgentSharedMemory[]` sur le type `AgentForm`)
  - `client/src/components/SidePanel/Agents/AgentSelect.tsx` (copie explicite de `shared_memory` dans `resetAgentForm` — le fallthrough générique ignore les tableaux/objets)
  - `client/src/components/SidePanel/Agents/AgentPanel.tsx` (`shared_memory` destructuré + inclus dans `composeAgentUpdatePayload` ; `AgentConfig` monté seulement si `canEditAgent` → viewers hors builder)
  - nouveau `client/src/components/SidePanel/Agents/AgentSharedMemory.tsx` (form-based via `useWatch`/`setValue` ; dialogue create/edit + delete confirm ; read-only si `!canEdit` ; aucune mutation/PATCH/toast propre ; clés i18n `com_assistants_memory_badge_shared`, `com_assistants_memory_personal_section`, `com_assistants_memory_shared_empty`, `com_assistants_memory_shared_hint`, `com_assistants_memory_shared_section` FR+EN, parité OK)

  _Fichier touché par les deux approches — listé une seule fois (1 fichier) :_
  - `api/server/controllers/agents/client.js` (point de fusion runtime, modifié par les deux approches) — approche A : `effectiveAgentId` via `isEphemeralAgentId(this.options.agent.id)`, passé à `getFormattedMemories` et `createMemoryProcessor` ; approche B : méthode `formatSharedMemory(agent)` + assemblage `memoryContext` en sections (`# Existing memory about the user:` ∥ `# Assistant's curated memory:`), vide/éphémère → pas de bloc partagé. **Concern supplémentaire — persistance maxContextTokens (getSaveOptions)** : le constructeur stocke aussi `this.userMaxContextTokens` (valeur brute utilisateur, `undefined` = « Système ») et `getSaveOptions` persiste `maxContextTokens: this.userMaxContextTokens` (et NON la valeur calculée `this.maxContextTokens`, qui reste réservée au runtime). Ne pas re-persister la valeur calculée, sinon régression du gel ~68400. Cf. bloc maxContextTokens ci-dessous. **Concern supplémentaire — observabilité erreur provider (`#sendCompletion`, wagon v0.10.23)** : dans le `catch` non-abort, en plus du log `Unhandled error type`, un log `// Vermeer:` « Provider error detail » sérialise `err.message` + `err.response.{status,statusText,data}` (corps borné à 2000 car.) — le SDK Google/Vertex (`@langchain/google-common` `_throwRequestError`) y attache le corps du 400, que le logger par défaut avalait. N'inclut PAS `err.details` (contexte de requête/payload) ni de clés. Purement additif (aucun changement de flux d'erreur).

- **Persistance maxContextTokens — anti-gel « Système » (mergé sur `main`, watchlist active).** Fix PR #27 (`9d44d4e48`, mergé `dfff85757` le 2026-07-02) : quand l'utilisateur laisse « Système » (maxContextTokens null/undefined), `initialize.ts` CALCULE une valeur (~68400 = `baseContextTokens × (1 - DEFAULT_RESERVE_RATIO)`) pour le runtime, mais cette valeur ne doit **jamais** être persistée sur la conversation (sinon « Système » se fige en nombre dès le 1er message → contexte maximal rejoué à chaque tour → surconso). La persistance utilise désormais la valeur **brute** utilisateur. 2 fichiers natifs supplémentaires à contrôler (le 3e, `client.js`, est déjà en watchlist ci-dessus avec le concern ajouté) :
  - `packages/api/src/agents/initialize.ts` (champ `userMaxContextTokens?` ajouté à `InitializedAgent` + peuplé dans le literal `initializedAgent` : valeur brute si explicite `> 0`, sinon `undefined` ; le champ `maxContextTokens` calculé reste inchangé pour le run/SDK). **Complément anti-écho (PR #28, `16e60b731`, mergé `33b8cac9c`)** : helper pur exporté `resolveUserMaxContextTokens(received, computed)` + const partagée `computedMaxContextTokens` (extraite du fallback runtime). Une valeur reçue **égale** à la fenêtre système calculée = **écho front** (conv rechargée depuis DB / héritée via `LAST_CONVO_SETUP`) → non persistée. Caveat : une saisie volontaire == computed est traitée comme système (bénin, runtime identique). Ne pas retirer ce test d'égalité sans ré-armer la boucle de contamination. **Concern supplémentaire — défaut web_search miroir pour le chemin agent (branche `fix/agent-websearch-default`)** : helper pur exporté `shouldDefaultAgentWebSearch(currentValue, provider)` + bloc `// Vermeer:` à la zone de merge des `model_parameters` (juste après le `structuredClone`/`Object.assign`, avant `extractLibreChatParams`). Applique `web_search=true` UNIQUEMENT si la valeur effective est `undefined` (jamais d'écrasement d'un `false` explicite — même contrat qu'`applyWebSearchDefault`) ET si le provider **brut** de l'agent est un endpoint natif (`isNativeWebSearchEndpoint` importé de data-provider). Cause : l'endpoint `agents` est hors de `nativeWebSearchEndpoints` upstream → le défaut ne s'appliquait qu'aux conversations directes ; un assistant sans `web_search` persisté arrivait avec la valeur `undefined` → aucun outil natif bindé → « no internet ». Le gate sur le provider **brut** (avant l'override `getProviderConfig` → `Providers.OPENAI`) exclut naturellement les endpoints custom (French Models, xai/deepseek…), préservant le garde-fou anti-400. Couvre le stock d'assistants existant, aucune migration. Ne pas retirer sans persistance équivalente côté builder. Spec : `initialize.websearch.spec.ts`.
  - `api/server/services/Endpoints/agents/initialize.js` (passe `userMaxContextTokens: primaryConfig.userMaxContextTokens` au constructeur `AgentClient`, à côté de `maxContextTokens`)
  - `client/src/store/families.ts` (**PR #28** — `delete convoToStore.maxContextTokens` avant l'écriture de `LAST_CONVO_SETUP`, à côté du `clearModelForNonEphemeralAgent` existant : empêche une conversation neuve d'hériter de la fenêtre de la précédente et de la ré-émettre comme valeur user. Garde côté client, complémentaire de l'anti-écho serveur ci-dessus.)
  - _Script ops **non déployé** (hors watchlist) : `config/vermeer-unset-maxcontext.js` (`--dry-run`/`--apply`) purge le stock `maxContextTokens` déjà pollué en base — le code ne désécrit pas un champ déjà persisté._
  - _NOTE release : le tag `v0.10.14` (sur `90a696384`, « flag on » sans ce fix) est **orphelin** — publié sur origin + image ECR buildée, mais **non déployé**. `v0.10.15` (sur `dfff85757`) embarque la persistance brute ; `v0.10.16` y ajoute l'anti-écho + le strip `LAST_CONVO_SETUP`. Ne pas déployer `v0.10.14`._

- **Patch TEMPORAIRE `@langchain/anthropic@1.3.28` — web search + prompt cache (400 `tools.0.web_search_20250305.extras`).** Via `patch-package` (`patches/@langchain+anthropic+1.3.28.patch`), appliqué au `postinstall`.
  - **Symptôme** : quand le prompt cache est actif, l'API Anthropic renvoie un 400 `tools.0.web_search_20250305.extras: Extra inputs are not permitted` et la conversation casse.
  - **Cause amont** : `@librechat/agents@3.1.78` stampe `extras: { cache_control }` sur le dernier outil statique ; `@langchain/anthropic@1.3.28` renvoie les outils builtin **verbatim** (`if (isBuiltinTool(tool)) return tool;`) sans nettoyer `extras` → le champ `extras` non supporté part tel quel vers l'API.
  - **Correctif** : dans `formatStructuredToolToAnthropic` (les DEUX builds `dist/chat_models.js` ET `dist/chat_models.cjs`), on destructure `extras` hors de l'outil builtin, on le retire, et on **reporte `cache_control` à la racine** s'il est présent (version non-conservatrice ; `cache_control` racine est accepté par le SDK `WebSearchTool20250305`).
  - **Câblage** : `package.json` (`postinstall: patch-package` + devDep `patch-package ^8.0.1`) ; `Dockerfile` (`COPY --chown=node:node patches ./patches` AVANT le `npm ci`, sinon le postinstall n'a rien à appliquer en build image). Le `package-lock.json` est resynchronisé (`npm install`) et fait partie du commit.
  - **⚠️ TEMPORAIRE — épinglé à `@langchain/anthropic@1.3.28`** : tout bump de cette dépendance déplace les lignes ciblées et **fait échouer `patch-package`** (warning au postinstall) ; revalider/régénérer le patch après tout merge upstream touchant `@langchain/anthropic` ou `@librechat/agents`.
  - **Chantier de suivi** : bump `@librechat/agents` → **3.2.35** (corrige la cause amont), **conditionné au passage à Node 24**. Une fois fait, supprimer le patch, la devDep et le `postinstall`, et retirer le `COPY patches` du Dockerfile.

- **Patch TEMPORAIRE `@librechat/agents@3.1.78` — summarization cross-provider (400 `web_search_20250305.extras`).** Via `patch-package` (`patches/@librechat+agents+3.1.78.patch`), appliqué au même `postinstall`. Branche `feat/summarization-cross-provider-fix`, tag futur `v0.10.22`. Aucun impact sur `v0.10.21` (QA).
  - **Symptôme** : dès que `provider(résumeur) ≠ provider(agent)`, l'appel de résumé (compaction) casse en **HTTP 400 systématique** — les outils de l'agent (ex. `web_search_20250305` au format Anthropic) sont bindés tels quels sur le modèle résumeur d'un autre provider (ex. OpenAI), qui rejette le format. Confirmé par logs Loki.
  - **Cause amont** : dans `summarization/node.mjs`/`.cjs`, `executeSummarizationWithFallback` binde `agentContext.getToolsForBinding()` sur le modèle résumeur (chemin primaire `initializeModel`) **et** sur chaque provider de fallback (`tryFallbackProviders`), sans aucune traduction de format inter-providers.
  - **Correctif** (les DEUX builds `dist/esm/summarization/node.mjs` ET `dist/cjs/summarization/node.cjs`) : au chemin **primaire**, outils bindés **uniquement si `isSelfSummarizeModel`** (`clientConfig.provider === agentContext.provider`, recalculé localement — pas de câblage de signature) → préserve le cache hit du self-summarize, `[]` sinon. Au chemin **fallback**, `tools: []` **inconditionnel** (les fallbacks sont par définition des providers alternatifs, aucun bénéfice cache car pas d'`addCacheControl` sur ce chemin). Note SDK : `initializeModel` court-circuite `tools: []` comme `undefined` (`bindTools` jamais appelé), donc modèle non-bindé, zéro effet de bord ; le prompt de résumé et `extractResponseText` ne dépendent d'aucun outil bindé (le stub « Tools used » dérive des messages, pas du binding).
  - **Câblage** : réutilise le `postinstall: patch-package` et le `COPY patches` du Dockerfile déjà en place (rien à ajouter). `package.json`/`package-lock.json` **inchangés** (aucune dep touchée).
  - **⚠️ TEMPORAIRE — épinglé à `@librechat/agents@3.1.78`** : tout bump déplace les lignes ciblées et fait échouer `patch-package` (warning au postinstall) ; revalider/régénérer après tout merge upstream touchant `@librechat/agents`. Le chantier de suivi (bump → 3.2.35 sous Node 24) doit vérifier si la cause amont summarization est corrigée en amont avant de retirer ce patch.

---

## 12. Déploiement et CI/CD

La construction de l'image Docker est automatisée par GitHub Actions, workflow [`vermeer-prod-image.yml`](.github/workflows/vermeer-prod-image.yml).

> **⚠️ Procédure réécrite (PR #1).** L'ancien flux « push d'un tag `v*` → image GHCR `ghcr.io/popaistudio/vermeer-text` » est **OBSOLÈTE**. Le workflow build et pousse désormais sur **ECR**, avec authentification **OIDC** (pas de secret long terme à gérer).

**Registre cible (ECR)** :

```
897388551593.dkr.ecr.eu-west-1.amazonaws.com/vermeer-text
```

**Logique de tag d'image** (dérivée de la ref Git poussée) :

| Push Git | Tag d'image produit |
|---|---|
| `main` | `latest` |
| autre branche (ex. `feat/build`) | nom de branche assaini (`feat-build`) |
| tag Git (ex. `v0.9.0`) | nom du tag (`v0.9.0`) |

Le gitops **alpha** pull l'image `feat-build`.

### Publier une release de prod (procédure)

⚠️ **Pour une release prod, utiliser un tag de version immuable `v*`** — jamais un tag mutable (`feat-build`, `latest`), pour la traçabilité et le rollback.

```bash
# 1. Être sur main à jour, code mergé et relu
git checkout main && git pull origin main

# 2. Créer le tag de version (préfixe v obligatoire)
git tag v0.9.0

# 3. Pousser le tag — c'est CE push qui produit l'image ECR taguée v0.9.0
git push origin v0.9.0
```

Suivre le build dans l'onglet **Actions** du repo. Une fois vert, l'image `…/vermeer-text:v0.9.0` est disponible sur ECR et l'environnement cible peut la pull.

**Notes pratiques** :
- Le numéro de version du tag doit rester cohérent avec le champ `version` de `package.json`.
- Le déploiement sur les serveurs (pull de l'image + redémarrage) n'est **pas encore entièrement automatisé** côté prod — étape à câbler avec Oussama (cf. §3). Le gitops alpha consomme `feat-build`.
- Rappel garde-fou §6 : ne pas pousser sur `main` sans review. Le tag se pose sur un commit de `main` déjà relu et mergé.

---

# PARTIE 2 — Conventions techniques LibreChat

> Conventions techniques héritées de LibreChat, conservées telles quelles. Elles s'appliquent à tout le code du projet Vermeer.

## Project Overview

LibreChat is a monorepo with the following key workspaces:

| Workspace | Language | Side | Dependency | Purpose |
|---|---|---|---|---|
| `/api` | JS (legacy) | Backend | `packages/api`, `packages/data-schemas`, `packages/data-provider`, `@librechat/agents` | Express server — minimize changes here |
| `/packages/api` | **TypeScript** | Backend | `packages/data-schemas`, `packages/data-provider` | New backend code lives here (TS only, consumed by `/api`) |
| `/packages/data-schemas` | TypeScript | Backend | `packages/data-provider` | Database models/schemas, shareable across backend projects |
| `/packages/data-provider` | TypeScript | Shared | — | Shared API types, endpoints, data-service — used by both frontend and backend |
| `/client` | TypeScript/React | Frontend | `packages/data-provider`, `packages/client` | Frontend SPA |
| `/packages/client` | TypeScript | Frontend | `packages/data-provider` | Shared frontend utilities |

The source code for `@librechat/agents` (major backend dependency, same team) is at `/home/danny/agentus`.

---

## Workspace Boundaries

- **All new backend code must be TypeScript** in `/packages/api`.
- Keep `/api` changes to the absolute minimum (thin JS wrappers calling into `/packages/api`).
- Database-specific shared logic goes in `/packages/data-schemas`.
- Frontend/backend shared API logic (endpoints, types, data-service) goes in `/packages/data-provider`.
- Build data-provider from project root: `npm run build:data-provider`.

---

## Code Style

### Naming and File Organization

- **Single-word file names** whenever possible (e.g., `permissions.ts`, `capabilities.ts`, `service.ts`).
- When multiple words are needed, prefer grouping related modules under a **single-word directory** rather than using multi-word file names (e.g., `admin/capabilities.ts` not `adminCapabilities.ts`).
- The directory already provides context — `app/service.ts` not `app/appConfigService.ts`.

### Structure and Clarity

- **Never-nesting**: early returns, flat code, minimal indentation. Break complex operations into well-named helpers.
- **Functional first**: pure functions, immutable data, `map`/`filter`/`reduce` over imperative loops. Only reach for OOP when it clearly improves domain modeling or state encapsulation.
- **No dynamic imports** unless absolutely necessary.

### DRY

- Extract repeated logic into utility functions.
- Reusable hooks / higher-order components for UI patterns.
- Parameterized helpers instead of near-duplicate functions.
- Constants for repeated values; configuration objects over duplicated init code.
- Shared validators, centralized error handling, single source of truth for business rules.
- Shared typing system with interfaces/types extending common base definitions.
- Abstraction layers for external API interactions.

### Iteration and Performance

- **Minimize looping** — especially over shared data structures like message arrays, which are iterated frequently throughout the codebase. Every additional pass adds up at scale.
- Consolidate sequential O(n) operations into a single pass whenever possible; never loop over the same collection twice if the work can be combined.
- Choose data structures that reduce the need to iterate (e.g., `Map`/`Set` for lookups instead of `Array.find`/`Array.includes`).
- Avoid unnecessary object creation; consider space-time tradeoffs.
- Prevent memory leaks: careful with closures, dispose resources/event listeners, no circular references.

### Type Safety

- **Never use `any`**. Explicit types for all parameters, return values, and variables.
- **Limit `unknown`** — avoid `unknown`, `Record<string, unknown>`, and `as unknown as T` assertions. A `Record<string, unknown>` almost always signals a missing explicit type definition.
- **Don't duplicate types** — before defining a new type, check whether it already exists in the project (especially `packages/data-provider`). Reuse and extend existing types rather than creating redundant definitions.
- Use union types, generics, and interfaces appropriately.
- All TypeScript and ESLint warnings/errors must be addressed — do not leave unresolved diagnostics.

### Comments and Documentation

- Write self-documenting code; no inline comments narrating what code does.
- JSDoc only for complex/non-obvious logic or intellisense on public APIs.
- Single-line JSDoc for brief docs, multi-line for complex cases.
- Avoid standalone `//` comments unless absolutely necessary.

### Import Order

Imports are organized into three sections:

1. **Package imports** — sorted shortest to longest line length (`react` always first).
2. **`import type` imports** — sorted longest to shortest (package types first, then local types; length resets between sub-groups).
3. **Local/project imports** — sorted longest to shortest.

Multi-line imports count total character length across all lines. Consolidate value imports from the same module. Always use standalone `import type { ... }` — never inline `type` inside value imports.

### JS/TS Loop Preferences

- **Limit looping as much as possible.** Prefer single-pass transformations and avoid re-iterating the same data.
- `for (let i = 0; ...)` for performance-critical or index-dependent operations.
- `for...of` for simple array iteration.
- `for...in` only for object property enumeration.

---

## Frontend Rules (`client/src/**/*`)

### Localization

- All user-facing text must use `useLocalize()`.
- **i18n EN + FR — procédure manuelle (Locize retiré, commit d58c249a2)** :
  - Ajouter la clé EN dans `client/src/locales/en/translation.json`.
  - Le PMO (Loïse) valide la terminologie EN AVANT que CC traduise.
  - CC traduit en FR et insère dans `client/src/locales/fr/translation.json` en ordre alphabétique (cohérent avec l'ordre EN).
  - Conventions strictes : interpolations `{{xxx}}` préservées à l'identique ; apostrophes ASCII (`'`), jamais typographiques ; sigles métier non traduits (POP, BETC, BU, USD, CSV) ; pas d'espaces insécables (le repo utilise les espaces normaux) ; références techniques (`librechat.yaml`, noms de fichiers) non traduites.
  - Vérifs post-insertion : `JSON.parse` valide sur les deux fichiers ; diff des noms de clés EN vs FR → AUCUNE DIFFÉRENCE.
  - Passes de référence : commits `7fd9af216` (27 clés com_budget_*) et `6068ec993` (40 clés com_usage_* + maj subtitle EN obsolète).
  - **Couverture FR ~76 %** : ~443 clés EN restent sans traduction FR. Les clés EN font foi (source) ; les FR sont ajoutées manuellement dans `fr/translation.json` (workflow Locize abandonné).
- Semantic key prefixes: `com_ui_`, `com_assistants_`, etc.

### Components

- TypeScript for all React components with proper type imports.
- Semantic HTML with ARIA labels (`role`, `aria-label`) for accessibility.
- Group related components in feature directories (e.g., `SidePanel/Memories/`).
- Use index files for clean exports.

### Data Management

- Feature hooks: `client/src/data-provider/[Feature]/queries.ts` → `[Feature]/index.ts` → `client/src/data-provider/index.ts`.
- React Query (`@tanstack/react-query`) for all API interactions; proper query invalidation on mutations.
- QueryKeys and MutationKeys in `packages/data-provider/src/keys.ts`.

### Data-Provider Integration

- Endpoints: `packages/data-provider/src/api-endpoints.ts`
- Data service: `packages/data-provider/src/data-service.ts`
- Types: `packages/data-provider/src/types/queries.ts`
- Use `encodeURIComponent` for dynamic URL parameters.

### Performance

- Prioritize memory and speed efficiency at scale.
- Cursor pagination for large datasets.
- Proper dependency arrays to avoid unnecessary re-renders.
- Leverage React Query caching and background refetching.

---

## Development Commands

| Command | Purpose |
|---|---|
| `npm run smart-reinstall` | Install deps (if lockfile changed) + build via Turborepo |
| `npm run reinstall` | Clean install — wipe `node_modules` and reinstall from scratch |
| `npm run backend` | Start the backend server |
| `npm run backend:dev` | Start backend with file watching (development) |
| `npm run build` | Build all compiled code via Turborepo (parallel, cached) |
| `npm run frontend` | Build all compiled code sequentially (legacy fallback) |
| `npm run frontend:dev` | Start frontend dev server with HMR (port 3090, requires backend running) |
| `npm run build:data-provider` | Rebuild `packages/data-provider` after changes |

- Node.js: v20.19.0+ or ^22.12.0 or >= 23.0.0
- Database: MongoDB
- Backend runs on `http://localhost:3080/`; frontend dev server on `http://localhost:3090/`

---

## Testing

- Framework: **Jest**, run per-workspace.
- Run tests from their workspace directory: `cd api && npx jest <pattern>`, `cd packages/api && npx jest <pattern>`, etc.
- Frontend tests: `__tests__` directories alongside components; use `test/layout-test-utils` for rendering.
- Cover loading, success, and error states for UI/data flows.

### Philosophy

- **Real logic over mocks.** Exercise actual code paths with real dependencies. Mocking is a last resort.
- **Spies over mocks.** Assert that real functions are called with expected arguments and frequency without replacing underlying logic.
- **MongoDB**: use `mongodb-memory-server` for a real in-memory MongoDB instance. Test actual queries and schema validation, not mocked DB calls.
- **MCP**: use real `@modelcontextprotocol/sdk` exports for servers, transports, and tool definitions. Mirror real scenarios, don't stub SDK internals.
- Only mock what you cannot control: external HTTP APIs, rate-limited services, non-deterministic system calls.
- Heavy mocking is a code smell, not a testing strategy.

---

## Formatting

Fix all formatting lint errors (trailing spaces, tabs, newlines, indentation) using auto-fix when available. All TypeScript/ESLint warnings and errors **must** be resolved.

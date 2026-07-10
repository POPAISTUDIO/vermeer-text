# Vermeer Chat — Annexe technique (cartographie fonctionnalités)

**Version : v0.10.10 — 28 juin 2026**

Mapping fonctionnalité → flag / variable d'environnement / fichier, destiné à
l'équipe technique et à la cartographie Ava. Statut = état **réellement déployé
(gitops/helm)**. Les écarts entre config commitée et config déployée sont
documentés séparément dans `CONFIG-DRIFT.md`.

## Modèles

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Providers natifs (Anthropic, OpenAI, Google) | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_KEY` | `.env` | Actif |
| Endpoint custom « French Models » (Featherless) | `FEATHERLESS_API_KEY` | `librechat.local.yaml:194-203` | Actif |
| Pricing / comptage tokens | `tokenValues`, `getMultiplier` | `packages/data-schemas/src/methods/tx.ts` | Actif (rates: claude-opus-4-8/-4-7/-4-6, sonnet-4-6, haiku-4-5, gpt-5.2/5.1/5-mini, gpt-4o) |
| Sélecteur de modèle | `interface.modelSelect: true` | `librechat.yaml` | Actif |

## Recherche & sources

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Recherche web native ON par défaut | `applyWebSearchDefault()` | `packages/data-provider/src/parsers.ts:156-181` | Actif |
| Défaut schéma web_search | `web_search.default = true` (anthropic/openai/google) | `schemas.ts:1300/950/1069`, `parameterSettings.ts` | Actif |
| Strip web_search sur endpoints custom | `applyWebSearchDefault()` | `parsers.ts:171-173` | Actif (garde-fou 400) |
| Pipeline tiers (Serper/Firecrawl/Jina/Tavily) masqué | `SHOW_WEB_SEARCH_TOOL = false` | `ActiveToolChips.tsx:16`, `ToolsMenu.tsx:29` | Désactivable |
| Fix 400 server-tool web search | `stripServerToolParts` | `packages/api/src/agents/sanitize.ts` | Actif |

## Agents & assistants

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Constructeur d'assistant | `interface.agents.use/create: true` | `librechat.yaml` | Actif |
| Libellé custom « Créativité de la réponse » | `LABEL_OVERRIDES` | `AgentConfig.tsx:78-85` | Actif |
| Bouton variables d'instructions masqué | `SHOW_AGENT_VARIABLES_BUTTON = false` | `Instructions.tsx:32` | Désactivable |
| ID technique de l'agent masqué | `SHOW_AGENT_ID = false` | `AgentConfig.tsx:64` | Désactivable |
| Marketplace masqué | `marketplace.use: false` | `librechat.yaml` | Désactivable |
| Conversations partagées + fork cross-user | gating `PermissionBits.VIEW` + IDOR | `api/server/routes/agents/v1.js:74-118`, `controllers/agents/v1.js:1196-1264` | Actif |
| Toggle « partager avec l'agent » | champ `isSharedWithAgentMembers` | `schema/defaults.ts:118`, `routes/convos.js:195-221` | Actif |

## Connaissances (RAG)

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| File Search (UI builder) | `interface.fileSearch: true` | `librechat.yaml`, `SidePanel/Agents/FileSearch.tsx` | Actif |
| Indexation RAG | `RAG_API_URL` (injecté auto) | `helm/librechat/templates/configmap-env.yaml:7` (si sous-chart `librechat-rag-api.enabled`) ; package `deploy/vermeer-rag-deploy/` | Actif (prod) |
| Citations de fichiers | `interface.fileCitations: true` | `librechat.yaml` | Actif |

## Mémoire

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Activation mémoire | `memory.disabled: false`, `personalize: true` | `librechat.gitops.yaml:430-434` | Actif (prod) |
| Mémoire perso par assistant (approche A) | champ `agentId` nullable | `schema/memory.ts`, `methods/memory.ts`, `routes/memories.js` | Actif |
| Mémoire-assistant partagée (approche B) | champ `shared_memory` sur l'agent | `schema/agent.ts`, `AgentSharedMemory.tsx`, `agents/validation.ts` | Actif |
| Étanchéité | perso = user-scoped strict ; partagée = via ACL agent (cross-BU by design) | `controllers/agents/client.js` | — |

## Comparaison

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Comparaison multi-modèles | `interface.multiConvo: true` | `librechat.yaml:108` | Actif |

## Interface & expérience

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Dark mode forcé + sélecteur masqué | `FORCE_VERMEER_DARK = true` | `App.jsx:23`, `General.tsx:15` | Actif |
| Tokens design Vermeer | accent `#E5384A` | `client/src/style.css:133-150` | Actif |
| Suggestions landing (4 cartes) | `SHOW_LANDING_SUGGESTIONS = true` | `SuggestionGrid.tsx:15` | Actif |
| Composer unifié (legacy off) | `SHOW_LEGACY_COMPOSER_MENUS = false` | `ChatForm.tsx:47` | Actif |
| i18n FR | manuel (Locize retiré) | `client/src/locales/fr/translation.json` (~77 % des clés EN) | Actif (partiel) |

## Remontée & support

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Bouton « Signaler un problème » | `REPORT_ISSUE_URL` → `reportIssueURL` | `config.js:77`, `AccountSettings.tsx:85` | Conditionnel — **[à confirmer]** (valeur dans le gitops externe, absente des configs du repo) |
| Contact support par assistant | champs nom + e-mail | `AgentConfig.tsx:788-895` | Actif |

## Gouvernance & accès

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Auth prod = OpenID/Keycloak | `registration.socialLogins: ['openid']` | `librechat.gitops.yaml:104` | Actif (prod) |
| Auth dev = email/mot de passe | `ALLOW_SOCIAL_LOGIN=false` | `.env` | Actif (dev) |
| Capture claims SSO | companyName / department / jobTitle | `api/strategies/openidStrategy.js:554-556` | Actif (prod) |
| Segmentation BU | `buExpression` (tenantId > email + companyName) | `packages/data-schemas/src/methods/transaction.ts:36-114` | Actif |
| Filtre BU admin (7 valeurs) | `matchesBuFilter()` | `client/src/components/Admin/Usage.tsx:101-117` | Actif |
| Multi-tenant (latent) | champ `tenantId` (non assigné) | schémas `data-schemas` | Conditionnel (non utilisé) |

## Budget

| Fonctionnalité | Clé / config | Emplacement | Statut prod |
|---|---|---|---|
| Balance / transactions | `balance.enabled: true` (force `transactions: true`) | `librechat.gitops.yaml:107-113` | Actif (prod) |
| Gating budget mensuel | `currentMonthSpend + tokenCost <= monthlyBudget` | `packages/api/src/middleware/checkBalance.ts` | Actif |
| BudgetCard utilisateur | rendu si doc Balance + `monthlyBudget > 0` | `client/src/components/Chat/BudgetCard.tsx` | Actif (prod) |
| Admin Seuils + Analytics | gating `requireManageUsage` | `api/server/routes/admin/budgets.js`, `client/src/components/Admin/Usage.tsx` | Actif |
| Helper couleur jauge | `budgetColor()` | `client/src/components/Admin/credits.ts` | Actif |
| Helper début de mois UTC | `currentMonthStartUTC()` | `packages/data-schemas/src/methods/transaction.ts` | Actif |

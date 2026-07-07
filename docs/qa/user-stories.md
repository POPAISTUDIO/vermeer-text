# Vermeer Chat — User Stories QA

**Version : brouillon — 2026-07-07**

Ce document recense les user stories de recette (QA) de Vermeer Chat, structurées
par épic. Chaque US porte des critères d'acceptation en Gherkin (anglais)
destinés à alimenter le plan de tests (manuel + automatisé Playwright).

Sources : [FONCTIONNALITES.md](../FONCTIONNALITES.md),
[FONCTIONNALITES-technique.md](../FONCTIONNALITES-technique.md), et l'inventaire
des specs Playwright existantes sous [e2e/](../../e2e/).

**Terminologie** : on parle d'« assistants » (jamais d'« agents ») côté produit.

## Personas

- **Collaborateur** — utilisateur standard rattaché à une entité (POP, BETC,
  BETC Fullsix…). Usage quotidien : conversations, assistants, fichiers.
- **Administrateur** — gère les seuils budgétaires et consulte les analytics de
  consommation (droit `requireManageUsage`).
- **Créateur d'assistant** — collaborateur qui construit et partage un assistant
  (owner/editor sur l'ACL de l'assistant).

## Légendes

- **Priorité** : `P0` parcours critique (bloquant release) · `P1` important ·
  `P2` confort / secondaire.
- **Env** : `dev` (email/mot de passe, local) · `staging` (SSO Havas+BETC, QA).
- **Automatisable** : `oui` / `non` / `partiel`. Une note signale si une spec
  Playwright upstream couvre déjà tout ou partie du scénario.
- **`[Vermeer]`** : préfixe un scénario spécifique au fork — divergence par
  rapport à LibreChat upstream, feature flag `SHOW_*`, ou comportement ajouté
  par Vermeer. Les scénarios non tagués correspondent à du comportement upstream.

## Couverture e2e upstream existante (rappel)

| Spec | Couvre |
|---|---|
| `landing.spec.ts` | Titre landing, création de conversation |
| `messages.spec.ts` | Envoi + focus après génération, édition de message, navigation, stop & continue |
| `settings.spec.ts` | Persistance des derniers réglages (modèle OpenAI) |
| `popup.spec.ts` | Sélection endpoints / presets |
| `nav.spec.ts` | Barre de navigation, modale de réglages |
| `keys.spec.ts` | Pose et révocation de clés API |
| `a11y.spec.ts` | Accessibilité landing / conversation / nav / formulaire de saisie |

## Sommaire — 40 US sur 10 épics

| Épic | US | P0 | P1 | P2 |
|---|---|---|---|---|
| Conversation | CONV-1 → 5 | 1 | 3 | 1 |
| Sélecteur de modèles | MODEL-1 → 4 | 1 | 2 | 1 |
| Budget / seuils | BUDGET-1 → 4 | 1 | 3 | 0 |
| Auth / SSO | AUTH-1 → 4 | 1 | 2 | 1 |
| Assistants + fichiers | ASSIST-1 → 5 | 1 | 2 | 2 |
| RAG | RAG-1 → 3 | 0 | 2 | 1 |
| Web search | WEB-1 → 3 | 0 | 2 | 1 |
| Admin Panel | ADMIN-1 → 5 | 0 | 3 | 2 |
| Mémoires | MEM-1 → 4 | 1 | 3 | 0 |
| i18n | I18N-1 → 3 | 0 | 1 | 2 |
| **Total** | **40** | **6** | **23** | **11** |

**Parcours critiques (P0)** : US-AUTH-1 (login SSO), US-CONV-1 (message + streaming),
US-MODEL-1 (changer de modèle), US-ASSIST-1 (assistant avec fichier),
US-BUDGET-2 (seuil atteint → blocage), US-MEM-4 (étanchéité des mémoires).

---

## Épic — Conversation

### US-CONV-1 · Envoyer un message et recevoir la réponse en streaming

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux envoyer un message et voir la
  réponse s'afficher progressivement (streaming), afin d'obtenir une réponse
  fluide et de pouvoir la lire au fil de l'eau.
- **Priorité** : **P0** · **Env** : dev, staging
- **Automatisable** : partiel — `messages.spec.ts` couvre l'envoi et le focus
  après génération ; l'assertion « streaming incrémental » reste à ajouter.

```gherkin
Scenario: Send a message and receive a streamed response
  Given I am authenticated on a new conversation
  When I type "Bonjour" in the composer and send it
  Then my user message appears in the thread
  And the assistant response renders incrementally (streaming)
  And the composer regains focus once generation completes

Scenario: Non-empty response and clean completion
  Given I have sent a message
  When generation completes
  Then the response contains non-empty text
  And the generation indicator disappears

Scenario: Error - model fails mid-response
  Given the provider returns an error (invalid key or quota)
  When I send a message
  Then a readable error message is shown in the thread
  And the app does not freeze and the conversation stays usable
  And I can retry the message
```

### US-CONV-2 · Arrêter puis reprendre une génération

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux interrompre une réponse en cours
  puis la reprendre, afin de garder le contrôle sur des réponses longues.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — couvert par `messages.spec.ts` (« message should
  stop and continue »).

```gherkin
Scenario: Stop an in-progress generation
  Given a response is currently streaming
  When I click "Stop"
  Then generation halts immediately
  And the partial response received so far stays displayed

Scenario: Resume after stopping
  Given I have stopped a generation
  When I click "Continue"
  Then generation resumes from the partial response

Scenario: Error - stop after generation finished
  Given a generation has just completed
  When the "Stop" button is no longer available
  Then only "Continue" (or a new input) is offered
```

### US-CONV-3 · Éditer un message envoyé et relancer

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux modifier un message déjà envoyé
  et régénérer la réponse, afin de corriger une formulation sans repartir de zéro.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — couvert par `messages.spec.ts` (édition de messages).

```gherkin
Scenario: Edit a user message
  Given I have an exchange (message + response) in the thread
  When I edit my message and submit
  Then a new response is generated from the edited message

Scenario: Cancel an edit
  Given I have opened the edit view of a message
  When I cancel without submitting
  Then the original message is kept unchanged

Scenario: Error - editing to empty content
  Given I am editing a message
  When I clear the field entirely and try to submit
  Then submission is blocked (no empty message is sent)
```

### US-CONV-4 · Créer une nouvelle conversation depuis l'accueil

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux démarrer une nouvelle
  conversation depuis la landing, afin de commencer un nouveau sujet proprement.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — couvert par `landing.spec.ts` (« Create
  Conversation »).

```gherkin
Scenario: Start a conversation from the landing page
  Given I am on the landing screen
  When I send a first message
  Then a new conversation is created and appears in the sidebar

Scenario: [Vermeer] Landing suggestion cards
  Given I am on the landing screen
  Then four agency-oriented suggestion cards are displayed
  When I click a suggestion
  Then its content pre-fills the composer
```

### US-CONV-5 · Naviguer et reprendre une conversation existante

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux retrouver et rouvrir une
  conversation passée, afin de poursuivre un travail déjà entamé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — `messages.spec.ts` (« Page navigations »)
  couvre la navigation ; l'assertion de reprise d'échange reste à préciser.

```gherkin
Scenario: Reopen a conversation
  Given I have several conversations in the sidebar
  When I select an earlier conversation
  Then its full message history is displayed
  And I can send a new message that appends to the thread

Scenario: Error - deleted / missing conversation
  Given a conversation has been deleted
  When I access its URL directly
  Then I am redirected cleanly (landing) without a broken screen
```

---

## Épic — Sélecteur de modèles

### US-MODEL-1 · Choisir le modèle de la conversation

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux sélectionner le modèle utilisé
  pour ma conversation, afin d'adapter la réponse à mon besoin (rapidité, qualité,
  provider).
- **Priorité** : **P0** · **Env** : dev, staging
- **Automatisable** : partiel — `popup.spec.ts` couvre la sélection
  endpoint/preset ; l'assertion « le message suivant utilise bien le modèle
  choisi » reste à ajouter.

```gherkin
Scenario: Select a model
  Given I am in a conversation
  When I open the model selector and choose a model
  Then the selected model becomes the active model of the conversation
  And my next message is handled by that model

Scenario: Change model mid-conversation
  Given I have already exchanged with a model
  When I switch model and send a new message
  Then the new response is produced by the new model
  And the previous history stays unchanged

Scenario: Error - model unavailable (provider key/quota)
  Given I select a model whose provider is misconfigured
  When I send a message
  Then a clear error message states the unavailability
  And I can switch to another model without reloading the page
```

### US-MODEL-2 · Persistance du dernier modèle et de ses réglages

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que mon dernier modèle et ses
  réglages soient conservés, afin de ne pas les reconfigurer à chaque session.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — couvert par `settings.spec.ts` (« Last OpenAI
  settings »).

```gherkin
Scenario: Reuse the last model
  Given I used a model with custom settings
  When I create a new conversation
  Then the last model and its settings are pre-selected

Scenario: [Vermeer] Do not inherit a frozen context window
  Given a conversation whose context window is left on "System"
  When I create a new conversation
  Then the new conversation does not freeze an inherited numeric value
  And it stays on "System" (maxContextTokens anti-freeze guard)
```

### US-MODEL-3 · Accès multi-providers

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux accéder à Claude, GPT, Gemini et
  aux modèles français depuis un même sélecteur, afin de choisir librement mon
  provider.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — aucune spec upstream ne vérifie la présence des
  providers Vermeer ; à créer.

```gherkin
Scenario: Expected providers are present
  Given I open the model selector
  Then I see Claude (Anthropic), GPT (OpenAI) and Gemini (Google) models

Scenario: [Vermeer] French Models endpoint is available
  Given I open the model selector
  Then the custom "French Models" (Featherless) endpoint is listed

Scenario: Error - provider without configured key
  Given a provider has no key configured in the environment
  When I open the selector
  Then that provider is absent or explicitly unavailable (no crash)
```

### US-MODEL-4 · Comparer plusieurs modèles en parallèle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux poser la même question à
  plusieurs modèles simultanément, afin de comparer leurs réponses.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — pas de spec upstream ; à créer (`multiConvo`).

```gherkin
Scenario: Compare two models
  Given I enable comparison mode with two models
  When I send a question
  Then both responses render side by side in parallel

Scenario: Error - one of the models fails
  Given a comparison mode with two models
  When one provider returns an error (e.g. invalid key)
  Then the valid model response renders normally
  And the failing model error is isolated to its column
```

---

## Épic — Budget / seuils

### US-BUDGET-1 · Consulter sa jauge de consommation mensuelle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir ma consommation du mois par
  rapport à mon budget sous la barre de saisie, afin de suivre où j'en suis.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer. Dépend d'un
  environnement avec `balance.enabled` (staging/prod).

```gherkin
Scenario: [Vermeer] Display the BudgetCard gauge
  Given I have a Balance document with a monthly budget > 0
  When I open a conversation
  Then a gauge under the composer shows my month spend vs my budget
  And the gauge color reflects the spend/budget ratio

Scenario: [Vermeer] Gauge updates after a message
  Given the gauge shows my current spend
  When I send a message that consumes tokens
  Then the gauge refetches and reflects the new spend

Scenario: [Vermeer] Limitation - no Balance document
  Given I have no Balance document in the database
  When I open a conversation
  Then the gauge is not displayed (documented V1 limitation)
  And the app stays fully usable
```

### US-BUDGET-2 · Blocage propre au seuil budgétaire atteint

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur ayant atteint mon budget mensuel, je veux
  être bloqué proprement avec un message clair, afin de comprendre pourquoi je ne
  peux plus envoyer et éviter tout dépassement silencieux.
- **Priorité** : **P0** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer. Logique
  `currentMonthSpend + tokenCost <= monthlyBudget` (`checkBalance.ts`).

```gherkin
Scenario: [Vermeer] Send refused when budget is reached
  Given my month spend meets or exceeds my monthly budget
  When I try to send a message
  Then the send is refused before any call to the model
  And an explicit error states the budget overrun

Scenario: [Vermeer] Send allowed below the threshold
  Given my month spend is below my monthly budget
  When I send a message whose estimated cost stays under the threshold
  Then the message is processed normally

Scenario: [Vermeer] Edge - message cost would exceed the budget
  Given I am just below my monthly budget
  When the estimated cost of the next message would exceed the budget
  Then the send is refused cleanly (no partial overrun)
```

### US-BUDGET-3 · Administrer les seuils par utilisateur

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux définir le seuil budgétaire
  mensuel d'un utilisateur, afin d'encadrer sa consommation.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer. Route
  `admin/budgets`, onglet « Seuils & gestion » (gating `requireManageUsage`).

```gherkin
Scenario: [Vermeer] Edit a user threshold
  Given I am an administrator on the "Seuils & gestion" tab
  When I change a user's monthly budget and save
  Then the new threshold is persisted
  And that user's gauge reflects this budget

Scenario: [Vermeer] Unlock the gauge display (V1 workaround)
  Given a user has no Balance document yet
  When I edit their threshold for the first time
  Then a Balance document is created
  And the gauge becomes visible for that user

Scenario: [Vermeer] Error - unauthorized access to thresholds
  Given I am a collaborateur without management rights
  When I try to access the "Seuils & gestion" tab
  Then access is denied (requireManageUsage gating)
```

### US-BUDGET-4 · Intégrité du pricing à l'ajout d'un modèle

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux que tout modèle nouvellement
  exposé soit comptabilisé avec son tarif exact, afin que la consommation et les
  budgets restent fiables et sans sous- ou sur-facturation silencieuse.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — vérifiable via l'API transactions / le dashboard
  de consommation (comparaison de l'ordre de grandeur du coût enregistré au tarif
  officiel du provider). Pricing en dur dans `tx.ts` (`tokenValues`).

```gherkin
Scenario: [Vermeer] Recorded cost uses the model's exact pricing entry
  Given a newly exposed model
  When a message is sent with it
  Then the recorded transaction uses the model's exact pricing entry (not a pattern-match fallback)
  And the cost order of magnitude matches the provider's official rate

Scenario: [Vermeer] Error - model without a defined rate
  Given a model exposed without a matching pricing entry in tx.ts
  When a message is sent with it
  Then the gap is detectable (no cost or fallback cost recorded)
  And it is caught before relying on it for monthly budgets
```

---

## Épic — Auth / SSO

### US-AUTH-1 · Se connecter via le SSO de l'organisation

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux me connecter via le SSO de mon
  organisation, afin d'accéder à Vermeer Chat de façon sécurisée sans gérer un
  mot de passe dédié.
- **Priorité** : **P0** · **Env** : staging
- **Automatisable** : partiel — flux SSO externe (Keycloak/OpenID) difficile à
  automatiser de bout en bout ; à couvrir en manuel + smoke sur le retour de
  callback.

```gherkin
Scenario: [Vermeer] Successful SSO login
  Given I am on the login page in a SSO environment
  When I authenticate through the organization identity provider
  Then I am redirected back and land authenticated on the home screen

Scenario: [Vermeer] Password/social login disabled in production
  Given I am on the login page in production
  Then only the SSO (OpenID) sign-in path is offered
  And email/password registration is not available

Scenario: [Vermeer] Error - SSO authentication fails
  Given the identity provider rejects or cancels authentication
  When I return to the app
  Then I remain unauthenticated with a clear error
  And no partial session is created
```

### US-AUTH-2 · Se connecter en email / mot de passe (dev)

- **Persona** : Collaborateur
- **Story** : En tant que développeur/testeur en environnement dev, je veux me
  connecter en email/mot de passe, afin de tester l'application sans dépendre du
  SSO.
- **Priorité** : **P1** · **Env** : dev
- **Automatisable** : oui — la fixture d'authentification e2e
  (`setup/authenticate.ts`) utilise déjà ce flux.

```gherkin
Scenario: Login with valid credentials
  Given I am on the dev login page
  When I submit a valid email and password
  Then I am authenticated and reach the home screen

Scenario: Error - invalid credentials
  Given I am on the dev login page
  When I submit an incorrect password
  Then login is refused with a clear error
  And I stay on the login page
```

### US-AUTH-3 · Rattachement automatique à l'entité (BU)

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux être rattaché automatiquement à
  mon entité (POP, BETC, BETC Fullsix…) à la connexion, afin que ma consommation
  soit suivie par entité sans action de ma part.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — dépend des claims SSO ; vérifiable via l'effet
  (filtre BU côté admin) plutôt qu'en pur e2e.

```gherkin
Scenario: [Vermeer] BU derived from SSO claims
  Given I sign in via SSO with a company/department claim
  When my session is created
  Then I am attached to the matching entity (buExpression)
  And my usage is attributed to that entity in the admin analytics

Scenario: [Vermeer] Error - missing/ambiguous claim
  Given my SSO profile has no resolvable entity claim
  When my session is created
  Then I am attached to a safe fallback bucket ("Other")
  And no crash occurs on login
```

### US-AUTH-4 · Se déconnecter

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux me déconnecter, afin de
  sécuriser l'accès à mon compte sur un poste partagé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — action UI simple.

```gherkin
Scenario: Logout
  Given I am authenticated
  When I trigger logout from the account menu
  Then my session is cleared
  And I am redirected to the login page

Scenario: Error - access protected route after logout
  Given I have logged out
  When I navigate to a protected route directly
  Then I am redirected to the login page
```

---

## Épic — Assistants + fichiers

### US-ASSIST-1 · Créer un assistant avec un fichier de référence

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux créer un assistant avec
  un nom, des instructions et un fichier de référence, afin de disposer d'un
  assistant métier prêt à l'emploi.
- **Priorité** : **P0** · **Env** : dev, staging
- **Automatisable** : partiel — pas de spec upstream ; à créer.

```gherkin
Scenario: Create an assistant with a reference file
  Given I open the assistant builder ("Mes assistants")
  When I set a name, instructions and attach a reference file, then save
  Then the assistant is created and appears in my assistants list
  And I can start a conversation with it

Scenario: [Vermeer] Unified upload zone under Instructions
  Given I am in the assistant builder
  Then a single "Glissez vos fichiers ici" upload zone is shown under Instructions
  And no separate legacy upload-mode menus are displayed

Scenario: Error - save without required fields
  Given I am in the assistant builder
  When I try to save without a name
  Then saving is blocked with a clear validation message
```

### US-ASSIST-2 · Mode d'attachement des fichiers et impact sur la consommation

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux comprendre comment mes fichiers
  sont attachés (contexte permanent vs recherche) et l'effet sur ma
  consommation, afin d'éviter une facturation élevée non anticipée.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — vérifiable via l'évolution de la conso après
  messages successifs ; à créer. Cas utilisateur réel : fichiers en mode
  contexte réinjectés à chaque message.

```gherkin
Scenario: [Vermeer] Context-mode files are re-injected each message
  Given I have attached a large file as permanent context to a conversation
  When I send several successive messages
  Then the file content is re-injected into the prompt on each message
  And my monthly spend increases faster than for a plain text exchange

Scenario: File-search mode retrieves only relevant excerpts
  Given a file attached to an assistant for file search (RAG)
  When I ask a question about it
  Then only relevant excerpts are retrieved rather than the whole file
  And the per-message token cost stays bounded

Scenario: [Vermeer] Error - user hits their budget from context re-injection
  Given repeated messages with a heavy file in permanent context
  When my month spend reaches my monthly budget
  Then the send is refused with the budget-overrun message (US-BUDGET-2)
  And the message helps me understand the file re-injection cost driver
```

### US-ASSIST-3 · Partager un assistant et reprendre une conversation

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux partager mon assistant et
  permettre de reprendre les conversations associées, afin de collaborer sur un
  même travail.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — nécessite deux comptes ; à créer.

```gherkin
Scenario: [Vermeer] Fork a shared conversation cross-user
  Given an assistant shared with me (VIEW permission)
  When I open a conversation shared on that assistant
  Then I can fork it and continue the work under my account

Scenario: [Vermeer] Error - access without permission (IDOR guard)
  Given an assistant I have not been granted access to
  When I try to reach one of its conversations by id
  Then access is denied (PermissionBits.VIEW gating)
```

### US-ASSIST-4 · Afficher le contact support d'un assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir un contact (nom + e-mail)
  rattaché à un assistant, afin de savoir à qui poser mes questions le concernant.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — rendu conditionnel simple.

```gherkin
Scenario: Support contact displayed
  Given an assistant configured with a support name and email
  When I view the assistant
  Then its support contact (name + email) is displayed

Scenario: No contact configured
  Given an assistant without support contact
  When I view the assistant
  Then no empty contact block is displayed
```

### US-ASSIST-5 · Éléments techniques du builder masqués

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant non technique, je veux une
  interface épurée sans détails techniques, afin de me concentrer sur le métier.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — assertions de présence/absence d'éléments UI.

```gherkin
Scenario: [Vermeer] Technical builder elements are hidden
  Given I open the assistant builder
  Then the technical assistant ID is not shown (SHOW_AGENT_ID=false)
  And the instructions variables button is not shown (SHOW_AGENT_VARIABLES_BUTTON=false)

Scenario: [Vermeer] Marketplace hidden
  Given I browse the assistants area
  Then the assistants marketplace/gallery is not accessible (marketplace.use=false)
```

---

## Épic — RAG (connaissances)

### US-RAG-1 · Interroger les fichiers d'un assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que l'assistant s'appuie sur les
  documents joints pour répondre, afin d'obtenir des réponses ancrées dans mes
  contenus.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — dépend de la RAG API opérationnelle (staging/prod) ;
  à créer.

```gherkin
Scenario: Answer grounded in attached files
  Given an assistant with an indexed reference document
  When I ask a question whose answer is in the document
  Then the response uses the document content
  And it does not hallucinate content absent from the file

Scenario: Error - no relevant content in files
  Given an assistant with indexed documents
  When I ask about a topic absent from the documents
  Then the assistant indicates it found nothing relevant rather than inventing
```

### US-RAG-2 · Afficher les citations de fichiers

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir d'où provient une
  information (citation de fichier), afin de vérifier la source.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: File citations shown
  Given a response grounded in an indexed file
  When the answer is displayed
  Then a citation referencing the source file is shown

Scenario: Error - citation source unavailable
  Given a cited file has been removed
  When I open the citation
  Then a graceful "source unavailable" state is shown (no broken link)
```

### US-RAG-3 · Zone d'upload unifiée et activation de la recherche de fichiers

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux que la recherche de
  fichiers soit activée dès que je joins un document, afin de ne pas avoir à
  cocher une option technique.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — assertion sur l'état d'upload à la re-sélection
  d'assistant ; à créer.

```gherkin
Scenario: [Vermeer] File search auto-enabled in the builder
  Given I open the assistant builder
  Then the file-search capability is forced on (no visible checkbox)
  And the upload zone is enabled

Scenario: [Vermeer] Capability re-armed on assistant re-selection
  Given I switch between assistants in the builder
  When I re-open a previously saved assistant
  Then the upload zone stays enabled (file_search re-armed on agent change)
  And the button is not greyed out (regression guard)

Scenario: [Vermeer] Limitation - RAG API not configured (dev)
  Given RAG_API_URL is undefined in the environment
  When I attach a file for file search
  Then indexing fails silently with a backend warning (documented V1 limitation)
  And the UI does not crash
```

---

## Épic — Web search

### US-WEB-1 · Recherche web native active par défaut

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que la recherche web native soit
  active par défaut sur les modèles compatibles, afin d'obtenir des réponses à
  jour sans configuration.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — assertion sur l'état par défaut du toggle ;
  à créer.

```gherkin
Scenario: [Vermeer] Web search on by default for native endpoints
  Given I start a conversation with Claude, GPT or Gemini
  Then the web search toggle is enabled by default (applyWebSearchDefault)

Scenario: Web search returns fresh information
  Given web search is enabled
  When I ask about a recent event
  Then the assistant consults the web and grounds its answer
```

### US-WEB-2 · Désactiver la recherche web

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux pouvoir désactiver la recherche
  web dans les paramètres de la conversation, afin de garder le contrôle sur les
  appels externes.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — toggle UI dans le panel Paramètres.

```gherkin
Scenario: Disable web search for the conversation
  Given web search is enabled
  When I turn it off in the conversation settings
  Then subsequent messages do not trigger web search

Scenario: Preference persists within the conversation
  Given I disabled web search
  When I send another message in the same conversation
  Then web search stays disabled
```

### US-WEB-3 · Robustesse web search (endpoints custom et garde-fous)

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que la recherche web ne casse
  jamais une conversation, afin d'avoir une expérience fiable quel que soit le
  modèle.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — assertions techniques ; à créer.

```gherkin
Scenario: [Vermeer] web_search stripped on custom endpoints
  Given I use a custom endpoint that does not support native web search
  When I send a message
  Then the web_search param is stripped (400 guard) and the message succeeds

Scenario: [Vermeer] No 400 with prompt cache active (langchain patch)
  Given prompt cache is active with web search enabled
  When I send a message
  Then no "web_search extras" 400 error occurs and the response streams

Scenario: [Vermeer] Third-party pipeline hidden from users
  Given I browse the tools menu
  Then the third-party web search tool is not offered (SHOW_WEB_SEARCH_TOOL=false)
```

---

## Épic — Admin Panel (analytics)

### US-ADMIN-1 · Consulter la page Consommation

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux consulter la consommation
  globale via des indicateurs clés, afin de piloter l'usage.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer.

```gherkin
Scenario: [Vermeer] View consumption KPI cards
  Given I am an administrator on the "Consommation" page
  Then I see the KPI cards (spend, users, intensity segmentation)
  And the figures reflect the current period

Scenario: [Vermeer] Error - no data for the period
  Given a period with no transactions
  When I open the analytics page
  Then empty states are shown gracefully (no crash, no NaN)
```

### US-ADMIN-2 · Filtrer par entité (BU)

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux filtrer la consommation par
  entité, afin d'analyser l'usage POP vs BETC.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Filter analytics by BU
  Given I am on the analytics page
  When I select a BU filter (POP, BETC, Other...)
  Then the figures are recomputed for that entity (matchesBuFilter)

Scenario: [Vermeer] "All" restores the full scope
  Given a BU filter is applied
  When I select "all"
  Then the analytics show the full cross-BU scope again
```

### US-ADMIN-3 · Répartition par modèle (Model Mix)

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux visualiser la répartition de la
  consommation par modèle, afin d'identifier les modèles les plus coûteux.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Model Mix donut and table
  Given I am on the analytics page
  Then a donut chart and a table show spend split by model

Scenario: [Vermeer] Model Mix follows the BU filter
  Given a BU filter is applied
  Then the Model Mix reflects only that entity's consumption
```

### US-ADMIN-4 · Exporter le détail par utilisateur

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux exporter le détail de
  consommation par utilisateur en CSV, afin de le partager ou l'archiver.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Export user details to CSV
  Given the user details section is expanded
  When I click export CSV
  Then a CSV file is downloaded with the per-user consumption rows

Scenario: [Vermeer] Export honors the active BU filter
  Given a BU filter is applied
  When I export CSV
  Then only the filtered users are included
```

### US-ADMIN-5 · Restreindre l'accès à l'administration

- **Persona** : Administrateur
- **Story** : En tant que responsable, je veux que seuls les profils autorisés
  accèdent aux analytics et aux seuils, afin de protéger les données de
  consommation.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : oui — assertion de gating.

```gherkin
Scenario: [Vermeer] Admin access granted with the right permission
  Given I have the manage-usage permission
  When I open the admin area
  Then the analytics and thresholds tabs are available

Scenario: [Vermeer] Error - non-admin blocked
  Given I am a collaborateur without manage-usage permission
  When I try to reach the admin analytics
  Then access is denied (requireManageUsage gating)
```

---

## Épic — Mémoires

### US-MEM-1 · Mémoire personnelle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que l'assistant retienne des
  informations me concernant, afin d'avoir des échanges plus pertinents.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: Personal memory is remembered
  Given memory is enabled for my account
  When I share a durable fact about myself
  Then it is stored and reused to personalize later responses

Scenario: Create/edit a memory entry manually
  Given I open the memory panel
  When I create or edit a memory entry
  Then the entry is saved and listed
```

### US-MEM-2 · Mémoire personnelle scopée par assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux distinguer ce que retient un
  assistant donné de ce qui est global, afin de garder des mémoires bien rangées.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Memory scoped to the current assistant
  Given I converse with a real assistant
  When a memory is captured
  Then it is tagged with that assistant's id
  And reading shows global entries plus the current assistant's entries

Scenario: [Vermeer] Global entries read-only in the assistant builder
  Given I open the memory section in an assistant
  Then global entries are read-only with a "Global" badge
  And only this assistant's entries are editable/deletable ("Cet assistant")

Scenario: [Vermeer] Default (ephemeral) chat writes global memory
  Given I use the default chat (no real assistant)
  When a memory is captured
  Then it is stored as global (agentId null)
```

### US-MEM-3 · Mémoire partagée d'un assistant

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux inscrire une mémoire
  métier curée qui accompagne l'assistant lorsqu'il est partagé, afin de diffuser
  un savoir commun.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Curated shared memory travels with the assistant
  Given I am owner/editor of an assistant
  When I add a shared memory entry and save the assistant
  Then the entry is persisted in the assistant definition (shared_memory)
  And a viewer of the shared assistant sees that curated memory

Scenario: [Vermeer] Shared memory is form-based (saved with the assistant)
  Given I add/edit/delete a shared memory entry
  When I have not yet saved the assistant
  Then no immediate PATCH occurs
  And the change persists only when I save the assistant

Scenario: [Vermeer] Error - viewer cannot edit shared memory
  Given I only have VIEW permission on an assistant
  When I open its shared memory
  Then it is read-only (no edit/delete controls)
```

### US-MEM-4 · Étanchéité des mémoires

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux la garantie que ma mémoire
  personnelle ne circule jamais vers d'autres utilisateurs ni d'autres entités,
  afin de préserver la confidentialité.
- **Priorité** : **P0** · **Env** : staging
- **Automatisable** : partiel — nécessite deux comptes/BU ; à créer.

```gherkin
Scenario: [Vermeer] Personal memory never crosses users
  Given user A has personal memory entries
  When user B converses (even with the same assistant)
  Then user B never sees user A's personal memory

Scenario: [Vermeer] Personal memory never crosses BU
  Given a personal memory belongs to a POP user
  When a BETC user uses the app
  Then that personal memory is never surfaced cross-BU

Scenario: [Vermeer] Shared memory may cross BU by design
  Given an assistant with curated shared memory is shared POP -> BETC
  When a BETC viewer uses the assistant
  Then the curated shared memory is available (by-design, via assistant ACL)
```

---

## Épic — i18n

### US-I18N-1 · Interface en français

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur francophone, je veux une interface en
  français, afin d'utiliser l'outil dans ma langue de travail.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — assertions de libellés localisés ; à créer.

```gherkin
Scenario: French UI labels
  Given my language is set to French
  When I browse the main screens (composer, settings, assistants)
  Then user-facing labels are displayed in French

Scenario: Interpolations and business acronyms preserved
  Given a localized string with an interpolation and acronyms (POP, BETC, USD)
  When it is displayed in French
  Then the interpolation is filled correctly and acronyms are not translated
```

### US-I18N-2 · Basculer la langue FR / EN

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux basculer entre français et
  anglais, afin de choisir ma langue d'affichage.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — action de réglage.

```gherkin
Scenario: Switch language
  Given the UI is in French
  When I switch the language to English in settings
  Then user-facing labels update to English without reload issues

Scenario: Language preference persists
  Given I selected English
  When I reload the app
  Then the UI stays in English
```

### US-I18N-3 · Repli propre sur clés non traduites

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux qu'une zone non encore traduite
  reste lisible, afin de ne jamais voir de libellé cassé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: [Vermeer] Untranslated key falls back to English
  Given the French coverage is partial (~77% of EN keys)
  When I open a recent area whose key has no FR translation
  Then the English text is shown as fallback (no raw key, no blank)

Scenario: [Vermeer] No missing-interpolation artifacts
  Given a fallback English string with interpolations
  When it is displayed in a French session
  Then interpolations still render (no "{{var}}" leaking to the user)
```

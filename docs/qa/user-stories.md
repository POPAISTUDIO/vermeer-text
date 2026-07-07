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
- **ID de scénario** : chaque scénario porte un identifiant `US-<épic>-<n>-S<k>`
  (traçabilité vers les specs Playwright). Il est référencé dans la note
  **Automatisable** quand une couverture existe déjà ou est à créer.
- **Règle d'oracle** : chaque `Then` désigne un endroit **observable** — élément
  ou texte d'**UI**, enregistrement de l'**API transactions**, ou chiffre du
  **dashboard** admin. Pas d'assertion sans point d'observation.

## Test fixtures

Comptes requis (à seeder par environnement) :

| Compte | Rôle / attribut | dev (email/pw) | staging (SSO) |
|---|---|---|---|
| `collaborateur-pop` | utilisateur standard, entité POP | oui | oui |
| `collaborateur-betc` | utilisateur standard, entité BETC | — | oui |
| `admin-usage` | permission `requireManageUsage` (analytics + seuils) | oui | oui |
| `createur-assistant` | owner/editor sur un assistant partagé | oui | oui |

Données seedées :

- **Assistant partagé** `QA Shared Assistant` — accès `VIEW` accordé à
  `collaborateur-betc` (tests de partage/fork cross-user et cross-BU).
- **Doc canari RAG** `qa-canary.pdf` — contient un **fait unique** de fixture
  (ex. code canari `VERMEER-CANARY-7X42`) absent de tout autre contenu, pour une
  assertion positive déterministe.
- **User avec Balance** — document Balance, `monthlyBudget > 0`, `currentMonthSpend`
  proche du seuil (tests jauge + blocage).
- **User sans Balance** — aucun document Balance (test de la limitation jauge V1).

Matrice de capacités par environnement :

| Capacité | dev | staging |
|---|---|---|
| Auth email / mot de passe | oui | non |
| Auth SSO (OpenID/Keycloak) | non | oui |
| `balance.enabled` (budgets/jauge/blocage) | non (off en local) | oui |
| RAG API (indexation fichiers) | souvent off (`RAG_API_URL` undefined) | oui |
| Segmentation BU via claims SSO | non | oui |

Conséquence : les US de budget/blocage, RAG et rattachement BU se recettent en
**staging** ; les parcours conversation/modèle/assistant de base passent en **dev**.

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

## Sommaire — 42 US sur 10 épics

| Épic | US | P0 | P1 | P2 |
|---|---|---|---|---|
| Conversation | CONV-1 → 6 | 1 | 4 | 1 |
| Sélecteur de modèles | MODEL-1 → 5 | 1 | 2 | 2 |
| Budget / seuils | BUDGET-1 → 4 | 1 | 3 | 0 |
| Auth / SSO | AUTH-1 → 4 | 1 | 2 | 1 |
| Assistants + fichiers | ASSIST-1 → 5 | 1 | 2 | 2 |
| RAG | RAG-1 → 3 | 0 | 2 | 1 |
| Web search | WEB-1 → 3 | 0 | 2 | 1 |
| Admin Panel | ADMIN-1 → 5 | 0 | 3 | 2 |
| Mémoires | MEM-1 → 4 | 1 | 3 | 0 |
| i18n | I18N-1 → 3 | 0 | 1 | 2 |
| **Total** | **42** | **6** | **24** | **12** |

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
- **Automatisable** : partiel — `messages.spec.ts` couvre US-CONV-1-S1 (envoi +
  focus après génération) ; l'assertion de croissance incrémentale reste à ajouter.

```gherkin
Scenario: US-CONV-1-S1 Send a message and receive a streamed response
  Given I am authenticated on a new conversation
  When I type "Bonjour" in the composer and send it
  Then my message text appears as a user row in the thread
  And the assistant response text grows across successive render updates (streaming)
  And the composer input regains focus once generation completes

Scenario: US-CONV-1-S2 Non-empty response and clean completion
  Given I have sent a message
  When generation completes
  Then the assistant message row shows non-empty text
  And the generation/stop indicator is no longer visible

Scenario: US-CONV-1-S3 Error - model fails mid-response
  Given the provider returns an error (invalid key or quota)
  When I send a message
  Then a readable error message is shown in the thread
  And I can send a follow-up message that succeeds (conversation still usable)
```

### US-CONV-2 · Arrêter puis reprendre une génération

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux interrompre une réponse en cours
  puis la reprendre, afin de garder le contrôle sur des réponses longues.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — US-CONV-2-S1 et S2 couverts par `messages.spec.ts`
  (« message should stop and continue »).

```gherkin
Scenario: US-CONV-2-S1 Stop an in-progress generation
  Given a response is currently streaming
  When I click "Stop"
  Then the assistant message text stops growing (no further tokens appended)
  And the partial response text received so far stays displayed

Scenario: US-CONV-2-S2 Resume after stopping
  Given I have stopped a generation
  When I click "Continue"
  Then the assistant message text resumes growing from the partial response

Scenario: US-CONV-2-S3 Error - stop after generation finished
  Given a generation has just completed
  When I look at the message controls
  Then no "Stop" control is visible
  And only "Continue" (or a new input) is available
```

### US-CONV-3 · Éditer un message envoyé et relancer

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux modifier un message déjà envoyé
  et régénérer la réponse, afin de corriger une formulation sans repartir de zéro.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — US-CONV-3-S1 couvert par `messages.spec.ts` (édition).

```gherkin
Scenario: US-CONV-3-S1 Edit a user message
  Given I have an exchange (message + response) in the thread
  When I edit my message and submit
  Then the user row shows the edited text
  And a new assistant response row is rendered below it

Scenario: US-CONV-3-S2 Cancel an edit
  Given I have opened the edit view of a message
  When I cancel without submitting
  Then the user row still shows the original unchanged text

Scenario: US-CONV-3-S3 Error - editing to empty content
  Given I am editing a message
  When I clear the field entirely
  Then the submit control is disabled
  And no new message row is added to the thread
```

### US-CONV-4 · Créer une nouvelle conversation depuis l'accueil

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux démarrer une nouvelle
  conversation depuis la landing, afin de commencer un nouveau sujet proprement.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — US-CONV-4-S1 couvert par `landing.spec.ts`
  (« Create Conversation »).

```gherkin
Scenario: US-CONV-4-S1 Start a conversation from the landing page
  Given I am on the landing screen
  When I send a first message
  Then a new conversation entry appears in the sidebar

Scenario: US-CONV-4-S2 [Vermeer] Landing suggestion cards
  Given I am on the landing screen
  Then four agency-oriented suggestion cards are visible
  When I click a suggestion
  Then the composer input contains that suggestion's text
```

### US-CONV-5 · Naviguer et reprendre une conversation existante

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux retrouver et rouvrir une
  conversation passée, afin de poursuivre un travail déjà entamé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — US-CONV-5-S1 partiellement couvert par
  `messages.spec.ts` (« Page navigations ») ; assertion de reprise à préciser.

```gherkin
Scenario: US-CONV-5-S1 Reopen a conversation
  Given I have several conversations in the sidebar
  When I select an earlier conversation
  Then the thread shows all previously exchanged message rows
  And a new message I send is appended as the last row

Scenario: US-CONV-5-S2 Error - deleted / missing conversation
  Given a conversation has been deleted
  When I open its URL directly
  Then the URL resolves to the landing route
  And no error boundary / broken screen is shown
```

### US-CONV-6 · Génération automatique du titre de conversation

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux qu'une nouvelle conversation
  reçoive automatiquement un titre, afin de la retrouver facilement dans la barre
  latérale.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — assertion sur le libellé du titre en sidebar après
  le 1er échange (US-CONV-6-S1) ; cas d'erreur à simuler (modèle de titre invalide).

```gherkin
Scenario: US-CONV-6-S1 Title generated after first exchange
  Given a new conversation whose sidebar entry has no title (or a placeholder)
  When I complete the first message/response exchange
  Then the sidebar entry for this conversation shows a non-empty generated title

Scenario: US-CONV-6-S2 Error - invalid title model, conversation stays usable
  Given the title-generation model is misconfigured/invalid
  When I complete the first exchange
  Then no user-facing error is surfaced (silent-404 guard)
  And the sidebar entry keeps its placeholder (no title) rather than breaking
  And I can still send further messages and receive responses
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
  endpoint/preset ; l'oracle « label du modèle sur le message de réponse »
  (US-MODEL-1-S1) reste à ajouter.

```gherkin
Scenario: US-MODEL-1-S1 Select a model
  Given I am in a conversation
  When I open the model selector, choose a model, and send a message
  Then the response message row displays that model's label
  And the transactions API records that model for the message

Scenario: US-MODEL-1-S2 Change model mid-conversation
  Given I have already exchanged with a model
  When I switch model and send a new message
  Then the new response message row displays the new model's label
  And the earlier message rows keep their original model label

Scenario: US-MODEL-1-S3 Error - model unavailable (provider key/quota)
  Given I select a model whose provider is misconfigured
  When I send a message
  Then a clear error message stating the unavailability is shown in the thread
  And I can select another model and send successfully without reloading the page
```

### US-MODEL-2 · Persistance du dernier modèle et de ses réglages

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que mon dernier modèle et ses
  réglages soient conservés, afin de ne pas les reconfigurer à chaque session.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — US-MODEL-2-S1 couvert par `settings.spec.ts`
  (« Last OpenAI settings »).

```gherkin
Scenario: US-MODEL-2-S1 Reuse the last model
  Given I used a model with custom settings
  When I create a new conversation
  Then the model selector shows that last model pre-selected
  And its settings fields show the same custom values

Scenario: US-MODEL-2-S2 [Vermeer] Do not inherit a frozen context window
  Given a conversation whose context window control reads "System"
  When I create a new conversation
  Then the context window control still reads "System" (not a numeric value)
  And the new conversation record persists no numeric maxContextTokens
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
Scenario: US-MODEL-3-S1 Expected providers are present
  Given I open the model selector
  Then the selector list contains Claude (Anthropic), GPT (OpenAI) and Gemini (Google) entries

Scenario: US-MODEL-3-S2 [Vermeer] French Models endpoint is available
  Given I open the model selector
  Then the custom "French Models" (Featherless) endpoint is listed

Scenario: US-MODEL-3-S3 Error - provider without configured key
  Given a provider has no key configured in the environment
  When I open the selector
  Then that provider is absent from the list (or shown as explicitly disabled)
  And the selector renders without error
```

### US-MODEL-4 · Comparer plusieurs modèles en parallèle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux poser la même question à
  plusieurs modèles simultanément, afin de comparer leurs réponses.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — pas de spec upstream ; à créer (`multiConvo`).

```gherkin
Scenario: US-MODEL-4-S1 Compare two models
  Given I enable comparison mode with two models
  When I send a question
  Then two response columns each show a non-empty response

Scenario: US-MODEL-4-S2 Error - one of the models fails
  Given a comparison mode with two models
  When one provider returns an error (e.g. invalid key)
  Then the valid model column shows a non-empty response
  And the failing model column shows an error message scoped to that column only
```

### US-MODEL-5 · Libellés humanisés du sélecteur

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux des libellés de modèles lisibles
  (« Niveau · Éditeur »), afin de choisir un modèle sans connaître les
  identifiants techniques.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — assertions de libellés/tooltip dans le sélecteur ;
  à créer.

```gherkin
Scenario: US-MODEL-5-S1 [Vermeer] Mapped models show humanized labels
  Given I open the model selector
  Then mapped models display a "[Level] · Editor" label
  And the "Éco" level is shown for the models mapped to it

Scenario: US-MODEL-5-S2 [Vermeer] Unmapped models fall back to the raw name
  Given a model that has no mapping entry
  When I open the selector
  Then that model is listed with its raw technical name

Scenario: US-MODEL-5-S3 [Vermeer] Tooltip exposes the exact model id
  Given a model shown with a humanized label
  When I hover its entry
  Then a tooltip displays the exact technical model id
```

---

## Épic — Budget / seuils

### US-BUDGET-1 · Consulter sa jauge de consommation mensuelle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir ma consommation du mois par
  rapport à mon budget sous la barre de saisie, afin de suivre où j'en suis.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer. Dépend d'un
  environnement avec `balance.enabled` (staging).

```gherkin
Scenario: US-BUDGET-1-S1 [Vermeer] Display the BudgetCard gauge
  Given I am the seeded user with a Balance document and monthly budget > 0
  When I open a conversation
  Then a gauge under the composer shows my month spend and my budget values
  And the gauge color matches budgetColor() for the current spend/budget ratio

Scenario: US-BUDGET-1-S2 [Vermeer] Gauge updates after a message
  Given the gauge shows my current spend value
  When I send a message that consumes tokens
  Then the gauge spend value increases (refetch after generation)

Scenario: US-BUDGET-1-S3 [Vermeer] Limitation - no Balance document
  Given I am the seeded user with no Balance document
  When I open a conversation
  Then no gauge is rendered under the composer
  And I can still send a message and receive a response
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
Scenario: US-BUDGET-2-S1 [Vermeer] Send refused when budget is reached
  Given my current-month spend meets or exceeds my monthly budget
  When I try to send a message
  Then an explicit budget-overrun error is shown in the composer/thread
  And no new transaction is recorded in the transactions API for this attempt

Scenario: US-BUDGET-2-S2 [Vermeer] Send allowed below the threshold
  Given my current-month spend is below my monthly budget
  When I send a message whose estimated cost stays under the threshold
  Then an assistant response is received
  And a new transaction is recorded in the transactions API

Scenario: US-BUDGET-2-S3 [Vermeer] Edge - message cost would exceed the budget
  Given I am just below my monthly budget
  When the estimated cost of the next message would exceed the budget
  Then the budget-overrun error is shown
  And no new transaction is recorded (no partial overrun)
```

### US-BUDGET-3 · Administrer les seuils par utilisateur

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux définir le seuil budgétaire
  mensuel d'un utilisateur, afin d'encadrer sa consommation.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — pas de spec upstream ; à créer. Route
  `admin/budgets`, onglet « Seuils & gestion » (gating `requireManageUsage`).

```gherkin
Scenario: US-BUDGET-3-S1 [Vermeer] Edit a user threshold
  Given I am admin-usage on the "Seuils & gestion" tab
  When I change a user's monthly budget and save
  Then the tab shows the new budget value for that user after reload
  And that user's BudgetCard gauge shows the new budget

Scenario: US-BUDGET-3-S2 [Vermeer] Unlock the gauge display (V1 workaround)
  Given a user has no Balance document yet
  When I edit their threshold for the first time and save
  Then a Balance document exists for that user (visible in the tab)
  And that user's BudgetCard gauge becomes rendered

Scenario: US-BUDGET-3-S3 [Vermeer] Error - unauthorized access to thresholds
  Given I am collaborateur-pop without management rights
  When I request the "Seuils & gestion" route
  Then the request is rejected (HTTP 403 / tab not available)
```

### US-BUDGET-4 · Intégrité du pricing à l'ajout d'un modèle

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux que tout modèle nouvellement
  exposé soit comptabilisé avec son tarif exact, afin que la consommation et les
  budgets restent fiables et sans sous- ou sur-facturation silencieuse.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — vérifiable via l'**API transactions** / le
  **dashboard** de consommation. Oracle : `recorded cost` comparé au tarif attendu
  de la table de référence ci-dessous, tolérance **±5 %**. Pricing en dur dans
  `tx.ts` (`tokenValues`).

**Table de tarifs de référence** (source de vérité externe = page pricing du
provider ; source in-app = `tokenValues` dans `tx.ts`). À renseigner par le QA au
moment du test à partir de la page officielle du provider :

| Modèle | Tarif input officiel ($/MTok) | Tarif output officiel ($/MTok) | Entrée `tx.ts` |
|---|---|---|---|
| claude-opus-4-8 | _(cf. page pricing Anthropic)_ | _(cf. page pricing Anthropic)_ | `tokenValues` |
| claude-sonnet-4-6 | _(cf. page pricing Anthropic)_ | _(cf. page pricing Anthropic)_ | `tokenValues` |
| claude-haiku-4-5 | _(cf. page pricing Anthropic)_ | _(cf. page pricing Anthropic)_ | `tokenValues` |
| gpt-5.2 | _(cf. page pricing OpenAI)_ | _(cf. page pricing OpenAI)_ | `tokenValues` |
| gpt-5-mini | _(cf. page pricing OpenAI)_ | _(cf. page pricing OpenAI)_ | `tokenValues` |

```gherkin
Scenario: US-BUDGET-4-S1 [Vermeer] Recorded cost matches the exact pricing entry
  Given a newly exposed model with a known expected rate (reference table)
  When a message with a known token count is sent with it
  Then the transactions API records this model's exact pricing entry (not a pattern-match fallback)
  And the recorded cost equals expected_tokens x expected_rate within +/-5%

Scenario: US-BUDGET-4-S2 [Vermeer] Error - model without a defined rate
  Given a model exposed without a matching pricing entry in tx.ts tokenValues
  When a message is sent with it
  Then the transactions API shows either no cost or a cost diverging from the expected rate by more than +/-5%
  And this divergence is caught before the model is relied on for monthly budgets
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
Scenario: US-AUTH-1-S1 [Vermeer] Successful SSO login
  Given I am on the login page in a SSO environment (staging)
  When I authenticate through the organization identity provider
  Then I am redirected back and the home screen is shown authenticated

Scenario: US-AUTH-1-S2 [Vermeer] Password/social login disabled in SSO environments
  Given I am on the login page in a SSO environment (staging)
  Then only the SSO (OpenID) sign-in path is displayed
  And no email/password registration form is available

Scenario: US-AUTH-1-S3 [Vermeer] Error - SSO authentication fails
  Given the identity provider rejects or cancels authentication
  When I return to the app
  Then the login page is shown with a clear error
  And accessing a protected route still redirects me to login (no partial session)
```

### US-AUTH-2 · Se connecter en email / mot de passe (dev)

- **Persona** : Collaborateur
- **Story** : En tant que développeur/testeur en environnement dev, je veux me
  connecter en email/mot de passe, afin de tester l'application sans dépendre du
  SSO.
- **Priorité** : **P1** · **Env** : dev
- **Automatisable** : oui — US-AUTH-2-S1 utilisé par la fixture d'authentification
  e2e (`setup/authenticate.ts`).

```gherkin
Scenario: US-AUTH-2-S1 Login with valid credentials
  Given I am on the dev login page
  When I submit a valid email and password
  Then the home screen is shown authenticated

Scenario: US-AUTH-2-S2 Error - invalid credentials
  Given I am on the dev login page
  When I submit an incorrect password
  Then a clear error is shown
  And the URL stays on the login page
```

### US-AUTH-3 · Rattachement automatique à l'entité (BU)

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux être rattaché automatiquement à
  mon entité (POP, BETC, BETC Fullsix…) à la connexion, afin que ma consommation
  soit suivie par entité sans action de ma part.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — dépend des claims SSO ; oracle observable via le
  **dashboard** admin (filtre BU) plutôt qu'en pur e2e.

```gherkin
Scenario: US-AUTH-3-S1 [Vermeer] BU derived from SSO claims
  Given I sign in via SSO with a company/department claim
  When I then consume tokens (send a message)
  Then in the admin analytics my usage appears under the matching entity (buExpression)

Scenario: US-AUTH-3-S2 [Vermeer] Error - missing/ambiguous claim
  Given my SSO profile has no resolvable entity claim
  When I sign in and consume tokens
  Then in the admin analytics my usage appears under the "Other" bucket
  And no crash occurs on login
```

### US-AUTH-4 · Se déconnecter

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux me déconnecter, afin de
  sécuriser l'accès à mon compte sur un poste partagé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — action UI simple.

```gherkin
Scenario: US-AUTH-4-S1 Logout
  Given I am authenticated
  When I trigger logout from the account menu
  Then the login page is shown

Scenario: US-AUTH-4-S2 Error - access protected route after logout
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
Scenario: US-ASSIST-1-S1 Create an assistant with a reference file
  Given I open the assistant builder ("Mes assistants")
  When I set a name, instructions and attach a reference file, then save
  Then the assistant appears by name in my assistants list
  And selecting it opens a conversation targeting that assistant

Scenario: US-ASSIST-1-S2 [Vermeer] Unified upload zone under Instructions
  Given I am in the assistant builder
  Then a single "Glissez vos fichiers ici" upload zone is visible under Instructions
  And no separate legacy upload-mode menus are visible

Scenario: US-ASSIST-1-S3 Error - save without required fields
  Given I am in the assistant builder with no name set
  When I try to save
  Then a validation message is shown
  And no new assistant is added to the list
```

### US-ASSIST-2 · Mode d'attachement des fichiers et impact sur la consommation

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux comprendre comment mes fichiers
  sont attachés (contexte permanent vs recherche) et l'effet sur ma
  consommation, afin d'éviter une facturation élevée non anticipée.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — oracle via l'**API transactions** (prompt tokens
  par message), protocole **comparatif** avec/sans fichier ; à créer. Cas
  utilisateur réel : fichiers en mode contexte réinjectés à chaque message.

```gherkin
Scenario: US-ASSIST-2-S1 [Vermeer] Context-mode files are re-injected each message
  Given a conversation A with a large file attached as permanent context
  And a control conversation B with no file attached
  When I send the same three successive messages in A and in B
  Then in the transactions API the prompt token count per message in A stays elevated and roughly proportional to the file size on every message
  And it does not decrease across the three messages (file re-injected each turn)
  And per-message prompt tokens in B are substantially lower than in A

Scenario: US-ASSIST-2-S2 File-search mode keeps per-message tokens bounded
  Given a file attached to an assistant for file search (RAG)
  When I ask three successive questions about it
  Then in the transactions API the prompt token count per message stays bounded
  And it stays far below the full file token size

Scenario: US-ASSIST-2-S3 [Vermeer] Error - user hits budget from context re-injection
  Given repeated messages with a heavy file in permanent context (staging, balance on)
  When my current-month spend reaches my monthly budget
  Then the budget-overrun error is shown (as in US-BUDGET-2-S1)
  And no new transaction is recorded for the refused message
```

### US-ASSIST-3 · Partager un assistant et reprendre une conversation

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux partager mon assistant et
  permettre de reprendre les conversations associées, afin de collaborer sur un
  même travail.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — nécessite `createur-assistant` + `collaborateur-betc` ;
  à créer.

```gherkin
Scenario: US-ASSIST-3-S1 [Vermeer] Fork a shared conversation cross-user
  Given the seeded "QA Shared Assistant" shared with me (VIEW permission)
  When I open a conversation shared on that assistant and fork it
  Then a new conversation owned by my account is created with the copied thread

Scenario: US-ASSIST-3-S2 [Vermeer] Error - access without permission (IDOR guard)
  Given an assistant I have not been granted access to
  When I request one of its conversations by id
  Then the request is rejected (HTTP 403/404, PermissionBits.VIEW gating)
```

### US-ASSIST-4 · Afficher le contact support d'un assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir un contact (nom + e-mail)
  rattaché à un assistant, afin de savoir à qui poser mes questions le concernant.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — rendu conditionnel simple.

```gherkin
Scenario: US-ASSIST-4-S1 Support contact displayed
  Given an assistant configured with a support name and email
  When I view the assistant
  Then the support contact name and email are visible

Scenario: US-ASSIST-4-S2 No contact configured
  Given an assistant without support contact
  When I view the assistant
  Then no contact block is rendered
```

### US-ASSIST-5 · Éléments techniques du builder masqués

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant non technique, je veux une
  interface épurée sans détails techniques, afin de me concentrer sur le métier.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — assertions de présence/absence d'éléments UI.

```gherkin
Scenario: US-ASSIST-5-S1 [Vermeer] Technical builder elements are hidden
  Given I open the assistant builder
  Then the technical assistant ID field is not visible (SHOW_AGENT_ID=false)
  And the instructions variables button is not visible (SHOW_AGENT_VARIABLES_BUTTON=false)

Scenario: US-ASSIST-5-S2 [Vermeer] Marketplace hidden
  Given I browse the assistants area
  Then no marketplace/gallery entry point is present (marketplace.use=false)
```

---

## Épic — RAG (connaissances)

### US-RAG-1 · Interroger les fichiers d'un assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que l'assistant s'appuie sur les
  documents joints pour répondre, afin d'obtenir des réponses ancrées dans mes
  contenus.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — US-RAG-1-S1 automatisable via le **doc canari**
  (fait unique de fixture) ; US-RAG-1-S2 **manuel/exploratoire** (l'absence de
  fabrication n'a pas d'oracle déterministe). Dépend de la RAG API (staging).

```gherkin
Scenario: US-RAG-1-S1 Answer grounded in the canary document
  Given an assistant with the seeded canary document indexed (unique fact: the canary code)
  When I ask "What is the QA canary code?"
  Then the response contains the exact canary code from the fixture
  And a file citation points to the canary document

Scenario: US-RAG-1-S2 Manual/exploratory - no fabrication when absent
  Given an assistant whose indexed documents do NOT contain a given fact
  When I ask about that absent fact
  Then (manual/exploratory) the assistant states it found nothing relevant rather than inventing content
```

### US-RAG-2 · Afficher les citations de fichiers

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux voir d'où provient une
  information (citation de fichier), afin de vérifier la source.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: US-RAG-2-S1 File citations shown
  Given a response grounded in an indexed file
  When the answer is displayed
  Then a citation referencing the source file name is visible on the response

Scenario: US-RAG-2-S2 Error - citation source unavailable
  Given a cited file has been removed
  When I open the citation
  Then a "source unavailable" state is shown (no broken link, no crash)
```

### US-RAG-3 · Zone d'upload unifiée et activation de la recherche de fichiers

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux que la recherche de
  fichiers soit activée dès que je joins un document, afin de ne pas avoir à
  cocher une option technique.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — US-RAG-3-S2 (état d'upload à la re-sélection
  d'assistant) est l'assertion de non-régression clé ; à créer.

```gherkin
Scenario: US-RAG-3-S1 [Vermeer] File search auto-enabled in the builder
  Given I open the assistant builder
  Then no file-search checkbox is visible
  And the file upload zone is enabled (not greyed out)

Scenario: US-RAG-3-S2 [Vermeer] Capability re-armed on assistant re-selection
  Given I switch between assistants in the builder
  When I re-open a previously saved assistant
  Then its upload zone is still enabled (file_search re-armed on agent change)

Scenario: US-RAG-3-S3 [Vermeer] Limitation - RAG API not configured (dev)
  Given RAG_API_URL is undefined in the environment
  When I attach a file for file search
  Then the UI shows no crash and the upload control stays usable
  And the backend logs an indexing warning (documented V1 limitation)
```

---

## Épic — Web search

### US-WEB-1 · Recherche web native active par défaut

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que la recherche web native soit
  active par défaut sur les modèles compatibles, afin d'obtenir des réponses à
  jour sans configuration.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — US-WEB-1-S1 (état du toggle) ; oracle de
  US-WEB-1-S2 = présence de citations/sources ; à créer.

```gherkin
Scenario: US-WEB-1-S1 [Vermeer] Web search on by default for native endpoints
  Given I start a conversation with Claude, GPT or Gemini
  Then the web search toggle is shown enabled by default (applyWebSearchDefault)

Scenario: US-WEB-1-S2 Web search returns fresh information with sources
  Given web search is enabled
  When I ask about a recent event
  Then the response includes web citations/sources
```

### US-WEB-2 · Désactiver la recherche web

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux pouvoir désactiver la recherche
  web dans les paramètres de la conversation, afin de garder le contrôle sur les
  appels externes.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : oui — toggle UI dans le panel Paramètres.

```gherkin
Scenario: US-WEB-2-S1 Disable web search for the conversation
  Given web search is enabled
  When I turn it off in the conversation settings and send a message
  Then the response contains no web citations/sources
  And the request payload does not include an active web_search parameter

Scenario: US-WEB-2-S2 Preference persists within the conversation
  Given I disabled web search
  When I send another message in the same conversation
  Then the web search toggle still reads off
  And the response again contains no web citations/sources
```

### US-WEB-3 · Robustesse web search (endpoints custom et garde-fous)

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que la recherche web ne casse
  jamais une conversation, afin d'avoir une expérience fiable quel que soit le
  modèle.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — assertions techniques (statut HTTP, réponse) ;
  à créer.

```gherkin
Scenario: US-WEB-3-S1 [Vermeer] web_search stripped on custom endpoints
  Given I use a custom endpoint that does not support native web search
  When I send a message
  Then the request succeeds (HTTP 200) and a response is received
  And no 400 web_search error is returned

Scenario: US-WEB-3-S2 [Vermeer] No 400 with prompt cache active (langchain patch)
  Given prompt cache is active with web search enabled
  When I send a message
  Then no "web_search extras" 400 error occurs
  And the assistant response is received

Scenario: US-WEB-3-S3 [Vermeer] Third-party pipeline hidden from users
  Given I open the tools menu
  Then no third-party web search tool entry is present (SHOW_WEB_SEARCH_TOOL=false)
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
Scenario: US-ADMIN-1-S1 [Vermeer] View consumption KPI cards
  Given I am admin-usage on the "Consommation" page
  Then the KPI cards (spend, users, intensity segmentation) are visible with numeric values

Scenario: US-ADMIN-1-S2 [Vermeer] Error - no data for the period
  Given a period with no transactions
  When I open the analytics page
  Then the KPI cards render empty-state values (no NaN, no crash)
```

### US-ADMIN-2 · Filtrer par entité (BU)

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux filtrer la consommation par
  entité, afin d'analyser l'usage POP vs BETC.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: US-ADMIN-2-S1 [Vermeer] Filter analytics by BU
  Given I am on the analytics page
  When I select a BU filter (POP, BETC, Other...)
  Then the displayed figures change to that entity's values (matchesBuFilter)

Scenario: US-ADMIN-2-S2 [Vermeer] "All" restores the full scope
  Given a BU filter is applied
  When I select "all"
  Then the displayed figures return to the full cross-BU totals
```

### US-ADMIN-3 · Répartition par modèle (Model Mix)

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux visualiser la répartition de la
  consommation par modèle, afin d'identifier les modèles les plus coûteux.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: US-ADMIN-3-S1 [Vermeer] Model Mix donut and table
  Given I am on the analytics page
  Then a donut chart and a table showing spend split by model are visible

Scenario: US-ADMIN-3-S2 [Vermeer] Model Mix follows the BU filter
  Given a BU filter is applied
  Then the Model Mix figures show only that entity's per-model spend
```

### US-ADMIN-4 · Exporter le détail par utilisateur

- **Persona** : Administrateur
- **Story** : En tant qu'administrateur, je veux exporter le détail de
  consommation par utilisateur en CSV, afin de le partager ou l'archiver.
- **Priorité** : **P2** · **Env** : staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: US-ADMIN-4-S1 [Vermeer] Export user details to CSV
  Given the user details section is expanded
  When I click export CSV
  Then a CSV file is downloaded containing one row per user with consumption columns

Scenario: US-ADMIN-4-S2 [Vermeer] Export honors the active BU filter
  Given a BU filter is applied
  When I export CSV
  Then the downloaded CSV contains only the filtered users' rows
```

### US-ADMIN-5 · Restreindre l'accès à l'administration

- **Persona** : Administrateur
- **Story** : En tant que responsable, je veux que seuls les profils autorisés
  accèdent aux analytics et aux seuils, afin de protéger les données de
  consommation.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : oui — assertion de gating.

```gherkin
Scenario: US-ADMIN-5-S1 [Vermeer] Admin access granted with the right permission
  Given I am admin-usage (manage-usage permission)
  When I open the admin area
  Then the analytics and thresholds tabs are visible and reachable

Scenario: US-ADMIN-5-S2 [Vermeer] Error - non-admin blocked
  Given I am collaborateur-pop without manage-usage permission
  When I request the admin analytics route
  Then the request is rejected (HTTP 403, requireManageUsage gating)
```

---

## Épic — Mémoires

### US-MEM-1 · Mémoire personnelle

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux que l'assistant retienne des
  informations me concernant, afin d'avoir des échanges plus pertinents.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — US-MEM-1-S2 automatisable (CRUD dans le panneau) ;
  la réutilisation en réponse (S1) est manuelle/exploratoire ; à créer.

```gherkin
Scenario: US-MEM-1-S1 Personal memory is captured
  Given memory is enabled for my account
  When I share a durable fact about myself
  Then a matching entry appears in the memory panel

Scenario: US-MEM-1-S2 Create/edit a memory entry manually
  Given I open the memory panel
  When I create or edit a memory entry
  Then the entry appears in the list with the saved content
```

### US-MEM-2 · Mémoire personnelle scopée par assistant

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux distinguer ce que retient un
  assistant donné de ce qui est global, afin de garder des mémoires bien rangées.
- **Priorité** : **P1** · **Env** : dev, staging
- **Automatisable** : partiel — oracle observable via l'API memories (`agentId`)
  et les badges du panneau ; à créer.

```gherkin
Scenario: US-MEM-2-S1 [Vermeer] Memory scoped to the current assistant
  Given I converse with a real assistant
  When a memory is captured
  Then the memories API returns that entry tagged with the assistant's agentId
  And the memory panel lists both global entries and the current assistant's entries

Scenario: US-MEM-2-S2 [Vermeer] Global entries read-only in the assistant builder
  Given I open the memory section in an assistant
  Then global entries show a "Global" badge and no edit/delete controls
  And this assistant's entries show a "Cet assistant" badge with edit/delete controls

Scenario: US-MEM-2-S3 [Vermeer] Default (ephemeral) chat writes global memory
  Given I use the default chat (no real assistant)
  When a memory is captured
  Then the memories API returns that entry with agentId null (global)
```

### US-MEM-3 · Mémoire partagée d'un assistant

- **Persona** : Créateur d'assistant
- **Story** : En tant que créateur d'assistant, je veux inscrire une mémoire
  métier curée qui accompagne l'assistant lorsqu'il est partagé, afin de diffuser
  un savoir commun.
- **Priorité** : **P1** · **Env** : staging
- **Automatisable** : partiel — oracle via le record d'agent (`shared_memory`) et
  l'absence de PATCH réseau avant Save ; à créer.

```gherkin
Scenario: US-MEM-3-S1 [Vermeer] Curated shared memory travels with the assistant
  Given I am owner/editor of an assistant
  When I add a shared memory entry and save the assistant
  Then the agent record contains that entry under shared_memory
  And a VIEW-only recipient sees that curated memory on the shared assistant

Scenario: US-MEM-3-S2 [Vermeer] Shared memory is form-based (saved with the assistant)
  Given I add/edit/delete a shared memory entry
  When I have not yet clicked Save on the assistant
  Then no PATCH request is sent
  And the change is persisted only after I click Save

Scenario: US-MEM-3-S3 [Vermeer] Error - viewer cannot edit shared memory
  Given I only have VIEW permission on an assistant
  When I open its shared memory
  Then no edit/delete controls are shown (read-only)
```

### US-MEM-4 · Étanchéité des mémoires

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux la garantie que ma mémoire
  personnelle ne circule jamais vers d'autres utilisateurs ni d'autres entités,
  afin de préserver la confidentialité.
- **Priorité** : **P0** · **Env** : staging
- **Automatisable** : partiel — nécessite `collaborateur-pop` + `collaborateur-betc` ;
  à créer.

```gherkin
Scenario: US-MEM-4-S1 [Vermeer] Personal memory never crosses users
  Given collaborateur-pop has personal memory entries
  When collaborateur-betc opens their memory panel (even with the same assistant)
  Then collaborateur-pop's entries are absent from collaborateur-betc's memories API response

Scenario: US-MEM-4-S2 [Vermeer] Personal memory never crosses BU
  Given a personal memory belongs to a POP user
  When a BETC user's session reads memories
  Then that personal memory is absent from the BETC user's memories API response

Scenario: US-MEM-4-S3 [Vermeer] Shared memory may cross BU by design
  Given the "QA Shared Assistant" with curated shared memory is shared POP -> BETC
  When collaborateur-betc opens the assistant
  Then the curated shared memory is visible (by-design, via assistant ACL)
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
Scenario: US-I18N-1-S1 French UI labels
  Given my language is set to French
  When I open the main screens (composer, settings, assistants)
  Then the visible labels display their French translations

Scenario: US-I18N-1-S2 Interpolations and business acronyms preserved
  Given a localized string with an interpolation and acronyms (POP, BETC, USD)
  When it is displayed in French
  Then the rendered text shows the interpolated value filled in
  And the acronyms appear untranslated
```

### US-I18N-2 · Basculer la langue FR / EN

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux basculer entre français et
  anglais, afin de choisir ma langue d'affichage.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : oui — action de réglage.

```gherkin
Scenario: US-I18N-2-S1 Switch language
  Given the UI is in French
  When I switch the language to English in settings
  Then the visible labels display their English text

Scenario: US-I18N-2-S2 Language preference persists
  Given I selected English
  When I reload the app
  Then the visible labels are still in English
```

### US-I18N-3 · Repli propre sur clés non traduites

- **Persona** : Collaborateur
- **Story** : En tant que collaborateur, je veux qu'une zone non encore traduite
  reste lisible, afin de ne jamais voir de libellé cassé.
- **Priorité** : **P2** · **Env** : dev, staging
- **Automatisable** : partiel — à créer.

```gherkin
Scenario: US-I18N-3-S1 [Vermeer] Untranslated key falls back to English
  Given the French coverage is partial (~77% of EN keys)
  When I open a recent area whose key has no FR translation
  Then the English text is displayed (no raw key string, no blank label)

Scenario: US-I18N-3-S2 [Vermeer] No missing-interpolation artifacts
  Given a fallback English string with interpolations
  When it is displayed in a French session
  Then the rendered text shows filled interpolations (no literal "{{var}}" visible)
```

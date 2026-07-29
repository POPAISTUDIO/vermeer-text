# Suite E2E — recette Vermeer Chat sur environnement déployé

Suite Playwright Test qui exécute les cas automatisables du **cahier de recettes trié** contre un
environnement déployé (staging), depuis un poste ou depuis GitHub Actions.

Elle est **indépendante** de la suite E2E upstream de LibreChat (`e2e/specs/`, qui cible un backend
local via `webServer`) : configuration, dépendances et artefacts sont propres à ce dossier. Aucun
fichier upstream n'est modifié.

---

## Sommaire

1. [Lancement local](#1-lancement-local)
2. [Variables requises](#2-variables-requises)
3. [Authentification et régénération de `auth.json`](#3-authentification-et-régénération-de-authjson)
4. [Isolation d'état et ciblage des conversations](#4-isolation-détat-et-ciblage-des-conversations)
5. [Convention de tags](#5-convention-de-tags)
6. [Cas couverts](#6-cas-couverts)
7. [Correspondance tags ↔ workflows CI](#7-correspondance-tags--workflows-ci)
8. [Fixtures](#8-fixtures)
9. [Divergences assumées avec la recette](#9-divergences-assumées-avec-la-recette)
10. [Limites connues](#10-limites-connues)

---

## 1. Lancement local

```bash
cd e2e/staging
npm install
npx playwright install chromium      # une fois

export BASE_URL="https://<hôte-de-l-environnement>"   # jamais committé
# placer la session QA dans e2e/staging/auth.json (cf. §3)

npx playwright test --grep @wave1 --grep-invert @known-issue   # porte de release (11 cas)
npx playwright test --grep @canary   # sous-ensemble rapide (4 cas)
npx playwright test --grep @known-issue   # les seuls défauts connus, hors verdict (§5)
npx playwright test                  # tout, y compris @extra et @known-issue
npx playwright show-report           # rapport HTML du dernier run
```

Raccourcis équivalents : `npm run test:wave1`, `npm run test:canary`,
`npm run test:known-issues`.

> **Le `--grep-invert @known-issue` n'est pas optionnel sur la porte de release** : c'est le
> filtre exact de `qa-nightly.yml`. Sans lui, un run local compte des cas que la CI ne compte
> pas — donc un verdict qui n'est pas celui de la porte (§5).

La suite tourne sur **chromium uniquement**, en **série** (`workers: 1`) : un seul compte QA, et
chaque cas déclenche de vrais appels LLM facturés.

> ### ⚠️ Un run local désynchronise le secret `QA_STORAGE_STATE`
>
> L'application fait de la **rotation de refresh token** (cf. §3) : dès le premier test, le
> token porté par le secret CI est **invalidé** et le nouveau n'existe plus que dans le
> `auth.json` local. Tant que ce fichier n'est pas republié, le prochain run de
> `qa-nightly` / `canary-providers` échoue sur la garde de session (« Session QA expirée »),
> sans qu'aucun défaut produit soit en cause.
>
> **Après tout run local, republier le secret** :
>
> ```bash
> cd e2e/staging
> base64 -i auth.json -o auth.json.b64      # macOS  (Linux : base64 -w0 auth.json > auth.json.b64)
> gh secret set QA_STORAGE_STATE < auth.json.b64
> rm -f auth.json.b64
> ```
>
> Même contrainte dans l'autre sens : lancer un run local **pendant** un run CI casse l'un
> des deux. Les workflows partagent le groupe de concurrence `qa-session` entre eux, mais un
> poste de dev n'en fait pas partie.

---

## 2. Variables requises

| Variable | Obligatoire | Rôle |
|---|---|---|
| `BASE_URL` | **oui** | URL racine de l'environnement cible. Aucune URL n'est codée en dur dans le dépôt. |
| `e2e/staging/auth.json` | **oui** (fichier) | Session QA capturée à la main (SSO). Jamais committé. |
| `E2E_UPLOAD_LIMIT_MB` | non (défaut `10`) | Limite de taille d'upload attendue de l'environnement, utilisée par les messages d'échec des cas FILE. |
| `PLAYWRIGHT_JSON_OUTPUT_NAME` | non (défaut `report.json`) | Chemin du rapport JSON. |
| `CI` | non | Active `retries: 1` et `forbidOnly`. |

Si `BASE_URL` est absent ou si `auth.json` est manquant, la suite **échoue immédiatement au
chargement de la configuration**, avec la marche à suivre — aucun test n'est lancé.

### Secrets attendus côté GitHub Actions

| Secret | Contenu | Utilisé par |
|---|---|---|
| `QA_STAGING_URL` | URL racine de l'environnement cible (alimente `BASE_URL`) | les trois workflows |
| `QA_STORAGE_STATE` | `auth.json` encodé en base64 — **relais, pas valeur figée** (cf. §3) | nightly, canary |
| `VERMEER_SECRETS_TOKEN` | PAT fine-grained, portée **Secrets : Read and write** sur `vermeer-text`, durée 90 j | étape de persistance de session |
| `CLAUDE_CODE_OAUTH_TOKEN` | jeton OAuth Claude Code (déjà en place pour `claude.yml`) | nightly (analyse), triage |

`VERMEER_SECRETS_TOKEN` expire au bout de 90 jours : à son expiration, l'étape de
persistance émet un **warning** (`session rotatée NON republiée`) et le run **suivant**
échoue sur la garde. Le renouvellement du PAT fait donc partie de l'entretien courant.

---

## 3. Authentification et régénération de `auth.json`

L'environnement est derrière un **SSO Entra ID** : aucun login par formulaire n'est possible depuis
un test. L'authentification passe exclusivement par un `storageState` capturé manuellement, injecté
via `use.storageState` dans `playwright.config.ts`.

### Garde de session (à lire avant de déclarer un bug)

Le projet Playwright `guard` (`tests/guard.setup.ts`) tourne **avant tout le reste** ; le projet
`chromium` en dépend. S'il échoue, tous les autres tests restent **non exécutés** (`did not run`) et
le message est sans ambiguïté :

```
Session QA expirée — régénérer QA_STORAGE_STATE (voir e2e/staging/README.md)
Le mur d'authentification est servi sur https://<hôte>/login.
POST /api/auth/refresh → HTTP 401 Refresh token expired or not found for this user
```

Une expiration de session ne doit **jamais** être lue comme un bug produit. Le test de garde porte
tous les tags de la suite (`@guard @wave1 @canary @extra`) pour qu'aucun `--grep` ne puisse le
filtrer et court-circuiter la garde.

### ⚠️ Rotation du refresh token — le `storageState` est à usage unique

L'application fait de la **rotation de refresh token** : au premier chargement, le client appelle
`POST /api/auth/refresh`, et le serveur régénère le refresh token de la session
(`AuthService.setAuthTokens` → `generateRefreshToken(session)`), ce qui **invalide celui qui vient
d'être présenté**.

Conséquences :

- **Dans un run** : la fixture `persistRotatedSession` (`lib/test.ts`) réécrit `auth.json` avec les
  cookies rotatés à la fin de **chaque** test. Combinée à `workers: 1`, elle fait circuler la session
  de test en test. Sans elle, seul le premier test s'authentifie et tous les suivants tombent sur le
  mur de login.
- **Entre deux runs locaux** : l'état rotaté reste dans `auth.json`, donc les runs s'enchaînent.
  En revanche le secret `QA_STORAGE_STATE` porte désormais un token mort : **le republier**
  (cf. l'encadré de §1).
- **En CI** : l'état rotaté vit dans le workspace du job et disparaît avec lui. Une capture
  ne servirait donc qu'une seule fois. Les workflows referment cette boucle : voir la
  mécanique de persistance ci-dessous.

### Persistance de session en CI

`qa-nightly.yml` et `canary-providers.yml` traitent `QA_STORAGE_STATE` comme un **relais**,
pas comme une valeur figée :

1. **Au début du job** — le secret est décodé vers `e2e/staging/auth.json`.
2. **Pendant le run** — la fixture `persistRotatedSession` réécrit ce fichier après chaque
   test, avec les cookies rotatés.
3. **À la fin du job** (`if: always()`) — le fichier est ré-encodé en base64 et republié
   dans le secret via `gh secret set`, authentifié par `VERMEER_SECRETS_TOKEN`.

La session survit ainsi d'un run au suivant, et se prolonge à chaque exécution.

Trois garde-fous à l'étape de persistance : le secret **n'est jamais écrasé** si
`VERMEER_SECRETS_TOKEN` est absent, si `auth.json` est vide, ou si son contenu n'est pas un
JSON valide. Dans ces cas l'étape émet un warning et sort en succès — on préfère un run
suivant qui échoue proprement sur la garde à un secret détruit.

**Limite connue.** Si un run est **annulé ou tué après la rotation mais avant la
persistance** (timeout de job, annulation manuelle, panne du runner), le token rotaté est
perdu : le secret contient encore l'ancien, désormais invalide. Le run suivant échoue sur la
garde avec « Session QA expirée » — il faut alors **régénérer `auth.json` à la main** (§3
ci-dessous) et republier le secret. C'est le seul mode de défaillance qui impose une
intervention humaine ; les deux workflows partagent le groupe de concurrence `qa-session`
précisément pour ne jamais interrompre un run au milieu d'une rotation.

### Régénérer la session

```bash
cd e2e/staging

# 1. Capture interactive : un navigateur s'ouvre, on s'authentifie via le SSO,
#    on attend d'être sur la page de chat, puis on ferme la fenêtre.
npx playwright codegen --save-storage=auth.json "$BASE_URL"

# 2. Vérifier que la capture est exploitable (doit passer)
npx playwright test --project=guard

# 3. Encoder pour le secret CI
base64 -i auth.json -o auth.json.b64      # macOS
# base64 -w0 auth.json > auth.json.b64    # Linux

# 4. Publier le secret
gh secret set QA_STORAGE_STATE < auth.json.b64

# 5. Ne jamais committer ces fichiers (déjà couverts par .gitignore)
rm -f auth.json.b64
```

Côté job CI, le secret est redéployé en fichier avant le run — le secret passe par une
variable d'environnement, jamais en clair dans la ligne de commande :

```yaml
- name: Restaurer la session QA
  env:
    QA_STORAGE_STATE_B64: ${{ secrets.QA_STORAGE_STATE }}
  run: echo "$QA_STORAGE_STATE_B64" | base64 -d > e2e/staging/auth.json
```

`auth.json` et `auth.json.b64` sont dans `.gitignore`. **Aucune session ne doit apparaître dans le
code ni dans l'historique git.**

---

## 4. Isolation d'état et ciblage des conversations

Deux défauts d'**isolation de la suite** — pas de l'application — ont produit des échecs et une
instabilité sur les runs des 26-27/07 (cf. issue #112). Les deux parades sont mutualisées dans
`lib/`, jamais recopiées par spec.

### 4.1 Fixture d'isolation des préférences (`lib/state.ts` + `lib/test.ts`)

**Le problème.** LibreChat persiste nativement le dernier réglage de conversation dans le
`localStorage` (`lastConversationSetup_0`, `lastSelectedModel`, …) : une conversation neuve en
hérite, c'est le comportement produit voulu. Mais le `storageState` réécrit après chaque test par
`persistRotatedSession` embarque **les origines et leur `localStorage`** : le modèle choisi par un
test devenait donc le modèle par défaut du test suivant. GEN-03, qui asserte précisément le modèle
par défaut d'une conversation neuve, lisait le résidu de GEN-02 — « Opus 4.8 » un jour, « Sonnet
4.6 » le lendemain. Le libellé qui change d'un run à l'autre est la signature d'un héritage, jamais
celle d'un défaut produit.

**La parade.** La fixture auto `isolatedPreferences` (`lib/test.ts`) enregistre un `addInitScript`
sur le **contexte**, donc exécuté avant tout script de l'application et valable aussi pour les
onglets ouverts en cours de route (SAV-01). Il purge les clés de préférence de conversation **une
seule fois par test**, avant le premier chargement de page.

| Purgé | Détail |
|---|---|
| Clés exactes | `lastSelectedModel`, `lastSelectedTools`, `lastSelectedSpec`, `lastAgentProvider`, `lastAgentModel`, `filesToDelete`, `isTemporary` — plus leur sibling `<clé>_TIMESTAMP` |
| Préfixes | `lastConversationSetup`, `assistant_id__`, `agent_id__`, `LAST_MCP_`, `LAST_CODE_TOGGLE_`, `LAST_WEB_SEARCH_TOGGLE_`, `LAST_FILE_SEARCH_TOGGLE_`, `LAST_ARTIFACTS_TOGGLE_`, `LAST_SKILLS_TOGGLE_`, `PIN_MCP_`, `PIN_WEB_SEARCH_`, `PIN_CODE_INTERPRETER_`, `textDraft_`, `filesDraft_` |

La liste reprend ce que l'application elle-même considère comme préférence de conversation — union
de `clearLocalStorage()` et `clearAllConversationStorage()`
(`client/src/utils/localStorage.ts`) — augmentée des toggles de capability par conversation et du
couple provider/modèle d'agent. La source de vérité des noms est l'énumération `LocalStorageKeys`
de `packages/data-provider/src/config.ts`.

**Ce qui n'est jamais touché** :

- **Les cookies.** L'authentification est intégralement portée par eux (`refreshToken`,
  `connect.sid`, `token_provider`, `cognito`, cookies Entra ID) ; **aucun jeton
  d'authentification ne vit dans le `localStorage`** de cette application. La purge est donc sans
  effet sur la session, et le relais `persistRotatedSession` fonctionne à l'identique.
- Les préférences d'affichage hors conversation : `i18nextLng`, `color-theme`, `appTitle`,
  `favorites`, `chatsExpanded`, `react-resizable-panels:*`.

**Pourquoi une seule fois par test.** Le drapeau d'idempotence vit dans le `sessionStorage`, qui
n'est pas repris par le `storageState` : il est donc vierge à chaque nouveau contexte, mais
survit aux navigations du test. Sans lui, un `page.goto` en cours de test effacerait un réglage
que le test vient lui-même de poser (`selectModel`, paramètre d'URL `?web_search=true`…).

### 4.2 Ciblage des conversations — ne jamais utiliser `.first()`

**Le problème.** `conversationItems(page).first()` désigne ce que la sidebar met **en tête** :
une conversation **épinglée**, ou la plus récente d'un test précédent. Pas celle que le test vient
de créer. Le désépinglage manuel des conversations du compte QA masquait le symptôme sans corriger
le motif.

**Le titre non plus n'est pas discriminant** : le compte QA porte des conversations homonymes
(« Salutation en Français » y apparaît trois fois, « Friendly Greeting Exchange » deux) — les cas
envoient tous des prompts voisins, donc les titres générés se répètent.

**La parade.** Deux helpers dans `lib/app.ts`, à utiliser dans cet ordre :

| Helper | Rôle |
|---|---|
| `currentConversationId(page, context)` | Identifiant lu dans l'URL applicative (`/c/<uuid>`). C'est **l'ancre** : indépendante de l'ordre de la sidebar, des épinglages, des homonymes et de l'historique du compte. |
| `activeConversationItem(page)` | Item de sidebar de la conversation **ouverte**, via `aria-current="page"` — attribut posé par `ConvoLink` sur le seul item dont l'identifiant est celui de la conversation courante (`Convo.isActiveConvo`). Prise DOM équivalente à l'URL. |

`expectGeneratedTitle(page, context)` compose les deux : conversation persistée (URL `/c/<id>`),
puis item **actif** porteur d'un titre. Il rend le titre lu.

Quand un cas a besoin d'une conversation **avec historique**, il la **crée lui-même** plutôt que
d'emprunter celle du compte QA (cf. NEG-03), et la rouvre par son identifiant (`page.goto('/c/<id>')`).

`conversationItems(page)` reste légitime pour **compter** l'historique (GEN-01, qui asserte son
existence et non une conversation précise).

> **L'API n'est pas une voie de contournement.** Les routes `/api/*` exigent le jeton d'accès que
> le client garde **en mémoire** : `GET /api/convos` répond **401** aussi bien depuis
> `page.request` que depuis un `fetch` exécuté dans la page (seul `POST /api/auth/refresh`, qui ne
> dépend que du cookie, est utilisable — c'est ce que fait la garde de session). Toute vérification
> doit donc passer par l'UI ou par les requêtes que l'application émet elle-même
> (`ask()` capture déjà le corps réel du POST de complétion).

---

## 5. Convention de tags

| Tag | Sens | Cumulable |
|---|---|---|
| `@wave1` | Les cas de la **Vague 1 — porte de release** de la recette triée. **13 cas portent le tag, 11 comptent au verdict** : WEB-01a et WEB-01b dorment sous `@known-issue-114` (§6). | oui |
| `@canary` | Sous-ensemble court et représentatif (4 cas) pour une vérification fréquente et peu coûteuse. | oui (tous aussi `@wave1`) |
| `@extra` | Cas hors Vague 1, implémentés parce qu'ils étaient faussement au vert dans le script exploratoire. Hors porte de release. | oui |
| `@known-issue-N` | **Défaut connu et dépriorisé**, tracé par l'issue GitHub **N**. Sort le cas du verdict P0 **et** de la désignation automatique. | oui — et il **prime sur tous les autres tags** |
| `@guard` | Garde de session uniquement. Porte aussi tous les autres tags pour ne jamais être filtré. | — |

Le filtrage se fait exclusivement par `--grep` : la CI ne connaît que des tags, jamais des chemins de
fichiers.

### La règle du rouge et le tag `@known-issue-N`

> **Tout cas rouge est soit un bug qui déclenche la boucle, soit un défaut connu tracé
> `@known-issue-N` hors verdict. Jamais un rouge d'habitude.**
> — [`docs/GOVERNANCE.md` §5](../../docs/GOVERNANCE.md)

Un cas qui échoue en permanence n'apporte aucun signal : il habitue l'œil au rouge et, depuis la
désignation automatique, **il remet un agent en marche chaque nuit**. Un cas qui vérifie une
promesse que le produit ne tient pas encore se **scinde** — la part tenue reste au verdict, la
part non tenue prend le tag — il ne se supprime pas et ne se laisse pas rougir.

**Ce que le tag produit, mécaniquement, aux deux bouts de la chaîne :**

| Où | Effet |
|---|---|
| Suite / CI | `qa-nightly.yml` filtre `--grep @wave1 --grep-invert @known-issue` : le cas ne tourne pas et ne compte pas dans le verdict. Il garde son tag `@wave1` — c'est le tag `@known-issue-N` qui l'en sort |
| Triage désignateur | Étape 0 de `qa-triage.yml` (garde-fou 3) : **ni issue, ni label**, et pas de commentaire sur l'issue N — seulement une ligne au Dossier QA avec renvoi à N. Second filet, pour les runs lancés à la main ou filtrés autrement |

**Conventions d'emploi :**

- `N` est un **numéro d'issue GitHub existant et instruit**. Un tag sans issue derrière est un cas
  supprimé en douce — exactement ce que la règle interdit.
- **Le cas garde ses tags d'origine** (`@wave1`, `@canary`). Retirer le seul `@known-issue-N` le
  réintègre entièrement au verdict : c'est un diff d'un mot, le jour où le correctif livre.
- **Un seul `@known-issue-N` par cas.** Deux défauts connus sur un même cas = un cas à scinder.
- **Poser ou retirer ce tag est une décision humaine**, prise en PR. Aucun agent ne le pose : c'est
  le veto persistant de l'humain (GOVERNANCE.md §2, garde-fou 3).
- Le tag n'est pas un `test.skip` : le cas reste exécutable à la demande
  (`npm run test:known-issues`) et c'est lui qui prouvera le correctif.

---

## 6. Cas couverts

> **Convention — renommer un identifiant de cas.** Tout nouvel identifiant issu d'un
> renommage ou d'une scission **doit citer son identifiant ancêtre** (ici et dans le titre de
> l'issue instruite). La passe 1 de la déduplication du triage filtre par **identifiant présent
> dans les titres d'issues** : un renommage muet orphelinise l'historique — `WEB-01a` ne
> retrouve pas les issues de `WEB-01` — et le triage rouvre une issue neuve sur un défaut déjà
> tracé.

### `@wave1` — porte de release (11 cas au verdict)

Deux cas portent `@wave1` sans compter au verdict : ils dorment sous `@known-issue-114`
(section dédiée plus bas). Le filtre de la porte retourne donc **11 cas + la garde**.

| Cas | Tags | Ce qui est réellement asservi |
|---|---|---|
| GEN-01 | `@wave1` | Application authentifiée, titre `Vermeer LLM & Agentic Portal`, **au moins une** conversation restituée dans la sidebar (existence de l'historique, pas une conversation précise). |
| GEN-02 | `@wave1` `@canary` | Opus 4.8 **et** Sonnet 4.6 : statut HTTP de la complétion, flux progressif observé, réponse non vide, titre généré **pour la conversation du test** (item actif de la sidebar, ancré sur l'URL — cf. §4.2). |
| GEN-03 | `@wave1` `@canary` | Modèle par défaut affiché = `GPT-5.2 (Équilibré)`, puis réponse en streaming. Suppose l'absence de réglage hérité — garantie par la fixture d'isolation (§4.1). |
| GEN-06 | `@wave1` `@canary` | Gemini 3 Flash répond ; **tout 403/permission fait échouer** le cas (régression clé GCP). |
| SEL-01 | `@wave1` `@canary` | Catalogue du sélecteur : présence de chaque modèle par groupe, **ordre** asservi pour OpenAI, nombre d'entrées par groupe, et `gemini-2.0-flash-001` absent. |
| MOD-02 | `@wave1` | Fichiers / Mémoires / Skills / Paramètres s'ouvrent en modale et se ferment par Esc, clic backdrop et bouton X ; composer retrouvé ; réouverture possible. |
| CTX-02 | `@wave1` | `maxContextTokens=50000` persiste après rechargement, et une conversation **neuve** revient à `Système` (garde anti-contamination). **SKIP motivé sur ce build** : le champ n'est pas exposé dans la modale Paramètres (cf. §9.3). |
| NEG-03 | `@wave1` | Bouton d'envoi désactivé pendant l'hydratation d'une conversation, puis envoi porteur du **`conversationId` de la conversation ouverte** + d'un `parentMessageId` (pas de branche sans contexte). La conversation est **créée par le test** (2 complétions, cf. §9.5). |
| FILE-01 | `@wave1` | Statut HTTP réel de l'upload, vignette visible, et réponse du modèle **décrivant le contenu visuel** de l'image. |
| FILE-03 | `@wave1` | Image **sans texte** : pas de 400 ; puis message de suite : pas de 400 (non-régression #20). |
| SAV-01 | `@wave1` | « Signaler un problème » ouvre un onglet dont l'URL correspond au `reportIssueURL` **lu depuis `/api/config`** (aucune URL en dur). |

### `@canary` (4 cas)

`GEN-02`, `GEN-03`, `GEN-06`, `SEL-01` — tous également `@wave1`.

### `@known-issue-N` — hors verdict et hors désignation (2 cas)

**Les deux moitiés de WEB-01 (ancêtre : `WEB-01`) dorment sous l'issue 114.** La scission du
29/07/2026 visait à garder au verdict la part tenue du cas ; l'**épreuve du 29/07 au soir**
(run local unique contre staging, WEB-01a rouge — « Mentions de sources : 0 », réponse sans
recherche web) a montré qu'il n'y en avait pas : **#114 couvre le service, pas seulement
l'affichage des citations.** Les deux cas restent donc dans la suite, exécutables à la demande
(`npm run test:known-issues`), et réintègrent le verdict par le retrait du seul tag
`@known-issue-114` — ce sont eux qui prouveront le correctif de WEB-01 phase 2.

| Cas | Tags | Issue | Ce qui est asservi, et pourquoi c'est hors verdict |
|---|---|---|---|
| WEB-01a | `@wave1` `@known-issue-114` | **114** | Réponse **annoncée comme appuyée sur le web** (mention de sources), puis **relance sans 400** (`user messages must have non-empty content`). Sorti du verdict après l'épreuve du 29/07/2026 : la recherche web n'est pas déclenchée, la part conservée ne tient pas davantage que les citations. Bémol à instruire à la **refonte du cas en vague 2** : le prompt du cas invite à une demande de précision, et le modèle a répondu par une question — la part imputable à la formulation n'est pas prouvable sur un seul passage. |
| WEB-01b | `@wave1` `@known-issue-114` | **114** | Les **citations sont affichées** dans la réponse (au moins un lien cliquable). Volet historique de #114, dépriorisé le temps de WEB-01 phase 2 (observabilité puis correctif). |

### `@extra` — hors porte de release (3 cas)

| Cas | Pourquoi il est là |
|---|---|
| FILE-02 | Upload 1,5 Mo : **statut HTTP réel** du POST, aucun 413. Le script exploratoire concluait sur une regex dans le texte de la page. |
| FILE-04 | Upload 8 Mo : idem, limite du load balancer. |
| SKL-01c | Sélection d'un skill en 1 clic depuis la modale de création (Réf. #103). **Échoue explicitement si la liste de skills est vide** — le script exploratoire renvoyait « CODE-VERIFIED » et un PASS sur liste vide, ce qui masquait entièrement la régression que le cas doit détecter. |

---

## 7. Correspondance tags ↔ workflows CI

Trois workflows, dans `.github/workflows/` :

| Workflow | Nom affiché | Déclencheur | Filtre | Rôle |
|---|---|---|---|---|
| `qa-nightly.yml` | `QA Nightly — Staging` | cron `30 4 * * 1-5` (06h30 Paris été) + manuel | `--grep @wave1 --grep-invert @known-issue` | Porte de release. Rouge = pas de release. Analyse du rapport et tenue du **Dossier QA nightly** (label `qa-nightly`). |
| `canary-providers.yml` | `Canary Providers` | cron `0 5 * * 1-5` + manuel | `--grep @canary` | Garde-fou court (4 cas, ~4 min). Ouvre une issue `canary`/`infra` si rouge. Aucun cas `@canary` n'est aujourd'hui tagué `@known-issue-N` ; le jour où il y en aurait un, ce filtre est à aligner sur celui de la nightly. |
| `qa-triage.yml` | `QA Triage` | `workflow_run` sur la nightly **en échec** | — | Classe les échecs et n'ouvre des issues `claude-fix` que pour les vrais bugs produit. **Second désignateur** : ses six garde-fous sont prescrits par [`GOVERNANCE.md` §2](../../docs/GOVERNANCE.md). |
| `qa-triage-replay.yml` | `QA Triage — rejeu sur fixtures` | `workflow_dispatch` | — | **Test de garde** du triage : rejeu du prompt vivant sur fixtures archivées, en dry-run vis-à-vis de GitHub. Mode d'emploi : [`fixtures/triage/README.md`](fixtures/triage/README.md). |

Les cas `@extra` (FILE-02, FILE-04, SKL-01c) ne sont dans **aucun** workflow planifié : ils
se lancent à la main (`npx playwright test` sans filtre), étant hors porte de release.

### Ce que chaque workflow fait de la session

`qa-nightly` et `canary-providers` partagent le groupe de concurrence **`qa-session`** (sans
annulation) : la session staging ne supporte pas deux consommateurs simultanés. Tous deux
restaurent la session au début et **republient l'état rotaté à la fin** (cf. §3).

### Chaîne de traitement des échecs

```
QA Nightly (échec) ──workflow_run──> QA Triage ──label claude-fix──> Claude Code (claude.yml)
                    │                          │
                    └─> Dossier QA nightly <───┘  (session expirée / flaky / indéterminé)
```

Un échec de la **garde de session** ne produit jamais d'issue `claude-fix` : il est reporté
en une ligne actionnable sur le Dossier QA. Une expiration de session n'est pas un bug.

Le triage plafonne à **3 issues créées par run**. Trois bornes de plus encadrent sa
désignation (chantier 4, détail en [`GOVERNANCE.md` §2](../../docs/GOVERNANCE.md)) :

- **Déduplication par signature d'échec** en deux passes — filtre grossier par identifiant de
  cas dans les titres, puis confrontation de la signature
  `<!-- signature: cas | fichier | assertion normalisée -->` inscrite dans le corps de l'issue.
  Signature identique → commentaire sur l'existante ; signature différente sur le même cas →
  nouvelle issue, c'est un autre échec.
- **Exclusion des cas `@known-issue-N`** (§5) — ni issue, ni label.
- **Plafond de 2 tentatives** — compté dans les marqueurs `<!-- tentative: X -->` des
  commentaires de l'issue. À la première rechute, le triage repose le label pour relancer
  l'agent (retrait + re-pose : l'agent ne se réveille que sur l'événement de pose). À la
  seconde, il retire le label définitivement, écrit une synthèse et assigne l'issue à
  l'humaine. Un label retiré à la main n'est **jamais** reposé.

---

## 8. Fixtures

```bash
npm run fixtures      # (re)génère fixtures/sample-*.png
```

| Fixture | Contenu | Versionnée |
|---|---|---|
| `sample-small.png` | 640×480, disque rouge + rectangle bleu sur fond blanc — contenu décrivable par un modèle de vision | oui |
| `sample-1.5mb.png` | bruit déterministe, 1,50 Mo | non (générée) |
| `sample-8mb.png` | bruit déterministe, 8,00 Mo | non (générée) |

`lib/fixtures.ts` génère à la demande toute fixture absente, donc rien à préparer en CI.

`fixtures/triage/` n'a rien à voir avec les images : ce sont les **rapports archivés** qui
servent de tests de garde au triage désignateur — voir
[`fixtures/triage/README.md`](fixtures/triage/README.md).

Les fixtures historiques de `~/qa-staging-vermeer/shots/sample-*.png` **n'ont pas été reprises** :
ce ne sont pas des images (signature PNG suivie d'un remplissage d'espaces — `file` les identifie
comme `data`). Un serveur rejetant une image invalide renverrait un 4xx de validation, ce qui
masquerait le sujet réel des cas FILE (limite de taille, prise en compte du contenu visuel).

---

## 9. Divergences assumées avec la recette

1. **FILE-02 / FILE-04 et le 413.** La recette attend l'**absence** de 413 jusqu'à ~10 Mo (« LB limit
   raised to 10 MB ») ; le brief de ce chantier mentionnait un « 413 attendu au-delà de 1 Mo ». Les
   deux cas implémentent le **mécanisme** demandé (assertion sur le statut HTTP réel du POST
   d'upload, capturé sur le réseau) et l'**attente de la recette** (aucun 413 sous la limite). La
   limite est pilotée par `E2E_UPLOAD_LIMIT_MB` : si la limite réelle de l'environnement est
   inférieure, c'est une seule variable à changer, et le message d'échec pose explicitement les deux
   lectures possibles.
2. **FILE-02 est un cas PDF dans la recette** (P2 : « attach a PDF/document », réponse ancrée dans le
   document + présence dans l'historique des fichiers). Le cas implémenté ici reprend le périmètre
   *taille* du script exploratoire. Le volet PDF/RAG n'est pas couvert (cf. §10).
3. **CTX-02 n'est pas exerçable sur ce build.** La modale Paramètres de Vermeer est le
   panneau « light » (Créativité, Réflexion approfondie, Recherche web, Mémoire
   automatique) : le champ « Jetons de contexte maximum » n'y est pas exposé, les réglages
   avancés étant masqués côté Vermeer (`SHOW_ADVANCED_SETTINGS`). Aucun autre point d'entrée
   UI ne permet de saisir la valeur. Le test s'annonce donc **SKIP avec motif explicite**
   plutôt que de conclure au vert, et redeviendra actif de lui-même si le réglage est
   ré-exposé. En l'état, CTX-02 reste une vérification manuelle (ou nécessite une décision
   produit de ré-exposition).
4. **GEN-01 et le login SSO.** Les étapes « cliquer Sign in » et « s'authentifier via Entra ID » ne
   sont pas automatisables. La garde de session couvre l'état authentifié ; le cas GEN-01 asserte le
   reste (titre, historique). Le parcours de login lui-même reste une vérification manuelle.
5. **NEG-03 : fenêtre d'hydratation suspendue, et conversation créée par le test.** La fenêtre
   réelle est trop courte pour être observée de façon fiable. Elle n'est plus **retardée** d'un
   délai fixe (4 s), ce qui laissait une course entre la temporisation et les assertions : la
   récupération `GET /api/messages/*` est **suspendue jusqu'à libération explicite** par le test.
   La fenêtre reste donc ouverte aussi longtemps qu'il le faut, et il n'y a plus rien à
   chronométrer. Le test vérifie d'ailleurs que la requête est bien retenue **avant** d'asserter le
   bouton désactivé : à défaut, il échouait auparavant sans qu'aucune hydratation ait eu lieu. Le
   filtre de route porte sur l'**identifiant de la conversation** : `useGetMessagesByConvoId`
   n'exclut pas la conversation neuve, donc `GET /api/messages/new` est bien émis sur `/c/new` et un
   filtre large consommait le `times: 1` sur cette requête-là — mécanisme le plus probable derrière
   l'échec intermittent (KO en 1ʳᵉ tentative, OK au retry) observé sur le run 30254386452.
   La sortie de fenêtre est attendue sur la **fin réelle** de l'hydratation (arbre de messages
   rendu — c'est ce rendu qui pose l'atome `latestMessage` d'où dérive `parentMessageId`), pas sur
   un délai. Contrepartie assumée : la conversation exercée est **créée par le test** (§4.2), ce
   qui coûte **une complétion supplémentaire** mais supprime la dépendance à l'historique du
   compte QA et à l'ordre de la sidebar. La réouverture se fait par `page.goto('/c/<id>')` : la
   cible est l'identifiant, sans ambiguïté possible.
6. **SEL-01 est étiqueté P1** dans la recette mais appartient à la Vague 1 ; il est donc tagué
   `@wave1` (et `@canary`).

---

## 10. Limites connues

- **Rotation du refresh token — traitée, mais pas supprimée.** La réinjection du secret en fin
  de job est **implémentée** dans `qa-nightly.yml` et `canary-providers.yml` (cf. §3
  « Persistance de session en CI »). Contrepartie assumée : la CI détient un PAT autorisé à
  écrire les secrets du dépôt (`VERMEER_SECRETS_TOKEN`), et un run tué entre la rotation et la
  persistance impose une régénération manuelle. Deux alternatives restent ouvertes, par ordre
  de robustesse :
  1. **Compte de service QA en authentification locale** (email + mot de passe hors SSO), si
     l'environnement peut en exposer un : supprime totalement le problème, rend la suite
     autonome et permet de retirer le PAT. **C'est la cible recommandée.**
  2. **Reprise SSO silencieuse** : les cookies Entra persistants présents dans la capture
     (`ESTSAUTHPERSISTENT`, ~3 mois de validité) permettent de reminter une session en visitant
     `/oauth/openid` sans saisir d'identifiant. Vérifié manuellement contre staging. Non implémenté
     ici : cela masquerait l'expiration de session que la garde doit précisément rendre visible.
- **WEB-01 ne laisse plus rien au verdict — arbitrage tranché le 29/07/2026, sur épreuve.**
  OBSERVED (Dossier QA #112, runs des 27, 28 et 29/07) : sur **chaque** échec archivé de
  l'ancien WEB-01, le message portait *« Liens détectés : 0. Mentions de sources : 0 »* — les
  **deux** compteurs à zéro, et non les seuls liens. Confirmé en direct le 29/07 au soir par un
  **run local unique** de WEB-01a contre staging : rouge, *« Mentions de sources : 0 »*, réponse
  rendue sans recherche web (garde de session passée, `retries=0`, un seul passage). La lecture
  « seul l'affichage des citations manque » n'est donc pas celle des faits : **#114 couvre le
  service**. Les deux moitiés portent `@known-issue-114` (§6) — plutôt qu'un rouge d'habitude au
  verdict, qui désignerait un agent chaque nuit sur un défaut déjà tracé et dépriorisé (§5).
  Deux réserves, renvoyées et non enterrées : (a) le prompt du cas invite à une demande de
  précision et le modèle a répondu par une question — part imputable à la **formulation**, non
  prouvable sur un passage, à instruire à la **refonte du cas en vague 2** ; (b) **UNKNOWN** :
  rien ne prouve dans les artefacts que le backend a bien reçu `web_search: true` (Playwright
  n'enregistre pas le corps du POST ; côté client, l'URL portait `?web_search=true` et l'état
  persisté `web_search: true`) — à trancher par Loki en **WEB-01 phase 2**.
- **Anomalie ouverte sur l'upload de 1,5 Mo (FILE-02).** La vignette apparaît dans le
  composer mais **aucun POST d'upload n'est émis** (observé sur 20 s, sans toast d'erreur),
  alors que l'image de 8 Mo (FILE-04) est bien envoyée et acceptée. Le redimensionnement
  client n'est pas en cause (`shouldResizeImage` ne s'active qu'au-delà de 10 % de la limite,
  soit ~51 Mo). Deux hypothèses restent ouvertes : comportement du pipeline de fichiers côté
  client, ou fixture de bruit pathologique pour ce pipeline. Le test échoue avec ce constat
  explicite — à investiguer côté produit avant de conclure.
- **Typecheck sans dépendance ajoutée.** La suite ne dépend que de `@playwright/test`
  (Playwright transpile le TypeScript lui-même). Pour un contrôle de types :
  `npm run typecheck` (récupère `typescript` et `@types/node` de façon transitoire).
- **Pas de couverture PDF / RAG** (FILE-02 volet document) : `RAG_API_URL` n'est pas garanti
  opérationnel sur les environnements (cf. `CLAUDE.md` §9).
- **SKL-01c dépend des données du compte QA** : au moins un skill doit exister. Le test échoue avec
  la marche à suivre plutôt que de passer par défaut.
- **Les cas Vague 2 et Vague 3 de la recette ne sont pas couverts** (11 et 10 cas). La structure —
  helpers `lib/`, tags, garde — est prévue pour les accueillir sans refonte.
- **Coût** : un run `@wave1` complet déclenche une dizaine de complétions réelles, dont deux
  recherches web — et depuis l'amorçage de sa propre conversation par NEG-03, **une de plus**
  (prompt court, modèle par défaut). À garder en tête pour la fréquence de la planification.
- **Un run local désynchronise le secret `QA_STORAGE_STATE`** : le republier après coup, sinon le
  prochain run CI échoue sur la garde de session. Marche à suivre dans l'encadré de §1.

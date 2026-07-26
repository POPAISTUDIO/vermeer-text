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
4. [Convention de tags](#4-convention-de-tags)
5. [Cas couverts](#5-cas-couverts)
6. [Correspondance tags ↔ workflows CI](#6-correspondance-tags--workflows-ci)
7. [Fixtures](#7-fixtures)
8. [Divergences assumées avec la recette](#8-divergences-assumées-avec-la-recette)
9. [Limites connues](#9-limites-connues)

---

## 1. Lancement local

```bash
cd e2e/staging
npm install
npx playwright install chromium      # une fois

export BASE_URL="https://<hôte-de-l-environnement>"   # jamais committé
# placer la session QA dans e2e/staging/auth.json (cf. §3)

npx playwright test --grep @wave1    # porte de release : les 12 cas de la Vague 1
npx playwright test --grep @canary   # sous-ensemble rapide (4 cas)
npx playwright test                  # tout, y compris les cas @extra
npx playwright show-report           # rapport HTML du dernier run
```

Raccourcis équivalents : `npm run test:wave1`, `npm run test:canary`.

La suite tourne sur **chromium uniquement**, en **série** (`workers: 1`) : un seul compte QA, et
chaque cas déclenche de vrais appels LLM facturés.

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
- **En CI** : l'état rotaté vit dans le workspace du job et disparaît avec lui. **Le secret
  `QA_STORAGE_STATE` n'est donc réutilisable qu'une fois par capture.** Voir §9 pour les options.

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

Côté job CI, le secret est redéployé en fichier avant le run :

```yaml
- name: Restaurer la session QA
  run: echo "${{ secrets.QA_STORAGE_STATE }}" | base64 --decode > e2e/staging/auth.json
```

`auth.json` et `auth.json.b64` sont dans `.gitignore`. **Aucune session ne doit apparaître dans le
code ni dans l'historique git.**

---

## 4. Convention de tags

| Tag | Sens | Cumulable |
|---|---|---|
| `@wave1` | Les 12 cas de la **Vague 1 — porte de release** de la recette triée. C'est la porte de release. | oui |
| `@canary` | Sous-ensemble court et représentatif (4 cas) pour une vérification fréquente et peu coûteuse. | oui (tous aussi `@wave1`) |
| `@extra` | Cas hors Vague 1, implémentés parce qu'ils étaient faussement au vert dans le script exploratoire. Hors porte de release. | oui |
| `@guard` | Garde de session uniquement. Porte aussi tous les autres tags pour ne jamais être filtré. | — |

Le filtrage se fait exclusivement par `--grep` : la CI ne connaît que des tags, jamais des chemins de
fichiers.

---

## 5. Cas couverts

### `@wave1` — porte de release (12 cas)

| Cas | Tags | Ce qui est réellement asservi |
|---|---|---|
| GEN-01 | `@wave1` | Application authentifiée, titre `Vermeer LLM & Agentic Portal`, historique de conversations restitué dans la sidebar. |
| GEN-02 | `@wave1` `@canary` | Opus 4.8 **et** Sonnet 4.6 : statut HTTP de la complétion, flux progressif observé, réponse non vide, titre de conversation généré. |
| GEN-03 | `@wave1` `@canary` | Modèle par défaut affiché = `GPT-5.2 (Équilibré)`, puis réponse en streaming. |
| GEN-06 | `@wave1` `@canary` | Gemini 3 Flash répond ; **tout 403/permission fait échouer** le cas (régression clé GCP). |
| SEL-01 | `@wave1` `@canary` | Catalogue du sélecteur : présence de chaque modèle par groupe, **ordre** asservi pour OpenAI, nombre d'entrées par groupe, et `gemini-2.0-flash-001` absent. |
| MOD-02 | `@wave1` | Fichiers / Mémoires / Skills / Paramètres s'ouvrent en modale et se ferment par Esc, clic backdrop et bouton X ; composer retrouvé ; réouverture possible. |
| CTX-02 | `@wave1` | `maxContextTokens=50000` persiste après rechargement, et une conversation **neuve** revient à `Système` (garde anti-contamination). **SKIP motivé sur ce build** : le champ n'est pas exposé dans la modale Paramètres (cf. §8.3). |
| NEG-03 | `@wave1` | Bouton d'envoi désactivé pendant l'hydratation d'une conversation, puis envoi porteur de `conversationId` + `parentMessageId` (pas de branche sans contexte). |
| FILE-01 | `@wave1` | Statut HTTP réel de l'upload, vignette visible, et réponse du modèle **décrivant le contenu visuel** de l'image. |
| FILE-03 | `@wave1` | Image **sans texte** : pas de 400 ; puis message de suite : pas de 400 (non-régression #20). |
| WEB-01 | `@wave1` | Réponse sourcée, puis **relance sans 400** (`user messages must have non-empty content`). |
| SAV-01 | `@wave1` | « Signaler un problème » ouvre un onglet dont l'URL correspond au `reportIssueURL` **lu depuis `/api/config`** (aucune URL en dur). |

### `@canary` (4 cas)

`GEN-02`, `GEN-03`, `GEN-06`, `SEL-01` — tous également `@wave1`.

### `@extra` — hors porte de release (3 cas)

| Cas | Pourquoi il est là |
|---|---|
| FILE-02 | Upload 1,5 Mo : **statut HTTP réel** du POST, aucun 413. Le script exploratoire concluait sur une regex dans le texte de la page. |
| FILE-04 | Upload 8 Mo : idem, limite du load balancer. |
| SKL-01c | Sélection d'un skill en 1 clic depuis la modale de création (Réf. #103). **Échoue explicitement si la liste de skills est vide** — le script exploratoire renvoyait « CODE-VERIFIED » et un PASS sur liste vide, ce qui masquait entièrement la régression que le cas doit détecter. |

---

## 6. Correspondance tags ↔ workflows CI

Les workflows GitHub Actions ne sont **pas** fournis ici (le périmètre de ce chantier est strictement
`e2e/`). Correspondance visée, avec le job prêt à coller :

| Workflow | Déclencheur | Filtre | Attente |
|---|---|---|---|
| `qa-canary` | à chaque déploiement staging, et manuel | `--grep @canary` | ~4 min, garde-fou rapide |
| `qa-wave1` | avant toute release, et nocturne | `--grep @wave1` | porte de release : rouge = pas de release |
| `qa-full` | manuel | aucun filtre | inclut les cas `@extra` |

```yaml
name: qa-wave1
on:
  workflow_dispatch:
  schedule: [{ cron: '0 3 * * 1-5' }]

jobs:
  wave1:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: e2e/staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Restaurer la session QA
        run: echo "${{ secrets.QA_STORAGE_STATE }}" | base64 --decode > auth.json
      - name: Recette Vague 1
        env:
          BASE_URL: ${{ secrets.QA_BASE_URL }}
          PLAYWRIGHT_JSON_OUTPUT_NAME: report.json
        run: npx playwright test --grep @wave1
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: qa-wave1-report
          path: |
            e2e/staging/report.json
            e2e/staging/playwright-report/
            e2e/staging/test-results/
```

`BASE_URL` passe par un secret (`QA_BASE_URL`) : l'URL de l'environnement n'entre pas dans le dépôt.

---

## 7. Fixtures

```bash
npm run fixtures      # (re)génère fixtures/sample-*.png
```

| Fixture | Contenu | Versionnée |
|---|---|---|
| `sample-small.png` | 640×480, disque rouge + rectangle bleu sur fond blanc — contenu décrivable par un modèle de vision | oui |
| `sample-1.5mb.png` | bruit déterministe, 1,50 Mo | non (générée) |
| `sample-8mb.png` | bruit déterministe, 8,00 Mo | non (générée) |

`lib/fixtures.ts` génère à la demande toute fixture absente, donc rien à préparer en CI.

Les fixtures historiques de `~/qa-staging-vermeer/shots/sample-*.png` **n'ont pas été reprises** :
ce ne sont pas des images (signature PNG suivie d'un remplissage d'espaces — `file` les identifie
comme `data`). Un serveur rejetant une image invalide renverrait un 4xx de validation, ce qui
masquerait le sujet réel des cas FILE (limite de taille, prise en compte du contenu visuel).

---

## 8. Divergences assumées avec la recette

1. **FILE-02 / FILE-04 et le 413.** La recette attend l'**absence** de 413 jusqu'à ~10 Mo (« LB limit
   raised to 10 MB ») ; le brief de ce chantier mentionnait un « 413 attendu au-delà de 1 Mo ». Les
   deux cas implémentent le **mécanisme** demandé (assertion sur le statut HTTP réel du POST
   d'upload, capturé sur le réseau) et l'**attente de la recette** (aucun 413 sous la limite). La
   limite est pilotée par `E2E_UPLOAD_LIMIT_MB` : si la limite réelle de l'environnement est
   inférieure, c'est une seule variable à changer, et le message d'échec pose explicitement les deux
   lectures possibles.
2. **FILE-02 est un cas PDF dans la recette** (P2 : « attach a PDF/document », réponse ancrée dans le
   document + présence dans l'historique des fichiers). Le cas implémenté ici reprend le périmètre
   *taille* du script exploratoire. Le volet PDF/RAG n'est pas couvert (cf. §9).
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
5. **NEG-03 et la fenêtre d'hydratation.** La fenêtre réelle est trop courte pour être observée de
   façon fiable. Le test la rend déterministe en retardant `GET /api/messages/*` de 4 s : c'est bien
   le comportement de l'application pendant le chargement qui est asservi, pas un timing de course.
6. **SEL-01 est étiqueté P1** dans la recette mais appartient à la Vague 1 ; il est donc tagué
   `@wave1` (et `@canary`).

---

## 9. Limites connues

- **Le secret CI n'est utilisable qu'une fois** (rotation du refresh token, cf. §3). Trois pistes,
  par ordre de robustesse :
  1. **Compte de service QA en authentification locale** (email + mot de passe hors SSO), si
     l'environnement peut en exposer un : supprime totalement le problème et rend la suite
     autonome.
  2. **Reprise SSO silencieuse** : les cookies Entra persistants présents dans la capture
     (`ESTSAUTHPERSISTENT`, ~3 mois de validité) permettent de reminter une session en visitant
     `/oauth/openid` sans saisir d'identifiant. Vérifié manuellement contre staging. Non implémenté
     ici : cela masquerait l'expiration de session que la garde doit précisément rendre visible.
  3. **Réinjection du secret en fin de job** (`gh secret set` avec un PAT) : fonctionnel, mais donne
     à la CI le droit d'écrire les secrets.
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
  recherches web. À garder en tête pour la fréquence de la planification.

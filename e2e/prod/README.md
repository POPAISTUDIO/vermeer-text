# Sonde de production

**Ce que c'est** : un aller-retour minimal par fournisseur sur `llm.vermeer.ai`, chaque jour, et le verdict qui va avec. Elle répond à une seule question — **un utilisateur réel obtient-il une réponse d'un modèle ?** — pour Anthropic, OpenAI et Google.

**Ce que ce n'est pas** : une recette. Elle ne juge pas le contenu des réponses, ne teste aucune interface, ne couvre aucune fonctionnalité. C'est une sonde de **vivacité**.

Elle est aussi le **smoke post-MEP** : après une mise en production, un `workflow_dispatch` de ce workflow est la vérification que les trois fournisseurs répondent. Il n'y a pas d'autre smoke prod à chercher.

---

## Si vous revenez après six mois — les cinq choses à savoir

1. **Rien à installer.** `node e2e/prod/sonde.mjs`, c'est tout. Pas de `npm ci`, pas de Playwright, pas de navigateur, pas de TypeScript. C'est délibéré (voir [Voie A](#voie-a--pourquoi-du-code-dupliqué)).
2. **Trois variables d'environnement** suffisent : `BASE_URL`, `QA_SERVICE_EMAIL`, `QA_SERVICE_PASSWORD`. En CI elles viennent des secrets `QA_PROD_URL`, `QA_SERVICE_EMAIL_PROD`, `QA_SERVICE_PASSWORD_PROD`.
3. **Ne relancez jamais la sonde après un `ARRET NET`.** Une seule requête mal en-têtée peut faire bannir le compte de service, dont le mot de passe **n'est pas rotable** (voir [`uaParser`](#le-contournement-uaparser)).
4. **Le compte de service ne se répare pas, il se recrée** — et le recréer suppose de rouvrir l'inscription en production. Procédure : registre des identités, entrée **13b**. Ne l'improvisez pas.
5. **La sonde ne couvre pas la génération de titre.** C'est un choix, écrit et motivé plus bas.

## Lancer la sonde

### En CI

Workflow [`prod-sonde.yml`](../../.github/workflows/prod-sonde.yml). Deux déclencheurs, **un seul code** :

| Déclencheur                           | Rôle                                                       | Quand                       |
| ------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| `schedule`, 05h30 UTC, tous les jours | **canary** — personne ne regarde, c'est l'alerte qui parle | en continu                  |
| `workflow_dispatch`                   | **smoke** — on regarde                                     | après une MEP, ou sur doute |

Faire deux workflows garantirait qu'un des deux se périme. La production ne connaissant pas le week-end, le cron tourne sept jours sur sept — contrairement au canary staging, en `1-5`.

L'entrée **`forcer_rouge`** du dispatch provoque un échec **avant tout appel LLM** et sans rien créer en production. Elle sert à vérifier que la chaîne d'alerte fonctionne (issue + notification), pas à tester la sonde.

### En local

```bash
export BASE_URL="https://<hôte-de-l-environnement>"      # aucune URL n'est écrite dans ce dépôt
export QA_SERVICE_EMAIL="svc-qa-prod@vermeer.invalid"
read -rs QA_SERVICE_PASSWORD && export QA_SERVICE_PASSWORD   # saisie masquée, pas d'historique
node e2e/prod/sonde.mjs
```

Sortie 0 si tous les fournisseurs sont verts **et** que toutes les conversations créées ont été supprimées ; 1 sinon.

## Le verdict — quatre conditions, et pourquoi pas une

`POST /api/agents/chat/:endpoint` rend immédiatement `{ streamId, conversationId, status: 'started' }` : la génération est découplée de la connexion HTTP. **Lire le corps du POST ne prouve rien** — il vaut `started` même si le fournisseur est mort. La sonde interroge donc la **conversation persistée**, en boucle.

Et un message présent n'est pas non plus une preuve de succès : **LibreChat persiste aussi les échecs**, sous trois formes distinctes.

| Cas                               | `error`     | `unfinished` | `finish_reason` |
| --------------------------------- | ----------- | ------------ | --------------- |
| Échec complet, rien streamé       | `true`      | `false`      | —               |
| **Échec après streaming partiel** | **`false`** | **`true`**   | —               |
| Abort                             | `false`     | `false`      | `'incomplete'`  |

Le deuxième cas est le piège : `abortMiddleware.js` **remet explicitement `error: false`** et bascule le discriminant sur `unfinished: true`. Une sonde qui ne testerait que `error` classerait vert un fournisseur qui a lâché en cours de route.

**VERT** exige donc, cumulativement : un message `isCreatedByUser: false`, un texte non vide **extrait des `content` parts**, ni `error`, ni `unfinished`, ni `finish_reason: 'incomplete'`, et aucun `content` part de type `error`.

⚠️ **Le texte se lit dans `content`, pas dans `m.text`.** Sur le chemin agents, `m.text` est **vide** : un message sain porte `content: [{ type: 'text', text: 'PONG' }]` et `text: ''`. Une sonde qui lirait `m.text` boucherait jusqu'au timeout **sur un fournisseur parfaitement sain**. L'erreur a été faite, elle a coûté une heure.

### Délais et timeout

Poll toutes les **2 s**, plafond **90 s** par fournisseur. Le `404` des premières secondes est **normal** — la conversation n'est pas encore persistée au retour du POST (~3 s) — et ne compte pas comme un échec.

Délais complets OBSERVED le 31/07/2026, sur plusieurs runs : **ce sont des intervalles, pas des points.**

| Fournisseur | Modèle                      | Délai  |
| ----------- | --------------------------- | ------ |
| Google      | `gemini-2.5-flash-lite`     | 4-7 s  |
| OpenAI      | `gpt-5-mini`                | 4-7 s  |
| Anthropic   | `claude-haiku-4-5-20251001` | 2-17 s |

Le plafond garde une marge de **×5 sur le pire cas du plus lent**. Ne le descendez pas sur la foi du meilleur fournisseur **ni du meilleur run**.

### `gemini-2.5-flash-lite` est un choix délibéré

Ce n'est **pas** le modèle Google le moins cher choisi par économie : c'est le modèle visé par la **garde `thinkingConfig`** de `packages/api/src/endpoints/google/llm.ts` (voir `CLAUDE.md` §11), qui empêche l'émission d'un `thinkingBudget` que Vertex rejette en 400 sur cette famille.

**La sonde est donc le canary de cette garde** : si elle régresse à un merge upstream, c'est ici que ça se verra en premier, en production, le lendemain matin. Ne remplacez pas ce modèle sans transférer cette propriété ailleurs.

## Le contournement `uaParser`

**La sonde se déclare navigateur** (constante `BROWSER_UA` dans [`lib/auth.mjs`](lib/auth.mjs)). Sans cet en-tête, `api/server/middleware/uaParser.js` — monté sur `routes/agents/index.js` — la rejette, parce que `ua-parser-js` ne reconnaît aucun navigateur dans le `User-Agent` de `fetch`.

Deux pièges, tous deux OBSERVED :

1. **Le rejet arrive en `HTTP 200`**, porteur d'une trame SSE `event: error` / `{"message":"Illegal request"}`. Un client qui ne regarde que le statut lit un succès.
2. **Le rejet coûte une violation de 20 points** sur un compte authentifié. Avec les défauts du code (`NON_BROWSER_VIOLATION_SCORE` = 20, `BAN_INTERVAL` = 20), le seuil de ban est franchi **dès la première requête**, pour 2 heures par défaut — et `deleteAllUserSessions` s'exécute même si la durée est nulle. `BAN_VIOLATIONS` est **UNKNOWN** en production et **OBSERVED inopérant** au 31/07/2026, mais s'il était activé un jour, une sonde mal en-têtée se bannirait toute seule.

D'où la règle d'or : **arrêt net à la première détection, aucun retry, et aucune tentative de nettoyage** — elle passerait par le même chemin refusé. La conversation éventuellement laissée en vol est nommée dans le rapport, à supprimer à la main.

### Pourquoi la suite staging ne l'a jamais rencontré

Parce que **Playwright envoie un vrai `User-Agent` de navigateur**. Le prérequis y était satisfait sans que personne ait eu à l'écrire. La sonde, elle, est un client HTTP pur : elle doit faire **explicitement** ce que le navigateur faisait implicitement.

C'est pourquoi ce contournement est écrit ici, dans `lib/auth.mjs`, **et** dans le registre des identités (acteur 17) : un contournement légitime mais non déclaré devient un mystère au premier lecteur venu — c'est-à-dire vous.

## Ce que la sonde ne couvre pas : la génération de titre

`addTitle` déclenche **un appel LLM de plus par conversation**, qui n'entre pas dans le verdict. Si la génération de titre casse — modèle de titre KO, quota, régression — la sonde resterait **verte** alors qu'un appel échouerait chaque jour en silence. Une surface d'échec non couverte qui tourne quotidiennement est une fausse assurance.

**Arbitrage retenu : la sonde ne déclenche plus la génération de titre.** Elle envoie `isTemporary: true`, seul levier disponible **par requête** — les deux autres sorties d'`addTitle` sont la variable d'environnement `TITLE_CONVO` (ce serait toucher la config de production et le produit de tous les utilisateurs) et `client.options.titleConvo`, qui vient de la config d'endpoint et non du corps de requête.

Vérifié avant d'être retenu :

- **le message reste persisté** — `isTemporary` ne fait que poser un `expiredAt`, relevé à +30 jours en production. C'était la condition non négociable : sans persistance, plus de verdict ;
- **le titre reste `"New Chat"`** — la génération est bien sautée ;
- **effet de bord favorable** : l'`expiredAt` est un second filet derrière le `DELETE` explicite.

**Conséquence assumée, et c'est le point à retenir : la sonde n'exerce ni la génération de titre, ni le chemin de persistance par défaut.** Ce chemin passe de « exercé mais non asservi » à « non exercé ». Ce n'est pas une perte de couverture — il n'était pas dans le verdict — mais c'est une honnêteté à maintenir. Si un jour vous voulez couvrir la génération de titre, cela se fait en l'asservissant (assertion sur le titre obtenu), pas en retirant ce drapeau en silence.

## Coût

Le run **mesure son propre coût** et l'inscrit au rapport (delta de `currentMonthSpend` avant/après). Ce n'est pas une coquetterie : deux estimations à la main ont été fausses, l'une d'un facteur ~300, l'autre en confondant un appel isolé avec la moyenne par fournisseur d'un run entier. **On ne déduit pas un coût, on le relève.**

Ordre de grandeur OBSERVED : **~5 200 tokenCredits par run**, sur un plafond mensuel de **10 000 000** pour ce compte (registre, 13b) — soit ~1,6 % du budget pour une exécution quotidienne. Le coût dominant est celui des appels Anthropic et OpenAI, dont les multiplicateurs écrasent celui de `flash-lite`.

## Nettoyage

Chaque conversation créée est supprimée (`DELETE /api/convos`, réponse `201`) **et la suppression est vérifiée** par un re-`GET` qui doit rendre `404`.

**Le résultat du nettoyage fait partie du verdict** : une conversation laissée en production fait sortir la sonde en 1, même si les trois fournisseurs ont répondu. L'entrée 13b du registre l'interdit, et un nettoyage dont on jette le résultat est un garde-fou décoratif.

La route refuse `400 no parameters provided` si aucun critère n'est fourni : un bug d'appel ne peut pas effacer toutes les conversations du compte.

## Voie A — pourquoi du code dupliqué

`lib/auth.mjs` reprend délibérément la logique de [`e2e/staging/lib/auth.ts`](../staging/lib/auth.ts) au lieu de la partager :

1. la suite staging tourne sous Playwright et manipule un `APIRequestContext` ; la sonde est un client HTTP pur, exécutable par `node` seul. Les deux ne parlent pas le même objet de requête ;
2. la sonde touche la **production**. Elle ne doit pas casser parce qu'un refactoring de la recette staging a déplacé un helper commun.

**Dette assumée : « noyau partagé »**, à lever au réveil du développement. Tant qu'elle n'est pas levée, **toute correction dans l'un doit être reportée dans l'autre.** Un commentaire croisé le rappelle des deux côtés.

Une divergence est en revanche **irréductible et ne doit pas être « alignée »** : le `BROWSER_UA` de la sonde. Voir plus haut.

## En cas de rouge

L'alerte ouvre une issue intitulée **`🔴 Sonde de production KO`** — titre **stable**, délibérément. Si une issue de ce titre est déjà ouverte, l'alerte y ajoute un commentaire plutôt que d'en créer une nouvelle : un incident, une issue, avec son fil de relances. _(Le canary staging, lui, date ses titres : N jours rouges y produisent N issues. La sonde ne reprend pas ce comportement.)_

Ordre de lecture, et il n'est pas négociable :

1. **Point 0 — vérifier l'image réellement servie par les pods (Loki).** Une sonde rouge signifie très souvent que l'environnement ne fait pas tourner le build attendu. Tant que l'image n'est pas confirmée, **aucune conclusion produit n'est valide.**
2. `ARRET NET — rejet non-navigateur` → **ne pas relancer.** Voir [`uaParser`](#le-contournement-uaparser).
3. `Session de sonde indisponible` → le compte de service ne s'authentifie pas. **Ce n'est pas un bug produit.** Remédiation : registre des identités, entrée **13b**.
4. `unfinished=true` → le fournisseur a répondu puis lâché en cours de route.
5. `nettoyage non confirme` → une conversation est restée en production ; son identifiant est dans le rapport.

Le rapport complet est joint au run (artefact `sonde-prod-report`, 30 jours) et reproduit dans le résumé du run.

## Renvois — à ne pas dupliquer ici

| Sujet                                                                | Où                                           |
| -------------------------------------------------------------------- | -------------------------------------------- |
| Compte de service, pouvoirs, **remédiation en cas de compromission** | `docs/registre-identites.md`, entrée **13b** |
| La sonde comme acteur, et sa déclaration `uaParser`                  | `docs/registre-identites.md`, acteur **17**  |
| Garde `thinkingConfig` et watchlist merge upstream                   | `CLAUDE.md` §11                              |
| Suite de recette staging                                             | `e2e/staging/README.md`                      |

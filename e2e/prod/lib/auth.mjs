/**
 * Authentification du compte de service de la **sonde de production**.
 *
 * ## Voie A — duplication assumée, pas duplication paresseuse
 *
 * Ce fichier reprend délibérément la logique de `e2e/staging/lib/auth.ts` (login programmatique
 * puis acceptation des CGU) **au lieu de la partager**. Deux raisons :
 *
 * 1. La suite staging tourne sous Playwright et manipule un `APIRequestContext` ; la sonde de
 *    production est un **client HTTP pur**, sans navigateur et sans Playwright, pour rester
 *    exécutable par `node` seul dans un workflow. Les deux ne parlent pas le même objet de
 *    requête, et un noyau partagé devrait abstraire cette différence avant d'exister.
 * 2. La sonde touche la **production**. Elle ne doit pas casser parce qu'un refactoring de la
 *    recette staging a déplacé un helper commun.
 *
 * **Dette assumée : « noyau partagé ».** À lever au réveil du développement — extraire un module
 * commun (login, CGU, extraction du texte des `content` parts) dont les deux suites dériveraient.
 * Tant qu'elle n'est pas levée, **toute correction ici doit être reportée dans**
 * `e2e/staging/lib/auth.ts`, **et réciproquement**. Un commentaire croisé le rappelle là-bas.
 *
 * ## La divergence qui n'est PAS de la duplication
 *
 * Voir `BROWSER_UA` ci-dessous : la suite staging n'a jamais eu à s'en préoccuper, la sonde
 * n'y échappe pas. C'est la seule différence de fond entre les deux fichiers.
 *
 * ## Ce qui n'est jamais journalisé
 *
 * Le mot de passe et le jeton n'apparaissent dans aucun message, aucune trace, aucun rapport.
 * En cas d'échec, seuls le code HTTP et le message applicatif remontent — jamais le corps de la
 * requête. En revanche `termsAccepted` **est** journalisé, délibérément : c'est un drapeau
 * d'état, pas un secret, et ne pas l'avoir vu a coûté un run rouge complet le 31/07/2026.
 */

/**
 * User-Agent de navigateur, **obligatoire sur toutes les requêtes de la sonde**.
 *
 * ## Pourquoi cette constante existe
 *
 * `api/server/middleware/uaParser.js` est monté sur `api/server/routes/agents/index.js` (ainsi
 * que sur `assistants/index.js` et `accessPermissions.js`). Il passe le `User-Agent` à
 * `ua-parser-js` et **rejette la requête si aucun `browser.name` n'est reconnu**. Le `fetch` de
 * Node n'en présente pas : sans cet en-tête, la sonde est refusée.
 *
 * Deux pièges, tous deux vérifiés OBSERVED le 31/07/2026 sur `llm.vermeer.ai` :
 *
 * 1. **Le rejet arrive en `HTTP 200`**, porteur d'une trame SSE `event: error` /
 *    `{"message":"Illegal request"}`. Un client qui ne regarde que le statut HTTP lit un
 *    succès. C'est pourquoi `sondeFetch` inspecte le corps et non seulement le code.
 * 2. **Le rejet est facturé comme une violation à 20 points.** Contrairement au
 *    `registerLimiter` — où `logViolation` sort tôt faute d'utilisateur authentifié — la sonde
 *    est authentifiée : la violation est réellement enregistrée et `banViolation` est appelé.
 *    Avec les défauts du code (`NON_BROWSER_VIOLATION_SCORE` = 20, `BAN_INTERVAL` = 20), le
 *    seuil de ban est franchi **dès la première requête**, pour une durée par défaut de
 *    **2 heures** (`BAN_DURATION`), et `deleteAllUserSessions` s'exécute même si la durée est
 *    nulle. `BAN_VIOLATIONS` est **UNKNOWN** en production (absent du gitops, `true` dans
 *    `.env.example`) et **OBSERVED inopérant** au 31/07/2026 — mais s'il était activé un jour,
 *    une sonde mal en-têtée se bannirait toute seule.
 *
 * L'enjeu n'est pas cosmétique : le mot de passe de ce compte est **non rotable par
 * l'application**, donc un compte banni ou perdu se remédie par le **rejeu complet de la
 * fenêtre d'inscription en production** (registre, entrée 13b). D'où la règle d'or de la
 * sonde : **arrêt net à la première détection, aucun retry.**
 *
 * Ce contournement est légitime — la sonde exerce l'application comme le ferait un
 * utilisateur — mais il devait être écrit. Il l'est aussi dans le registre des identités.
 *
 * ⚠️ Ne pas retirer cet en-tête, et ne pas le « nettoyer » comme un vestige de copier-coller.
 */
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

/**
 * Rejet par `uaParser`, ou toute trame d'erreur qui en porte la signature.
 *
 * Type d'erreur distinct, et non un simple `Error`, pour que l'appelant puisse l'attraper
 * **sans ambiguïté** et s'arrêter net plutôt que réessayer. Un retry sur ce cas empile les
 * violations : c'est précisément ce qu'il ne faut pas faire.
 */
export class UaParserRejection extends Error {
  constructor(pathname, status, detail) {
    super(
      [
        'Requête rejetée comme non-navigateur (uaParser).',
        `${pathname} → HTTP ${status} : ${detail}`,
        '',
        'ARRÊT NET, sans retry : chaque tentative enregistre une violation de 20 points sur le',
        'compte de service, et le seuil de ban est atteignable dès la première. Voir la',
        'constante BROWSER_UA de ce fichier, et e2e/prod/README.md.',
      ].join('\n'),
    );
    this.name = 'UaParserRejection';
    this.pathname = pathname;
    this.status = status;
  }
}

export const SESSION_EXPIRED_MESSAGE =
  'Session de sonde indisponible — le compte de service de production ne s’authentifie pas (voir e2e/prod/README.md)';

export const TERMS_PREREQUISITE_MESSAGE =
  'Prérequis CGU non satisfait — le compte de service de production n’a pas accepté les conditions, et la sonde n’a pas réussi à les accepter pour lui (voir e2e/prod/README.md).';

/** URL de l'environnement visé. Aucune URL n'est codée en dur dans ce dépôt. */
export function requireBaseUrl() {
  const raw = process.env.BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      [
        'BASE_URL est absent : la sonde ne sait pas quel environnement viser.',
        '',
        'En CI : secret QA_PROD_URL du workflow, mappé sur BASE_URL.',
        'En local : export BASE_URL="https://<hôte-de-l-environnement>"',
      ].join('\n'),
    );
  }
  return raw.replace(/\/+$/, '');
}

/**
 * Identifiants du compte de service. Lus ici et nulle part ailleurs ; la valeur du mot de passe
 * n'est jamais journalisée — les messages ne citent que les **noms** des variables manquantes.
 *
 * Les noms sont volontairement les mêmes qu'en staging (`QA_SERVICE_EMAIL` /
 * `QA_SERVICE_PASSWORD`) : c'est le **workflow** qui décide de l'environnement, en y branchant
 * `QA_SERVICE_EMAIL_PROD` / `QA_SERVICE_PASSWORD_PROD`. Le chemin de code reste identique, et
 * aucun secret de staging ne peut atteindre la production par simple oubli de renommage.
 */
export function requireServiceCredentials() {
  const email = process.env.QA_SERVICE_EMAIL?.trim();
  const password = process.env.QA_SERVICE_PASSWORD;

  const missing = [
    ['QA_SERVICE_EMAIL', email],
    ['QA_SERVICE_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      [
        `Identifiants du compte de service absents : ${missing.join(', ')}.`,
        '',
        'En CI : secrets Actions de vermeer-text, branchés depuis QA_SERVICE_EMAIL_PROD et',
        'QA_SERVICE_PASSWORD_PROD. En local : exporter les deux variables.',
        'Procédure complète : e2e/prod/README.md.',
      ].join('\n'),
    );
  }

  return { email, password };
}

/** Corps de réponse réduit à son champ `message`, borné — on ne recopie jamais un corps en aveugle. */
function safeMessage(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.message === 'string' ? parsed.message.slice(0, 200) : '';
  } catch {
    return text.slice(0, 200).replace(/\s+/g, ' ').trim();
  }
}

/** Signature d'un rejet `uaParser`, y compris quand il arrive déguisé en `HTTP 200`. */
function looksLikeUaRejection(text) {
  return text.includes('Illegal request');
}

/**
 * Requête unique de la sonde. **Tout passe par ici** — c'est le seul endroit qui garantit
 * l'en-tête `User-Agent` et la détection du rejet non-navigateur.
 *
 * Retourne `{ status, text, json }` sans jamais lever sur un statut d'erreur : le classement
 * VERT/ROUGE appartient à l'appelant. La **seule** exception levée est `UaParserRejection`,
 * parce que celle-là n'est pas un verdict mais une consigne d'arrêt immédiat.
 */
export async function sondeFetch(baseURL, pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'User-Agent': BROWSER_UA };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseURL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();

  if (looksLikeUaRejection(text)) {
    throw new UaParserRejection(pathname, response.status, safeMessage(text));
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

/**
 * Ouvre une session pour le compte de service et garantit que les CGU sont acceptées.
 *
 * Retourne le jeton, et non un `storageState` : la sonde n'a pas de navigateur à réamorcer.
 * Un login par exécution suffit — contrairement à la suite staging, la sonde ne charge aucune
 * page, donc ne déclenche pas la rotation de refresh token qui imposait là-bas un login par test.
 */
export async function freshServiceSession(baseURL) {
  const { email, password } = requireServiceCredentials();

  const login = await sondeFetch(baseURL, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (login.status !== 200 || !login.json?.token) {
    throw new Error(
      [
        SESSION_EXPIRED_MESSAGE,
        `POST /api/auth/login → HTTP ${login.status}`,
        safeMessage(login.text),
      ].join('\n'),
    );
  }

  await ensureTermsAccepted(baseURL, login.json);
  return login.json.token;
}

/**
 * Accepte les CGU du compte de service si elles ne le sont pas déjà.
 *
 * ## Pourquoi la sonde le fait elle-même
 *
 * `termsAccepted` est un champ **persistant** du compte
 * (`packages/data-schemas/src/schema/user.ts`), pas un état de session : une fois posé, les
 * exécutions suivantes le voient à `true` et n'appellent plus rien. L'idempotence est donc
 * structurelle, et non une précaution de ce code.
 *
 * Le faire ici plutôt qu'une fois à la main est délibéré : la remédiation d'une compromission
 * (registre, entrée 13b) prévoit de **recréer le compte**, et une acceptation posée hors bande
 * serait perdue à ce moment précis — c'est-à-dire le jour le plus mal choisi. **Il n'existe
 * aucune étape manuelle d'acceptation, et il ne faut pas en inventer une.**
 *
 * `POST /api/user/terms/accept` est gardé par `requireJwtAuth`, dont la stratégie extrait le
 * jeton de l'en-tête `Authorization` (`api/strategies/jwtStrategy.js`) : les cookies posés par
 * le login ne suffisent pas.
 */
async function ensureTermsAccepted(baseURL, session) {
  const accepted = session.user?.termsAccepted;
  console.log(`[auth] compte de service — termsAccepted=${accepted ?? 'absent de la réponse'}`);

  if (accepted === true) {
    return;
  }

  const response = await sondeFetch(baseURL, '/api/user/terms/accept', {
    method: 'POST',
    token: session.token,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      [
        TERMS_PREREQUISITE_MESSAGE,
        `POST /api/user/terms/accept → HTTP ${response.status}`,
        safeMessage(response.text),
      ].join('\n'),
    );
  }

  console.log('[auth] compte de service — CGU acceptées par la suite.');
}

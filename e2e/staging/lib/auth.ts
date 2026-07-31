import { request } from '@playwright/test';
import {
  requireServiceCredentials,
  SESSION_EXPIRED_MESSAGE,
  TERMS_PREREQUISITE_MESSAGE,
} from './env';

import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * ## Jumeau de production — `e2e/prod/lib/auth.mjs`
 *
 * La sonde de production porte une **copie assumée** de la logique de ce fichier (login
 * programmatique puis acceptation des CGU). Ce n'est pas un oubli de factorisation : elle est un
 * client HTTP pur, sans Playwright ni navigateur, pour rester exécutable par `node` seul — les
 * deux ne manipulent pas le même objet de requête.
 *
 * **Dette assumée : « noyau partagé »**, à lever au réveil du développement. Tant qu'elle n'est
 * pas levée, **toute correction ici doit être reportée là-bas, et réciproquement.**
 *
 * Une divergence est en revanche irréductible et ne doit **pas** être « alignée » : la sonde
 * envoie un `User-Agent` de navigateur sur toutes ses requêtes (constante `BROWSER_UA`), parce
 * que `uaParser` rejette tout client non-navigateur sur `routes/agents/index.js` — en `HTTP 200`
 * porteur d'une trame SSE `event: error`, et au prix d'une violation de 20 points. Cette suite-ci
 * n'a jamais eu à s'en soucier : **Playwright envoie un vrai UA de navigateur**, donc le
 * prérequis y est satisfait sans que personne l'ait écrit. C'est exactement pourquoi il est
 * écrit là-bas.
 */

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

type LoginResponse = {
  token?: string;
  user?: {
    termsAccepted?: boolean;
  };
};

/**
 * Session du compte de service, obtenue par login programmatique.
 *
 * ## Pourquoi un login par TEST, et pas un par run
 *
 * L'application fait de la **rotation de refresh token** : au premier chargement de page, le
 * client appelle `POST /api/auth/refresh` et le serveur régénère le refresh token de la
 * session (`AuthService.setAuthTokens` → `generateRefreshToken(session)`), ce qui **invalide
 * celui qui vient d'être présenté**.
 *
 * Un `storageState` obtenu une seule fois par run est donc périmé dès la fin du premier test :
 * chaque test ouvre un contexte neuf, réamorcé depuis le même instantané, et se heurte au mur
 * de login. C'est exactement le trou que bouchait l'ancienne fixture `persistRotatedSession`,
 * qui relayait l'état rotaté de test en test — au prix d'un couplage fragile (un run
 * interrompu au mauvais moment perdait la session).
 *
 * Un login par test supprime le problème à sa racine : chaque contexte porte une session qui
 * lui est propre, personne ne dépend de l'état laissé par le test précédent, et il n'y a plus
 * rien à relayer ni à republier. Le coût est d'un appel HTTP par test.
 *
 * ## Ce qui n'est jamais journalisé
 *
 * Le mot de passe et le jeton n'apparaissent dans aucun message, aucune trace, aucune pièce
 * jointe. En cas d'échec, seuls le code HTTP et le message applicatif remontent — jamais le
 * corps de la requête.
 *
 * En revanche `termsAccepted` **est** journalisé, délibérément : c'est un drapeau d'état, pas
 * un secret, et c'est exactement le genre de valeur qu'on masque à tort. Ne pas l'avoir vu a
 * coûté un run rouge complet le 31/07/2026.
 */
export async function freshServiceSession(baseURL: string): Promise<StorageState> {
  const { email, password } = requireServiceCredentials();
  const context = await request.newContext({ baseURL, ignoreHTTPSErrors: true });

  try {
    const response = await context.post('/api/auth/login', {
      data: { email, password },
      failOnStatusCode: false,
    });

    if (!response.ok()) {
      throw new Error(
        [
          SESSION_EXPIRED_MESSAGE,
          `POST /api/auth/login → HTTP ${response.status()}`,
          await safeMessage(response),
        ].join('\n'),
      );
    }

    await ensureTermsAccepted(context, (await response.json()) as LoginResponse);

    return await context.storageState();
  } finally {
    await context.dispose();
  }
}

/**
 * Accepte les conditions d'utilisation pour le compte de service, si elles ne le sont pas
 * déjà.
 *
 * ## Pourquoi la suite le fait elle-même
 *
 * `interface.termsOfService.modalAcceptance` est à `true` sur staging, et `Root.tsx:42-49`
 * affiche le dialogue tant que `termsAccepted` est faux sur le compte. Un compte neuf le voit
 * donc à **chaque** chargement de page : il recouvre le composer et la sidebar, et fait
 * échouer tous les cas en amont de leur propre assertion.
 *
 * L'ancien `storageState` masquait ce prérequis : il provenait d'une session capturée dans un
 * navigateur, sur un compte ayant déjà cliqué « J'accepte ». L'acceptation voyageait dans le
 * fichier, invisible.
 *
 * Le faire ici plutôt qu'une fois à la main est délibéré : la procédure de remédiation d'une
 * compromission (registre, entrée 13a) prévoit de **recréer le compte**. Une acceptation posée
 * hors bande serait perdue à ce moment précis, et reproduirait cette panne le jour le plus mal
 * choisi. **Il n'existe aucune étape manuelle d'acceptation, et il ne faut pas en inventer.**
 *
 * ## Idempotence
 *
 * `termsAccepted` est un champ persistant du compte (`packages/data-schemas/src/schema/user.ts`),
 * pas un état de session : une fois posé par le premier test, les logins suivants le voient à
 * `true` et n'appellent plus rien.
 */
async function ensureTermsAccepted(
  context: APIRequestContext,
  session: LoginResponse,
): Promise<void> {
  const accepted = session.user?.termsAccepted;
  console.log(`[auth] compte de service — termsAccepted=${accepted ?? 'absent de la réponse'}`);

  if (accepted === true) {
    return;
  }

  /* `POST /api/user/terms/accept` est gardé par `requireJwtAuth`, dont la stratégie extrait le
     jeton de l'en-tête Authorization (`ExtractJwt.fromAuthHeaderAsBearerToken()`,
     api/strategies/jwtStrategy.js:10). Les cookies posés par le login ne suffisent pas. */
  const token = session.token;
  if (!token) {
    throw new Error(
      [
        TERMS_PREREQUISITE_MESSAGE,
        'La réponse de login ne porte pas de jeton : POST /api/user/terms/accept ne peut pas être authentifié.',
      ].join('\n'),
    );
  }

  const response = await context.post('/api/user/terms/accept', {
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(
      [
        TERMS_PREREQUISITE_MESSAGE,
        `POST /api/user/terms/accept → HTTP ${response.status()}`,
        await safeMessage(response),
      ].join('\n'),
    );
  }

  console.log('[auth] compte de service — CGU acceptées par la suite.');
}

/**
 * Le corps d'une réponse d'échec ne contient pas d'identifiant, mais il est borné et réduit à
 * son champ `message` par prudence — on ne recopie jamais une réponse en aveugle dans un
 * rapport de test archivé.
 */
async function safeMessage(response: APIResponse): Promise<string> {
  try {
    const parsed = JSON.parse(await response.text()) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message.slice(0, 200) : '';
  } catch {
    return '';
  }
}

import { request } from '@playwright/test';
import { requireServiceCredentials, SESSION_EXPIRED_MESSAGE } from './env';

import type { APIRequestContext } from '@playwright/test';

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;

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
 * Le mot de passe n'apparaît dans aucun message, aucune trace, aucune pièce jointe. En cas
 * d'échec, seuls le code HTTP et le message applicatif remontent — jamais le corps de la
 * requête.
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
          await safeMessage(response.text()),
        ].join('\n'),
      );
    }

    return await context.storageState();
  } finally {
    await context.dispose();
  }
}

/**
 * Le corps d'une réponse d'échec de login ne contient pas d'identifiant, mais il est borné et
 * réduit à son champ `message` par prudence — on ne recopie jamais une réponse en aveugle
 * dans un rapport de test archivé.
 */
async function safeMessage(body: Promise<string>): Promise<string> {
  try {
    const parsed = JSON.parse(await body) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message.slice(0, 200) : '';
  } catch {
    return '';
  }
}

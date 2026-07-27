import { test as base } from '@playwright/test';
import { authStateFile } from './env';
import { purgeArgs, purgePreferences } from './state';

/**
 * `test` de la suite — à importer partout à la place de `@playwright/test`.
 *
 * Pourquoi : l'application fait de la ROTATION de refresh token. Au premier chargement,
 * le client appelle `/api/auth/refresh` ; le serveur régénère le refresh token de la
 * session (`AuthService.setAuthTokens` → `generateRefreshToken(session)`), ce qui
 * **invalide** celui qui vient d'être présenté. Le `storageState` capturé est donc à
 * usage unique : sans réécriture, le test suivant rejoue un token mort et se heurte au
 * mur de login (« Refresh token expired or not found for this user », HTTP 401).
 *
 * La fixture ci-dessous réécrit `auth.json` à la fin de chaque test avec les cookies
 * rotatés. Combinée à `workers: 1` (exécution sérielle), elle fait circuler la session
 * de test en test — et prolonge sa validité au fil des exécutions.
 *
 * Conséquence côté CI, documentée dans le README : l'état rotaté vit dans le workspace du
 * job et disparaît avec lui. Le secret QA_STORAGE_STATE n'est donc réutilisable qu'une
 * fois par capture, sauf à le réinjecter en fin de job.
 */
export const test = base.extend<{
  isolatedPreferences: void;
  persistRotatedSession: void;
}>({
  /**
   * Isolation d'état — enregistrée sur le CONTEXTE (donc valable pour la page du test comme
   * pour tout onglet ouvert en cours de route, cf. SAV-01), avant le premier chargement de
   * page. Ne touche qu'aux clés de préférence de conversation : les cookies — seuls porteurs
   * de l'authentification — restent intacts, et `persistRotatedSession` ci-dessous continue
   * de relayer la session à l'identique. Détail du périmètre : `lib/state.ts`.
   */
  isolatedPreferences: [
    async ({ context }, use) => {
      await context.addInitScript(purgePreferences, purgeArgs);
      await use();
    },
    { auto: true },
  ],
  persistRotatedSession: [
    async ({ context }, use, testInfo) => {
      await use();
      try {
        const state = await context.storageState();
        /* Ne jamais écraser le fichier par un état sans refresh token (mur de login,
           navigation échouée) : il serait inutilisable pour le test suivant. */
        const hasRefreshToken = state.cookies.some((cookie) => cookie.name === 'refreshToken');
        if (!hasRefreshToken) {
          return;
        }
        await context.storageState({ path: authStateFile });
      } catch (error) {
        await testInfo.attach('session-persistence-warning', {
          body: `Impossible de réécrire auth.json après le test : ${String(error)}`,
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

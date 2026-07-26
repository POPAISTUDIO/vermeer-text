import { expect, test } from '../lib/test';
import { composer } from '../lib/app';
import { SESSION_EXPIRED_MESSAGE } from '../lib/env';

/**
 * Garde de session — tourne avant tout le reste (projet `guard`, dépendance du projet
 * `chromium`). Un échec ici laisse tous les autres tests non exécutés : on ne confond
 * jamais une expiration de session QA avec un bug produit.
 *
 * Le test porte TOUS les tags de la suite : `--grep @wave1` (ou @canary, @extra) ne doit
 * jamais le filtrer, sinon la garde serait silencieusement contournée.
 */
test(
  'GUARD — la session QA est valide et authentifiée',
  { tag: ['@guard', '@wave1', '@canary', '@extra'] },
  async ({ page }) => {
    /**
     * Diagnostic serveur d'abord : c'est l'appel que fait le client au chargement.
     * Un 401 ici (« Refresh token expired or not found for this user ») désigne sans
     * ambiguïté une session morte, et non un défaut de l'application.
     */
    const refresh = await page.request.post('/api/auth/refresh');
    const refreshDetail = `POST /api/auth/refresh → HTTP ${refresh.status()} ${(await refresh.text()).slice(0, 200)}`;

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loginIndicator = page
      .locator('a[href*="/oauth/"], a[href*="/login"]')
      .or(page.getByRole('link', { name: /sign in|se connecter/i }))
      .first();

    const outcome = await Promise.race([
      composer(page)
        .waitFor({ state: 'visible', timeout: 45_000 })
        .then(() => 'app' as const)
        .catch(() => 'timeout' as const),
      loginIndicator
        .waitFor({ state: 'visible', timeout: 45_000 })
        .then(() => 'login' as const)
        .catch(() => 'timeout' as const),
    ]);

    expect(
      outcome,
      [
        SESSION_EXPIRED_MESSAGE,
        outcome === 'login'
          ? `Le mur d'authentification est servi sur ${page.url()}.`
          : `Ni composer ni page de login détectés sur ${page.url()} (application indisponible ?).`,
        refreshDetail,
      ].join('\n'),
    ).toBe('app');

    await expect(composer(page), SESSION_EXPIRED_MESSAGE).toBeVisible({ timeout: 15_000 });
  },
);

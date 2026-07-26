import { expect, test } from '../lib/test';
import { openApp } from '../lib/app';

type StartupConfig = { reportIssueURL?: string };

test(
  "SAV-01 — « Signaler un problème » ouvre le formulaire de support",
  { tag: ['@wave1'] },
  async ({ page, context }) => {
    await openApp(page);

    /* L'URL attendue est lue depuis la config servie par l'environnement :
       aucune URL n'est codée en dur dans le dépôt. */
    const configResponse = await page.request.get('/api/config');
    expect(
      configResponse.ok(),
      `/api/config a répondu HTTP ${configResponse.status()} : impossible de connaître l'URL de support attendue.`,
    ).toBe(true);

    const { reportIssueURL } = (await configResponse.json()) as StartupConfig;
    expect(
      reportIssueURL != null && reportIssueURL !== '',
      "reportIssueURL est absent de la config de l'environnement : l'entrée « Signaler un problème » ne peut pas s'afficher.",
    ).toBe(true);

    await page.getByTestId('nav-user').click();

    const menuItem = page.getByText(/signaler un problème|report an issue/i).first();
    await expect(
      menuItem,
      "Entrée « Signaler un problème » introuvable dans le menu utilisateur.",
    ).toBeVisible({ timeout: 15_000 });

    const popupPromise = context.waitForEvent('page', { timeout: 30_000 });
    await menuItem.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded').catch(() => undefined);

    /**
     * L'identité stable du formulaire est son paramètre `id`, pas son hôte : Microsoft
     * redirige `forms.office.com` vers `forms.cloud.microsoft`. On asserte donc le même
     * formulaire, pas la même URL littérale.
     */
    const expected = new URL(reportIssueURL as string);
    const opened = new URL(popup.url());

    expect(
      opened.searchParams.get('id'),
      `L'onglet ouvert (${opened.href}) ne pointe pas vers le formulaire configuré (${expected.href}).`,
    ).toBe(expected.searchParams.get('id'));

    expect(
      opened.protocol === 'https:' && /forms\.(office\.com|cloud\.microsoft)$/.test(opened.hostname),
      `L'onglet ouvert n'est pas un formulaire Microsoft Forms en HTTPS : ${opened.href}`,
    ).toBe(true);

    await popup.close();
  },
);

import { expect, test } from '../lib/test';
import { ask, composer, conversationItems, expectHealthyAnswer, openApp, sendButton } from '../lib/app';

const HYDRATION_DELAY_MS = 5_000;
const MESSAGES_ROUTE = /\/api\/messages\//;

test(
  'NEG-03 — envoi impossible pendant le chargement d’une conversation, puis envoi avec contexte complet',
  { tag: ['@wave1'] },
  async ({ page }) => {
    await openApp(page);

    const conversation = conversationItems(page).first();
    await expect(
      conversation,
      "Aucune conversation existante dans la sidebar : NEG-03 exige un historique sur le compte QA.",
    ).toBeVisible({ timeout: 30_000 });

    /**
     * La fenêtre d'hydratation réelle est trop courte pour être observée de façon fiable.
     * On la rend déterministe en retardant UNE SEULE fois la récupération des messages
     * (`times: 1` — la route se désarme d'elle-même, donc pas de `unroute` en pleine
     * requête, qui casserait l'hydratation).
     */
    await page.route(
      MESSAGES_ROUTE,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, HYDRATION_DELAY_MS));
        await route.continue().catch(() => undefined);
      },
      { times: 1 },
    );

    await conversation.click();
    await composer(page).fill('Message envoyé pendant le chargement');

    await expect(
      sendButton(page),
      "Le bouton d'envoi reste actif pendant le chargement de la conversation : régression du fix v0.10.11 (risque d'envoi sans contexte).",
    ).toBeDisabled({ timeout: HYDRATION_DELAY_MS });

    /* Hydratation terminée : l'envoi redevient possible. */
    await expect(sendButton(page)).toBeEnabled({ timeout: 60_000 });

    const result = await ask(page, 'Résume en une phrase notre échange précédent.');
    await expectHealthyAnswer(page, result, 'NEG-03 (envoi après hydratation)');

    /* Le message doit partir AVEC le contexte : conversation existante + message parent. */
    const conversationId = result.request?.conversationId;
    const parentMessageId = result.request?.parentMessageId;

    expect(
      typeof conversationId === 'string' && conversationId !== '' && conversationId !== 'new',
      `Le message est parti sans conversationId exploitable (${JSON.stringify(conversationId)}) : branche sans contexte.`,
    ).toBe(true);

    expect(
      typeof parentMessageId === 'string' &&
        parentMessageId !== '' &&
        parentMessageId !== '00000000-0000-0000-0000-000000000000',
      `Le message est parti sans parentMessageId (${JSON.stringify(parentMessageId)}) : contexte de conversation perdu.`,
    ).toBe(true);
  },
);

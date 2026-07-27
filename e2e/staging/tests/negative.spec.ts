import { expect, test } from '../lib/test';
import {
  ask,
  composer,
  currentConversationId,
  expectHealthyAnswer,
  messages,
  newConversation,
  sendButton,
} from '../lib/app';

const SEED_PROMPT = 'Réponds en une phrase: bonjour';
const DRAFT = 'Message envoyé pendant le chargement';

test(
  'NEG-03 — envoi impossible pendant le chargement d’une conversation, puis envoi avec contexte complet',
  { tag: ['@wave1'] },
  async ({ page }) => {
    /* Deux complétions : l'amorçage de la conversation, puis l'envoi asservi par le cas. */
    test.setTimeout(240_000);

    /**
     * La conversation exercée est CRÉÉE PAR LE TEST, puis rouverte par son identifiant.
     *
     * Auparavant le cas cliquait `conversationItems(page).first()`, c'est-à-dire ce que la
     * sidebar met en tête : une conversation épinglée, ou celle d'un test précédent. Deux
     * conséquences, toutes deux constatées : si cet item était déjà la conversation active,
     * `Convo.handleNavigation` sort en amont (`currentConvoId === conversationId`) — aucune
     * navigation, donc aucune hydratation à observer, donc bouton actif et échec du cas sans
     * qu'aucun défaut produit existe ; et le contenu de la conversation ouverte n'était pas
     * maîtrisé. Le titre ne ferait pas une cible plus sûre : le compte QA porte plusieurs
     * conversations homonymes.
     */
    await newConversation(page);
    const seed = await ask(page, SEED_PROMPT);
    await expectHealthyAnswer(page, seed, 'NEG-03 (amorçage de la conversation)');

    const conversationId = await currentConversationId(page, 'NEG-03 (amorçage)');

    /**
     * La fenêtre d'hydratation réelle est trop courte pour être observée de façon fiable.
     * Plutôt qu'un délai fixe — qui met en course la temporisation et les assertions — la
     * récupération des messages est SUSPENDUE jusqu'à libération explicite par le test : la
     * fenêtre reste ouverte aussi longtemps qu'il le faut, il n'y a plus rien à chronométrer.
     *
     * La route est filtrée sur l'identifiant de CETTE conversation. `useGetMessagesByConvoId`
     * n'exclut pas la conversation neuve : `GET /api/messages/new` est bien émis sur
     * `/c/new`, et un filtre large aurait consommé le `times: 1` sur cette requête-là,
     * laissant l'hydratation observée se dérouler à pleine vitesse. C'est le mécanisme le
     * plus probable derrière l'échec intermittent de ce cas (KO en 1ʳᵉ tentative, OK au
     * retry). `times: 1` évite par ailleurs un `unroute` en pleine requête.
     */
    const messagesRoute = new RegExp(`/api/messages/${conversationId}(?:$|[/?])`);

    let releaseHydration: () => void = () => undefined;
    const hydrationReleased = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });
    let hydrationHeld = false;

    await page.route(
      messagesRoute,
      async (route) => {
        hydrationHeld = true;
        await hydrationReleased;
        await route.continue().catch(() => undefined);
      },
      { times: 1 },
    );

    try {
      /* Réouverture par l'URL : la cible est l'identifiant, donc sans ambiguïté possible. */
      await page.goto(`/c/${conversationId}`, { waitUntil: 'domcontentloaded' });
      await expect(composer(page)).toBeVisible({ timeout: 45_000 });

      /* Confirmation d'être DANS la fenêtre d'hydratation : la requête est bien retenue. */
      await expect
        .poll(() => hydrationHeld, {
          timeout: 30_000,
          message: `Aucune récupération de messages interceptée pour la conversation ${conversationId} : il n'y a pas eu d'hydratation à observer.`,
        })
        .toBe(true);

      await composer(page).fill(DRAFT);
      /* Sans texte, le bouton est désactivé de toute façon : on vérifie d'abord que la
         saisie a pris, sinon l'assertion suivante serait vraie pour la mauvaise raison. */
      await expect(
        composer(page),
        'La saisie ne tient pas dans le composer pendant le chargement de la conversation.',
      ).toHaveValue(DRAFT);

      await expect(
        sendButton(page),
        "Le bouton d'envoi reste actif pendant le chargement de la conversation : régression du fix v0.10.11 (risque d'envoi sans contexte).",
      ).toBeDisabled({ timeout: 20_000 });
    } finally {
      releaseHydration();
    }

    /**
     * Fin RÉELLE de l'hydratation, et non un délai : l'arbre de messages est rendu — c'est ce
     * rendu qui pose l'atome `latestMessage` d'où dérive `parentMessageId`
     * (cf. `ChatView.messagesLoading`). L'envoi ne doit redevenir possible qu'ensuite.
     */
    await expect
      .poll(async () => messages(page).count(), {
        timeout: 60_000,
        message:
          "L'historique de la conversation n'est jamais rendu après libération de la requête.",
      })
      .toBeGreaterThan(0);

    await expect(sendButton(page)).toBeEnabled({ timeout: 60_000 });

    const result = await ask(page, 'Résume en une phrase notre échange précédent.');
    await expectHealthyAnswer(page, result, 'NEG-03 (envoi après hydratation)');

    /* Le message doit partir AVEC le contexte : conversation existante + message parent. */
    const sentConversationId = result.request?.conversationId;
    const parentMessageId = result.request?.parentMessageId;

    expect(
      sentConversationId,
      `Le message est parti sur ${JSON.stringify(sentConversationId)} au lieu de la conversation ouverte (${conversationId}) : branche sans contexte.`,
    ).toBe(conversationId);

    expect(
      typeof parentMessageId === 'string' &&
        parentMessageId !== '' &&
        parentMessageId !== '00000000-0000-0000-0000-000000000000',
      `Le message est parti sans parentMessageId (${JSON.stringify(parentMessageId)}) : contexte de conversation perdu.`,
    ).toBe(true);
  },
);

/** Garde-fou : le composer doit rester utilisable après le cas. */
test.afterEach(async ({ page }) => {
  if (page.isClosed()) {
    return;
  }
  await expect(composer(page)).toBeVisible({ timeout: 15_000 });
});

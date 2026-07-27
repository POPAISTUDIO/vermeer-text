import { expect, test } from '../lib/test';
import {
  ask,
  composer,
  conversationItems,
  expectGeneratedTitle,
  expectHealthyAnswer,
  errorBubbles,
  modelSelectorTrigger,
  newConversation,
  openApp,
  selectModel,
} from '../lib/app';
import { DEFAULT_MODEL_LABEL } from '../lib/models';

const APP_TITLE = 'Vermeer LLM & Agentic Portal';
const SHORT_PROMPT = 'Réponds en une phrase: bonjour';

test.describe('GEN — génération', () => {
  test(
    "GEN-01 — l'application s'ouvre authentifiée, titre et historique en place",
    { tag: ['@wave1'] },
    async ({ page }) => {
      await openApp(page);

      /**
       * Le login Entra ID lui-même n'est pas automatisable (SSO, cf. README) : la garde de
       * session le couvre en amont. Ce cas asserte le résidu automatisable de GEN-01 —
       * page authentifiée, titre applicatif, historique restitué.
       */
      await expect(page).toHaveTitle(new RegExp(escapeRegExp(APP_TITLE)));

      /**
       * Ici l'attente porte sur l'EXISTENCE d'un historique, pas sur une conversation
       * précise : le comptage est donc le bon outil (aucun `.first()`, dont la cible
       * dépendrait de l'ordre de la sidebar et des conversations épinglées).
       */
      await expect
        .poll(async () => conversationItems(page).count(), {
          timeout: 30_000,
          message:
            "Aucune conversation existante listée dans la sidebar : l'historique du compte QA n'est pas restitué (GEN-01 attend un historique intact).",
        })
        .toBeGreaterThan(0);
    },
  );

  test(
    'GEN-02 — les modèles Anthropic répondent en streaming, avec titre généré',
    { tag: ['@wave1', '@canary'] },
    async ({ page }) => {
      for (const label of [/Opus 4\.8/, /Sonnet 4\.6/]) {
        await newConversation(page);
        await selectModel(page, 'Anthropic', label);

        const result = await ask(page, SHORT_PROMPT);
        await expectHealthyAnswer(page, result, `Anthropic ${String(label)}`);

        await expectGeneratedTitle(page, `Anthropic ${String(label)}`);
      }
    },
  );

  test(
    'GEN-03 — le modèle OpenAI par défaut est GPT-5.2 et répond',
    { tag: ['@wave1', '@canary'] },
    async ({ page }) => {
      await newConversation(page);

      /**
       * « Par défaut » suppose l'absence de réglage hérité : une conversation neuve reprend
       * nativement le dernier réglage utilisé (`lastConversationSetup_0`), et ce réglage
       * traversait les tests via le relais de session. La fixture d'isolation
       * (`lib/state.ts`) purge ces clés avant le premier chargement de page — sans elle, ce
       * cas lit le modèle du test précédent et échoue sans qu'aucun défaut produit existe.
       */
      await expect(
        modelSelectorTrigger(page),
        `Le modèle par défaut affiché n'est pas « ${DEFAULT_MODEL_LABEL} » — si un autre modèle est lu, vérifier que la purge des préférences (lib/state.ts) est bien active.`,
      ).toContainText(DEFAULT_MODEL_LABEL, { timeout: 20_000 });

      const result = await ask(page, SHORT_PROMPT);
      await expectHealthyAnswer(page, result, 'OpenAI par défaut');
    },
  );

  test(
    'GEN-06 — un modèle Gemini répond, sans erreur 403',
    { tag: ['@wave1', '@canary'] },
    async ({ page }) => {
      await newConversation(page);
      await selectModel(page, 'Google', /Gemini 3 Flash/);

      const result = await ask(page, SHORT_PROMPT);

      /* La clé GCP a été corrigée par les Ops : tout 403 est désormais une vraie régression. */
      expect(
        result.status,
        `RÉGRESSION Gemini : la complétion a répondu HTTP ${result.status} (403/permission = clé GCP à revérifier immédiatement).`,
      ).not.toBe(403);

      const bubbleText = (await errorBubbles(page).count()) > 0 ? await page.locator('body').innerText() : '';
      expect(
        /403|permission denied/i.test(bubbleText),
        'RÉGRESSION Gemini : une erreur 403/permission est affichée dans la conversation.',
      ).toBe(false);

      await expectHealthyAnswer(page, result, 'Google Gemini 3 Flash');
    },
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Garde-fou : le composer doit rester utilisable après chaque cas. */
test.afterEach(async ({ page }) => {
  if (page.isClosed()) {
    return;
  }
  await expect(composer(page)).toBeVisible({ timeout: 15_000 });
});

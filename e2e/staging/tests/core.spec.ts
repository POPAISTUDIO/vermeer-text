import { expect, test } from '../lib/test';
import type { Page } from '@playwright/test';
import {
  ask,
  composer,
  conversationItems,
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

      await expect(
        conversationItems(page).first(),
        "Aucune conversation existante listée dans la sidebar : l'historique du compte QA n'est pas restitué (GEN-01 attend un historique intact).",
      ).toBeVisible({ timeout: 30_000 });
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

      await expect(
        modelSelectorTrigger(page),
        `Le modèle par défaut affiché n'est pas « ${DEFAULT_MODEL_LABEL} ».`,
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

/** Le titre de conversation est généré côté serveur après la réponse. */
async function expectGeneratedTitle(page: Page, context: string): Promise<void> {
  const active = conversationItems(page).first();
  await expect
    .poll(async () => ((await active.textContent().catch(() => '')) ?? '').trim(), {
      timeout: 60_000,
      message: `${context} — aucun titre de conversation généré (la conversation reste sans titre dans la sidebar).`,
    })
    .not.toMatch(/^(nouvelle conversation|new chat|)$/i);
}

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

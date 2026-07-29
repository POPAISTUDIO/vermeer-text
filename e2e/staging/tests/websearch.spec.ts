import type { Page } from '@playwright/test';

import { expect, test } from '../lib/test';
import { ask, expectHealthyAnswer, messages, newConversation, selectModel } from '../lib/app';

const FIRST_QUESTION = "Je n'ai fait aucune démarche pour déclarer mes impôts, est-ce grave ?";
const FOLLOW_UP = 'je suis en déclaration automatique donc rien à faire ?';

/**
 * Le cas historique WEB-01 asservissait DEUX promesses dans une seule assertion
 * (`links > 0 || sourcesAffordance > 0`) : la réponse s'appuie sur le web et le dit, et les
 * citations sont affichées. La seconde relève du défaut connu #114, dépriorisé — elle est
 * donc sortie du verdict P0 (cas B, `@known-issue-114`), pendant que la première y reste
 * (cas A). Règle du rouge : GOVERNANCE.md §5, README §5 et §6.
 */
async function askWebSearchAnswer(page: Page) {
  /* La recherche web native est activée par défaut sur les endpoints natifs ; le
     paramètre d'URL rend l'état explicite et indépendant du dernier réglage utilisé. */
  await newConversation(page, '?web_search=true');
  /* Modèle épinglé : sans cela, la conversation hérite du dernier modèle utilisé. */
  await selectModel(page, 'OpenAI', /GPT-5\.2/);

  const first = await ask(page, FIRST_QUESTION, { timeout: 180_000 });
  await expectHealthyAnswer(page, first, 'WEB-01 (question initiale)');

  return { first, answer: messages(page).last() };
}

test(
  'WEB-01a — recherche web : réponse appuyée sur le web et annoncée comme telle, puis relance sans erreur 400',
  { tag: ['@wave1'] },
  async ({ page }) => {
    test.setTimeout(300_000);

    const { first, answer } = await askWebSearchAnswer(page);

    /* Ce que le produit promet aujourd'hui : la réponse s'appuie sur des résultats web et
       le mentionne. L'AFFICHAGE des citations est le cas B (défaut connu #114). */
    const sourcesAffordance = await answer.getByText(/sources?|citations?|références/i).count();

    expect(
      sourcesAffordance > 0,
      [
        "La réponse n'annonce aucune source : la recherche web ne semble pas avoir été déclenchée.",
        `Mentions de sources : ${sourcesAffordance}.`,
        `Réponse : ${first.text.slice(0, 300)}…`,
      ].join(' '),
    ).toBe(true);

    /* LA non-régression : la relance ne doit pas produire de 400
       « messages.N: user messages must have non-empty content ». */
    const second = await ask(page, FOLLOW_UP, { timeout: 180_000 });
    expect(
      second.status,
      `Relance après une réponse sourcée : HTTP ${second.status}. Un 400 ici = réapparition du bug « user messages must have non-empty content ».`,
    ).not.toBe(400);
    await expectHealthyAnswer(page, second, 'WEB-01 (relance)');
  },
);

test(
  'WEB-01b — recherche web : citations affichées dans la réponse',
  /* `@known-issue-114` : défaut connu et dépriorisé. Le tag sort le cas du verdict P0
     (`--grep-invert` du gate, cf. README §5) ET de la désignation automatique du triage.
     Retirer le seul tag `@known-issue-114` le réintègre entièrement — rien d'autre à
     toucher. Ne pas supprimer ce cas : il est la vérification qui prouvera le correctif. */
  { tag: ['@wave1', '@known-issue-114'] },
  async ({ page }) => {
    test.setTimeout(300_000);

    const { first, answer } = await askWebSearchAnswer(page);

    const links = await answer.locator('a[href^="http"]').count();

    expect(
      links > 0,
      [
        "La réponse n'affiche aucune citation cliquable (défaut connu #114).",
        `Liens détectés : ${links}.`,
        `Réponse : ${first.text.slice(0, 300)}…`,
      ].join(' '),
    ).toBe(true);
  },
);

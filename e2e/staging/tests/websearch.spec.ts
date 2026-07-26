import { expect, test } from '../lib/test';
import { ask, expectHealthyAnswer, messages, newConversation, selectModel } from '../lib/app';

const FIRST_QUESTION = "Je n'ai fait aucune démarche pour déclarer mes impôts, est-ce grave ?";
const FOLLOW_UP = 'je suis en déclaration automatique donc rien à faire ?';

test(
  'WEB-01 — recherche web : réponse sourcée, puis relance sans erreur 400',
  { tag: ['@wave1'] },
  async ({ page }) => {
    test.setTimeout(300_000);

    /* La recherche web native est activée par défaut sur les endpoints natifs ; le
       paramètre d'URL rend l'état explicite et indépendant du dernier réglage utilisé. */
    await newConversation(page, '?web_search=true');
    /* Modèle épinglé : sans cela, la conversation hérite du dernier modèle utilisé. */
    await selectModel(page, 'OpenAI', /GPT-5\.2/);

    const first = await ask(page, FIRST_QUESTION, { timeout: 180_000 });
    await expectHealthyAnswer(page, first, 'WEB-01 (question initiale)');

    const answer = messages(page).last();
    const links = await answer.locator('a[href^="http"]').count();
    const sourcesAffordance = await answer
      .getByText(/sources?|citations?|références/i)
      .count();

    expect(
      links > 0 || sourcesAffordance > 0,
      [
        'La réponse ne cite aucune source : la recherche web ne semble pas avoir été déclenchée.',
        `Liens détectés : ${links}. Mentions de sources : ${sourcesAffordance}.`,
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

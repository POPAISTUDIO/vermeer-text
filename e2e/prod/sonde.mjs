/**
 * Sonde de production — un aller-retour minimal par fournisseur, et le verdict qui va avec.
 *
 * ## Ce qu'elle prouve, et ce qu'elle ne prouve pas
 *
 * Elle prouve qu'un utilisateur réel de `llm.vermeer.ai` obtient **une réponse non vide d'un
 * modèle**, pour chacun des trois fournisseurs. Elle ne juge **pas** le contenu de la réponse :
 * un test de comportement de modèle serait instable et dirait autre chose. C'est une sonde de
 * vivacité, pas une recette.
 *
 * ## Pourquoi elle interroge la conversation persistée, et non un flux d'événements
 *
 * `POST /api/agents/chat/:endpoint` rend immédiatement `{ streamId, conversationId, status:
 * 'started' }` — la génération est découplée de la connexion HTTP
 * (`ResumableAgentController`, `api/server/controllers/agents/request.js`). Lire le corps du POST
 * ne prouve donc **rien** : il vaut `started` même si le fournisseur est mort.
 *
 * Trois voies existaient. Deux ont été écartées :
 *
 * - **client SSE** sur `GET /api/agents/chat/stream/:streamId` — couple la sonde au format d'un
 *   protocole d'événements ;
 * - **chemin UI** à la Playwright — couple la sonde à des sélecteurs DOM.
 *
 * Les deux se cassent en silence après six mois de sommeil. La voie retenue interroge **l'état
 * persisté** : c'est le fait que l'utilisateur constate, c'est stable, et c'est de toute façon la
 * ressource que la sonde doit supprimer ensuite.
 *
 * ## Ce qui n'est jamais journalisé
 *
 * Aucun secret, aucun jeton. Le texte reçu du modèle est tronqué à 120 caractères et sert au
 * diagnostic, pas à l'assertion.
 */
import { sondeFetch, requireBaseUrl, freshServiceSession, UaParserRejection } from './lib/auth.mjs';

/** Message racine attendu par le contrôleur pour une conversation neuve. */
const NO_PARENT = '00000000-0000-0000-0000-000000000000';

/**
 * Intervalle et plafond du poll.
 *
 * Délais complets OBSERVED le 31/07/2026 sur `llm.vermeer.ai` : **7 s** (`gemini-2.5-flash-lite`),
 * **10 s** (`gpt-5-mini`), **17 s** (`claude-haiku-4-5-20251001`). Le plafond garde donc une marge
 * de **×5 sur le plus lent des trois** — et non ×12, qui serait la marge sur le plus rapide.
 * Ne pas descendre le timeout sur la foi du meilleur fournisseur.
 */
const POLL_MS = 2000;
const TIMEOUT_MS = 90000;

/**
 * Les trois fournisseurs, avec le modèle le moins coûteux de chacun.
 *
 * `gemini-2.5-flash-lite` est un choix **délibéré et non un choix de coût** : c'est le modèle
 * visé par la garde `thinkingConfig` de `packages/api/src/endpoints/google/llm.ts` (CLAUDE.md
 * §11), qui empêche l'émission d'un `thinkingBudget` que Vertex rejette en 400 sur cette
 * famille. La sonde en devient le canary : si cette garde régresse à un merge upstream, c'est
 * ici que ça se verra en premier. **Ne pas le remplacer par un autre modèle Google sans
 * transférer cette propriété ailleurs.**
 */
const PROVIDERS = [
  { endpoint: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  { endpoint: 'openAI', model: 'gpt-5-mini' },
  { endpoint: 'google', model: 'gemini-2.5-flash-lite' },
];

const PROMPT = 'Reponds exactement: PONG';

const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const log = (line) => console.log(`${stamp()}  ${line}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Texte d'un message assistant, extrait des `content` parts.
 *
 * ⚠️ **`m.text` est vide sur le chemin agents** — OBSERVED 31/07/2026 : un message sain porte
 * `content: [{ type: 'text', text: 'PONG' }]` et `text: ''`. Une sonde qui lirait `m.text`
 * boucherait jusqu'au timeout **sur un fournisseur parfaitement sain**.
 *
 * La forme d'un part `text` est double — chaîne ou `{ value }` — exactement comme le client le
 * traite (`client/src/components/Chat/Messages/Content/Part.tsx`). Le repli sur `m.text` est
 * conservé au cas où un chemin non-agents emprunterait un jour cette sonde.
 */
function extractAssistantText(message) {
  const fromParts = (message.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => (typeof part.text === 'string' ? part.text : (part.text?.value ?? '')))
    .join('');
  return fromParts || (typeof message.text === 'string' ? message.text : '');
}

/**
 * Verdict sur un message assistant — les quatre conditions, toutes nécessaires.
 *
 * ## Pourquoi quatre et pas une
 *
 * Un message présent n'est **pas** une preuve de succès : LibreChat persiste aussi les échecs.
 * Trois formes distinctes, relevées dans `api/server/middleware/abortMiddleware.js` :
 *
 * | Cas | `error` | `unfinished` | `finish_reason` | `text` |
 * |---|---|---|---|---|
 * | Échec complet, rien streamé | `true` | `false` | — | le texte de l'erreur |
 * | **Échec après streaming partiel** | **`false`** | **`true`** | — | le texte partiel |
 * | Abort | `false` | `false` | `'incomplete'` | partiel |
 *
 * Le deuxième cas est le piège : `abortMiddleware.js:246-253` **remet explicitement**
 * `error: false` et bascule le discriminant sur `unfinished: true`. Une sonde qui ne testerait
 * que `error` classerait VERT un fournisseur qui a lâché en cours de route.
 *
 * S'y ajoute un `content` part de type `error`, qui peut coexister avec `error: false`.
 */
function evaluate(message) {
  const text = extractAssistantText(message).trim();
  const reasons = [];

  if (text.length === 0) {
    reasons.push('texte vide');
  }
  if (message.error === true) {
    reasons.push('error=true (echec complet du fournisseur)');
  }
  if (message.unfinished === true) {
    reasons.push('unfinished=true (echec apres streaming partiel)');
  }
  if (message.finish_reason === 'incomplete') {
    reasons.push("finish_reason='incomplete' (generation interrompue)");
  }
  if ((message.content ?? []).some((part) => part.type === 'error')) {
    reasons.push('content part de type error');
  }

  return { ok: reasons.length === 0, reasons, text };
}

/**
 * Interroge la conversation jusqu'à un message assistant exploitable.
 *
 * Le `404` des premières secondes est **normal** et ne compte pas comme échec : la conversation
 * n'est pas encore persistée au retour du POST (OBSERVED ~3 s). Seule l'expiration du timeout
 * transforme une absence en ROUGE.
 */
async function pollUntilAnswer(baseURL, token, conversationId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TIMEOUT_MS) {
    await sleep(POLL_MS);
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const response = await sondeFetch(baseURL, `/api/messages/${conversationId}`, { token });

    if (response.status === 404) {
      continue;
    }
    if (response.status !== 200 || !Array.isArray(response.json)) {
      return { ok: false, reasons: [`GET /api/messages -> HTTP ${response.status}`], text: '' };
    }

    const assistant = response.json.filter((message) => message.isCreatedByUser === false);
    if (assistant.length === 0) {
      continue;
    }

    const verdict = evaluate(assistant[assistant.length - 1]);
    if (verdict.ok) {
      return { ...verdict, elapsed };
    }
    /* Un echec persiste : reessayer ne le changera pas, seul un texte vide peut encore se remplir. */
    if (verdict.reasons.some((reason) => reason !== 'texte vide')) {
      return { ...verdict, elapsed };
    }
  }

  return {
    ok: false,
    reasons: [`aucun message assistant exploitable apres ${TIMEOUT_MS / 1000} s`],
    text: '',
  };
}

/**
 * Supprime la conversation et **vérifie** la suppression.
 *
 * L'entrée 13b du registre interdit de laisser un état en production. `DELETE /api/convos`
 * répond `201` (`api/server/routes/convos.js:135`) et refuse `400 no parameters provided` si
 * aucun critère n'est fourni — un bug d'appel ne peut donc pas effacer toutes les conversations
 * du compte. Le re-`GET` doit ensuite rendre `404`.
 */
async function cleanup(baseURL, token, conversationId) {
  const del = await sondeFetch(baseURL, '/api/convos', {
    method: 'DELETE',
    token,
    body: { arg: { conversationId } },
  });
  const after = await sondeFetch(baseURL, `/api/messages/${conversationId}`, { token });
  const done = del.status === 201 && after.status === 404;
  log(
    `  nettoyage : DELETE -> HTTP ${del.status}, re-GET -> HTTP ${after.status} ${done ? '(supprimee)' : '(NON CONFIRME)'}`,
  );
  return done;
}

/** Un fournisseur, de l'appel au nettoyage. Ne relance jamais : un échec est un verdict. */
async function probe(baseURL, token, { endpoint, model }) {
  log(`${endpoint} / ${model} — POST /api/agents/chat/${endpoint}`);

  const post = await sondeFetch(baseURL, `/api/agents/chat/${endpoint}`, {
    method: 'POST',
    token,
    body: { endpoint, model, text: PROMPT, parentMessageId: NO_PARENT },
  });

  const conversationId = post.json?.conversationId;
  if (post.status !== 200 || !conversationId) {
    log(`  ROUGE — POST -> HTTP ${post.status} sans conversationId`);
    return {
      endpoint,
      model,
      ok: false,
      reasons: [`POST -> HTTP ${post.status} sans conversationId`],
      cleaned: true,
    };
  }

  let verdict;
  try {
    verdict = await pollUntilAnswer(baseURL, token, conversationId);
  } catch (error) {
    if (error instanceof UaParserRejection) {
      /* On remonte sans nettoyer, en emportant l'id pour que le rapport nomme l'orphelin. */
      error.conversationId = conversationId;
      throw error;
    }
    verdict = { ok: false, reasons: [`erreur pendant le poll : ${error.message}`], text: '' };
  }

  if (verdict.ok) {
    log(`  VERT en ${verdict.elapsed} s — texte : ${JSON.stringify(verdict.text.slice(0, 120))}`);
  } else {
    log(`  ROUGE — ${verdict.reasons.join(' ; ')}`);
  }

  /* Le nettoyage a lieu quel que soit le verdict — un ROUGE ne dispense pas de ranger — et son
     résultat fait partie du verdict : une conversation laissée en production est un échec. */
  const cleaned = await cleanup(baseURL, token, conversationId);
  return { endpoint, model, ...verdict, conversationId, cleaned };
}

async function main() {
  /**
   * `FORCER_ROUGE` — entrée de vérification de la chaîne d'alerte (issue au rouge + mail).
   * Elle sort **avant tout appel LLM**, délibérément : vérifier qu'une alerte part ne doit
   * jamais coûter un appel de modèle ni écrire quoi que ce soit en production.
   */
  if (process.env.FORCER_ROUGE === 'true') {
    log('FORCER_ROUGE=true — echec simule, aucun appel LLM emis, aucun etat cree.');
    process.exit(1);
  }

  const baseURL = requireBaseUrl();
  log(`sonde de production — cible ${baseURL}`);

  const token = await freshServiceSession(baseURL);
  const results = [];

  try {
    for (const provider of PROVIDERS) {
      results.push(await probe(baseURL, token, provider));
    }
  } catch (error) {
    if (error instanceof UaParserRejection) {
      /**
       * Arrêt net. Aucun retry, et **aucune tentative de nettoyage** : elle passerait par le
       * même chemin refusé et coûterait une violation de plus. La conversation éventuellement
       * créée est signalée pour reprise humaine — c'est le compromis assumé, et il est
       * préférable à un compte de service banni dont le mot de passe n'est pas rotable.
       */
      console.error('');
      console.error('ARRET NET — rejet non-navigateur (uaParser).');
      console.error(error.message);
      console.error('');
      console.error(
        'Aucun nettoyage tente : chaque requete supplementaire enregistre une violation de',
      );
      console.error('20 points, et le seuil de ban est atteignable des la premiere.');
      const orphans = [
        ...results
          .filter((r) => r.cleaned === false && r.conversationId)
          .map((r) => r.conversationId),
        ...(error.conversationId ? [error.conversationId] : []),
      ];
      if (orphans.length > 0) {
        console.error(`A supprimer a la main : ${orphans.join(', ')}`);
      }
      process.exit(1);
    }
    throw error;
  }

  const red = results.filter((result) => !result.ok);
  console.log('');
  log('— verdict —');
  for (const result of results) {
    log(
      `  ${result.ok ? 'VERT ' : 'ROUGE'} ${result.endpoint} / ${result.model}${result.ok ? '' : ` — ${result.reasons.join(' ; ')}`}`,
    );
  }
  const notCleaned = results.filter((result) => result.cleaned === false);
  if (notCleaned.length > 0) {
    log(`  ⚠️ nettoyage non confirme : ${notCleaned.map((r) => r.conversationId).join(', ')}`);
  }
  log(`${results.length - red.length}/${results.length} fournisseurs VERT`);

  process.exit(red.length === 0 && notCleaned.length === 0 ? 0 : 1);
}

await main();

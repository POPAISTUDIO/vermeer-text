const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');

/**
 * Vermeer — module de DEBUG additif du cache Anthropic (prompt caching).
 *
 * BUT : trancher si le préfixe (system + tools + messages) est RÉÉCRIT à chaque
 * tour (cache_creation cher, cache_read ~0) ou RELU (cache_read élevé dès le 2e
 * tour). Deux niveaux de log, jamais de contenu en clair (hashs + comptes only).
 *
 * ACTIVER   : env `VERMEER_CACHE_DEBUG=true` puis redémarrer le backend.
 *             Absent/≠"true" → ZÉRO comportement ajouté, ZÉRO log.
 * LIRE       : dans Loki, filtrer sur le texte "CacheDebug" (tout est sur une
 *             ligne par appel). Niveau 1 = lignes "usage", niveau 2 = "prefix".
 * DÉSACTIVER : remettre le flag à false/le retirer + redémarrer APRÈS capture
 *             (le log est verbeux et expose des métadonnées de conversation).
 */

const FLAG = 'VERMEER_CACHE_DEBUG';
const TAG = '[Vermeer][CacheDebug]';

/** @returns {boolean} */
function isEnabled() {
  return process.env[FLAG] === 'true';
}

/** Compteur d'appels LLM par conversation (process-local, remis à zéro au restart). */
const callSeqByConv = new Map();

/**
 * @param {string | undefined} conversationId
 * @returns {number}
 */
function nextSeq(conversationId) {
  const key = conversationId || 'unknown';
  const n = (callSeqByConv.get(key) ?? 0) + 1;
  callSeqByConv.set(key, n);
  return n;
}

/**
 * @param {unknown} value
 * @param {number} n
 * @returns {string}
 */
function trunc(value, n) {
  if (value == null) {
    return '';
  }
  return String(value).slice(0, n);
}

/**
 * @param {string} input
 * @param {number} n - longueur tronquée du hash hex
 * @returns {string}
 */
function sha(input, n) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, n);
}

/**
 * Sérialisation JSON tolérante aux références circulaires et fonctions.
 * @param {unknown} value
 * @returns {string}
 */
function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'function') {
      return '[fn]';
    }
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[circular]';
      }
      seen.add(val);
    }
    return val;
  });
}

/**
 * Représentation stable d'un outil (nom + description + schéma), tous providers.
 * @param {Array<unknown> | unknown} tools
 * @returns {string}
 */
function serializeTools(tools) {
  if (!Array.isArray(tools)) {
    return safeStringify(tools ?? []);
  }
  return safeStringify(
    tools.map((t) => ({
      name: t?.name ?? t?.type ?? t?.function?.name,
      description: t?.description ?? t?.function?.description,
      schema: t?.schema ?? t?.function?.parameters ?? t?.parameters,
    })),
  );
}

/**
 * Sérialise un message (rôle + contenu) pour hash. Contenu jamais loggé en clair.
 * @param {unknown} message
 * @returns {string}
 */
function serializeMessage(message) {
  const role =
    (typeof message?._getType === 'function' ? message._getType() : undefined) ||
    message?.role ||
    message?.type ||
    '?';
  const content = message?.content ?? message?.kwargs?.content ?? '';
  return `${role}:${safeStringify(content)}`;
}

/**
 * NIVEAU 1 — split d'usage par appel LLM. À câbler au point où l'usage provider
 * est collecté (on_chat_model_end / collectedUsage.push).
 * @param {UsageMetadata | undefined} usage
 * @param {Record<string, unknown> | undefined} metadata
 */
function logUsage(usage, metadata) {
  if (!isEnabled()) {
    return;
  }
  try {
    if (!usage) {
      return;
    }
    const conversationId = metadata?.thread_id;
    const model = usage.model || metadata?.ls_model_name;
    logger.info(
      `${TAG} usage conv=${trunc(conversationId, 8)} ` +
        `msg=${trunc(metadata?.run_id, 8)} ` +
        `seq=${nextSeq(conversationId)} ts=${Date.now()} ` +
        `model=${model} ` +
        `input=${usage.input_tokens} ` +
        `cache_creation=${usage.cache_creation_input_tokens} ` +
        `cache_read=${usage.cache_read_input_tokens} ` +
        `output=${usage.output_tokens}`,
    );
  } catch {
    /* le debug ne doit JAMAIS casser un appel */
  }
}

/**
 * NIVEAU 2 — empreintes de préfixe (le QUOI, sans contenu). À câbler au point le
 * plus en aval de NOTRE code, juste avant l'appel SDK (createRun / processStream).
 * @param {Object} params
 * @param {string | undefined} params.conversationId
 * @param {{ instructions?: string, additional_instructions?: string, tools?: unknown[] }} params.agent
 * @param {unknown[]} params.messages
 * @param {unknown[]} [params.tools]
 */
function logPrefix({ conversationId, agent, messages, tools }) {
  if (!isEnabled()) {
    return;
  }
  try {
    const instr = agent?.instructions ?? '';
    const tail = agent?.additional_instructions ?? '';
    const toolsSerialized = serializeTools(tools ?? agent?.tools);
    const msgs = Array.isArray(messages) ? messages : [];
    const msgHashes = msgs.map((m) => sha(serializeMessage(m), 8));
    logger.info(
      `${TAG} prefix conv=${trunc(conversationId, 8)} ` +
        `systemHash=${sha(`${instr}\n\n${tail}`, 12)} ` +
        `instrHash=${sha(instr, 12)} ` +
        `tailHash=${sha(tail, 12)} ` +
        `toolsHash=${sha(toolsSerialized, 12)} ` +
        `msgCount=${msgs.length} ` +
        `msgHashes=[${msgHashes.join(',')}]`,
    );
  } catch {
    /* le debug ne doit JAMAIS casser un appel */
  }
}

module.exports = {
  isEnabled,
  logUsage,
  logPrefix,
};

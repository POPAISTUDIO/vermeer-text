/**
 * Isolation d'état entre tests — purge des préférences de conversation.
 *
 * ## Pourquoi
 *
 * L'application persiste le dernier réglage de conversation dans le `localStorage`
 * (`lastConversationSetup_0`, `lastSelectedModel`, … — comportement natif LibreChat,
 * cf. `client/src/utils/localStorage.ts` et `LocalStorageKeys` dans
 * `packages/data-provider/src/config.ts`). Une conversation neuve HÉRITE de ce réglage :
 * c'est voulu côté produit.
 *
 * Côté suite, cet héritage traversait les tests : le `storageState` de l'époque, réécrit
 * après chaque test par la fixture `persistRotatedSession`, contenait les origines ET leur
 * `localStorage`, si bien que le modèle choisi par un test devenait le modèle par défaut du
 * test suivant. GEN-03, qui asserte le modèle par défaut d'une conversation neuve, échouait
 * ainsi sur un résidu de GEN-02 (« Opus 4.8 » un jour, « Sonnet 4.6 » le lendemain) — un
 * défaut d'isolation de la suite, jamais un défaut produit.
 *
 * Ce relais a disparu (login programmatique par test, cf. `lib/auth.ts`), mais la purge
 * reste nécessaire : le `localStorage` peut aussi être alimenté en cours de test, et rien
 * ne garantit qu'un contexte neuf parte d'une ardoise vierge sur toutes ces clés.
 *
 * ## Ce qui est purgé
 *
 * Uniquement des clés de PRÉFÉRENCE de conversation. La liste reprend celles que
 * l'application elle-même considère comme telles — union de `clearLocalStorage()` et
 * `clearAllConversationStorage()` (`client/src/utils/localStorage.ts`) — augmentée des
 * toggles de capability par conversation et du couple provider/modèle d'agent.
 *
 * ## Ce qui n'est JAMAIS touché
 *
 * - **Les cookies** : l'authentification est intégralement portée par eux (`refreshToken`,
 *   `token_provider`). Aucun jeton d'authentification ne vit dans le `localStorage` de cette
 *   application — vérifié sur le code client et sur la réponse de `POST /api/auth/login`. La
 *   purge est donc sans effet sur la session posée par le login programmatique.
 * - Les préférences d'affichage hors conversation : `i18nextLng`, `color-theme`, `appTitle`,
 *   `favorites`, `chatsExpanded`, `react-resizable-panels:*`.
 *
 * ## Quand
 *
 * Une seule fois par test, AVANT le premier chargement de page — via `addInitScript`, donc
 * avant tout script de l'application. Le drapeau vit dans le `sessionStorage` (absent du
 * `storageState`, donc vierge à chaque nouveau contexte) : les navigations SUIVANTES du même
 * test ne repurgent rien, sinon un réglage posé par le test lui-même serait effacé en cours
 * de route.
 */

/** Clés exactes. Le sibling `<clé>_TIMESTAMP` (cf. `client/src/utils/timestamps.ts`) est purgé avec. */
export const PREFERENCE_KEYS: string[] = [
  'lastSelectedModel',
  'lastSelectedTools',
  'lastSelectedSpec',
  'lastAgentProvider',
  'lastAgentModel',
  'filesToDelete',
  'isTemporary',
];

/** Préfixes de clés indexées par rang de conversation ou par identifiant de conversation. */
export const PREFERENCE_PREFIXES: string[] = [
  'lastConversationSetup',
  'assistant_id__',
  'agent_id__',
  'LAST_MCP_',
  'LAST_CODE_TOGGLE_',
  'LAST_WEB_SEARCH_TOGGLE_',
  'LAST_FILE_SEARCH_TOGGLE_',
  'LAST_ARTIFACTS_TOGGLE_',
  'LAST_SKILLS_TOGGLE_',
  'PIN_MCP_',
  'PIN_WEB_SEARCH_',
  'PIN_CODE_INTERPRETER_',
  'textDraft_',
  'filesDraft_',
];

/** Drapeau d'idempotence, porté par le `sessionStorage` (hors `storageState`). */
export const PURGE_FLAG = '__vermeerE2ePreferencesPurged';

export type PurgeArgs = {
  keys: string[];
  prefixes: string[];
  flag: string;
};

/**
 * Corps du script d'initialisation. Sérialisé et exécuté dans la page, donc sans aucune
 * dépendance au module : tout ce dont il a besoin passe par `args`.
 */
export function purgePreferences({ keys, prefixes, flag }: PurgeArgs): void {
  try {
    if (window.sessionStorage.getItem(flag) === '1') {
      return;
    }
    window.sessionStorage.setItem(flag, '1');
  } catch {
    /* sessionStorage indisponible : on purge quand même, la purge reste idempotente. */
  }

  const doomed = new Set<string>();
  for (const key of Object.keys(window.localStorage)) {
    if (keys.includes(key) || keys.some((exact) => key === `${exact}_TIMESTAMP`)) {
      doomed.add(key);
      continue;
    }
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      doomed.add(key);
    }
  }

  for (const key of doomed) {
    window.localStorage.removeItem(key);
  }
}

export const purgeArgs: PurgeArgs = {
  keys: PREFERENCE_KEYS,
  prefixes: PREFERENCE_PREFIXES,
  flag: PURGE_FLAG,
};

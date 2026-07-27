import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Route de complétion, tous chemins confondus (agents, ask legacy, edit). */
export const CHAT_ROUTE = /^\/api\/(agents\/chat|ask|edit)(\/|$)/;

/** Routes d'upload de fichier (images et fichiers génériques). */
export const UPLOAD_ROUTE = /^\/api\/files(\/images)?\/?$/;

export const composer = (page: Page): Locator => page.getByTestId('text-input');
export const sendButton = (page: Page): Locator => page.getByTestId('send-button');

/**
 * TOUS les items de conversation de la sidebar.
 *
 * ⚠️ Ne PAS utiliser `conversationItems(page).first()` pour retrouver « la conversation du
 * test » : le premier item est celui que la sidebar met en tête, c'est-à-dire une
 * conversation ÉPINGLÉE ou la plus récente d'un test précédent — pas nécessairement celle
 * que le test vient de créer. Le titre non plus n'est pas discriminant : le compte QA porte
 * plusieurs conversations homonymes (« Salutation en Français » y apparaît trois fois).
 * Passer par `currentConversationId` (URL) puis `activeConversationItem` (`aria-current`).
 * Cet accesseur ne reste légitime que pour compter l'historique (GEN-01).
 */
export const conversationItems = (page: Page): Locator => page.getByTestId('convo-item');

/** Identifiant de conversation dans l'URL applicative (`/c/<uuid>`), hors `/c/new`. */
const CONVERSATION_URL = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|[/?#])/i;

/** Titres « pas encore généré » : placeholder client ou titre par défaut du serveur. */
const UNTITLED = /^(nouvelle conversation|new chat|sans titre|untitled)?$/i;

export function conversationIdFromUrl(url: string): string | null {
  return CONVERSATION_URL.exec(url)?.[1] ?? null;
}

/**
 * Identifiant de la conversation RÉELLEMENT ouverte, lu dans l'URL. C'est l'ancre de tout
 * ciblage : elle ne dépend ni de l'ordre de la sidebar, ni des conversations épinglées, ni
 * de l'historique du compte QA.
 */
export async function currentConversationId(page: Page, context: string): Promise<string> {
  await expect
    .poll(() => conversationIdFromUrl(page.url()), {
      timeout: 30_000,
      message: `${context} — aucune conversation persistée : l'URL reste ${page.url()} (attendu /c/<id>).`,
    })
    .not.toBeNull();

  return conversationIdFromUrl(page.url()) as string;
}

/**
 * Item de sidebar de la conversation OUVERTE.
 *
 * `aria-current="page"` est posé par `ConvoLink` sur le seul item dont l'identifiant est
 * celui de la conversation courante (`Convo.isActiveConvo`, comparaison directe des ids).
 * C'est donc une prise DOM équivalente à l'URL, et indépendante de l'ordre de la sidebar,
 * des épinglages et des homonymes.
 *
 * L'API n'est pas une option pour lire la conversation : les routes `/api/*` exigent le
 * jeton d'accès que le client garde EN MÉMOIRE (vérifié — `GET /api/convos` répond 401 aussi
 * bien depuis `page.request` que depuis un `fetch` exécuté dans la page).
 */
export function activeConversationItem(page: Page): Locator {
  return conversationItems(page).filter({ has: page.locator('[aria-current="page"]') });
}

/**
 * Le titre de conversation est généré côté serveur APRÈS la réponse.
 *
 * Ancré sur la conversation du test — jamais sur le premier item de la sidebar : on vérifie
 * d'abord qu'une conversation est bien persistée (URL `/c/<id>`), puis que l'item ACTIF —
 * celui de cette conversation — porte un titre.
 */
export async function expectGeneratedTitle(page: Page, context: string): Promise<string> {
  const conversationId = await currentConversationId(page, context);
  const active = activeConversationItem(page);

  await expect(
    active,
    `${context} — la conversation ${conversationId} n'est pas l'item actif de la sidebar.`,
  ).toHaveCount(1, { timeout: 30_000 });

  await expect
    .poll(async () => ((await active.textContent().catch(() => '')) ?? '').trim(), {
      timeout: 60_000,
      message: `${context} — aucun titre généré pour la conversation ${conversationId} (elle reste sans titre dans la sidebar).`,
    })
    .not.toMatch(UNTITLED);

  return ((await active.textContent()) ?? '').trim();
}

export const stopButton = (page: Page): Locator =>
  page.getByRole('button', { name: /arrêter la génération|stop generating/i });

/**
 * Racine de message. La classe `message-render` est portée par les trois composants de
 * rendu de message (`MessageRender`, `ContentRender`, `MessageParts`).
 *
 * Ne PAS revenir à `[aria-label^="Message"]` : ce sélecteur attrape aussi le composer
 * (`aria-label="Message input"`) et le bouton « Message éphémère », ce qui fausse tout
 * comptage de messages.
 */
export const messages = (page: Page): Locator => page.locator('div.message-render');

/**
 * Bulle d'erreur : le mapping Vermeer (`Error.tsx` → `ProviderError`) rend un
 * `<summary>Détail technique</summary>`, les erreurs upstream un texte `com_error_*`.
 */
export const errorBubbles = (page: Page): Locator =>
  page.locator('summary', { hasText: /détail technique|technical detail/i });

export async function openApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(composer(page)).toBeVisible({ timeout: 45_000 });
}

export async function newConversation(page: Page, params = ''): Promise<void> {
  await page.goto(`/c/new${params}`, { waitUntil: 'domcontentloaded' });
  await expect(composer(page)).toBeVisible({ timeout: 45_000 });
  await expect
    .poll(async () => messages(page).count(), { timeout: 15_000 })
    .toBe(0);
}

/** Libellé du modèle courant, tel qu'affiché par le déclencheur du sélecteur. */
export function modelSelectorTrigger(page: Page): Locator {
  return page.getByRole('button', { name: /sélectionner un modèle|select a model/i }).first();
}

/**
 * Popover du sélecteur : Ariakit le rend en `role="dialog"` contenant un `combobox` de
 * recherche et une `listbox` dont les `option` sont les groupes de fournisseurs ; cliquer
 * un groupe déplie ses modèles dans la MÊME listbox (accordéon, pas de sous-menu).
 */
export const modelSelectorPopover = (page: Page): Locator =>
  page.getByRole('dialog').filter({ has: page.getByRole('listbox') }).first();

export const modelSelectorList = (page: Page): Locator => page.getByRole('listbox').first();

/**
 * Options du sélecteur. Lues au niveau page : le popover, la listbox des groupes et les
 * modèles dépliés sont portalisés dans des conteneurs distincts (les modèles ne sont
 * descendants ni du `dialog` ni de la `listbox`). Ce sont les seuls `role="option"` de
 * l'application sur cet écran.
 */
export const modelSelectorOptions = (page: Page): Locator => page.getByRole('option');

export async function openModelSelector(page: Page): Promise<void> {
  await modelSelectorTrigger(page).click();
  await expect(
    modelSelectorList(page),
    "Le sélecteur de modèles ne s'ouvre pas (aucune liste de modèles visible).",
  ).toBeVisible({ timeout: 10_000 });
}

export async function closeModelSelector(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(modelSelectorList(page)).toBeHidden({ timeout: 10_000 });
}

/**
 * Sélectionne un modèle en dépliant son groupe de fournisseur, puis vérifie que le
 * déclencheur affiche bien le modèle choisi (un clic sans effet ne passe donc pas).
 */
export async function selectModel(page: Page, group: string, label: RegExp): Promise<void> {
  await openModelSelector(page);

  const groupOption = modelSelectorList(page)
    .getByRole('option', { name: new RegExp(`^\\s*${escapeRegExp(group)}`, 'i') })
    .first();
  await expect(groupOption, `Groupe « ${group} » absent du sélecteur de modèles.`).toBeVisible({
    timeout: 10_000,
  });
  await groupOption.click();

  const candidate = modelSelectorOptions(page).filter({ hasText: label }).first();
  await expect(
    candidate,
    `Modèle ${String(label)} introuvable dans le groupe « ${group} » — le catalogue de l'environnement a-t-il changé ?`,
  ).toBeVisible({ timeout: 10_000 });
  await candidate.click();

  await expect(modelSelectorList(page)).toBeHidden({ timeout: 10_000 });
  await expect(
    modelSelectorTrigger(page),
    `Le modèle sélectionné (${String(label)}) n'est pas devenu le modèle courant.`,
  ).toContainText(label, { timeout: 10_000 });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type AskResult = {
  /** Statut HTTP réel du POST de complétion. */
  status: number;
  /** Corps de requête envoyé (utile pour asserter le contexte transmis). */
  request: Record<string, unknown> | null;
  /** Texte final du message d'assistant. */
  text: string;
  /** Le flux a été observé progressif (bouton Stop vu, ou texte en croissance). */
  streamed: boolean;
};

export type AskOptions = {
  timeout?: number;
  /** Envoyer sans saisir de texte (cas image seule). */
  emptyPrompt?: boolean;
};

/**
 * Envoie un message et rend le statut HTTP réel de la complétion + le texte final.
 * N'assert rien : c'est à l'appelant de décider ce qui est attendu (cf. `expectHealthyAnswer`).
 */
export async function ask(page: Page, prompt: string, opts: AskOptions = {}): Promise<AskResult> {
  const timeout = opts.timeout ?? 120_000;
  const before = await messages(page).count();

  const chatResponse = page.waitForResponse(
    (response) =>
      CHAT_ROUTE.test(new URL(response.url()).pathname) && response.request().method() === 'POST',
    { timeout: 60_000 },
  );

  if (!opts.emptyPrompt) {
    await composer(page).fill(prompt);
  }
  await expect(sendButton(page)).toBeEnabled({ timeout: 15_000 });
  await sendButton(page).click();

  const response = await chatResponse;
  const status = response.status();

  let request: Record<string, unknown> | null = null;
  try {
    const raw = response.request().postData();
    request = raw != null ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    request = null;
  }

  if (status >= 400) {
    return { status, request, text: '', streamed: false };
  }

  const answer = await observeAnswer(page, before, timeout, prompt);
  return { status, request, ...answer };
}

async function observeAnswer(
  page: Page,
  previousCount: number,
  timeout: number,
  prompt: string,
): Promise<{ text: string; streamed: boolean }> {
  const deadline = Date.now() + timeout;

  await expect
    .poll(async () => messages(page).count(), {
      timeout: Math.min(60_000, timeout),
      message: `Aucun message d'assistant n'est apparu après l'envoi (${previousCount} message(s) avant envoi).`,
    })
    .toBeGreaterThan(previousCount + 1);

  const target = messages(page).last();
  const lengths: number[] = [];
  let sawStopButton = false;

  while (Date.now() < deadline) {
    const stopVisible = await stopButton(page).isVisible().catch(() => false);
    sawStopButton = sawStopButton || stopVisible;

    const text = ((await target.textContent().catch(() => '')) ?? '').trim();
    if (text.length > 0) {
      lengths.push(text.length);
    }

    const settled = !stopVisible && text.length > 0 && lengths.length >= 2;
    if (settled) {
      /* Le bouton Stop disparaît avant le dernier token rendu. */
      await page.waitForTimeout(750);
      const finalText = ((await target.textContent().catch(() => '')) ?? '').trim();
      const grew = new Set(lengths).size > 1;
      return { text: cleanAnswerText(finalText, prompt), streamed: sawStopButton || grew };
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    [
      `Réponse non terminée dans le délai imparti (${Math.round(timeout / 1000)}s).`,
      `Bouton Stop observé : ${sawStopButton ? 'oui' : 'non'}.`,
      `Longueurs de texte échantillonnées : ${lengths.slice(0, 12).join(', ') || 'aucune'}.`,
    ].join(' '),
  );
}

/**
 * Le texte brut de la racine de message contient l'en-tête lecteur d'écran
 * (« Réponse N: ») et le libellé du modèle. On les retire pour que les assertions
 * portent sur la réponse elle-même.
 */
function cleanAnswerText(text: string, prompt: string): string {
  let cleaned = text.replace(/^\s*(réponse|response)\s*\d*\s*:\s*/i, '');
  if (prompt !== '' && cleaned.startsWith(prompt)) {
    cleaned = cleaned.slice(prompt.length);
  }
  return cleaned.trim();
}

/** Assertions communes à tout envoi censé aboutir. */
export async function expectHealthyAnswer(
  page: Page,
  result: AskResult,
  context: string,
): Promise<void> {
  expect(
    result.status,
    `${context} — la complétion a répondu HTTP ${result.status} (attendu 2xx).`,
  ).toBeLessThan(400);

  await expect(
    errorBubbles(page),
    `${context} — une bulle d'erreur est affichée dans la conversation.`,
  ).toHaveCount(0);

  expect(result.text.length, `${context} — le message d'assistant est vide.`).toBeGreaterThan(0);

  expect(
    result.streamed,
    `${context} — aucun signe de flux progressif (ni bouton Stop, ni texte en croissance).`,
  ).toBe(true);
}

/** Élément de navigation de la sidebar (Assistants, Skills, Mémoires, Fichiers, Paramètres…). */
export function navItem(page: Page, name: RegExp): Locator {
  return page.getByRole('button', { name }).first();
}

export const openDialog = (page: Page): Locator => page.getByRole('dialog');

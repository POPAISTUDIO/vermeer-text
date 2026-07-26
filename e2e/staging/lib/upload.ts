import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import type { Locator, Page, Response } from '@playwright/test';
import { UPLOAD_ROUTE } from './app';
import { uploadLimitMb } from './env';

export type UploadCall = {
  url: string;
  status: number;
  body: string;
};

/**
 * Attache un fichier au composer et rend le **statut HTTP réel** de chaque POST d'upload.
 * Une vignette visible ne prouve rien : seul le statut de la réponse dit si le fichier a
 * été accepté (413 du load balancer, 4xx de validation…).
 */
export async function attachFile(
  page: Page,
  filePath: string,
  opts: { timeout?: number } = {},
): Promise<UploadCall[]> {
  const timeout = opts.timeout ?? 120_000;
  const calls: UploadCall[] = [];

  const onResponse = (response: Response) => {
    const { pathname } = new URL(response.url());
    if (!UPLOAD_ROUTE.test(pathname) || response.request().method() !== 'POST') {
      return;
    }
    calls.push({ url: pathname, status: response.status(), body: '' });
    if (response.status() >= 400) {
      /* Le corps d'erreur (message du LB ou de l'API) est précieux dans le rapport. */
      void response
        .text()
        .then((text) => {
          const call = calls.find((entry) => entry.status === response.status() && entry.body === '');
          if (call != null) {
            call.body = text.slice(0, 500);
          }
        })
        .catch(() => undefined);
    }
  };

  page.on('response', onResponse);
  try {
    const input = await fileInput(page);
    await input.setInputFiles(filePath);

    await expect
      .poll(() => calls.length, {
        timeout,
        message: [
          `Aucun POST d'upload observé pour ${path.basename(filePath)}.`,
          "Le fichier n'a même pas été soumis au serveur (validation côté client, ou input non câblé).",
        ].join(' '),
      })
      .toBeGreaterThan(0);

    /* Laisse arriver une éventuelle seconde requête (image + métadonnées). */
    await page.waitForTimeout(1_500);
    return [...calls];
  } finally {
    page.off('response', onResponse);
  }
}

async function fileInput(page: Page): Promise<Locator> {
  const direct = page.locator('input[type="file"]');
  if ((await direct.count()) > 0) {
    return direct.first();
  }

  const attachButton = page
    .getByRole('button', { name: /joindre|attach/i })
    .or(page.locator('#composer-actions-menu-button'))
    .first();
  await attachButton.click({ timeout: 10_000 });
  await expect(
    direct.first(),
    "Aucun input[type=file] disponible après ouverture du menu de pièces jointes.",
  ).toBeAttached({ timeout: 10_000 });
  return direct.first();
}

/**
 * Vignette d'image dans le composer. `ImagePreview` ne rend PAS un `<img>` : c'est un
 * `<button>` porteur d'un `background-image` (blob local puis URL servie), dont le nom
 * accessible est « View Preview image in… ».
 */
export const imageThumbnail = (page: Page): Locator =>
  page.getByRole('button', { name: /preview image/i });

/** Bouton de retrait d'une pièce jointe du composer. */
export const removeAttachmentButton = (page: Page): Locator =>
  page.getByRole('button', { name: /supprimer le fichier|remove file/i });

/** Ligne de fichier non-image : `FileContainer` porte le nom du fichier en `title`. */
export const fileChip = (page: Page, fileName: string): Locator =>
  page.locator(`[title="${fileName}"]`);

export function expectUploadAccepted(calls: UploadCall[], filePath: string): void {
  const sizeMb = fs.statSync(filePath).size / (1024 * 1024);
  const limit = uploadLimitMb();
  const statuses = calls.map((call) => call.status);
  const tooLarge = calls.filter((call) => call.status === 413);

  expect(
    tooLarge,
    [
      `HTTP 413 sur l'upload de ${path.basename(filePath)} (${sizeMb.toFixed(2)} Mo).`,
      `La limite attendue de l'environnement est ${limit} Mo (E2E_UPLOAD_LIMIT_MB).`,
      'Soit la limite du load balancer a régressé, soit la limite réelle est plus basse',
      "que celle documentée dans la recette — à trancher avant de faire évoluer l'attente.",
      tooLarge[0]?.body != null && tooLarge[0].body !== '' ? `Corps : ${tooLarge[0].body}` : '',
    ].join(' '),
  ).toHaveLength(0);

  expect(
    statuses.filter((status) => status >= 400),
    `Upload de ${path.basename(filePath)} refusé — statuts observés : ${statuses.join(', ')}.`,
  ).toHaveLength(0);

  expect(statuses.length, `Aucun statut d'upload capturé pour ${path.basename(filePath)}.`).toBeGreaterThan(0);
}

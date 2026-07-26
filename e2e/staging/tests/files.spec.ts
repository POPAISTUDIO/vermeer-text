import { expect, test } from '../lib/test';
import { ask, expectHealthyAnswer, newConversation } from '../lib/app';
import { LARGE_IMAGE, MEDIUM_IMAGE, SMALL_IMAGE, fixture } from '../lib/fixtures';
import { attachFile, expectUploadAccepted, imageThumbnail } from '../lib/upload';

/** Formes et couleurs présentes dans sample-small.png (disque rouge + rectangle bleu). */
const VISUAL_CONTENT = /(rouge|red|cercle|rond|disque|circle|bleu|blue|rectangle|carré|square|forme|shape)/i;

test.describe('FILE — fichiers', () => {
  test(
    "FILE-01 — image jointe : upload accepté et contenu visuel pris en compte",
    { tag: ['@wave1'] },
    async ({ page }) => {
      await newConversation(page);

      const file = fixture(SMALL_IMAGE);
      const calls = await attachFile(page, file);
      expectUploadAccepted(calls, file);

      await expect(
        imageThumbnail(page).first(),
        "Aucune vignette d'image dans le composer après un upload accepté.",
      ).toBeVisible({ timeout: 30_000 });

      const result = await ask(page, 'Que vois-tu sur cette image ?');
      await expectHealthyAnswer(page, result, 'FILE-01');

      expect(
        VISUAL_CONTENT.test(result.text),
        [
          "Le modèle ne décrit pas le contenu visuel de l'image.",
          "L'image jointe contient un disque rouge et un rectangle bleu sur fond blanc ;",
          'aucun terme de forme ou de couleur attendu n’apparaît dans la réponse.',
          `Réponse reçue : ${truncate(result.text)}`,
        ].join(' '),
      ).toBe(true);
    },
  );

  test(
    'FILE-03 — image SANS texte accompagnant, puis suite de conversation (non-régression #20)',
    { tag: ['@wave1'] },
    async ({ page }) => {
      await newConversation(page);

      const file = fixture(SMALL_IMAGE);
      const calls = await attachFile(page, file);
      expectUploadAccepted(calls, file);
      await expect(imageThumbnail(page).first()).toBeVisible({ timeout: 30_000 });

      /* Envoi de l'image seule : composer vide. */
      const imageOnly = await ask(page, '', { emptyPrompt: true });
      expect(
        imageOnly.status,
        `Image envoyée sans texte : HTTP ${imageOnly.status} (le 400 « non-empty content » ne doit pas réapparaître).`,
      ).not.toBe(400);
      await expectHealthyAnswer(page, imageOnly, 'FILE-03 (image seule)');

      /* Puis la conversation doit continuer normalement. */
      const followUp = await ask(page, 'Merci. Redis-moi en une phrase ce que tu as vu.');
      expect(
        followUp.status,
        `Message de suite après une image seule : HTTP ${followUp.status} (attendu 2xx, régression #20 si 400).`,
      ).not.toBe(400);
      await expectHealthyAnswer(page, followUp, 'FILE-03 (suite de conversation)');
    },
  );

  /**
   * FILE-02 / FILE-04 — limite de taille d'upload, asserté sur le STATUT HTTP réel du POST.
   *
   * Divergence documentée : dans la recette triée, FILE-02 décrit l'ajout d'un PDF (P2) et
   * FILE-04 l'upload volumineux « jusqu'à ~10 Mo, sans 413 (limite du LB relevée) ». Les
   * deux cas ci-dessous reprennent les tailles du script exploratoire (1,5 Mo et 8 Mo) et
   * asservissent l'attente de la recette : aucun 413 sous la limite de l'environnement
   * (E2E_UPLOAD_LIMIT_MB, 10 Mo par défaut). Cf. README § Divergences.
   */
  test(
    'FILE-02 — upload de 1,5 Mo accepté (aucun 413)',
    { tag: ['@extra'] },
    async ({ page }) => {
      await newConversation(page);
      const file = fixture(MEDIUM_IMAGE);
      const calls = await attachFile(page, file);
      expectUploadAccepted(calls, file);
    },
  );

  test(
    'FILE-04 — upload de 8 Mo accepté (aucun 413)',
    { tag: ['@extra'] },
    async ({ page }) => {
      test.setTimeout(240_000);
      await newConversation(page);
      const file = fixture(LARGE_IMAGE);
      const calls = await attachFile(page, file, { timeout: 180_000 });
      expectUploadAccepted(calls, file);
    },
  );
});

function truncate(value: string): string {
  return value.length > 300 ? `${value.slice(0, 300)}…` : value;
}

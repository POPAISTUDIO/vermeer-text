import fs from 'node:fs';
import path from 'node:path';

const suiteRoot = path.resolve(__dirname, '..');

export const authStateFile = path.join(suiteRoot, 'auth.json');
export const fixturesDir = path.join(suiteRoot, 'fixtures');

/**
 * Message unique de session expirée. Le test de garde et toute assertion dépendant de
 * l'authentification l'utilisent, pour qu'une expiration de session ne soit jamais lue
 * comme un bug produit.
 */
export const SESSION_EXPIRED_MESSAGE =
  'Session QA expirée — régénérer QA_STORAGE_STATE (voir e2e/staging/README.md)';

export function requireBaseUrl(): string {
  const raw = process.env.BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      [
        'BASE_URL est absent : la suite ne sait pas quel environnement cibler.',
        '',
        'Aucune URL n’est codée en dur dans ce dépôt. Exporter la cible avant de lancer :',
        '  export BASE_URL="https://<hôte-de-l-environnement>"',
        '',
        'En CI : variable/secret BASE_URL du workflow. Voir e2e/staging/README.md.',
      ].join('\n'),
    );
  }
  return raw.replace(/\/+$/, '');
}

export function requireAuthState(): string {
  if (!fs.existsSync(authStateFile)) {
    throw new Error(
      [
        `auth.json est absent (${authStateFile}).`,
        '',
        'L’environnement cible est derrière un SSO : aucun login par formulaire n’est possible.',
        'L’authentification passe exclusivement par un storageState capturé à la main.',
        '',
        'Régénération : voir e2e/staging/README.md § Régénérer auth.json.',
        'En CI : le secret QA_STORAGE_STATE est décodé en base64 vers e2e/staging/auth.json.',
      ].join('\n'),
    );
  }
  return authStateFile;
}

/** Limite de taille d'upload attendue de l'environnement, en Mo (limite du load balancer). */
export function uploadLimitMb(): number {
  const raw = process.env.E2E_UPLOAD_LIMIT_MB?.trim();
  const parsed = raw != null && raw !== '' ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

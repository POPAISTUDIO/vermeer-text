import path from 'node:path';

const suiteRoot = path.resolve(__dirname, '..');

export const fixturesDir = path.join(suiteRoot, 'fixtures');

/**
 * Message unique de session indisponible. Le test de garde et toute assertion dépendant de
 * l'authentification l'utilisent, pour qu'un défaut de session ne soit jamais lu comme un
 * bug produit.
 *
 * Le libellé ne nomme aucun secret : la remédiation vit dans le README, dont le triage
 * connaît le renvoi (§3). Il reste rédigé en « session » — c'est le vocabulaire de la
 * catégorie SESSION EXPIRÉE du triage, et le test de garde qui le porte en est le
 * déclencheur nommé.
 */
export const SESSION_EXPIRED_MESSAGE =
  'Session QA indisponible — le compte de service ne s’authentifie pas (voir e2e/staging/README.md §3)';

/**
 * Message du prérequis CGU. Il existe séparément pour que l'échec nomme sa cause là où elle
 * se produit — au login — plutôt que de se manifester 150 s plus loin en timeout muet sur un
 * bouton recouvert par le dialogue d'acceptation.
 */
export const TERMS_PREREQUISITE_MESSAGE =
  'Prérequis CGU non satisfait — le compte de service n’a pas accepté les conditions, et la suite n’a pas réussi à les accepter pour lui. Le dialogue « Terms of Service » recouvrira toute la page et fera échouer chaque cas (voir e2e/staging/README.md §3).';

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

export type ServiceCredentials = {
  email: string;
  password: string;
};

/**
 * Identifiants du compte de service de QA. Ils ne sont lus qu'ici, et la valeur du mot de
 * passe n'est jamais journalisée : les messages d'erreur ne citent que les NOMS des
 * variables manquantes.
 */
export function requireServiceCredentials(): ServiceCredentials {
  const email = process.env.QA_SERVICE_EMAIL?.trim();
  const password = process.env.QA_SERVICE_PASSWORD;

  const missing = [
    ['QA_SERVICE_EMAIL', email],
    ['QA_SERVICE_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      [
        `Identifiants du compte de service absents : ${missing.join(', ')}.`,
        '',
        'La suite s’authentifie par login programmatique à chaque test — il n’y a plus de',
        'storageState capturé à la main.',
        '',
        'En CI : secrets Actions de vermeer-text. En local : exporter les deux variables.',
        'Procédure complète : e2e/staging/README.md §3.',
      ].join('\n'),
    );
  }

  return { email: email as string, password: password as string };
}

/** Limite de taille d'upload attendue de l'environnement, en Mo (limite du load balancer). */
export function uploadLimitMb(): number {
  const raw = process.env.E2E_UPLOAD_LIMIT_MB?.trim();
  const parsed = raw != null && raw !== '' ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

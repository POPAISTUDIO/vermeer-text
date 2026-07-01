// Vermeer: déclencheur automatique et idempotent du reset mensuel des seuils budget.
// Additif et isolé — n'appelle que resetMonthBudgets() (natif Vermeer, inchangé) et
// n'utilise aucune dépendance externe (setInterval natif, pas de node-cron).
const { logger } = require('@librechat/data-schemas');
const db = require('~/models');
const VermeerJobState = require('./jobState');

// Vermeer: _id du doc marqueur unique pour ce job.
const JOB_ID = 'monthlyBudgetReset';

// Vermeer: clé de mois UTC alignée sur currentMonthStartUTC() (transaction.ts) → 'YYYY-MM'.
function currentMonthKeyUTC() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Vermeer: réclame le mois courant de façon atomique ; le premier pod qui gagne le claim
// exécute resetMonthBudgets(). Le marqueur rend l'appel idempotent (safe multi-réplicas).
async function ensureMonthlyBudgetReset() {
  const monthKey = currentMonthKeyUTC();
  let prev;
  try {
    // Claim atomique : ne matche que si le mois n'a pas encore été traité.
    // Retour (new: false) : null = doc inséré par l'upsert (ce pod a gagné) ;
    // doc non-null = ancien lastResetMonth != monthKey, ce pod a gagné l'update.
    prev = await VermeerJobState.findOneAndUpdate(
      { _id: JOB_ID, lastResetMonth: { $ne: monthKey } },
      { $set: { lastResetMonth: monthKey, updatedAt: new Date() } },
      { upsert: true, new: false },
    );
  } catch (err) {
    if (err && err.code === 11000) {
      // Duplicate key : le mois est déjà traité (filtre non matché) ou un autre pod a
      // gagné la course à l'upsert. Skip silencieux, pas d'erreur.
      logger.debug(`[Vermeer] Monthly budget reset already claimed for ${monthKey}, skipping.`);
      return;
    }
    logger.error(`[Vermeer] Monthly budget reset claim failed for ${monthKey}:`, err);
    return;
  }

  // Claim gagné → restauration seuil <- baseline pour tous les users.
  try {
    const modifiedCount = await db.resetMonthBudgets();
    logger.info(
      `[Vermeer] Monthly budget reset claimed for ${monthKey}: ${modifiedCount} balance(s) restored to baseline.`,
    );
  } catch (err) {
    // Rollback du marqueur : le reset a échoué, on ré-arme le mois pour retenter au
    // prochain tick (sinon le marqueur reste grillé → skip permanent, échec silencieux).
    await VermeerJobState.updateOne(
      { _id: JOB_ID },
      { $set: { lastResetMonth: prev ? prev.lastResetMonth : null, updatedAt: new Date() } },
    ).catch((rollbackErr) => {
      logger.error(
        `[Vermeer] Monthly budget reset marker rollback failed for ${monthKey}:`,
        rollbackErr,
      );
    });
    logger.error(`[Vermeer] Monthly budget reset failed for ${monthKey}:`, err);
  }
}

// Vermeer: arme le scheduler au boot. Rattrapage immédiat + tick horaire auto-réparant.
// Ne bloque JAMAIS le démarrage serveur en cas d'échec.
function startBudgetResetScheduler() {
  // Vermeer: kill-switch réversible en 1 ligne (défaut activé ; 'false' désarme tout).
  if (process.env.VERMEER_BUDGET_RESET_ENABLED === 'false') {
    logger.info(
      '[Vermeer] Monthly budget reset scheduler disabled via VERMEER_BUDGET_RESET_ENABLED=false.',
    );
    return;
  }

  const intervalMs = Number(process.env.VERMEER_BUDGET_RESET_INTERVAL_MS) || 3600000;

  // Rattrapage au boot (couvre un pod down au passage de mois à 00:00 UTC).
  ensureMonthlyBudgetReset().catch((err) => {
    logger.error('[Vermeer] Monthly budget reset boot check failed:', err);
  });

  // Tick horaire : le marqueur garantit l'idempotence, donc l'appel répété est sûr.
  const timer = setInterval(() => {
    ensureMonthlyBudgetReset().catch((err) => {
      logger.error('[Vermeer] Monthly budget reset interval check failed:', err);
    });
  }, intervalMs);
  timer.unref();

  logger.info(`[Vermeer] Monthly budget reset scheduler armed (intervalMs=${intervalMs}).`);
}

module.exports = { ensureMonthlyBudgetReset, startBudgetResetScheduler };

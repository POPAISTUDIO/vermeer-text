// Vermeer: spec du déclencheur automatique du reset mensuel des seuils budget.
// Idempotence testée contre un vrai Mongo en mémoire ; resetMonthBudgets isolé (mock)
// puisqu'il est déjà couvert par budget.spec.ts.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('~/models', () => ({
  resetMonthBudgets: jest.fn().mockResolvedValue(0),
}));

const db = require('~/models');
const VermeerJobState = require('./jobState');
const { ensureMonthlyBudgetReset } = require('./budgetResetScheduler');

const JOB_ID = 'monthlyBudgetReset';

function currentMonthKeyUTC() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('[Vermeer] ensureMonthlyBudgetReset', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await VermeerJobState.deleteMany({});
    db.resetMonthBudgets.mockClear();
    db.resetMonthBudgets.mockResolvedValue(3);
  });

  test('mois neuf (doc absent) : claim gagné, resetMonthBudgets appelé exactement 1 fois', async () => {
    await ensureMonthlyBudgetReset();

    expect(db.resetMonthBudgets).toHaveBeenCalledTimes(1);
    const doc = await VermeerJobState.findById(JOB_ID).lean();
    expect(doc.lastResetMonth).toBe(currentMonthKeyUTC());
  });

  test('même mois rejoué : skip idempotent, resetMonthBudgets non rappelé', async () => {
    await ensureMonthlyBudgetReset();
    await ensureMonthlyBudgetReset();

    expect(db.resetMonthBudgets).toHaveBeenCalledTimes(1);
  });

  test('marqueur sur mois précédent : claim gagné, resetMonthBudgets appelé', async () => {
    await VermeerJobState.create({
      _id: JOB_ID,
      lastResetMonth: '2000-01',
      updatedAt: new Date(),
    });

    await ensureMonthlyBudgetReset();

    expect(db.resetMonthBudgets).toHaveBeenCalledTimes(1);
    const doc = await VermeerJobState.findById(JOB_ID).lean();
    expect(doc.lastResetMonth).toBe(currentMonthKeyUTC());
  });

  test('E11000 au claim : skip gracieux, aucune exception, resetMonthBudgets non appelé', async () => {
    const duplicateKeyError = new Error('E11000 duplicate key error');
    duplicateKeyError.code = 11000;
    const spy = jest
      .spyOn(VermeerJobState, 'findOneAndUpdate')
      .mockRejectedValueOnce(duplicateKeyError);

    await expect(ensureMonthlyBudgetReset()).resolves.toBeUndefined();

    expect(db.resetMonthBudgets).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('resetMonthBudgets jette : marqueur rollback (non avancé), retry re-claim au 2e appel', async () => {
    db.resetMonthBudgets
      .mockRejectedValueOnce(new Error('Wrong type for parameter u'))
      .mockResolvedValueOnce(5);

    // 1er appel : claim gagné puis reset échoue → le marqueur est rollback, pas avancé.
    await ensureMonthlyBudgetReset();
    expect(db.resetMonthBudgets).toHaveBeenCalledTimes(1);
    const afterFail = await VermeerJobState.findById(JOB_ID).lean();
    expect(afterFail.lastResetMonth).not.toBe(currentMonthKeyUTC());

    // 2e appel : marqueur ré-armé → re-claim, reset réussit → marqueur avancé.
    await ensureMonthlyBudgetReset();
    expect(db.resetMonthBudgets).toHaveBeenCalledTimes(2);
    const afterOk = await VermeerJobState.findById(JOB_ID).lean();
    expect(afterOk.lastResetMonth).toBe(currentMonthKeyUTC());
  });
});

import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';
import { createBudgetMethods, DEFAULT_MONTHLY_BUDGET } from './budget';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

let mongoServer: InstanceType<typeof MongoMemoryServer>;
let getAllBudgets: ReturnType<typeof createBudgetMethods>['getAllBudgets'];
let resetMonthBudgets: ReturnType<typeof createBudgetMethods>['resetMonthBudgets'];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const models = createModels(mongoose);
  Object.assign(mongoose.models, models);
  const methods = createBudgetMethods(mongoose);
  getAllBudgets = methods.getAllBudgets;
  resetMonthBudgets = methods.resetMonthBudgets;
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

const thisMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
};

const lastMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
};

async function seedUser(name: string | null, email: string | null): Promise<Types.ObjectId> {
  const doc = await mongoose.models.User.create({ name, email });
  return doc._id as Types.ObjectId;
}

async function seedTransaction(
  user: Types.ObjectId,
  tokenType: string,
  tokenValue: number,
  createdAt: Date,
) {
  await mongoose.models.Transaction.create({
    user,
    tokenType,
    tokenValue,
    model: 'gpt-4o',
    createdAt,
  });
}

describe('getAllBudgets', () => {
  test('returns one row per user, current-month prompt+completion spend only', async () => {
    const alice = await seedUser('Alice', 'alice@betc.com');
    const bob = await seedUser('Bob', 'bob@pop.com');

    await mongoose.models.Balance.create({
      user: alice,
      monthlyBudget: 5_000_000,
      monthlyBudgetBaseline: 7_000_000,
    });

    await seedTransaction(alice, 'prompt', -1000, thisMonth());
    await seedTransaction(alice, 'completion', -2000, thisMonth());
    await seedTransaction(alice, 'prompt', -9999, lastMonth());
    await seedTransaction(bob, 'prompt', -500, thisMonth());

    const rows = await getAllBudgets();

    expect(rows).toHaveLength(2);

    const byUser = new Map(rows.map((r) => [r.user, r]));
    const aliceRow = byUser.get(String(alice))!;
    const bobRow = byUser.get(String(bob))!;

    expect(aliceRow.currentMonthSpend).toBe(3000);
    expect(aliceRow.monthlyBudget).toBe(5_000_000);
    expect(aliceRow.monthlyBudgetBaseline).toBe(7_000_000);

    expect(bobRow.currentMonthSpend).toBe(500);
    expect(bobRow.monthlyBudget).toBe(DEFAULT_MONTHLY_BUDGET);
    expect(bobRow.monthlyBudgetBaseline).toBe(DEFAULT_MONTHLY_BUDGET);
  });

  test('includes users with no transactions and no balance at zero spend', async () => {
    const idle = await seedUser('Idle', 'idle@pop.com');

    const rows = await getAllBudgets();

    expect(rows).toHaveLength(1);
    expect(rows[0].user).toBe(String(idle));
    expect(rows[0].currentMonthSpend).toBe(0);
    expect(rows[0].monthlyBudget).toBe(DEFAULT_MONTHLY_BUDGET);
  });

  test('ignores token types other than prompt/completion', async () => {
    const user = await seedUser('Casey', 'casey@pop.com');
    await seedTransaction(user, 'prompt', -1000, thisMonth());
    await seedTransaction(user, 'credits', -50000, thisMonth());

    const rows = await getAllBudgets();
    expect(rows[0].currentMonthSpend).toBe(1000);
  });

  test('sorts by spend desc, then name/email/user asc (nulls first)', async () => {
    const big = await seedUser('Zoe', 'zoe@pop.com');
    const nullName = await seedUser(null, 'aaa@pop.com');
    const named = await seedUser('Anna', 'anna@pop.com');

    await seedTransaction(big, 'prompt', -10000, thisMonth());
    // nullName and named both at 0 spend → secondary sort: null name before "Anna"

    const rows = await getAllBudgets();

    expect(rows.map((r) => r.user)).toEqual([String(big), String(nullName), String(named)]);
  });
});

describe('resetMonthBudgets', () => {
  test('restores monthlyBudget to baseline per doc, falling back to default when baseline is null', async () => {
    const alice = await seedUser('Alice', 'alice@betc.com');
    const bob = await seedUser('Bob', 'bob@pop.com');

    await mongoose.models.Balance.create({
      user: alice,
      monthlyBudget: 5_000_000,
      monthlyBudgetBaseline: 7_000_000,
    });
    await mongoose.models.Balance.create({
      user: bob,
      monthlyBudget: 3_000_000,
      monthlyBudgetBaseline: null,
    });

    const modified = await resetMonthBudgets();

    expect(modified).toBe(2);
    const aliceBalance = await mongoose.models.Balance.findOne({ user: alice }).lean<{
      monthlyBudget: number;
    }>();
    const bobBalance = await mongoose.models.Balance.findOne({ user: bob }).lean<{
      monthlyBudget: number;
    }>();
    expect(aliceBalance!.monthlyBudget).toBe(7_000_000);
    expect(bobBalance!.monthlyBudget).toBe(DEFAULT_MONTHLY_BUDGET);
  });

  test('no Balance documents: returns 0 without throwing', async () => {
    await expect(resetMonthBudgets()).resolves.toBe(0);
  });
});

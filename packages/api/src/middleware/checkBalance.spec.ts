import { ViolationTypes } from 'librechat-data-provider';
import { DEFAULT_MONTHLY_BUDGET } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { CheckBalanceDeps } from './checkBalance';
import type { ServerRequest } from '~/types/http';
import { checkBalance } from './checkBalance';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('checkBalance (monthly budget gate)', () => {
  const createMockDeps = (overrides: Partial<CheckBalanceDeps> = {}): CheckBalanceDeps => ({
    findBalanceByUser: jest.fn().mockResolvedValue({ monthlyBudget: 1000 }),
    getCurrentMonthSpend: jest.fn().mockResolvedValue(0),
    getMultiplier: jest.fn().mockReturnValue(1),
    logViolation: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const req = { user: { id: 'user-1' } } as ServerRequest;
  const res = {} as Response;

  const baseTxData = {
    user: 'user-1',
    tokenType: 'prompt',
    amount: 100,
    endpoint: 'openAI',
    model: 'gpt-4',
  };

  it('allows the request when month-to-date spend plus cost stays under the budget', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue({ monthlyBudget: 1000 }),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(500),
    });

    const result = await checkBalance({ req, res, txData: baseTxData }, deps);

    expect(result).toBe(true);
    expect(deps.logViolation).not.toHaveBeenCalled();
  });

  it('allows the request when spend plus cost exactly equals the budget (inclusive cap)', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue({ monthlyBudget: 1000 }),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(900),
    });

    const result = await checkBalance({ req, res, txData: { ...baseTxData, amount: 100 } }, deps);

    expect(result).toBe(true);
  });

  it('blocks the request and reports budget terms when spend plus cost exceeds the budget', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue({ monthlyBudget: 1000 }),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(950),
    });

    await expect(
      checkBalance({ req, res, txData: { ...baseTxData, amount: 100 } }, deps),
    ).rejects.toThrow();

    expect(deps.logViolation).toHaveBeenCalledWith(
      req,
      res,
      ViolationTypes.TOKEN_BALANCE,
      expect.objectContaining({ currentMonthSpend: 950, monthlyBudget: 1000, tokenCost: 100 }),
      0,
    );
  });

  it('applies the model multiplier to the token cost before comparing against the budget', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue({ monthlyBudget: 1000 }),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(0),
      getMultiplier: jest.fn().mockReturnValue(20),
    });

    await expect(
      checkBalance({ req, res, txData: { ...baseTxData, amount: 100 } }, deps),
    ).rejects.toThrow();

    expect(deps.logViolation).toHaveBeenCalledWith(
      req,
      res,
      ViolationTypes.TOKEN_BALANCE,
      expect.objectContaining({ tokenCost: 2000, monthlyBudget: 1000 }),
      0,
    );
  });

  it('falls back to the default budget and allows the request when the user has no Balance record', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue(null),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(0),
    });

    const result = await checkBalance({ req, res, txData: baseTxData }, deps);

    expect(result).toBe(true);
  });

  it('blocks against the default budget when no record exists and spend already exceeds it', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue(null),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(DEFAULT_MONTHLY_BUDGET),
    });

    await expect(
      checkBalance({ req, res, txData: { ...baseTxData, amount: 100 } }, deps),
    ).rejects.toThrow();

    expect(deps.logViolation).toHaveBeenCalledWith(
      req,
      res,
      ViolationTypes.TOKEN_BALANCE,
      expect.objectContaining({ monthlyBudget: DEFAULT_MONTHLY_BUDGET }),
      0,
    );
  });

  it('does not lock out a user whose Balance has tokenCredits 0 but is under the monthly budget (bug a regression)', async () => {
    const deps = createMockDeps({
      findBalanceByUser: jest.fn().mockResolvedValue({ tokenCredits: 0, monthlyBudget: 1000 }),
      getCurrentMonthSpend: jest.fn().mockResolvedValue(100),
    });

    const result = await checkBalance({ req, res, txData: { ...baseTxData, amount: 100 } }, deps);

    expect(result).toBe(true);
    expect(deps.logViolation).not.toHaveBeenCalled();
  });
});

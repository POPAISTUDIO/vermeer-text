import { logger, DEFAULT_MONTHLY_BUDGET } from '@librechat/data-schemas';
import { ViolationTypes } from 'librechat-data-provider';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';

interface BalanceRecord {
  monthlyBudget?: number;
}

interface TxData {
  user: string;
  model?: string;
  endpoint?: string;
  valueKey?: string;
  tokenType?: string;
  amount: number;
  endpointTokenConfig?: unknown;
  generations?: unknown[];
}

export interface CheckBalanceDeps {
  findBalanceByUser: (user: string) => Promise<BalanceRecord | null>;
  getMultiplier: (params: Record<string, unknown>) => number;
  getCurrentMonthSpend: (user: string) => Promise<number>;
  logViolation: (
    req: unknown,
    res: unknown,
    type: string,
    errorMessage: Record<string, unknown>,
    score: number,
  ) => Promise<void>;
}

interface BudgetCheck {
  canSpend: boolean;
  currentMonthSpend: number;
  monthlyBudget: number;
  tokenCost: number;
}

/**
 * Gates a request against the user's monthly budget. The budget caps month-to-date
 * consumption; it is not a depleting wallet. Spend is derived live from transactions since
 * the start of the current month UTC (calendar-based reset, no reset job), and the threshold
 * is admin-editable (`monthlyBudget`). A user with no Balance record falls back to
 * DEFAULT_MONTHLY_BUDGET so editing or omitting a threshold never locks anyone out.
 */
async function checkBalanceRecord(txData: TxData, deps: CheckBalanceDeps): Promise<BudgetCheck> {
  const { user, model, endpoint, valueKey, tokenType, amount, endpointTokenConfig } = txData;
  const multiplier = deps.getMultiplier({
    valueKey,
    tokenType,
    model,
    endpoint,
    endpointTokenConfig,
  });
  const tokenCost = amount * multiplier;

  const [record, currentMonthSpend] = await Promise.all([
    deps.findBalanceByUser(user),
    deps.getCurrentMonthSpend(user),
  ]);
  const monthlyBudget = record?.monthlyBudget ?? DEFAULT_MONTHLY_BUDGET;

  logger.debug('[Balance.check] Monthly budget gate', {
    user,
    model,
    endpoint,
    valueKey,
    tokenType,
    amount,
    multiplier,
    currentMonthSpend,
    monthlyBudget,
    tokenCost,
  });

  return {
    canSpend: currentMonthSpend + tokenCost <= monthlyBudget,
    currentMonthSpend,
    monthlyBudget,
    tokenCost,
  };
}

/**
 * Checks the monthly budget for a user and logs a violation if the next request would push
 * month-to-date spend over the threshold. Throws an error with the budget info when blocked.
 */
export async function checkBalance(
  { req, res, txData }: { req: ServerRequest; res: Response; txData: TxData },
  deps: CheckBalanceDeps,
): Promise<boolean> {
  const { canSpend, currentMonthSpend, monthlyBudget, tokenCost } = await checkBalanceRecord(
    txData,
    deps,
  );
  if (canSpend) {
    return true;
  }

  const type = ViolationTypes.TOKEN_BALANCE;
  const errorMessage: Record<string, unknown> = {
    type,
    currentMonthSpend,
    monthlyBudget,
    tokenCost,
    promptTokens: txData.amount,
  };

  if (txData.generations && txData.generations.length > 0) {
    errorMessage.generations = txData.generations;
  }

  await deps.logViolation(req, res, type, errorMessage, 0);
  throw new Error(JSON.stringify(errorMessage));
}

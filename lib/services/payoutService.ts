const MIN_CUSTOMER_PRICE = 25;
const BASE_SHERBING_FEE = 20;
const MID_TIER_THRESHOLD = 50;
const HIGH_TIER_THRESHOLD = 100;

export type PayoutBreakdown = {
  customerPrice: number;
  sherbingFee: number;
  employeePayout: number;
  tierPercent: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function enforceMinimumCustomerPrice(price: number): number {
  if (!Number.isFinite(price)) return MIN_CUSTOMER_PRICE;
  return Math.max(price, MIN_CUSTOMER_PRICE);
}

export function calculatePayoutBreakdown(price: number): PayoutBreakdown {
  const customerPrice = enforceMinimumCustomerPrice(price);

  let tierPercent = 0;
  if (customerPrice > HIGH_TIER_THRESHOLD) {
    tierPercent = 0.2;
  } else if (customerPrice > MID_TIER_THRESHOLD) {
    tierPercent = 0.1;
  }

  const variableFeeBase = Math.max(customerPrice - BASE_SHERBING_FEE, 0);
  const sherbingFee = BASE_SHERBING_FEE + variableFeeBase * tierPercent;
  const employeePayout = Math.max(customerPrice - sherbingFee, 0);

  return {
    customerPrice: roundCurrency(customerPrice),
    sherbingFee: roundCurrency(sherbingFee),
    employeePayout: roundCurrency(employeePayout),
    tierPercent,
  };
}

export const PAYOUT_RULES = {
  MIN_CUSTOMER_PRICE,
  BASE_SHERBING_FEE,
  MID_TIER_THRESHOLD,
  HIGH_TIER_THRESHOLD,
};

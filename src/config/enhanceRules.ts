export const TIER_PROTECTION_COST_RATES: Record<number, number> = {
  3: 1.0,
  4: 0.5,
  5: 0.25,
  6: 0.125,
  7: 0.06,
};

export const DEFAULT_ENHANCE_RATES = [100, 100, 100, 85, 70, 51, 35, 30, 25];
export const DEFAULT_PROTECTION_PRICE = 100;

export const getProtectionCountForFailRate = (
  tier: number,
  successRatePercent: number,
): number => {
  const failRate = 100 - successRatePercent;
  const costUnit = TIER_PROTECTION_COST_RATES[tier] ?? 1.0;
  return Math.ceil(failRate / costUnit);
};

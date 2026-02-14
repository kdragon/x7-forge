// 티어별 보호제 소모 비율 (N% 당 보호제 1개)
const TIER_COST_RATES: Record<number, number> = {
  3: 1.0,    // 1% 당 1개
  4: 0.5,    // 0.5% 당 1개 (2배)
  5: 0.25,   // 0.25% 당 1개 (4배)
  6: 0.125,  // 0.125% 당 1개 (8배)
  7: 0.06    // 0.06% 당 1개 (약 16.7배)
};

export interface SimulationResult {
  tier: number;
  totalProtectionItems: number; // 총 보호제 개수
  totalCostKrw: number;         // 총 비용 (원)
  breakdown: number[];          // 단계별 소모량 (+1~+9)
}

/**
 * 특정 티어의 +9강 달성 비용 시뮬레이션
 * @param tier 아이템 티어 (3~7)
 * @param successRates 강화 성공 확률 배열 (0~1 사이의 값, +1~+9강)
 * @param pricePerItem 보호제 개당 가격 (기본 100원)
 */
export const simulateEnhanceCost = (
  tier: number, 
  successRates: number[], 
  pricePerItem: number = 100
): SimulationResult => {
  const costUnit = TIER_COST_RATES[tier] || 1.0;
  let totalItems = 0;
  const breakdown: number[] = [];

  // 각 단계별 기댓값 계산 (Average Case)
  successRates.forEach((rate) => {
    const failRatePercent = 100 - rate;

    // 1회 시도 시 필요한 보호제 개수 (올림 처리)
    // 예: 40% 실패, 1.0%당 1개 -> 40 / 1.0 = 40개 소모
    // 예: 40% 실패, 0.5%당 1개 -> 40 / 0.5 = 80개 소모
    const itemsPerTry = Math.ceil(failRatePercent / costUnit);

    // 성공하기 위해 필요한 평균 시도 횟수 (기하분포 기댓값: 1/p)
    const averageTries = 100 / rate;
    
    // 해당 단계 총 소모량
    const stepTotal = itemsPerTry * averageTries;
    
    breakdown.push(Math.round(stepTotal));
    totalItems += stepTotal;
  });

  return {
    tier,
    totalProtectionItems: Math.round(totalItems),
    totalCostKrw: Math.round(totalItems) * pricePerItem,
    breakdown
  };
};

/**
 * 모든 티어의 +9강 달성 비용 계산
 * @param successRates 강화 성공 확률 배열
 * @param pricePerItem 보호제 개당 가격
 */
export const simulateAllTiers = (successRates: number[], pricePerItem: number = 100) => {
  const tiers = [3, 4, 5, 6, 7];
  return tiers.map(tier => simulateEnhanceCost(tier, successRates, pricePerItem));
};

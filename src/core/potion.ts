export interface AutoPotionConfig {
  /** 체력 회복량 */
  healAmount: number;
  /** 자동 사용 HP 비율 (0~1) */
  hpThreshold: number;
  /** 쿨타임 (ms) */
  cooldownMs: number;
}

// 이후 등급/조건별로 쉽게 확장할 수 있도록 기본 설정만 분리
export const DEFAULT_POTION_CONFIG: AutoPotionConfig = {
  healAmount: 300,
  hpThreshold: 0.7,
  cooldownMs: 15_000,
};

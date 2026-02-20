export type BattlePhase = 'idle' | 'attack' | 'hit' | 'dead' | 'spawn';

export interface MonsterStats {
  maxHP: number;
  attack: number;
  defense: number;
  baseExp: number;
}

// 사냥 드랍 확률 (1% 고정)
export const HUNTING_DROP_RATE = 0.01;

// 방어도 기반 대미지 계산
// 피해 감소율 = defense / (defense + 500)
// 실제 대미지 배율 = 1 - 피해 감소율 = 500 / (defense + 500)
export function calculateDamage(attack: number, defense: number): number {
  if (attack <= 0) return 0;
  if (defense < 0) defense = 0;
  const multiplier = 500 / (defense + 500);
  const damage = Math.floor(attack * multiplier);
  return damage < 0 ? 0 : damage;
}

// 티어별 몬스터 기본 스탯
// 아래 값은 제공해준 테이블(Tier, 공격력, 방어력, 체력, 베이스경험치)을 그대로 반영했습니다.
export function getMonsterBaseStats(tier: number): MonsterStats {
  switch (tier) {
    case 1:
      return { maxHP: 346, attack: 30, defense: 12, baseExp: 10 };
    case 2:
      return { maxHP: 1172, attack: 46, defense: 33, baseExp: 15 };
    case 3:
      return { maxHP: 1545, attack: 118, defense: 61, baseExp: 22 };
    case 4:
      return { maxHP: 1973, attack: 178, defense: 80, baseExp: 33 };
    case 5:
      return { maxHP: 2298, attack: 268, defense: 110, baseExp: 49 };
    case 6:
      return { maxHP: 2645, attack: 364, defense: 140, baseExp: 73 };
    case 7:
      return { maxHP: 2907, attack: 486, defense: 177, baseExp: 109 };
    default:
      // 정의되지 않은 티어는 1T 기준으로 처리
      return { maxHP: 346, attack: 30, defense: 12, baseExp: 10 };
  }
}

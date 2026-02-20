// 캐릭터 레벨업에 필요한 경험치 공식
// E_L = floor(100 * 1.05^(L-2))

/**
 * 주어진 레벨 L에서 다음 레벨로 올라가기 위해 필요한 경험치량을 계산합니다.
 * L = 2 일 때 100, 이후 레벨마다 5%씩 증가합니다.
 */
export function getExpForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  const exponent = level - 2;
  const raw = 100 * Math.pow(1.05, exponent);
  return Math.floor(raw);
}

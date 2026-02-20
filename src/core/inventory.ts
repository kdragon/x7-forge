import type { Item, ConsumedItems } from '../shared/types';

// 인벤토리(특히 철광석) 관련 순수 로직 모음

// 인벤토리에서 특정 티어 철광석 개수 계산
export function getOreCount(inventory: Item[], tier: number): number {
  const oreName = `${tier}T 철광석`;
  const ores = inventory.filter((item) => item.name === oreName);
  return ores.reduce((sum, ore) => sum + (ore.stackCount || 0), 0);
}

// 철광석을 인벤토리에 추가 (스택 합치기 & 새 슬롯 생성)
// 반환: 업데이트된 인벤토리, 실제 추가된 수량, 인벤토리 초과로 추가하지 못한 수량
export function addOreToInventory(
  inventory: Item[],
  tier: number,
  amount: number,
  maxSlots: number = 300,
): { inventory: Item[]; added: number; overflow: number } {
  const oreName = `${tier}T 철광석`;

  // 기존 배열을 복사해서 불변성 유지
  const updated: Item[] = inventory.map((item) => ({ ...item }));
  let remaining = amount;

  // 1) 기존 스택에 채워 넣기 (최대 100개/스택)
  for (let i = 0; i < updated.length && remaining > 0; i++) {
    const item = updated[i];
    if (item.name === oreName && (item.stackCount || 0) < 100) {
      const cur = item.stackCount || 0;
      const canAdd = Math.min(100 - cur, remaining);
      updated[i] = { ...item, stackCount: cur + canAdd };
      remaining -= canAdd;
    }
  }

  // 2) 남은 수량을 새 슬롯에 나눠 담기 (최대 maxSlots까지)
  let loopCount = 0;
  while (remaining > 0 && updated.length < maxSlots && loopCount < 1000) {
    loopCount++;
    const stackAmount = Math.min(remaining, 100);
    updated.push({
      id: Date.now() + Math.random() * 1000000 + loopCount,
      name: oreName,
      tier,
      grade: '일반',
      attack: 0,
      bonusAttack: 0,
      skill: 'R',
      slots: 0,
      enhance: 0,
      stackCount: stackAmount,
      isStackable: true,
    });
    remaining -= stackAmount;
  }

  const added = amount - remaining;
  const overflow = remaining; // 인벤토리 초과 등으로 추가하지 못한 수량

  return { inventory: updated, added, overflow };
}

// 철광석 소비 + 소모 통계 갱신
// 충분한 수량이 없으면 success=false와 함께 원본 상태를 그대로 반환
export function consumeOre(
  inventory: Item[],
  consumedItems: ConsumedItems,
  tier: number,
  amount: number,
): { success: boolean; inventory: Item[]; consumedItems: ConsumedItems } {
  const oreName = `${tier}T 철광석`;

  // 총 보유 수량 확인
  const totalOres = getOreCount(inventory, tier);
  if (totalOres < amount) {
    return { success: false, inventory, consumedItems };
  }

  // 소모 통계 갱신
  const oreKey = `${tier}T철`;
  const updatedConsumed: ConsumedItems = { ...consumedItems };
  updatedConsumed[oreKey] = (updatedConsumed[oreKey] || 0) + amount;

  // 인벤토리에서 실제 철광석 차감
  let remainingToConsume = amount;
  const updatedInventory: Item[] = [];

  for (const item of inventory) {
    if (item.name === oreName && remainingToConsume > 0) {
      const currentCount = item.stackCount || 0;

      if (currentCount <= remainingToConsume) {
        // 이 스택 전체를 소비 (인벤토리에 추가하지 않음)
        remainingToConsume -= currentCount;
      } else {
        // 일부만 소비하고 나머지는 남김
        updatedInventory.push({ ...item, stackCount: currentCount - remainingToConsume });
        remainingToConsume = 0;
      }
    } else {
      updatedInventory.push(item);
    }
  }

  return {
    success: true,
    inventory: updatedInventory,
    consumedItems: updatedConsumed,
  };
}

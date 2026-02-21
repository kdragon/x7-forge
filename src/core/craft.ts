import type { Item } from '../shared/types';
import { calculateAttack, rollBonusAttack } from '../config/itemRules';

export const getLootCount = (inventory: Item[], tier: number): number => {
  const lootName = `${tier}T 전리품`;
  return inventory
    .filter((item) => item.name === lootName)
    .reduce((sum, item) => sum + (item.stackCount || 0), 0);
};

export const consumeLoot = (
  inventory: Item[],
  tier: number,
  amount: number,
): { success: boolean; inventory: Item[] } => {
  const lootName = `${tier}T 전리품`;
  let remaining = amount;
  const updatedInventory: Item[] = [];

  for (const item of inventory) {
    if (item.name === lootName && remaining > 0) {
      const currentCount = item.stackCount || 0;
      if (currentCount <= remaining) {
        remaining -= currentCount;
      } else {
        updatedInventory.push({ ...item, stackCount: currentCount - remaining });
        remaining = 0;
      }
    } else {
      updatedInventory.push(item);
    }
  }

  return { success: remaining === 0, inventory: remaining === 0 ? updatedInventory : inventory };
};

export const getCoreCount = (inventory: Item[], tier: number): number => {
  const coreName = `${tier}T 코어`;
  return inventory
    .filter((item) => item.name === coreName)
    .reduce((sum, item) => sum + (item.stackCount || 0), 0);
};

export const consumeCore = (
  inventory: Item[],
  tier: number,
  amount: number,
): { success: boolean; inventory: Item[] } => {
  const coreName = `${tier}T 코어`;
  let remaining = amount;
  const updatedInventory: Item[] = [];

  for (const item of inventory) {
    if (item.name === coreName && remaining > 0) {
      const currentCount = item.stackCount || 0;
      if (currentCount <= remaining) {
        remaining -= currentCount;
      } else {
        updatedInventory.push({ ...item, stackCount: currentCount - remaining });
        remaining = 0;
      }
    } else {
      updatedInventory.push(item);
    }
  }

  return { success: remaining === 0, inventory: remaining === 0 ? updatedInventory : inventory };
};

export const createCraftedFieldItem = (tier: number, grade: Item['grade'], isSR: boolean): Item => {
  return {
    id: Date.now(),
    name: `${tier}T 필드 무기`,
    tier,
    grade,
    attack: calculateAttack(tier, grade, 0),
    bonusAttack: rollBonusAttack(tier),
    skill: isSR ? 'SR' : 'R',
    slots: 0,
    enhance: 0,
    itemType: 'weapon',
    itemSource: 'craft',
  };
};

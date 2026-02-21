import type { ConsumedItems, EcoMode, Item } from '../shared/types';
import { calculateAttack, calculateSlots } from '../config/itemRules';
import { getProtectionCountForFailRate } from '../config/enhanceRules';
import { getDisassembleStones } from './enhance';

export type UpgradeStones = { low: number; mid: number; high: number };

export interface EnhanceParams {
  inventory: Item[];
  selectedItem: Item;
  consumedItems: ConsumedItems;
  upgradeStones: UpgradeStones;
  ecoMode: EcoMode;
  enhanceRates: number[];
  useProtection: boolean;
}

export interface EnhanceResult {
  inventory: Item[];
  selectedItem: Item | null;
  consumedItems: ConsumedItems;
  upgradeStones: UpgradeStones;
  usedProtectionDelta: number;
  log: string;
  isSuccess: boolean;
  destroyed: boolean;
}

const getConsumeKey = (item: Item): keyof ConsumedItems | null => {
  const key = item.itemSource === 'craft' ? `${item.tier}T제작` : `${item.tier}T드랍`;
  return key as keyof ConsumedItems;
};

const bumpConsumed = (consumedItems: ConsumedItems, item: Item): ConsumedItems => {
  const key = getConsumeKey(item);
  if (!key || !(key in consumedItems)) return consumedItems;
  return { ...consumedItems, [key]: consumedItems[key] + 1 };
};

export const enhanceItem = (params: EnhanceParams): EnhanceResult => {
  const {
    inventory,
    selectedItem,
    consumedItems,
    upgradeStones,
    ecoMode,
    enhanceRates,
    useProtection,
  } = params;

  const currentEnhance = selectedItem.enhance;
  const successRate = enhanceRates[currentEnhance] ?? 0;
  const isSuccess = Math.random() * 100 < successRate;

  if (ecoMode === 'BM') {
    const protectionCount = useProtection
      ? getProtectionCountForFailRate(selectedItem.tier, successRate)
      : 0;

    if (isSuccess) {
      const newEnhance = currentEnhance + 1;
      const updatedInventory = inventory.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              enhance: newEnhance,
              attack: calculateAttack(item.tier, item.grade, newEnhance),
              slots: calculateSlots(newEnhance),
              usedProtectionCount: (item.usedProtectionCount || 0) + protectionCount,
            }
          : item,
      );
      const updatedSelected: Item = {
        ...selectedItem,
        enhance: newEnhance,
        attack: calculateAttack(selectedItem.tier, selectedItem.grade, newEnhance),
        slots: calculateSlots(newEnhance),
        usedProtectionCount: (selectedItem.usedProtectionCount || 0) + protectionCount,
      };
      return {
        inventory: updatedInventory,
        selectedItem: updatedSelected,
        consumedItems,
        upgradeStones,
        usedProtectionDelta: protectionCount,
        log: `[강화 성공] ${selectedItem.name} +${newEnhance}강 달성!`,
        isSuccess: true,
        destroyed: false,
      };
    }

    if (useProtection) {
      const updatedInventory = inventory.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              usedProtectionCount: (item.usedProtectionCount || 0) + protectionCount,
            }
          : item,
      );
      const updatedSelected: Item = {
        ...selectedItem,
        usedProtectionCount: (selectedItem.usedProtectionCount || 0) + protectionCount,
      };
      return {
        inventory: updatedInventory,
        selectedItem: updatedSelected,
        consumedItems,
        upgradeStones,
        usedProtectionDelta: protectionCount,
        log: `[강화 실패] ${selectedItem.name} +${currentEnhance}강 유지 (보호제 사용)`,
        isSuccess: false,
        destroyed: false,
      };
    }

    const updatedInventory = inventory.filter((item) => item.id !== selectedItem.id);
    const updatedConsumed = bumpConsumed(consumedItems, selectedItem);
    return {
      inventory: updatedInventory,
      selectedItem: null,
      consumedItems: updatedConsumed,
      upgradeStones,
      usedProtectionDelta: 0,
      log: `[강화 실패] ${selectedItem.name} +${currentEnhance}강 파괴됨!`,
      isSuccess: false,
      destroyed: true,
    };
  }

  if (isSuccess) {
    const newEnhance = currentEnhance + 1;
    const updatedInventory = inventory.map((item) =>
      item.id === selectedItem.id
        ? {
            ...item,
            enhance: newEnhance,
            attack: calculateAttack(item.tier, item.grade, newEnhance),
            slots: calculateSlots(newEnhance),
          }
        : item,
    );
    const updatedSelected: Item = {
      ...selectedItem,
      enhance: newEnhance,
      attack: calculateAttack(selectedItem.tier, selectedItem.grade, newEnhance),
      slots: calculateSlots(newEnhance),
    };
    return {
      inventory: updatedInventory,
      selectedItem: updatedSelected,
      consumedItems,
      upgradeStones,
      usedProtectionDelta: 0,
      log: `[강화 성공] ${selectedItem.name} +${newEnhance}강 달성!`,
      isSuccess: true,
      destroyed: false,
    };
  }

  const stones = getDisassembleStones(selectedItem.tier, selectedItem.grade);
  const updatedInventory = inventory.filter((item) => item.id !== selectedItem.id);
  const updatedConsumed = bumpConsumed(consumedItems, selectedItem);
  const updatedStones = {
    ...upgradeStones,
    [stones.type]: upgradeStones[stones.type] + stones.amount,
  };
  return {
    inventory: updatedInventory,
    selectedItem: null,
    consumedItems: updatedConsumed,
    upgradeStones: updatedStones,
    usedProtectionDelta: 0,
    log: `[강화 실패] ${selectedItem.name} +${currentEnhance}강 파괴됨! ${stones.label} 획득`,
    isSuccess: false,
    destroyed: true,
  };
};

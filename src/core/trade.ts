import type { Item } from '../shared/types';
import { gradeIndex } from './enhance';

export type TradeMode = 'inland' | 'sea';

export const getInlandTradeValue = (item: Item): number => {
  if (item.isStackable || item.tier !== 3 || gradeIndex(item.grade) < gradeIndex('희귀')) return 0;
  return item.enhance >= 3 ? 2 : 1;
};

export const getSeaTradeValue = (item: Item): number => {
  if (item.isStackable) return 0;
  if (item.tier === 4 && gradeIndex(item.grade) >= gradeIndex('희귀')) {
    return item.enhance >= 3 ? 2 : 1;
  }
  if (item.tier === 5 && gradeIndex(item.grade) >= gradeIndex('희귀')) {
    return item.enhance >= 3 ? 5 : 3;
  }
  return 0;
};

export const applyTrade = (
  inventory: Item[],
  item: Item,
  mode: TradeMode,
): { success: boolean; inventory: Item[]; tradeValue: number } => {
  const tradeValue = mode === 'inland' ? getInlandTradeValue(item) : getSeaTradeValue(item);
  if (tradeValue === 0) {
    return { success: false, inventory, tradeValue: 0 };
  }

  const updatedInventory = inventory.filter((i) => i.id !== item.id);
  return { success: true, inventory: updatedInventory, tradeValue };
};

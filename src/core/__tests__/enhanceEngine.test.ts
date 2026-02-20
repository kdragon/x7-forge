import { describe, expect, it, vi } from 'vitest';
import type { ConsumedItems, Item } from '../../shared/types';
import type { UpgradeStones } from '../enhanceEngine';
import { enhanceItem } from '../enhanceEngine';

vi.mock('../enhance', () => ({
  getDisassembleStones: () => ({ type: 'low', amount: 2, label: '하급숯돌 2' }),
}));

const createConsumedItems = (): ConsumedItems => ({
  '1T제작': 0, '1T드랍': 0,
  '2T제작': 0, '2T드랍': 0,
  '3T제작': 0, '3T드랍': 0,
  '4T제작': 0, '4T드랍': 0,
  '5T제작': 0, '5T드랍': 0,
  '6T제작': 0, '6T드랍': 0,
  '7T제작': 0, '7T드랍': 0,
  '1T철': 0, '2T철': 0, '3T철': 0,
  '4T철': 0, '5T철': 0, '6T철': 0, '7T철': 0,
});

const createItem = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  name: '3T 드랍템',
  tier: 3,
  grade: '희귀',
  attack: 100,
  bonusAttack: 5,
  skill: 'R',
  slots: 0,
  enhance: 0,
  ...overrides,
});

const createStones = (overrides: Partial<UpgradeStones> = {}): UpgradeStones => ({
  low: 0,
  mid: 0,
  high: 0,
  ...overrides,
});

describe('enhanceEngine', () => {
  it('BM success with protection increments enhance and protection usage', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const item = createItem({ usedProtectionCount: 1 });
    const result = enhanceItem({
      inventory: [item],
      selectedItem: item,
      consumedItems: createConsumedItems(),
      upgradeStones: createStones(),
      ecoMode: 'BM',
      enhanceRates: [50],
      useProtection: true,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.destroyed).toBe(false);
    expect(result.usedProtectionDelta).toBe(50);
    expect(result.selectedItem?.enhance).toBe(1);
    expect(result.selectedItem?.usedProtectionCount).toBe(51);
    expect(result.inventory[0].enhance).toBe(1);
    expect(result.inventory[0].usedProtectionCount).toBe(51);

    randomSpy.mockRestore();
  });

  it('BM failure with protection keeps item and adds protection usage', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const item = createItem({ usedProtectionCount: 0 });
    const result = enhanceItem({
      inventory: [item],
      selectedItem: item,
      consumedItems: createConsumedItems(),
      upgradeStones: createStones(),
      ecoMode: 'BM',
      enhanceRates: [10],
      useProtection: true,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.destroyed).toBe(false);
    expect(result.usedProtectionDelta).toBe(90);
    expect(result.selectedItem?.enhance).toBe(0);
    expect(result.selectedItem?.usedProtectionCount).toBe(90);
    expect(result.inventory).toHaveLength(1);

    randomSpy.mockRestore();
  });

  it('BM failure without protection destroys item and increments consumed', () => {
    const item = createItem();
    const consumed = createConsumedItems();
    const result = enhanceItem({
      inventory: [item],
      selectedItem: item,
      consumedItems: consumed,
      upgradeStones: createStones(),
      ecoMode: 'BM',
      enhanceRates: [0],
      useProtection: false,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.destroyed).toBe(true);
    expect(result.selectedItem).toBeNull();
    expect(result.inventory).toHaveLength(0);
    expect(result.consumedItems['3T드랍']).toBe(1);
  });

  it('HARDCORE failure destroys item and grants stones', () => {
    const item = createItem();
    const result = enhanceItem({
      inventory: [item],
      selectedItem: item,
      consumedItems: createConsumedItems(),
      upgradeStones: createStones({ low: 1 }),
      ecoMode: 'HARDCORE',
      enhanceRates: [0],
      useProtection: false,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.destroyed).toBe(true);
    expect(result.inventory).toHaveLength(0);
    expect(result.upgradeStones.low).toBe(3);
  });
});

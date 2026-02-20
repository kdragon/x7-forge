import { describe, expect, it } from 'vitest';
import type { Item } from '../../shared/types';
import { applyTrade, getInlandTradeValue, getSeaTradeValue } from '../trade';

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

describe('trade helpers', () => {
  it('calculates inland trade value', () => {
    expect(getInlandTradeValue(createItem({ enhance: 0 }))).toBe(1);
    expect(getInlandTradeValue(createItem({ enhance: 3 }))).toBe(2);
    expect(getInlandTradeValue(createItem({ tier: 2 }))).toBe(0);
  });

  it('calculates sea trade value for 4T/5T', () => {
    const tier4 = createItem({ tier: 4, enhance: 0 });
    const tier5 = createItem({ tier: 5, enhance: 3 });
    expect(getSeaTradeValue(tier4)).toBe(1);
    expect(getSeaTradeValue({ ...tier4, enhance: 3 })).toBe(2);
    expect(getSeaTradeValue(tier5)).toBe(5);
  });

  it('applyTrade removes item on success', () => {
    const item = createItem({ id: 42, enhance: 3 });
    const inventory = [item];
    const result = applyTrade(inventory, item, 'inland');

    expect(result.success).toBe(true);
    expect(result.tradeValue).toBe(2);
    expect(result.inventory).toHaveLength(0);
  });

  it('applyTrade fails for non-tradable item', () => {
    const item = createItem({ tier: 1 });
    const inventory = [item];
    const result = applyTrade(inventory, item, 'inland');

    expect(result.success).toBe(false);
    expect(result.tradeValue).toBe(0);
    expect(result.inventory).toEqual(inventory);
  });
});

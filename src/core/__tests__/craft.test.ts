import { describe, expect, it } from 'vitest';
import type { Item } from '../../shared/types';
import { consumeCore, consumeLoot, createCraftedFieldItem, getCoreCount, getLootCount } from '../craft';

const createStackItem = (name: string, tier: number, stackCount: number, id: number): Item => ({
  id,
  name,
  tier,
  grade: '일반',
  attack: 0,
  bonusAttack: 0,
  skill: 'R',
  slots: 0,
  enhance: 0,
  stackCount,
  isStackable: true,
});

describe('craft helpers', () => {
  it('counts loot and core stacks', () => {
    const inventory = [
      createStackItem('3T 전리품', 3, 5, 1),
      createStackItem('3T 전리품', 3, 7, 2),
      createStackItem('3T 코어', 3, 10, 3),
    ];

    expect(getLootCount(inventory, 3)).toBe(12);
    expect(getCoreCount(inventory, 3)).toBe(10);
  });

  it('consumes loot across stacks', () => {
    const inventory = [
      createStackItem('2T 전리품', 2, 6, 1),
      createStackItem('2T 전리품', 2, 5, 2),
    ];

    const result = consumeLoot(inventory, 2, 8);
    expect(result.success).toBe(true);
    expect(getLootCount(result.inventory, 2)).toBe(3);
  });

  it('returns failure when not enough loot', () => {
    const inventory = [createStackItem('2T 전리품', 2, 4, 1)];
    const result = consumeLoot(inventory, 2, 6);
    expect(result.success).toBe(false);
    expect(result.inventory).toEqual(inventory);
  });

  it('consumes cores across stacks', () => {
    const inventory = [
      createStackItem('4T 코어', 4, 9, 1),
      createStackItem('4T 코어', 4, 5, 2),
    ];

    const result = consumeCore(inventory, 4, 10);
    expect(result.success).toBe(true);
    expect(getCoreCount(result.inventory, 4)).toBe(4);
  });

  it('creates crafted field item shape', () => {
    const item = createCraftedFieldItem(3, '희귀', true);
    expect(item.name).toBe('3T 필드');
    expect(item.tier).toBe(3);
    expect(item.grade).toBe('희귀');
    expect(item.skill).toBe('SR');
  });
});

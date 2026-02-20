import { describe, expect, it } from 'vitest';
import { applyExpGain, getMaxHPForLevel } from '../combatEngine';
import { getExpForLevel } from '../character';

describe('combatEngine', () => {
  it('returns correct max HP for level', () => {
    expect(getMaxHPForLevel(1)).toBe(1500);
    expect(getMaxHPForLevel(2)).toBe(1600);
    expect(getMaxHPForLevel(5)).toBe(1900);
  });

  it('applies exp without level up', () => {
    const result = applyExpGain(1, 0, 10);
    expect(result.level).toBe(1);
    expect(result.exp).toBe(10);
    expect(result.requiredExp).toBe(getExpForLevel(2));
    expect(result.leveledUp).toBe(false);
  });

  it('levels up and carries remaining exp', () => {
    const result = applyExpGain(1, 995, 10);
    expect(result.level).toBe(2);
    expect(result.exp).toBe(5);
    expect(result.requiredExp).toBe(getExpForLevel(3));
    expect(result.leveledUp).toBe(true);
    expect(result.newMaxHP).toBe(getMaxHPForLevel(2));
  });
});

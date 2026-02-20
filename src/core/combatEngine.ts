import { getExpForLevel } from './character';

export const getMaxHPForLevel = (level: number): number => 1500 + (level - 1) * 100;

export interface ExpProgressResult {
  level: number;
  exp: number;
  requiredExp: number;
  leveledUp: boolean;
  newMaxHP: number;
}

export const applyExpGain = (level: number, exp: number, gainExp: number): ExpProgressResult => {
  let nextLevel = level;
  let nextExp = exp + gainExp;
  let required = getExpForLevel(nextLevel + 1);
  let leveledUp = false;

  while (nextExp >= required) {
    nextExp -= required;
    nextLevel += 1;
    required = getExpForLevel(nextLevel + 1);
    leveledUp = true;
  }

  return {
    level: nextLevel,
    exp: nextExp,
    requiredExp: required,
    leveledUp,
    newMaxHP: getMaxHPForLevel(nextLevel),
  };
};

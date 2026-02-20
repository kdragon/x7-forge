import type { GameState } from './gameTypes';

const SAVE_VERSION = 1;
const SAVE_KEY = 'x7-forge-save-v1';

interface SavedGameV1 {
  version: 1;
  data: Partial<GameState>;
}

const coerceSavedData = (data: unknown): Partial<GameState> => {
  if (!data || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  const partial: Partial<GameState> = {};

  if (Array.isArray(record.inventory)) partial.inventory = record.inventory as GameState['inventory'];
  if (typeof record.characterLevel === 'number') partial.characterLevel = record.characterLevel;
  if (typeof record.characterExp === 'number') partial.characterExp = record.characterExp;
  if (typeof record.characterMaxHP === 'number') partial.characterMaxHP = record.characterMaxHP;
  if (typeof record.characterHP === 'number') partial.characterHP = record.characterHP;
  if (typeof record.characterBaseAttack === 'number') partial.characterBaseAttack = record.characterBaseAttack;
  if (record.upgradeStones && typeof record.upgradeStones === 'object') {
    partial.upgradeStones = record.upgradeStones as GameState['upgradeStones'];
  }
  if (typeof record.polishStones === 'number') partial.polishStones = record.polishStones;
  if (typeof record.inlandTradeCoins === 'number') partial.inlandTradeCoins = record.inlandTradeCoins;
  if (typeof record.seaTradeCoins === 'number') partial.seaTradeCoins = record.seaTradeCoins;
  if (record.consumedItems && typeof record.consumedItems === 'object') {
    partial.consumedItems = record.consumedItems as GameState['consumedItems'];
  }
  if (typeof record.equippedItemId === 'number' || record.equippedItemId === null) {
    partial.equippedItemId = record.equippedItemId as GameState['equippedItemId'];
  }
  if (typeof record.killCount === 'number') partial.killCount = record.killCount;

  return partial;
};

const migrate = (payload: unknown): Partial<GameState> | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;

  if (record.version === 1 && record.data && typeof record.data === 'object') {
    return coerceSavedData(record.data);
  }

  // Legacy shape: raw data object without version.
  return coerceSavedData(record);
};

export const loadGame = (): Partial<GameState> | null => {
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as unknown;
    return migrate(parsed);
  } catch (error) {
    console.error('데이터 불러오기 실패:', error);
    return null;
  }
};

export const saveGame = (state: GameState): void => {
  const data: Partial<GameState> = {
    inventory: state.inventory,
    characterLevel: state.characterLevel,
    characterExp: state.characterExp,
    characterMaxHP: state.characterMaxHP,
    characterHP: state.characterHP,
    characterBaseAttack: state.characterBaseAttack,
    upgradeStones: state.upgradeStones,
    polishStones: state.polishStones,
    inlandTradeCoins: state.inlandTradeCoins,
    seaTradeCoins: state.seaTradeCoins,
    consumedItems: state.consumedItems,
    equippedItemId: state.equippedItemId,
    killCount: state.killCount,
  };
  const payload: SavedGameV1 = { version: SAVE_VERSION, data };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
};

export const clearGame = (): void => {
  localStorage.removeItem(SAVE_KEY);
};

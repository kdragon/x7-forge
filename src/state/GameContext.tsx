import { createContext, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { GameState } from './gameTypes';
import { gameReducer } from './gameReducer';
import { DEFAULT_CRAFT_RATES, DEFAULT_DROP_RATES, DEFAULT_LOOT_DROP_RATE } from '../config/gameDefaults';
import { DEFAULT_ENHANCE_RATES, DEFAULT_PROTECTION_PRICE } from '../config/enhanceRules';

const createInitialState = (): GameState => ({
  inventory: [],
  log: [],
  selectedItem: null,
  isUpgradeMode: false,
  isEnhanceMode: false,
  isTradeMode: null,
  inlandTradeCoins: 0,
  seaTradeCoins: 0,
  draggedItem: null,
  deleteConfirmItem: null,

  characterLevel: 1,
  characterExp: 0,
  characterMaxHP: 1500,
  characterHP: 1500,
  characterBaseAttack: 60,
  equippedItemId: null,

  monsterMaxHP: 346,
  monsterHP: 346,
  monsterAttack: 30,
  monsterDefense: 12,

  ecoMode: 'HARDCORE',
  upgradeStones: { low: 0, mid: 0, high: 0 },
  polishStones: 0,
  dropRates: DEFAULT_DROP_RATES,
  craftRates: DEFAULT_CRAFT_RATES,
  enhanceRates: DEFAULT_ENHANCE_RATES,
  protectionPrice: DEFAULT_PROTECTION_PRICE,
  usedProtectionCount: 0,
  lootDropRate: DEFAULT_LOOT_DROP_RATE,
  consumedItems: {
    '1T제작': 0, '1T드랍': 0,
    '2T제작': 0, '2T드랍': 0,
    '3T제작': 0, '3T드랍': 0,
    '4T제작': 0, '4T드랍': 0,
    '5T제작': 0, '5T드랍': 0,
    '6T제작': 0, '6T드랍': 0,
    '7T제작': 0, '7T드랍': 0,
    '1T철': 0, '2T철': 0, '3T철': 0,
    '4T철': 0, '5T철': 0, '6T철': 0, '7T철': 0,
  },

  huntingTier: null,
  selectedHuntingTier: 1,
  battlePhase: 'idle',
  killCount: 0,
  spawnedOres: [],
  damageEvents: [],
  dropEffects: [],
  potionCooldownLeftMs: 0,

  isDisassembleMode: false,
  isDropCheatOpen: false,
  disassembleSelection: [],
  disassembleResult: null,
});

type GameContextValue = {
  state: GameState;
  dispatch: React.Dispatch<import('./gameTypes').GameAction>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = (): GameContextValue => {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameContext must be used within GameProvider');
  }
  return ctx;
};

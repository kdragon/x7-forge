import type { Item, EcoMode, SpawnedOre, ConsumedItems } from '../shared/types';
import type { BattlePhase } from '../core/combat';

export interface DamageEvent {
  id: number;
  amount: number;
  left: string;
}

export interface DropEffect {
  id: number;
  grade: Item['grade'];
}

export interface SkillEffect {
  id: number;
  kind?: 'R' | 'SR';
  offset?: number;
}

export interface DisassembleResult {
  items: Item[];
  stones: { low: number; mid: number; high: number };
}

export interface GameState {
  inventory: Item[];
  log: string[];
  selectedItem: Item | null;
  isUpgradeMode: boolean;
  isEnhanceMode: boolean;
  isTradeMode: 'inland' | 'sea' | null;
  inlandTradeCoins: number;
  seaTradeCoins: number;
  draggedItem: Item | null;
  deleteConfirmItem: Item | null;

  characterLevel: number;
  characterExp: number;
  characterMaxHP: number;
  characterHP: number;
  characterBaseAttack: number;
  equippedItemId: number | null;

  monsterMaxHP: number;
  monsterHP: number;
  monsterAttack: number;
  monsterDefense: number;

  ecoMode: EcoMode;
  upgradeStones: { low: number; mid: number; high: number };
  polishStones: number;
  dropRates: { high: number; rare: number; hero: number; sr: number };
  craftRates: { high: number; rare: number; hero: number; sr: number };
  enhanceRates: number[];
  protectionPrice: number;
  usedProtectionCount: number;
  lootDropRate: number;
  consumedItems: ConsumedItems;

  huntingTier: number | null;
  selectedHuntingTier: number;
  battlePhase: BattlePhase;
  killCount: number;
  spawnedOres: SpawnedOre[];
  damageEvents: DamageEvent[];
  characterDamageEvents: DamageEvent[];
  healEvents: DamageEvent[];
  dropEffects: DropEffect[];
  skillEffects: SkillEffect[];
  potionCooldownLeftMs: number;
  skillCooldownLeftMs: number;

  isDisassembleMode: boolean;
  isDropCheatOpen: boolean;
  disassembleSelection: Item[];
  disassembleResult: DisassembleResult | null;
}

export type GameAction =
  | { type: 'SET_STATE'; payload: Partial<GameState> }
  | { type: 'ADD_LOG'; payload: string };

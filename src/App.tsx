import { useEffect, useRef, useState } from 'react';
import { simulateAllTiers } from './enhanceSimulation';
import type { Item, EcoMode } from './shared/types';
import { getOreCount as getOreCountCore, addOreToInventory as addOreToInventoryCore, consumeOre as consumeOreCore } from './core/inventory';
import { getDisassembleStones, getUpgradeCost, getNextGrade } from './core/enhance';
import { getMonsterBaseStats, HUNTING_DROP_RATE, calculateDamage, type BattlePhase } from './core/combat';
import { applyExpGain } from './core/combatEngine';
import { DEFAULT_POTION_CONFIG } from './core/potion';
import { enhanceItem } from './core/enhanceEngine';
import { createCraftedFieldItem, consumeCore, consumeLoot, getCoreCount, getLootCount } from './core/craft';
import { applyTrade, getInlandTradeValue, getSeaTradeValue } from './core/trade';
import {
  GRADE_ORDER,
  calculateAttack,
  determineGrade,
  getMaxGradeForTier,
  rollBonusAttack,
} from './config/itemRules';
import InventoryPanel from './ui/inventory/InventoryPanel';
import EnhancePanel from './ui/enhance/EnhancePanel';
import CombatPanel from './ui/combat/CombatPanel';
import type { GameState } from './state/gameTypes';
import { useGameActions } from './state/useGameActions';
import { useGameState } from './state/useGameState';
import { clearGame, loadGame, saveGame } from './state/persistence';
import { formatBonusAttack, getGradeColor } from './ui/shared/itemUi';
import { actionBtn, btnStyle, infoText, itemCard, logPanel } from './ui/shared/styles';

export default function App() {
  const state = useGameState();
  const { setState, addLog } = useGameActions();
  const [isRateConfigOpen, setIsRateConfigOpen] = useState(false);
  const {
    inventory,
    log,
    selectedItem,
    isUpgradeMode,
    isTradeMode,
    inlandTradeCoins,
    seaTradeCoins,
    draggedItem,
    deleteConfirmItem,
    characterLevel,
    characterExp,
    characterMaxHP,
    characterHP,
    characterBaseAttack,
    equippedItemId,
    monsterHP,
    monsterAttack,
    monsterDefense,
    ecoMode,
    upgradeStones,
    polishStones,
    dropRates,
    craftRates,
    enhanceRates,
    protectionPrice,
    usedProtectionCount,
    lootDropRate,
    consumedItems,
    huntingTier,
    selectedHuntingTier,
    killCount,
    spawnedOres,
    isDisassembleMode,
    isDropCheatOpen,
    disassembleSelection,
    disassembleResult,
  } = state;

  const setField = <K extends keyof GameState>(
    key: K,
    value: GameState[K] | ((prev: GameState[K]) => GameState[K]),
  ) => {
    setState((prev) => ({
      [key]: typeof value === 'function'
        ? (value as (prevValue: GameState[K]) => GameState[K])(prev[key])
        : value,
    } as Partial<GameState>));
  };

  const setInventory = (value: Item[] | ((prev: Item[]) => Item[])) => setField('inventory', value);
  const setSelectedItem = (value: Item | null | ((prev: Item | null) => Item | null)) => setField('selectedItem', value);
  const setIsUpgradeMode = (value: boolean | ((prev: boolean) => boolean)) => setField('isUpgradeMode', value);
  const setIsEnhanceMode = (value: boolean | ((prev: boolean) => boolean)) => setField('isEnhanceMode', value);
  const setIsTradeMode = (value: 'inland' | 'sea' | null | ((prev: 'inland' | 'sea' | null) => 'inland' | 'sea' | null)) => setField('isTradeMode', value);
  const setInlandTradeCoins = (value: number | ((prev: number) => number)) => setField('inlandTradeCoins', value);
  const setSeaTradeCoins = (value: number | ((prev: number) => number)) => setField('seaTradeCoins', value);
  const setDraggedItem = (value: Item | null | ((prev: Item | null) => Item | null)) => setField('draggedItem', value);
  const setDeleteConfirmItem = (value: Item | null | ((prev: Item | null) => Item | null)) => setField('deleteConfirmItem', value);
  const setCharacterLevel = (value: number | ((prev: number) => number)) => setField('characterLevel', value);
  const setCharacterExp = (value: number | ((prev: number) => number)) => setField('characterExp', value);
  const setCharacterMaxHP = (value: number | ((prev: number) => number)) => setField('characterMaxHP', value);
  const setCharacterHP = (value: number | ((prev: number) => number)) => setField('characterHP', value);
  const setCharacterBaseAttack = (value: number | ((prev: number) => number)) => setField('characterBaseAttack', value);
  const setEquippedItemId = (value: number | null | ((prev: number | null) => number | null)) => setField('equippedItemId', value);
  const setMonsterMaxHP = (value: number | ((prev: number) => number)) => setField('monsterMaxHP', value);
  const setMonsterHP = (value: number | ((prev: number) => number)) => setField('monsterHP', value);
  const setMonsterAttack = (value: number | ((prev: number) => number)) => setField('monsterAttack', value);
  const setMonsterDefense = (value: number | ((prev: number) => number)) => setField('monsterDefense', value);
  const setEcoMode = (value: EcoMode | ((prev: EcoMode) => EcoMode)) => setField('ecoMode', value);
  const setUpgradeStones = (value: { low: number; mid: number; high: number } | ((prev: { low: number; mid: number; high: number }) => { low: number; mid: number; high: number })) => setField('upgradeStones', value);
  const setPolishStones = (value: number | ((prev: number) => number)) => setField('polishStones', value);
  const setDropRates = (value: { high: number; rare: number; hero: number; sr: number } | ((prev: { high: number; rare: number; hero: number; sr: number }) => { high: number; rare: number; hero: number; sr: number })) => setField('dropRates', value);
  const setCraftRates = (value: { high: number; rare: number; hero: number; sr: number } | ((prev: { high: number; rare: number; hero: number; sr: number }) => { high: number; rare: number; hero: number; sr: number })) => setField('craftRates', value);
  const setEnhanceRates = (value: number[] | ((prev: number[]) => number[])) => setField('enhanceRates', value);
  const setProtectionPrice = (value: number | ((prev: number) => number)) => setField('protectionPrice', value);
  const setUsedProtectionCount = (value: number | ((prev: number) => number)) => setField('usedProtectionCount', value);
  const setLootDropRate = (value: number | ((prev: number) => number)) => setField('lootDropRate', value);
  const setConsumedItems = (value: GameState['consumedItems'] | ((prev: GameState['consumedItems']) => GameState['consumedItems'])) => setField('consumedItems', value);
  const setHuntingTier = (value: number | null | ((prev: number | null) => number | null)) => setField('huntingTier', value);
  const setSelectedHuntingTier = (value: number | ((prev: number) => number)) => setField('selectedHuntingTier', value);
  const setBattlePhase = (value: BattlePhase | ((prev: BattlePhase) => BattlePhase)) => setField('battlePhase', value);
  const setKillCount = (value: number | ((prev: number) => number)) => setField('killCount', value);
  const setSpawnedOres = (value: GameState['spawnedOres'] | ((prev: GameState['spawnedOres']) => GameState['spawnedOres'])) => setField('spawnedOres', value);
  const setDamageEvents = (value: GameState['damageEvents'] | ((prev: GameState['damageEvents']) => GameState['damageEvents'])) => setField('damageEvents', value);
  const setCharacterDamageEvents = (value: GameState['characterDamageEvents'] | ((prev: GameState['characterDamageEvents']) => GameState['characterDamageEvents'])) => setField('characterDamageEvents', value);
  const setHealEvents = (value: GameState['healEvents'] | ((prev: GameState['healEvents']) => GameState['healEvents'])) => setField('healEvents', value);
  const setDropEffects = (value: GameState['dropEffects'] | ((prev: GameState['dropEffects']) => GameState['dropEffects'])) => setField('dropEffects', value);
  const setSkillEffects = (value: GameState['skillEffects'] | ((prev: GameState['skillEffects']) => GameState['skillEffects'])) => setField('skillEffects', value);
  const setPotionCooldownLeftMs = (value: number | ((prev: number) => number)) => setField('potionCooldownLeftMs', value);
  const setSkillCooldownLeftMs = (value: number | ((prev: number) => number)) => setField('skillCooldownLeftMs', value);
  const setIsDisassembleMode = (value: boolean | ((prev: boolean) => boolean)) => setField('isDisassembleMode', value);
  const setIsDropCheatOpen = (value: boolean | ((prev: boolean) => boolean)) => setField('isDropCheatOpen', value);
  const setDisassembleSelection = (value: Item[] | ((prev: Item[]) => Item[])) => setField('disassembleSelection', value);
  const setDisassembleResult = (value: GameState['disassembleResult'] | ((prev: GameState['disassembleResult']) => GameState['disassembleResult'])) => setField('disassembleResult', value);

  const renderLogMessage = (message: string) => {
    const healMatch = message.match(/\+\d+\s?회복/);
    if (!healMatch || healMatch.index === undefined) {
      return message;
    }
    const start = healMatch.index;
    const end = start + healMatch[0].length;
    return (
      <>
        {message.slice(0, start)}
        <span style={{ color: '#6ee7b7', fontWeight: 'bold' }}>{healMatch[0]}</span>
        {message.slice(end)}
      </>
    );
  };

  const oreSpawnTimeoutRef = useRef<number | null>(null);
  const potionCooldownRef = useRef<number>(0); // ms 타임스탬프
  const characterHPRef = useRef<number>(1500); // 포션 체크용 HP 레퍼런스
  const monsterHPRef = useRef<number>(0);
  const skillCooldownRef = useRef<number>(0);
  const lastMonsterSpawnRef = useRef<number>(0);

  const equippedItemForSkill = equippedItemId !== null
    ? inventory.find(item => item.id === equippedItemId)
    : null;
  const equippedSkill = equippedItemForSkill && !equippedItemForSkill.isStackable
    ? equippedItemForSkill.skill
    : null;

  // 데이터 로드
  useEffect(() => {
    const restored = loadGame();
    if (restored) {
      setState(restored);
      console.log('데이터 불러오기 완료');
    }
  }, []);

  // 데이터 저장 (자동 저장)
  useEffect(() => {
    saveGame(state);
  }, [
    inventory, characterLevel, characterExp, characterMaxHP, characterHP,
    characterBaseAttack, upgradeStones, polishStones, inlandTradeCoins,
    seaTradeCoins, consumedItems, equippedItemId, killCount
  ]);

  // 세션 리셋 핸들러
  const handleResetSession = () => {
    if (window.confirm('정말로 모든 진행 상황(캐릭터, 인벤토리, 재화 등)을 초기화하시겠습니까?')) {
      clearGame();
      window.location.reload();
    }
  };

  const triggerDropEffect = (grade: Item['grade']) => {
    const id = Date.now() + Math.random();
    setDropEffects(prev => [...prev, { id, grade }]);
    window.setTimeout(() => {
      setDropEffects(prev => prev.filter(effect => effect.id !== id));
    }, 1000);
  };

  const triggerSkillEffect = (kind: 'R' | 'SR') => {
    const isSr = kind === 'SR';
    const offsets = isSr ? [-18, -9, 0, 9, 18] : [0];
    const durationMs = isSr ? 600 : 900;
    const created = offsets.map((offset) => ({
      id: Date.now() + Math.random(),
      kind,
      offset,
    }));
    setSkillEffects(prev => [...prev, ...created]);
    created.forEach((effect) => {
      window.setTimeout(() => {
        setSkillEffects(prev => prev.filter(item => item.id !== effect.id));
      }, durationMs);
    });
  };

  const pushCharacterDamage = (amount: number) => {
    const eventId = Date.now() + Math.random();
    setCharacterDamageEvents(prevEvents => [...prevEvents, { id: eventId, amount, left: '50%' }]);
    window.setTimeout(() => {
      setCharacterDamageEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
    }, 800);
  };

  const pushHealEvent = (amount: number) => {
    const eventId = Date.now() + Math.random();
    setHealEvents(prevEvents => [...prevEvents, { id: eventId, amount, left: '50%' }]);
    window.setTimeout(() => {
      setHealEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
    }, 800);
  };

  const handleMonsterKilled = (tier: number) => {
    setKillCount(prev => prev + 1);

    const missingHp = Math.max(0, characterMaxHP - characterHPRef.current);
    const healAmount = Math.min(monsterAttack + monsterDefense, missingHp);
    if (healAmount > 0) {
      pushHealEvent(healAmount);
      setCharacterHP(prev => Math.min(characterMaxHP, prev + healAmount));
      addLog(`[회복] 몬스터 처치 (ATK+DEF · +${healAmount} 회복)`);
    }

    const { baseExp } = getMonsterBaseStats(tier);

    // --- 전리품 드랍: 몬스터 처치 시 확률 드랍 (스택) ---
    setInventory(prev => {
      if (tier === 1) {
        return prev;
      }
      if (Math.random() < (lootDropRate / 100)) {
        const lootTier = tier;
        const lootName = `${lootTier}T 전리품`;
        const updated = prev.map(item => ({ ...item }));
        let added = false;
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].name === lootName && (updated[i].stackCount || 0) < 100) {
            updated[i].stackCount = (updated[i].stackCount || 0) + 1;
            added = true;
            break;
          }
        }
        if (!added) {
          updated.push({
            id: Date.now() + Math.random(),
            name: lootName,
            tier: lootTier,
            grade: '일반',
            attack: 0,
            bonusAttack: 0,
            skill: 'R',
            slots: 0,
            enhance: 0,
            stackCount: 1,
            isStackable: true
          });
        }
        addLog(`[사냥] ${tier}T 몬스터 처치! (${lootTier}T 전리품 1개 획득)`);
        return updated;
      }
      return prev;
    });

    setCharacterExp(prevExp => {
      const result = applyExpGain(characterLevel, prevExp, baseExp);

      if (result.leveledUp) {
        setCharacterLevel(result.level);
        setCharacterMaxHP(result.newMaxHP);
        setCharacterHP(result.newMaxHP);
        addLog(`[레벨업] Lv.${result.level} 달성! (HP ${result.newMaxHP})`);
      } else {
        addLog(`[EXP] +${baseExp} (현재 ${result.exp}/${result.requiredExp})`);
      }

      return result.exp;
    });
  };

  // 몬스터 리스폰 및 전투 사이클 (사냥터 시작/변경 시 초기화)
  useEffect(() => {
    if (!huntingTier) return;
    const { maxHP, attack, defense } = getMonsterBaseStats(huntingTier);
    setMonsterMaxHP(maxHP);
    setMonsterHP(maxHP);
    setMonsterAttack(attack);
    setMonsterDefense(defense);
    lastMonsterSpawnRef.current = Date.now();
    // 추후 티어별 분기 가능
    window.setTimeout(() => setMonsterHP(maxHP), 0);
  }, [huntingTier]);

  // 0.5초마다 캐릭터 → 몬스터 공격 (방어도 적용)
  useEffect(() => {
    if (!huntingTier) return;
    if (monsterHPRef.current <= 0) return;

    const interval = window.setInterval(() => {
      if (!huntingTier) return;
      if (monsterHPRef.current <= 0) return;

      // 캐릭터 전진 애니메이션은 즉시 시작
      setBattlePhase('attack');

      // 실제 대미지 및 데미지 플로팅은 전진해서 몬스터 앞에 도달하는 시점에 적용
      const attackContactDelay = 320; // ms, attackSwing(0.8s) 기준 약 40%

      window.setTimeout(() => {
        setMonsterHP(prev => {
          if (!huntingTier) return prev;
          if (prev <= 0) return prev;

          const currentTier = huntingTier;
          const positions: string[] = ['40%', '50%', '60%']; // 좌측/중앙/우측 랜덤
          let totalDamage = 0;

          const baseDamage = calculateDamage(characterBaseAttack, monsterDefense);
          if (baseDamage > 0) {
            const eventId = Date.now() + Math.random();
            const left = positions[Math.floor(Math.random() * positions.length)];
            setDamageEvents(prevEvents => [...prevEvents, { id: eventId, amount: baseDamage, left }]);
            window.setTimeout(() => {
              setDamageEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
            }, 800);
            totalDamage += baseDamage;
          }

          if (equippedSkill && Date.now() >= skillCooldownRef.current && monsterHPRef.current > 0) {
            const isSrSkill = equippedSkill === 'SR';
            const damageMultiplier = isSrSkill ? 3.5 : 2.5;
            const healMultiplier = isSrSkill ? 1.0 : 0;
            const skillAttack = Math.floor(characterBaseAttack * damageMultiplier);
            const skillDamage = calculateDamage(skillAttack, monsterDefense);
            skillCooldownRef.current = Date.now() + 10000;
            setSkillCooldownLeftMs(10000);
            let actualHeal = 0;
            if (skillDamage > 0) {
              const eventId = Date.now() + Math.random();
              const left = positions[Math.floor(Math.random() * positions.length)];
              setDamageEvents(prevEvents => [...prevEvents, { id: eventId, amount: skillDamage, left }]);
              window.setTimeout(() => {
                setDamageEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
              }, 800);
              totalDamage += skillDamage;
            }
            if (healMultiplier > 0) {
              const rawHeal = Math.floor(characterBaseAttack * healMultiplier);
              if (rawHeal > 0) {
                actualHeal = Math.min(rawHeal, Math.max(0, characterMaxHP - characterHPRef.current));
                if (actualHeal > 0) {
                  pushHealEvent(actualHeal);
                }
                setCharacterHP(prev => Math.min(characterMaxHP, prev + rawHeal));
              }
            }
            triggerSkillEffect(isSrSkill ? 'SR' : 'R');
            if (isSrSkill) {
              addLog(`[스킬] ${equippedSkill} 발동! (+${skillDamage} 피해 · +${actualHeal} 회복)`);
            } else {
              addLog(`[스킬] ${equippedSkill} 발동! (+${skillDamage} 피해)`);
            }
          }

          if (totalDamage <= 0) return prev;

          const next = prev - totalDamage;

          // 일반 피격: 피격 모션 → 대기 모션 (실제 타격 시점 기준)
          if (next > 0) {
            setBattlePhase('hit');
            window.setTimeout(() => {
              setBattlePhase(current => (current === 'hit' ? 'idle' : current));
            }, 450);
            return next;
          }

          // 처치 시: dead → spawn → idle 연출
          if (currentTier !== null) {
            // 처치 처리 (킬 카운트, 경험치, 레벨업)
            handleMonsterKilled(currentTier);

            // 드랍 판정: 1% 확률 (1T 드랍템은 존재하지 않음)
            if (currentTier > 1 && Math.random() < HUNTING_DROP_RATE) {
              setInventory(prevInv => {
                if (prevInv.length >= 300) return prevInv;
                const tierMax = getMaxGradeForTier(currentTier);
                const dropCap: Item['grade'] = '고대';
                const maxGrade = GRADE_ORDER.indexOf(tierMax) <= GRADE_ORDER.indexOf(dropCap) ? tierMax : dropCap;
                const grade = determineGrade(dropRates.rare, dropRates.high, dropRates.hero, maxGrade) as Item['grade'];
                const isSR = currentTier >= 3 && Math.random() < (dropRates.sr / 100);
                const newItem: Item = {
                  id: Date.now() + Math.random(),
                  name: `${currentTier}T 드랍템`,
                  tier: currentTier,
                  grade,
                  attack: calculateAttack(currentTier, grade, 0),
                  bonusAttack: rollBonusAttack(currentTier),
                  skill: isSR ? 'SR' : 'R',
                  slots: 0,
                  enhance: 0
                };
                setTimeout(() => {
                  addLog(`[사냥] ${currentTier}T 드랍템(${grade}) 획득!`);
                  if (newItem.attack > 0) {
                    triggerDropEffect(newItem.grade);
                  }
                }, 0);
                return [...prevInv, newItem];
              });
            }
          }

          setBattlePhase('dead');

          // 몬스터 처치 후 리스폰 (HP/공격/방어 재설정)
          const now = Date.now();
          const minSpawnGapMs = 5000;
          const nextSpawnAt = lastMonsterSpawnRef.current + minSpawnGapMs;
          const respawnDelay = Math.max(nextSpawnAt - now, 0);
          window.setTimeout(() => {
            if (!huntingTier) return;
            const { maxHP, attack, defense } = getMonsterBaseStats(huntingTier);
            setMonsterMaxHP(maxHP);
            setMonsterHP(maxHP);
            setMonsterAttack(attack);
            setMonsterDefense(defense);
            setBattlePhase('spawn');
            lastMonsterSpawnRef.current = Date.now();
            window.setTimeout(() => {
              setBattlePhase('idle');
            }, 400);
          }, respawnDelay);
          return 0;
        });
      }, attackContactDelay);
    }, 500);

    return () => window.clearInterval(interval);
  }, [huntingTier, characterBaseAttack, monsterDefense]);

  // 1초마다 몬스터 → 캐릭터 공격 (방어도 적용)
  const characterDefense = 0; // 추후 장비/레벨에 따라 확장 가능

  useEffect(() => {
    if (!huntingTier) return;
    if (characterHPRef.current <= 0) return;

    const interval = window.setInterval(() => {
      if (monsterHPRef.current <= 0) return;
      setCharacterHP(prev => {
        if (prev <= 0) return prev;
        if (monsterHPRef.current <= 0) return prev;
        const damage = calculateDamage(monsterAttack, characterDefense);
        if (damage > 0) {
          pushCharacterDamage(damage);
        }
        const next = prev - damage;
        if (next <= 0) {
          // 캐릭터 사망 처리: 사냥 중지
          window.setTimeout(() => {
            stopHunting();
            addLog('[사망] 캐릭터가 쓰러졌습니다.');
          }, 0);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [huntingTier, monsterAttack]);
  
  // characterHPRef를 항상 최신 HP와 동기화 (포션 체크용)
  useEffect(() => {
    characterHPRef.current = characterHP;
  }, [characterHP]);

  useEffect(() => {
    monsterHPRef.current = monsterHP;
  }, [monsterHP]);

  // 포션 자동 사용 및 쿨타임 카운트다운
  useEffect(() => {
    if (!huntingTier) {
      setPotionCooldownLeftMs(0);
      setSkillCooldownLeftMs(0);
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const { hpThreshold, healRatio, cooldownMs } = DEFAULT_POTION_CONFIG;
      const thresholdHP = characterMaxHP * hpThreshold;
      const hp = characterHPRef.current;
      const healAmount = Math.floor(characterMaxHP * healRatio);

      // 1) HP/쿨타임 조건을 업데이터 밖에서 동기적으로 체크하여 side effect 없는 순수 업데이터 사용
      if (hp > 0 && hp < thresholdHP && now >= potionCooldownRef.current) {
        potionCooldownRef.current = now + cooldownMs;
        addLog(`[포션] 자동 사용 (최대 HP ${Math.round(healRatio * 100)}% · +${healAmount} 회복)`);
        const actualHeal = Math.min(healAmount, Math.max(0, characterMaxHP - hp));
        if (actualHeal > 0) {
          pushHealEvent(actualHeal);
        }
        setCharacterHP(prev => {
          if (prev <= 0) return prev;
          return Math.min(characterMaxHP, prev + healAmount);
        });
      }

      // 2) 남은 쿨타임 갱신 (UI 표시용) — ref가 이미 갱신된 후이므로 정확한 값 반영
      const remaining = Math.max(0, potionCooldownRef.current - Date.now());
      setPotionCooldownLeftMs(remaining);

      const skillRemaining = Math.max(0, skillCooldownRef.current - Date.now());
      setSkillCooldownLeftMs(skillRemaining);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [huntingTier, characterMaxHP]);

  // 아이템 장착/해제 핸들러
  const handleEquip = (item: Item | null) => {
    if (!item || item.isStackable) return;

    if (equippedItemId === item.id) {
      // 장착 해제
      setEquippedItemId(null);
      setCharacterBaseAttack(60); // 기본 공격력으로 복구
      addLog(`[장착해제] ${item.name} 장착 해제됨`);
      return;
    }

    setEquippedItemId(item.id);
    setCharacterBaseAttack(item.attack + item.bonusAttack);
    addLog(`[장착] ${item.name} (공격력 ${item.attack + item.bonusAttack}) 장착됨`);
  };

  // 장착 중인 아이템이 승급/강화/파괴될 때 실시간으로 ATK에 반영
  useEffect(() => {
    // 장착 아이템이 없으면 기본 공격력 유지
    if (!equippedItemId) {
      setCharacterBaseAttack(60);
      return;
    }

    const equipped = inventory.find(it => it.id === equippedItemId);

    // 인벤토리에서 사라졌거나 잘못된 상태면 장착 해제 + 기본 공격력
    if (!equipped || equipped.isStackable) {
      setEquippedItemId(null);
      setCharacterBaseAttack(60);
      return;
    }

    // 승급/강화로 공격력이 변한 경우 최신 값으로 동기화
    setCharacterBaseAttack(equipped.attack + equipped.bonusAttack);
  }, [inventory, equippedItemId]);

  // --- 철광석 헬퍼 함수 (core/inventory.ts 래퍼) ---
  const getOreCount = (tier: number) => {
    return getOreCountCore(inventory, tier);
  };

  const addOreToInventory = (tier: number, amount: number) => {
    const result = addOreToInventoryCore(inventory, tier, amount, 300);
    setInventory(result.inventory);

    if (result.overflow > 0) {
      setTimeout(() => alert(`인벤토리가 가득 찼습니다! (300/300)`), 0);
    }
    if (result.added > 0) {
      setTimeout(() => addLog(`[채집] ${tier}T 철광석 +${result.added}`), 0);
    }
  };

  // --- 사냥 시스템 ---
  const startHunting = (tier: number) => {
    setSelectedHuntingTier(tier);
    setHuntingTier(tier);
    setBattlePhase('idle');
    setKillCount(0);
    setSpawnedOres([]);
    setCharacterHP(characterMaxHP); // 캐릭터 부활 및 체력 회복
    skillCooldownRef.current = 0;
    setSkillCooldownLeftMs(0);
  };

  const stopHunting = () => {
    setHuntingTier(null);
    setBattlePhase('idle');
    setSpawnedOres([]);
    setDamageEvents([]);
    setCharacterDamageEvents([]);
    setHealEvents([]);
    setSkillEffects([]);
    skillCooldownRef.current = 0;
    setSkillCooldownLeftMs(0);
    if (oreSpawnTimeoutRef.current) {
      clearTimeout(oreSpawnTimeoutRef.current);
      oreSpawnTimeoutRef.current = null;
    }
    setPotionCooldownLeftMs(0);
  };

  // 기존 4초 전투 사이클은 제거되었고,
  // 이제는 HP가 0이 될 때까지 전투를 이어가며,
  // 캐릭터/몬스터 공격 루프에서만 전투가 진행됩니다.

  // 광물 스폰 사이클
  useEffect(() => {
    if (huntingTier === null) {
      if (oreSpawnTimeoutRef.current) {
        clearTimeout(oreSpawnTimeoutRef.current);
        oreSpawnTimeoutRef.current = null;
      }
      setSpawnedOres([]);
      return;
    }

    if (spawnedOres.length >= 3) return;

    const delay = 10000 + Math.random() * 10000; // 10~20초 사이
    const timeoutId = window.setTimeout(() => {
      setSpawnedOres(prev => {
        if (prev.length >= 3) return prev;
        const usedSlots = prev.map(o => o.slot);
        const availableSlots = [0, 1, 2].filter(s => !usedSlots.includes(s));
        if (availableSlots.length === 0) return prev;
        const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        return [...prev, { id: Date.now() + Math.random(), slot }];
      });
    }, delay);

    oreSpawnTimeoutRef.current = timeoutId;

    return () => {
      clearTimeout(timeoutId);
    };
  }, [huntingTier, spawnedOres.length]);

  const handleOreCollect = (oreId: number) => {
    if (!huntingTier) return;
    addOreToInventory(huntingTier, 10);
    setSpawnedOres(prev => prev.filter(ore => ore.id !== oreId));
    addLog(`[사냥] 광물 채집 → ${huntingTier}T 철 +10`);
  };

  // --- 1. 드랍 파밍 (티어별 최대 등급 고려) ---
  const handleDrop = (tier: number) => {
    if (inventory.length >= 300) {
      alert('인벤토리가 가득 찼습니다! (300/300)');
      return;
    }

    // 드랍은 최대 고대 등급까지만 가능하며, 티어 최대 등급도 초과 불가
    const tierMax = getMaxGradeForTier(tier);
    const dropCap: Item['grade'] = '고대';
    const maxGrade = GRADE_ORDER.indexOf(tierMax) <= GRADE_ORDER.indexOf(dropCap) ? tierMax : dropCap;
    const grade = determineGrade(dropRates.rare, dropRates.high, dropRates.hero, maxGrade) as Item['grade'];
    const isSR = tier >= 3 && Math.random() < (dropRates.sr / 100); // 3T 이후부터 SR 확률 적용

    const newItem: Item = {
      id: Date.now() + Math.random(),
      name: `${tier}T 드랍템`,
      tier,
      grade,
      attack: calculateAttack(tier, grade, 0),
      bonusAttack: rollBonusAttack(tier),
      skill: isSR ? 'SR' : 'R',
      slots: 0,
      enhance: 0
    };
    setInventory(prev => [...prev, newItem]);
    if (newItem.attack > 0) {
      triggerDropEffect(newItem.grade);
    }
    addLog(`[드랍] ${tier}T ${grade}${isSR ? ' SR' : ''} 획득`);
  };

  // --- 2. 제작 로직 (티어별 상이한 공식 적용) ---

  // --- 코어 제작 (3T~6T 코어 10 + nT 철광석 10 → nT 필드) ---
  const handleCraftCore = (tier: number) => {
    if (inventory.length >= 300) { alert('인벤토리가 가득 찼습니다! (300/300)'); return; }
    if (getCoreCount(inventory, tier) < 10) { alert(`${tier}T 코어 10개가 필요합니다.`); return; }
    if (getOreCount(tier) < 10) { alert(`${tier}T 철광석 10개가 필요합니다.`); return; }
    const coreResult = consumeCore(inventory, tier, 10);
    if (!coreResult.success) return;
    const oreResult = consumeOreCore(coreResult.inventory, consumedItems, tier, 10);
    if (!oreResult.success) return;
    const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(tier)) as Item['grade'];
    const isSR = Math.random() < (craftRates.sr / 100);
    const craftedItem = createCraftedFieldItem(tier, grade, isSR);
    setInventory([...oreResult.inventory, craftedItem]);
    setConsumedItems(oreResult.consumedItems);
    addLog(`[제작] ${tier}T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (코어 10, 철광석 10 소모)`);
  };

  // --- 무역 제작 (5T: 내륙코인 10 + 5T철 10, 6T: 해상코인 10 + 6T철 10 → nT 필드) ---
  const handleCraftTradeItem = (tier: 5 | 6) => {
    if (inventory.length >= 300) { alert('인벤토리가 가득 찼습니다! (300/300)'); return; }
    if (tier === 5) {
      if (inlandTradeCoins < 10) { alert('내륙무역코인 10개가 필요합니다.'); return; }
      if (getOreCount(5) < 10) { alert('5T 철광석 10개가 필요합니다.'); return; }
      const oreResult = consumeOreCore(inventory, consumedItems, 5, 10);
      if (!oreResult.success) return;
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(tier)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      const craftedItem = createCraftedFieldItem(tier, grade, isSR);
      setInventory([...oreResult.inventory, craftedItem]);
      setConsumedItems(oreResult.consumedItems);
      setInlandTradeCoins(prev => prev - 10);
      const coinLabel = tier === 5 ? '내륙코인' : '해상코인';
      addLog(`[제작] ${tier}T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (${coinLabel} 10, 철광석 10 소모)`);
      return;
    } else {
      if (seaTradeCoins < 10) { alert('해상무역코인 10개가 필요합니다.'); return; }
      if (getOreCount(6) < 10) { alert('6T 철광석 10개가 필요합니다.'); return; }
      const oreResult = consumeOreCore(inventory, consumedItems, 6, 10);
      if (!oreResult.success) return;
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(tier)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      const craftedItem = createCraftedFieldItem(tier, grade, isSR);
      setInventory([...oreResult.inventory, craftedItem]);
      setConsumedItems(oreResult.consumedItems);
      setSeaTradeCoins(prev => prev - 10);
      const coinLabel = tier === 5 ? '내륙코인' : '해상코인';
      addLog(`[제작] ${tier}T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (${coinLabel} 10, 철광석 10 소모)`);
      return;
    }
  };

  // --- 필드 제작 로직 ---
  const handleCraft = (tier: number) => {
    if (inventory.length >= 300) {
      alert('인벤토리가 가득 찼습니다! (300/300)');
      return;
    }

    // 1T 필드 제작: (1T 철광석 10개만 필요)
    if (tier === 1) {
      if (getOreCount(1) < 10) {
        alert('1T 철광석 10개가 필요합니다.');
        return;
      }
      const oreResult = consumeOreCore(inventory, consumedItems, 1, 10);
      if (!oreResult.success) return;
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(1)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      const craftedItem = createCraftedFieldItem(1, grade, isSR);
      setInventory([...oreResult.inventory, craftedItem]);
      setConsumedItems(oreResult.consumedItems);
      addLog(`[제작] 1T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (철광석 10 소모)`);
      return;
    }

    // 2T~6T 필드 제작: (nT 전리품 10개 + nT 철광석 10개 필요)
    if (tier >= 2 && tier <= 6) {
      if (getOreCount(tier) < 10) {
        alert(`${tier}T 철광석 10개가 필요합니다.`);
        return;
      }
      if (getLootCount(inventory, tier) < 10) {
        alert(`${tier}T 전리품 10개가 필요합니다.`);
        return;
      }
      const oreResult = consumeOreCore(inventory, consumedItems, tier, 10);
      if (!oreResult.success) return;
      const lootResult = consumeLoot(oreResult.inventory, tier, 10);
      if (!lootResult.success) return;
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(tier)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      const craftedItem = createCraftedFieldItem(tier, grade, isSR);
      setInventory([...lootResult.inventory, craftedItem]);
      setConsumedItems(oreResult.consumedItems);
      addLog(`[제작] ${tier}T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (전리품 10, 철광석 10 소모)`);
      return;
    }

    // 7T 제작은 기존대로 (철광석만 필요)
    if (tier === 7) {
      if (getOreCount(7) < 10) {
        alert("재료 부족! (7T 철광석 10)");
        return;
      }
      const oreResult = consumeOreCore(inventory, consumedItems, 7, 10);
      if (!oreResult.success) return;
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(7), '고대') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      const craftedItem = createCraftedFieldItem(7, grade, isSR);
      setInventory([...oreResult.inventory, craftedItem]);
      setConsumedItems(oreResult.consumedItems);
      addLog(`[제작] 7T 필드 ${grade}${isSR ? ' SR' : ''} 획득 (철광석 10 소모)`);
      return;
    }
  };

  // --- 3. 아이템 클릭 핸들러 (승급/강화/무역 UX 프레임) ---
  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setIsUpgradeMode(false);
    setIsEnhanceMode(false);
    setIsTradeMode(null);
    addLog(`[정보] ${item.name} 선택`);
  };

  // --- 4. 승급 모드 시작 ---
  const startUpgradeMode = () => {
    setIsUpgradeMode(true);
    setIsEnhanceMode(false);
    setIsTradeMode(null);
  };

  // --- 4-2. 강화 모드 시작 ---
  const startEnhanceMode = () => {
    setIsEnhanceMode(true);
    setIsUpgradeMode(false);
    setIsTradeMode(null);
  };

  // --- 4-3. 무역 모드 시작 ---
  const startTradeMode = (tradeType: 'inland' | 'sea') => {
    setIsTradeMode(tradeType);
    setIsUpgradeMode(false);
    setIsEnhanceMode(false);
    setSelectedItem(null);
  };

  // --- 4-4. 무역 실행 ---
  const handleTrade = (item: Item) => {
    if (!isTradeMode) return;

    const result = applyTrade(inventory, item, isTradeMode);
    if (!result.success) {
      alert('이 아이템은 무역할 수 없습니다!');
      return;
    }

    setInventory(result.inventory);

    if (isTradeMode === 'inland') {
      setInlandTradeCoins(prev => prev + result.tradeValue);
      addLog(`[내륙무역] ${item.name} ${item.grade} +${item.enhance}강 → 내륙코인 +${result.tradeValue}`);
    } else {
      setSeaTradeCoins(prev => prev + result.tradeValue);
      addLog(`[해상무역] ${item.name} ${item.grade} +${item.enhance}강 → 해상코인 +${result.tradeValue}`);
    }
  };

  // --- 4-5. 강화 실행 ---
  const handleEnhance = (useProtection: boolean) => {
    if (!selectedItem || selectedItem.isStackable) return;

    const currentEnhance = selectedItem.enhance;
    if (currentEnhance >= 9) {
      alert('최대 강화 단계입니다! (+9강)');
      return;
    }

    const result = enhanceItem({
      inventory,
      selectedItem,
      consumedItems,
      upgradeStones,
      ecoMode,
      enhanceRates,
      useProtection,
    });

    setInventory(result.inventory);
    setConsumedItems(result.consumedItems);
    setUpgradeStones(result.upgradeStones);
    setSelectedItem(result.selectedItem);
    if (result.usedProtectionDelta > 0) {
      setUsedProtectionCount(prev => prev + result.usedProtectionDelta);
    }
    addLog(result.log);
    if (result.destroyed) {
      setIsEnhanceMode(false);
    }
  };

  const toggleDisassembleItem = (item: Item) => {
    if (disassembleSelection.find(i => i.id === item.id)) {
      setDisassembleSelection(prev => prev.filter(i => i.id !== item.id));
    } else {
      setDisassembleSelection(prev => [...prev, item]);
    }
  };

  const executeDisassemble = () => {
    if (disassembleSelection.length === 0) return;

    // 분해 결과 계산
    const stoneGains = { low: 0, mid: 0, high: 0 };
    disassembleSelection.forEach(item => {
      const stones = getDisassembleStones(item.tier, item.grade);
      stoneGains[stones.type] += stones.amount;
    });

    // 결과값을 팝업으로 표시
    setDisassembleResult({
      items: disassembleSelection,
      stones: stoneGains
    });
  };

  // 분해 결과 확인 후 저장
  const confirmDisassemble = () => {
    if (!disassembleResult) return;

    const stoneGains = disassembleResult.stones;

    // 소모 통계 업데이트
    disassembleResult.items.forEach(item => {
      const itemKey = item.name.includes('제작') ? `${item.tier}T제작` as keyof typeof consumedItems : `${item.tier}T드랍` as keyof typeof consumedItems;
      if (itemKey in consumedItems) {
        setConsumedItems(prev => ({ ...prev, [itemKey]: prev[itemKey] + 1 }));
      }
    });

    setInventory(prev => prev.filter(item => !disassembleResult.items.find(d => d.id === item.id)));
    setUpgradeStones(prev => ({
      low: prev.low + stoneGains.low,
      mid: prev.mid + stoneGains.mid,
      high: prev.high + stoneGains.high
    }));

    // 선택된 아이템이 분해되면 선택 해제
    if (selectedItem && disassembleResult.items.find(d => d.id === selectedItem.id)) {
      setSelectedItem(null);
    }

    const parts = [];
    if (stoneGains.low > 0) parts.push(`하급숯돌 +${stoneGains.low}`);
    if (stoneGains.mid > 0) parts.push(`중급숯돌 +${stoneGains.mid}`);
    if (stoneGains.high > 0) parts.push(`상급숯돌 +${stoneGains.high}`);
    addLog(`[분해] ${disassembleResult.items.length}개 분해 → ${parts.join(', ')}`);

    // 결과 초기화
    setDisassembleResult(null);
    setDisassembleSelection([]);
    setIsDisassembleMode(false);
  };

  const canUpgradeWithStones = (item: Item): boolean => {
    if (item.isStackable) return false;
    const maxGrade = getMaxGradeForTier(item.tier);
    if (item.grade === maxGrade) return false;
    const cost = getUpgradeCost(item.grade, item.tier);
    if (!cost) return false;
    return upgradeStones[cost.type] >= cost.amount;
  };

  // --- 승급 실행 (숯돌 소모) ---
  const executeUpgrade = () => {
    if (!selectedItem) return;
    const cost = getUpgradeCost(selectedItem.grade, selectedItem.tier);
    const nextGrade = getNextGrade(selectedItem.grade);
    if (!cost || !nextGrade) return;
    if (upgradeStones[cost.type] < cost.amount) return;

    // 숯돌 소모
    setUpgradeStones(prev => ({ ...prev, [cost.type]: prev[cost.type] - cost.amount }));

    // 아이템 승급
    setInventory(prev => prev.map(item =>
      item.id === selectedItem.id
        ? {
            ...item,
            grade: nextGrade,
            attack: calculateAttack(item.tier, nextGrade, item.enhance),
            exp: 0
          }
        : item
    ));

    addLog(`[승급] ${selectedItem.name} → ${nextGrade} (${cost.label} 소모)`);

    setSelectedItem(prev =>
      prev ? {
        ...prev,
        grade: nextGrade,
        attack: calculateAttack(prev.tier, nextGrade, prev.enhance),
        exp: 0
      } : null
    );
    setIsUpgradeMode(false);
  };

  // --- 8. 드래그 앤 드롭 핸들러 ---
  const handleDragStart = (e: React.DragEvent, item: Item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToTrash = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem) {
      setDeleteConfirmItem(draggedItem);
      setDraggedItem(null);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirmItem) {
      setInventory(prev => prev.filter(item => item.id !== deleteConfirmItem.id));
      addLog(`[삭제] ${deleteConfirmItem.name} 파괴됨`);

      // 선택된 아이템이 삭제되는 경우 선택 해제
      if (selectedItem?.id === deleteConfirmItem.id) {
        setSelectedItem(null);
      }

      setDeleteConfirmItem(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmItem(null);
  };

  // --- 숯돌 → 세공석 변환 ---
  const POLISH_STONE_RATES: Record<'low' | 'mid' | 'high', number> = { low: 100, mid: 10, high: 1 };
  const POLISH_STONE_LABELS: Record<'low' | 'mid' | 'high', string> = { low: '하급숯돌', mid: '중급숯돌', high: '상급숯돌' };

  const convertToPolishStone = (type: 'low' | 'mid' | 'high') => {
    const rate = POLISH_STONE_RATES[type];
    const available = upgradeStones[type];
    const convertible = Math.floor(available / rate);
    if (convertible <= 0) return;
    setUpgradeStones(prev => ({ ...prev, [type]: prev[type] - convertible * rate }));
    setPolishStones(prev => prev + convertible);
    addLog(`[변환] ${POLISH_STONE_LABELS[type]} ${convertible * rate}개 → 세공석 ${convertible}개`);
  };

  // --- 9. 인벤토리 전체 삭제 ---
  const clearAllInventory = () => {
    if (inventory.length === 0) {
      alert('인벤토리가 비어있습니다.');
      return;
    }

    if (window.confirm(`전체 아이템 ${inventory.length}개를 삭제하시겠습니까?`)) {
      setInventory([]);
      setSelectedItem(null);
      setUsedProtectionCount(0); // 보호제 사용 통계도 초기화
      setUpgradeStones({ low: 0, mid: 0, high: 0 }); // 숯돌 초기화
      setPolishStones(0); // 세공석 초기화
      setHuntingTier(null); // 사냥 중지
      setSelectedHuntingTier(1);
      setKillCount(0);
      setSpawnedOres([]);
      potionCooldownRef.current = 0;
      setPotionCooldownLeftMs(0);
      if (oreSpawnTimeoutRef.current) {
        clearTimeout(oreSpawnTimeoutRef.current);
        oreSpawnTimeoutRef.current = null;
      }
      setConsumedItems({
        '1T제작': 0, '1T드랍': 0,
        '2T제작': 0, '2T드랍': 0,
        '3T제작': 0, '3T드랍': 0,
        '4T제작': 0, '4T드랍': 0,
        '5T제작': 0, '5T드랍': 0,
        '6T제작': 0, '6T드랍': 0,
        '7T제작': 0, '7T드랍': 0,
        '1T철': 0, '2T철': 0, '3T철': 0,
        '4T철': 0, '5T철': 0, '6T철': 0, '7T철': 0
      }); // 소모 아이템 통계도 초기화
      addLog('[전체삭제] 인벤토리 초기화');
    }
  };

  return (
    <>
      <div style={containerStyle}>
        {/* 시스템 로그 우측 상단에 세션 리셋 버튼 (fixed로 항상 보이게) */}
        <div style={{ position: 'fixed', top: 18, right: 32, zIndex: 100 }}>
          <button
            onClick={handleResetSession}
            style={{
              background: '#222',
              color: '#ff5252',
              border: '1.5px solid #ff5252',
              borderRadius: 6,
              padding: '7px 18px',
              fontWeight: 'bold',
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px #000a',
            }}
          >
            [캐릭터 삭제(리셋)]
          </button>
        </div>
        {/* CSS 애니메이션 keyframes */}
        <style>{`
          @keyframes attackSwing {
            0% { transform: translateX(0); }
            40% { transform: translateX(40px); }
            60% { transform: translateX(40px) rotate(-15deg); }
            100% { transform: translateX(0); }
          }
          @keyframes monsterHit {
            0% { transform: translateX(0); filter: brightness(1); }
            20% { transform: translateX(8px); filter: brightness(2) saturate(0) hue-rotate(0deg); }
            40% { transform: translateX(-8px); filter: brightness(1.5); }
            60% { transform: translateX(5px); filter: brightness(1.2); }
            100% { transform: translateX(0); filter: brightness(1); }
          }
          @keyframes monsterDeath {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            50% { transform: translateY(10px) scale(0.8); opacity: 0.5; }
            100% { transform: translateY(30px) scale(0.3); opacity: 0; }
          }
          @keyframes orePulse {
            0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 0.7; }
            50% { transform: translateX(-50%) translateY(-6px) scale(1.15); opacity: 1; }
            100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 0.8; }
          }
          @keyframes monsterSpawn {
            0% { transform: translateY(-20px) scale(0.5); opacity: 0; }
            60% { transform: translateY(5px) scale(1.1); opacity: 0.8; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes idleBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          @keyframes slimeBounce {
            0%, 100% { transform: translateY(0) scaleX(1) scaleY(1); }
            50% { transform: translateY(-4px) scaleX(0.95) scaleY(1.08); }
          }
          @keyframes dropFloat {
            0% { transform: translateY(0); opacity: 1; }
            50% { transform: translateY(-15px); opacity: 1; }
            100% { transform: translateY(-30px); opacity: 0; }
          }
          @keyframes orePulse {
            0% { transform: translateY(0) scale(0.9); opacity: 0.7; }
            50% { transform: translateY(-6px) scale(1.05); opacity: 1; }
            100% { transform: translateY(0) scale(0.9); opacity: 0.7; }
          }
          @keyframes dropPillar {
            0% { opacity: 0; transform: translateX(-50%) translateY(10px) scaleY(0.2); }
            5% { opacity: 1; transform: translateX(-50%) translateY(0) scaleY(1.1); }
            80% { opacity: 1; transform: translateX(-50%) translateY(-4px) scaleY(1); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px) scaleY(0.9); }
          }
          @keyframes lightningStrike {
            0% { opacity: 0; transform: translateX(-50%) translateY(-12px) scaleY(0.3); }
            15% { opacity: 1; transform: translateX(-50%) translateY(-2px) scaleY(1); }
            40% { opacity: 1; transform: translateX(-50%) translateY(0) scaleY(0.9); }
            100% { opacity: 0; transform: translateX(-50%) translateY(8px) scaleY(0.5); }
          }
          @keyframes cooldownBlink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}</style>
        <h2 style={{ color: '#ffd700', margin: '0 0 20px 0' }}>Project X7 Dev Simulator</h2>

        {/* 확률 설정 */}
        <div style={rateConfigStyle}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: isRateConfigOpen ? '10px' : 0}}>
            <h4 style={{margin: 0, color: '#ffd700'}}>확률 설정</h4>
            <button
              onClick={() => setIsRateConfigOpen(prev => !prev)}
              style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #555',
                borderRadius: '4px',
                color: '#ddd',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '4px 10px',
              }}
            >
              {isRateConfigOpen ? '접기 ▲' : '펼치기 ▼'}
            </button>
          </div>
          {isRateConfigOpen && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', alignItems: 'start'}}>
              {/* 드랍템 확률 */}
              <div style={{minWidth: 0}}>
                <h4 style={{margin: '0 0 10px 0', color: '#81c784'}}>📦 드랍템 확률</h4>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고급:</label>
                    <input
                      type="number"
                      value={dropRates.high}
                      onChange={(e) => setDropRates({...dropRates, high: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>희귀:</label>
                    <input
                      type="number"
                      value={dropRates.rare}
                      onChange={(e) => setDropRates({...dropRates, rare: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고대:</label>
                    <input
                      type="number"
                      value={dropRates.hero}
                      onChange={(e) => setDropRates({...dropRates, hero: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>SR:</label>
                    <input
                      type="number"
                      value={dropRates.sr}
                      onChange={(e) => setDropRates({...dropRates, sr: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                </div>
                <div style={{marginTop: '6px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.8rem', color: '#ff6b00', fontWeight: 'bold'}}>
                  🌟 특별궁극기(SR) 확률: {dropRates.sr.toFixed(2)}% (3T 이후부터)
                </div>
              </div>

              {/* 전리품 드랍 확률 */}
              <div style={{minWidth: 0}}>
                <h4 style={{margin: '0 0 10px 0', color: '#ffd166'}}>🎁 전리품 드랍 확률</h4>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <label style={{fontSize: '0.85rem', marginRight: '5px'}}>전리품:</label>
                  <input
                    type="number"
                    value={lootDropRate}
                    onChange={(e) => setLootDropRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    step="0.01"
                    min="0"
                    max="100"
                    style={compactInputStyle}
                  />
                  <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                </div>
                <div style={{marginTop: '6px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.8rem', color: '#ffd166', fontWeight: 'bold'}}>
                  기본값 100% (1T 사냥터는 2T 전리품 드랍)
                </div>
              </div>

              {/* 제작템 확률 */}
              <div style={{minWidth: 0}}>
                <h4 style={{margin: '0 0 10px 0', color: '#64b5f6'}}>🛠️ 제작템 확률</h4>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고급:</label>
                    <input
                      type="number"
                      value={craftRates.high}
                      onChange={(e) => setCraftRates({...craftRates, high: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>희귀:</label>
                    <input
                      type="number"
                      value={craftRates.rare}
                      onChange={(e) => setCraftRates({...craftRates, rare: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고대:</label>
                    <input
                      type="number"
                      value={craftRates.hero}
                      onChange={(e) => setCraftRates({...craftRates, hero: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                  <div>
                    <label style={{fontSize: '0.85rem', marginRight: '5px'}}>SR:</label>
                    <input
                      type="number"
                      value={craftRates.sr}
                      onChange={(e) => setCraftRates({...craftRates, sr: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                  </div>
                </div>
                <div style={{marginTop: '6px', padding: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.8rem', color: '#ff6b00', fontWeight: 'bold'}}>
                  🌟 특별궁극기(SR) 확률: {craftRates.sr.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* 강화 확률 + 보호제 가격 */}
            <div style={{padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #333'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'nowrap'}}>
                <h4 style={{margin: 0, color: '#9575cd'}}>⚔️ 강화 확률</h4>
                <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <label style={{fontSize: '0.8rem', color: '#ffeb3b', fontWeight: 'bold'}}>🛡️ 보호제:</label>
                  <input
                    type="number"
                    value={protectionPrice}
                    onChange={(e) => setProtectionPrice(Math.max(1, parseFloat(e.target.value) || 100))}
                    step="1"
                    min="1"
                    style={{...compactInputStyle, width: '64px'}}
                  />
                  <span style={{fontSize: '0.8rem'}}>원</span>
                </div>
              </div>
              <div style={{display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px'}}>
                {enhanceRates.map((rate, index) => (
                  <div key={index} style={{display: 'flex', alignItems: 'center'}}>
                    <label style={{fontSize: '0.8rem', marginRight: '4px'}}>+{index + 1}강:</label>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => {
                        const newRates = [...enhanceRates];
                        newRates[index] = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                        setEnhanceRates(newRates);
                      }}
                      step="0.01"
                      min="0"
                      max="100"
                      style={compactInputStyle}
                    />
                    <span style={{fontSize: '0.8rem', marginLeft: '3px'}}>%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>

      {/* Tier 별 최대 등급 */}
      <div style={{padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333'}}>
        <h4 style={{margin: '0 0 15px 0', color: '#64b5f6', textAlign: 'center'}}>⭐ Tier 별 최대 등급</h4>
        <div style={{display: 'flex', justifyContent: 'space-around', gap: '15px', flexWrap: 'wrap'}}>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>1 Tier</div>
            <div style={{color: '#9e9e9e', fontSize: '0.95rem'}}>일반</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>2 Tier</div>
            <div style={{color: '#4caf50', fontSize: '0.95rem'}}>고급</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>3 Tier</div>
            <div style={{color: '#2196f3', fontSize: '0.95rem'}}>희귀</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>4 Tier</div>
            <div style={{color: '#9c27b0', fontSize: '0.95rem'}}>고대</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>5 Tier</div>
            <div style={{color: '#ff9800', fontSize: '0.95rem'}}>영웅</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>6 Tier</div>
            <div style={{color: '#ffd700', fontSize: '0.95rem'}}>유일</div>
          </div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '5px'}}>7 Tier</div>
            <div style={{color: '#f44336', fontSize: '0.95rem'}}>유물</div>
          </div>
        </div>
      </div>
      {/* 경제 모드 토글 */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '10px', padding: '8px 15px', backgroundColor: '#1e1e1e', borderRadius: '6px', border: '1px solid #333', alignItems: 'center'}}>
        <span style={{fontSize: '0.85rem', fontWeight: 'bold', marginRight: '5px'}}>경제 모드:</span>
        <button
          onClick={() => setEcoMode('BM')}
          style={{...actionBtn, backgroundColor: ecoMode === 'BM' ? '#d32f2f' : '#444', fontWeight: ecoMode === 'BM' ? 'bold' : 'normal', padding: '6px 14px'}}
        >
          🛡️ 보호제 모델 (BM)
        </button>
        <button
          onClick={() => setEcoMode('HARDCORE')}
          style={{...actionBtn, backgroundColor: ecoMode === 'HARDCORE' ? '#2e7d32' : '#444', fontWeight: ecoMode === 'HARDCORE' ? 'bold' : 'normal', padding: '6px 14px'}}
        >
          🔥 파괴/재료 모델 (Hardcore)
        </button>
      </div>

      {/* 채집 - 숨김
      <div style={{padding: '8px 12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px'}}>
        <span style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold'}}>⛏️ 채집</span>
        {[1,2,3,4,5,6,7].map(t => (
          <button key={t} onClick={() => addOreToInventory(t, 100)} style={actionBtn}>{t}T 철 +100</button>
        ))}
      </div>
      */}

      {/* 드랍 + 제작
      <div style={{padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px'}}>
        <div style={{display: 'flex', gap: '8px'}}>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>📦 드랍</div>
            <button onClick={() => handleDrop(1)} style={actionBtn}>1T 드랍</button>
            <button onClick={() => handleDrop(2)} style={actionBtn}>2T 드랍</button>
            <button onClick={() => handleDrop(3)} style={actionBtn}>3T 드랍</button>
            <button onClick={() => handleDrop(4)} style={actionBtn}>4T 드랍</button>
            <button onClick={() => handleDrop(5)} style={actionBtn}>5T 드랍</button>
            <button onClick={() => handleDrop(6)} style={actionBtn}>6T 드랍</button>
          </div>
          <div style={{flex: 3, display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>🛠️ 제작</div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(1)} style={{...actionBtn, flex: 1}}>1T 필드 (1T 철광석 10)</button>
              <div style={{flex: 1}}/><div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(2)} style={{...actionBtn, flex: 1}}>2T 필드 (2T 철광석 10, 2T 전리품 10)</button>
              <div style={{flex: 1}}/><div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(3)} style={{...actionBtn, flex: 1}}>3T 필드 (3T 철광석 10, 3T 전리품 10)</button>
              <button onClick={() => handleCraft(3)} style={{...actionBtn, flex: 1}}>3T 코어</button>
              <div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(4)} style={{...actionBtn, flex: 1}}>4T 필드 (4T 철광석 10, 4T 전리품 10)</button>
              <button onClick={() => handleCraft(4)} style={{...actionBtn, flex: 1}}>4T 코어</button>
              <div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 필드 (5T 철광석 10, 5T 전리품 10)</button>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 코어</button>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 무역</button>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 필드 (6T 철광석 10, 6T 전리품 10)</button>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 코어</button>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 무역</button>
            </div>
          </div>
        </div>
      </div>
      */}

      {/* 드랍 (치트) */}
      <div style={{padding: '12px', backgroundColor: '#2a1a1a', borderRadius: '8px', border: '1px solid #5a2d2d', marginBottom: '10px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDropCheatOpen ? '8px' : 0}}>
          <div style={{fontSize: '0.8rem', color: '#c44242', fontWeight: 'bold'}}>📦 드랍 <span style={{fontSize: '0.7rem', color: '#888'}}>(치트)</span></div>
          <button
            onClick={() => setIsDropCheatOpen(v => !v)}
            style={{fontSize: '0.75rem', padding: '2px 10px', backgroundColor: '#3a1a1a', border: '1px solid #5a2d2d', borderRadius: '4px', color: '#c44242', cursor: 'pointer'}}
          >
            {isDropCheatOpen ? '접기 ▲' : '펼치기 ▼'}
          </button>
        </div>
        {isDropCheatOpen && (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px'}}>
            {[1,2,3,4,5,6].map(t => (
              <button
                key={t}
                onClick={() => handleDrop(t)}
                style={{...actionBtn, backgroundColor: '#3a1a1a', borderColor: '#5a2d2d', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px'}}
              >
                <span style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{t}T 드랍</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 필드 제작 */}
      <div style={{padding: '12px', backgroundColor: '#1a2a1a', borderRadius: '8px', border: '1px solid #2d5a2d', marginBottom: '10px'}}>
        <div style={{fontSize: '0.8rem', color: '#76c442', fontWeight: 'bold', marginBottom: '8px'}}>🛠️ 제작</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px'}}>
          {[1,2,3,4,5,6].map(t => {
            const loot = getLootCount(inventory, t);
            const ore = getOreCount(t);
            const canCraft = (t === 1 ? true : loot >= 10) && ore >= 10 && inventory.length < 300;
            return (
              <button
                key={t}
                onClick={() => handleCraft(t)}
                disabled={!canCraft}
                style={{
                  ...actionBtn,
                  backgroundColor: canCraft ? '#1e3d1e' : '#2a2a2a',
                  borderColor: canCraft ? '#4caf50' : '#444',
                  opacity: canCraft ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '8px 4px',
                  cursor: canCraft ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{t}T 필드</span>
                {t > 1 && <span style={{fontSize: '0.7rem', color: loot >= 10 ? '#90ee90' : '#ff8888'}}>{t}T 전리품 {loot}/10</span>}
                <span style={{fontSize: '0.7rem', color: ore >= 10 ? '#90ee90' : '#ff8888'}}>{t}T 철광석 {ore}/10</span>
              </button>
            );
          })}
        </div>
        {/* 코어/무역 제작 행 */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginTop: '6px'}}>
          {([3,4,5,6] as const).map(t => {
            const core = getCoreCount(inventory, t);
            const ore = getOreCount(t);
            const canCraft = core >= 10 && ore >= 10 && inventory.length < 300;
            return (
              <button
                key={`core-${t}`}
                onClick={() => handleCraftCore(t)}
                disabled={!canCraft}
                style={{
                  ...actionBtn,
                  backgroundColor: canCraft ? '#1e2e3d' : '#2a2a2a',
                  borderColor: canCraft ? '#4a90d9' : '#444',
                  opacity: canCraft ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '8px 4px',
                  cursor: canCraft ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{t}T 코어</span>
                <span style={{fontSize: '0.7rem', color: core >= 10 ? '#90ee90' : '#ff8888'}}>{t}T 코어 {core}/10</span>
                <span style={{fontSize: '0.7rem', color: ore >= 10 ? '#90ee90' : '#ff8888'}}>{t}T 철광석 {ore}/10</span>
              </button>
            );
          })}
          {([5,6] as const).map(t => {
            const coins = t === 5 ? inlandTradeCoins : seaTradeCoins;
            const ore = getOreCount(t);
            const canCraft = coins >= 10 && ore >= 10 && inventory.length < 300;
            const coinLabel = t === 5 ? '내륙코인' : '해상코인';
            const coinColor = t === 5 ? '#ff9966' : '#66aaff';
            return (
              <button
                key={`trade-${t}`}
                onClick={() => handleCraftTradeItem(t)}
                disabled={!canCraft}
                style={{
                  ...actionBtn,
                  backgroundColor: canCraft ? '#2a1e3d' : '#2a2a2a',
                  borderColor: canCraft ? '#9b59b6' : '#444',
                  opacity: canCraft ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '8px 4px',
                  cursor: canCraft ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{t}T 무역</span>
                <span style={{fontSize: '0.7rem', color: coins >= 10 ? coinColor : '#ff8888'}}>{coinLabel} {coins}/10</span>
                <span style={{fontSize: '0.7rem', color: ore >= 10 ? '#90ee90' : '#ff8888'}}>{t}T 철광석 {ore}/10</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 보호제 및 소모 통계 + 9강 달성 통계 */}
      <div style={{padding: '8px 12px', backgroundColor: '#1a1a1a', borderRadius: '6px', marginBottom: '15px', border: '1px solid #333', fontSize: '0.75rem'}}>
        <div style={{marginBottom: '4px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap'}}>
          <span style={{color: '#ffeb3b', fontWeight: 'bold'}}>
            🛡️ 보호제: {usedProtectionCount.toLocaleString()}개 ({(usedProtectionCount * protectionPrice / 10000).toFixed(1)}만원)
          </span>
          <span style={{color: '#ff6b6b', fontWeight: 'bold'}}>📦 소모:</span>
          <span style={{color: '#bbb'}}>
            드랍템 (1T: <span style={{color: '#ffeb3b'}}>{consumedItems['1T드랍']}</span>, 2T: <span style={{color: '#ffeb3b'}}>{consumedItems['2T드랍']}</span>, 3T: <span style={{color: '#ffeb3b'}}>{consumedItems['3T드랍']}</span>, 4T: <span style={{color: '#ffeb3b'}}>{consumedItems['4T드랍']}</span>, 5T: <span style={{color: '#ffeb3b'}}>{consumedItems['5T드랍']}</span>, 6T: <span style={{color: '#ffeb3b'}}>{consumedItems['6T드랍']}</span>, 7T: <span style={{color: '#ffeb3b'}}>{consumedItems['7T드랍']}</span>)
          </span>
          <span style={{color: '#bbb'}}>
            제작템 (1T: <span style={{color: '#ffeb3b'}}>{consumedItems['1T제작']}</span>, 2T: <span style={{color: '#ffeb3b'}}>{consumedItems['2T제작']}</span>, 3T: <span style={{color: '#ffeb3b'}}>{consumedItems['3T제작']}</span>, 4T: <span style={{color: '#ffeb3b'}}>{consumedItems['4T제작']}</span>, 5T: <span style={{color: '#ffeb3b'}}>{consumedItems['5T제작']}</span>, 6T: <span style={{color: '#ffeb3b'}}>{consumedItems['6T제작']}</span>, 7T: <span style={{color: '#ffeb3b'}}>{consumedItems['7T제작']}</span>)
          </span>
          <span style={{color: '#bbb'}}>
            철광석 (1T: <span style={{color: '#ffeb3b'}}>{consumedItems['1T철']}</span>, 2T: <span style={{color: '#ffeb3b'}}>{consumedItems['2T철']}</span>, 3T: <span style={{color: '#ffeb3b'}}>{consumedItems['3T철']}</span>, 4T: <span style={{color: '#ffeb3b'}}>{consumedItems['4T철']}</span>, 5T: <span style={{color: '#ffeb3b'}}>{consumedItems['5T철']}</span>, 6T: <span style={{color: '#ffeb3b'}}>{consumedItems['6T철']}</span>, 7T: <span style={{color: '#ffeb3b'}}>{consumedItems['7T철']}</span>)
          </span>
        </div>
        {/*
        <div style={{color: '#aaa', paddingTop: '4px', borderTop: '1px solid #333'}}>
          <span style={{color: '#9575cd', fontWeight: 'bold'}}>📊 +9강</span>: 평균 {Math.floor(1 / enhanceRates.reduce((acc, rate) => acc * (rate / 100), 1)).toLocaleString()}개 | 
          {simulateAllTiers(enhanceRates).map(result => (
            <span key={result.tier} style={{marginLeft: '8px'}}>
              {result.tier}T: {result.totalProtectionItems.toLocaleString()}개
            </span>
          ))}
        </div>
        */}
      </div>

      {/* 사냥 시스템 */}
      <div style={{padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px'}}>
        <CombatPanel
          onSelectHuntingTier={setSelectedHuntingTier}
          onStartHunting={() => startHunting(selectedHuntingTier)}
          onStopHunting={stopHunting}
          onCollectOre={handleOreCollect}
          onStartTradeInland={() => startTradeMode('inland')}
          onStartTradeSea={() => startTradeMode('sea')}
        />
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <InventoryPanel
          onClearAllInventory={clearAllInventory}
          onOpenDisassemble={() => { setIsDisassembleMode(true); setDisassembleSelection([]); }}
          onConvertToPolishStone={convertToPolishStone}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDropToTrash={handleDropToTrash}
          onItemClick={handleItemClick}
        />

        <EnhancePanel
          onEquip={handleEquip}
          onStartUpgradeMode={startUpgradeMode}
          onStartEnhanceMode={startEnhanceMode}
          onClearSelectedItem={() => setSelectedItem(null)}
          onEnhance={handleEnhance}
          onCloseEnhanceMode={() => setIsEnhanceMode(false)}
        />

        <div style={logPanel}>
          <h3 style={{marginTop: 0}}>System Log</h3>
          {log.map((m, i) => (
            <div key={i} style={{fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid #333'}}>
              {renderLogMessage(m)}
            </div>
          ))}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirmItem && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ color: '#ff5252', marginTop: 0 }}>⚠️ 아이템 파괴 확인</h3>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ ...itemCard, backgroundColor: getGradeColor(deleteConfirmItem.grade), marginBottom: '15px' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {deleteConfirmItem.name}
                  {deleteConfirmItem.skill === 'SR' && !deleteConfirmItem.isStackable && (
                    <span style={{fontSize: '1.3rem', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00'}}>⭐</span>
                  )}
                </div>
                <div style={infoText}>공격력: {deleteConfirmItem.attack}</div>
                <div style={infoText}>추가공격력: {formatBonusAttack(deleteConfirmItem)}</div>
                <div style={{...infoText, color: deleteConfirmItem.skill === 'SR' ? '#ff6b00' : '#64b5f6', fontWeight: deleteConfirmItem.skill === 'SR' ? 'bold' : 'normal'}}>스킬: {deleteConfirmItem.skill}</div>
                <div style={{ ...infoText, color: '#ffd700' }}>등급: {deleteConfirmItem.grade}</div>
              </div>
              <div style={{ fontSize: '1.1rem', textAlign: 'center', marginBottom: '20px' }}>
                이 아이템을 <span style={{ color: '#ff5252', fontWeight: 'bold' }}>파괴</span>하시겠습니까?
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={confirmDelete}
                style={{
                  ...btnStyle,
                  backgroundColor: '#d32f2f',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                Y - 파괴
              </button>
              <button
                onClick={cancelDelete}
                style={{
                  ...btnStyle,
                  backgroundColor: '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                N - 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승급 모달 (숯돌 기반) */}
      {selectedItem && isUpgradeMode && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, minWidth: '500px', border: '2px solid #ffd700'}}>
            <h3 style={{ color: '#ffd700', marginTop: 0 }}>✨ 아이템 승급</h3>

            {/* 선택된 아이템 정보 */}
            <div style={{...itemCard, backgroundColor: getGradeColor(selectedItem.grade), marginBottom: '20px'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px'}}>{selectedItem.name}</div>
              <div style={infoText}>공격력: {selectedItem.attack} | 추가공격력: {formatBonusAttack(selectedItem)} | 스킬: {selectedItem.skill}</div>
              <div style={infoText}>{selectedItem.slots > 0 ? `세공: ${selectedItem.slots}칸 | ` : ''}강화: +{selectedItem.enhance}</div>
              <div style={{...infoText, color: '#ffd700', marginTop: '5px'}}>현재 등급: {selectedItem.grade}</div>
            </div>

            {/* 승급 정보 */}
            {(() => {
              const cost = getUpgradeCost(selectedItem.grade, selectedItem.tier);
              const nextGrade = getNextGrade(selectedItem.grade);
              const canUpgrade = canUpgradeWithStones(selectedItem);
              const stoneTypeLabel = cost?.type === 'low' ? '하급 숯돌' : cost?.type === 'mid' ? '중급 숯돌' : '상급 숯돌';
              const stoneTypeColor = cost?.type === 'low' ? '#a5d6a7' : cost?.type === 'mid' ? '#90caf9' : '#ffab91';

              return (
                <div style={{padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px', marginBottom: '20px'}}>
                  <div style={{fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold', color: '#ffd700'}}>
                    {selectedItem.grade} → {nextGrade}
                  </div>
                  <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                    • 필요 숯돌: <span style={{color: stoneTypeColor, fontWeight: 'bold'}}>{stoneTypeLabel} {cost?.amount}개</span>
                  </div>
                  <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                    • 보유: <span style={{color: canUpgrade ? '#4caf50' : '#f44336', fontWeight: 'bold'}}>
                      {stoneTypeLabel} {cost ? upgradeStones[cost.type] : 0}개
                    </span>
                  </div>
                  {!canUpgrade && (
                    <div style={{fontSize: '0.8rem', color: '#f44336', marginTop: '5px'}}>
                      숯돌이 부족합니다. 아이템을 분해하여 숯돌을 획득하세요!
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={executeUpgrade}
                disabled={!canUpgradeWithStones(selectedItem)}
                style={{
                  ...btnStyle,
                  backgroundColor: canUpgradeWithStones(selectedItem) ? '#2e7d32' : '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: canUpgradeWithStones(selectedItem) ? 'pointer' : 'not-allowed'
                }}
              >
                승급
              </button>
              <button
                onClick={() => setIsUpgradeMode(false)}
                style={{
                  ...btnStyle,
                  backgroundColor: '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 분해 모달 */}
      {isDisassembleMode && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, minWidth: '600px', border: '2px solid #795548'}}>
            <h3 style={{ color: '#a1887f', marginTop: 0 }}>🔨 아이템 분해</h3>

            <div style={{marginBottom: '15px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '8px', fontSize: '0.8rem', color: '#aaa'}}>
              분해 시 등급별 숯돌 획득: 일반 2~4 | 고급 4~8 | 희귀 20~40 | 고대 100~200 | 영웅 500~1000 | 유일 2500~5000 | 유물 12500~20000
              <br/>
              <span style={{color: '#ffb74d'}}>숯돌 종류: 1-2T 하급 | 3-4T 중급 | 5-7T 상급</span>
            </div>

            {/* 선택된 아이템 요약 */}
            {disassembleSelection.length > 0 && (
              <div style={{marginBottom: '15px', padding: '10px', backgroundColor: '#3e2723', borderRadius: '8px', fontSize: '0.85rem'}}>
                <span style={{fontWeight: 'bold'}}>선택: {disassembleSelection.length}개</span>
                <span style={{marginLeft: '10px', color: '#ffab91'}}>(분해 버튼을 눌러 결과를 확인하세요)</span>
              </div>
            )}

            {/* 분해 가능 아이템 목록 */}
            <div style={{marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #333', borderRadius: '5px', padding: '10px', backgroundColor: '#1a1a1a'}}>
              {inventory
                .filter(item => !item.isStackable)
                .map(item => {
                  const isSelected = !!disassembleSelection.find(d => d.id === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleDisassembleItem(item)}
                      style={{
                        ...itemCard,
                        backgroundColor: getGradeColor(item.grade),
                        cursor: 'pointer',
                        marginBottom: '8px',
                        padding: '10px',
                        border: isSelected ? '3px solid #ffab91' : '1px solid #555',
                        boxShadow: isSelected ? '0 0 8px rgba(255, 171, 145, 0.5)' : 'none'
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>
                            {item.skill === 'SR' && <span style={{color: '#ff6b00'}}>⭐ </span>}
                            {item.name} {item.enhance > 0 ? `+${item.enhance}` : ''} ({item.grade})
                          </div>
                          <div style={{fontSize: '0.75rem', color: '#aaa'}}>
                            공격: {item.attack} | 추가공격력: {formatBonusAttack(item)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
              {inventory.filter(item => !item.isStackable).length === 0 && (
                <div style={{padding: '30px', textAlign: 'center', color: '#666'}}>
                  분해 가능한 아이템이 없습니다
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={executeDisassemble}
                disabled={disassembleSelection.length === 0}
                style={{
                  ...btnStyle,
                  backgroundColor: disassembleSelection.length > 0 ? '#5d4037' : '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: disassembleSelection.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                분해 ({disassembleSelection.length}개)
              </button>
              <button
                onClick={() => { setIsDisassembleMode(false); setDisassembleSelection([]); }}
                style={{
                  ...btnStyle,
                  backgroundColor: '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 분해 결과 팝업 */}
      {disassembleResult && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, minWidth: '500px', border: '2px solid #a1887f'}}>
            <h3 style={{ color: '#a1887f', marginTop: 0 }}>🔨 분해 완료</h3>

            <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '15px', color: '#ffb74d'}}>
                {disassembleResult.items.length}개 아이템 분해 결과
              </div>

              {/* 분해된 아이템 목록 */}
              <div style={{marginBottom: '15px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '5px', padding: '10px', backgroundColor: '#1a1a1a'}}>
                {disassembleResult.items.map((item, idx) => (
                  <div key={idx} style={{fontSize: '0.8rem', marginBottom: '8px', paddingBottom: '8px', borderBottom: idx < disassembleResult.items.length - 1 ? '1px solid #333' : 'none'}}>
                    <div style={{fontWeight: 'bold', color: getGradeColor(item.grade)}}>
                      {item.name} {item.enhance > 0 ? `+${item.enhance}` : ''} ({item.grade})
                    </div>
                    <div style={{fontSize: '0.75rem', color: '#aaa', marginTop: '3px'}}>
                      공격: {item.attack} | 추가공격력: {formatBonusAttack(item)}
                    </div>
                  </div>
                ))}
              </div>

              {/* 획득 숯돌 */}
              <div style={{marginTop: '15px', padding: '12px', backgroundColor: '#3e2723', borderRadius: '6px'}}>
                <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#ffab91'}}>
                  획득 숯돌
                </div>
                {disassembleResult.stones.low > 0 && (
                  <div style={{fontSize: '0.85rem', marginBottom: '6px', color: '#a5d6a7'}}>
                    🔹 하급 숯돌: <span style={{fontWeight: 'bold'}}>{disassembleResult.stones.low}개</span>
                  </div>
                )}
                {disassembleResult.stones.mid > 0 && (
                  <div style={{fontSize: '0.85rem', marginBottom: '6px', color: '#90caf9'}}>
                    🔷 중급 숯돌: <span style={{fontWeight: 'bold'}}>{disassembleResult.stones.mid}개</span>
                  </div>
                )}
                {disassembleResult.stones.high > 0 && (
                  <div style={{fontSize: '0.85rem', color: '#ffab91'}}>
                    🔶 상급 숯돌: <span style={{fontWeight: 'bold'}}>{disassembleResult.stones.high}개</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={confirmDisassemble}
                style={{
                  ...btnStyle,
                  backgroundColor: '#5d4037',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                확인
              </button>
              <button
                onClick={() => setDisassembleResult(null)}
                style={{
                  ...btnStyle,
                  backgroundColor: '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 무역 모달 */}
      {isTradeMode && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, minWidth: '600px', border: isTradeMode === 'inland' ? '2px solid #ff6b00' : '2px solid #1e88e5'}}>
            <h3 style={{ color: isTradeMode === 'inland' ? '#ff6b00' : '#1e88e5', marginTop: 0 }}>
              {isTradeMode === 'inland' ? '🏜️ 내륙 무역' : '🌊 해상 무역'}
            </h3>

            <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px'}}>
              <div style={{fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px'}}>
                무역 가능한 아이템을 클릭하세요
              </div>
              <div style={{fontSize: '0.8rem', color: '#aaa'}}>
                {isTradeMode === 'inland'
                  ? '3T 희귀+ → 0강: 1코인, 3강+: 2코인'
                  : '4T 희귀+ → 0강: 1코인, 3강+: 2코인 | 5T 희귀+ → 0강: 3코인, 3강+: 5코인'}
              </div>
            </div>

            {/* 무역 가능 아이템 목록 */}
            <div style={{marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #333', borderRadius: '5px', padding: '10px', backgroundColor: '#1a1a1a'}}>
              {inventory
                .filter(item => {
                  if (isTradeMode === 'inland') return getInlandTradeValue(item) > 0;
                  if (isTradeMode === 'sea') return getSeaTradeValue(item) > 0;
                  return false;
                })
                .map(item => {
                  const coinValue = isTradeMode === 'inland' ? getInlandTradeValue(item) : getSeaTradeValue(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleTrade(item)}
                      style={{
                        ...itemCard,
                        backgroundColor: getGradeColor(item.grade),
                        cursor: 'pointer',
                        marginBottom: '8px',
                        padding: '12px',
                        border: `1px solid ${isTradeMode === 'inland' ? '#ff6b00' : '#1e88e5'}`
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>
                            {item.skill === 'SR' && <span style={{color: '#ff6b00'}}>⭐ </span>}
                            {item.name} {item.enhance > 0 ? `+${item.enhance}` : ''}
                          </div>
                          <div style={{fontSize: '0.75rem', color: '#aaa'}}>
                            등급: {item.grade} | 공격: {item.attack} | 추가공격력: {formatBonusAttack(item)} | 스킬: {item.skill}
                          </div>
                        </div>
                        <div style={{fontSize: '0.95rem', fontWeight: 'bold', color: isTradeMode === 'inland' ? '#ff6b00' : '#1e88e5'}}>
                          +{coinValue} 코인
                        </div>
                      </div>
                    </div>
                  );
                })
              }
              {inventory.filter(item => {
                if (isTradeMode === 'inland') return getInlandTradeValue(item) > 0;
                if (isTradeMode === 'sea') return getSeaTradeValue(item) > 0;
                return false;
              }).length === 0 && (
                <div style={{padding: '30px', textAlign: 'center', color: '#666'}}>
                  무역 가능한 아이템이 없습니다
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={() => setIsTradeMode(null)}
                style={{
                  ...btnStyle,
                  backgroundColor: '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// --- 스타일 정의 ---
const containerStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto' };
const rateConfigStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' };
const inputStyle: React.CSSProperties = { width: '80px', padding: '6px 8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.9rem', textAlign: 'right' };
const compactInputStyle: React.CSSProperties = { width: '60px', padding: '4px 6px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.8rem', textAlign: 'right' };
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};
const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1e1e1e',
  padding: '30px',
  borderRadius: '12px',
  border: '2px solid #ff5252',
  minWidth: '400px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
};
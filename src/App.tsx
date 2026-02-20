import { useState, useEffect, useRef } from 'react';
import { simulateAllTiers } from './enhanceSimulation';

const ORE_SLOT_OFFSETS = [-90, 0, 90];

type EcoMode = 'BM' | 'HARDCORE';

// 1. 아이템 타입 정의 (기획서 기반 필드 확장)
interface Item {
  id: number;
  name: string;
  tier: number;
  grade: '일반' | '고급' | '희귀' | '고대' | '영웅' | '유일' | '유물';
  attack: number;      // 공격력
  bonusAttack: number; // 추가 공격력
  skill: 'R' | 'SR';   // 스킬 변조
  slots: number;       // 세공 슬롯
  enhance: number;     // 강화 수치
  stackCount?: number; // 스택 가능 아이템 개수 (철광석 등)
  isStackable?: boolean; // 스택 가능 여부
  exp?: number;        // 현재 보유 경험치
  usedProtectionCount?: number; // 이 아이템에 사용된 보호제 총 개수
}

type SpawnedOre = { id: number; slot: number };

export default function App() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isUpgradeMode, setIsUpgradeMode] = useState(false);
  const [isEnhanceMode, setIsEnhanceMode] = useState(false);
  const [isTradeMode, setIsTradeMode] = useState<'inland' | 'sea' | null>(null);
  
  // 무역 코인
  const [inlandTradeCoins, setInlandTradeCoins] = useState(0);
  const [seaTradeCoins, setSeaTradeCoins] = useState(0);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);

  // 경제 모드 (BM: 보호제 모델, HARDCORE: 파괴/재료 모델)
  const [ecoMode, setEcoMode] = useState<EcoMode>('HARDCORE');
  // 숯돌 (분해로 획득)
  const [upgradeStones, setUpgradeStones] = useState({ low: 0, mid: 0, high: 0 }); // 하급, 중급, 상급
  // 세공석
  const [polishStones, setPolishStones] = useState(0);

  // 분해 모달
  const [isDisassembleMode, setIsDisassembleMode] = useState(false);
  const [disassembleSelection, setDisassembleSelection] = useState<Item[]>([]);
  const [disassembleResult, setDisassembleResult] = useState<{ items: Item[]; stones: { low: number; mid: number; high: number } } | null>(null);

  // 드랍/제작 확률 설정
  const [dropRates, setDropRates] = useState({ high: 10.0, rare: 3.0, hero: 1.0, sr: 5.0 }); // 고급, 희귀, 고대, SR 확률 (%)
  const [craftRates, setCraftRates] = useState({ high: 5.0, rare: 1.0, hero: 0.1, sr: 5.0 }); // 고급, 희귀, 고대, SR 확률 (%)
  
  // 강화 확률 설정 (각 강화 단계별 성공 확률)
  const [enhanceRates, setEnhanceRates] = useState([100, 100, 100, 85, 70, 51, 35, 30, 25]); // +1~+9강 성공 확률 (%)

  // 강화 보호제 가격 및 사용 통계
  const [protectionPrice, setProtectionPrice] = useState(100); // 보호제 1개당 가격 (원)
  const [usedProtectionCount, setUsedProtectionCount] = useState(0); // 사용된 보호제 총 개수

  // 소모된 아이템 통계
  const [consumedItems, setConsumedItems] = useState({
    '1T제작': 0, '1T드랍': 0,
    '2T제작': 0, '2T드랍': 0,
    '3T제작': 0, '3T드랍': 0,
    '4T제작': 0, '4T드랍': 0,
    '5T제작': 0, '5T드랍': 0,
    '6T제작': 0, '6T드랍': 0,
    '7T제작': 0, '7T드랍': 0,
    '1T철': 0, '2T철': 0, '3T철': 0,
    '4T철': 0, '5T철': 0, '6T철': 0, '7T철': 0
  });

  // 사냥 관련 상태
  const [huntingTier, setHuntingTier] = useState<number | null>(null);
  const [selectedHuntingTier, setSelectedHuntingTier] = useState<number>(1);
  const [battlePhase, setBattlePhase] = useState<'idle' | 'attack' | 'hit' | 'dead' | 'spawn'>('idle');
  const [killCount, setKillCount] = useState(0);
  const [spawnedOres, setSpawnedOres] = useState<SpawnedOre[]>([]);
  const huntingRef = useRef<number | null>(null);
  const oreSpawnTimeoutRef = useRef<number | null>(null);

  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 10));

  // --- 등급별 배경색 반환 (아키에이지 색상 참고) ---
  const getGradeColor = (grade: Item['grade']): string => {
    switch (grade) {
      case '일반': return '#555';       // 회색
      case '고급': return '#1b5e20';    // 초록색
      case '희귀': return '#0d47a1';    // 파란색
      case '고대': return '#4a148c';    // 보라색
      case '영웅': return '#e65100';    // 주황색
      case '유일': return '#f9a825';    // 노란색
      case '유물': return '#b71c1c';    // 빨간색
      default: return '#333';
    }
  };

  // --- 공통 로직: 강화 수치에 따른 세공슬롯 계산 ---
  const calculateSlots = (enhance: number): number => {
    if (enhance >= 9) return 4;
    if (enhance >= 7) return 3;
    if (enhance >= 5) return 2;
    if (enhance >= 3) return 1;
    return 0;
  };

  // --- 공통 로직: 공격력 계산 (티어 고정값 + 등급 보너스 + 강화 보너스) ---
  const calculateAttack = (tier: number, grade: string, enhance: number) => {
    const baseByTier: Record<number, number> = {1: 60, 2: 80, 3: 120, 4: 180, 5: 260, 6: 360, 7: 480};
    const base = baseByTier[tier] || tier * 100;
    const gradeBonusMap: Record<string, number> = {
      '고급': 20, '희귀': 40, '고대': 60, '영웅': 80, '유일': 100, '유물': 120
    };
    const gradeBonus = gradeBonusMap[grade] || 0;
    const enhancePerTier: Record<number, number> = {1: 8, 2: 10, 3: 12, 4: 14, 5: 16, 6: 18, 7: 20};
    const enhanceBonus = enhance * (enhancePerTier[tier] || 10);
    return base + gradeBonus + enhanceBonus;
  };

  const BONUS_ATTACK_RANGES: Record<number, [number, number]> = {
    1: [3, 6], 2: [4, 8], 3: [6, 12], 4: [9, 18], 5: [13, 26], 6: [18, 36], 7: [24, 48]
  };

  const rollBonusAttack = (tier: number) => {
    const [min, max] = BONUS_ATTACK_RANGES[tier] || [3, 6];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const formatBonusAttack = (item: Item) => {
    const [min, max] = BONUS_ATTACK_RANGES[item.tier] || [3, 6];
    const isMax = item.bonusAttack === max;
    return `${isMax ? '🔘' : ''}+${item.bonusAttack} (${min}~${max})`;
  };

  // --- 철광석 헬퍼 함수 ---
  const getOreCount = (tier: number) => {
    const ores = inventory.filter(item => item.name === `${tier}T 철광석`);
    return ores.reduce((sum, ore) => sum + (ore.stackCount || 0), 0);
  };

  const addOreToInventory = (tier: number, amount: number) => {
    const oreName = `${tier}T 철광석`;
    setInventory(prev => {
      let updated = [...prev];
      let remaining = amount;
      for (let i = 0; i < updated.length && remaining > 0; i++) {
        if (updated[i].name === oreName && (updated[i].stackCount || 0) < 100) {
          const cur = updated[i].stackCount || 0;
          const canAdd = Math.min(100 - cur, remaining);
          updated[i] = { ...updated[i], stackCount: cur + canAdd };
          remaining -= canAdd;
        }
      }
      let loopCount = 0;
      while (remaining > 0 && updated.length < 300 && loopCount < 1000) {
        loopCount++;
        const stackAmount = Math.min(remaining, 100);
        updated.push({
          id: Date.now() + Math.random() * 1000000 + loopCount,
          name: oreName, tier, grade: '일반' as const, attack: 0, bonusAttack: 0,
          skill: 'R' as const, slots: 0, enhance: 0, stackCount: stackAmount, isStackable: true
        });
        remaining -= stackAmount;
      }
      if (remaining > 0) setTimeout(() => alert(`인벤토리가 가득 찼습니다! (300/300)`), 0);
      if (amount - remaining > 0) setTimeout(() => addLog(`[채집] ${tier}T 철광석 +${amount - remaining}`), 0);
      return updated;
    });
  };

  const consumeOre = (tier: number, amount: number): boolean => {
    const oreName = `${tier}T 철광석`;
    const totalOres = getOreCount(tier);

    if (totalOres < amount) {
      return false;
    }

    // 소모된 철광석 통계 업데이트
    const oreKey = `${tier}T철` as keyof typeof consumedItems;
    if (oreKey in consumedItems) {
      setConsumedItems(prev => ({ ...prev, [oreKey]: prev[oreKey] + amount }));
    }

    setInventory(prev => {
      let remainingToConsume = amount;
      const updated: Item[] = [];

      for (const item of prev) {
        if (item.name === oreName && remainingToConsume > 0) {
          const currentCount = item.stackCount || 0;

          if (currentCount <= remainingToConsume) {
            // 이 스택 전체를 소비
            remainingToConsume -= currentCount;
            // 아이템을 추가하지 않음 (삭제)
          } else {
            // 일부만 소비
            updated.push({ ...item, stackCount: currentCount - remainingToConsume });
            remainingToConsume = 0;
          }
        } else {
          updated.push(item);
        }
      }

      return updated;
    });

    return true;
  };

  // --- 티어별 최대 등급 반환 ---
  const getMaxGradeForTier = (tier: number): '일반' | '고급' | '희귀' | '고대' | '영웅' | '유일' | '유물' => {
    if (tier === 1) return '고급';
    if (tier === 2) return '희귀';
    if (tier === 3) return '고대';
    if (tier === 4) return '영웅';
    if (tier === 5) return '유일';
    if (tier === 6) return '유물';
    if (tier === 7) return '유물';
    return '일반';
  };

  // --- 등급 결정 함수 (최대 등급 고려) ---
  const determineGrade = (rareRate: number, highRate: number, heroRate: number = 0, maxGrade: string = '희귀', minGrade: string = '일반'): '일반' | '고급' | '희귀' | '고대' | '영웅' | '유일' | '유물' => {
    const roll = Math.random() * 100;

    // 최소 등급 처리
    if (minGrade === '고대') {
      // 6T, 7T 제작: 고대 이상
      if (maxGrade === '유일') {
        if (roll < heroRate) return '유일';
        return '고대';
      } else if (maxGrade === '유물') {
        if (roll < heroRate) return '유물';
        return '고대';
      }
      return '고대';
    }

    if (minGrade === '희귀') {
      // 4T, 5T 제작: 희귀 이상
      if (maxGrade === '고대') {
        if (roll < heroRate) return '고대';
        return '희귀';
      } else if (maxGrade === '영웅') {
        if (roll < heroRate) return '영웅';
        return '희귀';
      }
      return '희귀';
    }

    if (minGrade === '고급') {
      // 3T, 4T 제작: 고급 이상
      if (maxGrade === '고대') {
        if (roll < heroRate) return '고대';
        if (roll < heroRate + rareRate) return '희귀';
        return '고급';
      } else if (maxGrade === '희귀') {
        if (roll < rareRate) return '희귀';
        return '고급';
      }
      return '고급';
    }

    // 최대 등급을 고려하여 확률 조정
    if (maxGrade === '희귀') {
      if (roll < rareRate) return '희귀';
      if (roll < rareRate + highRate) return '고급';
      return '일반';
    } else if (maxGrade === '고급') {
      if (roll < highRate) return '고급';
      return '일반';
    } else if (maxGrade === '영웅') {
      if (roll < heroRate) return '영웅';
      if (roll < heroRate + rareRate) return '희귀';
      if (roll < heroRate + rareRate + highRate) return '고급';
      return '일반';
    } else if (maxGrade === '고대') {
      if (roll < heroRate) return '고대';
      if (roll < heroRate + rareRate) return '희귀';
      if (roll < heroRate + rareRate + highRate) return '고급';
      return '일반';
    } else if (maxGrade === '유일') {
      if (roll < heroRate) return '유일';
      if (roll < heroRate + rareRate) return '희귀';
      if (roll < heroRate + rareRate + highRate) return '고급';
      return '일반';
    } else if (maxGrade === '유물') {
      if (roll < heroRate) return '유물';
      if (roll < heroRate + rareRate) return '희귀';
      if (roll < heroRate + rareRate + highRate) return '고급';
      return '일반';
    }
    return '일반';
  };

  // --- 사냥 시스템 (방치형 전투 사이클) ---
  const startHunting = (tier: number) => {
    setSelectedHuntingTier(tier);
    setHuntingTier(tier);
    setBattlePhase('idle');
    setKillCount(0);
    setSpawnedOres([]);
  };

  const stopHunting = () => {
    setHuntingTier(null);
    setBattlePhase('idle');
    setSpawnedOres([]);
    if (oreSpawnTimeoutRef.current) {
      clearTimeout(oreSpawnTimeoutRef.current);
      oreSpawnTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (huntingTier === null) {
      if (huntingRef.current) { clearInterval(huntingRef.current); huntingRef.current = null; }
      return;
    }

    // 4초 사이클: idle(0~1s) → attack(1~1.8s) → hit(1.8~2.5s) → dead(2.5~3.5s) → spawn(3.5~4s) → 반복
    let phaseTimer: number;
    const runCycle = () => {
      setBattlePhase('attack');
      phaseTimer = window.setTimeout(() => {
        setBattlePhase('hit');
        phaseTimer = window.setTimeout(() => {
          setBattlePhase('dead');
          // 처치 판정
          setKillCount(prev => prev + 1);
          // 드랍 판정: 1% 확률로 드랍템
          if (Math.random() < 0.01) {
            // handleDrop은 alert를 쓰므로 직접 드랍 로직 수행
            setInventory(prev => {
              if (prev.length >= 300) return prev;
              const GRADE_ORDER: Item['grade'][] = ['일반', '고급', '희귀', '고대', '영웅', '유일', '유물'];
              const tierMax = getMaxGradeForTier(huntingTier);
              const dropCap: Item['grade'] = '고대';
              const maxGrade = GRADE_ORDER.indexOf(tierMax) <= GRADE_ORDER.indexOf(dropCap) ? tierMax : dropCap;
              const grade = determineGrade(dropRates.rare, dropRates.high, dropRates.hero, maxGrade) as Item['grade'];
              const isSR = huntingTier >= 3 && Math.random() < (dropRates.sr / 100);
              const newItem: Item = {
                id: Date.now() + Math.random(),
                name: `${huntingTier}T 드랍템`,
                tier: huntingTier,
                grade,
                attack: calculateAttack(huntingTier, grade, 0),
                bonusAttack: rollBonusAttack(huntingTier),
                skill: isSR ? 'SR' : 'R',
                slots: 0,
                enhance: 0
              };
              setTimeout(() => addLog(`[사냥] ${huntingTier}T 드랍템(${grade}) 획득!`), 0);
              return [...prev, newItem];
            });
          }
          setTimeout(() => addLog(`[사냥] ${huntingTier}T 몬스터 처치!`), 0);

          phaseTimer = window.setTimeout(() => {
            setBattlePhase('spawn');
            phaseTimer = window.setTimeout(() => {
              setBattlePhase('idle');
            }, 500);
          }, 1000);
        }, 700);
      }, 800);
    };

    // 첫 사이클 바로 시작
    const cycleDelay = setTimeout(() => runCycle(), 1000);
    huntingRef.current = window.setInterval(runCycle, 4000);

    return () => {
      clearTimeout(cycleDelay);
      clearTimeout(phaseTimer);
      if (huntingRef.current) { clearInterval(huntingRef.current); huntingRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntingTier]);

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
    const GRADE_ORDER: Item['grade'][] = ['일반', '고급', '희귀', '고대', '영웅', '유일', '유물'];
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
    addLog(`[드랍] ${tier}T ${grade}${isSR ? ' SR' : ''} 획득`);
  };

  // --- 2. 제작 로직 (티어별 상이한 공식 적용) ---
  const handleCraft = (tier: number) => {
    if (inventory.length >= 300) {
      alert('인벤토리가 가득 찼습니다! (300/300)');
      return;
    }

    if (tier === 1) {
      if (getOreCount(1) < 10) {
        alert("1T 철광석 10개가 필요합니다.");
        return;
      }
      if (!consumeOre(1, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(1)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100); // SR 확률 적용
      const newItem: Item = {
        id: Date.now(),
        name: '1T 제작템',
        tier: 1,
        grade,
        attack: calculateAttack(1, grade, 0),
        bonusAttack: rollBonusAttack(1),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      };
      setInventory(prev => [...prev, newItem]);
      addLog(`[제작] 1T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 2) {

      if (getOreCount(2) < 10) {
        alert("재료 부족! (2T 철광석 10)");
        return;
      }
      if (!consumeOre(2, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(2)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100); // SR 확률 적용
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '2T 제작템',
        tier: 2,
        grade,
        attack: calculateAttack(2, grade, 0),
        bonusAttack: rollBonusAttack(2),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 2T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 3) {
      if (getOreCount(3) < 10) {
        alert("재료 부족! (3T 철광석 10)");
        return;
      }
      if (!consumeOre(3, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(3), '고급') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100); // SR 확률 적용
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '3T 제작템',
        tier: 3,
        grade,
        attack: calculateAttack(3, grade, 0),
        bonusAttack: rollBonusAttack(3),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 3T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 4) {
      if (getOreCount(4) < 10) {
        alert("재료 부족! (4T 철광석 10)");
        return;
      }
      if (!consumeOre(4, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(4), '고급') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '4T 제작템',
        tier: 4,
        grade,
        attack: calculateAttack(4, grade, 0),
        bonusAttack: rollBonusAttack(4),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 4T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 5) {
      if (getOreCount(5) < 10) {
        alert("재료 부족! (5T 철광석 10)");
        return;
      }
      if (!consumeOre(5, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(5), '희귀') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '5T 제작템',
        tier: 5,
        grade,
        attack: calculateAttack(5, grade, 0),
        bonusAttack: rollBonusAttack(5),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 5T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 6) {
      if (getOreCount(6) < 10) {
        alert("재료 부족! (6T 철광석 10)");
        return;
      }
      if (!consumeOre(6, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(6), '희귀') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '6T 제작템',
        tier: 6,
        grade,
        attack: calculateAttack(6, grade, 0),
        bonusAttack: rollBonusAttack(6),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 6T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 7) {
      if (getOreCount(7) < 10) {
        alert("재료 부족! (7T 철광석 10)");
        return;
      }
      if (!consumeOre(7, 10)) return;

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(7), '고대') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => [...prev, {
        id: Date.now(),
        name: '7T 제작템',
        tier: 7,
        grade,
        attack: calculateAttack(7, grade, 0),
        bonusAttack: rollBonusAttack(7),
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      }]);
      addLog(`[제작] 7T ${grade}${isSR ? ' SR' : ''} 획득`);
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

  // --- 무역 적격성/보상 계산 헬퍼 ---
  const gradeIndex = (g: string) => ['일반','고급','희귀','고대','영웅','유일','유물'].indexOf(g);

  const getInlandTradeValue = (item: Item): number => {
    // 내륙무역: 3T 희귀 이상만
    if (item.isStackable || item.tier !== 3 || gradeIndex(item.grade) < gradeIndex('희귀')) return 0;
    return item.enhance >= 3 ? 2 : 1;
  };

  const getSeaTradeValue = (item: Item): number => {
    // 해상무역: 4T 희귀+ (0강=1, 3강+=2), 5T 희귀+ (0강=3, 3강+=5)
    if (item.isStackable) return 0;
    if (item.tier === 4 && gradeIndex(item.grade) >= gradeIndex('희귀')) {
      return item.enhance >= 3 ? 2 : 1;
    }
    if (item.tier === 5 && gradeIndex(item.grade) >= gradeIndex('희귀')) {
      return item.enhance >= 3 ? 5 : 3;
    }
    return 0;
  };

  // --- 4-4. 무역 실행 ---
  const handleTrade = (item: Item) => {
    if (!isTradeMode) return;

    const tradeValue = isTradeMode === 'inland' ? getInlandTradeValue(item) : getSeaTradeValue(item);

    if (tradeValue === 0) {
      alert('이 아이템은 무역할 수 없습니다!');
      return;
    }

    // 아이템 제거 및 코인 추가
    setInventory(prev => prev.filter(i => i.id !== item.id));

    if (isTradeMode === 'inland') {
      setInlandTradeCoins(prev => prev + tradeValue);
      addLog(`[내륙무역] ${item.name} ${item.grade} +${item.enhance}강 → 내륙코인 +${tradeValue}`);
    } else {
      setSeaTradeCoins(prev => prev + tradeValue);
      addLog(`[해상무역] ${item.name} ${item.grade} +${item.enhance}강 → 해상코인 +${tradeValue}`);
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

    // 강화 주문서는 무제한으로 가정 (재료 아이템 불필요)
    const successRate = enhanceRates[currentEnhance];
    const isSuccess = Math.random() * 100 < successRate;

    if (ecoMode === 'BM') {
      // === BM 모델: 보호제 사용 여부에 따른 처리 ===
      let protectionCount = 0;
      if (useProtection) {
        const tierCostRates: Record<number, number> = {3: 1.0, 4: 0.5, 5: 0.25, 6: 0.125, 7: 0.06};
        const costUnit = tierCostRates[selectedItem.tier] || 1.0;
        const failRate = 100 - successRate;
        protectionCount = Math.ceil(failRate / costUnit);
        setUsedProtectionCount(prev => prev + protectionCount);
      }

      setInventory(prev => {
        let updated = [...prev];
        if (isSuccess) {
          const newEnhance = currentEnhance + 1;
          updated = updated.map(item =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  enhance: newEnhance,
                  attack: calculateAttack(item.tier, item.grade, newEnhance),
                  slots: calculateSlots(newEnhance),
                  usedProtectionCount: (item.usedProtectionCount || 0) + protectionCount
                }
              : item
          );
          addLog(`[강화 성공] ${selectedItem.name} +${newEnhance}강 달성!`);
        } else {
          if (useProtection) {
            updated = updated.map(item =>
              item.id === selectedItem.id
                ? { ...item, usedProtectionCount: (item.usedProtectionCount || 0) + protectionCount }
                : item
            );
            addLog(`[강화 실패] ${selectedItem.name} +${currentEnhance}강 유지 (보호제 사용)`);
          } else {
            const itemKey = selectedItem.name.includes('제작') ? `${selectedItem.tier}T제작` as keyof typeof consumedItems : `${selectedItem.tier}T드랍` as keyof typeof consumedItems;
            if (itemKey in consumedItems) {
              setConsumedItems(prev => ({ ...prev, [itemKey]: prev[itemKey] + 1 }));
            }
            updated = updated.filter(item => item.id !== selectedItem.id);
            addLog(`[강화 실패] ${selectedItem.name} +${currentEnhance}강 파괴됨!`);
            setSelectedItem(null);
            setIsEnhanceMode(false);
          }
        }
        return updated;
      });

      // 선택 아이템 업데이트 (BM)
      if (isSuccess) {
        setSelectedItem(prev => {
          if (!prev) return null;
          const newEnh = prev.enhance + 1;
          return {
            ...prev,
            enhance: newEnh,
            attack: calculateAttack(prev.tier, prev.grade, newEnh),
            slots: calculateSlots(newEnh),
            usedProtectionCount: (prev.usedProtectionCount || 0) + protectionCount
          };
        });
      } else if (useProtection) {
        setSelectedItem(prev => prev ? {
          ...prev,
          usedProtectionCount: (prev.usedProtectionCount || 0) + protectionCount
        } : null);
      }

    } else {
      // === HARDCORE 모델: 무조건 파괴 + 재료 지급 ===
      if (isSuccess) {
        const newEnhance = currentEnhance + 1;
        setInventory(prev => prev.map(item =>
          item.id === selectedItem.id
            ? {
                ...item,
                enhance: newEnhance,
                attack: calculateAttack(item.tier, item.grade, newEnhance),
                slots: calculateSlots(newEnhance)
              }
            : item
        ));
        addLog(`[강화 성공] ${selectedItem.name} +${newEnhance}강 달성!`);
        setSelectedItem(prev => {
          if (!prev) return null;
          const newEnh = prev.enhance + 1;
          return {
            ...prev,
            enhance: newEnh,
            attack: calculateAttack(prev.tier, prev.grade, newEnh),
            slots: calculateSlots(newEnh)
          };
        });
      } else {
        // 실패: 무조건 파괴 + 숯돌 반환 (분해와 동일)
        const stones = getDisassembleStones(selectedItem.tier, selectedItem.grade);
        const itemKey = selectedItem.name.includes('제작') ? `${selectedItem.tier}T제작` as keyof typeof consumedItems : `${selectedItem.tier}T드랍` as keyof typeof consumedItems;
        if (itemKey in consumedItems) {
          setConsumedItems(prev => ({ ...prev, [itemKey]: prev[itemKey] + 1 }));
        }
        setInventory(prev => prev.filter(item => item.id !== selectedItem.id));
        setUpgradeStones(prev => ({ ...prev, [stones.type]: prev[stones.type] + stones.amount }));
        addLog(`[강화 실패] ${selectedItem.name} +${currentEnhance}강 파괴됨! ${stones.label} 획득`);
        setSelectedItem(null);
        setIsEnhanceMode(false);
      }
    }
  };

  // --- 분해 로직 (등급 기반 범위) ---
  const getDisassembleStones = (tier: number, grade?: string): { type: 'low' | 'mid' | 'high'; amount: number; label: string } => {
    // 티어별 숯돌 종류: 1-2T=하급, 3-4T=중급, 5-7T=상급
    const stoneType: 'low' | 'mid' | 'high' = tier <= 2 ? 'low' : tier <= 4 ? 'mid' : 'high';

    // 등급별 분해 획득 범위
    const gradeRanges: Record<string, [number, number]> = {
      '일반': [2, 4], '고급': [4, 8], '희귀': [20, 40], '고대': [100, 200],
      '영웅': [500, 1000], '유일': [2500, 5000], '유물': [12500, 20000]
    };

    const [min, max] = gradeRanges[grade || '일반'] || [2, 4];
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    const stoneTypeLabel = stoneType === 'low' ? '하급숯돌' : stoneType === 'mid' ? '중급숯돌' : '상급숯돌';

    return { type: stoneType, amount, label: `${stoneTypeLabel} ${amount}` };
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

  // --- 승급 비용 계산 (숯돌 기반, 티어에 따라 숯돌 종류 결정) ---
  const getUpgradeCost = (grade: string, tier: number): { type: 'low' | 'mid' | 'high'; amount: number; label: string } | null => {
    // 티어별 숯돌 종류: 1-2T=하급, 3-4T=중급, 5-7T=상급
    const stoneType: 'low' | 'mid' | 'high' = tier <= 2 ? 'low' : tier <= 4 ? 'mid' : 'high';
    const stoneLabel = stoneType === 'low' ? '하급 숯돌' : stoneType === 'mid' ? '중급 숯돌' : '상급 숯돌';

    // 등급별 필요 수량
    const upgradeCosts: Record<string, number> = {
      '일반': 10, '고급': 20, '희귀': 100, '고대': 500, '영웅': 2500, '유일': 12500
    };
    const amount = upgradeCosts[grade];
    if (amount === undefined) return null;
    return { type: stoneType, amount, label: `${stoneLabel} ${amount}` };
  };

  const getNextGrade = (grade: string): Item['grade'] | null => {
    const grades: Item['grade'][] = ['일반', '고급', '희귀', '고대', '영웅', '유일', '유물'];
    const idx = grades.indexOf(grade as Item['grade']);
    if (idx < 0 || idx >= grades.length - 1) return null;
    return grades[idx + 1];
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

  // --- 도트풍 픽셀아트 (box-shadow 기반) ---
  const PIXEL = 4; // 1픽셀 크기
  const pixelArt = (pixels: [number, number, string][]) => ({
    width: PIXEL, height: PIXEL,
    boxShadow: pixels.map(([x, y, c]) => `${x * PIXEL}px ${y * PIXEL}px 0 ${c}`).join(','),
    position: 'absolute' as const, top: 0, left: 0
  });

  // 검사 캐릭터 (12x16)
  const heroPixels: [number, number, string][] = [
    // 머리 (갈색 머리카락)
    [4,0,'#8B4513'],[5,0,'#8B4513'],[6,0,'#8B4513'],[7,0,'#8B4513'],
    [3,1,'#8B4513'],[4,1,'#8B4513'],[5,1,'#8B4513'],[6,1,'#8B4513'],[7,1,'#8B4513'],[8,1,'#8B4513'],
    // 얼굴 (피부)
    [4,2,'#FDBCB4'],[5,2,'#FDBCB4'],[6,2,'#FDBCB4'],[7,2,'#FDBCB4'],
    [4,3,'#FDBCB4'],[5,3,'#222'],[6,3,'#FDBCB4'],[7,3,'#222'], // 눈
    [4,4,'#FDBCB4'],[5,4,'#FDBCB4'],[6,4,'#FDBCB4'],[7,4,'#FDBCB4'],
    // 갑옷 (파란색)
    [3,5,'#1565C0'],[4,5,'#1565C0'],[5,5,'#1565C0'],[6,5,'#1565C0'],[7,5,'#1565C0'],[8,5,'#1565C0'],
    [2,6,'#1565C0'],[3,6,'#1565C0'],[4,6,'#42A5F5'],[5,6,'#42A5F5'],[6,6,'#42A5F5'],[7,6,'#42A5F5'],[8,6,'#1565C0'],[9,6,'#1565C0'],
    [2,7,'#FDBCB4'],[3,7,'#1565C0'],[4,7,'#42A5F5'],[5,7,'#FFD700'],[6,7,'#42A5F5'],[7,7,'#42A5F5'],[8,7,'#1565C0'],[9,7,'#FDBCB4'],
    [2,8,'#FDBCB4'],[3,8,'#1565C0'],[4,8,'#42A5F5'],[5,8,'#42A5F5'],[6,8,'#42A5F5'],[7,8,'#42A5F5'],[8,8,'#1565C0'],[9,8,'#FDBCB4'],
    // 벨트
    [4,9,'#8B4513'],[5,9,'#FFD700'],[6,9,'#FFD700'],[7,9,'#8B4513'],
    // 다리 (진한 파랑)
    [4,10,'#0D47A1'],[5,10,'#0D47A1'],[6,10,'#0D47A1'],[7,10,'#0D47A1'],
    [4,11,'#0D47A1'],[5,11,'#0D47A1'],[6,11,'#0D47A1'],[7,11,'#0D47A1'],
    [4,12,'#0D47A1'],[5,12,'#0D47A1'],[6,12,'#0D47A1'],[7,12,'#0D47A1'],
    // 부츠 (갈색)
    [3,13,'#5D4037'],[4,13,'#5D4037'],[5,13,'#5D4037'],[6,13,'#5D4037'],[7,13,'#5D4037'],[8,13,'#5D4037'],
    // 칼 (오른쪽)
    [10,3,'#B0BEC5'],[10,4,'#B0BEC5'],[10,5,'#B0BEC5'],[10,6,'#B0BEC5'],[10,7,'#8B4513'],[10,8,'#8B4513'],
  ];

  // 슬라임 몬스터 (10x8)
  const slimePixels: [number, number, string][] = [
    [3,0,'#4CAF50'],[4,0,'#4CAF50'],[5,0,'#4CAF50'],[6,0,'#4CAF50'],
    [2,1,'#4CAF50'],[3,1,'#66BB6A'],[4,1,'#66BB6A'],[5,1,'#66BB6A'],[6,1,'#66BB6A'],[7,1,'#4CAF50'],
    [1,2,'#4CAF50'],[2,2,'#66BB6A'],[3,2,'#66BB6A'],[4,2,'#66BB6A'],[5,2,'#66BB6A'],[6,2,'#66BB6A'],[7,2,'#66BB6A'],[8,2,'#4CAF50'],
    [1,3,'#4CAF50'],[2,3,'#66BB6A'],[3,3,'#222'],[4,3,'#66BB6A'],[5,3,'#66BB6A'],[6,3,'#222'],[7,3,'#66BB6A'],[8,3,'#4CAF50'],
    [1,4,'#388E3C'],[2,4,'#4CAF50'],[3,4,'#4CAF50'],[4,4,'#4CAF50'],[5,4,'#4CAF50'],[6,4,'#4CAF50'],[7,4,'#4CAF50'],[8,4,'#388E3C'],
    [1,5,'#388E3C'],[2,5,'#388E3C'],[3,5,'#4CAF50'],[4,5,'#4CAF50'],[5,5,'#4CAF50'],[6,5,'#4CAF50'],[7,5,'#388E3C'],[8,5,'#388E3C'],
    [2,6,'#2E7D32'],[3,6,'#388E3C'],[4,6,'#388E3C'],[5,6,'#388E3C'],[6,6,'#388E3C'],[7,6,'#2E7D32'],
    [3,7,'#2E7D32'],[4,7,'#2E7D32'],[5,7,'#2E7D32'],[6,7,'#2E7D32'],
  ];

  const isHunting = huntingTier !== null;
  const displayHuntingTier = huntingTier ?? selectedHuntingTier;

  return (
    <div style={containerStyle}>
      {/* CSS 애니메이션 keyframes */}
      <style>{`
        @keyframes attackSwing {
          0% { transform: translateX(0); }
          40% { transform: translateX(80px); }
          60% { transform: translateX(80px) rotate(-15deg); }
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
      `}</style>
      <h2 style={{ color: '#ffd700', margin: '0 0 20px 0' }}>Project X7 Dev Simulator</h2>

      {/* 확률 설정 */}
      <div style={rateConfigStyle}>
        <div style={{display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap'}}>
          {/* 드랍템 확률 */}
          <div>
            <h4 style={{margin: '0 0 10px 0', color: '#81c784'}}>📦 드랍템 확률</h4>
            <div style={{display: 'flex', gap: '15px'}}>
              <div>
                <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고급:</label>
                <input
                  type="number"
                  value={dropRates.high}
                  onChange={(e) => setDropRates({...dropRates, high: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                  step="0.01"
                  min="0"
                  max="100"
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
                />
                <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
              </div>
            </div>
            <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.85rem', color: '#ff6b00', fontWeight: 'bold'}}>
              🌟 특별궁극기(SR) 확률: {dropRates.sr.toFixed(2)}% (3T 이후부터)
            </div>
          </div>

          {/* 제작템 확률 */}
          <div>
            <h4 style={{margin: '0 0 10px 0', color: '#64b5f6'}}>🛠️ 제작템 확률</h4>
            <div style={{display: 'flex', gap: '15px'}}>
              <div>
                <label style={{fontSize: '0.85rem', marginRight: '5px'}}>고급:</label>
                <input
                  type="number"
                  value={craftRates.high}
                  onChange={(e) => setCraftRates({...craftRates, high: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}
                  step="0.01"
                  min="0"
                  max="100"
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
                />
                <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
              </div>
            </div>
            <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px', fontSize: '0.85rem', color: '#ff6b00', fontWeight: 'bold'}}>
              🌟 특별궁극기(SR) 확률: {craftRates.sr.toFixed(2)}%
            </div>
          </div>

          {/* 강화 확률 + 보호제 가격 */}
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px'}}>
              <h4 style={{margin: 0, color: '#9575cd'}}>⚔️ 강화 확률</h4>
              <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                <label style={{fontSize: '0.8rem', color: '#ffeb3b', fontWeight: 'bold'}}>🛡️ 보호제:</label>
                <input
                  type="number"
                  value={protectionPrice}
                  onChange={(e) => setProtectionPrice(Math.max(1, parseFloat(e.target.value) || 100))}
                  step="1"
                  min="1"
                  style={{...inputStyle, width: '80px'}}
                />
                <span style={{fontSize: '0.8rem'}}>원</span>
              </div>
            </div>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
              {enhanceRates.map((rate, index) => (
                <div key={index} style={{display: 'flex', alignItems: 'center'}}>
                  <label style={{fontSize: '0.85rem', marginRight: '5px'}}>+{index + 1}강:</label>
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
                    style={{...inputStyle, width: '60px'}}
                  />
                  <span style={{fontSize: '0.85rem', marginLeft: '3px'}}>%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      {/* 채집 */}
      <div style={{padding: '8px 12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px'}}>
        <span style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold'}}>⛏️ 채집</span>
        {[1,2,3,4,5,6,7].map(t => (
          <button key={t} onClick={() => addOreToInventory(t, 100)} style={actionBtn}>{t}T 철 +100</button>
        ))}
      </div>

      {/* 드랍 + 제작 */}
      <div style={{padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px'}}>
        <div style={{display: 'flex', gap: '8px'}}>
          {/* 드랍 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>📦 드랍</div>
            <button onClick={() => handleDrop(1)} style={actionBtn}>1T 드랍</button>
            <button onClick={() => handleDrop(2)} style={actionBtn}>2T 드랍</button>
            <button onClick={() => handleDrop(3)} style={actionBtn}>3T 드랍</button>
            <button onClick={() => handleDrop(4)} style={actionBtn}>4T 드랍</button>
            <button onClick={() => handleDrop(5)} style={actionBtn}>5T 드랍</button>
            <button onClick={() => handleDrop(6)} style={actionBtn}>6T 드랍</button>
          </div>
          {/* 제작 */}
          <div style={{flex: 3, display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>🛠️ 제작</div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(1)} style={{...actionBtn, flex: 1}}>1T 기본</button>
              <div style={{flex: 1}}/><div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(2)} style={{...actionBtn, flex: 1}}>2T 필드</button>
              <div style={{flex: 1}}/><div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(3)} style={{...actionBtn, flex: 1}}>3T 필드</button>
              <button onClick={() => handleCraft(3)} style={{...actionBtn, flex: 1}}>3T 코어</button>
              <div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(4)} style={{...actionBtn, flex: 1}}>4T 필드</button>
              <button onClick={() => handleCraft(4)} style={{...actionBtn, flex: 1}}>4T 코어</button>
              <div style={{flex: 1}}/>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 필드</button>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 코어</button>
              <button onClick={() => handleCraft(5)} style={{...actionBtn, flex: 1}}>5T 무역</button>
            </div>
            <div style={{display: 'flex', gap: '4px'}}>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 필드</button>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 코어</button>
              <button onClick={() => handleCraft(6)} style={{...actionBtn, flex: 1}}>6T 무역</button>
            </div>
          </div>
        </div>
      </div>

      {/* 무역 + 상태바 */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
        <div style={{padding: '8px 15px', backgroundColor: '#1e1e1e', borderRadius: '6px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px'}}>
          <span style={{fontSize: '0.8rem', fontWeight: 'bold'}}>💎 무역</span>
          <button onClick={() => startTradeMode('inland')} style={{...actionBtn, backgroundColor: '#ff6b00'}}>내륙</button>
          <button onClick={() => startTradeMode('sea')} style={{...actionBtn, backgroundColor: '#1e88e5'}}>해상</button>
        </div>
        <div style={{flex: 1, padding: '8px 15px', backgroundColor: '#252525', borderRadius: '6px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem'}}>
          <span>내륙코인: {inlandTradeCoins} · 해상코인: {seaTradeCoins} | 1T철:{getOreCount(1)} 2T철:{getOreCount(2)} 3T철:{getOreCount(3)} 4T철:{getOreCount(4)} 5T철:{getOreCount(5)} 6T철:{getOreCount(6)} 7T철:{getOreCount(7)}</span>
          <span style={{color: '#00fbff'}}>아이템: {inventory.length}/300</span>
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
        <div style={{color: '#aaa', paddingTop: '4px', borderTop: '1px solid #333'}}>
          <span style={{color: '#9575cd', fontWeight: 'bold'}}>📊 +9강</span>: 평균 {Math.floor(1 / enhanceRates.reduce((acc, rate) => acc * (rate / 100), 1)).toLocaleString()}개 | 
          {simulateAllTiers(enhanceRates).map(result => (
            <span key={result.tier} style={{marginLeft: '8px'}}>
              {result.tier}T: {result.totalProtectionItems.toLocaleString()}개
            </span>
          ))}
        </div>
      </div>

      {/* 사냥 시스템 */}
      <div style={{padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333', marginBottom: '10px'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
            <span style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#ef5350'}}>⚔️ 사냥터</span>
            <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
              <button
                onClick={() => setSelectedHuntingTier(1)}
                disabled={isHunting}
                style={{
                  ...actionBtn,
                  backgroundColor: huntingTier === 1 ? '#c62828' : (selectedHuntingTier === 1 ? '#4a2a2a' : '#3a3a3a'),
                  fontWeight: huntingTier === 1 || selectedHuntingTier === 1 ? 'bold' : 'normal',
                  border: huntingTier === 1 ? '1px solid #ef5350' : selectedHuntingTier === 1 ? '1px solid #ff7043' : '1px solid #555',
                  cursor: isHunting ? 'not-allowed' : 'pointer'
                }}
              >
                1T 사냥터
              </button>
              {[2,3,4,5,6,7].map(t => (
                <button key={t} disabled style={{...actionBtn, opacity: 0.4, cursor: 'not-allowed'}}>{t}T (준비중)</button>
              ))}
            </div>
            <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <button
                onClick={() => isHunting ? stopHunting() : startHunting(selectedHuntingTier)}
                style={{
                  ...actionBtn,
                  backgroundColor: isHunting ? '#555' : '#2e7d32',
                  fontWeight: 'bold'
                }}
              >
                {isHunting ? '사냥 중지' : '사냥 시작'}
              </button>
              <span style={{fontSize: '0.75rem', color: isHunting ? '#aaa' : '#555'}}>처치: {killCount}마리</span>
            </div>
          </div>
        </div>

        <div style={{position: 'relative', height: '120px', backgroundColor: '#0a0a1a', borderRadius: '6px', border: '1px solid #222', overflow: 'hidden'}}>
          {/* 바닥 */}
          <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: '20px', backgroundColor: '#1a3a1a', borderTop: '2px solid #2e7d32'}} />

          {/* 캐릭터 */}
          <div style={{
            position: 'absolute', bottom: '25px', left: '80px',
            animation: battlePhase === 'attack' ? 'attackSwing 0.8s ease-in-out' : battlePhase === 'idle' ? 'idleBounce 1.5s ease-in-out infinite' : 'none'
          }}>
            <div style={{position: 'relative', width: `${12 * PIXEL}px`, height: `${16 * PIXEL}px`}}>
              <div style={pixelArt(heroPixels)} />
            </div>
          </div>

          {/* 몬스터 */}
          <div style={{
            position: 'absolute', bottom: '25px', right: '80px',
            animation: battlePhase === 'hit' ? 'monsterHit 0.7s ease-in-out' :
                       battlePhase === 'dead' ? 'monsterDeath 1s ease-in forwards' :
                       battlePhase === 'spawn' ? 'monsterSpawn 0.5s ease-out' :
                       'slimeBounce 1.2s ease-in-out infinite'
          }}>
            <div style={{position: 'relative', width: `${10 * PIXEL}px`, height: `${8 * PIXEL}px`}}>
              <div style={pixelArt(slimePixels)} />
            </div>
            <div style={{textAlign: 'center', fontSize: '0.65rem', color: '#aaa', marginTop: `${8 * PIXEL + 4}px`}}>{displayHuntingTier}T 슬라임</div>
          </div>

          {/* 드랍 이펙트 */}
          {battlePhase === 'dead' && isHunting && (
            <div style={{position: 'absolute', bottom: '50px', right: '90px', animation: 'dropFloat 1s ease-out forwards', fontSize: '0.8rem', color: '#ffd700', fontWeight: 'bold'}}>
              💥
            </div>
          )}

          {/* 광물 스폰 */}
          {spawnedOres.map(ore => (
            <div
              key={ore.id}
              onClick={() => handleOreCollect(ore.id)}
              style={{
                position: 'absolute',
                bottom: '38px',
                left: `calc(50% + ${ORE_SLOT_OFFSETS[ore.slot]}px)`,
                transform: 'translateX(-50%)',
                cursor: 'pointer'
              }}
            >
              <div style={{animation: 'orePulse 1.4s ease-in-out infinite', fontSize: '1.1rem', color: '#ffe082', textShadow: '0 0 6px rgba(255, 208, 90, 0.85)'}}>
                ⛏️
              </div>
            </div>
          ))}

          {/* 안내 오버레이 */}
          {!isHunting && (
            <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(10,10,26,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '0.85rem'}}>
              사냥 시작을 눌러 전투를 시작하세요
            </div>
          )}

          {/* 사냥 정보 */}
          <div style={{position: 'absolute', top: '5px', left: '10px', fontSize: '0.7rem', color: '#666'}}>
            {isHunting ? `${huntingTier}T 사냥터 · 드랍률 1%` : `${displayHuntingTier}T 사냥터 · 대기중`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={inventoryPanel}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
            <h3 style={{margin: 0}}>인벤토리</h3>
            <div style={{display: 'flex', gap: '8px'}}>
              <button
                onClick={() => { setIsDisassembleMode(true); setDisassembleSelection([]); }}
                style={{
                  ...btnStyle,
                  backgroundColor: '#5d4037',
                  padding: '8px 15px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                🔨 분해
              </button>
              <button
                onClick={clearAllInventory}
                style={{
                  ...btnStyle,
                  backgroundColor: '#c62828',
                  padding: '8px 15px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                🗑️ 전체 삭제
              </button>
            </div>
          </div>
          {/* 숯돌 + 세공석 표시 */}
          <div style={{marginBottom: '10px', padding: '8px 10px', backgroundColor: '#2a2a2a', borderRadius: '6px', fontSize: '0.8rem'}}>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px'}}>
              <span style={{color: '#a5d6a7'}}>🔹 하급숯돌: <b>{upgradeStones.low}</b></span>
              <button onClick={() => convertToPolishStone('low')} disabled={upgradeStones.low < 100} style={{...actionBtn, fontSize: '0.7rem', padding: '2px 6px', backgroundColor: upgradeStones.low >= 100 ? '#2e7d32' : '#333', color: upgradeStones.low >= 100 ? '#fff' : '#666', cursor: upgradeStones.low >= 100 ? 'pointer' : 'not-allowed'}}>변환 (100→1)</button>
              <span style={{color: '#555'}}>|</span>
              <span style={{color: '#90caf9'}}>🔷 중급숯돌: <b>{upgradeStones.mid}</b></span>
              <button onClick={() => convertToPolishStone('mid')} disabled={upgradeStones.mid < 10} style={{...actionBtn, fontSize: '0.7rem', padding: '2px 6px', backgroundColor: upgradeStones.mid >= 10 ? '#1565c0' : '#333', color: upgradeStones.mid >= 10 ? '#fff' : '#666', cursor: upgradeStones.mid >= 10 ? 'pointer' : 'not-allowed'}}>변환 (10→1)</button>
              <span style={{color: '#555'}}>|</span>
              <span style={{color: '#ffab91'}}>🔶 상급숯돌: <b>{upgradeStones.high}</b></span>
              <button onClick={() => convertToPolishStone('high')} disabled={upgradeStones.high < 1} style={{...actionBtn, fontSize: '0.7rem', padding: '2px 6px', backgroundColor: upgradeStones.high >= 1 ? '#e65100' : '#333', color: upgradeStones.high >= 1 ? '#fff' : '#666', cursor: upgradeStones.high >= 1 ? 'pointer' : 'not-allowed'}}>변환 (1→1)</button>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #3a3a3a'}}>
              <span style={{color: '#e1bee7', fontWeight: 'bold'}}>💎 세공석: <b style={{fontSize: '1rem', color: '#ce93d8'}}>{polishStones}</b></span>
            </div>
          </div>
          <div style={itemGrid}>
            {inventory.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => handleItemClick(item)}
                style={{
                  ...itemCard,
                  backgroundColor: item.isStackable ? '#424242' : getGradeColor(item.grade),
                  cursor: 'grab',
                  border: selectedItem?.id === item.id ? '2px solid #ffd700' : '1px solid #555'
                }}
              >
                <div style={{fontSize: '0.85rem', fontWeight: 'bold', position: 'relative', paddingRight: '20px'}}>
                  {item.name}{!item.isStackable && item.enhance > 0 && <span style={{color: '#ff6b00'}}> +{item.enhance}</span>}
                  {item.skill === 'SR' && !item.isStackable && (
                    <span style={{position: 'absolute', right: '-5px', top: '-8px', fontSize: '1.2rem', fontWeight: 'bold', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00'}}>⭐</span>
                  )}
                </div>
                {item.isStackable ? (
                  <>
                    <div style={{...infoText, fontSize: '1.2rem', fontWeight: 'bold', color: '#ffd700', marginTop: '10px'}}>
                      x{item.stackCount || 0}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={infoText}>공 : {item.attack}</div>
                    <div style={infoText}>추가공격력: {formatBonusAttack(item)}</div>
                    <div style={{...infoText, color: item.skill === 'SR' ? '#ff6b00' : '#64b5f6', fontWeight: item.skill === 'SR' ? 'bold' : 'normal'}}>스킬 : {item.skill}</div>
                    {item.slots > 0 && <div style={{...infoText, color: '#ce93d8'}}>세공 : {item.slots}칸</div>}
                    <div style={{...infoText, color: '#ffd700'}}>({item.grade})</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 휴지통 영역 */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropToTrash}
            style={trashZoneStyle}
          >
            <div style={{fontSize: '2rem', marginBottom: '5px'}}>🗑️</div>
            <div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>아이템을 여기로 드래그하여 파괴</div>
          </div>

          {/* 통계 정보 */}
          <div style={{marginTop: '20px', padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333'}}>
            <h4 style={{margin: '0 0 15px 0', color: '#64b5f6'}}>📊 승급 시스템 안내</h4>
            <div style={{fontSize: '0.75rem', color: '#aaa', marginBottom: '15px', fontStyle: 'italic'}}>
              * 승급 시 해당 등급에 맞는 숯돌이 필요합니다 (티어별 숯돌 종류: 1-2T 하급, 3-4T 중급, 5-7T 상급)<br/>
              * 분해 시 아이템 등급에 따라 숯돌을 획득합니다
            </div>

            {/* 승급 필요 숯돌 테이블 */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#ffb74d'}}>🔼 승급 필요 숯돌</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>• 일반 → 고급: 숯돌 10개</div>
                <div style={{fontSize: '0.8rem'}}>• 고급 → 희귀: 숯돌 20개</div>
                <div style={{fontSize: '0.8rem'}}>• 희귀 → 고대: 숯돌 100개</div>
                <div style={{fontSize: '0.8rem'}}>• 고대 → 영웅: 숯돌 500개</div>
                <div style={{fontSize: '0.8rem'}}>• 영웅 → 유일: 숯돌 2,500개</div>
                <div style={{fontSize: '0.8rem'}}>• 유일 → 유물: 숯돌 12,500개</div>
              </div>
            </div>

            {/* 분해 시 획득 숯돌 */}
            <div style={{marginBottom: '20px', padding: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#90caf9'}}>🔨 분해 시 획득 숯돌 (등급별)</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px', fontSize: '0.8rem'}}>
                <div>• 일반: 2~4개</div>
                <div>• 고급: 4~8개</div>
                <div>• 희귀: 20~40개</div>
                <div>• 고대: 100~200개</div>
                <div>• 영웅: 500~1,000개</div>
                <div>• 유일: 2,500~5,000개</div>
                <div>• 유물: 12,500~20,000개</div>
                <div style={{color: '#aaa', marginTop: '5px'}}>* 숯돌 종류는 티어에 따라 결정 (1-2T 하급, 3-4T 중급, 5-7T 상급)</div>
              </div>
            </div>

            {/* 드랍템 통계 */}
            <div style={{marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #333'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#81c784'}}>📦 드랍템 등급 확률</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 1T 드랍: 일반 100% (최대 등급 제한)
                </div>
                <div style={{fontSize: '0.8rem'}}>
                  • 2T 드랍: 일반 {(100 - dropRates.high).toFixed(1)}% / 고급 {dropRates.high.toFixed(1)}% (최대 등급 제한)
                </div>
                <div style={{fontSize: '0.8rem'}}>
                  • 3T 드랍: 일반 {(100 - dropRates.high - dropRates.rare).toFixed(1)}% / 고급 {dropRates.high.toFixed(1)}% / 희귀 {dropRates.rare.toFixed(1)}%
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  * 2T 고급 드랍: 평균 {(1 / (dropRates.high / 100)).toFixed(1)}회 필요
                </div>
              </div>
            </div>

            {/* 제작템 확률 */}
            <div style={{marginTop: '15px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#81c784'}}>🛠️ 제작템 등급 확률</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 1T 제작: 일반 {(100 - craftRates.high - craftRates.rare - craftRates.hero).toFixed(1)}% / 고급 {craftRates.high.toFixed(1)}% / 희귀 {craftRates.rare.toFixed(1)}% / 고대 {craftRates.hero.toFixed(1)}%
                </div>
                <div style={{fontSize: '0.8rem'}}>
                  • 2T 제작: 일반 {(100 - craftRates.high).toFixed(1)}% / 고급 {craftRates.high.toFixed(1)}% (최대 등급 제한)
                </div>
                <div style={{fontSize: '0.8rem'}}>
                  • 3T 제작: 일반 {(100 - craftRates.high - craftRates.rare).toFixed(1)}% / 고급 {craftRates.high.toFixed(1)}% / 희귀 {craftRates.rare.toFixed(1)}% (최대 등급 제한)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 강화/승급 패널 */}
        {selectedItem && !isUpgradeMode && (
          <div style={upgradePanel}>
            <h3 style={{marginTop: 0, color: '#ffd700'}}>강화/승급</h3>

            {/* 선택된 아이템 정보 */}
            <div style={{...itemCard, backgroundColor: getGradeColor(selectedItem.grade), marginBottom: '15px'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                {selectedItem.name}
                {selectedItem.skill === 'SR' && !selectedItem.isStackable && (
                  <span style={{fontSize: '1.3rem', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00'}}>⭐</span>
                )}
              </div>
              <div style={infoText}>공격력: {selectedItem.attack}</div>
              <div style={infoText}>추가공격력: {formatBonusAttack(selectedItem)}</div>
              <div style={{...infoText, color: selectedItem.skill === 'SR' ? '#ff6b00' : '#64b5f6', fontWeight: selectedItem.skill === 'SR' ? 'bold' : 'normal'}}>스킬: {selectedItem.skill}</div>
              {selectedItem.slots > 0 && <div style={{...infoText, color: '#ce93d8'}}>세공: {selectedItem.slots}칸</div>}
              <div style={infoText}>강화: +{selectedItem.enhance}</div>
              <div style={{...infoText, color: '#ffd700', marginTop: '5px'}}>등급: {selectedItem.grade}</div>
              {selectedItem.grade === getMaxGradeForTier(selectedItem.tier) ? (
                <div style={{...infoText, color: '#ffb300', marginTop: '5px', fontWeight: 'bold'}}>✨ 최대 등급</div>
              ) : (
                (selectedItem.exp || 0) > 0 && (
                  <div style={{...infoText, color: '#4caf50', marginTop: '5px'}}>경험치: {selectedItem.exp || 0}</div>
                )
              )}
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <button
                style={{...btnStyle, backgroundColor: '#d32f2f', padding: '12px'}}
                onClick={startUpgradeMode}
                disabled={selectedItem.isStackable || selectedItem.grade === getMaxGradeForTier(selectedItem.tier)}
              >
                {selectedItem.grade === getMaxGradeForTier(selectedItem.tier) ? '최대 등급 도달' : '승급 시작'}
              </button>
              <button 
                style={{...btnStyle, backgroundColor: '#7b1fa2', padding: '12px'}} 
                onClick={startEnhanceMode}
                disabled={selectedItem.isStackable || selectedItem.enhance >= 9}
              >
                {selectedItem.enhance >= 9 ? '최대 강화 도달' : '강화 시작'}
              </button>
              <button style={{...btnStyle, backgroundColor: '#555', padding: '8px'}} onClick={() => setSelectedItem(null)}>
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 강화 모드 */}
        {selectedItem && isEnhanceMode && (
          <div style={upgradePanel}>
            <h3 style={{marginTop: 0, color: '#9575cd'}}>⚔️ 강화</h3>

            {/* 선택된 아이템 정보 */}
            <div style={{...itemCard, backgroundColor: getGradeColor(selectedItem.grade), marginBottom: '15px'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                {selectedItem.name}
                {selectedItem.skill === 'SR' && !selectedItem.isStackable && (
                  <span style={{fontSize: '1.3rem', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00'}}>⭐</span>
                )}
              </div>
              <div style={infoText}>공격력: {selectedItem.attack}</div>
              <div style={infoText}>추가공격력: {formatBonusAttack(selectedItem)}</div>
              <div style={{...infoText, color: selectedItem.skill === 'SR' ? '#ff6b00' : '#64b5f6', fontWeight: selectedItem.skill === 'SR' ? 'bold' : 'normal'}}>스킬: {selectedItem.skill}</div>
              <div style={{...infoText, color: '#ff6b00', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '5px'}}>현재 강화: +{selectedItem.enhance}강</div>
              <div style={{...infoText, color: '#ffd700', marginTop: '5px'}}>등급: {selectedItem.grade}</div>
            </div>

            {/* 강화 정보 */}
            <div style={{padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px', marginBottom: '15px'}}>
              <div style={{fontSize: '0.9rem', marginBottom: '10px', color: '#9575cd', fontWeight: 'bold'}}>
                +{selectedItem.enhance + 1}강 도전
                <span style={{marginLeft: '10px', fontSize: '0.75rem', color: ecoMode === 'BM' ? '#d32f2f' : '#2e7d32'}}>
                  [{ecoMode === 'BM' ? '🛡️ BM' : '🔥 HARDCORE'}]
                </span>
              </div>
              <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                • 성공 확률: <span style={{color: '#4caf50', fontWeight: 'bold'}}>{enhanceRates[selectedItem.enhance]?.toFixed(1) || 0}%</span>
              </div>
              <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                • 실패 확률: <span style={{color: '#f44336', fontWeight: 'bold'}}>{(100 - (enhanceRates[selectedItem.enhance] || 0)).toFixed(1)}%</span>
              </div>
              <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                • 필요 재료: {selectedItem.tier}T {selectedItem.name.includes('드랍') ? '드랍템' : '제작템'} 1개
              </div>
              {ecoMode === 'BM' ? (
                <>
                  <div style={{fontSize: '0.85rem', color: '#ffeb3b'}}>
                    • 이번에 보호제 사용 시: {(() => {
                      const tierCostRates: Record<number, number> = {3: 1.0, 4: 0.5, 5: 0.25, 6: 0.125, 7: 0.06};
                      const costUnit = tierCostRates[selectedItem.tier] || 1.0;
                      const failRate = 100 - (enhanceRates[selectedItem.enhance] || 0);
                      const protectionCount = Math.ceil(failRate / costUnit);
                      return `${protectionCount}개 (${(protectionCount * protectionPrice / 10000).toFixed(1)}만원)`;
                    })()}
                  </div>
                  <div style={{fontSize: '0.85rem', color: '#64dd17', marginTop: '5px'}}>
                    • 이 아이템에 총 사용된 보호제: {(selectedItem.usedProtectionCount || 0).toLocaleString()}개 ({((selectedItem.usedProtectionCount || 0) * protectionPrice / 10000).toFixed(1)}만원)
                  </div>
                </>
              ) : (
                <div style={{fontSize: '0.85rem', color: '#ff9800'}}>
                  • 실패 시 파괴 + 숯돌 반환 (분해와 동일한 숯돌 지급)
                </div>
              )}
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {ecoMode === 'BM' ? (
                <>
                  <button
                    style={{...btnStyle, backgroundColor: '#4caf50', padding: '12px', fontWeight: 'bold'}}
                    onClick={() => handleEnhance(false)}
                  >
                    보호제 없이 강화 (실패 시 파괴)
                  </button>
                  <button
                    style={{...btnStyle, backgroundColor: '#ff9800', padding: '12px', fontWeight: 'bold'}}
                    onClick={() => handleEnhance(true)}
                  >
                    보호제 사용 강화 (실패 시 유지)
                  </button>
                </>
              ) : (
                <button
                  style={{...btnStyle, backgroundColor: '#2e7d32', padding: '12px', fontWeight: 'bold'}}
                  onClick={() => handleEnhance(false)}
                >
                  🔥 강화 (실패 시 파괴 + 숯돌 획득)
                </button>
              )}
              <button style={{...btnStyle, backgroundColor: '#555', padding: '8px'}} onClick={() => setIsEnhanceMode(false)}>
                취소
              </button>
            </div>
          </div>
        )}

        <div style={logPanel}>
          <h3 style={{marginTop: 0}}>System Log</h3>
          {log.map((m, i) => <div key={i} style={{fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid #333'}}>{m}</div>)}
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
  );
}

// --- 스타일 정의 ---
const containerStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto' };
const rateConfigStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' };
const inputStyle: React.CSSProperties = { width: '80px', padding: '6px 8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '0.9rem', textAlign: 'right' };
const btnStyle = { padding: '8px', cursor: 'pointer', border: 'none', borderRadius: '4px', backgroundColor: '#444', color: '#fff', fontSize: '0.85rem' };
const actionBtn: React.CSSProperties = { padding: '6px 8px', cursor: 'pointer', border: '1px solid #555', borderRadius: '4px', backgroundColor: '#3a3a3a', color: '#e0e0e0', fontSize: '0.78rem', textAlign: 'left' };
const inventoryPanel = { flex: 2, backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '10px', minHeight: '500px' };
const upgradePanel = { flex: 2, backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '10px', minHeight: '500px', border: '2px solid #ffd700' };
const itemGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '15px' };
const itemCard = { padding: '10px', borderRadius: '5px', border: '1px solid #555', lineHeight: '1.4' };
const infoText = { fontSize: '0.75rem' };
const trashZoneStyle: React.CSSProperties = {
  marginTop: '15px',
  padding: '25px',
  backgroundColor: '#2a2a2a',
  borderRadius: '8px',
  border: '2px dashed #666',
  textAlign: 'center',
  transition: 'all 0.3s',
  cursor: 'pointer'
};
const logPanel: React.CSSProperties = { flex: 1, backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '10px', height: '500px', overflowY: 'auto' };
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
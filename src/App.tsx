import { useState } from 'react';
import { simulateAllTiers } from './enhanceSimulation';

// 1. 아이템 타입 정의 (기획서 기반 필드 확장)
interface Item {
  id: number;
  name: string;
  tier: number;
  grade: '일반' | '고급' | '희귀' | '고대' | '영웅' | '유일' | '유물';
  attack: number;      // 공격력
  attackSpeed: number; // 공속
  skill: 'R' | 'SR';   // 스킬 변조
  slots: number;       // 세공 슬롯
  enhance: number;     // 강화 수치
  stackCount?: number; // 스택 가능 아이템 개수 (철광석 등)
  isStackable?: boolean; // 스택 가능 여부
  exp?: number;        // 현재 보유 경험치
  inlandTradeValue?: number; // 내륙 무역 코인 값
  seaTradeValue?: number;    // 해상 무역 코인 값
  usedProtectionCount?: number; // 이 아이템에 사용된 보호제 총 개수
}

export default function App() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isUpgradeMode, setIsUpgradeMode] = useState(false);
  const [isEnhanceMode, setIsEnhanceMode] = useState(false);
  const [isTradeMode, setIsTradeMode] = useState<'inland' | 'sea' | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Item[]>([]);
  
  // 무역 코인
  const [inlandTradeCoins, setInlandTradeCoins] = useState(0);
  const [seaTradeCoins, setSeaTradeCoins] = useState(0);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Item | null>(null);

  // 드랍/제작 확률 설정
  const [dropRates, setDropRates] = useState({ high: 5.0, rare: 1.0, hero: 0.1, sr: 5.0 }); // 고급, 희귀, 고대, SR 확률 (%)
  const [craftRates, setCraftRates] = useState({ high: 5.0, rare: 1.0, hero: 0.1, sr: 5.0 }); // 고급, 희귀, 고대, SR 확률 (%)
  
  // 강화 확률 설정 (각 강화 단계별 성공 확률)
  const [enhanceRates, setEnhanceRates] = useState([100, 90, 80, 70, 51, 35, 25, 15, 8]); // +1~+9강 성공 확률 (%)

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
    const base = tier * 100;
    const gradeBonus = grade === '고급' ? 10 : grade === '희귀' ? 20 : 0;
    const enhanceBonus = enhance * 10;
    return base + gradeBonus + enhanceBonus;
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
      let remainingAmount = amount;
      let addedCount = 0;

      // 1단계: 기존 철광석 중 100 미만인 것을 찾아서 채우기
      for (let i = 0; i < updated.length && remainingAmount > 0; i++) {
        if (updated[i].name === oreName && (updated[i].stackCount || 0) < 100) {
          const currentCount = updated[i].stackCount || 0;
          const canAdd = Math.min(100 - currentCount, remainingAmount);

          updated[i] = { ...updated[i], stackCount: currentCount + canAdd };
          remainingAmount -= canAdd;
          addedCount += canAdd;
        }
      }

      // 2단계: 남은 양을 새로운 칸에 추가
      let loopCount = 0;
      while (remainingAmount > 0 && loopCount < 1000) {
        loopCount++;

        if (updated.length >= 300) {
          const finalAdded = amount - remainingAmount;
          setTimeout(() => {
            alert(`인벤토리가 가득 찼습니다! (300/300)\n${finalAdded}개만 추가되었습니다.`);
          }, 0);
          break;
        }

        const stackAmount = Math.min(remainingAmount, 100);
        const newId = Date.now() + Math.random() * 1000000 + loopCount;

        updated.push({
          id: newId,
          name: oreName,
          tier,
          grade: '일반' as const,
          attack: 0,
          attackSpeed: 0,
          skill: 'R' as const,
          slots: 0,
          enhance: 0,
          stackCount: stackAmount,
          isStackable: true
        });

        remainingAmount -= stackAmount;
        addedCount += stackAmount;
      }

      // 로그 기록
      const totalAdded = amount - remainingAmount;
      if (totalAdded > 0) {
        setTimeout(() => addLog(`[채집] ${tier}T 철광석 +${totalAdded}`), 0);
      }

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
    if (tier === 1) return '일반';
    if (tier === 2) return '고급';
    if (tier === 3) return '희귀';
    if (tier === 4) return '고대';
    if (tier === 5) return '영웅';
    if (tier === 6) return '유일';
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
      // 3T 제작: 고급 이상
      if (maxGrade === '희귀') {
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

  // --- 1. 드랍 파밍 (티어별 최대 등급 고려) ---
  const handleDrop = (tier: number) => {
    if (inventory.length >= 300) {
      alert('인벤토리가 가득 찼습니다! (300/300)');
      return;
    }

    // 티어별 최대 등급을 고려하여 등급 결정
    const maxGrade = getMaxGradeForTier(tier);
    const grade = determineGrade(dropRates.rare, dropRates.high, dropRates.hero, maxGrade) as Item['grade'];
    const attackSpeed = tier === 1 ? 10 : tier === 2 ? Math.floor(Math.random() * 6) + 10 : Math.floor(Math.random() * 6) + 15; // 1T: 10, 2T: 10~15, 3T: 15~20
    const isSR = tier >= 3 && Math.random() < (dropRates.sr / 100); // 3T 이후부터 SR 확률 적용

    const newItem: Item = {
      id: Date.now() + Math.random(),
      name: `${tier}T 드랍템`,
      tier,
      grade,
      attack: calculateAttack(tier, grade, 0),
      attackSpeed,
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
        attackSpeed: 10,
        skill: isSR ? 'SR' : 'R',
        slots: 0,
        enhance: 0
      };
      setInventory(prev => [...prev, newItem]);
      addLog(`[제작] 1T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 2) {
      const t1Normal = inventory.find(i => i.tier === 1 && i.name.includes('제작') && !i.isStackable);
      const t1Drop = inventory.find(i => i.tier === 1 && i.name.includes('드랍') && !i.isStackable);
      if (!t1Normal || !t1Drop || getOreCount(2) < 10) {
        alert("재료 부족! (1T 제작1 + 1T 드랍1 + 2T 철광석 10)");
        return;
      }
      if (!consumeOre(2, 10)) return;

      // 소모된 재료 통계 업데이트
      setConsumedItems(prev => ({ ...prev, '1T제작': prev['1T제작'] + 1, '1T드랍': prev['1T드랍'] + 1 }));

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(2)) as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100); // SR 확률 적용
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t1Normal), 1);
        remaining.splice(remaining.indexOf(t1Drop), 1);
        return [...remaining, {
          id: Date.now(),
          name: '2T 제작템',
          tier: 2,
          grade,
          attack: calculateAttack(2, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 10,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0
        }];
      });
      addLog(`[제작] 2T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 3) {
      const t2DropHigh = inventory.find(i => i.tier === 2 && i.grade === '고급' && i.name.includes('드랍') && !i.isStackable);
      const t2CraftHigh = inventory.find(i => i.tier === 2 && i.grade === '고급' && i.name.includes('제작') && !i.isStackable);
      if (!t2DropHigh || !t2CraftHigh || getOreCount(3) < 10) {
        alert("재료 부족! (2T 드랍 고급1 + 2T 제작 고급1 + 3T 철광석 10)");
        return;
      }
      if (!consumeOre(3, 10)) return;

      // 소모된 재료 통계 업데이트
      setConsumedItems(prev => ({ ...prev, '2T제작': prev['2T제작'] + 1, '2T드랍': prev['2T드랍'] + 1 }));

      // 3T 제작은 고급 재료를 사용하므로 최소 등급이 고급
      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(3), '고급') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100); // SR 확률 적용
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t2DropHigh), 1);
        remaining.splice(remaining.indexOf(t2CraftHigh), 1);
        return [...remaining, {
          id: Date.now(),
          name: '3T 제작템',
          tier: 3,
          grade,
          attack: calculateAttack(3, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 15,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0,
          inlandTradeValue: 1  // 내륙 무역 코인 1개
        }];
      });
      addLog(`[제작] 3T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 4) {
      // 4T: 3T드희1 + 4T철10 + 내륙무역코인1
      const t3DropRare = inventory.find(i => i.tier === 3 && i.grade === '희귀' && i.name.includes('드랍') && !i.isStackable);
      if (!t3DropRare || getOreCount(4) < 10 || inlandTradeCoins < 1) {
        alert("재료 부족! (3T 드랍 희귀1 + 4T 철광석 10 + 내륙무역코인 1)");
        return;
      }
      if (!consumeOre(4, 10)) return;
      setInlandTradeCoins(prev => prev - 1);

      setConsumedItems(prev => ({ ...prev, '3T드랍': prev['3T드랍'] + 1 }));

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(4), '희귀') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t3DropRare), 1);
        return [...remaining, {
          id: Date.now(),
          name: '4T 제작템',
          tier: 4,
          grade,
          attack: calculateAttack(4, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 20,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0,
          inlandTradeValue: 2,
          seaTradeValue: 1
        }];
      });
      addLog(`[제작] 4T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 5) {
      // 5T: 4T드희1 + 4T제희1 + 5T철10
      const t4DropRare = inventory.find(i => i.tier === 4 && i.grade === '희귀' && i.name.includes('드랍') && !i.isStackable);
      const t4CraftRare = inventory.find(i => i.tier === 4 && i.grade === '희귀' && i.name.includes('제작') && !i.isStackable);
      if (!t4DropRare || !t4CraftRare || getOreCount(5) < 10) {
        alert("재료 부족! (4T 드랍 희귀1 + 4T 제작 희귀1 + 5T 철광석 10)");
        return;
      }
      if (!consumeOre(5, 10)) return;

      setConsumedItems(prev => ({ ...prev, '4T드랍': prev['4T드랍'] + 1, '4T제작': prev['4T제작'] + 1 }));

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(5), '희귀') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t4DropRare), 1);
        remaining.splice(remaining.indexOf(t4CraftRare), 1);
        return [...remaining, {
          id: Date.now(),
          name: '5T 제작템',
          tier: 5,
          grade,
          attack: calculateAttack(5, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 25,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0,
          seaTradeValue: 2
        }];
      });
      addLog(`[제작] 5T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 6) {
      // 6T: 5T드고1 + 6T철10 + 해상무역코인1
      const t5DropAncient = inventory.find(i => i.tier === 5 && i.grade === '고대' && i.name.includes('드랍') && !i.isStackable);
      if (!t5DropAncient || getOreCount(6) < 10 || seaTradeCoins < 1) {
        alert("재료 부족! (5T 드랍 고대1 + 6T 철광석 10 + 해상무역코인 1)");
        return;
      }
      if (!consumeOre(6, 10)) return;
      setSeaTradeCoins(prev => prev - 1);

      setConsumedItems(prev => ({ ...prev, '5T드랍': prev['5T드랍'] + 1 }));

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(6), '고대') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t5DropAncient), 1);
        return [...remaining, {
          id: Date.now(),
          name: '6T 제작템',
          tier: 6,
          grade,
          attack: calculateAttack(6, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 30,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0
        }];
      });
      addLog(`[제작] 6T ${grade}${isSR ? ' SR' : ''} 획득`);
      return;
    }
    else if (tier === 7) {
      // 7T: 6T드고1 + 6T제고1 + 7T철10
      const t6DropAncient = inventory.find(i => i.tier === 6 && i.grade === '고대' && i.name.includes('드랍') && !i.isStackable);
      const t6CraftAncient = inventory.find(i => i.tier === 6 && i.grade === '고대' && i.name.includes('제작') && !i.isStackable);
      if (!t6DropAncient || !t6CraftAncient || getOreCount(7) < 10) {
        alert("재료 부족! (6T 드랍 고대1 + 6T 제작 고대1 + 7T 철광석 10)");
        return;
      }
      if (!consumeOre(7, 10)) return;

      setConsumedItems(prev => ({ ...prev, '6T드랍': prev['6T드랍'] + 1, '6T제작': prev['6T제작'] + 1 }));

      const grade = determineGrade(craftRates.rare, craftRates.high, craftRates.hero, getMaxGradeForTier(7), '고대') as Item['grade'];
      const isSR = Math.random() < (craftRates.sr / 100);
      setInventory(prev => {
        const remaining = [...prev];
        remaining.splice(prev.indexOf(t6DropAncient), 1);
        remaining.splice(remaining.indexOf(t6CraftAncient), 1);
        return [...remaining, {
          id: Date.now(),
          name: '7T 제작템',
          tier: 7,
          grade,
          attack: calculateAttack(7, grade, 0),
          attackSpeed: Math.floor(Math.random() * 6) + 35,
          skill: isSR ? 'SR' : 'R',
          slots: 0,
          enhance: 0
        }];
      });
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
    setSelectedMaterials([]);
    addLog(`[정보] ${item.name} 선택`);
  };

  // --- 4. 승급 모드 시작 ---
  const startUpgradeMode = () => {
    setIsUpgradeMode(true);
    setIsEnhanceMode(false);
    setIsTradeMode(null);
    setSelectedMaterials([]);
  };

  // --- 4-2. 강화 모드 시작 ---
  const startEnhanceMode = () => {
    setIsEnhanceMode(true);
    setIsUpgradeMode(false);
    setIsTradeMode(null);
    setSelectedMaterials([]);
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
    
    const tradeValue = isTradeMode === 'inland' ? item.inlandTradeValue : item.seaTradeValue;
    
    if (!tradeValue || tradeValue === 0) {
      alert('이 아이템은 무역할 수 없습니다!');
      return;
    }

    // 아이템 제거 및 코인 추가
    setInventory(prev => prev.filter(i => i.id !== item.id));
    
    if (isTradeMode === 'inland') {
      setInlandTradeCoins(prev => prev + tradeValue);
      addLog(`[내륙무역] ${item.name} → 내륙무역코인 +${tradeValue}`);
    } else {
      setSeaTradeCoins(prev => prev + tradeValue);
      addLog(`[해상무역] ${item.name} → 해상무역코인 +${tradeValue}`);
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

    // 보호제 사용 시 사용량 계산 및 누적
    let protectionCount = 0;
    if (useProtection) {
      const tierCostRates: Record<number, number> = {3: 1.0, 4: 0.5, 5: 0.25, 6: 0.125, 7: 0.06};
      const costUnit = tierCostRates[selectedItem.tier] || 1.0;
      const failRate = 100 - successRate;
      protectionCount = Math.ceil(failRate / costUnit);

      setUsedProtectionCount(prev => prev + protectionCount);
    }

    // 강화 실행
    setInventory(prev => {
      let updated = [...prev];

      if (isSuccess) {
        // 성공
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
          // 보호제 사용 - 실패해도 아이템 유지
          updated = updated.map(item =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  usedProtectionCount: (item.usedProtectionCount || 0) + protectionCount
                }
              : item
          );
          addLog(`[강화 실패] ${selectedItem.name} +${currentEnhance}강 유지 (보호제 사용)`);
        } else {
          // 보호제 미사용 - 아이템 파괴
          // 소모된 아이템 통계 업데이트
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

    // 선택 아이템 업데이트
    if (selectedItem) {
      if (isSuccess) {
        // 성공 시: 강화 수치와 공격력, 세공슬롯, 보호제 카운트 업데이트
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
        // 실패 + 보호제 사용 시: 보호제 카운트만 업데이트
        setSelectedItem(prev => prev ? {
          ...prev,
          usedProtectionCount: (prev.usedProtectionCount || 0) + protectionCount
        } : null);
      }
    }
  };

  // --- 5. 재료 선택 토글 ---
  const toggleMaterial = (item: Item) => {
    if (selectedMaterials.find(m => m.id === item.id)) {
      setSelectedMaterials(prev => prev.filter(m => m.id !== item.id));
    } else {
      setSelectedMaterials(prev => [...prev, item]);
    }
  };

  // --- 6. 경험치 계산 함수 ---
  const getItemExp = (grade: string) => {
    if (grade === '일반') return 10;
    if (grade === '고급') return 16;
    if (grade === '희귀') return 56;
    return 0;
  };

  // --- 7. 승급 계산 함수 ---
  const calculateUpgradeResult = (item: Item, materials: Item[]) => {
    const currentExp = item.exp || 0;
    const materialExp = materials.reduce((sum, m) => sum + getItemExp(m.grade), 0);
    let totalExp = currentExp + materialExp;
    let currentGrade = item.grade;
    const maxGrade = getMaxGradeForTier(item.tier);

    // 일반 → 고급 승급
    if (currentGrade === '일반' && totalExp >= 10) {
      // 티어별 최대 등급 확인
      if (maxGrade === '일반') {
        // 1티어는 일반까지만 가능, 경험치 버림
        totalExp = 0;
      } else {
        totalExp -= 10;
        currentGrade = '고급';
      }
    }

    // 고급 → 희귀 승급
    if (currentGrade === '고급' && totalExp >= 30) {
      // 티어별 최대 등급 확인
      if (maxGrade === '고급') {
        // 2티어는 고급까지만 가능, 경험치 버림
        totalExp = 0;
      } else {
        totalExp -= 50;
        currentGrade = '희귀';
      }
    }

    // 최대 등급에 도달하면 남은 경험치는 0
    if (currentGrade === maxGrade) {
      totalExp = 0;
    }

    return { grade: currentGrade, remainingExp: totalExp };
  };

  // 재료 추가 가능 여부 확인
  const canAddMaterial = (item: Item, material: Item, currentMaterials: Item[]) => {
    // 최대 8개 제한
    if (currentMaterials.length >= 8) return false;

    // 이미 추가된 재료는 제외
    if (currentMaterials.find(m => m.id === material.id)) return true;

    const maxGrade = getMaxGradeForTier(item.tier);
    const currentResult = calculateUpgradeResult(item, currentMaterials);
    const nextResult = calculateUpgradeResult(item, [...currentMaterials, material]);

    // 이미 최대 등급에 도달했고 경험치가 0이면 더 이상 추가 불가
    if (currentResult.grade === maxGrade && currentResult.remainingExp === 0) {
      return false;
    }

    // 다음 재료를 추가해도 등급과 경험치가 변하지 않으면 낭비
    if (currentResult.grade === nextResult.grade &&
        currentResult.remainingExp === nextResult.remainingExp &&
        currentResult.grade === maxGrade) {
      return false;
    }

    return true;
  };

  // --- 8. 승급 실행 ---
  const executeUpgrade = () => {
    if (!selectedItem || selectedMaterials.length === 0) return;

    const result = calculateUpgradeResult(selectedItem, selectedMaterials);

    // 소모된 재료 아이템 통계 업데이트
    selectedMaterials.forEach(material => {
      const itemKey = material.name.includes('제작') ? `${material.tier}T제작` as keyof typeof consumedItems : `${material.tier}T드랍` as keyof typeof consumedItems;
      if (itemKey in consumedItems) {
        setConsumedItems(prev => ({ ...prev, [itemKey]: prev[itemKey] + 1 }));
      }
    });

    setInventory(prev => {
      // 재료 아이템들 제거
      let remaining = prev.filter(item => !selectedMaterials.find(m => m.id === item.id));

      // 선택된 아이템 업그레이드
      remaining = remaining.map(item =>
        item.id === selectedItem.id
          ? {
              ...item,
              grade: result.grade,
              attack: calculateAttack(item.tier, result.grade, item.enhance),
              exp: result.remainingExp
            }
          : item
      );

      return remaining;
    });

    addLog(`[승급] ${selectedItem.name} → ${result.grade} (EXP: +${result.remainingExp})`);

    // 업그레이드된 아이템으로 선택 유지
    setSelectedItem(prev =>
      prev ? {
        ...prev,
        grade: result.grade,
        attack: calculateAttack(prev.tier, result.grade, prev.enhance),
        exp: result.remainingExp
      } : null
    );
    setIsUpgradeMode(false);
    setSelectedMaterials([]);
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
    <div style={containerStyle}>
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
      {/* 1~3T / 4~7T 좌우 배치 */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
        {/* 1~3T 영역 */}
        <div style={{flex: 1, padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', border: '1px solid #333'}}>
          <h4 style={{margin: '0 0 8px 0', color: '#81c784', textAlign: 'center', fontSize: '0.9rem'}}>1~3 Tier</h4>
          <div style={{display: 'flex', gap: '8px'}}>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>📦 드랍</div>
              <button onClick={() => handleDrop(1)} style={actionBtn}>1T 드랍</button>
              <button onClick={() => handleDrop(2)} style={actionBtn}>2T 드랍</button>
              <button onClick={() => handleDrop(3)} style={actionBtn}>3T 드랍</button>
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>⛏️ 채집</div>
              <button onClick={() => addOreToInventory(1, 100)} style={actionBtn}>1T 철 +100</button>
              <button onClick={() => addOreToInventory(2, 100)} style={actionBtn}>2T 철 +100</button>
              <button onClick={() => addOreToInventory(3, 100)} style={actionBtn}>3T 철 +100</button>
            </div>
            <div style={{flex: 2, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>🛠️ 제작</div>
              <button onClick={() => handleCraft(1)} style={actionBtn}>1T (1T철10)</button>
              <button onClick={() => handleCraft(2)} style={actionBtn}>2T (1T제+1T드+2T철10)</button>
              <button onClick={() => handleCraft(3)} style={actionBtn}>
                3T (2T드<span style={{color: '#66bb6a'}}>고급</span>+2T제<span style={{color: '#66bb6a'}}>고급</span>+3T철10)
              </button>
            </div>
          </div>
        </div>

        {/* 4~7T 영역 */}
        <div style={{flex: 1, padding: '12px', backgroundColor: '#2a1a1a', borderRadius: '8px', border: '1px solid #553333'}}>
          <h4 style={{margin: '0 0 8px 0', color: '#ff9800', textAlign: 'center', fontSize: '0.9rem'}}>4~7 Tier</h4>
          <div style={{display: 'flex', gap: '8px'}}>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>📦 드랍</div>
              <button onClick={() => handleDrop(4)} style={actionBtn}>4T 드랍</button>
              <button onClick={() => handleDrop(5)} style={actionBtn}>5T 드랍</button>
              <div style={{borderTop: '1px solid #555', margin: '2px 0'}}/>
              <button onClick={() => handleDrop(6)} style={actionBtn}>6T 드랍</button>
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>⛏️ 채집</div>
              <button onClick={() => addOreToInventory(4, 100)} style={actionBtn}>4T 철 +100</button>
              <button onClick={() => addOreToInventory(5, 100)} style={actionBtn}>5T 철 +100</button>
              <div style={{borderTop: '1px solid #555', margin: '2px 0'}}/>
              <button onClick={() => addOreToInventory(6, 100)} style={actionBtn}>6T 철 +100</button>
              <button onClick={() => addOreToInventory(7, 100)} style={actionBtn}>7T 철 +100</button>
            </div>
            <div style={{flex: 2, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold', marginBottom: '2px'}}>🛠️ 제작</div>
              <button onClick={() => handleCraft(4)} style={actionBtn}>
                4T (3T드<span style={{color: '#42a5f5'}}>희귀</span>+4T철10+내륙코인1)
              </button>
              <button onClick={() => handleCraft(5)} style={actionBtn}>
                5T (4T드<span style={{color: '#42a5f5'}}>희귀</span>+4T제<span style={{color: '#42a5f5'}}>희귀</span>+5T철10)
              </button>
              <div style={{borderTop: '1px solid #555', margin: '2px 0'}}/>
              <button onClick={() => handleCraft(6)} style={actionBtn}>
                6T (5T드<span style={{color: '#ba68c8'}}>고대</span>+6T철10+해상코인1)
              </button>
              <button onClick={() => handleCraft(7)} style={actionBtn}>
                7T (6T드<span style={{color: '#ba68c8'}}>고대</span>+6T제<span style={{color: '#ba68c8'}}>고대</span>+7T철10)
              </button>
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
      <div style={{padding: '8px 15px', backgroundColor: '#1a1a1a', borderRadius: '6px', marginBottom: '15px', border: '1px solid #333', fontSize: '0.8rem'}}>
        <div style={{marginBottom: '4px'}}>
          <span style={{color: '#ffeb3b', fontWeight: 'bold'}}>
            🛡️ 보호제: {usedProtectionCount.toLocaleString()}개 ({(usedProtectionCount * protectionPrice / 10000).toFixed(1)}만원)
          </span>
          <span style={{marginLeft: '20px', color: '#ff6b6b', fontWeight: 'bold'}}>📦 소모:</span>
          <span style={{marginLeft: '8px', color: '#bbb'}}>
            1T제{consumedItems['1T제작']} 1T드{consumedItems['1T드랍']} 1T철{consumedItems['1T철']} |
            2T제{consumedItems['2T제작']} 2T드{consumedItems['2T드랍']} 2T철{consumedItems['2T철']} |
            3T제{consumedItems['3T제작']} 3T드{consumedItems['3T드랍']} 3T철{consumedItems['3T철']} |
            4T제{consumedItems['4T제작']} 4T드{consumedItems['4T드랍']} 4T철{consumedItems['4T철']} |
            5T제{consumedItems['5T제작']} 5T드{consumedItems['5T드랍']} 5T철{consumedItems['5T철']} |
            6T제{consumedItems['6T제작']} 6T드{consumedItems['6T드랍']} 6T철{consumedItems['6T철']} |
            7T제{consumedItems['7T제작']} 7T드{consumedItems['7T드랍']} 7T철{consumedItems['7T철']}
          </span>
        </div>
        <div style={{borderTop: '1px solid #333', paddingTop: '4px', color: '#aaa'}}>
          <span style={{color: '#9575cd', fontWeight: 'bold'}}>📊 +9강 통계</span>
          <span style={{marginLeft: '8px'}}>평균 소모: {Math.floor(1 / enhanceRates.reduce((acc, rate) => acc * (rate / 100), 1)).toLocaleString()}개</span>
          <span style={{marginLeft: '12px'}}>보호제:</span>
          {simulateAllTiers(enhanceRates).map(result => (
            <span key={result.tier} style={{marginLeft: '8px'}}>
              {result.tier}T={result.totalProtectionItems.toLocaleString()}개({(result.totalCostKrw / 10000).toFixed(1)}만)
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={inventoryPanel}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h3 style={{margin: 0}}>인벤토리</h3>
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
                    <div style={infoText}>공속 : +{item.attackSpeed}</div>
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
            <h4 style={{margin: '0 0 15px 0', color: '#64b5f6'}}>📊 등급별 필요 아이템 통계 (일반 아이템 기준)</h4>
            <div style={{fontSize: '0.75rem', color: '#aaa', marginBottom: '15px', fontStyle: 'italic'}}>
              * 승급 경험치: 일반→고급 10 EXP, 고급→희귀 30 EXP<br/>
              * 일반: 10 EXP / 고급: 16 EXP / 희귀: 56 EXP
            </div>
            
            {/* 승급 재료 */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#ffb74d'}}>🔼 승급 필요 재료</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 고급 1개 = 일반 2개 소모 (베이스 1개 + 재료 1개)
                </div>
                <div style={{fontSize: '0.8rem'}}>
                  • 희귀 1개 = 고급 3개 소모 = 일반 6개 소모 (베이스 1개 + 재료 2개)
                </div>
              </div>
            </div>
            
            {/* 1T 제작 */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#81c784'}}>1T 제작템 (최대: 일반)</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 일반 1개: 1T철광석 10개
                </div>
              </div>
            </div>

            {/* 2T 제작 */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#81c784'}}>2T 제작템 (최대: 고급)</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 일반 1개: 1T제작(일반) 1개 + 1T드랍(일반) 1개 + 2T철광석 10개
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T철광석 10개 + 1T드랍(일반) 1개 + 2T철광석 10개
                </div>
                
                <div style={{fontSize: '0.8rem', color: '#ffd54f', marginTop: '8px'}}>
                  • 고급 1개 = 2T 일반 2개 소모
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T철광석 20개 + 1T드랍(일반) 2개 + 2T철광석 20개
                </div>
              </div>
            </div>

            {/* 3T 제작 */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px', color: '#81c784'}}>3T 제작템 (최대: 희귀)</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '10px'}}>
                <div style={{fontSize: '0.8rem'}}>
                  • 일반 1개: 2T드랍(고급) 1개 + 2T제작(고급) 1개
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  = 2T드랍(일반) 2개 + 2T제작(일반) 2개
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T제작(일반) 2개 + 1T드랍(일반) 4개 + 2T철광석 20개
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T철광석 20개 + 1T드랍(일반) 4개 + 2T철광석 20개
                </div>
                
                <div style={{fontSize: '0.8rem', color: '#ffd54f', marginTop: '8px'}}>
                  • 고급 1개 = 3T 일반 2개 소모
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T철광석 40개 + 1T드랍(일반) 8개 + 2T철광석 40개
                </div>
                
                <div style={{fontSize: '0.8rem', color: '#ff9800', marginTop: '8px'}}>
                  • 희귀 1개 = 3T 고급 3개 = 3T 일반 6개 소모
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 2T드랍(일반) 12개 + 2T제작(일반) 12개
                </div>
                <div style={{fontSize: '0.75rem', color: '#888', paddingLeft: '15px'}}>
                  → 총 소모: 1T철광석 120개 + 1T드랍(일반) 24개 + 2T철광석 120개
                </div>
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
              <div style={infoText}>공속: +{selectedItem.attackSpeed}</div>
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
              <div style={infoText}>공속: +{selectedItem.attackSpeed}</div>
              <div style={{...infoText, color: selectedItem.skill === 'SR' ? '#ff6b00' : '#64b5f6', fontWeight: selectedItem.skill === 'SR' ? 'bold' : 'normal'}}>스킬: {selectedItem.skill}</div>
              <div style={{...infoText, color: '#ff6b00', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '5px'}}>현재 강화: +{selectedItem.enhance}강</div>
              <div style={{...infoText, color: '#ffd700', marginTop: '5px'}}>등급: {selectedItem.grade}</div>
            </div>

            {/* 강화 정보 */}
            <div style={{padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px', marginBottom: '15px'}}>
              <div style={{fontSize: '0.9rem', marginBottom: '10px', color: '#9575cd', fontWeight: 'bold'}}>
                +{selectedItem.enhance + 1}강 도전
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
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
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
                <div style={infoText}>공속: +{deleteConfirmItem.attackSpeed}</div>
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

      {/* 승급 모달 */}
      {selectedItem && isUpgradeMode && (
        <div style={modalOverlayStyle}>
          <div style={{...modalContentStyle, minWidth: '600px', border: '2px solid #ffd700'}}>
            <h3 style={{ color: '#ffd700', marginTop: 0 }}>✨ 아이템 승급</h3>

            {/* 선택된 아이템 정보 */}
            <div style={{...itemCard, backgroundColor: getGradeColor(selectedItem.grade), marginBottom: '20px'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px'}}>{selectedItem.name}</div>
              <div style={infoText}>공격력: {selectedItem.attack} | 공속: +{selectedItem.attackSpeed} | 스킬: {selectedItem.skill}</div>
              <div style={infoText}>{selectedItem.slots > 0 ? `세공: ${selectedItem.slots}칸 | ` : ''}강화: +{selectedItem.enhance}</div>
              <div style={{...infoText, color: '#ffd700', marginTop: '5px'}}>현재 등급: {selectedItem.grade} | 현재 EXP: {selectedItem.exp || 0}</div>
            </div>

            {/* 예상 결과 */}
            {(() => {
              const result = calculateUpgradeResult(selectedItem, selectedMaterials);
              const currentExp = (selectedItem.exp || 0) + selectedMaterials.reduce((sum, item) => sum + getItemExp(item.grade), 0);
              return (
                <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px'}}>
                  <div style={{fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px', color: '#4caf50'}}>
                    예상 결과
                  </div>
                  <div style={{fontSize: '0.9rem', marginBottom: '5px'}}>
                    총 경험치: {currentExp} EXP
                  </div>
                  <div style={{fontSize: '0.9rem', marginBottom: '5px'}}>
                    예상 등급: <span style={{color: result.grade === '희귀' ? '#64b5f6' : result.grade === '고급' ? '#81c784' : '#fff', fontWeight: 'bold'}}>{result.grade}</span>
                  </div>
                  <div style={{fontSize: '0.9rem', color: '#4caf50'}}>
                    남은 경험치: {result.remainingExp} EXP
                  </div>
                </div>
              );
            })()}

            {/* 선택된 재료 (최대 8개) */}
            <div style={{marginBottom: '20px'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '10px'}}>
                선택된 재료 ({selectedMaterials.length}/8)
              </div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '60px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '5px'}}>
                {selectedMaterials.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleMaterial(item)}
                    style={{
                      ...itemCard,
                      backgroundColor: '#1565c0',
                      cursor: 'pointer',
                      padding: '8px',
                      minWidth: '120px'
                    }}
                  >
                    <div style={{fontSize: '0.75rem', fontWeight: 'bold'}}>{item.name}</div>
                    <div style={{fontSize: '0.65rem'}}>등급: {item.grade} | EXP: {getItemExp(item.grade)}</div>
                    <div style={{fontSize: '0.65rem'}}>공속: +{item.attackSpeed} | 강화: +{item.enhance}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 재료 선택 목록 */}
            <div style={{marginBottom: '20px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #333', borderRadius: '5px', padding: '10px', backgroundColor: '#1a1a1a'}}>
              <div style={{fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold'}}>재료 선택 (같은 타입):</div>
              {inventory
                .filter(item => item.id !== selectedItem.id && item.name === selectedItem.name && !item.isStackable)
                .map(item => {
                  const isSelected = selectedMaterials.find(m => m.id === item.id);
                  const canAdd = canAddMaterial(selectedItem, item, selectedMaterials);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isSelected || canAdd) {
                          toggleMaterial(item);
                        }
                      }}
                      style={{
                        ...itemCard,
                        backgroundColor: getGradeColor(item.grade),
                        cursor: isSelected || canAdd ? 'pointer' : 'not-allowed',
                        opacity: isSelected || canAdd ? 1 : 0.5,
                        marginBottom: '8px',
                        padding: '10px',
                        border: isSelected ? '3px solid #64b5f6' : (canAdd ? '2px solid #555' : '2px solid #333'),
                        boxShadow: isSelected ? '0 0 8px rgba(100, 181, 246, 0.5)' : 'none'
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <div style={{fontSize: '0.85rem', fontWeight: 'bold'}}>{item.name} ({item.grade})</div>
                          <div style={{fontSize: '0.75rem', color: '#aaa'}}>
                            공격: {item.attack} | 공속: +{item.attackSpeed} | 스킬: {item.skill} | 강화: +{item.enhance}
                          </div>
                        </div>
                        <div style={{fontSize: '0.85rem', fontWeight: 'bold', color: '#ffd700'}}>
                          +{getItemExp(item.grade)} EXP
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={executeUpgrade}
                disabled={selectedMaterials.length === 0}
                style={{
                  ...btnStyle,
                  backgroundColor: selectedMaterials.length > 0 ? '#2e7d32' : '#555',
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: selectedMaterials.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                승급 확인
              </button>
              <button
                onClick={() => { setIsUpgradeMode(false); setSelectedMaterials([]); }}
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
              <div style={{fontSize: '0.9rem', color: '#aaa'}}>
                {isTradeMode === 'inland' ? '내륙 무역 코인으로 교환됩니다' : '해상 무역 코인으로 교환됩니다'}
              </div>
            </div>

            {/* 무역 가능 아이템 목록 */}
            <div style={{marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #333', borderRadius: '5px', padding: '10px', backgroundColor: '#1a1a1a'}}>
              {inventory
                .filter(item => {
                  if (isTradeMode === 'inland') return (item.inlandTradeValue || 0) > 0;
                  if (isTradeMode === 'sea') return (item.seaTradeValue || 0) > 0;
                  return false;
                })
                .map(item => (
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
                          등급: {item.grade} | 공격: {item.attack} | 공속: +{item.attackSpeed} | 스킬: {item.skill}
                        </div>
                      </div>
                      <div style={{fontSize: '0.95rem', fontWeight: 'bold', color: isTradeMode === 'inland' ? '#ff6b00' : '#1e88e5'}}>
                        +{isTradeMode === 'inland' ? item.inlandTradeValue : item.seaTradeValue} 코인
                      </div>
                    </div>
                  </div>
                ))
              }
              {inventory.filter(item => {
                if (isTradeMode === 'inland') return (item.inlandTradeValue || 0) > 0;
                if (isTradeMode === 'sea') return (item.seaTradeValue || 0) > 0;
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
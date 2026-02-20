// 공통 타입 정의

export type EcoMode = 'BM' | 'HARDCORE';

// 1. 아이템 타입 정의 (App.tsx와 동일 구조)
export interface Item {
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

// 사냥 중 스폰된 광물 정보
export type SpawnedOre = { id: number; slot: number };

// 소모된 아이템/철광석 통계를 위한 맵
export type ConsumedItems = Record<string, number>;

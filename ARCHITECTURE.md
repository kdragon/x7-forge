# x7-forge Architecture

## Goals
- 인벤토리, 강화, 전투를 포함한 전체 게임 로직을 확장 가능한 구조로 분리
- React 컴포넌트는 UI 조립과 사용자 입력 처리에 집중
- 도메인 로직은 core + config로 분리하여 테스트와 재사용성 확보
- 전역 상태는 state 레이어(Context + reducer)에서 통합 관리
- 저장/로드는 별도 persistence 모듈로 분리하여 스키마/버전 관리 가능하게 유지

## Directory Layout

- src/
  - config/
    - itemRules.ts       # 등급/티어/공격력/강화 보너스 규칙
    - enhanceRules.ts    # 강화/보호제 비용 규칙
    - gameDefaults.ts    # 기본 확률/가격 초기값
  - shared/
    - types.ts           # 공통 타입(Item, EcoMode, SpawnedOre, 통계 타입 등)
  - core/
    - inventory.ts       # 인벤토리/철광석/소모 통계 순수 로직
    - enhance.ts         # 분해/승급 등 기본 강화 관련 순수 로직
    - enhanceEngine.ts   # 강화 결과 처리 엔진
    - craft.ts           # 제작 관련 순수 로직
    - trade.ts           # 무역 관련 순수 로직
    - combat.ts          # 전투 계산(대미지/몬스터 스탯)
    - combatEngine.ts    # 경험치/레벨/HP 진행 로직
  - state/
    - gameTypes.ts       # GameState / GameAction 타입
    - gameReducer.ts     # reducer 정의
    - GameContext.tsx    # Provider / Context
    - useGameState.ts    # state selector hook
    - useGameActions.ts  # action helper hook
    - persistence.ts     # 저장/로드 + 버전 마이그레이션
  - ui/
    - shared/
      - itemUi.ts        # 등급 색상/보너스 공격력 포맷
      - styles.ts        # 공통 스타일 토큰
    - inventory/
      - InventoryPanel.tsx
    - enhance/
      - EnhancePanel.tsx
    - combat/
      - CombatPanel.tsx

## Architecture Principles

### 1) UI ↔ Domain 분리
- UI는 렌더링과 사용자 입력만 담당
- 계산/판정/룰은 core와 config에 집중
- App은 조립자로서 이벤트 흐름과 화면 구성을 담당

### 2) Core는 순수 함수 중심
- core 내 함수는 가능한 한 side effect 없이 설계
- 난수/시간 의존 로직은 호출부에서 주입하거나, 엔진 내부에 국소화

### 3) Config로 룰을 관리
- 등급/티어/강화 확률/보호제 코스트는 config에 고정
- 밸런싱 변경은 config 수정으로 처리

### 4) State는 단일 소스
- 전역 상태는 GameContext에서 제공
- UI는 context에서 직접 state를 읽고, props는 콜백 중심으로 유지

### 5) Persistence 분리
- localStorage 접근은 persistence.ts에서만 수행
- 저장 포맷은 versioned payload를 사용
- 마이그레이션 포인트는 migrate 함수로 중앙화

## Runtime Flow (High-Level)

1. UI에서 액션 발생
2. App이 도메인 core 함수를 호출
3. 결과를 GameState에 반영
4. 상태 변경은 UI에 즉시 반영
5. persistence가 자동 저장

## State Layer

### GameState 구성
- inventory, character, monster, enhance/craft/trade 상태
- 전투 연출 상태: damageEvents, dropEffects
- 모달/모드 상태: isUpgradeMode, isEnhanceMode, isTradeMode

### Reducer 정책
- SET_STATE: 부분 상태 업데이트
- ADD_LOG: 시스템 로그를 10개까지 유지

### Custom Hooks
- useGameState: UI에서 상태 접근
- useGameActions: setState / addLog 제공

## Core Engine Responsibilities

### enhanceEngine.ts
- 강화 성공/실패 처리
- 보호제 소모/통계
- 아이템 파괴 및 보상 처리

### craft.ts
- 전리품/코어 카운팅 및 소모
- 제작 아이템 생성 헬퍼

### trade.ts
- 무역 가능성 판정
- 교환 후 인벤토리 업데이트

### combatEngine.ts
- 경험치 누적/레벨업 처리
- 레벨별 HP 증가 공식

### combat.ts
- 전투 스탯 및 대미지 계산
- 몬스터 기본 스탯 테이블

## UI Panels

### InventoryPanel
- 인벤토리 렌더링
- 분해/삭제/변환 UI 제공
- 계산 결과는 core/state에 의존

### EnhancePanel
- 강화/승급 UI
- 결과는 enhanceEngine 처리 후 state 반영

### CombatPanel
- 전투 HUD / 애니메이션 렌더
- 실제 전투 루프는 App에서 관리

## Persistence & Versioning

### 저장 포맷
- { version: 1, data: Partial<GameState> }
- legacy raw object도 허용 (자동 마이그레이션)

### 저장/로드 정책
- useEffect로 자동 저장
- 복구 시 불완전 데이터는 무시하고 안전한 기본 상태 유지

## Testing

### 현재 테스트 범위
- combatEngine
- enhanceEngine
- craft
- trade

### 테스트 전략
- core는 순수 함수 단위 테스트
- UI는 필요 시 최소 스냅샷/상호작용 테스트 추가

## Refactoring Status (완료)
- core 모듈 분리: inventory / enhanceEngine / craft / trade / combatEngine
- config 분리: itemRules / enhanceRules / gameDefaults
- state 레이어: reducer + context + hooks
- UI props 축소: Inventory/Enhance/Combat 패널 context 사용
- 저장/로드 추상화 및 버전 관리
- 테스트 추가: combatEngine / enhanceEngine / craft / trade

## Roadmap (Next Improvements)
1. 전투 루프 및 드랍/스폰 로직 추가 엔진화
2. 인라인 스타일 제거 및 CSS 모듈/디자인 시스템화
3. 도메인 이벤트 기반 reducer 정교화
4. 상태 변경 로그/리플레이 도입

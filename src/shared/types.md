# Shared Types Overview

이 파일은 개발 문서용입니다. 실제 타입 정의는 src/shared/types.ts 에 들어갑니다.

## 핵심 타입

- Item
  - id, name, tier, grade, attack, bonusAttack, skill, slots, enhance, stackCount, isStackable, exp, usedProtectionCount
- EcoMode
  - 'BM' | 'HARDCORE'
- SpawnedOre
  - id, slot (ORE_SLOT_OFFSETS 인덱스)
- ConsumedItems
  - string 키(예: '1T제작', '1T드랍', '1T철'...)를 가지는 number 맵

실제 구현은 TypeScript 코드(src/shared/types.ts)를 참고하세요.

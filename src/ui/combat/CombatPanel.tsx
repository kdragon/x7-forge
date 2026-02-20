import type { CSSProperties } from 'react';
import type { Item } from '../../shared/types';
import { DEFAULT_POTION_CONFIG } from '../../core/potion';
import { getExpForLevel } from '../../core/character';
import { useGameState } from '../../state/useGameState';

interface CombatPanelProps {
  onSelectHuntingTier: (tier: number) => void;
  onStartHunting: () => void;
  onStopHunting: () => void;
  onCollectOre: (oreId: number) => void;
  onStartTradeInland: () => void;
  onStartTradeSea: () => void;
}

const PIXEL = 4;
const SLIME_PIXEL = 5; // 슬라임은 살짝 더 크게 표시

const pixelArt = (pixels: [number, number, string][], size: number = PIXEL): CSSProperties => ({
  width: size,
  height: size,
  boxShadow: pixels
    .map(([x, y, c]) => `${x * size}px ${y * size}px 0 ${c}`)
    .join(','),
  position: 'absolute',
  top: 0,
  left: 0,
});

// 검사 캐릭터 (12x16)
const heroPixels: [number, number, string][] = [
  // 머리 (갈색 머리카락)
  [4, 0, '#8B4513'],
  [5, 0, '#8B4513'],
  [6, 0, '#8B4513'],
  [7, 0, '#8B4513'],
  [3, 1, '#8B4513'],
  [4, 1, '#8B4513'],
  [5, 1, '#8B4513'],
  [6, 1, '#8B4513'],
  [7, 1, '#8B4513'],
  [8, 1, '#8B4513'],
  // 얼굴 (피부)
  [4, 2, '#FDBCB4'],
  [5, 2, '#FDBCB4'],
  [6, 2, '#FDBCB4'],
  [7, 2, '#FDBCB4'],
  [4, 3, '#FDBCB4'],
  [5, 3, '#222'],
  [6, 3, '#FDBCB4'],
  [7, 3, '#222'],
  // 눈
  [4, 4, '#FDBCB4'],
  [5, 4, '#FDBCB4'],
  [6, 4, '#FDBCB4'],
  [7, 4, '#FDBCB4'],
  // 갑옷 (파란색)
  [3, 5, '#1565C0'],
  [4, 5, '#1565C0'],
  [5, 5, '#1565C0'],
  [6, 5, '#1565C0'],
  [7, 5, '#1565C0'],
  [8, 5, '#1565C0'],
  [2, 6, '#1565C0'],
  [3, 6, '#1565C0'],
  [4, 6, '#42A5F5'],
  [5, 6, '#42A5F5'],
  [6, 6, '#42A5F5'],
  [7, 6, '#42A5F5'],
  [8, 6, '#1565C0'],
  [9, 6, '#1565C0'],
  [2, 7, '#FDBCB4'],
  [3, 7, '#1565C0'],
  [4, 7, '#42A5F5'],
  [5, 7, '#FFD700'],
  [6, 7, '#42A5F5'],
  [7, 7, '#42A5F5'],
  [8, 7, '#1565C0'],
  [9, 7, '#FDBCB4'],
  [2, 8, '#FDBCB4'],
  [3, 8, '#1565C0'],
  [4, 8, '#42A5F5'],
  [5, 8, '#42A5F5'],
  [6, 8, '#42A5F5'],
  [7, 8, '#42A5F5'],
  [8, 8, '#1565C0'],
  [9, 8, '#FDBCB4'],
  // 벨트
  [4, 9, '#8B4513'],
  [5, 9, '#FFD700'],
  [6, 9, '#FFD700'],
  [7, 9, '#8B4513'],
  // 다리 (진한 파랑)
  [4, 10, '#0D47A1'],
  [5, 10, '#0D47A1'],
  [6, 10, '#0D47A1'],
  [7, 10, '#0D47A1'],
  [4, 11, '#0D47A1'],
  [5, 11, '#0D47A1'],
  [6, 11, '#0D47A1'],
  [7, 11, '#0D47A1'],
  [4, 12, '#0D47A1'],
  [5, 12, '#0D47A1'],
  [6, 12, '#0D47A1'],
  [7, 12, '#0D47A1'],
  // 부츠 (갈색)
  [3, 13, '#5D4037'],
  [4, 13, '#5D4037'],
  [5, 13, '#5D4037'],
  [6, 13, '#5D4037'],
  [7, 13, '#5D4037'],
  [8, 13, '#5D4037'],
  // 칼 (오른쪽)
  [10, 3, '#B0BEC5'],
  [10, 4, '#B0BEC5'],
  [10, 5, '#B0BEC5'],
  [10, 6, '#B0BEC5'],
  [10, 7, '#8B4513'],
  [10, 8, '#8B4513'],
];

// 슬라임 몬스터 (10x8)
const slimePixels: [number, number, string][] = [
  [3, 0, '#4CAF50'],
  [4, 0, '#4CAF50'],
  [5, 0, '#4CAF50'],
  [6, 0, '#4CAF50'],
  [2, 1, '#4CAF50'],
  [3, 1, '#66BB6A'],
  [4, 1, '#66BB6A'],
  [5, 1, '#66BB6A'],
  [6, 1, '#66BB6A'],
  [7, 1, '#4CAF50'],
  [1, 2, '#4CAF50'],
  [2, 2, '#66BB6A'],
  [3, 2, '#66BB6A'],
  [4, 2, '#66BB6A'],
  [5, 2, '#66BB6A'],
  [6, 2, '#66BB6A'],
  [7, 2, '#66BB6A'],
  [8, 2, '#4CAF50'],
  [1, 3, '#4CAF50'],
  [2, 3, '#66BB6A'],
  [3, 3, '#222'],
  [4, 3, '#66BB6A'],
  [5, 3, '#66BB6A'],
  [6, 3, '#222'],
  [7, 3, '#66BB6A'],
  [8, 3, '#4CAF50'],
  [1, 4, '#388E3C'],
  [2, 4, '#4CAF50'],
  [3, 4, '#4CAF50'],
  [4, 4, '#4CAF50'],
  [5, 4, '#4CAF50'],
  [6, 4, '#4CAF50'],
  [7, 4, '#4CAF50'],
  [8, 4, '#388E3C'],
  [1, 5, '#388E3C'],
  [2, 5, '#388E3C'],
  [3, 5, '#4CAF50'],
  [4, 5, '#4CAF50'],
  [5, 5, '#4CAF50'],
  [6, 5, '#4CAF50'],
  [7, 5, '#388E3C'],
  [8, 5, '#388E3C'],
  [2, 6, '#2E7D32'],
  [3, 6, '#388E3C'],
  [4, 6, '#388E3C'],
  [5, 6, '#388E3C'],
  [6, 6, '#388E3C'],
  [7, 6, '#2E7D32'],
  [3, 7, '#2E7D32'],
  [4, 7, '#2E7D32'],
  [5, 7, '#2E7D32'],
  [6, 7, '#2E7D32'],
];

export default function CombatPanel(props: CombatPanelProps) {
  const {
    characterLevel,
    characterExp,
    characterMaxHP,
    characterHP,
    characterBaseAttack,
    inventory,
    equippedItemId,
    monsterMaxHP,
    monsterHP,
    monsterAttack,
    damageEvents,
    characterDamageEvents,
    healEvents,
    monsterDefense,
    huntingTier,
    selectedHuntingTier,
    battlePhase,
    killCount,
    spawnedOres,
    dropEffects,
    skillEffects,
    potionCooldownLeftMs,
    skillCooldownLeftMs,
    lootDropRate,
  } = useGameState();
  const expToNextLevel = getExpForLevel(characterLevel + 1);
  const characterDefense = 0;
  const isHunting = huntingTier !== null;
  const displayHuntingTier = huntingTier ?? selectedHuntingTier;
  const dropRatePercent = lootDropRate;
  const potionConfig = DEFAULT_POTION_CONFIG;
  const isPotionOnCooldown = potionCooldownLeftMs > 0;
  const potionCooldownSeconds = Math.max(0, Math.ceil(potionCooldownLeftMs / 1000));
  const isSkillOnCooldown = skillCooldownLeftMs > 0;
  const skillCooldownMaxSeconds = 10;
  const skillCooldownSeconds = Math.max(0, Math.ceil(skillCooldownLeftMs / 1000));
  const showSkillCooldown = isSkillOnCooldown && skillCooldownSeconds < skillCooldownMaxSeconds;
  const equippedItem = equippedItemId !== null
    ? inventory.find(item => item.id === equippedItemId)
    : null;
  const equippedSkill = equippedItem && !equippedItem.isStackable ? equippedItem.skill : null;

  const {
    onSelectHuntingTier,
    onStartHunting,
    onStopHunting,
    onCollectOre,
    onStartTradeInland,
    onStartTradeSea,
  } = props;
  const getGradeColor = (grade: Item['grade']): string => {
    switch (grade) {
      case '일반': return '#555';
      case '고급': return '#1b5e20';
      case '희귀': return '#0d47a1';
      case '고대': return '#4a148c';
      case '영웅': return '#e65100';
      case '유일': return '#f9a825';
      case '유물': return '#b71c1c';
      default: return '#333';
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ef5350' }}>⚔️ 사냥터</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <button
                key={t}
                onClick={() => onSelectHuntingTier(t)}
                disabled={isHunting}
                style={{
                  padding: '6px 8px',
                  cursor: isHunting ? 'not-allowed' : 'pointer',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor:
                    huntingTier === t
                      ? '#c62828'
                      : selectedHuntingTier === t
                        ? '#4a2a2a'
                        : '#3a3a3a',
                  color: '#e0e0e0',
                  fontSize: '0.78rem',
                  textAlign: 'left',
                  fontWeight:
                    huntingTier === t || selectedHuntingTier === t ? 'bold' : 'normal',
                }}
              >
                {t}T 사냥터
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                padding: '4px 6px',
                backgroundColor: '#1e1e1e',
                borderRadius: '6px',
                border: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#ddd' }}>무역</span>
              <button
                onClick={onStartTradeInland}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor: '#ff6b00',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                }}
              >
                내륙
              </button>
              <button
                onClick={onStartTradeSea}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  backgroundColor: '#1e88e5',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                }}
              >
                해상
              </button>
            </div>
            <button
              onClick={() => (isHunting ? onStopHunting() : onStartHunting())}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                border: '1px solid #555',
                borderRadius: '4px',
                backgroundColor: isHunting ? '#555' : '#2e7d32',
                color: isHunting ? '#ccc' : '#fff',
                fontSize: '0.78rem',
                textAlign: 'left',
                fontWeight: 'bold',
              }}
            >
              {isHunting ? '사냥 중지' : '사냥 시작'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: '176px',
          backgroundColor: '#0a0a1a',
          borderRadius: '6px',
          border: '1px solid #222',
          overflow: 'hidden',
        }}
      >
        {/* 바닥 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '36px',
            backgroundColor: '#1a3a1a',
            borderTop: '2px solid #2e7d32',
          }}
        />

        {/* 레벨 & 경험치 — 바닥 초록 바 수평 중앙 */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <span
            style={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              lineHeight: 1,
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            }}
          >
            Lv.{characterLevel}
          </span>
          <span
            style={{
              color: '#90caf9',
              fontSize: '0.65rem',
              lineHeight: 1,
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              whiteSpace: 'nowrap',
            }}
          >
            {characterExp}/{expToNextLevel} ({((characterExp / expToNextLevel) * 100).toFixed(2)}%)
          </span>
        </div>

        {/* EXP 바 - 바닥 전체 너비 공유 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'rgba(21,101,192,0.3)',
            zIndex: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(1, characterExp / expToNextLevel) * 100}%`,
              height: '100%',
              background: '#1e88e5',
              transition: 'width 0.3s',
              boxShadow: '0 0 10px rgba(30,136,229,0.8)',
            }}
          />
        </div>

        {/* 캐릭터 - 가운데 기준 왼쪽 배치 */}
        <div
          style={{
            position: 'absolute',
            bottom: '41px',
            left: '50%',
            marginLeft: '-120px',
            animation:
              battlePhase === 'attack'
                ? 'attackSwing 0.8s ease-in-out'
                : battlePhase === 'idle'
                  ? 'idleBounce 1.5s ease-in-out infinite'
                  : 'none',
          }}
        >
          {/* 캐릭터 HP 바 (레벨 제거 → 10px 축소, HP 수치만 중앙 표시) */}
          <div
            style={{
              position: 'absolute',
              top: '-26px',
              left: '-40px',
              width: '130px',
              height: '14px',
              background: '#222',
              borderRadius: '8px',
              border: '2px solid #fff',
              boxShadow: '0 0 8px rgba(255,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
          >
            {isHunting && characterDamageEvents.map(event => (
              <div
                key={event.id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#ff5252',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  textShadow: '0 0 6px rgba(0,0,0,0.9)',
                  animation: 'damageFloat 0.8s ease-out',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              >
                -{event.amount}
              </div>
            ))}
            {isHunting && healEvents.map(event => (
              <div
                key={event.id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#66bb6a',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  textShadow: '0 0 6px rgba(0,0,0,0.9)',
                  animation: 'damageFloat 0.8s ease-out',
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              >
                +{event.amount}
              </div>
            ))}
            <div
              title="10초의 쿨타임을 갖고 무기 공격력의 250% 대미지를 줍니다"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${Math.max(0, Math.min(1, characterHP / characterMaxHP)) * 100}%`,
                height: '100%',
                background: '#e53935',
                borderRadius: '8px',
                transition: 'width 0.3s',
              }}
            />
            <span
              style={{
                position: 'relative',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.72rem',
                zIndex: 1,
              }}
            >
              {characterHP} / {characterMaxHP}
            </span>
          </div>

          <div style={{ position: 'relative', width: `${12 * PIXEL}px`, height: `${16 * PIXEL}px` }}>
            <div style={pixelArt(heroPixels)} />
            {/* 방어력 표시 (캐릭터 왼쪽) */}
            <div
              style={{
                position: 'absolute',
                right: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginRight: '10px',
                background: 'rgba(30,30,30,0.95)',
                color: '#80d8ff',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                borderRadius: '6px',
                padding: '2px 10px',
                border: '1.5px solid #80d8ff',
                boxShadow: '0 2px 8px #000a',
              }}
            >
              DEF {characterDefense}
            </div>
            {/* 공격력 표시 */}
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginLeft: '10px',
                background: 'rgba(30,30,30,0.95)',
                color: '#ffd700',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                borderRadius: '6px',
                padding: '2px 10px',
                border: '1.5px solid #ffd700',
                boxShadow: '0 2px 8px #000a',
              }}
            >
              ATK {characterBaseAttack}
            </div>
          </div>
        </div>

        {/* 몬스터 - 가운데 기준 오른쪽 배치 */}
        <div
          style={{
            position: 'absolute',
            bottom: '46px',
            left: '50%',
            marginLeft: '80px',
            animation:
              battlePhase === 'hit'
                ? 'monsterHit 0.7s ease-in-out'
                : battlePhase === 'dead'
                  ? 'monsterDeath 1s ease-in forwards'
                  : battlePhase === 'spawn'
                    ? 'monsterSpawn 0.5s ease-out'
                    : 'slimeBounce 1.2s ease-in-out infinite',
          }}
        >
          {/* 몬스터 네임태그 (HP 바 위) */}
          <div
            style={{
              position: 'absolute',
              top: '-42px',
              left: '-30px',
              width: '100px',
              textAlign: 'center',
              fontSize: '0.7rem',
              color: '#aaa',
            }}
          >
            {displayHuntingTier}T 슬라임
          </div>

          {/* 몬스터 HP 바 + 데미지 플로팅 */}
          <div
            style={{
              position: 'absolute',
              top: '-45px',
              left: '-30px',
              width: '100px',
              height: '16px',
              background: '#222',
              borderRadius: '8px',
              border: '2px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}
          >
            {isHunting && damageEvents.map(event => (
              <div
                key={event.id}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: '#ff5252',
                  fontWeight: 'bold',
                  fontSize: '1.0rem',
                  textShadow: '0 0 6px rgba(0,0,0,0.9)',
                  animation: 'damageFloat 0.8s ease-out',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                -{event.amount}
              </div>
            ))}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${Math.max(0, Math.min(1, monsterHP / monsterMaxHP)) * 100}%`,
                height: '100%',
                background: '#66bb6a',
                borderRadius: '7px',
                transition: 'width 0.3s',
              }}
            />
            <span
              style={{
                position: 'relative',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                zIndex: 1,
              }}
            >
              {monsterHP} / {monsterMaxHP}
            </span>
          </div>
          <div style={{ position: 'relative', width: `${10 * SLIME_PIXEL}px`, height: `${8 * SLIME_PIXEL}px` }}>
            {/* ATK 표시 (왼쪽) */}
            <div
              style={{
                position: 'absolute',
                right: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginTop: '-5px',
                marginRight: '10px',
                background: 'rgba(20,30,20,0.95)',
                color: '#a5d6a7',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                borderRadius: '6px',
                padding: '2px 10px',
                border: '1.5px solid #66bb6a',
                boxShadow: '0 2px 8px #000a',
              }}
            >
              ATK {monsterAttack}
            </div>
            {/* DEF 표시 (오른쪽) */}
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: '50%',
                transform: 'translateY(-50%)',
                marginTop: '-5px',
                marginLeft: '10px',
                background: 'rgba(20,30,20,0.95)',
                color: '#81d4fa',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                borderRadius: '6px',
                padding: '2px 10px',
                border: '1.5px solid #81d4fa',
                boxShadow: '0 2px 8px #000a',
              }}
            >
              DEF {monsterDefense}
            </div>
            <div style={pixelArt(slimePixels, SLIME_PIXEL)} />
          </div>
        </div>

        {/* 드랍 빛 기둥 이펙트 (공격력이 있는 무기 드랍 시) */}
        {dropEffects.map((effect) => {
          const color = getGradeColor(effect.grade);
          return (
            <div
              key={effect.id}
              style={{
                position: 'absolute',
                bottom: '50px',
                // 캐릭터 우측 끝(50% - 72px)과 몬스터 좌측 끝(50% + 80px) 사이 중간
                left: 'calc(50% + 4px)',
                transform: 'translateX(-50%)',
                width: '6px',
                height: '100px',
                background: `linear-gradient(to top, transparent, ${color}, ${color})`,
                borderRadius: '999px',
                boxShadow: `0 0 24px ${color}, 0 0 56px ${color}`,
                filter: 'blur(0.5px)',
                pointerEvents: 'none',
                animation: 'dropPillar 1s ease-out forwards',
                zIndex: 3,
              }}
            />
          );
        })}

        {/* 스킬 번개 이펙트 */}
        {skillEffects.map((effect) => {
          const isSrEffect = effect.kind === 'SR';
          const offset = effect.offset ?? 0;
          const width = isSrEffect ? 16 : 12;
          const height = isSrEffect ? 210 : 170;
          const glow = isSrEffect
            ? '0 0 26px rgba(255, 214, 0, 0.95), 0 0 80px rgba(255, 214, 0, 0.95)'
            : '0 0 22px rgba(0,170,255,0.95), 0 0 60px rgba(0,170,255,0.9)';
          const beam = isSrEffect
            ? 'linear-gradient(to bottom, rgba(255,255,255,0.0), rgba(255,214,0,1), rgba(255,255,255,0.0))'
            : 'linear-gradient(to bottom, rgba(255,255,255,0.0), rgba(0,170,255,1), rgba(255,255,255,0.0))';
          const duration = isSrEffect ? '0.6s' : '0.9s';
          return (
            <div
              key={effect.id}
              style={{
                position: 'absolute',
                bottom: '60px',
                left: `calc(50% + 80px + ${offset}px)`,
                transform: 'translateX(-50%)',
                width: `${width}px`,
                height: `${height}px`,
                background: beam,
                borderRadius: '999px',
                boxShadow: glow,
                filter: 'blur(0.1px)',
                pointerEvents: 'none',
                animation: `lightningStrike ${duration} ease-out forwards`,
                zIndex: 4,
              }}
            />
          );
        })}

        {/* 광물 스폰 - 오른쪽 끝 근처 3슬롯 정렬 */}
        {spawnedOres.map((ore) => (
          <div
            key={ore.id}
            onClick={() => onCollectOre(ore.id)}
            style={{
              position: 'absolute',
              bottom: '38px',
              right: `${20 + ore.slot * 40}px`,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                animation: 'orePulse 1.4s ease-in-out infinite',
                fontSize: '1.1rem',
                color: '#ffe082',
                textShadow: '0 0 6px rgba(255, 208, 90, 0.85)',
              }}
            >
              ⛏️
            </div>
          </div>
        ))}

        {/* 안내 오버레이 */}
        {!isHunting && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(10,10,26,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bbb',
              fontSize: '0.85rem',
            }}
          >
            사냥 시작을 눌러 전투를 시작하세요
          </div>
        )}

        {/* 사냥 정보 */}
        <div
          style={{
            position: 'absolute',
            top: '5px',
            left: '10px',
            fontSize: '0.7rem',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>
            {isHunting
              ? `${huntingTier ?? displayHuntingTier}T 사냥터 · 드랍률 ${dropRatePercent}%`
              : `${displayHuntingTier}T 사냥터 · 대기중`}
          </span>
          <span>처치: {killCount}마리</span>
        </div>

      </div>

      {/* 액션바 (1번 슬롯: 자동 포션) - 전투 필드 아래 */}
      <div
        style={{
          marginTop: '8px',
          padding: '6px 10px',
          backgroundColor: 'rgba(17,24,39,0.92)',
          borderRadius: '6px',
          border: '1px solid #1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
        }}
      >
        <span
          style={{
            color: '#9ca3af',
            fontWeight: 'bold',
            marginRight: '4px',
          }}
        >
          액션바
        </span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {equippedSkill && (
            <div
              title={equippedSkill === 'SR'
                ? '10초의 쿨타임을 갖고 캐릭터 공격력의 350% 의 대미지를 주고 100% 만큼 체력을 회복합니다.'
                : '10초의 쿨타임을 갖고 캐릭터 공격력의 250% 대미지를 줍니다'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: equippedSkill === 'SR' ? '1px solid #f59e0b' : '1px solid #60a5fa',
                background: equippedSkill === 'SR'
                  ? 'linear-gradient(135deg, #7c2d12, #f59e0b)'
                  : 'linear-gradient(135deg, #1e3a8a, #60a5fa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: equippedSkill === 'SR'
                  ? '0 0 8px rgba(245,158,11,0.7)'
                  : '0 0 8px rgba(96,165,250,0.7)',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#0b0b0b',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                cursor: 'help',
                position: 'relative',
              }}
            >
              {equippedSkill}
              {showSkillCooldown && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(15,23,42,0.9), rgba(15,23,42,0.1))',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: '#e5e7eb',
                    fontWeight: 'bold',
                  }}
                >
                  {skillCooldownSeconds}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          {/* 1번 슬롯 - 자동 포션 */}
          <div
            title={`포션 · HP ${Math.round(potionConfig.hpThreshold * 100)}% 미만 자동 사용 · 최대 체력 ${Math.round(potionConfig.healRatio * 100)}% 회복 · ${Math.round(potionConfig.cooldownMs / 1000)}초 쿨타임`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              border: isPotionOnCooldown ? '1px solid #4b5563' : '1px solid #10b981',
              background: isPotionOnCooldown
                ? 'linear-gradient(135deg, #111827, #1f2937)'
                : 'linear-gradient(135deg, #064e3b, #10b981)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPotionOnCooldown ? 'none' : '0 0 8px rgba(16,185,129,0.7)',
              opacity: isPotionOnCooldown ? 0.6 : 1,
            }}
          >
            {/* 간단한 RPG 포션 형태 아이콘 */}
            <div
              style={{
                width: '14px',
                height: '18px',
                borderRadius: '4px 4px 6px 6px',
                border: '2px solid #e5e7eb',
                background: 'linear-gradient(to top, #10b981, #6ee7b7)',
                boxShadow: '0 0 4px rgba(16,185,129,0.8)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '8px',
                  height: '5px',
                  borderRadius: '3px 3px 0 0',
                  backgroundColor: '#e5e7eb',
                  border: '2px solid #e5e7eb',
                }}
              />
            </div>
            {isPotionOnCooldown && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(15,23,42,0.9), rgba(15,23,42,0.1))',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  color: '#e5e7eb',
                  fontWeight: 'bold',
                }}
              >
                {potionCooldownSeconds}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

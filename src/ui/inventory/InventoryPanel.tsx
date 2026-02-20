import type { DragEvent } from 'react';
import type { Item } from '../../shared/types';
import { useGameState } from '../../state/useGameState';
import { formatBonusAttack, getGradeColor } from '../shared/itemUi';
import { actionBtn, btnStyle, infoText, inventoryPanel, itemCard, itemGrid, trashZoneStyle } from '../shared/styles';

interface InventoryPanelProps {
  onClearAllInventory: () => void;
  onOpenDisassemble: () => void;
  onConvertToPolishStone: (type: 'low' | 'mid' | 'high') => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, item: Item) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDropToTrash: (e: DragEvent<HTMLDivElement>) => void;
  onItemClick: (item: Item) => void;
}

export default function InventoryPanel(props: InventoryPanelProps) {
  const {
    inventory,
    selectedItem,
    equippedItemId,
    upgradeStones,
    polishStones,
    inlandTradeCoins,
    seaTradeCoins,
    dropRates,
    craftRates,
  } = useGameState();
  const inventoryCount = inventory.length;
  const {
    onClearAllInventory,
    onOpenDisassemble,
    onConvertToPolishStone,
    onDragStart,
    onDragOver,
    onDropToTrash,
    onItemClick,
  } = props;

  return (
    <div style={inventoryPanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0 }}>인벤토리</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onOpenDisassemble}
            style={{
              ...btnStyle,
              backgroundColor: '#5d4037',
              padding: '8px 15px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            🔨 분해
          </button>
          <button
            onClick={onClearAllInventory}
            style={{
              ...btnStyle,
              backgroundColor: '#c62828',
              padding: '8px 15px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
            }}
          >
            🗑️ 인벤토리 삭제
          </button>
        </div>
      </div>

      {/* 숯돌 + 세공석 표시 */}
      <div
        style={{
          marginBottom: '10px',
          padding: '8px 10px',
          backgroundColor: '#2a2a2a',
          borderRadius: '6px',
          fontSize: '0.8rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '6px',
          }}
        >
          <span style={{ color: '#a5d6a7' }}>
            🔹 하급숯돌: <b>{upgradeStones.low}</b>
          </span>
          <button
            onClick={() => onConvertToPolishStone('low')}
            disabled={upgradeStones.low < 100}
            style={{
              ...actionBtn,
              fontSize: '0.7rem',
              padding: '2px 6px',
              backgroundColor: upgradeStones.low >= 100 ? '#2e7d32' : '#333',
              color: upgradeStones.low >= 100 ? '#fff' : '#666',
              cursor: upgradeStones.low >= 100 ? 'pointer' : 'not-allowed',
            }}
          >
            변환 (100→1)
          </button>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: '#90caf9' }}>
            🔷 중급숯돌: <b>{upgradeStones.mid}</b>
          </span>
          <button
            onClick={() => onConvertToPolishStone('mid')}
            disabled={upgradeStones.mid < 10}
            style={{
              ...actionBtn,
              fontSize: '0.7rem',
              padding: '2px 6px',
              backgroundColor: upgradeStones.mid >= 10 ? '#1565c0' : '#333',
              color: upgradeStones.mid >= 10 ? '#fff' : '#666',
              cursor: upgradeStones.mid >= 10 ? 'pointer' : 'not-allowed',
            }}
          >
            변환 (10→1)
          </button>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: '#ffab91' }}>
            🔶 상급숯돌: <b>{upgradeStones.high}</b>
          </span>
          <button
            onClick={() => onConvertToPolishStone('high')}
            disabled={upgradeStones.high < 1}
            style={{
              ...actionBtn,
              fontSize: '0.7rem',
              padding: '2px 6px',
              backgroundColor: upgradeStones.high >= 1 ? '#e65100' : '#333',
              color: upgradeStones.high >= 1 ? '#fff' : '#666',
              cursor: upgradeStones.high >= 1 ? 'pointer' : 'not-allowed',
            }}
          >
            변환 (1→1)
          </button>
          <span style={{ color: '#555' }}>|</span>
          <span style={{ color: '#e1bee7', fontWeight: 'bold' }}>
            💎 세공석: <b style={{ color: '#ce93d8' }}>{polishStones}</b>
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '6px',
            borderTop: '1px solid #3a3a3a',
          }}
        >
          <span style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#ff9966' }}>🏜️ 내륙코인: <b>{inlandTradeCoins}</b></span>
            <span style={{ color: '#555', margin: '0 6px' }}>·</span>
            <span style={{ color: '#66aaff' }}>🌊 해상코인: <b>{seaTradeCoins}</b></span>
          </span>
          <span style={{ color: '#00fbff', fontSize: '0.8rem' }}>아이템: {inventoryCount}/300</span>
        </div>
      </div>

      <div style={itemGrid}>
        {inventory.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onClick={() => onItemClick(item)}
            style={{
              ...itemCard,
              backgroundColor: item.isStackable ? '#424242' : getGradeColor(item.grade),
              cursor: 'grab',
              border: selectedItem?.id === item.id ? '2px solid #ffd700' : '1px solid #555',
              opacity: equippedItemId === item.id ? 0.5 : 1,
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 'bold',
                position: 'relative',
                paddingRight: '20px',
              }}
            >
              {item.name}
              {!item.isStackable && item.enhance > 0 && (
                <span style={{ color: '#ff6b00' }}> +{item.enhance}</span>
              )}
              {item.skill === 'SR' && !item.isStackable && (
                <span
                  style={{
                    position: 'absolute',
                    right: '-5px',
                    top: '-8px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    color: '#ffeb3b',
                    textShadow: '0 0 4px #ff6b00',
                  }}
                >
                  ⭐
                </span>
              )}
              {equippedItemId === item.id && (
                <span
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    top: '-8px',
                    background: 'linear-gradient(90deg, #1976d2 60%, #fff 100%)',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    padding: '2px 8px',
                    boxShadow: '0 2px 8px #1976d2aa',
                    zIndex: 2,
                    border: '2px solid #fff',
                    textShadow: '0 1px 2px #1976d2',
                  }}
                >
                  착용중
                </span>
              )}
            </div>
            {item.isStackable ? (
              <div
                style={{
                  ...infoText,
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  color: '#ffd700',
                  marginTop: '10px',
                }}
              >
                x{item.stackCount || 0}
              </div>
            ) : (
              <>
                <div style={infoText}>공 : {item.attack}</div>
                <div style={infoText}>추가공격력: {formatBonusAttack(item)}</div>
                <div
                  style={{
                    ...infoText,
                    color: item.skill === 'SR' ? '#ff6b00' : '#64b5f6',
                    fontWeight: item.skill === 'SR' ? 'bold' : 'normal',
                  }}
                >
                  스킬 : {item.skill}
                </div>
                {item.slots > 0 && (
                  <div style={{ ...infoText, color: '#ce93d8' }}>
                    세공 : {item.slots}칸
                  </div>
                )}
                <div style={{ ...infoText, color: '#ffd700' }}>({item.grade})</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 휴지통 영역 */}
      <div onDragOver={onDragOver} onDrop={onDropToTrash} style={trashZoneStyle}>
        <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🗑️</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
          아이템을 여기로 드래그하여 파괴
        </div>
      </div>

      {/* 통계 정보 */}
      <div
        style={{
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #333',
        }}
      >
        <h4 style={{ margin: '0 0 15px 0', color: '#64b5f6' }}>📊 승급 시스템 안내</h4>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#aaa',
            marginBottom: '15px',
            fontStyle: 'italic',
          }}
        >
          * 승급 시 해당 등급에 맞는 숯돌이 필요합니다 (티어별 숯돌 종류: 1-2T 하급, 3-4T 중급, 5-7T 상급)
          <br />* 분해 시 아이템 등급에 따라 숯돌을 획득합니다
        </div>

        {/* 승급 필요 숯돌 테이블 */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              marginBottom: '10px',
              color: '#ffb74d',
            }}
          >
            🔼 승급 필요 숯돌
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingLeft: '10px',
            }}
          >
            <div style={{ fontSize: '0.8rem' }}>• 일반 → 고급: 숯돌 10개</div>
            <div style={{ fontSize: '0.8rem' }}>• 고급 → 희귀: 숯돌 20개</div>
            <div style={{ fontSize: '0.8rem' }}>• 희귀 → 고대: 숯돌 100개</div>
            <div style={{ fontSize: '0.8rem' }}>• 고대 → 영웅: 숯돌 500개</div>
            <div style={{ fontSize: '0.8rem' }}>• 영웅 → 유일: 숯돌 2,500개</div>
            <div style={{ fontSize: '0.8rem' }}>• 유일 → 유물: 숯돌 12,500개</div>
          </div>
        </div>

        {/* 분해 시 획득 숯돌 */}
        <div
          style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#2a2a2a',
            borderRadius: '4px',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              marginBottom: '10px',
              color: '#90caf9',
            }}
          >
            🔨 분해 시 획득 숯돌 (등급별)
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingLeft: '10px',
              fontSize: '0.8rem',
            }}
          >
            <div>• 일반: 2~4개</div>
            <div>• 고급: 4~8개</div>
            <div>• 희귀: 20~40개</div>
            <div>• 고대: 100~200개</div>
            <div>• 영웅: 500~1,000개</div>
            <div>• 유일: 2,500~5,000개</div>
            <div>• 유물: 12,500~20,000개</div>
            <div style={{ color: '#aaa', marginTop: '5px' }}>
              * 숯돌 종류는 티어에 따라 결정 (1-2T 하급, 3-4T 중급, 5-7T 상급)
            </div>
          </div>
        </div>

        {/* 드랍템 통계 */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #333',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              marginBottom: '10px',
              color: '#81c784',
            }}
          >
            📦 드랍템 등급 확률
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingLeft: '10px',
            }}
          >
            <div style={{ fontSize: '0.8rem' }}>• 1T 드랍: 일반 100% (최대 등급 제한)</div>
            <div style={{ fontSize: '0.8rem' }}>
              • 2T 드랍: 일반 {(100 - dropRates.high).toFixed(1)}% / 고급 {dropRates.high.toFixed(1)}% (최대 등급 제한)
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              • 3T 드랍: 일반 {(100 - dropRates.high - dropRates.rare).toFixed(1)}% / 고급 {dropRates.high.toFixed(1)}% /
              희귀 {dropRates.rare.toFixed(1)}%
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#888',
                paddingLeft: '15px',
              }}
            >
              * 2T 고급 드랍: 평균 {(1 / (dropRates.high / 100)).toFixed(1)}회 필요
            </div>
          </div>
        </div>

        {/* 제작템 확률 */}
        <div style={{ marginTop: '15px' }}>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              marginBottom: '10px',
              color: '#81c784',
            }}
          >
            🛠️ 제작템 등급 확률
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingLeft: '10px',
            }}
          >
            <div style={{ fontSize: '0.8rem' }}>
              • 1T 제작: 일반 {(100 - craftRates.high - craftRates.rare - craftRates.hero).toFixed(1)}% / 고급
              {craftRates.high.toFixed(1)}% / 희귀 {craftRates.rare.toFixed(1)}% / 고대 {craftRates.hero.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              • 2T 제작: 일반 {(100 - craftRates.high).toFixed(1)}% / 고급 {craftRates.high.toFixed(1)}% (최대 등급 제한)
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              • 3T 제작: 일반 {(100 - craftRates.high - craftRates.rare).toFixed(1)}% / 고급
              {craftRates.high.toFixed(1)}% / 희귀 {craftRates.rare.toFixed(1)}% (최대 등급 제한)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Item } from '../../shared/types';
import { getProtectionCountForFailRate } from '../../config/enhanceRules';
import { getMaxGradeForTier } from '../../config/itemRules';
import { useGameState } from '../../state/useGameState';
import { formatBonusAttack, getGradeColor } from '../shared/itemUi';
import { btnStyle, infoText, itemCard, upgradePanel } from '../shared/styles';

interface EnhancePanelProps {
  onEquip: (item: Item) => void;
  onStartUpgradeMode: () => void;
  onStartEnhanceMode: () => void;
  onClearSelectedItem: () => void;
  onEnhance: (useProtection: boolean) => void;
  onCloseEnhanceMode: () => void;
}

export default function EnhancePanel(props: EnhancePanelProps) {
  const {
    selectedItem,
    isUpgradeMode,
    isEnhanceMode,
    equippedItemId,
    ecoMode,
    enhanceRates,
    protectionPrice,
  } = useGameState();
  const {
    onEquip,
    onStartUpgradeMode,
    onStartEnhanceMode,
    onClearSelectedItem,
    onEnhance,
    onCloseEnhanceMode,
  } = props;

  if (!selectedItem || isUpgradeMode) return null;

  return (
    <>
      {/* 기본 강화/승급 패널 */}
      {!isEnhanceMode && (
        <div style={upgradePanel}>
          <h3 style={{ marginTop: 0, color: '#ffd700' }}>강화/승급</h3>

          {/* 선택된 아이템 정보 */}
          <div
            style={{
              ...itemCard,
              backgroundColor: getGradeColor(selectedItem.grade),
              marginBottom: '15px',
            }}
          >
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {selectedItem.name}
              {selectedItem.skill === 'SR' && !selectedItem.isStackable && (
                <span style={{ fontSize: '1.3rem', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00' }}>
                  ⭐
                </span>
              )}
            </div>
            <div style={infoText}>공격력: {selectedItem.attack}</div>
            <div style={infoText}>추가공격력: {formatBonusAttack(selectedItem)}</div>
            <div
              style={{
                ...infoText,
                color: selectedItem.skill === 'SR' ? '#ff6b00' : '#64b5f6',
                fontWeight: selectedItem.skill === 'SR' ? 'bold' : 'normal',
              }}
            >
              스킬: {selectedItem.skill}
            </div>
            {selectedItem.slots > 0 && (
              <div style={{ ...infoText, color: '#ce93d8' }}>세공: {selectedItem.slots}칸</div>
            )}
            <div style={infoText}>강화: +{selectedItem.enhance}</div>
            <div style={{ ...infoText, color: '#ffd700', marginTop: '5px' }}>
              등급: {selectedItem.grade}
            </div>
            {selectedItem.grade === getMaxGradeForTier(selectedItem.tier) ? (
              <div
                style={{
                  ...infoText,
                  color: '#ffb300',
                  marginTop: '5px',
                  fontWeight: 'bold',
                }}
              >
                ✨ 최대 등급
              </div>
            ) : (
              (selectedItem.exp || 0) > 0 && (
                <div style={{ ...infoText, color: '#4caf50', marginTop: '5px' }}>
                  경험치: {selectedItem.exp || 0}
                </div>
              )
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              style={{
                ...btnStyle,
                backgroundColor:
                  equippedItemId === selectedItem.id ? '#757575' : '#1976d2',
                color: '#fff',
                fontWeight: 'bold',
                padding: '12px',
              }}
              onClick={() => onEquip(selectedItem)}
              disabled={selectedItem.isStackable}
            >
              {equippedItemId === selectedItem.id ? '장착 해제' : '장착'}
            </button>
            <button
              style={{ ...btnStyle, backgroundColor: '#d32f2f', padding: '12px' }}
              onClick={onStartUpgradeMode}
              disabled={
                selectedItem.isStackable ||
                selectedItem.grade === getMaxGradeForTier(selectedItem.tier)
              }
            >
              {selectedItem.grade === getMaxGradeForTier(selectedItem.tier)
                ? '최대 등급 도달'
                : '승급 시작'}
            </button>
            <button
              style={{ ...btnStyle, backgroundColor: '#7b1fa2', padding: '12px' }}
              onClick={onStartEnhanceMode}
              disabled={selectedItem.isStackable || selectedItem.enhance >= 9}
            >
              {selectedItem.enhance >= 9 ? '최대 강화 도달' : '강화 시작'}
            </button>
            <button
              style={{ ...btnStyle, backgroundColor: '#555', padding: '8px' }}
              onClick={onClearSelectedItem}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 강화 모드 패널 */}
      {isEnhanceMode && (
        <div style={upgradePanel}>
          <h3 style={{ marginTop: 0, color: '#9575cd' }}>⚔️ 강화</h3>

          {/* 선택된 아이템 정보 */}
          <div
            style={{
              ...itemCard,
              backgroundColor: getGradeColor(selectedItem.grade),
              marginBottom: '15px',
            }}
          >
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {selectedItem.name}
              {selectedItem.skill === 'SR' && !selectedItem.isStackable && (
                <span style={{ fontSize: '1.3rem', color: '#ffeb3b', textShadow: '0 0 4px #ff6b00' }}>
                  ⭐
                </span>
              )}
            </div>
            <div style={infoText}>공격력: {selectedItem.attack}</div>
            <div style={infoText}>추가공격력: {formatBonusAttack(selectedItem)}</div>
            <div
              style={{
                ...infoText,
                color: selectedItem.skill === 'SR' ? '#ff6b00' : '#64b5f6',
                fontWeight: selectedItem.skill === 'SR' ? 'bold' : 'normal',
              }}
            >
              스킬: {selectedItem.skill}
            </div>
            <div
              style={{
                ...infoText,
                color: '#ff6b00',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                marginTop: '5px',
              }}
            >
              현재 강화: +{selectedItem.enhance}강
            </div>
            <div style={{ ...infoText, color: '#ffd700', marginTop: '5px' }}>
              등급: {selectedItem.grade}
            </div>
          </div>

          {/* 강화 정보 */}
          <div
            style={{
              padding: '15px',
              backgroundColor: '#2a2a2a',
              borderRadius: '8px',
              marginBottom: '15px',
            }}
          >
            <div
              style={{
                fontSize: '0.9rem',
                marginBottom: '10px',
                color: '#9575cd',
                fontWeight: 'bold',
              }}
            >
              +{selectedItem.enhance + 1}강 도전
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '0.75rem',
                  color: ecoMode === 'BM' ? '#d32f2f' : '#2e7d32',
                }}
              >
                [{ecoMode === 'BM' ? '🛡️ BM' : '🔥 HARDCORE'}]
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
              • 성공 확률:{' '}
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                {enhanceRates[selectedItem.enhance]?.toFixed(1) || 0}%
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
              • 실패 확률:{' '}
              <span style={{ color: '#f44336', fontWeight: 'bold' }}>
                {(100 - (enhanceRates[selectedItem.enhance] || 0)).toFixed(1)}%
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
              • 필요 재료: {selectedItem.tier}T{' '}
              {selectedItem.itemSource === 'drop' ? '드랍템' : '제작템'} 1개
            </div>
            {ecoMode === 'BM' ? (
              <>
                <div style={{ fontSize: '0.85rem', color: '#ffeb3b' }}>
                  • 이번에 보호제 사용 시:{' '}
                  {(() => {
                    const successRate = enhanceRates[selectedItem.enhance] || 0;
                    const protectionCount = getProtectionCountForFailRate(selectedItem.tier, successRate);
                    return `${protectionCount}개 (${(
                      (protectionCount * protectionPrice) /
                      10000
                    ).toFixed(1)}만원)`;
                  })()}
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: '#64dd17',
                    marginTop: '5px',
                  }}
                >
                  • 이 아이템에 총 사용된 보호제:{' '}
                  {(selectedItem.usedProtectionCount || 0).toLocaleString()}개 (
                  {(
                    ((selectedItem.usedProtectionCount || 0) * protectionPrice) /
                    10000
                  ).toFixed(1)}
                  만원)
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#ff9800' }}>
                • 실패 시 파괴 + 숯돌 반환 (분해와 동일한 숯돌 지급)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ecoMode === 'BM' ? (
              <>
                <button
                  style={{
                    ...btnStyle,
                    backgroundColor: '#4caf50',
                    padding: '12px',
                    fontWeight: 'bold',
                  }}
                  onClick={() => onEnhance(false)}
                >
                  보호제 없이 강화 (실패 시 파괴)
                </button>
                <button
                  style={{
                    ...btnStyle,
                    backgroundColor: '#ff9800',
                    padding: '12px',
                    fontWeight: 'bold',
                  }}
                  onClick={() => onEnhance(true)}
                >
                  보호제 사용 강화 (실패 시 유지)
                </button>
              </>
            ) : (
              <button
                style={{
                  ...btnStyle,
                  backgroundColor: '#2e7d32',
                  padding: '12px',
                  fontWeight: 'bold',
                }}
                onClick={() => onEnhance(false)}
              >
                🔥 강화 (실패 시 파괴 + 숯돌 획득)
              </button>
            )}
            <button
              style={{ ...btnStyle, backgroundColor: '#555', padding: '8px' }}
              onClick={onCloseEnhanceMode}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </>
  );
}

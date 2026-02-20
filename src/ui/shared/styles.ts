import type { CSSProperties } from 'react';

export const btnStyle: CSSProperties = {
  padding: '8px',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#444',
  color: '#fff',
  fontSize: '0.85rem',
};

export const actionBtn: CSSProperties = {
  padding: '6px 8px',
  cursor: 'pointer',
  border: '1px solid #555',
  borderRadius: '4px',
  backgroundColor: '#3a3a3a',
  color: '#e0e0e0',
  fontSize: '0.78rem',
  textAlign: 'left',
};

export const inventoryPanel: CSSProperties = {
  flex: 2,
  backgroundColor: '#1e1e1e',
  padding: '20px',
  borderRadius: '10px',
  minHeight: '500px',
};

export const upgradePanel: CSSProperties = {
  flex: 2,
  backgroundColor: '#1e1e1e',
  padding: '20px',
  borderRadius: '10px',
  minHeight: '500px',
  border: '2px solid #ffd700',
};

export const itemGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: '10px',
  marginBottom: '15px',
};

export const itemCard: CSSProperties = {
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #555',
  lineHeight: '1.4',
};

export const infoText: CSSProperties = { fontSize: '0.75rem' };

export const trashZoneStyle: CSSProperties = {
  marginTop: '15px',
  padding: '25px',
  backgroundColor: '#2a2a2a',
  borderRadius: '8px',
  border: '2px dashed #666',
  textAlign: 'center',
  transition: 'all 0.3s',
  cursor: 'pointer',
};

export const logPanel: CSSProperties = {
  flex: 1,
  backgroundColor: '#1e1e1e',
  padding: '20px',
  borderRadius: '10px',
  height: '500px',
  overflowY: 'auto',
};

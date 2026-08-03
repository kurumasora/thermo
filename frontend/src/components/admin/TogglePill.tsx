export function TogglePill({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      padding: '0.15rem 0.6rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
      fontSize: '0.75rem', fontWeight: 600,
      background: checked ? '#dcfce7' : '#f1f5f9',
      color: checked ? '#16a34a' : '#94a3b8',
    }}>
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}

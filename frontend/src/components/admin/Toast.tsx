export function Toast({ msg, type }: { msg: string; type?: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1000,
      background: type === 'error' ? '#ef4444' : '#22c55e',
      color: '#fff', padding: '0.75rem 1.25rem',
      borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '0.875rem',
    }}>
      {msg}
    </div>
  )
}

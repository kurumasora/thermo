interface Scope { label: string; hours: number }

interface Props {
  calMode: boolean
  setCalMode: React.Dispatch<React.SetStateAction<boolean>>
  calFrom: string
  setCalFrom: (v: string) => void
  calTo: string
  setCalTo: (v: string) => void
  scopeIdx: number
  setScopeIdx: (v: number) => void
  offset: number
  setOffset: React.Dispatch<React.SetStateAction<number>>
  scopes: Scope[]
  startMs: number
  endMs: number
}

function fmtRange(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  )
}

const ctrlSelect: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.83rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer',
}
const navBtn: React.CSSProperties = {
  padding: '0.3rem 0.55rem', fontSize: '1rem', lineHeight: 1,
  borderRadius: '6px', border: '1px solid #cbd5e1',
  background: '#fff', color: '#475569', cursor: 'pointer',
}

export function GraphControls({
  calMode, setCalMode, calFrom, setCalFrom, calTo, setCalTo,
  scopeIdx, setScopeIdx, offset, setOffset, scopes, startMs, endMs,
}: Props) {
  const p = (n: number) => String(n).padStart(2, '0')
  const toDatetimeLocal = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
      <button
        onClick={() => {
          if (!calMode) {
            setCalFrom(toDatetimeLocal(startMs))
            setCalTo(toDatetimeLocal(endMs))
          }
          setCalMode(m => !m)
        }}
        style={{
          ...navBtn,
          background: calMode ? '#3b82f6' : '#fff',
          color: calMode ? '#fff' : '#475569',
          borderColor: calMode ? '#3b82f6' : '#cbd5e1',
          fontSize: '0.83rem',
          padding: '0.3rem 0.65rem',
        }}
        title="期間を指定して表示"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="13" rx="1.5" />
          <line x1="1" y1="6" x2="15" y2="6" />
          <line x1="5" y1="1" x2="5" y2="4" />
          <line x1="11" y1="1" x2="11" y2="4" />
        </svg>
      </button>

      {calMode ? (
        <>
          <input type="datetime-local" value={calFrom} onChange={e => setCalFrom(e.target.value)}
            style={{ ...ctrlSelect, padding: '0.25rem 0.4rem' }} />
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>〜</span>
          <input type="datetime-local" value={calTo} onChange={e => setCalTo(e.target.value)}
            style={{ ...ctrlSelect, padding: '0.25rem 0.4rem' }} />
        </>
      ) : (
        <>
          <select value={scopeIdx} onChange={e => { setScopeIdx(Number(e.target.value)); setOffset(0) }} style={ctrlSelect}>
            {scopes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select>
          <button onClick={() => setOffset(o => o + 1)} style={navBtn} title="前の期間へ">‹</button>
          <button
            onClick={() => setOffset(o => Math.max(0, o - 1))}
            disabled={offset === 0}
            style={{ ...navBtn, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}
            title="次の期間へ"
          >›</button>
          <button
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            style={{ ...navBtn, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? 'default' : 'pointer' }}
            title="最新へ"
          >»</button>
          <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.3rem' }}>
            {fmtRange(startMs)} 〜 {fmtRange(endMs)}
          </span>
        </>
      )}
    </div>
  )
}

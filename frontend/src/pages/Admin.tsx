import { useSearchParams } from 'react-router-dom'
import { SensorTab } from '../components/admin/SensorTab'
import { ThresholdTab } from '../components/admin/ThresholdTab'
import { UserTab } from '../components/admin/UserTab'
import { NotificationTab } from '../components/admin/NotificationTab'

type Tab = 'sensor' | 'threshold' | 'user' | 'notification'
const TABS: { key: Tab; label: string }[] = [
  { key: 'sensor',       label: 'センサ管理' },
  { key: 'threshold',    label: '閾値設定' },
  { key: 'user',         label: 'ユーザー管理' },
  { key: 'notification', label: '通知設定' },
]

function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as Tab) ?? 'sensor'
  const setTab = (t: Tab) => setSearchParams({ tab: t })

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '1.75rem 2rem' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 400, color: '#0f172a', margin: '0 0 1.25rem' }}>管理</h1>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#e2e8f0', borderRadius: '8px', padding: '3px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0.4rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? '#fff' : 'transparent',
            color: tab === t.key ? '#0f172a' : '#64748b',
            boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'background 0.15s, color 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sensor'       && <SensorTab />}
      {tab === 'threshold'    && <ThresholdTab />}
      {tab === 'user'         && <UserTab />}
      {tab === 'notification' && <NotificationTab />}
    </div>
  )
}

export default Admin

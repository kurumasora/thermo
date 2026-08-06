import { useEffect, useState } from 'react'
import {
  getSensors, getSensorMapKeys, createSensor, deleteSensor, toggleSensorActive,
} from '../../api/sensors'
import { Toast } from './Toast'
import { cardStyle, sectionTitle, formLabel, inputStyle, primaryBtnStyle, outlineBtnStyle, outlineBtnSmStyle, errorBanner, thStyle, tdStyle } from './styles'

type SensorItem = { id: number; sensor_key: string; name: string; active: boolean; webhook_url: string | null; in_sensor_map: boolean }
type ChannelInput = { channel_no: number; name: string; unit: string; upper_threshold: number; lower_threshold: number; trend_monitor: boolean }

const emptyChannel = (): ChannelInput => ({ channel_no: 1, name: '', unit: '℃', upper_threshold: 40, lower_threshold: 0, trend_monitor: false })

export function SensorTab() {
  const [sensors, setSensors]           = useState<SensorItem[]>([])
  const [toast, setToast]               = useState<string | null>(null)
  const [sensorMapKeys, setSensorMapKeys] = useState<string[]>([])
  const [showAddForm, setShowAddForm]   = useState(false)
  const [newSensorKey, setNewSensorKey] = useState('')
  const [newSensorName, setNewSensorName] = useState('')
  const [newChannels, setNewChannels]   = useState<ChannelInput[]>([emptyChannel()])
  const [addError, setAddError]         = useState<string | null>(null)

  const fetchSensors = () => getSensors().then(res => setSensors(res.data))
  useEffect(() => { fetchSensors(); getSensorMapKeys().then(res => setSensorMapKeys(res.data.keys)) }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const handleToggle = async (id: number) => {
    const res = await toggleSensorActive(id)
    setSensors(sensors.map(s => s.id === id ? { ...s, active: res.data.active } : s))
  }
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n関連する計測データ・アラート履歴は保持されます。`)) return
    await deleteSensor(id)
    showToast('センサを削除しました'); fetchSensors()
  }
  const updateChannel = (idx: number, field: keyof ChannelInput, value: string | number | boolean) =>
    setNewChannels(prev => prev.map((ch, i) => i === idx ? { ...ch, [field]: value } : ch))

  const handleAddSensor = async () => {
    setAddError(null)
    if (!newSensorKey) { setAddError('センサキーを選択してください'); return }
    if (!newSensorName) { setAddError('センサ名を入力してください'); return }
    if (newChannels.some(ch => !ch.name)) { setAddError('チャンネル名を入力してください'); return }
    try {
      await createSensor({ sensor_key: newSensorKey, name: newSensorName, channels: newChannels })
      showToast('センサを追加しました（初期状態は無効）')
      setShowAddForm(false); setNewSensorKey(''); setNewSensorName(''); setNewChannels([emptyChannel()])
      fetchSensors()
    } catch (e: any) { setAddError(e.response?.data?.detail ?? 'エラーが発生しました') }
  }

  return (
    <>
      {toast && <Toast msg={toast} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={sectionTitle}>センサ管理</h2>
        <button onClick={() => { setShowAddForm(!showAddForm); setAddError(null) }} style={outlineBtnStyle}>
          {showAddForm ? 'キャンセル' : '＋ センサ追加'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ ...cardStyle, border: '1px solid #3b82f6', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>新規センサ登録</h3>
          {addError && <div style={errorBanner}>{addError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center', maxWidth: '480px', marginBottom: '1rem' }}>
            <label style={formLabel}>センサキー</label>
            <select value={newSensorKey} onChange={e => setNewSensorKey(e.target.value)} style={inputStyle}>
              <option value="">-- 選択 --</option>
              {sensorMapKeys.filter(k => !sensors.find(s => s.sensor_key === k)).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <label style={formLabel}>センサ名</label>
            <input type="text" placeholder="例：倉庫1 温湿度センサ" value={newSensorName} onChange={e => setNewSensorName(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>チャンネル設定</div>
          {newChannels.map((ch, idx) => (
            <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem', marginBottom: '0.75rem', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>CH{idx + 1}</span>
                {newChannels.length > 1 && (
                  <button onClick={() => setNewChannels(prev => prev.filter((_, i) => i !== idx))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>削除</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '0.4rem 0.75rem', alignItems: 'center' }}>
                <label style={formLabel}>CH番号</label>
                <input type="number" min={1} value={ch.channel_no} onChange={e => updateChannel(idx, 'channel_no', Number(e.target.value))} style={inputStyle} />
                <label style={formLabel}>チャンネル名</label>
                <input type="text" placeholder="例：温度" value={ch.name} onChange={e => updateChannel(idx, 'name', e.target.value)} style={inputStyle} />
                <label style={formLabel}>単位</label>
                <input type="text" placeholder="℃" value={ch.unit} onChange={e => updateChannel(idx, 'unit', e.target.value)} style={inputStyle} />
                <label style={formLabel}>傾向監視</label>
                <input type="checkbox" checked={ch.trend_monitor} onChange={e => updateChannel(idx, 'trend_monitor', e.target.checked)} />
                <label style={formLabel}>上限閾値</label>
                <input type="number" value={ch.upper_threshold} onChange={e => updateChannel(idx, 'upper_threshold', Number(e.target.value))} style={inputStyle} />
                <label style={formLabel}>下限閾値</label>
                <input type="number" value={ch.lower_threshold} onChange={e => updateChannel(idx, 'lower_threshold', Number(e.target.value))} style={inputStyle} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={() => setNewChannels(prev => [...prev, { ...emptyChannel(), channel_no: prev.length + 1 }])} style={outlineBtnStyle}>
              ＋ チャンネル追加
            </button>
            <button onClick={handleAddSensor} style={primaryBtnStyle}>登録する</button>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.83rem' }}>
          <thead>
            <tr>
              {['センサ名', 'センサキー', '状態', '操作'].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sensors.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={tdStyle}>{s.name}</td>
                <td style={tdStyle}>
                  <code style={{ fontSize: '0.82rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#334155' }}>{s.sensor_key}</code>
                  {!s.in_sensor_map && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', padding: '0 4px', borderRadius: '3px' }}>未登録</span>}
                </td>
                <td style={tdStyle}>
                  <span style={{ color: s.active ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: '0.82rem' }}>
                    {s.active ? '● 有効' : '○ 無効'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleToggle(s.id)} style={outlineBtnSmStyle}>{s.active ? '無効化' : '有効化'}</button>
                    <button onClick={() => handleDelete(s.id, s.name)} style={{ ...outlineBtnSmStyle, color: '#ef4444', borderColor: '#fca5a5' }}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

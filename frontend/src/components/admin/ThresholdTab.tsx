import { useEffect, useState } from 'react'
import { getSettings, updateSettings, getJudgementTypes } from '../../api/settings'
import { Toast } from './Toast'
import { cardStyle, sectionTitle, inputStyle, primaryBtnStyle } from './styles'

type ChannelConfig = {
  sensor_channel_id: number; upper_threshold: number; lower_threshold: number; trend_monitor: boolean
  channel_no: number; channel_name: string; unit: string; sensor_id: number; sensor_name: string
  sensor_key: string; judgement_type: string; judgement_params: Record<string, number>
}
type JudgementParamDef = { key: string; label: string; type: 'number'; default: number; step?: number; min?: number; max?: number }
type JudgementType = { value: string; label: string; params: JudgementParamDef[] }

const thLabelStyle: React.CSSProperties = { fontSize: '0.8rem', color: '#64748b', whiteSpace: 'normal', lineHeight: '1.3' }

export function ThresholdTab() {
  const [configs, setConfigs]               = useState<ChannelConfig[]>([])
  const [judgementTypes, setJudgementTypes] = useState<JudgementType[]>([])
  const [toast, setToast]                   = useState<string | null>(null)

  useEffect(() => {
    getSettings().then(res => setConfigs(res.data))
    getJudgementTypes().then(res => setJudgementTypes(res.data))
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const update = (id: number, field: string, value: number | boolean | string) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, [field]: value } : c))
  const updateParam = (id: number, key: string, value: number) =>
    setConfigs(configs.map(c => c.sensor_channel_id === id ? { ...c, judgement_params: { ...c.judgement_params, [key]: value } } : c))
  const handleSave = async (c: ChannelConfig) => {
    await updateSettings(c.sensor_channel_id, {
      upper_threshold: c.upper_threshold, lower_threshold: c.lower_threshold,
      trend_monitor: c.trend_monitor, judgement_type: c.judgement_type, judgement_params: c.judgement_params,
    })
    showToast(`${c.sensor_name} ${c.channel_name} を更新しました`)
  }

  const grouped = configs.reduce<Record<number, { sensor_name: string; sensor_key: string; channels: ChannelConfig[] }>>((acc, c) => {
    if (!acc[c.sensor_id]) acc[c.sensor_id] = { sensor_name: c.sensor_name, sensor_key: c.sensor_key, channels: [] }
    acc[c.sensor_id].channels.push(c); return acc
  }, {})

  return (
    <>
      {toast && <Toast msg={toast} />}
      <h2 style={sectionTitle}>閾値設定</h2>
      {Object.values(grouped).map(({ sensor_name, sensor_key, channels }) => (
        <div key={sensor_key} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>{sensor_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', alignItems: 'start' }}>
            {channels.map(c => (
              <div key={c.sensor_channel_id} style={{ ...cardStyle }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: '1rem' }}>{c.channel_name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 0.75rem', alignItems: 'center' }}>
                  <label style={thLabelStyle}>上限閾値 ({c.unit})</label>
                  <input type="number" value={c.upper_threshold} onChange={e => update(c.sensor_channel_id, 'upper_threshold', Number(e.target.value))} style={inputStyle} />
                  <label style={thLabelStyle}>下限閾値 ({c.unit})</label>
                  <input type="number" value={c.lower_threshold} onChange={e => update(c.sensor_channel_id, 'lower_threshold', Number(e.target.value))} style={inputStyle} />
                  <label style={thLabelStyle}>傾向監視</label>
                  <input type="checkbox" checked={c.trend_monitor} onChange={e => update(c.sensor_channel_id, 'trend_monitor', e.target.checked)} />
                  {c.trend_monitor && <>
                    <label style={thLabelStyle}>判定方法</label>
                    <select value={c.judgement_type} onChange={e => update(c.sensor_channel_id, 'judgement_type', e.target.value)} style={inputStyle}>
                      {judgementTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {judgementTypes.find(t => t.value === c.judgement_type)?.params.map(p => (
                      <>
                        <label key={`label-${p.key}`} style={thLabelStyle}>{p.label}</label>
                        <input key={`input-${p.key}`} type="number" step={p.step} min={p.min} max={p.max}
                          value={c.judgement_params?.[p.key] ?? p.default}
                          onChange={e => updateParam(c.sensor_channel_id, p.key, Number(e.target.value))}
                          style={inputStyle} />
                      </>
                    ))}
                  </>}
                </div>
                <button onClick={() => handleSave(c)} style={{ ...primaryBtnStyle, marginTop: '0.875rem' }}>更新</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

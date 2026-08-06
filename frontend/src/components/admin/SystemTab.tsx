import { useEffect, useState } from 'react'
import { getAppSettings, updateAppSetting } from '../../api/settings'
import { Toast } from './Toast'
import { cardStyle, sectionTitle, formLabel, inputStyle, primaryBtnStyle } from './styles'

export function SystemTab() {
  const [interval, setInterval] = useState<number>(10)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    getAppSettings().then(res => {
      const v = res.data['monitor_interval_minutes']
      if (v) setInterval(Number(v))
    })
  }, [])

  const handleSave = async () => {
    await updateAppSetting('monitor_interval_minutes', String(interval))
    showToast('設定を保存しました')
  }

  return (
    <>
      {toast && <Toast msg={toast} />}
      <h2 style={sectionTitle}>データ収集設定</h2>
      <div style={{ ...cardStyle, maxWidth: '360px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
          <label style={formLabel}>収集間隔（分）</label>
          <input
            type="number" min={1} max={1440}
            value={interval}
            onChange={e => setInterval(Number(e.target.value))}
            style={{ ...inputStyle, width: '80px' }}
          />
        </div>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.75rem 0 0.875rem' }}>
          1〜1440分の範囲で設定できます。変更は次回の収集タイミングから反映されます。
        </p>
        <button onClick={handleSave} style={primaryBtnStyle}>保存</button>
      </div>
    </>
  )
}

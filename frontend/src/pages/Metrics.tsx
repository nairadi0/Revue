import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { API_BASE, extractErrorMessage } from '../api'

interface MetricsData {
  severity_counts: { severity: string; count: number }[]
  findings_over_time: { date: string; count: number }[]
  most_flagged_files: { file_path: string; count: number }[]
  most_flagged_authors: { author: string; count: number }[]
}

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#0ca30c',
  MEDIUM: '#fab219',
  HIGH: '#d03b3b',
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const widthPct = max === 0 ? 0 : Math.max((count / max) * 100, 3)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <div style={{ width: '12rem', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#e1e0d9', borderRadius: '4px', height: '1.25rem' }}>
        <div
          style={{
            width: `${widthPct}%`,
            background: color,
            height: '100%',
            borderRadius: '4px',
            transition: 'width 0.2s',
          }}
          title={`${label}: ${count}`}
        />
      </div>
      <div style={{ width: '2rem', textAlign: 'right', fontSize: '0.85rem' }}>{count}</div>
    </div>
  )
}

function Metrics() {
  const navigate = useNavigate()
  const [data, setData] = useState<MetricsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch(`${API_BASE}/metrics`, { credentials: 'include' })
      if (response.status === 401) {
        navigate('/')
        return
      }
      if (!response.ok) {
        setError(await extractErrorMessage(response, 'Failed to load metrics'))
        return
      }
      setData(await response.json())
    }
    fetchMetrics()
  }, [navigate])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '48rem' }}>
      <p>
        <Link to="/dashboard">Back to Dashboard</Link> · <Link to="/runs">Agent Runs</Link>
      </p>
      <h1>Metrics</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h2>Findings by severity</h2>
            {data.severity_counts.length === 0 && <p>No findings yet.</p>}
            {(() => {
              const max = Math.max(...data.severity_counts.map((s) => s.count), 1)
              return data.severity_counts.map((s) => (
                <BarRow key={s.severity} label={s.severity} count={s.count} max={max} color={SEVERITY_COLOR[s.severity] ?? '#2a78d6'} />
              ))
            })()}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2>Findings over time</h2>
            {data.findings_over_time.length === 0 && <p>No findings yet.</p>}
            {(() => {
              const max = Math.max(...data.findings_over_time.map((d) => d.count), 1)
              return data.findings_over_time.map((d) => (
                <BarRow key={d.date} label={d.date} count={d.count} max={max} color="#2a78d6" />
              ))
            })()}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2>Most flagged files</h2>
            {data.most_flagged_files.length === 0 && <p>No findings yet.</p>}
            {(() => {
              const max = Math.max(...data.most_flagged_files.map((f) => f.count), 1)
              return data.most_flagged_files.map((f) => (
                <BarRow key={f.file_path} label={f.file_path} count={f.count} max={max} color="#2a78d6" />
              ))
            })()}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2>Most flagged authors</h2>
            {data.most_flagged_authors.length === 0 && <p>No findings yet.</p>}
            {(() => {
              const max = Math.max(...data.most_flagged_authors.map((a) => a.count), 1)
              return data.most_flagged_authors.map((a) => (
                <BarRow key={a.author} label={a.author} count={a.count} max={max} color="#2a78d6" />
              ))
            })()}
          </section>
        </>
      )}
    </div>
  )
}

export default Metrics

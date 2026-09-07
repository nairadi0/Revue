import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { API_BASE, extractErrorMessage } from '../api'

interface AgentRunSummary {
  id: number
  pr_number: number
  title: string
  status: string
  started_at: string
  completed_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#898781',
  RUNNING: '#fab219',
  SUCCESS: '#0ca30c',
  FAILED: '#d03b3b',
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const seconds = Math.max(0, (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  return `${seconds.toFixed(1)}s`
}

function AgentRuns() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<AgentRunSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRuns = async () => {
      const response = await fetch(`${API_BASE}/agent_runs`, { credentials: 'include' })
      if (response.status === 401) {
        navigate('/')
        return
      }
      if (!response.ok) {
        setError(await extractErrorMessage(response, 'Failed to load agent runs'))
        return
      }
      setRuns(await response.json())
    }
    fetchRuns()
  }, [navigate])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <p>
        <Link to="/dashboard">Back to Dashboard</Link> · <Link to="/metrics">Metrics</Link>
      </p>
      <h1>Agent Runs</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #c3c2b7' }}>
            <th style={{ padding: '0.5rem' }}>PR</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Started</th>
            <th style={{ padding: '0.5rem' }}>Duration</th>
            <th style={{ padding: '0.5rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} style={{ borderBottom: '1px solid #e1e0d9' }}>
              <td style={{ padding: '0.5rem' }}>
                #{run.pr_number} {run.title}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <span
                  style={{
                    color: STATUS_COLOR[run.status] ?? '#0b0b0b',
                    fontWeight: 600,
                  }}
                >
                  {run.status}
                </span>
              </td>
              <td style={{ padding: '0.5rem' }}>{new Date(run.started_at).toLocaleString()}</td>
              <td style={{ padding: '0.5rem' }}>{formatDuration(run.started_at, run.completed_at)}</td>
              <td style={{ padding: '0.5rem' }}>
                <Link to={`/runs/${run.id}`}>View details</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AgentRuns

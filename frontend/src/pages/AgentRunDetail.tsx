import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { API_BASE, extractErrorMessage } from '../api'

interface ToolCallLogEntry {
  file: string
  iteration?: number
  tool?: string
  result_preview?: string
  step?: string
  retries?: number
}

interface AgentRunDetailData {
  status: string
  started_at: string
  completed_at: string | null
  pr_number: number
  title: string
  tool_calls_log: ToolCallLogEntry[]
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#898781',
  RUNNING: '#fab219',
  SUCCESS: '#0ca30c',
  FAILED: '#d03b3b',
}

function AgentRunDetail() {
  const navigate = useNavigate()
  const { runId } = useParams()
  const [run, setRun] = useState<AgentRunDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRun = async () => {
      const response = await fetch(`${API_BASE}/agent_runs/${runId}`, { credentials: 'include' })
      if (response.status === 401) {
        navigate('/')
        return
      }
      if (!response.ok) {
        setError(await extractErrorMessage(response, 'Failed to load agent run'))
        return
      }
      setRun(await response.json())
    }
    fetchRun()
  }, [navigate, runId])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <p>
        <Link to="/runs">Back to Agent Runs</Link>
      </p>
      <h1>Agent Run #{runId}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!run && !error && <p>Loading...</p>}
      {run && (
        <>
          <p>
            PR #{run.pr_number}: {run.title}
          </p>
          <p>
            Status:{' '}
            <span style={{ color: STATUS_COLOR[run.status] ?? '#0b0b0b', fontWeight: 600 }}>{run.status}</span>
          </p>
          <p>Started: {new Date(run.started_at).toLocaleString()}</p>
          <p>Completed: {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}</p>

          <h2>Tool call log</h2>
          {(!run.tool_calls_log || run.tool_calls_log.length === 0) && <p>No tool calls recorded.</p>}
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #c3c2b7' }}>
                <th style={{ padding: '0.5rem' }}>File</th>
                <th style={{ padding: '0.5rem' }}>Step</th>
                <th style={{ padding: '0.5rem' }}>Tool</th>
                <th style={{ padding: '0.5rem' }}>Result preview</th>
                <th style={{ padding: '0.5rem' }}>Retries</th>
              </tr>
            </thead>
            <tbody>
              {run.tool_calls_log?.map((entry, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e1e0d9' }}>
                  <td style={{ padding: '0.5rem' }}>{entry.file}</td>
                  <td style={{ padding: '0.5rem' }}>{entry.step ?? `iteration ${entry.iteration}`}</td>
                  <td style={{ padding: '0.5rem' }}>{entry.tool ?? '—'}</td>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {entry.result_preview ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{entry.retries ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default AgentRunDetail

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'


const API_BASE = 'http://localhost:8000'


interface PRFile {
  id: number
  pr_id: number
  file_path: string
  additions: number
  deletions: number
  patch_text: string
}


interface Finding {
  id: number
  file_id: number
  line_number: number
  severity: string
  category: string
  finding_text: string
  suggestion: string
}


type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'


interface AgentRun {
  status: RunStatus
  started_at: string
  completed_at: string | null
}


const POLL_INTERVAL_MS = 3000


function PrDetail() {
  const { repoId, prNumber } = useParams()
  const navigate = useNavigate()

  const [files, setFiles] = useState<PRFile[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [run, setRun] = useState<AgentRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollHandle.current !== null) {
      clearInterval(pollHandle.current)
      pollHandle.current = null
    }
  }

  useEffect(() => {
    const fetchFiles = async () => {
      const response = await fetch(
        `${API_BASE}/repos/${repoId}/prs/${prNumber}/files`,
        { credentials: 'include' },
      )
      if (response.status === 401) {
        navigate('/')
        return
      }
      if (!response.ok) {
        setError(`Failed to load files: ${response.status}`)
        return
      }
      setFiles(await response.json())
    }
    fetchFiles()

    return () => stopPolling()
  }, [repoId, prNumber, navigate])

  const fetchFindings = async () => {
    const response = await fetch(
      `${API_BASE}/repos/${repoId}/prs/${prNumber}/findings`,
      { credentials: 'include' },
    )
    if (response.status === 401) {
      navigate('/')
      return
    }
    if (!response.ok) {
      setError(`Failed to load findings: ${response.status}`)
      return
    }
    setFindings(await response.json())
  }

  const pollRun = (runId: number) => {
    pollHandle.current = setInterval(async () => {
      const response = await fetch(`${API_BASE}/agent_runs/${runId}`, {
        credentials: 'include',
      })
      if (response.status === 401) {
        stopPolling()
        navigate('/')
        return
      }
      if (!response.ok) {
        stopPolling()
        setError(`Failed to check run status: ${response.status}`)
        return
      }
      const data: AgentRun = await response.json()
      setRun(data)
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        stopPolling()
        if (data.status === 'SUCCESS') {
          fetchFindings()
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const handleTriggerReview = async () => {
    setError(null)
    setFindings([])
    const response = await fetch(
      `${API_BASE}/repos/${repoId}/prs/${prNumber}/review`,
      { method: 'POST', credentials: 'include' },
    )
    if (response.status === 401) {
      navigate('/')
      return
    }
    if (!response.ok) {
      setError(`Failed to start review: ${response.status}`)
      return
    }
    const data: { run_id: number; status: RunStatus } = await response.json()
    setRun({ status: data.status, started_at: new Date().toISOString(), completed_at: null })
    pollRun(data.run_id)
  }

  const isReviewInProgress = run?.status === 'PENDING' || run?.status === 'RUNNING'

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>
        Repo {repoId} — PR #{prNumber}
      </h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleTriggerReview} disabled={isReviewInProgress}>
        {isReviewInProgress ? `Review ${run?.status}...` : 'Review this PR'}
      </button>
      {run?.status === 'FAILED' && (
        <p style={{ color: 'red' }}>Review failed. Check server logs for details.</p>
      )}

      <h2>Files</h2>
      <ul>
        {files.map((file) => (
          <li key={file.id}>
            {file.file_path} (+{file.additions}/-{file.deletions})
          </li>
        ))}
      </ul>

      {findings.length > 0 && (
        <>
          <h2>Findings</h2>
          <ul>
            {findings.map((finding) => (
              <li key={finding.id}>
                <strong>
                  [{finding.severity}/{finding.category}] line {finding.line_number}
                </strong>
                <p>{finding.finding_text}</p>
                <p>
                  <em>Suggestion:</em> {finding.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default PrDetail

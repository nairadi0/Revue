import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { API_BASE, ApiError, apiPost, extractErrorMessage } from '../api'
import { useApiQuery } from '../hooks/useApiQuery'
import { useRepo } from '../hooks/useRepo'
import { formatElapsed, splitPath } from '../lib/format'
import { SEVERITY_COLOR, SEVERITY_ORDER } from '../lib/severity'
import AppLayout from '../components/AppLayout'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SeverityBadge,
  Skeleton,
  Spinner,
} from '../components/ui'
import { FileIcon, SparkIcon } from '../components/icons'
import s from './PrDetail.module.css'

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

interface PR {
  pr_number: number
  title: string
  author: string
  status: string
}

type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

interface AgentRun {
  status: RunStatus
  started_at: string
  completed_at: string | null
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 100

function PrDetail() {
  const { repoId, prNumber } = useParams()
  const navigate = useNavigate()
  const repo = useRepo(repoId)

  const { data: prs } = useApiQuery<PR[]>(`/repos/${repoId}/prs`, 'Failed to load pull request')
  const {
    data: files,
    error: filesError,
    loading: filesLoading,
  } = useApiQuery<PRFile[]>(`/repos/${repoId}/prs/${prNumber}/files`, 'Failed to load files')
  const { data: findings, refetch: refetchFindings } = useApiQuery<Finding[]>(
    `/repos/${repoId}/prs/${prNumber}/findings`,
    'Failed to load findings',
  )

  const [run, setRun] = useState<AgentRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttempts = useRef(0)

  const pr = prs?.find((item) => String(item.pr_number) === prNumber)
  const isReviewInProgress = run?.status === 'PENDING' || run?.status === 'RUNNING'

  const stopPolling = () => {
    if (pollHandle.current !== null) {
      clearInterval(pollHandle.current)
      pollHandle.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    if (!isReviewInProgress || !run) return
    const startedAt = new Date(run.started_at).getTime()
    const tick = () => setElapsed((Date.now() - startedAt) / 1000)
    tick()
    const handle = setInterval(tick, 1000)
    return () => clearInterval(handle)
  }, [isReviewInProgress, run])

  const pollRun = (runId: number) => {
    pollAttempts.current = 0
    pollHandle.current = setInterval(async () => {
      pollAttempts.current += 1
      if (pollAttempts.current > MAX_POLL_ATTEMPTS) {
        stopPolling()
        setError('Review is taking much longer than expected — check back later.')
        setRun(null)
        return
      }
      const response = await fetch(`${API_BASE}/agent_runs/${runId}`, { credentials: 'include' })
      if (response.status === 401) {
        stopPolling()
        navigate('/')
        return
      }
      if (!response.ok) {
        stopPolling()
        setError(await extractErrorMessage(response, 'Failed to check run status'))
        setRun(null)
        return
      }
      const data: AgentRun = await response.json()
      setRun(data)
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        stopPolling()
        if (data.status === 'SUCCESS') {
          refetchFindings()
        }
      }
    }, POLL_INTERVAL_MS)
  }

  const handleTriggerReview = async () => {
    setError(null)
    try {
      const data = await apiPost<{ run_id: number; status: RunStatus }>(
        `/repos/${repoId}/prs/${prNumber}/review`,
        undefined,
        'Failed to start review',
      )
      setRun({ status: data.status, started_at: new Date().toISOString(), completed_at: null })
      pollRun(data.run_id)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/')
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to start review')
    }
  }

  const filePathById = useMemo(() => new Map((files ?? []).map((file) => [file.id, file.file_path])), [files])

  const sortedFindings = useMemo(
    () =>
      [...(findings ?? [])].sort((a, b) => {
        const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
        return bySeverity !== 0 ? bySeverity : a.line_number - b.line_number
      }),
    [findings],
  )

  const severityCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const finding of findings ?? []) {
      counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1)
    }
    return SEVERITY_ORDER.filter((severity) => counts.has(severity)).map((severity) => ({
      severity,
      count: counts.get(severity) as number,
    }))
  }, [findings])

  return (
    <AppLayout>
      <PageHeader
        crumbs={[
          { label: 'Repositories', to: '/dashboard' },
          { label: repo ? `${repo.owner}/${repo.name}` : '…', to: `/repos/${repoId}/prs` },
          { label: `#${prNumber}` },
        ]}
        title={pr?.title ?? `Pull request #${prNumber}`}
        subtitle={pr ? `#${pr.pr_number} · opened by ${pr.author}` : undefined}
        actions={
          <Button variant="primary" onClick={handleTriggerReview} disabled={isReviewInProgress}>
            {isReviewInProgress ? <Spinner /> : <SparkIcon size={14} />}
            {isReviewInProgress ? 'Reviewing' : 'Review this PR'}
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {filesError && <ErrorBanner message={filesError} />}

      {isReviewInProgress && (
        <div className={s.runCard}>
          <span className={s.runIcon}>
            <Spinner />
          </span>
          <div className={s.runText}>
            <div>The agent is reviewing this pull request</div>
            <div className={s.runHint}>It reads each changed file in turn — this usually takes a minute or two.</div>
          </div>
          <span className={s.elapsed}>{formatElapsed(elapsed)}</span>
        </div>
      )}

      {run?.status === 'FAILED' && (
        <ErrorBanner message="The review run failed. Open the run history for the tool-call trace." />
      )}

      <div className={s.layout}>
        <section>
          {severityCounts.length > 0 && (
            <div className={s.summary}>
              <span className={s.summaryLabel}>
                {sortedFindings.length} {sortedFindings.length === 1 ? 'finding' : 'findings'}
              </span>
              {severityCounts.map(({ severity, count }) => (
                <Badge
                  key={severity}
                  color={SEVERITY_COLOR[severity]}
                  background="var(--surface-2)"
                  border="var(--border)"
                >
                  {count} {severity.toLowerCase()}
                </Badge>
              ))}
            </div>
          )}

          {sortedFindings.length === 0 && !isReviewInProgress && (
            <EmptyState
              icon={<SparkIcon size={26} />}
              title="No findings yet"
              text="Run a review to have the agent read every changed file and report what it finds."
            />
          )}

          <div className={s.findings}>
            {sortedFindings.map((finding) => (
              <article key={finding.id} className={s.finding}>
                <div className={s.findingBar} style={{ background: SEVERITY_COLOR[finding.severity] }} />
                <div className={s.findingBody}>
                  <div className={s.findingTop}>
                    <SeverityBadge severity={finding.severity} />
                    <Chip>{finding.category}</Chip>
                    <span className={s.location} title={filePathById.get(finding.file_id)}>
                      <span className={s.locationPath}>{filePathById.get(finding.file_id) ?? 'unknown file'}</span>
                      <span>:{finding.line_number}</span>
                    </span>
                  </div>
                  <p className={s.findingText}>{finding.finding_text}</p>
                  {finding.suggestion && (
                    <div className={s.suggestion}>
                      <div className={s.suggestionLabel}>Suggestion</div>
                      <div className={s.suggestionText}>{finding.suggestion}</div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <Card className={s.side}>
          <div className={s.sideTitle}>
            <h2>Files changed</h2>
            <span className={s.elapsed}>{files?.length ?? 0}</span>
          </div>
          {filesLoading && (
            <div className={s.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={18} />
              ))}
            </div>
          )}
          <div className={s.fileList}>
            {(files ?? []).map((file) => (
              <div key={file.id} className={s.file}>
                <FileIcon size={13} />
                <span className={s.filePath} title={file.file_path}>
                  <span className={s.fileDir}>{splitPath(file.file_path).dir}</span>
                  <span className={s.fileName}>{splitPath(file.file_path).name}</span>
                </span>
                <span className={s.diffstat}>
                  <span className={s.additions}>+{file.additions}</span>
                  <span className={s.deletions}>-{file.deletions}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

export default PrDetail

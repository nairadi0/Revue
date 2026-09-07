import { Link } from 'react-router'
import { useApiQuery } from '../hooks/useApiQuery'
import { formatDateTime, formatDuration, formatRelative } from '../lib/format'
import AppLayout from '../components/AppLayout'
import { EmptyState, ErrorBanner, PageHeader, Skeleton, StatusBadge } from '../components/ui'
import { ActivityIcon, ChevronRight } from '../components/icons'
import s from './AgentRuns.module.css'

interface AgentRunSummary {
  id: number
  pr_number: number
  title: string
  status: string
  started_at: string
  completed_at: string | null
}

function AgentRuns() {
  const { data: runs, error, loading } = useApiQuery<AgentRunSummary[]>('/agent_runs', 'Failed to load agent runs')

  const sorted = [...(runs ?? [])].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  )

  return (
    <AppLayout>
      <PageHeader
        title="Agent runs"
        subtitle="Every review the agent has run across your connected repositories, newest first."
      />

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className={s.skeletons}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={56} radius="var(--r-md)" />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && !error && (
        <EmptyState
          icon={<ActivityIcon size={26} />}
          title="No runs yet"
          text="Trigger a review from any pull request and it will show up here."
        />
      )}

      {sorted.length > 0 && (
        <div className={s.table}>
          <div className={s.head}>
            <span>Pull request</span>
            <span>Status</span>
            <span>Started</span>
            <span>Duration</span>
            <span />
          </div>
          {sorted.map((run) => (
            <Link key={run.id} to={`/runs/${run.id}`} className={s.row}>
              <div className={s.pr}>
                <div className={s.title}>{run.title}</div>
                <div className={s.sub}>
                  #{run.pr_number} · run {run.id}
                </div>
              </div>
              <StatusBadge status={run.status} />
              <span className={s.cell} title={formatDateTime(run.started_at)}>
                {formatRelative(run.started_at)}
              </span>
              <span className={s.cell}>{formatDuration(run.started_at, run.completed_at)}</span>
              <span className={s.chevron}>
                <ChevronRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  )
}

export default AgentRuns

import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useApiQuery } from '../hooks/useApiQuery'
import { formatDateTime, formatDuration } from '../lib/format'
import AppLayout from '../components/AppLayout'
import { Card, Chip, EmptyState, ErrorBanner, PageHeader, Skeleton, StatusBadge } from '../components/ui'
import { FileIcon } from '../components/icons'
import s from './AgentRunDetail.module.css'

interface ToolCallLogEntry {
  file?: string
  iteration?: number
  tool?: string
  result_preview?: string
  step?: string
  retries?: number
  error?: string
}

interface AgentRunDetailData {
  status: string
  started_at: string
  completed_at: string | null
  pr_number: number
  title: string
  tool_calls_log: ToolCallLogEntry[]
}

const ERROR_GROUP = 'Run errors'

function AgentRunDetail() {
  const { runId } = useParams()
  const { data: run, error, loading } = useApiQuery<AgentRunDetailData>(
    `/agent_runs/${runId}`,
    'Failed to load agent run',
  )

  const groups = useMemo(() => {
    const byFile = new Map<string, ToolCallLogEntry[]>()
    for (const entry of run?.tool_calls_log ?? []) {
      const key = entry.file ?? ERROR_GROUP
      const existing = byFile.get(key)
      if (existing) {
        existing.push(entry)
      } else {
        byFile.set(key, [entry])
      }
    }
    return [...byFile.entries()]
  }, [run])

  const stepCount = run?.tool_calls_log?.length ?? 0

  return (
    <AppLayout>
      <PageHeader
        crumbs={[{ label: 'Agent runs', to: '/runs' }, { label: `Run ${runId}` }]}
        title={run?.title ?? `Agent run ${runId}`}
        badge={run && <StatusBadge status={run.status} />}
        subtitle={run ? `Pull request #${run.pr_number}` : undefined}
      />

      {error && <ErrorBanner message={error} />}
      {loading && <Skeleton height={220} radius="var(--r-lg)" />}

      {run && (
        <>
          <Card>
            <div className={s.meta}>
              <div>
                <div className={s.metaLabel}>Started</div>
                <div className={s.metaValue}>{formatDateTime(run.started_at)}</div>
              </div>
              <div>
                <div className={s.metaLabel}>Completed</div>
                <div className={s.metaValue}>{formatDateTime(run.completed_at)}</div>
              </div>
              <div>
                <div className={s.metaLabel}>Duration</div>
                <div className={s.metaValue}>{formatDuration(run.started_at, run.completed_at)}</div>
              </div>
              <div>
                <div className={s.metaLabel}>Logged steps</div>
                <div className={s.metaValue}>{stepCount}</div>
              </div>
            </div>
          </Card>

          <h2 style={{ margin: '1.75rem 0 0.85rem' }}>Tool call trace</h2>

          {groups.length === 0 && (
            <EmptyState title="No tool calls recorded" text="This run finished without writing any trace entries." />
          )}

          <div className={s.groups}>
            {groups.map(([file, entries]) => (
              <section key={file} className={s.group}>
                <div className={s.groupHead}>
                  <span className={s.groupIcon}>
                    <FileIcon size={13} />
                  </span>
                  <span className={s.groupPath} title={file}>
                    {file}
                  </span>
                  <span className={s.groupCount}>
                    {entries.length} {entries.length === 1 ? 'step' : 'steps'}
                  </span>
                </div>
                <div className={s.steps}>
                  {entries.map((entry, i) => (
                    <div key={i} className={s.step}>
                      <span
                        className={[s.node, entry.error ? s.nodeError : entry.tool ? s.nodeAccent : '']
                          .filter(Boolean)
                          .join(' ')}
                      />
                      <div className={s.stepTop}>
                        <span className={s.stepLabel}>
                          {entry.error ? 'Error' : (entry.step ?? `Iteration ${entry.iteration ?? i + 1}`)}
                        </span>
                        {entry.tool && <Chip>{entry.tool}</Chip>}
                        {entry.retries ? (
                          <span className={s.retries}>
                            {entry.retries} {entry.retries === 1 ? 'retry' : 'retries'}
                          </span>
                        ) : null}
                      </div>
                      {(entry.result_preview || entry.error) && (
                        <div className={[s.preview, entry.error ? s.errorText : ''].filter(Boolean).join(' ')}>
                          {entry.error ?? entry.result_preview}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  )
}

export default AgentRunDetail

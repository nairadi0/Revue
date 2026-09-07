import { useApiQuery } from '../hooks/useApiQuery'
import { formatCount, shortPath } from '../lib/format'
import AppLayout from '../components/AppLayout'
import { BarList, TrendChart } from '../components/charts'
import type { BarItem } from '../components/charts'
import { Card, CardHeader, EmptyState, ErrorBanner, PageHeader, Skeleton, StatTile } from '../components/ui'
import { SEVERITY_COLOR, SEVERITY_ORDER } from '../lib/severity'
import { ChartIcon } from '../components/icons'
import s from './Metrics.module.css'

interface MetricsData {
  severity_counts: { severity: string; count: number }[]
  findings_over_time: { date: string; count: number }[]
  most_flagged_files: { file_path: string; count: number }[]
  most_flagged_authors: { author: string; count: number }[]
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Section({ title, hint, items, showSwatch }: { title: string; hint?: string; items: BarItem[]; showSwatch?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} hint={hint} />
      {items.length === 0 ? <p className={s.empty}>No findings yet.</p> : <BarList items={items} showSwatch={showSwatch} />}
    </Card>
  )
}

function Metrics() {
  const { data, error, loading } = useApiQuery<MetricsData>('/metrics', 'Failed to load metrics')

  const total = (data?.severity_counts ?? []).reduce((sum, item) => sum + item.count, 0)
  const high = data?.severity_counts.find((item) => item.severity === 'HIGH')?.count ?? 0
  const activeDays = data?.findings_over_time.length ?? 0

  const severityItems: BarItem[] = SEVERITY_ORDER.flatMap((severity) => {
    const match = data?.severity_counts.find((item) => item.severity === severity)
    return match ? [{ key: severity, label: severity, value: match.count, color: SEVERITY_COLOR[severity] }] : []
  })

  const fileItems: BarItem[] = (data?.most_flagged_files ?? []).map((item) => ({
    key: item.file_path,
    label: shortPath(item.file_path),
    value: item.count,
  }))

  const authorItems: BarItem[] = (data?.most_flagged_authors ?? []).map((item) => ({
    key: item.author,
    label: item.author,
    value: item.count,
  }))

  return (
    <AppLayout>
      <PageHeader
        title="Metrics"
        subtitle="Everything the agent has flagged across your connected repositories."
      />

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className={s.skeletons}>
          <Skeleton height={96} radius="var(--r-lg)" />
          <Skeleton height={280} radius="var(--r-lg)" />
        </div>
      )}

      {data && total === 0 && !error && (
        <EmptyState
          icon={<ChartIcon size={26} />}
          title="Nothing to chart yet"
          text="Once the agent reviews a pull request, its findings will be summarised here."
        />
      )}

      {data && total > 0 && (
        <>
          <div className={s.tiles}>
            <StatTile label="Total findings" value={formatCount(total)} />
            <StatTile
              label="High severity"
              value={formatCount(high)}
              hint={total > 0 ? `${Math.round((high / total) * 100)}% of all findings` : undefined}
            />
            <StatTile label="Days with findings" value={formatCount(activeDays)} />
          </div>

          <Card>
            <CardHeader title="Findings over time" hint="By day the finding was recorded" />
            {data.findings_over_time.length < 2 ? (
              <p className={s.empty}>
                {data.findings_over_time.length === 0
                  ? 'No findings yet.'
                  : `All ${formatCount(total)} findings so far were recorded on ${shortDate(data.findings_over_time[0].date)}. A trend appears once findings span more than one day.`}
              </p>
            ) : (
              <TrendChart
                points={data.findings_over_time.map((item) => ({ label: shortDate(item.date), value: item.count }))}
              />
            )}
          </Card>

          <div className={s.grid}>
            <Section title="Findings by severity" items={severityItems} showSwatch />
            <Section title="Most flagged authors" hint="Top 10" items={authorItems} />
          </div>

          <div className={s.grid}>
            <Section title="Most flagged files" hint="Top 10" items={fileItems} />
          </div>
        </>
      )}
    </AppLayout>
  )
}

export default Metrics

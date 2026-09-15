import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiPatch } from '../api'
import { useApiQuery } from '../hooks/useApiQuery'
import { useRepo } from '../hooks/useRepo'
import AppLayout from '../components/AppLayout'
import { Badge, EmptyState, ErrorBanner, InstallPrompt, PageHeader, Skeleton, Toggle } from '../components/ui'
import { ChevronRight } from '../components/icons'
import s from './PrList.module.css'

interface PR {
  id: number
  pr_number: number
  title: string
  author: string
  status: string
}

const PR_STATUS: Record<string, { color: string; background: string }> = {
  OPEN: { color: 'var(--good)', background: 'var(--good-bg)' },
  MERGED: { color: 'var(--accent)', background: 'var(--accent-bg)' },
  CLOSED: { color: 'var(--neutral)', background: 'var(--neutral-bg)' },
}

const FILTERS = ['ALL', 'OPEN', 'MERGED', 'CLOSED'] as const
type Filter = (typeof FILTERS)[number]

function PrList() {
  const { repoId } = useParams()
  const repo = useRepo(repoId)
  const [filter, setFilter] = useState<Filter>('ALL')
  const { data: prs, error, failure, loading } = useApiQuery<PR[]>(`/repos/${repoId}/prs`, 'Failed to load pull requests')
  const notInstalled = failure?.appNotInstalled ? failure : null

  const [postReviewsOverride, setPostReviews] = useState<boolean | null>(null)
  const postReviews = postReviewsOverride ?? repo?.post_reviews ?? null
  const [savingToggle, setSavingToggle] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const handleToggle = async (next: boolean) => {
    setToggleError(null)
    setSavingToggle(true)
    setPostReviews(next)
    try {
      const saved = await apiPatch<{ post_reviews: boolean }>(
        `/repos/${repoId}/settings`,
        { post_reviews: next },
        'Failed to update repository settings',
      )
      setPostReviews(saved.post_reviews)
    } catch (err) {
      setPostReviews(!next)
      setToggleError(err instanceof Error ? err.message : 'Failed to update repository settings')
    } finally {
      setSavingToggle(false)
    }
  }

  const counts = useMemo(() => {
    const all = prs ?? []
    return {
      ALL: all.length,
      OPEN: all.filter((pr) => pr.status === 'OPEN').length,
      MERGED: all.filter((pr) => pr.status === 'MERGED').length,
      CLOSED: all.filter((pr) => pr.status === 'CLOSED').length,
    }
  }, [prs])

  const visible = (prs ?? []).filter((pr) => filter === 'ALL' || pr.status === filter)

  return (
    <AppLayout>
      <PageHeader
        crumbs={[{ label: 'Repositories', to: '/dashboard' }, { label: repo ? `${repo.owner}/${repo.name}` : '…' }]}
        title="Pull requests"
        subtitle="Open a pull request to trigger a review and read the agent's findings."
        actions={
          postReviews !== null && (
            <Toggle
              checked={postReviews}
              disabled={savingToggle}
              onChange={handleToggle}
              label="Post reviews to GitHub"
              hint={postReviews ? 'Findings are posted as revue[bot] review comments' : 'Findings stay in Revue only'}
            />
          )
        }
      />

      {toggleError && <ErrorBanner message={toggleError} />}

      {notInstalled?.installUrl && (
        <InstallPrompt installUrl={notInstalled.installUrl} repoName={repo ? `${repo.owner}/${repo.name}` : undefined} />
      )}
      {error && !notInstalled && <ErrorBanner message={error} />}

      {!notInstalled && (
      <div className={s.tabs}>
        {FILTERS.map((option) => (
          <button
            key={option}
            className={[s.tab, filter === option ? s.tabActive : ''].filter(Boolean).join(' ')}
            onClick={() => setFilter(option)}
          >
            {option === 'ALL' ? 'All' : option.charAt(0) + option.slice(1).toLowerCase()}
            <span className={s.tabCount}>{counts[option]}</span>
          </button>
        ))}
      </div>
      )}

      {loading && (
        <div className={s.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={62} radius="var(--r-md)" />
          ))}
        </div>
      )}

      {!loading && !notInstalled && visible.length === 0 && (
        <EmptyState
          title="No pull requests"
          text={
            filter === 'ALL'
              ? 'This repository has no pull requests yet.'
              : `No ${filter.toLowerCase()} pull requests in this repository.`
          }
        />
      )}

      {!loading && visible.length > 0 && (
        <div className={s.list}>
          {visible.map((pr) => {
            const tone = PR_STATUS[pr.status] ?? PR_STATUS.CLOSED
            return (
              <Link key={pr.id} to={`/repos/${repoId}/prs/${pr.pr_number}`} className={s.row}>
                <Badge color={tone.color} background={tone.background}>
                  {pr.status}
                </Badge>
                <div className={s.main}>
                  <div className={s.title}>{pr.title}</div>
                  <div className={s.meta}>
                    <span className={s.number}>#{pr.pr_number}</span> · opened by {pr.author}
                  </div>
                </div>
                <span className={s.chevron}>
                  <ChevronRight size={15} />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}

export default PrList

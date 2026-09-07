import { useState } from 'react'
import { Link } from 'react-router'
import { useApiQuery } from '../hooks/useApiQuery'
import { formatRelative } from '../lib/format'
import AppLayout from '../components/AppLayout'
import ConnectRepoModal from './ConnectRepoModal'
import { Button, EmptyState, ErrorBanner, PageHeader, Skeleton } from '../components/ui'
import { ChevronRight, PlusIcon, RepoIcon } from '../components/icons'
import s from './Dashboard.module.css'

export interface ConnectedRepo {
  id: number
  name: string
  owner: string
  connected_at: string
}

function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: repos, error, loading, refetch } = useApiQuery<ConnectedRepo[]>(
    '/user/connected-repos',
    'Failed to load connected repositories',
  )

  return (
    <AppLayout>
      <PageHeader
        title="Repositories"
        subtitle="Repositories connected to Revue. Open one to browse its pull requests and start a review."
        actions={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <PlusIcon size={14} />
            Add repository
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className={s.grid}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={124} radius="var(--r-lg)" />
          ))}
        </div>
      )}

      {!loading && repos?.length === 0 && (
        <EmptyState
          icon={<RepoIcon size={28} />}
          title="No repositories yet"
          text="Connect a GitHub repository to let the agent review its pull requests."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <PlusIcon size={14} />
              Add repository
            </Button>
          }
        />
      )}

      {!loading && repos && repos.length > 0 && (
        <div className={s.grid}>
          {repos.map((repo) => (
            <Link key={repo.id} to={`/repos/${repo.id}/prs`} className={s.card}>
              <div className={s.cardTop}>
                <span className={s.repoIcon}>
                  <RepoIcon size={18} />
                </span>
                <div className={s.names}>
                  <div className={s.owner}>{repo.owner}</div>
                  <div className={s.name}>{repo.name}</div>
                </div>
              </div>
              <div className={s.cardBottom}>
                <span>Connected {formatRelative(repo.connected_at)}</span>
                <span className={s.cta}>
                  Pull requests
                  <ChevronRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {modalOpen && (
        <ConnectRepoModal
          connectedRepos={repos ?? []}
          onClose={() => setModalOpen(false)}
          onConnected={refetch}
        />
      )}
    </AppLayout>
  )
}

export default Dashboard

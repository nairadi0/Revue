import { useMemo, useState } from 'react'
import { ApiError, apiPost } from '../api'
import { useApiQuery } from '../hooks/useApiQuery'
import Modal from '../components/Modal'
import { Button, ErrorBanner, Input, Skeleton, Spinner } from '../components/ui'
import { CheckIcon, SearchIcon } from '../components/icons'
import type { ConnectedRepo } from './Dashboard'
import s from './ConnectRepoModal.module.css'

interface GithubRepo {
  id: number
  name: string
  owner: { login: string }
}

interface ConnectRepoModalProps {
  connectedRepos: ConnectedRepo[]
  onClose: () => void
  onConnected: () => void
}

function ConnectRepoModal({ connectedRepos, onClose, onConnected }: ConnectRepoModalProps) {
  const { data: repos, error: loadError, loading } = useApiQuery<GithubRepo[]>('/user/repos', 'Failed to load repositories')
  const [search, setSearch] = useState('')
  const [connectingId, setConnectingId] = useState<number | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  const connectedKeys = useMemo(
    () => new Set(connectedRepos.map((repo) => `${repo.owner}/${repo.name}`)),
    [connectedRepos],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const all = repos ?? []
    return query ? all.filter((repo) => `${repo.owner.login}/${repo.name}`.toLowerCase().includes(query)) : all
  }, [repos, search])

  const handleConnect = async (repo: GithubRepo) => {
    setConnectingId(repo.id)
    setConnectError(null)
    try {
      await apiPost('/repos/connect', { owner: repo.owner.login, name: repo.name }, `Failed to connect ${repo.name}`)
      onConnected()
    } catch (err) {
      setConnectError(err instanceof ApiError ? err.message : `Failed to connect ${repo.name}`)
    } finally {
      setConnectingId(null)
    }
  }

  return (
    <Modal title="Connect a repository" onClose={onClose}>
      <div className={s.search}>
        <span className={s.searchIcon}>
          <SearchIcon size={14} />
        </span>
        <Input
          className={s.searchInput}
          type="text"
          placeholder="Search repositories"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />
      </div>

      {(loadError || connectError) && <ErrorBanner message={loadError ?? connectError ?? ''} />}

      {loading && (
        <div className={s.skeletons}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={34} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className={s.status}>{search ? `No repositories match “${search}”.` : 'No repositories found.'}</p>
      )}

      <div className={s.list}>
        {filtered.map((repo) => {
          const connected = connectedKeys.has(`${repo.owner.login}/${repo.name}`)
          const connecting = connectingId === repo.id
          return (
            <div key={repo.id} className={s.row}>
              <span className={s.repo}>
                <span className={s.owner}>{repo.owner.login}/</span>
                <span className={s.name}>{repo.name}</span>
              </span>
              {connected ? (
                <span className={s.connected}>
                  <CheckIcon size={13} />
                  Connected
                </span>
              ) : (
                <Button size="sm" disabled={connecting} onClick={() => handleConnect(repo)}>
                  {connecting && <Spinner />}
                  {connecting ? 'Connecting' : 'Connect'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export default ConnectRepoModal

import { useEffect, useState } from 'react'
import { API_BASE, extractErrorMessage } from '../api'

interface GithubRepo {
  id: number
  name: string
  owner: { login: string }
}

interface ConnectedRepo {
  id: number
  name: string
  owner: string
}

interface ConnectRepoModalProps {
  connectedRepos: ConnectedRepo[]
  onClose: () => void
  onConnected: () => void
}

function ConnectRepoModal({ connectedRepos, onClose, onConnected }: ConnectRepoModalProps) {
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [connectingId, setConnectingId] = useState<number | null>(null)

  useEffect(() => {
    const fetchRepos = async () => {
      const response = await fetch(`${API_BASE}/user/repos`, {
        credentials: 'include',
      })
      if (!response.ok) {
        setError(await extractErrorMessage(response, 'Failed to load repositories'))
        setLoading(false)
        return
      }
      const data: GithubRepo[] = await response.json()
      setRepos(data)
      setLoading(false)
    }
    fetchRepos()
  }, [])

  const isConnected = (repo: GithubRepo) =>
    connectedRepos.some((c) => c.owner === repo.owner.login && c.name === repo.name)

  const handleConnect = async (repo: GithubRepo) => {
    setConnectingId(repo.id)
    const response = await fetch(`${API_BASE}/repos/connect`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: repo.owner.login, name: repo.name }),
    })
    setConnectingId(null)
    if (!response.ok) {
      setError(await extractErrorMessage(response, `Failed to connect ${repo.name}`))
      return
    }
    onConnected()
  }

  const filteredRepos = repos.filter((repo) =>
    `${repo.owner.login}/${repo.name}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          color: 'black',
          padding: '1.5rem',
          borderRadius: '8px',
          width: '28rem',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Connect a repository</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ margin: '1rem 0', padding: '0.5rem' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {loading ? (
          <p>Loading repositories...</p>
        ) : (
          <ul style={{ overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredRepos.map((repo) => {
              const connected = isConnected(repo)
              return (
                <li
                  key={repo.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                  }}
                >
                  <span>
                    {repo.owner.login}/{repo.name}
                  </span>
                  <button
                    disabled={connected || connectingId === repo.id}
                    onClick={() => handleConnect(repo)}
                  >
                    {connected ? 'Connected' : connectingId === repo.id ? 'Connecting...' : 'Connect'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ConnectRepoModal

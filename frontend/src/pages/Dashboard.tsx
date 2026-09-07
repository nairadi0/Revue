import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { API_BASE, extractErrorMessage } from '../api'
import ConnectRepoModal from './ConnectRepoModal'

interface ConnectedRepo {
  id: number
  name: string
  owner: string
  connected_at: string
}

function Dashboard() {
  const navigate = useNavigate()
  const [repos, setRepos] = useState<ConnectedRepo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchConnectedRepos = useCallback(async () => {
    const response = await fetch(`${API_BASE}/user/connected-repos`, {
      credentials: 'include',
    })
    if (response.status === 401) {
      navigate('/')
      return
    }
    if (!response.ok) {
      setError(await extractErrorMessage(response, 'Failed to load connected repositories'))
      return
    }
    const data: ConnectedRepo[] = await response.json()
    setRepos(data)
  }, [navigate])

  useEffect(() => {
    fetchConnectedRepos()
  }, [fetchConnectedRepos])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>
        <Link to="/metrics">Metrics</Link> · <Link to="/runs">Agent Runs</Link>
      </p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={() => setModalOpen(true)}>+ Add Repo</button>
      <ul>
        {repos.map((repo) => (
          <li key={repo.id}>
            {repo.owner}/{repo.name}{' '}
            <Link to={`/repos/${repo.id}/prs`}>View PRs</Link>
          </li>
        ))}
      </ul>
      {modalOpen && (
        <ConnectRepoModal
          connectedRepos={repos}
          onClose={() => setModalOpen(false)}
          onConnected={fetchConnectedRepos}
        />
      )}
    </div>
  )
}

export default Dashboard

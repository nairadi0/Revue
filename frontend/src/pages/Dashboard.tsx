import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

const API_BASE = 'http://localhost:8000'

interface GithubRepo {
  id: number
  name: string
  owner: { login: string }
}

interface RepoRow extends GithubRepo {
  connectedId: number | null
}

function Dashboard() {
  const navigate = useNavigate()
  const [repos, setRepos] = useState<RepoRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRepos = async () => {
      const response = await fetch(`${API_BASE}/user/repos`, {
        credentials: 'include',
      })
      if (response.status === 401) {
        navigate('/')
        return
      }
      if (!response.ok) {
        setError(`Failed to load Repositories: ${response.status}`)
        return
      }
      const data: GithubRepo[] = await response.json()
      setRepos(data.map((repo) => ({ ...repo, connectedId: null })))
    }
    fetchRepos()
  }, [navigate])

  const handleConnect = async (repo: RepoRow) => {
    const response = await fetch(`${API_BASE}/repos/connect`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: repo.owner.login, name: repo.name }),
    })
    if (!response.ok) {
      setError(`Failed to connect ${repo.name}: ${response.status}`)
      return
    }
    const connected = await response.json()
    setRepos((prev) =>
      prev.map((r) => (r.id === repo.id ? { ...r, connectedId: connected.id } : r)),
    )
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {repos.map((repo) => (
          <li key={repo.id}>
            {repo.owner.login}/{repo.name}{' '}
            {repo.connectedId !== null ? (
              <Link to={`/repos/${repo.connectedId}/prs`}>View PRs</Link>
            ) : (
              <button onClick={() => handleConnect(repo)}>Connect</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Dashboard

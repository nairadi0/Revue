import { useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { API_BASE, extractErrorMessage } from '../api'


interface PR {
  id: number
  pr_number: number
  title: string
  author: string
  status: string
}


function PrList() {
  const navigate = useNavigate()
  const [prs, setPRs] = useState<PR[]>([])
  const [error, setError] = useState<string | null>(null)
  const { repoId } = useParams()
  
  useEffect(() => {
      const fetchPRs = async () => {
        const response = await fetch(`${API_BASE}/repos/${repoId}/prs`, {
          credentials: 'include',
        })
        if (response.status === 401) {
          navigate('/')
          return
        }
        if (!response.ok) {
          setError(await extractErrorMessage(response, 'Failed to load pull requests'))
          return
        }
        const data: PR[] = await response.json()
        setPRs(data)

      }
      fetchPRs()
    }, [navigate, repoId])
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Pull Requests</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {prs.map((pr) => (
          <li key={pr.id}>
            {pr.pr_number}/{pr.title}/{pr.author}/{pr.status}
            (
              <Link to={`/repos/${repoId}/prs/${pr.pr_number}`}>View PR</Link>
            ) 
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PrList

import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export interface SessionUser {
  username: string
  avatar_url?: string | null
}

export function useSession(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    let active = true
    apiFetch<SessionUser>('/user/me')
      .then((data) => {
        if (active) setUser(data)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return user
}

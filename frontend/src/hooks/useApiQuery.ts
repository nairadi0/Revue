import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, apiFetch } from '../api'

interface QueryState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

interface QueryResult<T> extends QueryState<T> {
  refetch: () => Promise<void>
}

export function useApiQuery<T>(path: string, fallback: string): QueryResult<T> {
  const navigate = useNavigate()
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true })

  const refetch = useCallback(
    () =>
      apiFetch<T>(path, {}, fallback).then(
        (data) => setState({ data, error: null, loading: false }),
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 401) {
            navigate('/')
            return
          }
          setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : fallback, loading: false }))
        },
      ),
    [path, fallback, navigate],
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ...state, refetch }
}

import { useApiQuery } from './useApiQuery'
import type { ConnectedRepo } from '../pages/Dashboard'

export function useRepo(repoId: string | undefined): ConnectedRepo | null {
  const { data } = useApiQuery<ConnectedRepo[]>('/user/connected-repos', 'Failed to load repositories')
  return data?.find((repo) => String(repo.id) === repoId) ?? null
}

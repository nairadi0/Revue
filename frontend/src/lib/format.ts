const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/

export function parseUtc(iso: string): Date {
  return new Date(HAS_TIMEZONE.test(iso) ? iso : `${iso}Z`)
}

export function formatRelative(iso: string): string {
  const elapsed = (Date.now() - parseUtc(iso).getTime()) / 1000
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= seconds) {
      return relativeFormatter.format(-Math.round(elapsed / seconds), unit)
    }
  }
  return 'just now'
}

export function formatDateTime(iso: string | null): string {
  return iso ? parseUtc(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  return formatElapsed((parseUtc(completedAt).getTime() - parseUtc(startedAt).getTime()) / 1000)
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, seconds)
  if (total < 60) return `${total.toFixed(1)}s`
  const minutes = Math.floor(total / 60)
  return `${minutes}m ${Math.round(total % 60)}s`
}

export function formatCount(value: number): string {
  return value.toLocaleString()
}

export function splitPath(filePath: string): { dir: string; name: string } {
  const index = filePath.lastIndexOf('/')
  return index === -1
    ? { dir: '', name: filePath }
    : { dir: filePath.slice(0, index + 1), name: filePath.slice(index + 1) }
}

export function shortPath(filePath: string): string {
  const segments = filePath.split('/')
  return segments.slice(-2).join('/')
}

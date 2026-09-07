import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { SEVERITY_BG, SEVERITY_COLOR } from '../lib/severity'
import s from './ui.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  const classes = [s.btn, s[variant], size !== 'md' ? s[size] : '', className ?? ''].filter(Boolean)
  return <button {...props} className={classes.join(' ')} />
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={[s.card, padded ? s.cardPad : '', className ?? ''].filter(Boolean).join(' ')}>{children}</div>
}

export function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={s.cardHeader}>
      <h2 className={s.cardTitle}>{title}</h2>
      {hint && <span className={s.cardHint}>{hint}</span>}
    </div>
  )
}

export function Badge({
  color,
  background,
  border,
  pulse = false,
  children,
}: {
  color: string
  background: string
  border?: string
  pulse?: boolean
  children: ReactNode
}) {
  return (
    <span className={s.badge} style={{ color, background, borderColor: border ?? 'transparent' }}>
      <span className={[s.dot, pulse ? s.dotPulse : ''].filter(Boolean).join(' ')} />
      {children}
    </span>
  )
}

const RUN_STATUS: Record<string, { color: string; background: string }> = {
  PENDING: { color: 'var(--neutral)', background: 'var(--neutral-bg)' },
  RUNNING: { color: 'var(--warning)', background: 'var(--warning-bg)' },
  SUCCESS: { color: 'var(--good)', background: 'var(--good-bg)' },
  FAILED: { color: 'var(--critical)', background: 'var(--critical-bg)' },
}

export function StatusBadge({ status }: { status: string }) {
  const tone = RUN_STATUS[status] ?? RUN_STATUS.PENDING
  return (
    <Badge color={tone.color} background={tone.background} pulse={status === 'RUNNING' || status === 'PENDING'}>
      {status}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      color={SEVERITY_COLOR[severity] ?? 'var(--neutral)'}
      background={SEVERITY_BG[severity] ?? 'var(--neutral-bg)'}
    >
      {severity}
    </Badge>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className={s.chip}>{children}</span>
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[s.input, className ?? ''].filter(Boolean).join(' ')} />
}

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  badge,
  subtitle,
  crumbs,
  actions,
}: {
  title: ReactNode
  badge?: ReactNode
  subtitle?: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
}) {
  return (
    <header className={s.pageHeader}>
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav className={s.crumbs}>
            {crumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`}>
                {i > 0 && <span className={s.crumbSep}>/ </span>}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </span>
            ))}
          </nav>
        )}
        <div className={s.titleRow}>
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={s.headerActions}>{actions}</div>}
    </header>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={s.statTile}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {hint && <div className={s.statHint}>{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <h2>{title}</h2>
      {text && <p className={s.emptyText}>{text}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={s.banner} role="alert">
      <svg className={s.bannerIcon} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: string }) {
  return <div className={s.skeleton} style={{ height, width, borderRadius: radius }} />
}

export function Spinner() {
  return <span className={s.spinner} aria-hidden="true" />
}

import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

function Icon({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  )
}

export function LogoMark({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="var(--accent)" />
      <path
        d="M7.5 8.25 10.75 15.5 16.5 6.5"
        stroke="var(--accent-ink)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GitHubIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </Icon>
  )
}

export function RepoIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v11.5a.75.75 0 0 1-.75.75H4.5a1 1 0 0 0 0 2h8.75a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 13.5v-11Zm10.5-1H4.5a1 1 0 0 0-1 1v8.09c.3-.11.65-.09 1-.09h8V1.5Z" />
    </Icon>
  )
}

export function ActivityIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6.25 1a.75.75 0 0 1 .71.51l3.04 8.86 1.54-3.87A.75.75 0 0 1 12.24 6H15a.75.75 0 0 1 0 1.5h-2.25l-2.3 5.77a.75.75 0 0 1-1.41-.03L6 4.4 4.46 8.28A.75.75 0 0 1 3.76 8.75H1a.75.75 0 0 1 0-1.5h2.25l2.3-5.77A.75.75 0 0 1 6.25 1Z" />
    </Icon>
  )
}

export function ChartIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M1.75 1a.75.75 0 0 1 .75.75v11.5c0 .14.11.25.25.25h11.5a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75A.75.75 0 0 1 1.75 1Zm11.5 3a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75Zm-3.5 2a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 9.75 6Zm-3.5-3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5A.75.75 0 0 1 6.25 3Z" />
    </Icon>
  )
}

export function FileIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M2 1.75C2 .78 2.78 0 3.75 0h5.19c.46 0 .9.18 1.23.51l3.32 3.32c.33.33.51.77.51 1.23v9.19c0 .97-.78 1.75-1.75 1.75h-8.5C2.78 16 2 15.22 2 14.25V1.75Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .14.11.25.25.25h8.5a.25.25 0 0 0 .25-.25V6H9.75A.75.75 0 0 1 9 5.25V1.5H3.75ZM10.5 2.06V4.5h2.44L10.5 2.06Z" />
    </Icon>
  )
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M10.68 11.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 7a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0Z" />
    </Icon>
  )
}

export function ChevronRight({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
    </Icon>
  )
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z" />
    </Icon>
  )
}

export function CheckIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.97 2.97 5.97-5.97a.75.75 0 0 1 1.06 0Z" />
    </Icon>
  )
}

export function SparkIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M8 0.5c.32 0 .6.2.71.5l1.02 2.85a2 2 0 0 0 1.2 1.2l2.86 1.03a.75.75 0 0 1 0 1.41l-2.85 1.03a2 2 0 0 0-1.2 1.2L8.7 12.57a.75.75 0 0 1-1.41 0L6.27 9.72a2 2 0 0 0-1.2-1.2L2.2 7.49a.75.75 0 0 1 0-1.41l2.86-1.03a2 2 0 0 0 1.2-1.2L7.29 1a.75.75 0 0 1 .71-.5Zm5 8.5c.31 0 .59.2.7.49l.36 1 1 .36a.75.75 0 0 1 0 1.4l-1 .36-.36 1a.75.75 0 0 1-1.4 0l-.36-1-1-.36a.75.75 0 0 1 0-1.4l1-.36.36-1a.75.75 0 0 1 .7-.49Z" />
    </Icon>
  )
}

export function ShieldIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M7.47.24a1.25 1.25 0 0 1 1.06 0l5 2.31c.44.2.72.65.72 1.14v4.15c0 3.2-2.08 6.03-5.13 6.98a1.25 1.25 0 0 1-.74 0C5.33 13.87 3.25 11.04 3.25 7.84V3.69c0-.49.28-.94.72-1.14l3.5-1.62Zm.53 1.4L3.75 3.83v4.01c0 2.55 1.62 4.8 4.03 5.58l.22.06.22-.06c2.41-.78 4.03-3.03 4.03-5.58V3.83L8 1.64Z" />
    </Icon>
  )
}

export function MemoryIcon({ size = 16 }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M6 1.75A2.75 2.75 0 0 1 8 1a2.75 2.75 0 0 1 2 .75A2.5 2.5 0 0 1 13 4.2a2.75 2.75 0 0 1 .5 4.05v2.25A2.5 2.5 0 0 1 11 13a2.5 2.5 0 0 1-3 1.9A2.5 2.5 0 0 1 5 13a2.5 2.5 0 0 1-2.5-2.5V8.25A2.75 2.75 0 0 1 3 4.2 2.5 2.5 0 0 1 6 1.75Zm1.25 1.4a1.25 1.25 0 0 0-2.4.4.75.75 0 0 1-.75.7 1 1 0 0 0-.6 1.8.75.75 0 0 1 .25.86 1.25 1.25 0 0 0 .5 1.5.75.75 0 0 1 .5.7v2.15c0 .55.45 1 1 1a.75.75 0 0 1 .75.65 1 1 0 0 0 .75.85V3.15Zm1.5 10.6a1 1 0 0 0 .75-.85.75.75 0 0 1 .75-.65c.55 0 1-.45 1-1V8.11a.75.75 0 0 1 .5-.7 1.25 1.25 0 0 0 .5-1.5.75.75 0 0 1 .25-.86 1 1 0 0 0-.6-1.8.75.75 0 0 1-.75-.7 1.25 1.25 0 0 0-2.4-.4v10.6Z" />
    </Icon>
  )
}

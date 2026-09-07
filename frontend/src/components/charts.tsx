import { useState } from 'react'
import { formatCount } from '../lib/format'
import s from './charts.module.css'

export interface BarItem {
  key: string
  label: string
  value: number
  color?: string
}

export function BarList({ items, showSwatch = false }: { items: BarItem[]; showSwatch?: boolean }) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className={s.barList}>
      {items.map((item) => {
        const color = item.color ?? 'var(--accent)'
        return (
          <div key={item.key} className={s.barRow} title={`${item.label}: ${formatCount(item.value)}`}>
            <div className={s.barLabel}>
              {showSwatch && <span className={s.swatch} style={{ background: color }} />}
              <span className={s.barLabelText}>{item.label}</span>
            </div>
            <div className={s.track}>
              <div
                className={s.fill}
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: color }}
              />
            </div>
            <div className={s.barValue}>{formatCount(item.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

export interface TrendPoint {
  label: string
  value: number
}

const W = 640
const H = 200
const PAD = { top: 10, right: 10, bottom: 22, left: 30 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function niceMax(value: number): number {
  if (value <= 5) return 5
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

function tickIndexes(count: number): number[] {
  if (count <= 4) return Array.from({ length: count }, (_, i) => i)
  const step = (count - 1) / 3
  return [0, 1, 2, 3].map((i) => Math.round(i * step))
}

export function TrendChart({ points, formatLabel }: { points: TrendPoint[]; formatLabel?: (label: string) => string }) {
  const [active, setActive] = useState<number | null>(null)

  if (points.length === 0) return null

  const top = niceMax(Math.max(...points.map((point) => point.value), 1))
  const x = (index: number) => PAD.left + (points.length === 1 ? PLOT_W / 2 : (index / (points.length - 1)) * PLOT_W)
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H

  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(point.value)}`).join(' ')
  const areaPath = `${path} L${x(points.length - 1)},${PAD.top + PLOT_H} L${x(0)},${PAD.top + PLOT_H} Z`
  const bandWidth = points.length === 1 ? PLOT_W : PLOT_W / (points.length - 1)
  const activePoint = active === null ? null : points[active]

  return (
    <div className={s.trend} onMouseLeave={() => setActive(null)}>
      <svg className={s.trendSvg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Findings over time">
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line className={s.grid} x1={PAD.left} x2={W - PAD.right} y1={y(top * ratio)} y2={y(top * ratio)} />
            <text className={s.axisText} x={PAD.left - 8} y={y(top * ratio) + 3} textAnchor="end">
              {formatCount(Math.round(top * ratio))}
            </text>
          </g>
        ))}

        {points.length > 1 && <path className={s.area} d={areaPath} />}
        {points.length > 1 && <path className={s.line} d={path} />}
        {points.length === 1 && <circle className={s.marker} cx={x(0)} cy={y(points[0].value)} r={4} />}

        {tickIndexes(points.length).map((index) => (
          <text
            key={index}
            className={s.axisText}
            x={x(index)}
            y={H - 6}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          >
            {formatLabel ? formatLabel(points[index].label) : points[index].label}
          </text>
        ))}

        {active !== null && (
          <g>
            <line className={s.crosshair} x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + PLOT_H} />
            <circle className={s.marker} cx={x(active)} cy={y(points[active].value)} r={4.5} />
          </g>
        )}

        {points.map((point, i) => (
          <rect
            key={point.label}
            className={s.hit}
            x={x(i) - bandWidth / 2}
            y={PAD.top}
            width={bandWidth}
            height={PLOT_H}
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>

      {activePoint && active !== null && (
        <div
          className={s.tooltip}
          style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(activePoint.value) / H) * 100}%`, marginTop: '-10px' }}
        >
          <div className={s.tooltipLabel}>{activePoint.label}</div>
          <div className={s.tooltipValue}>
            {formatCount(activePoint.value)} {activePoint.value === 1 ? 'finding' : 'findings'}
          </div>
        </div>
      )}
    </div>
  )
}

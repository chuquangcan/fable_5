import { useRef } from 'react'

interface Props {
  axis: 'x' | 'y'
  value: number
  min: number
  max: number
  /** Moving left/up grows the value (a panel on the right or below the edge). */
  invert?: boolean
  label: string
  onChange: (v: number) => void
  /** Double-click: collapse / restore. */
  onToggle?: () => void
}

const STEP = 16

/** A draggable edge between two panes (mouse, or arrow keys when focused). */
export function Resizer({ axis, value, min, max, invert = false, label, onChange, onToggle }: Props) {
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)))
  const live = useRef(value)
  live.current = value
  const sign = invert ? -1 : 1

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const start = axis === 'x' ? e.clientX : e.clientY
    const from = live.current
    const move = (ev: MouseEvent) => onChange(clamp(from + sign * ((axis === 'x' ? ev.clientX : ev.clientY) - start)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const grow = axis === 'x' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 }
    const d = grow[e.key as keyof typeof grow]
    if (d === undefined) return
    e.preventDefault()
    onChange(clamp(value + sign * d * STEP))
  }

  return (
    <div
      role="separator" aria-label={label} aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
      className={`resizer resizer-${axis}`} onMouseDown={onMouseDown} onKeyDown={onKeyDown} onDoubleClick={onToggle}
    />
  )
}

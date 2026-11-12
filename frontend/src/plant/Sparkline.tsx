/** Tiny trend line; a dashed target line when given. Fewer than two values draw no line. */
export function Sparkline({ values, target, width = 80, height = 18 }: { values: number[]; target?: number | null; width?: number; height?: number }) {
  const all = target != null ? [...values, target] : values
  const lo = Math.min(...all), hi = Math.max(...all)
  const y = (v: number) => (hi === lo ? height / 2 : height - 2 - ((v - lo) / (hi - lo)) * (height - 4))
  const d = values.length < 2 ? null : values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg data-testid="sparkline" width={width} height={height} aria-hidden="true">
      {d && target != null && <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="#9AA1AA" strokeDasharray="2 2" />}
      {d && <path d={d} fill="none" stroke="#0E7C86" strokeWidth={1.5} />}
    </svg>
  )
}

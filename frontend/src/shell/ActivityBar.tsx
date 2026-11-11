import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {children}
    </svg>
  )
}

function Badge({ n, bg }: { n: number; bg: string }) {
  return (
    <span
      style={{
        position: 'absolute', right: 6, top: 6, minWidth: 14, height: 14, padding: '0 3px', background: bg,
        color: '#FFFFFF', fontSize: 10, lineHeight: '14px', fontWeight: 600,
      }}
    >
      {n}
    </span>
  )
}

export function ActivityBar() {
  return (
    <nav
      aria-label="Views"
      style={{ width: 48, flex: 'none', background: 'var(--activity)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}
    >
      <button className="ab" title="Plant view" aria-label="Plant view" disabled>
        <Icon><path d="M3 20V10l5 3v-3l5 3v-3l5 3V4h3v16z" /></Icon>
      </button>
      <button className="ab" title="Thread explorer" aria-label="Thread explorer" style={{ color: '#FFFFFF', boxShadow: 'inset 2px 0 0 #3FB6C0' }}>
        <Icon>
          <circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="8" r="2.2" /><circle cx="9" cy="18" r="2.2" />
          <path d="M8.2 6.3l7.6 1.3M6.6 8.2l1.8 7.6M16.6 9.8l-6.2 6.6" />
        </Icon>
        <Badge n={1} bg="var(--teal)" />
      </button>
      <button className="ab" title="Claims" aria-label="Claims">
        <Icon><path d="M12 4 3 20h18z" /><path d="M12 10v5M12 17.5v.6" /></Icon>
        <Badge n={2} bg="var(--red)" />
      </button>
      <button className="ab" title="Assistant" aria-label="Assistant">
        <Icon><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>
      </button>
      <button className="ab" title="Reports" aria-label="Reports">
        <Icon><path d="M5 3h14v18H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>
      </button>
      <div style={{ flex: 1 }} />
      <button className="ab" title="Data sources" aria-label="Data sources" disabled>
        <Icon>
          <ellipse cx="12" cy="6" rx="7" ry="2.6" />
          <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
        </Icon>
      </button>
    </nav>
  )
}

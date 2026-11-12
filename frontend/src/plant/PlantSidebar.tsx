import { getPlant } from '../api/client'
import { Pending, useAsync } from '../evidence/useAsync'
import { useDemo } from '../store/demo'

/** Plant assets by area. Volume nodes (serials, boxes) are counted, not listed. */
export function PlantSidebar() {
  const dataVersion = useDemo((s) => s.dataVersion)
  const selected = useDemo((s) => s.twin.selected)
  const goTo = useDemo((s) => s.goTo)
  const s = useAsync(getPlant, [dataVersion])
  return (
    <>
      <div className="side-title">Plant · Plant 1</div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {s.status !== 'ok' ? <Pending state={s} /> : s.data.map((a) => (
          <section key={a.id} aria-label={a.label}>
            <div className="sec"><span>{a.label}</span>{a.volume && <span className="mut" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{a.volume}</span>}</div>
            {a.groups.map((g) => (
              <div key={g.type}>
                <div className="grp">{g.label}</div>
                {g.items.map((i) => (
                  <button
                    key={i.id} className={`asset${selected === i.id ? ' on' : ''}`} aria-current={selected === i.id || undefined}
                    onClick={() => void goTo(i.id)}
                  >
                    <span className="mono" style={{ fontWeight: 500 }}>{i.name}</span>
                    {i.name !== i.id && <span className="mut mono" style={{ fontSize: 11 }}>{i.id}</span>}
                    <span style={{ flex: 1 }} />
                    {i.to_review > 0 && <span className="chip st-pending" title="Links pending review">{i.to_review}</span>}
                    {i.docs > 0 && <span className="chip" title="Documents">{`${i.docs} docs`}</span>}
                    {i.sub && <span className="mut sub ellipsis">{i.sub}</span>}
                  </button>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

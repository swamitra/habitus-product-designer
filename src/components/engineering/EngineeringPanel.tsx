import { CheckCircle, Warning, XCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import type { HandleDesign } from '../../lib/design'
import { evaluateDfm } from '../../tools/dfm/solver'
import { brandRegistry } from '../../tools/brands/registry'

export function EngineeringPanel({ design }: { design: HandleDesign }) {
  const [open, setOpen] = useState(false)
  const report = evaluateDfm(design)
  return <section className={`engineering-panel ${report.status}`}>
    <button className="engineering-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
      {report.status === 'blocked' ? <XCircle size={17} /> : report.status === 'review' ? <Warning size={17} /> : <CheckCircle size={17} />}
      <span><strong>{report.status === 'blocked' ? 'Engineering changes needed' : report.status === 'review' ? 'Design review recommended' : 'Basic DFM checks passed'}</strong><small>{report.findings.length} checks against the current specification</small></span>
    </button>
    {open && <div className="engineering-details">{report.findings.map((finding) => <article key={finding.id} className={finding.severity}><strong>{finding.title}</strong><p>{finding.detail}</p>{finding.action && <small>{finding.action}</small>}</article>)}<div className="brand-references"><strong>Reference library</strong>{brandRegistry.map((brand) => <a key={brand.id} href={brand.url} target="_blank" rel="noreferrer" title={brand.relevance}>{brand.name}<span>{brand.origin}</span></a>)}</div><p className="engineering-disclaimer">Rule-based concept checks only. Final structural, code, and manufacturing approval remains with qualified engineers and the fabricator.</p></div>}
  </section>
}

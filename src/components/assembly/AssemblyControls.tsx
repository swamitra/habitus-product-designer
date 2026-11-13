import type { AssemblyView, EscutcheonType, HandleDesign } from '../../lib/design'

export function AssemblyControls({ design, onChange }: { design: HandleDesign; onChange: <K extends keyof HandleDesign>(key: K, value: HandleDesign[K]) => void }) {
  return <section className="assembly-controls">
    <div className="section-title"><span>Door assembly</span><span className="section-index">04</span></div>
    <label>Escutcheon<select value={design.escutcheon ?? 'round-rose'} onChange={(event) => onChange('escutcheon', event.target.value as EscutcheonType)}><option value="round-rose">Round rose</option><option value="long-plate">Long escutcheon</option></select></label>
    <label>Door thickness<span className="inline-unit"><input type="number" min="30" max="80" value={design.doorThickness ?? 44} onChange={(event) => onChange('doorThickness', Number(event.target.value))} /> mm</span></label>
    <label>Square spindle<select value={design.spindleSize ?? 8} onChange={(event) => onChange('spindleSize', Number(event.target.value))}><option value="8">8 × 8 mm</option><option value="9">9 × 9 mm</option><option value="10">10 × 10 mm</option></select></label>
    <label>Assembly view<select value={design.assemblyView ?? 'pair'} onChange={(event) => onChange('assemblyView', event.target.value as AssemblyView)}><option value="pair">Exterior + interior</option><option value="exterior">Exterior only</option><option value="interior">Interior only</option><option value="exploded">Exploded assembly</option></select></label>
    <small>Spindle length is calculated from door thickness plus 56 mm engagement allowance.</small>
  </section>
}

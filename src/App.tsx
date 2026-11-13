import { useEffect, useState } from 'react'
import { ArrowLineDown, ArrowUpRight, Check, CaretDown, Question, Cube, Download, GridFour, Link, Plus, ArrowsClockwise, SlidersHorizontal, X } from '@phosphor-icons/react'
import { HandleModel } from './components/HandleModel'
import { IdeaStudio } from './components/IdeaStudio'
import { defaultDesign, downloadJson, finishes, presets, validateDesign, type HandleDesign, type HandleType, type ProfileId } from './lib/design'
import './App.css'

type Modal = 'library' | 'export' | 'help' | null

function Dimension({ label, value, unit = 'mm', min, max, onChange }: { label: string; value: number; unit?: string; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="dimension"><span>{label}</span><span className="number-input"><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /><span>{unit}</span></span><input aria-label={`${label} slider`} type="range" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

export default function App() {
  const [design, setDesign] = useState<HandleDesign>(() => {
    try { return JSON.parse(localStorage.getItem('aperture-design') || 'null') ?? defaultDesign } catch { return defaultDesign }
  })
  const [modal, setModal] = useState<Modal>(null)
  const [editorMode, setEditorMode] = useState<'idea' | 'details'>('idea')
  const [autoRotate, setAutoRotate] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)
  const [blenderStatus, setBlenderStatus] = useState<'checking' | 'connected' | 'offline'>('checking')
  const [exportFormat, setExportFormat] = useState<'glb' | 'blend'>('glb')
  const [exportUrl, setExportUrl] = useState('')
  const [exportError, setExportError] = useState('')
  const update = <K extends keyof HandleDesign>(key: K, value: HandleDesign[K]) => setDesign((current) => ({ ...current, [key]: value }))
  const changeType = (type: HandleType) => setDesign((current) => ({ ...current, type, ...(type === 'lever' ? { length: 130, projection: 52, roseDiameter: 52, returnAngle: 12 } : { length: 300, projection: 55, roseDiameter: 38, returnAngle: 90 }) }))
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3500) }

  useEffect(() => { localStorage.setItem('aperture-design', JSON.stringify(design)) }, [design])
  useEffect(() => {
    fetch('/api/blender/status').then((response) => response.json()).then((data) => setBlenderStatus(data.connected ? 'connected' : 'offline')).catch(() => setBlenderStatus('offline'))
  }, [])
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  const sendToBlender = async () => {
    const error = validateDesign(design)
    if (error) { notify(error); return }
    setSending(true)
    try {
      const response = await fetch('/api/blender/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(design) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Blender could not create this design.')
      setBlenderStatus('connected')
      notify(`Created ${design.name} in Blender.`)
    } catch (error) { notify(error instanceof Error ? error.message : 'Blender is unavailable.') } finally { setSending(false) }
  }
  const exportDesign = async () => {
    setExportError(''); setExportUrl('')
    if (exportFormat === 'glb') {
      const { exportGlb } = await import('./lib/exportGlb')
      const url = await exportGlb(design)
      setExportUrl(url); return
    }
    try {
      const response = await fetch('/api/blender/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(design) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setExportUrl(result.url)
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Export failed. Connect Blender to export a .blend file.') }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Aperture home"><span className="brand-mark"><span /><span /></span><span>aperture<span className="brand-period">.</span></span></a>
      <span className="brand-description">Architectural objects,<br />made by you.</span>
      <nav aria-label="Main navigation"><button className="nav-active" onClick={() => setModal(null)}>Studio</button><button onClick={() => setModal('library')}>Library</button><button onClick={() => setModal('help')}>Guide <ArrowUpRight size={13} /></button></nav>
      <div className="header-actions"><span className="local-label">LOCAL WORKSPACE</span><button className="avatar" onClick={() => notify('Your designs are saved in this browser.')} aria-label="Workspace information">H</button></div>
    </header>

    <main className="workspace">
      {editorMode === 'idea' ? <IdeaStudio design={design} onDesign={setDesign} onFineTune={() => setEditorMode('details')} /> : <aside className="control-panel">
        <div className="panel-heading"><div><span className="eyebrow">PRODUCT CONFIGURATOR</span><h1>Shape the everyday.</h1></div><SlidersHorizontal size={19} /></div>
        <section className="control-section"><div className="section-title"><span>Handle type</span><span className="section-index">01</span></div><div className="type-switch"><button className={design.type === 'pull' ? 'selected' : ''} onClick={() => changeType('pull')}><span className="pull-icon" />Pull handle</button><button className={design.type === 'lever' ? 'selected' : ''} onClick={() => changeType('lever')}><span className="lever-icon" />Lever handle</button></div></section>
        <section className="control-section"><div className="section-title"><span>Dimensions</span><span className="section-index">02</span></div>
          <Dimension label={design.type === 'pull' ? 'Centre to centre' : 'Lever length'} value={design.length} min={design.type === 'pull' ? 150 : 90} max={design.type === 'pull' ? 1200 : 180} onChange={(value) => update('length', value)} />
          <Dimension label="Projection" value={design.projection} min={35} max={100} onChange={(value) => update('projection', value)} />
          <Dimension label="Bar diameter" value={design.diameter} min={12} max={40} onChange={(value) => update('diameter', value)} />
          <Dimension label="Rose diameter" value={design.roseDiameter} min={25} max={80} onChange={(value) => update('roseDiameter', value)} />
        </section>
        <section className="control-section"><div className="section-title"><span>Bar profile</span><span className="section-index">03</span></div><div className="profile-switch">{(['round', 'square', 'soft'] as ProfileId[]).map((profile) => <button key={profile} className={design.profile === profile ? 'selected' : ''} onClick={() => update('profile', profile)}><span className={`profile-shape ${profile}`} />{profile === 'soft' ? 'Soft square' : profile.charAt(0).toUpperCase() + profile.slice(1)}</button>)}</div></section>
        <section className="control-section finish-section"><div className="section-title"><span>Finish</span><span className="finish-name">{finishes.find((finish) => finish.id === design.finish)?.name}</span></div><div className="finish-options">{finishes.map((finish) => <button key={finish.id} className={`finish-swatch ${finish.id} ${design.finish === finish.id ? 'selected' : ''}`} style={{ '--swatch': finish.color } as React.CSSProperties} onClick={() => update('finish', finish.id)} aria-label={finish.name} title={finish.name}>{design.finish === finish.id && <Check size={15} weight="bold" />}</button>)}</div></section>
        <div className="panel-bottom"><button className="reset-button" onClick={() => setEditorMode('idea')}>Back to your idea</button><button className="reset-button" onClick={() => setDesign(defaultDesign)}>Reset to default</button><span>All dimensions in millimetres</span></div>
      </aside>}

      <section className="viewport-panel">
        <div className="viewport-top"><div className="project-name"><span className="project-label">CURRENT DESIGN</span><input aria-label="Design name" value={design.name} onChange={(event) => update('name', event.target.value)} /><span className="saved-label"><Check size={12} /> Saved locally</span></div><button className="icon-button help-button" onClick={() => setModal('help')} aria-label="Open guide"><Question size={20} /></button></div>
        <div className="canvas-wrap"><HandleModel design={design} autoRotate={autoRotate} showGrid={showGrid} /><div className="view-label"><Cube size={14} /> Perspective <CaretDown size={12} /></div><div className="model-caption"><span>{design.productType === 'door' ? 'DOOR CONCEPT' : design.type === 'pull' ? 'PULL HANDLE' : 'LEVER HANDLE'}</span><strong>{design.name}</strong><span>{finishes.find((finish) => finish.id === design.finish)?.name} / {design.profile === 'soft' ? 'Soft square' : design.profile} profile</span></div><div className="axis-gizmo"><span className="axis-y">Y</span><span className="axis-z">Z</span><span className="axis-x">X</span><i /></div></div>
        <div className="viewport-toolbar"><div><button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(!autoRotate)}><ArrowsClockwise size={17} />{autoRotate ? 'Stop rotation' : 'Auto rotate'}</button><button className={showGrid ? 'active' : ''} onClick={() => setShowGrid(!showGrid)}><GridFour size={16} />Grid</button></div><span>Drag to orbit <i /> Scroll to zoom</span></div>
        <div className="spec-strip"><div><span>{design.productType === 'door' ? 'WIDTH' : 'OVERALL LENGTH'}</span><strong>{design.productType === 'door' ? design.width : design.length}<small> mm</small></strong></div><div><span>{design.productType === 'door' ? 'HEIGHT' : 'PROJECTION'}</span><strong>{design.productType === 'door' ? design.height : design.projection}<small> mm</small></strong></div><div><span>{design.productType === 'door' ? 'THICKNESS' : 'BAR DIAMETER'}</span><strong>{design.productType === 'door' ? design.thickness : design.diameter}<small> mm</small></strong></div><div className="spec-material"><span>MATERIAL</span><strong>{finishes.find((finish) => finish.id === design.finish)?.name}</strong></div></div>
      </section>

      <aside className="action-panel"><div className="action-heading"><Cube size={20} /><h2>From screen<br />to solid.</h2><p>Your design is ready for the next step.</p></div><div className="blender-card"><div className="blender-title"><span className="blender-symbol">b</span><div><strong>Blender</strong><span>Parametric connection</span></div><span className={`connection-dot ${blenderStatus}`} /></div><p>{blenderStatus === 'connected' ? 'Connected. Your model will be created in the active Blender scene.' : 'Create an editable model in Blender through your local MCP connection.'}</p><button className="primary-button" onClick={sendToBlender} disabled={sending}>{sending ? 'Creating model...' : 'Send to Blender'}<ArrowUpRight size={17} /></button><button className="text-button" onClick={() => setModal('help')}>{blenderStatus === 'connected' ? 'Connection settings' : 'How to connect'}<ArrowUpRight size={13} /></button></div><div className="secondary-actions"><button onClick={() => setModal('export')}><Download size={17} /><span>Export model<small>GLB or Blender file</small></span><ArrowUpRight size={14} /></button><button onClick={() => { downloadJson(design); notify('Design specification downloaded.') }}><ArrowLineDown size={17} /><span>Save specification<small>Dimensions and finish</small></span><ArrowUpRight size={14} /></button></div><div className="action-note"><span>Designed for the details.</span><p>Every dimension, profile, and finish is yours to define.</p></div></aside>
    </main>
    <footer className="statusbar"><span><span className="status-dot" /> All changes saved</span><span>APERTURE STUDIO <i /> BUILT FOR BLENDER</span><button onClick={() => setModal('library')}><Plus size={13} /> New from template</button></footer>

    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={20} /></button>
      {modal === 'library' && <><span className="eyebrow">STARTING POINTS</span><h2 id="modal-title">The handle library.</h2><p className="modal-intro">Choose a proportion, then make it your own.</p><div className="preset-list">{presets.map((preset) => <button key={preset.name} onClick={() => { setDesign(preset.design); setModal(null); notify(`${preset.name} loaded.`) }}><span className={`preset-drawing ${preset.design.type}`}><i /><i /><i /></span><span><strong>{preset.name}</strong><small>{preset.description}</small></span><ArrowUpRight size={18} /></button>)}</div></>}
      {modal === 'export' && <><span className="eyebrow">TAKE IT FURTHER</span><h2 id="modal-title">Export your object.</h2><p className="modal-intro">A portable 3D model, generated from your current dimensions.</p><div className="export-options"><button className={exportFormat === 'glb' ? 'selected' : ''} onClick={() => { setExportFormat('glb'); setExportUrl(''); setExportError('') }}><strong>GLB</strong><span>Universal 3D format. No Blender required.</span></button><button className={exportFormat === 'blend' ? 'selected' : ''} onClick={() => { setExportFormat('blend'); setExportUrl(''); setExportError('') }}><strong>.blend</strong><span>Native, editable Blender scene. Requires connection.</span></button></div>{exportError && <p className="error-message">{exportError}</p>}{exportUrl ? <a className="primary-button download-link" href={exportUrl} download={`${design.name.replaceAll(' ', '-')}.${exportFormat}`}><Check size={17} /> Download {exportFormat.toUpperCase()}</a> : <button className="primary-button" onClick={exportDesign}>Prepare export <ArrowUpRight size={17} /></button>}</>}
      {modal === 'help' && <><span className="eyebrow">A LITTLE GUIDANCE</span><h2 id="modal-title">Make it tangible.</h2><div className="guide-steps"><div><span>01</span><section><h3>Define your handle</h3><p>Choose a pull or lever, adjust its dimensions, and select a finish. Drag the model to inspect it from every angle.</p></section></div><div><span>02</span><section><h3>Connect Blender</h3><p>Start the included MCP service with <code>npm run mcp</code>. In Blender, enable the MCP for Blender add-on and click <strong>Connect to MCP</strong> in the 3D View sidebar.</p></section></div><div><span>03</span><section><h3>Create and export</h3><p>Send your design to the active Blender scene. Export a GLB directly from Aperture, or a native .blend file through the connection.</p></section></div></div><p className="guide-note"><Link size={16} /> The connection stays on your machine. No model data leaves your workspace.</p></>}
    </section></div>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
  </div>
}

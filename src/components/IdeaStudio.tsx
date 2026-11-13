import { ArrowUp, Check, MagicWand, SlidersHorizontal, Sparkle } from '@phosphor-icons/react'
import { useState } from 'react'
import type { HandleDesign } from '../lib/design'
import { interpretPrompt } from '../lib/interpreter'

const suggestions = ['A rounded marble door', 'A half-circle gold handle with a bird detail', 'A minimal oak door']

export function IdeaStudio({ design, onDesign, onFineTune }: { design: HandleDesign; onDesign: (design: HandleDesign) => void; onFineTune: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [summary, setSummary] = useState<string[]>([])
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [hasResult, setHasResult] = useState(false)
  const [thinking, setThinking] = useState(false)
  const create = (idea: string) => {
    if (!idea.trim()) return
    setThinking(true)
    window.setTimeout(() => {
      const result = interpretPrompt(idea, design)
      onDesign(result.design)
      setSummary(result.summary)
      setAssumptions(result.assumptions)
      setPrompt('')
      setHasResult(true)
      setThinking(false)
    }, 450)
  }
  return <aside className="idea-panel">
    <div className="idea-heading"><span className="designer-icon"><Sparkle size={19} /></span><div><h1>What can we make?</h1><p>Describe it in your own words.</p></div></div>
    <div className="idea-input"><label htmlFor="design-idea">Your idea</label><textarea id="design-idea" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); create(prompt) } }} placeholder="A rounded marble door..." rows={4} /><button onClick={() => create(prompt)} disabled={!prompt.trim() || thinking} aria-label="Create design"><ArrowUp size={18} weight="bold" /></button></div>
    <span className="idea-hint">Include a shape, material, or size if you have one in mind.</span>
    {!hasResult && <div className="idea-suggestions"><span>Try an idea</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => create(suggestion)}>{suggestion}<ArrowUp size={12} /></button>)}</div>}
    {thinking && <div className="design-thinking"><span /><span /><span /><p>Considering proportion, material, and detail...</p></div>}
    {hasResult && !thinking && <div className="design-rationale"><div><Check size={15} /><strong>Your design is ready</strong></div><p>{summary.join(' ')}</p>{assumptions.length > 0 && <small>{assumptions.join(' ')}</small>}<span className="designer-signoff"><MagicWand size={13} /> Product Designer</span></div>}
    <div className="idea-bottom"><button onClick={onFineTune}><SlidersHorizontal size={15} /> Fine-tune the details</button><span>No design experience needed.</span></div>
  </aside>
}

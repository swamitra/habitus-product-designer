import { execFile } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { canonicalSpecification } from '../src/tools/specification/canonical.js'
import type { HandleDesign } from '../src/lib/design.js'

const execute = (command: string, args: string[], input: string) => new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
  const child = execFile(command, args, { timeout: 120000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }))
  child.stdin?.write(input)
  child.stdin?.end()
})

export async function generateCad(design: HandleDesign, format: 'step' | 'dxf') {
  const spec = canonicalSpecification(design)
  if (spec.dfm_validation_report.status === 'blocked') throw new Error('Resolve the blocking DFM findings before exporting CAD.')
  const output = resolve('public/exports')
  await mkdir(output, { recursive: true })
  const { stdout, stderr } = await execute(process.env.UV_PATH || 'uv', ['run', '--with', 'build123d', 'api/cad/generate.py', output], JSON.stringify(spec))
  if (stderr && !stdout) throw new Error(stderr)
  const result = JSON.parse(stdout.trim().split('\n').at(-1) || '{}') as { step: string; dxf: string; volume_mm3: number; solid_count: number }
  const filename = result[format]
  return { url: `/exports/${filename}`, content: await readFile(resolve(output, filename)), volume: result.volume_mm3, solids: result.solid_count }
}

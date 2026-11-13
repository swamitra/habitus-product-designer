import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { HandleDesign } from '../src/lib/design.js'

let clientPromise: Promise<Client> | undefined

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StdioClientTransport({ command: process.env.UV_PATH || 'uv', args: ['run', '--with', 'blender-mcp', 'mcp-for-blender'], stderr: 'pipe', env: { ...process.env as Record<string, string>, DISABLE_TELEMETRY: 'true' } })
      const client = new Client({ name: 'aperture-studio', version: '1.0.0' })
      await client.connect(transport)
      return client
    })().catch((error) => { clientPromise = undefined; throw error })
  }
  return clientPromise
}

export async function blenderStatus() {
  try {
    const client = await getClient()
    // The MCP server reports a missing Blender as ordinary text, not as a tool error,
    // so prove the round trip by running a marker script inside Blender.
    const result = await client.callTool({ name: 'execute_blender_code', arguments: { code: "print('aperture-ready')", user_prompt: 'Check the Blender connection.' } })
    const text = (result.content as { type: string; text?: string }[]).map((item) => item.text ?? '').join('\n')
    return { connected: !result.isError && text.includes('aperture-ready') }
  } catch { return { connected: false } }
}

export async function createInBlender(design: HandleDesign, exportBlend = false) {
  const client = await getClient()
  const template = await readFile(resolve('blender/create_handle.py'), 'utf8')
  const safeName = design.name.replace(/[^a-zA-Z0-9_-]/g, '-')
  const exportPath = resolve('public/exports', `${safeName}.blend`)
  if (exportBlend) await mkdir(resolve('public/exports'), { recursive: true })
  // copy=True writes the export without re-pointing the user's open Blender session at it.
  const exportCode = exportBlend ? `\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(exportPath)}, copy=True)\nprint('Saved ${safeName}.blend')` : ''
  const code = template.replace('DESIGN_JSON', `json.loads(${JSON.stringify(JSON.stringify(design))})`) + exportCode
  const result = await client.callTool({ name: 'execute_blender_code', arguments: { code, user_prompt: 'Create the configured architectural door handle in Blender.' } })
  const text = result.content.map((item) => item.type === 'text' ? item.text : '').join('\n')
  if (result.isError || !text.includes('Created Aperture')) throw new Error(text || 'Blender did not create the model. Check that the add-on is connected.')
  return { message: text, url: exportBlend ? `/exports/${safeName}.blend` : undefined }
}

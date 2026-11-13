import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { HandleDesign } from '../src/lib/design.js'

let clientPromise: Promise<Client> | undefined

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StdioClientTransport({ command: process.env.UV_PATH || 'uv', args: ['run', '--with', 'blender-mcp', 'mcp-for-blender'], stderr: 'pipe' })
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
    const result = await client.callTool({ name: 'get_scene_info', arguments: { limit: 1 } })
    return { connected: !result.isError, scene: result.content }
  } catch { return { connected: false } }
}

export async function createInBlender(design: HandleDesign, exportBlend = false) {
  const client = await getClient()
  const template = await readFile(resolve('blender/create_handle.py'), 'utf8')
  const safeName = design.name.replace(/[^a-zA-Z0-9_-]/g, '-')
  const exportPath = resolve('public/exports', `${safeName}.blend`)
  const exportCode = exportBlend ? `\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(exportPath)})\nprint('Saved ${safeName}.blend')` : ''
  const code = template.replace('DESIGN_JSON', JSON.stringify(design)) + exportCode
  const result = await client.callTool({ name: 'execute_blender_code', arguments: { code, user_prompt: 'Create the configured architectural door handle in Blender.' } })
  const text = result.content.map((item) => item.type === 'text' ? item.text : '').join('\n')
  if (result.isError || !text.includes('Created Aperture')) throw new Error(text || 'Blender did not create the model. Check that the add-on is connected.')
  return { message: text, url: exportBlend ? `/exports/${safeName}.blend` : undefined }
}

import express from 'express'
import { createInBlender, blenderStatus } from './mcp.js'
import { validateDesign, type HandleDesign } from '../src/lib/design.js'
import { generateCad } from './cad.js'

const app = express()
app.use(express.json({ limit: '32kb' }))
app.get('/api/cad/health', (_request, response) => response.json({ available: true, kernel: 'build123d/OpenCascade' }))
app.get('/api/blender/status', async (_request, response) => response.json(await blenderStatus()))
app.post('/api/blender/create', async (request, response) => {
  const design = request.body as HandleDesign
  const validationError = validateDesign(design)
  if (validationError) return response.status(400).json({ error: validationError })
  try { response.json(await createInBlender(design)) }
  catch { response.status(503).json({ error: 'Blender is not connected. Start npm run mcp, then enable the Blender MCP add-on and click Connect to MCP.' }) }
})
app.post('/api/blender/export', async (request, response) => {
  const design = request.body as HandleDesign
  const validationError = validateDesign(design)
  if (validationError) return response.status(400).json({ error: validationError })
  try { response.json(await createInBlender(design, true)) }
  catch { response.status(503).json({ error: 'A Blender connection is required for .blend export. See the Guide for setup instructions.' }) }
})
app.post('/api/cad/:format', async (request, response) => {
  const format = request.params.format
  if (format !== 'step' && format !== 'dxf') return response.status(400).json({ error: 'Supported CAD formats are STEP and DXF.' })
  try {
    const result = await generateCad(request.body as HandleDesign, format)
    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${result.url.split('/').at(-1)}"`)
    response.send(result.content)
  } catch (error) { response.status(422).json({ error: error instanceof Error ? error.message : 'CAD generation failed.' }) }
})
const port = Number(process.env.API_PORT || 3001)
app.listen(port, '127.0.0.1', () => console.log(`Aperture local API listening on http://127.0.0.1:${port}`))

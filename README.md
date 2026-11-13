# Aperture

A parametric architectural handle studio for designing pull and lever handles, with a live 3D preview and a local Blender MCP connection.

## Run the studio

Requirements: Node.js 22+, Blender 4+, and [uv](https://docs.astral.sh/uv/) for the Blender MCP service.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite server and local API start together.

## Connect Blender

1. In Blender, open **Edit > Preferences > Add-ons**.
2. Choose **Install from Disk** and select `blender/aperture_mcp_addon.py`.
3. Enable **MCP for Blender**.
4. In the 3D View sidebar, open **MCP for Blender** and click **Connect to MCP**.
5. Return to Aperture and click **Send to Blender**.

The app starts the official `blender-mcp` MCP server through `uv` and communicates with it using the Model Context Protocol TypeScript SDK. The server connects to Blender's local add-on on port 9876. No model data is sent to an external service.

To run the MCP service independently:

```bash
npm run mcp
```

## Features

- Natural-language design mode for people without product-design experience
- A dedicated Product Designer subagent with a proportion, material, and restraint framework in `.github/agents/product-designer.agent.md`
- Offline interpretation of common objects, shapes, materials, dimensions, and follow-up requests
- Rounded doors, straight and half-circle handles, and integrated bird details
- Marble, oak, brushed gold, graphite, steel, bronze, and black materials
- Pull and lever handle types with editable dimensions
- Round, square, and soft-square profiles
- Graphite, brushed steel, dark bronze, and matt black finishes
- Orbit, zoom, automatic rotation, and grid controls
- Local design persistence and reusable templates
- Direct GLB export without Blender
- Editable Blender scene creation and native `.blend` export through MCP
- JSON specification export

## Validation

```bash
npm test
npm run lint
npm run build
```

## Stack

React, TypeScript, Three.js, React Three Fiber, Express, Model Context Protocol, and Blender Python.

The bundled Blender MCP add-on is from [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp), licensed under MIT. Aperture is a local design tool, not a manufacturing or building-code validation service.

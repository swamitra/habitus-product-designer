import type { HandleDesign } from '../../lib/design'

export function encodeDesign(design: HandleDesign) {
  const bytes = new TextEncoder().encode(JSON.stringify(design))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function decodeDesign(value: string): HandleDesign | null {
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(normalized)
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))))
    return typeof parsed.name === 'string' && ['pull', 'lever'].includes(parsed.type) ? parsed : null
  } catch { return null }
}

export function designFromLocation() {
  const value = new URLSearchParams(window.location.search).get('design')
  return value ? decodeDesign(value) : null
}

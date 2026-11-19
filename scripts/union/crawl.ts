import { load } from 'cheerio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ORIGIN = 'https://www.artunion.co.jp'
const categories = { pulls: 4, levers: 5 } as const
type Category = keyof typeof categories

interface UnionModel {
  sku: string
  category: Category
  sourceUrl: string
  materialFinish: string | null
  sizeText: string | null
  lengthMm: number | null
  centerToCenterMm: number | null
  installationText: string | null
  weightText: string | null
  seriesText: string | null
  imageReferences: { url: string; role: 'product' | 'drawing' | 'installation' }[]
  crawledAt: string
}

const args = process.argv.slice(2)
const category = (args.find((arg) => arg.startsWith('--category='))?.split('=')[1] ?? 'pulls') as Category
if (!(category in categories)) throw new Error('Use --category=pulls or --category=levers')
const limitArg = args.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity
const delay = Number(args.find((arg) => arg.startsWith('--delay='))?.split('=')[1] ?? 1200)
const outputDir = resolve('data/union')
const checkpointPath = resolve(outputDir, `${category}.checkpoint.json`)
const outputPath = resolve(outputDir, `${category}.json`)

async function fetchHtml(url: string) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'ApertureProductResearch/1.0 (engineering catalog indexer; respectful rate limit)', Accept: 'text/html' }, signal: AbortSignal.timeout(30000) })
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return await response.text()
    } catch (error) {
      if (attempt === 4) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000))
    }
  }
  throw new Error('Unreachable')
}

function numberFrom(text: string | null) {
  const match = text?.replaceAll(',', '').match(/(\d+(?:\.\d+)?)\s*mm/i)
  return match ? Number(match[1]) : null
}

function parseModel(html: string, sku: string, category: Category): UnionModel {
  const $ = load(html)
  const fields = new Map<string, string>()
  $('.contentsIn dl').each((_index, element) => {
    const key = $(element).find('dt').first().text().replace(/\s+/g, ' ').trim().toLowerCase()
    const value = $(element).find('dd').first().text().replace(/\s+/g, ' ').trim()
    if (key && value) fields.set(key, value)
  })
  const get = (...names: string[]) => names.map((name) => fields.get(name)).find(Boolean) ?? null
  const sizeText = get('size')
  const centerText = get('center-to-center', 'center to center')
  const imageReferences = $('#detailImgInner li img').map((_index, image) => {
    const src = $(image).attr('src') ?? ''
    return { url: new URL(src, ORIGIN).toString(), role: src.includes('/size/') ? 'drawing' as const : src.includes('/image/') ? 'installation' as const : 'product' as const }
  }).get()
  return {
    sku, category, sourceUrl: `${ORIGIN}/en/products/detail.php?id=${encodeURIComponent(sku)}`,
    materialFinish: get('material & finish'), sizeText, lengthMm: numberFrom(sizeText),
    centerToCenterMm: numberFrom(centerText), installationText: get('installation mathod', 'installation method'),
    weightText: get('weight'), seriesText: get('series'), imageReferences: [...new Map(imageReferences.map((image) => [image.url, image])).values()],
    crawledAt: new Date().toISOString(),
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const firstPage = await fetchHtml(`${ORIGIN}/en/products/search.php?cid=${categories[category]}`)
  const $ = load(firstPage)
  const lastPage = Number($('.pagerList a[title="last page"]').attr('href')?.match(/pageID=(\d+)/)?.[1] ?? 1)
  const checkpoint = await readFile(checkpointPath, 'utf8').then(JSON.parse).catch(() => ({ completedPages: [] as number[], failedPages: [] as number[], failedSkus: [] as string[] }))
  const models = new Map<string, UnionModel>((await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => []) as UnionModel[]).map((model) => [model.sku, model]))
  let processed = 0
  for (let page = 1; page <= lastPage && processed < limit; page++) {
    if (checkpoint.completedPages.includes(page)) continue
    const html = page === 1 ? firstPage : await fetchHtml(`${ORIGIN}/en/products/search.php?cid=${categories[category]}&pageID=${page}`)
    const page$ = load(html)
    const skus = [...new Set(page$('a[href*="detail.php?id="]').map((_index, anchor) => new URL(page$(anchor).attr('href') ?? '', ORIGIN).searchParams.get('id')).get().filter((sku): sku is string => Boolean(sku)))]
    const failedSkus: string[] = []
    for (const sku of skus) {
      if (models.has(sku)) continue
      try {
        models.set(sku, parseModel(await fetchHtml(`${ORIGIN}/en/products/detail.php?id=${encodeURIComponent(sku)}`), sku, category))
        console.log(`[${models.size}] ${sku}`)
        await writeFile(outputPath, JSON.stringify([...models.values()], null, 2))
      } catch (error) {
        failedSkus.push(sku)
        console.error(`Failed ${sku}:`, error instanceof Error ? error.message : error)
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    if (failedSkus.length === 0) checkpoint.completedPages.push(page)
    else checkpoint.failedPages = [...new Set([...(checkpoint.failedPages ?? []), page])]
    checkpoint.failedSkus = [...new Set([...(checkpoint.failedSkus ?? []), ...failedSkus])].filter((sku) => !models.has(sku))
    checkpoint.completedPages = [...new Set(checkpoint.completedPages)].sort((a, b) => a - b)
    await writeFile(outputPath, JSON.stringify([...models.values()], null, 2))
    await writeFile(checkpointPath, JSON.stringify({ ...checkpoint, lastPage, updatedAt: new Date().toISOString() }, null, 2))
    processed++
    console.log(`Checkpoint: ${category} page ${page}/${lastPage}, ${models.size} models`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  console.log(`Done: ${models.size} unique ${category} models saved to ${outputPath}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })

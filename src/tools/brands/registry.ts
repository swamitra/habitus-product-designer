export interface BrandBenchmark {
  id: string; name: string; origin: string; specialty: string; relevance: string; url: string
}

export const brandRegistry: BrandBenchmark[] = [
  { id: 'artunion_jp', name: 'UNION', origin: 'Japan', specialty: 'Architectural pulls and aluminum systems', relevance: 'M6/M8 mounting, custom length-to-pitch ratios, timber and glass fixing references.', url: 'https://www.artunion.co.jp/' },
  { id: 'fsb_de', name: 'FSB', origin: 'Germany', specialty: 'Ergonomic levers and spindle bearings', relevance: '7-9 mm spindle compatibility and grip ergonomics.', url: 'https://fsb.de/' },
  { id: 'kawajun_jp', name: 'KAWAJUN', origin: 'Japan', specialty: 'Minimal levers and slim roses', relevance: 'Slim rose proportions and mixed-material tactile details.', url: 'https://kawajun.biz/' },
  { id: 'sugatsune_jp', name: 'SUGATSUNE', origin: 'Japan', specialty: 'Concealed hinges and motion hardware', relevance: 'HES3D furniture and architectural hinge references.', url: 'https://sugatsune.com/' },
  { id: 'baldwin_us', name: 'BALDWIN', origin: 'United States', specialty: 'Forged brass and mortise systems', relevance: '38/51 mm narrow-stile and 63.5/70 mm standard backsets.', url: 'https://www.baldwinhardware.com/' },
  { id: 'simonswerk_tectus_de', name: 'SIMONSWERK TECTUS', origin: 'Germany', specialty: 'Load-rated concealed hinges', relevance: 'Heavy-door load tiers and A8 cladding-offset references up to 8 mm.', url: 'https://www.simonswerk.com/' },
]

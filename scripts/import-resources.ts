import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parsePipeList(value: string): string[] {
  if (!value || value.trim() === '') return []
  return value.split('|').map(s => s.trim()).filter(Boolean)
}

async function main() {
  const csvPath = path.join(process.cwd(), 'data', 'resources.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found at data/resources.csv — export your sheet and place it there.')
    process.exit(1)
  }

  const records: Record<string, string>[] = parse(fs.readFileSync(csvPath, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`Loaded ${records.length} rows from CSV`)

  // Build embedding inputs: title + description gives the best semantic signal
  const embeddingInputs = records.map(r =>
    [r.Title, r.description].filter(Boolean).join('\n\n').slice(0, 8000)
  )

  console.log('Generating embeddings (batched)...')
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: embeddingInputs,
  })

  // OpenAI returns embeddings in the same order as inputs
  const embeddings = embeddingResponse.data
    .sort((a, b) => a.index - b.index)
    .map(e => e.embedding)

  console.log(`Got ${embeddings.length} embeddings — upserting to Supabase...`)

  const rows = records.map((r, i) => ({
    external_id: parseInt(r.id),
    title: r.Title,
    description: r.description,
    communities: parsePipeList(r.Communities),
    industries: parsePipeList(r.Industries),
    locations: parsePipeList(r.Locations),
    topics: parsePipeList(r.Topics),
    link: r.link || null,
    email: r.email || null,
    embedding: embeddings[i],
  }))

  // Upsert in batches of 50 (Supabase recommends staying under 1MB per request)
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('resources')
      .upsert(batch, { onConflict: 'external_id' })

    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message)
      process.exit(1)
    }
    console.log(`Upserted rows ${i + 1}–${Math.min(i + BATCH, rows.length)}`)
  }

  console.log('Done. All resources imported with embeddings.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

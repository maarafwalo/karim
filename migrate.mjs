/**
 * JOUD — Product Migration Script
 * ─────────────────────────────────
 * Imports 778 products from the seed JSON into Supabase.
 *
 * Usage:
 *   1. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment
 *      (service key is required to bypass RLS — never expose it in frontend)
 *   2. Run: node migrate.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL        = process.env.SUPABASE_URL        || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars first')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const seed     = JSON.parse(readFileSync('./src/data/products_seed.json', 'utf8'))

async function migrate() {
  console.log('🚀 Starting migration...\n')

  // ── 1. Categories ───────────────────────────────────────────
  console.log('⬆  Inserting categories...')
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .upsert(seed.categories, { onConflict: 'name' })
    .select()
  if (catErr) { console.error('❌ Categories error:', catErr.message); process.exit(1) }

  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]))
  console.log(`✅ ${cats.length} categories ready\n`)

  // ── 2. Products (in batches of 50) ─────────────────────────
  console.log(`⬆  Inserting ${seed.products.length} products...`)
  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < seed.products.length; i += BATCH) {
    const batch = seed.products.slice(i, i + BATCH).map(p => ({
      legacy_id:   p.legacy_id,
      name:        p.name,
      category_id: catMap[p.cat] || null,
      size:        p.size        || '',
      sell_price:  p.sell_price  || 0,
      cost_price:  p.cost_price  || 0,
      barcode:     p.barcode     || null,
      emoji:       p.emoji       || '📦',
      image_url:   p.image_url   || null,
      stock:       p.stock,
      is_active:   true,
      is_hidden:   p.is_hidden || false,
    }))

    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'legacy_id' })

    if (error) {
      console.error(`❌ Batch ${i/BATCH+1} error:`, error.message)
      process.exit(1)
    }

    inserted += batch.length
    process.stdout.write(`   ${inserted}/${seed.products.length}\r`)
  }

  console.log(`\n✅ ${inserted} products imported successfully!\n`)

  // ── 3. Summary ──────────────────────────────────────────────
  const { count: prodCount } = await supabase
    .from('products').select('*', { count: 'exact', head: true })
  const { count: catCount } = await supabase
    .from('categories').select('*', { count: 'exact', head: true })

  console.log('═══════════════════════════════')
  console.log(`  Categories: ${catCount}`)
  console.log(`  Products:   ${prodCount}`)
  console.log('═══════════════════════════════')
  console.log('🎉 Migration complete!\n')
  console.log('Next steps:')
  console.log('  1. Create an admin user in Supabase Auth dashboard')
  console.log('  2. Manually set their role to "admin" in the profiles table')
  console.log('  3. Run: npm run dev')
}

migrate().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })

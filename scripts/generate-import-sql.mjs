import { createClient } from '@supabase/supabase-js'

const lite = createClient(
  'https://suemrjvzhfbxdpsccgoi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1ZW1yanZ6aGZieGRwc2NjZ29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTk4NTEsImV4cCI6MjA5MjA5NTg1MX0.XEQrprgwsvesg3B9s_j3VYCXFR83pj27qiXlzMOwUAs'
)

const ids = process.argv.slice(2).map(Number).filter(Boolean)
if (!ids.length) {
  console.error('Pass product IDs as args')
  process.exit(1)
}

const { data, error } = await lite
  .from('products')
  .select('id,name,size,sell_price,cost_price,barcode,emoji,image_url,is_active,is_hidden,categories(name)')
  .in('id', ids)

if (error) {
  console.error(error)
  process.exit(1)
}

const esc  = s => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`)
const num  = n => (n == null ? 'NULL' : Number(n))
const bool = b => (b ? 'true' : 'false')
const cat  = n => (n ? `(SELECT id FROM categories WHERE name='${String(n).replace(/'/g, "''")}' LIMIT 1)` : 'NULL')

const lines = data.map(p =>
  `(${esc(p.name)}, ${esc(p.size)}, ${num(p.sell_price)}, ${num(p.cost_price)}, ${esc(p.barcode)}, ${esc(p.emoji)}, ${esc(p.image_url)}, ${bool(p.is_active ?? true)}, ${bool(p.is_hidden ?? false)}, ${cat(p.categories?.name)})`
)

console.log(`-- ${data.length} products from joud-lite\nINSERT INTO products (name, size, sell_price, cost_price, barcode, emoji, image_url, is_active, is_hidden, category_id) VALUES\n${lines.join(',\n')}\nON CONFLICT DO NOTHING;`)

const SRV  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdGlteXR0dXh4eWV5eHp0YXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQyNDYwNywiZXhwIjoyMDkxMDAwNjA3fQ.sQqMrOVWoL7A8lnpGHOlftBjMUQWROCYVOuQNmvVP4c'
const BASE = 'https://tatimyttuxxyeyxztawn.supabase.co'
const h = { 'Authorization': `Bearer ${SRV}`, 'apikey': SRV, 'Content-Type': 'application/json' }

// DB enum only supports these values — use 'vendor' as placeholder for others
const VALID_ROLES = new Set(['admin','cashier','vendor','stock_manager'])
const ROLE_MAP = {
  store_manager:   'vendor',
  delivery:        'vendor',
  assistant:       'vendor',
  trusted_partner: 'vendor',
}

// Fetch all auth users
const usersRes = await fetch(`${BASE}/auth/v1/admin/users?per_page=100`, { headers: h })
const { users } = await usersRes.json()
if (!users) { console.error('Failed to fetch users'); process.exit(1) }

console.log(`Found ${users.length} users\n`)

for (const user of users) {
  const metaRole = user.user_metadata?.role
  const metaName = user.user_metadata?.full_name || user.email
  if (!metaRole) { console.log(`⏭  ${user.email} — no role in metadata, skipping`); continue }

  const dbRole = VALID_ROLES.has(metaRole) ? metaRole : (ROLE_MAP[metaRole] || 'vendor')

  // Upsert profile (service role key bypasses RLS)
  const r = await fetch(`${BASE}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...h,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ id: user.id, full_name: metaName, role: dbRole }),
  })

  const result = await r.json()
  if (r.ok) {
    console.log(`✅ ${metaName.padEnd(15)} role=${metaRole} → db_role=${dbRole}`)
  } else {
    console.log(`❌ ${metaName} → ${JSON.stringify(result)}`)
  }
  await new Promise(res => setTimeout(res, 100))
}

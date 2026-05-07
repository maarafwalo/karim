const SRV  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdGlteXR0dXh4eWV5eHp0YXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQyNDYwNywiZXhwIjoyMDkxMDAwNjA3fQ.sQqMrOVWoL7A8lnpGHOlftBjMUQWROCYVOuQNmvVP4c'
const BASE = 'https://tatimyttuxxyeyxztawn.supabase.co'

const ACCOUNTS = [
  { email:'akh@joud.app',        pass:'Akh@Joud24',   name:'أخوك'        },
  { email:'imran@joud.app',      pass:'Imran@Joud24', name:'عمران'       },
  { email:'ibrahim@joud.app',    pass:'Ibr@Joud24',   name:'إبراهيم'    },
  { email:'abdelkader@joud.app', pass:'Abd@Joud24',   name:'عبد القادر' },
  { email:'vendeur@joud.app',    pass:'Vend@Joud24',  name:'البائع'      },
  { email:'ossama@joud.app',     pass:'Oss@Joud24',   name:'أسامة'       },
  { email:'said@joud.app',       pass:'Said@Joud24',  name:'سعيد'        },
  { email:'miloud@joud.app',     pass:'Mil@Joud24',   name:'ميلود'       },
  { email:'ridwan@joud.app',     pass:'Rid@Joud24',   name:'رضوان'       },
  { email:'cashier1@joud.app',   pass:'Cash1@Joud24', name:'كاشير 1'    },
  { email:'cashier2@joud.app',   pass:'Cash2@Joud24', name:'كاشير 2'    },
  { email:'assistant1@joud.app', pass:'Asst1@Joud24', name:'مساعد 1'    },
  { email:'assistant2@joud.app', pass:'Asst2@Joud24', name:'مساعد 2'    },
]

const h = { 'Authorization': `Bearer ${SRV}`, 'apikey': SRV, 'Content-Type': 'application/json' }

// Get all users
const usersRes = await fetch(`${BASE}/auth/v1/admin/users?per_page=100`, { headers: h })
const { users } = await usersRes.json()

for (const acc of ACCOUNTS) {
  const user = users?.find(u => u.email === acc.email)
  if (!user) { console.log(`❌ لم يُوجد: ${acc.email}`); continue }

  const r = await fetch(`${BASE}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ password: acc.pass })
  })
  console.log(`${r.ok ? '✅' : '❌'} ${acc.name} (${acc.email}) → ${acc.pass}`)
  await new Promise(r => setTimeout(r, 150))
}

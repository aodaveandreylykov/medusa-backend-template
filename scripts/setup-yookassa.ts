/**
 * Run after adding YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY to .env and restarting:
 *
 *   cd backend
 *   npx ts-node scripts/setup-yookassa.ts
 *
 * What this does:
 *   1. Logs in to Medusa Admin
 *   2. Finds the RUB region
 *   3. Adds pp_yookassa_yookassa to the region's payment providers
 */

import * as fs from "fs"
import * as path from "path"

// Load .env from backend root
const envPath = path.resolve(__dirname, "../.env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim()
    }
  }
}

const ADMIN_URL = process.env.MEDUSA_ADMIN_URL || "http://localhost:9000"
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || "admin@brightic.local"
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || "SuperAdmin123!"

async function req<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  try { return JSON.parse(text) as T }
  catch { throw new Error(`${res.status}: ${text.slice(0, 300)}`) }
}

async function main() {
  console.log("🔑 Logging in...")
  const { token } = await req<{ token: string }>("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  console.log("✓ Authenticated")

  // Find RUB region
  const { regions } = await req<{ regions: Array<{ id: string; currency_code: string; name: string }> }>(
    "/admin/regions?limit=50", {}, token
  )
  const region = regions.find((r) => r.currency_code === "rub")
  if (!region) throw new Error("RUB region not found — run seed-shipping first")
  console.log(`✓ RUB region: ${region.name} (${region.id})`)

  // Check available payment providers
  const PK = process.env.MEDUSA_PUBLISHABLE_KEY || ""
  const ppRes = await req<{ payment_providers: Array<{ id: string }> }>(
    `/store/payment-providers?region_id=${region.id}`,
    { headers: PK ? { "x-publishable-api-key": PK } : {} }
  )
  const providers = ppRes.payment_providers || []
  console.log("Available payment providers:", providers.map((p) => p.id).join(", "))

  const yookassaProvider = providers.find((p) => p.id.includes("yookassa"))
  if (!yookassaProvider) {
    console.log("⚠️  YooKassa provider not found in store API.")
    console.log("   Make sure YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY are set and the container was restarted.")
    return
  }

  // Add to region via POST update
  const updResult = await req<{ region: { id: string; payment_providers: unknown[] } }>(
    `/admin/regions/${region.id}`,
    {
      method: "POST",
      body: JSON.stringify({ payment_providers: [yookassaProvider.id] }),
    },
    token
  )
  console.log(`✓ Added ${yookassaProvider.id} to region ${updResult.region?.id}`)

  console.log("\n✅ YooKassa setup complete")
  console.log(`   Provider: ${yookassaProvider.id}`)
  console.log("   Next: test checkout → select 'Карта / СБП (ЮKassa)' → pay in test mode")
}

main().catch((err) => {
  console.error("❌", err.message)
  process.exit(1)
})

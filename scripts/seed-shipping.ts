/**
 * Seed shipping options for Medusa v2.
 * Run: MEDUSA_ADMIN_URL=https://... MEDUSA_ADMIN_EMAIL=... MEDUSA_ADMIN_PASSWORD=... npx ts-node scripts/seed-shipping.ts
 */

const ADMIN_URL = process.env.MEDUSA_ADMIN_URL || "http://localhost:9000"
const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || "admin@brightic.local"
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || ""

const SHIPPING_OPTIONS = [
  { name: "СДЭК — ПВЗ",        amount: 29000 },
  { name: "СДЭК — Курьер",     amount: 49000 },
  { name: "Почта России",       amount: 25000 },
  { name: "Курьер по Москве",   amount: 39000 },
]

async function req<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${body}`)
  }
  return res.json() as T
}

async function main() {
  console.log("🔑 Logging in...")
  const { token } = await req<{ token: string }>("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  console.log("✓ Authenticated")

  // 1. RUB region
  const { regions } = await req<{ regions: Array<{ id: string; currency_code: string }> }>(
    "/admin/regions?limit=50", {}, token
  )
  let regionId = regions.find((r) => r.currency_code === "rub")?.id
  if (regionId) {
    console.log(`✓ RUB region exists (${regionId})`)
  } else {
    const { region } = await req<{ region: { id: string } }>("/admin/regions", {
      method: "POST",
      body: JSON.stringify({ name: "Russia", currency_code: "rub", countries: ["ru"] }),
    }, token)
    regionId = region.id
    console.log(`✓ Created RUB region (${regionId})`)
  }

  // 2. Shipping profile (default)
  const { shipping_profiles } = await req<{ shipping_profiles: Array<{ id: string; type: string }> }>(
    "/admin/shipping-profiles?limit=50", {}, token
  )
  let profileId = shipping_profiles.find((p) => p.type === "default")?.id
  if (!profileId) {
    const { shipping_profile } = await req<{ shipping_profile: { id: string } }>(
      "/admin/shipping-profiles",
      { method: "POST", body: JSON.stringify({ name: "Default", type: "default" }) },
      token
    )
    profileId = shipping_profile.id
    console.log(`✓ Created shipping profile (${profileId})`)
  } else {
    console.log(`✓ Shipping profile exists (${profileId})`)
  }

  // 3. Stock location
  const { stock_locations } = await req<{ stock_locations: Array<{ id: string; name: string; fulfillment_sets: Array<{ id: string }> }> }>(
    "/admin/stock-locations?limit=10&fields=*fulfillment_sets", {}, token
  )
  let locationId = stock_locations[0]?.id
  if (!locationId) {
    const { stock_location } = await req<{ stock_location: { id: string } }>(
      "/admin/stock-locations",
      { method: "POST", body: JSON.stringify({ name: "Main Warehouse", address: { address_1: "Склад", city: "Moscow", country_code: "ru" } }) },
      token
    )
    locationId = stock_location.id
    console.log(`✓ Created stock location (${locationId})`)
  } else {
    console.log(`✓ Stock location exists (${locationId})`)
  }

  // 4. Fulfillment set (POST creates or returns existing via idempotency)
  let fulfillmentSetId: string
  let serviceZoneId: string

  // Try to get existing fulfillment sets from location
  const locDetail = await req<{ stock_location: { id: string; fulfillment_sets: Array<{ id: string; service_zones: Array<{ id: string }> }> } }>(
    `/admin/stock-locations/${locationId}?fields=*fulfillment_sets,*fulfillment_sets.service_zones`, {}, token
  )
  const existingFs = locDetail.stock_location.fulfillment_sets

  if (existingFs && existingFs.length > 0) {
    fulfillmentSetId = existingFs[0].id
    serviceZoneId = existingFs[0].service_zones?.[0]?.id
    console.log(`✓ Fulfillment set exists (${fulfillmentSetId}), zone: ${serviceZoneId || "none"}`)
  } else {
    // Create fulfillment set
    const fsResult = await req<{ stock_location: { fulfillment_sets: Array<{ id: string; service_zones: Array<{ id: string }> }> } }>(
      `/admin/stock-locations/${locationId}/fulfillment-sets`,
      { method: "POST", body: JSON.stringify({ name: "Russia Shipping", type: "shipping" }) },
      token
    )
    const newFs = fsResult.stock_location.fulfillment_sets[0]
    fulfillmentSetId = newFs.id
    serviceZoneId = newFs.service_zones?.[0]?.id
    console.log(`✓ Created fulfillment set (${fulfillmentSetId})`)
  }

  // Create service zone if missing
  if (!serviceZoneId) {
    const szResult = await req<{ fulfillment_set: { service_zones: Array<{ id: string }> } }>(
      `/admin/fulfillment-sets/${fulfillmentSetId}/service-zones`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "Russia",
          geo_zones: [{ type: "country", country_code: "ru" }],
        }),
      },
      token
    )
    serviceZoneId = szResult.fulfillment_set.service_zones[0]?.id
    console.log(`✓ Created service zone (${serviceZoneId})`)
  }

  // 5. Fulfillment provider
  const { fulfillment_providers } = await req<{ fulfillment_providers: Array<{ id: string }> }>(
    "/admin/fulfillment-providers", {}, token
  )
  const providerId = fulfillment_providers[0]?.id
  if (!providerId) throw new Error("No fulfillment providers found")
  console.log(`✓ Fulfillment provider: ${providerId}`)

  // 6. Existing shipping options
  const { shipping_options: existing } = await req<{ shipping_options: Array<{ name: string }> }>(
    "/admin/shipping-options?limit=100", {}, token
  )
  const existingNames = new Set(existing.map((o) => o.name))

  // 7. Create shipping options
  for (const opt of SHIPPING_OPTIONS) {
    if (existingNames.has(opt.name)) {
      console.log(`  ⏭  "${opt.name}" already exists`)
      continue
    }
    await req("/admin/shipping-options", {
      method: "POST",
      body: JSON.stringify({
        name: opt.name,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profileId,
        provider_id: providerId,
        price_type: "flat",
        prices: [{ currency_code: "rub", amount: opt.amount }],
        rules: [{ attribute: "is_return", operator: "eq", value: "false" }],
      }),
    }, token)
    console.log(`  ✓ Created "${opt.name}" — ${opt.amount / 100} ₽`)
  }

  console.log("\n✅ Shipping seed complete")
  console.log(`   Region:       ${regionId}`)
  console.log(`   Location:     ${locationId}`)
  console.log(`   Service zone: ${serviceZoneId}`)
}

main().catch((err) => {
  console.error("❌", err.message)
  process.exit(1)
})

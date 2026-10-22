#!/usr/bin/env node
/**
 * Seeds 13 lamp products via Medusa Admin API.
 * Run: node scripts/seed-products.js
 * Env: MEDUSA_BACKEND_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD
 */

const https = require("https")
const http = require("http")

const PORT = process.env.PORT || "9000"
const BASE_URL = (process.env.MEDUSA_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, "")
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD

const LAMPS = [
  { handle: "momentum-beam",      title: "Momentum Beam",       price: 110000, blurb: "dynamic directional flow",   material: "metal",         category: "living room", color: "graphite" },
  { handle: "flux-line",          title: "Flux Line",           price: 75000,  blurb: "fluid modern light form",    material: "marble/metal",  category: "living room", color: "beige",   band: "best-sellers", sort: "1" },
  { handle: "stria-nova",         title: "Stria Nova",          price: 90000,  blurb: "clean linear design",        material: "metal",         category: "office",      color: "brass",   band: "most-popular", sort: "2" },
  { handle: "lumenweave",         title: "Lumenweave",          price: 65000,  blurb: "textured layered glow",      material: "textile/metal", category: "bedroom",     color: "ivory",   band: "best-sellers", sort: "3" },
  { handle: "metal-beam",         title: "Metal Beam",          price: 110000, blurb: "sleek silhouette",           material: "steel",         category: "living room", color: "silver" },
  { handle: "amethyst-vortex",    title: "Amethyst Vortex",     price: 150000, blurb: "shimmering violet hues",     material: "glass/metal",   category: "living room", color: "violet",  band: "most-popular", sort: "1" },
  { handle: "steel-petal",        title: "Steel Petal",         price: 90000,  blurb: "delicate curved elements",   material: "steel",         category: "bedroom",     color: "steel",   band: "best-sellers", sort: "2" },
  { handle: "glowform",           title: "Glowform",            price: 70000,  blurb: "sleek soft illumination",    material: "glass",         category: "bedroom",     color: "opal",    band: "most-popular", sort: "3" },
  { handle: "echo-glow",          title: "Echo Glow",           price: 120000, blurb: "subtle reflective warmth",   material: "metal",         category: "living room", color: "amber",   band: "best-sellers", sort: "4" },
  { handle: "horizon-glow",       title: "Horizon Glow",        price: 95000,  blurb: "calm even horizon light",    material: "glass/metal",   category: "living room", color: "warm white" },
  { handle: "crystal-veil",       title: "Crystal Veil",        price: 80000,  blurb: "elegant faceted softness",   material: "crystal",       category: "living room", color: "clear",   band: "most-popular", sort: "4" },
  { handle: "lunar-dome",         title: "Lunar Dome",          price: 75000,  blurb: "soft diffused light",        material: "ceramic",       category: "bedroom",     color: "moon" },
  { handle: "striking-red-shade", title: "Striking red shade",  price: 130000, blurb: "Crimson Accent",             material: "textile/metal", category: "living room", color: "crimson" },
]

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path)
    const lib = url.protocol === "https:" ? https : http
    const data = body ? JSON.stringify(body) : undefined
    const headers = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    if (data) headers["Content-Length"] = Buffer.byteLength(data)

    const req = lib.request({ hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80), path: url.pathname + url.search, method, headers }, (res) => {
      let raw = ""
      res.on("data", (c) => (raw += c))
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, body: raw }) }
      })
    })
    req.on("error", reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("[seed-products] Set MEDUSA_ADMIN_EMAIL and MEDUSA_ADMIN_PASSWORD")
    process.exit(1)
  }

  // 1. Auth
  const authRes = await request("POST", "/auth/user/emailpass", { email: EMAIL, password: PASSWORD })
  if (authRes.status !== 200) {
    console.error("[seed-products] Auth failed:", authRes.body)
    process.exit(1)
  }
  const token = authRes.body.token
  console.log("[seed-products] Authenticated")

  // 2. Get default sales channel
  const scRes = await request("GET", "/admin/sales-channels?limit=1", null, token)
  const salesChannelId = scRes.body?.sales_channels?.[0]?.id
  if (!salesChannelId) {
    console.error("[seed-products] No sales channel found")
    process.exit(1)
  }
  console.log("[seed-products] Sales channel:", salesChannelId)

  // 3. Get existing products
  const existing = new Set()
  let offset = 0
  while (true) {
    const r = await request("GET", `/admin/products?limit=100&offset=${offset}&fields=handle`, null, token)
    const products = r.body?.products || []
    products.forEach((p) => existing.add(p.handle))
    if (products.length < 100) break
    offset += 100
  }
  console.log("[seed-products] Existing products:", existing.size)

  // 4. Create missing products
  let created = 0
  for (const lamp of LAMPS) {
    if (existing.has(lamp.handle)) {
      console.log(`  skip "${lamp.title}"`)
      continue
    }

    const meta = { blurb: lamp.blurb, material: lamp.material, category: lamp.category, color: lamp.color }
    if (lamp.band) meta.band = lamp.band
    if (lamp.sort) meta.sort = lamp.sort

    const body = {
      title: lamp.title,
      handle: lamp.handle,
      status: "published",
      options: [{ title: "Title", values: ["Default"] }],
      sales_channels: [{ id: salesChannelId }],
      metadata: meta,
      variants: [{
        title: "Default",
        manage_inventory: false,
        options: { Title: "Default" },
        prices: [{ currency_code: "rub", amount: lamp.price }],
      }],
    }

    const res = await request("POST", "/admin/products", body, token)
    if (res.status === 200 || res.status === 201) {
      console.log(`  ✓ "${lamp.title}"`)
      created++
    } else {
      console.error(`  ✗ "${lamp.title}":`, res.status, JSON.stringify(res.body).slice(0, 200))
    }
  }

  console.log(`\n[seed-products] Done — created ${created} products`)
}

main().catch((e) => { console.error(e); process.exit(1) })

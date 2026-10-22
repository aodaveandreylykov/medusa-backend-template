// @ts-nocheck
/**
 * Seeds all 13 Brightic lamp products into Medusa with RUB prices.
 * Run in prod: medusa exec src/scripts/seed-products.ts
 */

import {
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

const LAMPS = [
  { handle: "momentum-beam",     title: "Momentum Beam",        price: 110000, blurb: "dynamic directional flow",    material: "metal",         category: "living room", color: "graphite" },
  { handle: "flux-line",         title: "Flux Line",            price: 75000,  blurb: "fluid modern light form",     material: "marble/metal",  category: "living room", color: "beige",    band: "best-sellers",  sort: 1 },
  { handle: "stria-nova",        title: "Stria Nova",           price: 90000,  blurb: "clean linear design",         material: "metal",         category: "office",      color: "brass",    band: "most-popular",  sort: 2 },
  { handle: "lumenweave",        title: "Lumenweave",           price: 65000,  blurb: "textured layered glow",       material: "textile/metal", category: "bedroom",     color: "ivory",    band: "best-sellers",  sort: 3 },
  { handle: "metal-beam",        title: "Metal Beam",           price: 110000, blurb: "sleek silhouette",            material: "steel",         category: "living room", color: "silver" },
  { handle: "amethyst-vortex",   title: "Amethyst Vortex",      price: 150000, blurb: "shimmering violet hues",      material: "glass/metal",   category: "living room", color: "violet",   band: "most-popular",  sort: 1 },
  { handle: "steel-petal",       title: "Steel Petal",          price: 90000,  blurb: "delicate curved elements",    material: "steel",         category: "bedroom",     color: "steel",    band: "best-sellers",  sort: 2 },
  { handle: "glowform",          title: "Glowform",             price: 70000,  blurb: "sleek soft illumination",     material: "glass",         category: "bedroom",     color: "opal",     band: "most-popular",  sort: 3 },
  { handle: "echo-glow",         title: "Echo Glow",            price: 120000, blurb: "subtle reflective warmth",    material: "metal",         category: "living room", color: "amber",    band: "best-sellers",  sort: 4 },
  { handle: "horizon-glow",      title: "Horizon Glow",         price: 95000,  blurb: "calm even horizon light",     material: "glass/metal",   category: "living room", color: "warm white" },
  { handle: "crystal-veil",      title: "Crystal Veil",         price: 80000,  blurb: "elegant faceted softness",    material: "crystal",       category: "living room", color: "clear",    band: "most-popular",  sort: 4 },
  { handle: "lunar-dome",        title: "Lunar Dome",           price: 75000,  blurb: "soft diffused light",         material: "ceramic",       category: "bedroom",     color: "moon" },
  { handle: "striking-red-shade",title: "Striking red shade",   price: 130000, blurb: "Crimson Accent",              material: "textile/metal", category: "living room", color: "crimson" },
]

export default async function seedProducts({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)

  // Get default sales channel
  const salesChannels = await salesChannelService.listSalesChannels({})
  const salesChannelId = salesChannels[0]?.id
  if (!salesChannelId) throw new Error("No sales channel found — run seed.ts first")
  console.log(`✓ Sales channel: ${salesChannelId}`)

  // Get existing products to skip duplicates
  const existing = await productService.listProducts({})
  const existingHandles = new Set(existing.map((p: { handle: string }) => p.handle))
  console.log(`  Existing products: ${existingHandles.size}`)

  const toCreate = LAMPS.filter((l) => !existingHandles.has(l.handle))
  if (toCreate.length === 0) {
    console.log("✓ All products already exist")
    return
  }

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: toCreate.map((lamp) => ({
        title: lamp.title,
        handle: lamp.handle,
        status: "published" as const,
        sales_channels: [{ id: salesChannelId }],
        metadata: {
          blurb: lamp.blurb,
          material: lamp.material,
          category: lamp.category,
          color: lamp.color,
          ...(lamp.band  ? { band: lamp.band }   : {}),
          ...(lamp.sort  ? { sort: String(lamp.sort) } : {}),
        },
        variants: [
          {
            title: "Default",
            inventory_quantity: 100,
            manage_inventory: false,
            prices: [
              { currency_code: "rub", amount: lamp.price },
            ],
          },
        ],
      })),
    },
  })

  for (const p of result) {
    console.log(`  ✓ Created "${p.title}" (${p.handle})`)
  }

  console.log(`\n✅ Seeded ${result.length} products`)
}

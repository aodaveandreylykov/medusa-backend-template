// @ts-nocheck
/**
 * Run after Medusa starts:
 *   npx medusa exec src/scripts/seed.ts
 *
 * Creates: RUB region, default shipping profile, 4 shipping options
 */

import {
  createRegionsWorkflow,
  createShippingProfilesWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

export default async function seed({ container }: ExecArgs) {
  const regionService = container.resolve(Modules.REGION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  // ── 1. RUB Region ─────────────────────────────────────────────────────────
  const existingRegions = await regionService.listRegions({ currency_code: "rub" })

  let regionId: string
  if (existingRegions.length > 0) {
    regionId = existingRegions[0].id
    console.log(`✓ RUB region already exists (${regionId})`)
  } else {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Russia",
            currency_code: "rub",
            countries: ["ru"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    regionId = result[0].id
    console.log(`✓ Created RUB region (${regionId})`)
  }

  // ── 2. Shipping Profile ───────────────────────────────────────────────────
  const existingProfiles = await fulfillmentService.listShippingProfiles({ type: "default" })

  let profileId: string
  if (existingProfiles.length > 0) {
    profileId = existingProfiles[0].id
    console.log(`✓ Shipping profile exists (${profileId})`)
  } else {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default", type: "default" }] },
    })
    profileId = result[0].id
    console.log(`✓ Created shipping profile (${profileId})`)
  }

  // ── 3. Fulfillment Provider ───────────────────────────────────────────────
  const providers = await fulfillmentService.listFulfillmentProviders({})
  const providerId = providers[0]?.id
  if (!providerId) throw new Error("No fulfillment providers found")
  console.log(`✓ Using fulfillment provider: ${providerId}`)

  // ── 4. Shipping Options ───────────────────────────────────────────────────
  const OPTIONS = [
    { name: "СДЭК — ПВЗ",        amount: 29000 },
    { name: "СДЭК — Курьер",     amount: 49000 },
    { name: "Почта России",       amount: 25000 },
    { name: "Курьер по Москве",   amount: 39000 },
  ]

  const existingOptions = await fulfillmentService.listShippingOptions({ profile_id: profileId })
  const existingNames = new Set(existingOptions.map((o: { name: string }) => o.name))

  const toCreate = OPTIONS.filter((o) => !existingNames.has(o.name))

  if (toCreate.length === 0) {
    console.log("✓ All shipping options already exist")
  } else {
    await createShippingOptionsWorkflow(container).run({
      input: toCreate.map((opt) => ({
        name: opt.name,
        region_id: regionId,
        profile_id: profileId,
        provider_id: providerId,
        price_type: "flat_rate" as const,
        type: {
          label: opt.name,
          description: opt.name,
          code: opt.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        },
        prices: [
          {
            currency_code: "rub",
            amount: opt.amount,
          },
        ],
        rules: [],
      })),
    })

    for (const opt of toCreate) {
      console.log(`  ✓ Created "${opt.name}" — ${opt.amount / 100} ₽`)
    }
  }

  console.log("\n✅ Seed complete — Phase 2 shipping ready")
}

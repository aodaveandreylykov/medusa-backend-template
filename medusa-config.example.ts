/**
 * Copy these bits into the Medusa app's medusa-config.ts
 * (the backend that serves http://localhost:9000).
 *
 * 1. Add the storefront origin to http.storeCors / http.authCors.
 * 2. Register Stripe next to the default manual payment provider.
 * 3. Put STRIPE_API_KEY (secret) and STRIPE_WEBHOOK_SECRET in backend .env.
 *    The storefront only needs NEXT_PUBLIC_STRIPE_PK.
 */

import { defineConfig, loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const STOREFRONT = process.env.STOREFRONT_URL || "http://localhost:8000"

module.exports = defineConfig({
  projectConfig: {
    http: {
      storeCors: `${STOREFRONT},http://localhost:8000`,
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000",
      authCors: `${STOREFRONT},http://localhost:8000,http://localhost:9000`,
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
  ],
})

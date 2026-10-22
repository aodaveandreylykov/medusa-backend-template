import { defineConfig, loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// YooKassa can run in three modes:
//   1. Simulation  — no real API calls, local test page (YOOKASSA_SIMULATION=true)
//   2. МСП Bearer  — OAuth token from МСП account (YOOKASSA_OAUTH_TOKEN set)
//   3. Basic Auth  — standard secret key (YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY)
const YK_SIMULATION = process.env.YOOKASSA_SIMULATION === "true"
const YK_OAUTH = process.env.YOOKASSA_OAUTH_TOKEN
const YK_SHOP_ID = process.env.YOOKASSA_SHOP_ID
const YK_SECRET = process.env.YOOKASSA_SECRET_KEY
const YK_ENABLED = YK_SIMULATION || !!YK_OAUTH || (!!YK_SHOP_ID && !!YK_SECRET)

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: process.env.DATABASE_SSL === "true"
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : { connection: { ssl: false } },
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000,http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:5173,http://localhost:9000",
      authCors: process.env.AUTH_CORS || "http://localhost:5173,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    { resolve: "./src/modules/contact" },
    ...(YK_ENABLED
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "./src/modules/yookassa-provider",
                  id: "yookassa",
                  options: {
                    simulationMode: YK_SIMULATION || false,
                    simulationBaseUrl: process.env.YOOKASSA_SIMULATION_BASE_URL ||
                      (process.env.MEDUSA_BACKEND_URL
                        ? `${process.env.MEDUSA_BACKEND_URL.replace(/\/$/, "")}/sim/yookassa/pay`
                        : "http://localhost:9000/sim/yookassa/pay"),
                    oauthToken: YK_OAUTH || undefined,
                    shopId: YK_SHOP_ID || undefined,
                    secretKey: YK_SECRET || undefined,
                    returnUrl: process.env.YOOKASSA_RETURN_URL || "http://localhost:3000/checkout?pay=yookassa",
                    capture: true,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})

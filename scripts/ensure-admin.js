#!/usr/bin/env node
const { Client } = require("pg")
const { randomUUID } = require("crypto")
const scrypt = require("scrypt-kdf")

async function main() {
  const email = process.env.MEDUSA_ADMIN_EMAIL
  const password = process.env.MEDUSA_ADMIN_PASSWORD
  if (!email || !password) {
    console.log("[admin] MEDUSA_ADMIN_EMAIL/PASSWORD not set, skipping")
    return
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  })
  await client.connect()

  try {
    const now = new Date().toISOString()

    // 1. Ensure user exists
    let userId
    const userRes = await client.query('SELECT id FROM "user" WHERE email = $1', [email])
    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id
      console.log(`[admin] User exists: ${userId}`)
    } else {
      userId = `user_${randomUUID().replace(/-/g, "").slice(0, 26)}`
      await client.query(
        `INSERT INTO "user" (id, email, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, email, "Admin", "Brightic", now, now]
      )
      console.log(`[admin] Created user ${userId}`)
    }

    // 2. Hash password using same algorithm as Medusa emailpass provider
    const hashConfig = { logN: 15, r: 8, p: 1 }
    const passwordHash = (await scrypt.kdf(password, hashConfig)).toString("base64")

    // 3. Find existing provider_identity (table name in Medusa v2)
    const providerRes = await client.query(
      `SELECT pi.id as provider_id, pi.auth_identity_id
         FROM provider_identity pi
        WHERE pi.entity_id = $1 AND pi.provider = 'emailpass'`,
      [email]
    )

    if (providerRes.rows.length > 0) {
      const { provider_id, auth_identity_id } = providerRes.rows[0]

      // Update password hash and ensure app_metadata has user_id
      await client.query(
        `UPDATE provider_identity
            SET provider_metadata = $1, updated_at = $2
          WHERE id = $3`,
        [JSON.stringify({ password: passwordHash }), now, provider_id]
      )
      await client.query(
        `UPDATE auth_identity
            SET app_metadata = $1, updated_at = $2
          WHERE id = $3`,
        [JSON.stringify({ user_id: userId }), now, auth_identity_id]
      )
      console.log(`[admin] Updated auth identity ${auth_identity_id} → user_id=${userId}`)
    } else {
      // Create full auth identity from scratch
      const authId = `authid_${randomUUID().replace(/-/g, "").slice(0, 26)}`
      await client.query(
        `INSERT INTO auth_identity (id, app_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4)`,
        [authId, JSON.stringify({ user_id: userId }), now, now]
      )
      const providerId = `provid_${randomUUID().replace(/-/g, "").slice(0, 26)}`
      await client.query(
        `INSERT INTO provider_identity
           (id, entity_id, provider, provider_metadata, auth_identity_id, created_at, updated_at)
         VALUES ($1, $2, 'emailpass', $3, $4, $5, $6)`,
        [providerId, email, JSON.stringify({ password: passwordHash }), authId, now, now]
      )
      console.log(`[admin] Created auth identity ${authId} for ${email}`)
    }

    console.log(`[admin] ✅ Admin ${email} ready`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error("[admin] Error:", e.message)
  process.exit(0) // Don't block startup on admin setup failure
})

// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function createAdmin({ container }: ExecArgs) {
  const email = process.env.MEDUSA_ADMIN_EMAIL
  const password = process.env.MEDUSA_ADMIN_PASSWORD
  if (!email || !password) return

  const userModule = container.resolve(Modules.USER)
  const authModule = container.resolve(Modules.AUTH)

  // Skip if user already exists and has linked auth identity
  const existingUsers = await userModule.listUsers({ email })
  if (existingUsers.length > 0) {
    console.log(`Admin ${email} already exists`)
    return
  }

  // Create Medusa user
  const [user] = await userModule.createUsers([{
    email,
    first_name: "Admin",
    last_name: "Brightic",
  }])
  console.log(`Created user ${user.id}`)

  // Check if auth identity exists (from earlier partial registration)
  const existing = await authModule.listAuthIdentities({
    provider_identities: { entity_id: email, provider: "emailpass" },
  })

  if (existing.length > 0) {
    // Link existing auth identity to the new user
    await authModule.updateAuthIdentities([{
      id: existing[0].id,
      app_metadata: { user_id: user.id },
    }])
    console.log(`Linked existing auth identity to user`)
  } else {
    // Create new auth identity with hashed password
    await authModule.createAuthIdentities([{
      provider_identities: [{
        provider: "emailpass",
        entity_id: email,
        provider_metadata: { password },
      }],
      app_metadata: { user_id: user.id },
    }])
    console.log(`Created auth identity`)
  }
  console.log(`✅ Admin ${email} ready`)
}

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { CONTACT_MODULE } from "../../../modules/contact"
import ContactModuleService from "../../../modules/contact/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { name, email, message } = req.body as Record<string, string>

  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" })
  }

  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE)

  await service.createContactInquiries([{
    name: String(name).trim(),
    email: String(email).trim(),
    message: String(message).trim(),
  }])

  console.log(`[Contact] New inquiry from ${name.trim()} <${email.trim()}>`)

  return res.status(200).json({ ok: true })
}

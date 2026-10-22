import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { CONTACT_MODULE } from "../../../modules/contact"
import ContactModuleService from "../../../modules/contact/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE)
  const contacts = await service.listContactInquiries({}, { order: { created_at: "DESC" } })
  return res.status(200).json({ contacts })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.body as { id: string }
  if (!id) return res.status(400).json({ error: "id required" })

  const service: ContactModuleService = req.scope.resolve(CONTACT_MODULE)
  await service.deleteContactInquiries([id])
  return res.status(200).json({ ok: true })
}

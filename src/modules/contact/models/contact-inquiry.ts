import { model } from "@medusajs/framework/utils"

export const ContactInquiry = model.define("contact_inquiry", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
  message: model.text(),
})

import { MedusaService } from "@medusajs/framework/utils"
import { ContactInquiry } from "./models/contact-inquiry"

class ContactModuleService extends MedusaService({ ContactInquiry }) {}

export default ContactModuleService

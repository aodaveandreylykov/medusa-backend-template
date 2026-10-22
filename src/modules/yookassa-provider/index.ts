import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { YookassaProviderService } from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [YookassaProviderService],
})

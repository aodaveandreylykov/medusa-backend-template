import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  CancelPaymentInput,
  CapturePaymentInput,
  DeletePaymentInput,
  GetPaymentStatusInput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  AuthorizePaymentOutput,
  CapturePaymentOutput,
  CancelPaymentOutput,
  DeletePaymentOutput,
  GetPaymentStatusOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
  ProviderWebhookPayload,
} from "@medusajs/framework/types"
import { YookassaClient } from "./core/yookassa-client"
import type { YookassaAuth } from "./core/yookassa-client"

export type YookassaProviderOptions = {
  shopId?: string
  secretKey?: string
  oauthToken?: string
  returnUrl?: string
  capture?: boolean
  simulationMode?: boolean
  simulationBaseUrl?: string
}

export class YookassaProviderService extends AbstractPaymentProvider<YookassaProviderOptions> {
  static identifier = "yookassa"

  private client: YookassaClient | null = null
  private options_: YookassaProviderOptions

  constructor(container: Record<string, unknown>, options: YookassaProviderOptions) {
    super(container, options)
    this.options_ = options

    if (!options.simulationMode) {
      let auth: YookassaAuth
      if (options.oauthToken) {
        auth = { type: "bearer", token: options.oauthToken, shopId: options.shopId }
      } else if (options.shopId && options.secretKey) {
        auth = { type: "basic", shopId: options.shopId, secretKey: options.secretKey }
      } else {
        throw new Error(
          "YookassaProvider: set oauthToken, or shopId+secretKey, or simulationMode=true"
        )
      }
      this.client = new YookassaClient(auth)
    }
  }

  private get returnUrl(): string {
    return (
      this.options_.returnUrl ||
      process.env.YOOKASSA_RETURN_URL ||
      "http://localhost:3000/checkout?pay=yookassa"
    )
  }

  // ─── Initiate ────────────────────────────────────────────────────────────────

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, context, data } = input
    const amountInRubles = Number(amount).toFixed(2)

    if (this.options_.simulationMode) {
      const fakeId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const base = (this.options_.simulationBaseUrl || "http://localhost:9000/sim/yookassa/pay").replace(/\/$/, "")
      // Use return_url from input data (sent by storefront with correct origin), fall back to config
      const inputData = (data ?? {}) as Record<string, unknown>
      const inputConfirmation = inputData.confirmation as Record<string, unknown> | undefined
      const dynamicReturnUrl = (inputConfirmation?.return_url as string) ?? this.returnUrl
      const retUrl = encodeURIComponent(dynamicReturnUrl)
      const confirmUrl = `${base}?id=${fakeId}&return_url=${retUrl}`
      return {
        id: fakeId,
        data: {
          id: fakeId,
          status: "pending",
          simulation: true,
          confirmation: { type: "redirect", confirmation_url: confirmUrl },
        },
      }
    }

    const inputData = (data ?? {}) as Record<string, unknown>
    const confirmation = inputData.confirmation as Record<string, unknown> | undefined
    const returnUrl = (confirmation?.return_url as string) ?? this.returnUrl
    const ctx = (context ?? {}) as Record<string, unknown>

    const payment = await this.client!.createPayment({
      amount: { value: amountInRubles, currency: (currency_code || "RUB").toUpperCase() },
      confirmation: { type: "redirect", return_url: returnUrl },
      capture: this.options_.capture !== false,
      description: ctx.resource_id ? `Order ${ctx.resource_id}` : "Оплата заказа",
      metadata: { cart_id: ctx.cart_id, customer_id: (ctx.customer as Record<string, unknown>)?.id },
    })

    return {
      id: payment.id,
      data: {
        id: payment.id,
        status: payment.status,
        confirmation: { type: "redirect", confirmation_url: payment.confirmation?.confirmation_url },
      },
    }
  }

  // ─── Authorize ───────────────────────────────────────────────────────────────

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined

    if (this.options_.simulationMode) {
      return { status: PaymentSessionStatus.AUTHORIZED, data }
    }
    if (!id) return { status: PaymentSessionStatus.ERROR, data }

    const payment = await this.client!.getPayment(id)
    return { status: this.mapStatus(payment.status), data: { ...data, ...payment } }
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // YooKassa doesn't support updating a pending payment; re-initiate
    return this.initiatePayment(input)
  }

  // ─── Capture ─────────────────────────────────────────────────────────────────

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined

    if (this.options_.simulationMode || !id) {
      return { data: { ...data, status: "succeeded" } }
    }

    const payment = await this.client!.getPayment(id)
    if (payment.status === "waiting_for_capture") {
      const captured = await this.client!.capturePayment(id, { amount: payment.amount })
      return { data: { ...data, ...captured } }
    }
    return { data: { ...data, ...payment } }
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────────

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined

    if (this.options_.simulationMode || !id) {
      return { data: { ...data, status: "canceled" } }
    }

    const payment = await this.client!.cancelPayment(id)
    return { data: { ...data, ...payment } }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined

    if (this.options_.simulationMode) return { status: PaymentSessionStatus.AUTHORIZED }
    if (!id) return { status: PaymentSessionStatus.ERROR }

    const payment = await this.client!.getPayment(id)
    return { status: this.mapStatus(payment.status) }
  }

  // ─── Refund ──────────────────────────────────────────────────────────────────

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined
    const amountInRubles = Number(input.amount).toFixed(2)

    if (this.options_.simulationMode || !id) return { data: { ...data, refunded: true } }

    const refund = await this.client!.createRefund({ payment_id: id, amount: { value: amountInRubles, currency: "RUB" } })
    return { data: { ...data, refund } }
  }

  // ─── Retrieve ────────────────────────────────────────────────────────────────

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = (input.data ?? {}) as Record<string, unknown>
    const id = (data.id ?? data.session_id) as string | undefined

    if (this.options_.simulationMode || !id) return { data }

    const payment = await this.client!.getPayment(id)
    return { data: { ...data, ...payment } }
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────────

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const event = payload.data as { event?: string; object?: { id?: string; status?: string } }

    if (event.event === "payment.succeeded") {
      return {
        action: "authorized",
        data: { session_id: event.object?.id ?? "", amount: 0 },
      }
    }
    if (event.event === "payment.canceled") {
      return {
        action: "canceled",
        data: { session_id: event.object?.id ?? "", amount: 0 },
      }
    }
    return { action: "not_supported", data: { session_id: "", amount: 0 } }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private mapStatus(ykStatus: string): PaymentSessionStatus {
    switch (ykStatus) {
      case "succeeded":
      case "waiting_for_capture":
        return PaymentSessionStatus.AUTHORIZED
      case "canceled":
        return PaymentSessionStatus.CANCELED
      default:
        return PaymentSessionStatus.PENDING
    }
  }
}

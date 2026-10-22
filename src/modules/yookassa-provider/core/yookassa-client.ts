import { v4 as uuidv4 } from "uuid"

export type YookassaAuth =
  | { type: "basic"; shopId: string; secretKey: string }
  | { type: "bearer"; token: string; shopId?: string }

export interface YookassaPaymentResponse {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  confirmation?: {
    type: string
    confirmation_url?: string
    return_url?: string
  }
  amount?: { value: string; currency: string }
  [key: string]: unknown
}

export interface YookassaRefundResponse {
  id: string
  status: string
  [key: string]: unknown
}

const YOOKASSA_BASE = "https://api.yookassa.ru/v3"

async function ykFetch<T>(
  auth: YookassaAuth,
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (auth.type === "basic") {
    const creds = Buffer.from(`${auth.shopId}:${auth.secretKey}`).toString("base64")
    headers["Authorization"] = `Basic ${creds}`
  } else {
    headers["Authorization"] = `Bearer ${auth.token}`
    if (auth.shopId) {
      headers["Yookassa-Sub-Account-Id"] = auth.shopId
    }
  }

  if (idempotencyKey) {
    headers["Idempotence-Key"] = idempotencyKey
  }

  const res = await fetch(`${YOOKASSA_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`YooKassa returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!res.ok) {
    const err = json as { description?: string; code?: string }
    throw new Error(`YooKassa ${res.status} ${err.code ?? ""}: ${err.description ?? text}`)
  }

  return json as T
}

export class YookassaClient {
  constructor(private auth: YookassaAuth) {}

  createPayment(payload: unknown, idempotencyKey?: string) {
    return ykFetch<YookassaPaymentResponse>(
      this.auth, "POST", "/payments", payload, idempotencyKey ?? uuidv4()
    )
  }

  getPayment(id: string) {
    return ykFetch<YookassaPaymentResponse>(this.auth, "GET", `/payments/${id}`)
  }

  capturePayment(id: string, payload: unknown, idempotencyKey?: string) {
    return ykFetch<YookassaPaymentResponse>(
      this.auth, "POST", `/payments/${id}/capture`, payload, idempotencyKey ?? uuidv4()
    )
  }

  cancelPayment(id: string, idempotencyKey?: string) {
    return ykFetch<YookassaPaymentResponse>(
      this.auth, "POST", `/payments/${id}/cancel`, {}, idempotencyKey ?? uuidv4()
    )
  }

  createRefund(payload: unknown, idempotencyKey?: string) {
    return ykFetch<YookassaRefundResponse>(
      this.auth, "POST", "/refunds", payload, idempotencyKey ?? uuidv4()
    )
  }
}

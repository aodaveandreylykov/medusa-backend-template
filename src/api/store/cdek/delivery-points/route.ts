import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"

const IS_CDEK_TEST = (process.env.CDEK_CLIENT_ID || "").startsWith("EMscd")
const CDEK_BASE = IS_CDEK_TEST ? "https://api.edu.cdek.ru/v2" : "https://api.cdek.ru/v2"
const CDEK_TOKEN_URL = `${CDEK_BASE}/oauth/token`

let cachedToken: { value: string; expiresAt: number } | null = null

async function getCdekToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value
  }

  const clientId = process.env.CDEK_CLIENT_ID
  const clientSecret = process.env.CDEK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("CDEK_CLIENT_ID / CDEK_CLIENT_SECRET not set")
  }

  const res = await fetch(CDEK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`CDEK OAuth failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.value
}

const MOCK_POINTS = [
  { code: "MSK1", name: "ПВЗ Тверская", address: "г. Москва, ул. Тверская, д. 5", city: "Москва", postal_code: "125009", region: "Москва", work_time: "Пн-Вс 09:00-21:00", phone: "+74951234567" },
  { code: "MSK2", name: "ПВЗ Арбат", address: "г. Москва, ул. Арбат, д. 12", city: "Москва", postal_code: "119002", region: "Москва", work_time: "Пн-Вс 10:00-20:00", phone: "+74957654321" },
  { code: "MSK3", name: "ПВЗ Марьино", address: "г. Москва, ул. Люблинская, д. 169", city: "Москва", postal_code: "109341", region: "Москва", work_time: "Пн-Сб 09:00-20:00", phone: "+74951112233" },
  { code: "SPB1", name: "ПВЗ Невский", address: "г. Санкт-Петербург, Невский пр., д. 88", city: "Санкт-Петербург", postal_code: "191025", region: "Санкт-Петербург", work_time: "Пн-Вс 10:00-21:00", phone: "+78124445566" },
  { code: "SPB2", name: "ПВЗ Васильевский", address: "г. Санкт-Петербург, В.О., 7-я линия, д. 22", city: "Санкт-Петербург", postal_code: "199004", region: "Санкт-Петербург", work_time: "Пн-Сб 09:00-19:00", phone: "+78127778899" },
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const city = String(req.query?.city || "").trim()
  const postal = String(req.query?.postal_code || "").trim()
  const page = Math.max(0, parseInt(String(req.query?.page || "0"), 10) || 0)
  const size = Math.min(50, Math.max(1, parseInt(String(req.query?.size || "50"), 10) || 50))

  try {
    const token = await getCdekToken()

    const params = new URLSearchParams({
      type: "PVZ",
      is_handout: "true",
      country_codes: "RU",
      size: String(size),
      page: String(page),
    })

    if (postal) params.set("postal_code", postal)
    else if (city) params.set("city_name", city)

    const cdekRes = await fetch(`${CDEK_BASE}/deliverypoints?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!cdekRes.ok) {
      console.error("[CDEK] deliverypoints failed:", cdekRes.status)
      return res.status(200).json({ points: [], error: `CDEK ${cdekRes.status}` })
    }

    const raw = (await cdekRes.json()) as Array<{
      code?: string
      name?: string
      location?: {
        address?: string
        city?: string
        postal_code?: string
        region?: string
      }
      work_time?: string
      phones?: { number?: string }[]
    }>

    const points = (raw || [])
      .filter((p) => p.code && p.location?.address)
      .map((p) => ({
        code: p.code!,
        name: p.name || p.code!,
        address: p.location!.address!,
        city: p.location?.city || city,
        postal_code: p.location?.postal_code || "",
        region: p.location?.region || "",
        work_time: p.work_time || "",
        phone: p.phones?.[0]?.number || "",
      }))

    if (points.length > 0) {
      return res.status(200).json({ points, total: points.length, page, size })
    }
  } catch (err) {
    console.error("[CDEK route]", err instanceof Error ? err.message : err)
  }

  const search = (city || postal).toLowerCase()
  const fallback = MOCK_POINTS.filter((p) =>
    !search ||
    p.city.toLowerCase().includes(search) ||
    p.postal_code.includes(search) ||
    p.address.toLowerCase().includes(search)
  )
  return res.status(200).json({ points: fallback })
}

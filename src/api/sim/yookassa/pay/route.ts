import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"

/**
 * GET /store/yookassa-sim/pay?id=sim_xxx&return_url=http://...
 *
 * Simulation payment page for local testing only.
 * Shows a simple HTML form — user clicks "Оплатить" to confirm,
 * or "Отменить" to cancel. Redirects back to storefront return_url.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = String(req.query?.id || "")
  const returnUrl = String(req.query?.return_url || "http://localhost:3000/checkout")

  const confirmUrl = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}sim_paid=true&payment_id=${id}`
  const cancelUrl = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}sim_cancelled=true&payment_id=${id}`

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.status(200).send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ЮKassa — тестовый платёж</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      text-align: center;
    }
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: #FF6600;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon svg { width: 22px; height: 22px; fill: white; }
    .logo-text { font-size: 20px; font-weight: 700; color: #333; }
    .badge {
      display: inline-block;
      background: #FFF3E0;
      color: #E65100;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h2 { font-size: 18px; color: #222; margin-bottom: 8px; }
    .id { font-size: 12px; color: #999; margin-bottom: 28px; font-family: monospace; }
    .card-field {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 14px 16px;
      text-align: left;
      margin-bottom: 16px;
    }
    .card-field label { font-size: 11px; color: #999; display: block; margin-bottom: 4px; }
    .card-field input {
      background: none;
      border: none;
      outline: none;
      font-size: 15px;
      color: #333;
      width: 100%;
    }
    .btn-pay {
      width: 100%;
      padding: 16px;
      background: #FF6600;
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: block;
      margin-bottom: 12px;
      transition: background 0.15s;
    }
    .btn-pay:hover { background: #E65100; }
    .btn-cancel {
      width: 100%;
      padding: 14px;
      background: none;
      color: #999;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      display: block;
    }
    .btn-cancel:hover { background: #f5f5f5; }
    .note { font-size: 11px; color: #bbb; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
      </div>
      <span class="logo-text">ЮKassa</span>
    </div>
    <div class="badge">Тестовый режим</div>
    <h2>Подтвердите оплату</h2>
    <p class="id">ID платежа: ${id}</p>
    <div class="card-field">
      <label>Номер карты</label>
      <input value="5555 5555 5555 4444" readonly />
    </div>
    <div class="card-field">
      <label>Срок действия</label>
      <input value="12/28" readonly />
    </div>
    <div class="card-field">
      <label>CVV</label>
      <input value="123" readonly />
    </div>
    <a href="${confirmUrl}" class="btn-pay">Оплатить (тест)</a>
    <a href="${cancelUrl}" class="btn-cancel">Отменить</a>
    <p class="note">Это тестовая страница. Реальных списаний нет.</p>
  </div>
</body>
</html>`)
}

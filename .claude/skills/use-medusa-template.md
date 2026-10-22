# use-medusa-template

Разворачивает новый проект из GitHub Template `aodaveandreylykov/medusa-backend-template`.

## Что внутри шаблона

- **YooKassa** — платёжный провайдер (МИР, СБП). Simulation mode по умолчанию.
- **CDEK proxy** — `/store/cdek/delivery-points`, авторизация через OAuth, fallback mock-ПВЗ.
- **Contact module** — хранит заявки с формы, панель в Medusa Admin.
- **Dockerfile + railway.toml** — деплой на Railway одной кнопкой.
- **start.sh** — миграции → ensure-admin → seed-products (idempotent).

## Шаги развёртывания

### 1. Создать новый репозиторий из шаблона

Открыть: https://github.com/aodaveandreylykov/medusa-backend-template  
Нажать **Use this template** → **Create a new repository** → задать имя → Create.

### 2. Подключить к Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → выбрать новый репозиторий
2. Добавить сервисы: **Add Service** → **Database** → PostgreSQL, потом Redis
3. Railway автоматически свяжет DATABASE_URL и REDIS_URL через internal URLs

### 3. Заполнить Variables в Railway

Открыть сервис → вкладка **Variables** → добавить:

```
# Обязательные
JWT_SECRET=<случайная строка 32+ символа>
COOKIE_SECRET=<случайная строка 32+ символа>
MEDUSA_ADMIN_EMAIL=admin@yourdomain.com
MEDUSA_ADMIN_PASSWORD=<сильный пароль>
DATABASE_SSL=true
NODE_ENV=production

# CORS — URL storefront (GitHub Pages или Vercel)
ADMIN_CORS=https://ВАШ-STOREFRONT.github.io
AUTH_CORS=https://ВАШ-STOREFRONT.github.io
STORE_CORS=https://ВАШ-STOREFRONT.github.io

# YooKassa
YOOKASSA_SHOP_ID=<shop id из yookassa.ru>
YOOKASSA_SECRET_KEY=<secret key из yookassa.ru>
YOOKASSA_RETURN_URL=https://ВАШ-STOREFRONT.github.io/shop/order?pay=yookassa
YOOKASSA_SIMULATION=true
YOOKASSA_SIM_URL=https://ВАШ-БЭКЕНД.railway.app

# CDEK (опционально — без них работает mock)
CDEK_CLIENT_ID=<client id из cdek.ru>
CDEK_CLIENT_SECRET=<client secret из cdek.ru>
```

### 4. Задеплоить

Railway сам соберёт Docker образ и запустит `start.sh`:
- Запустит миграции БД
- Создаст admin-пользователя
- Запустит сервер
- Засидирует товары

Занимает ~3-5 минут. Healthcheck: `GET /health`.

### 5. Получить publishable key для storefront

После старта: `https://ВАШ-БЭКЕНД.railway.app/app`  
→ Войти с MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD  
→ Settings → API Keys → скопировать publishable key (`pk_...`)

Вставить в storefront `.env.local`:
```
MEDUSA_BACKEND_URL=https://ВАШ-БЭКЕНД.railway.app
MEDUSA_PUBLISHABLE_KEY=pk_...
```

### 6. Обновить CORS после получения URL бэкенда

В Railway Variables обновить ADMIN_CORS, AUTH_CORS, STORE_CORS на реальный URL storefront.

## Настройка Medusa Admin после старта

1. **Регион** → создать RUB регион, страна RU, валюта RUB
2. **Shipping** → Locations → добавить локацию → Service Zone "ru" → добавить опции доставки:
   - "СДЭК — ПВЗ" (amount в копейках, напр. 29000 = 290₽)
   - "СДЭК — Курьер"
   - "Почта России"
3. **Payment** → регион RUB → включить YooKassa и Manual провайдеры

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| ПВЗ не отображаются | Нет CDEK ключей — работает mock. Получить на cdek.ru |
| YooKassa не работает | Проверить YOOKASSA_SIMULATION=true для теста |
| Бэкенд не стартует | Проверить DATABASE_URL и REDIS_URL (внутренние Railway URLs) |
| publishable key не принимается | Взять из Medusa Admin этого же Railway-деплоя |
| CORS ошибки | Обновить ADMIN_CORS / STORE_CORS на актуальный URL storefront |

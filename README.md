# Brightic — Medusa Backend

Конфигурация и расширения для Medusa v2.

## Структура

```
medusa-config.ts          Конфиг Medusa: CORS, провайдеры оплаты
src/
  api/store/cdek/route.ts  GET /store/cdek/delivery-points?city=…
scripts/
  seed-shipping.ts         Создаёт RUB-регион и 4 способа доставки
.env.example               Все нужные переменные с комментариями
```

## Запуск (первый раз)

1. Установить и запустить Medusa v2:

```bash
npx create-medusa-app@latest brightic-medusa --no-browser
cd brightic-medusa
```

2. Скопировать файлы из этой папки в корень Medusa-проекта:

```bash
cp medusa-config.ts      brightic-medusa/medusa-config.ts
cp -r src/               brightic-medusa/src/
cp scripts/seed-shipping.ts brightic-medusa/scripts/
```

3. Добавить переменные в `.env` Medusa-проекта (см. `.env.example`):

```bash
# Обязательно для фазы 2:
CDEK_CLIENT_ID=your_id
CDEK_CLIENT_SECRET=your_secret
```

4. Запустить Medusa:

```bash
cd brightic-medusa && npx medusa develop
```

5. Запустить seed-скрипт (в отдельном терминале, пока работает Medusa):

```bash
MEDUSA_ADMIN_EMAIL=admin@... MEDUSA_ADMIN_PASSWORD=... \
  npx ts-node scripts/seed-shipping.ts
```

## СДЭК тестовые ключи

```
CDEK_CLIENT_ID=EMscd6r9JnFiQ3bLoyjJY6eM
CDEK_CLIENT_SECRET=PjLZkKBHEiLK3YsjtNrt7ZpGv98nJ7iG
```

## После запуска

- Admin: http://localhost:9000/app
- API: http://localhost:9000
- Убедиться: Regions → RUB → Shipping Options показывает 4 варианта

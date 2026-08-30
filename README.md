# AITube WhatsApp Baileys Forwarder

Автоматичний пересилач повідомлень між групами WhatsApp на базі Baileys, з локальним вебінтерфейсом та контрольованою LLM-фільтрацією AITube V2.

## V1 — класичний forwarder

V1 забезпечує:

- підключення до WhatsApp через QR-код;
- отримання списку груп;
- правила пересилання між групами;
- декілька правил одночасно;
- увімкнення, призупинення та видалення правил;
- локальний вебінтерфейс;
- журнал пересилань і статистику;
- захист від дублювання повідомлень;
- автоматичне перепідключення;
- запуск на Android через Termux.

## V2 — LLM template-only filter

V2 додає контрольований LLM-фільтр перед пересиланням.

```text
WhatsApp message
       ↓
LLM classification
       ↓
template + variables + confidence
       ↓
confidence check
       ↓
required variables check
       ↓
render approved template
       ↓
SEND / SKIP
```

**Ключовий принцип:** LLM не генерує довільний текст для відправлення. Повідомлення може бути відправлене тільки після вибору існуючого шаблону та успішної перевірки необхідних змінних.

Повідомлення отримує `SKIP`, якщо:

- шаблон не знайдено;
- confidence нижче порогу;
- відсутня обов'язкова змінна;
- недостатньо інформації для безпечного рендерингу шаблону.

Типовий поріг: `0.85`, налаштовується через `LLM_CONFIDENCE_THRESHOLD`.

## Шаблони

Production-конфігурація може зберігатися у:

```text
private/templates.json
```

`private/` виключений із Git. Публічні sanitized/test шаблони знаходяться у `llm/templates.json`.

## Встановлення

### macOS / Linux

```bash
npm install
cp .env.example .env
# відредагуйте .env
npm start
```

### Android / Termux — рекомендований спосіб

Встановіть **Termux** із надійного джерела, відкрийте його та виконайте:

```bash
pkg update -y
pkg install -y git

git clone https://github.com/kazantipanet/baileys-forwarder.git ~/baileys-forwarder
cd ~/baileys-forwarder
bash install.sh
```

Потім створіть `.env`:

```bash
cp .env.example .env
nano .env
```

Вкажіть щонайменше:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5
LLM_CONFIDENCE_THRESHOLD=0.85
```

Запуск:

```bash
bash start.sh
```

Або:

```bash
cd ~/baileys-forwarder
npm start
```

Локальний вебінтерфейс після запуску:

```text
http://127.0.0.1:3000
```

Перший запуск створить WhatsApp-сесію у `auth_info/`. Вона залишається локально на телефоні та не повинна потрапляти в Git.

## Оновлення на Android

Якщо застосунок уже встановлений через `install.sh`, оновлення виконується так:

```bash
cd ~/baileys-forwarder
bash install.sh
```

Скрипт отримує актуальний `main` з GitHub, встановлює залежності та перевіряє синтаксис `index.js`.

**Важливо:** `auth_info/`, `.env`, `config.json`, журнали та `private/` ігноруються Git, тому робоча WhatsApp-сесія та локальна конфігурація не повинні стиратися під час оновлення.

Після оновлення запуск:

```bash
bash start.sh
```

## Тести

Основний V2 regression test:

```bash
npm test
```

Очікуваний результат:

```text
Результат: 12/12
```

Окремі LLM-тести знаходяться у `llm/`.

## Android / Termux: стабільна робота

`start.sh` використовує `termux-wake-lock`, якщо команда доступна, щоб зменшити ризик присипання процесу Android.

Для довготривалої роботи також рекомендується:

1. не закривати Termux через системний менеджер застосунків;
2. дозволити Termux працювати у фоні в налаштуваннях Android;
3. вимкнути оптимізацію батареї для Termux, якщо пристрій агресивно зупиняє фонові процеси;
4. не видаляти `~/baileys-forwarder/auth_info/` — це локальна WhatsApp-сесія.

## Безпека

Не комітьте:

- `.env` та секрети;
- `auth_info/`;
- `private/`;
- локальні журнали;
- локальні файли стану;
- резервні копії вихідного коду.

Для змінних середовища використовуйте `.env.example` як шаблон.

## Версія

Поточна функціональна віха: **AITube V2 — LLM template-only filtering**.

Git tag: `v2.0.0`.

## Автор

AITube

© 2026 AITube

## Ліцензія

ISC License

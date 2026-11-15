# AGROSAS OS · Team Astrology

Платформа климатической аналитики и управления полями на основе открытых данных NASA.

Репозиторий: https://github.com/Storozh-007/AGROSAS-OS

Главная: `/`. Глобус и поля: `/dashboard`. Конструктор и 3D-слои: `/farm-lab`. Миссии и модели: `/missions`. Господарства, профили и события: `/network`.

Главный сценарий: вода и энергия → выполнимые окна полива → сохранённая задача → отчёт фермера. [Описание решения](docs/FARM_OPERATIONS.md).

Новый рабочий сценарий и ограничения источников: [GLOBAL_WORKSPACE.md](docs/GLOBAL_WORKSPACE.md). Геометрия 12 примеров (8 США): [GLOBAL_FIELD_SOURCES.md](docs/GLOBAL_FIELD_SOURCES.md).

# Единый запуск через Docker

```bash
./fieldshift start
# http://localhost:8080
./fieldshift stop
```

Инструкции: [DOCKER_SETUP.md](DOCKER_SETUP.md), [OPERATIONS.md](OPERATIONS.md), [DEPLOYMENT.md](DEPLOYMENT.md). Прежний запуск без контейнеров остаётся доступным ниже.

# FieldShift: Earth OS 🌍🛰️
### From Space to Soil. From Data to Decisions.
**NASA Space Apps Challenge 2026 · Full-Stack Product Development**

FieldShift: Earth OS — повнофункціональна платформа інтелектуального управління сільськогосподарськими полями, яка поєднує супутникові спостереження NASA, метеорологічні кліматичні моделі, наземні IoT-сенсори та пояснюваний штучний інтелект для оптимізації сівозмін в умовах кліматичних змін.

---

## 🌟 Ключові можливості MVP

1. **NASA Earth Observation Engine**:
   - **NASA POWER API**: Отримання та нормалізація історичних спостережень температури повітря (`T2M`) та опадів (`PRECTOTCORR`) за географічними координатами центру поля.
   - **HLS / Sentinel-2**: шари відбиття HLS у NASA GIBS; окремий розрахунок NDVI з B08/B04 Sentinel-2 (10 м) із маскою якості. Регіональні продукти не підміняють вимірювання датчика.
   - Прозора паспортизація походження кожного набору даних (spatial resolution, product ID, coverage %, observation date).

2. **Crop Rotation Intelligence (Сквозний сценарій)**:
   - Багатофакторне порівняння трьох стратегій:
     - **S1 — Current Rotation**: Поточна сівозміна поля.
     - **S2 — Soil Regeneration**: Регенерація ґрунту (бобові, конюшина, озимі покривні культури, фіксація азоту).
     - **S3 — Drought Resilience**: Стійкість до посухи (сорго, ячмінь, культури з глибокою кореневою системою).
   - Інтерактивне налаштування пріоритетів фермера:
     - 💧 Збереження води
     - 🌱 Здоров’я ґрунту
     - 🛡️ Стійкість до ризиків
     - 📈 Економічна ліквідність

3. **Climate Time Machine (Кліматична машина часу)**:
   - **Historical Mode**: Реальні місячні кліматичні графіки NASA POWER.
   - **Scenario Mode**: Миттєве моделювання чутливості до потепління ($0 \dots +4\ ^\circ\text{C}$) та дефіциту опадів ($-50\% \dots +20\%$) із перерахунком індексу кліматичного стресу та оцінок сівозмін.

4. **Explainable AI Agronomist**:
   - Детермінований інтерпретатор наукових результатів (українською та англійською мовами).
   - Пояснює точний розрив між потребою у воді та опадами, баланс родин культур, штрафи за монокультуру, ризики частих посівів соняшнику та формує покроковий чеклист дій для агронома.

5. **IoT & Smart Farm Kit**:
   - Реєстр наземного обладнання: датчики вологості ґрунту, метеостанції, опадоміри.
   - Канали зв'язку: Starlink, 4G LTE, LoRaWAN.
   - Вбудований симулятор добової телеметрії за 7 днів та підтримка імпорту CSV.

6. **Ukraine Resilience**:
   - Посилання на офіційні канали цивільного захисту; оперативний потік ДСНС не підключений.
   - Контроль резервного живлення (запас палива дизель-генератора та заряд акумуляторів).
   - Чек-ліст мінної безпеки для механізаторів перед виїздом у поле та телефони екстрених служб (101, 102, 103, 112).

7. **Адаптивний Mobile UX для iPhone**:
   - Mobile-first інтерфейс із нижньою навігацією, підтримкою PWA (додавання на домашній екран iOS) та швидким доступом до карт MapLibre GL.

---

## 🏗️ Технологічний стек

| Рівень | Технології |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, Lucide Icons, TanStack React Query, Recharts, MapLibre GL JS |
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, HTTPX, GeoPandas, Shapely, PyProj |
| **Database** | PostgreSQL 17 + PostGIS (геопросторові полігони полів `SRID 4326`, індекси `GIST`) |
| **Local OS** | macOS native (Apple Silicon / Intel) — **100% без обов’язкового Docker** |

---

## 🚀 Швидкий запуск на macOS

### 1. Системні вимоги
- **macOS** 13+ (Ventura, Sonoma, Sequoia)
- **Node.js** 20+ (перевірка: `node -v`)
- **Python** 3.12+ (перевірка: `python3 --version`)
- **PostgreSQL 17** та **PostGIS** (через Homebrew)

### 2. Встановлення PostgreSQL та PostGIS (якщо ще не встановлено)
```bash
brew install postgresql@17 postgis
brew services start postgresql@17

# Створення бази даних та активація розширення PostGIS
createdb fieldshift
psql -d fieldshift -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 3. Клонування та налаштування змінних оточення
Файл `.env` вже підготовлений у корені проєкту:
```bash
# Перевірка наявності .env
cat .env
```
Вміст `.env`:
```ini
DATABASE_URL=postgresql+psycopg://localhost:5432/fieldshift
APP_TOKEN=<generate-a-random-secret>
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
API_BASE_URL=http://127.0.0.1:8000
```

### 4. Ініціалізація бази даних та міграції
```bash
./scripts/seed_demo.sh
```
Це автоматично застосує міграції Alembic (`0001_foundation`, `0002_devices_vegetation`) та створить демонстраційне господарство «Полтавські лани» з полем «Сонячне» (118.94 га).

### 5. Запуск Backend (FastAPI)
```bash
./scripts/run_backend.sh
```
Backend запуститься на: **`http://127.0.0.1:8000`**
OpenAPI інтерактивна документація: **`http://127.0.0.1:8000/docs`**

### 6. Запуск Frontend (Next.js)
В окремому терміналі:
```bash
./scripts/run_frontend.sh
```
Frontend запуститься на: **`http://127.0.0.1:3000`**

### 7. Відкриття додатку
- **Головний Dashboard**: [http://127.0.0.1:3000/](http://127.0.0.1:3000/)
- **Публічний Landing Page**: [http://127.0.0.1:3000/welcome](http://127.0.0.1:3000/welcome)

---

## 🧪 Автоматичне тестування

### 1. Наскрізний верифікатор сценарію (End-to-End Verifier)
Повністю автономний тест 10 кроків (створення поля $\to$ NASA POWER $\to$ оцінка сівозмін $\to$ Climate Time Machine $\to$ AI Agronomist $\to$ HLS NDVI $\to$ IoT телеметрія $\to$ Ukraine Resilience):
```bash
.venv/bin/python scripts/verify_e2e.py
```

### 2. Тести Backend (pytest)
```bash
PYTHONPATH=backend .venv/bin/pytest -v
```
*15 тестів перевіряють наукові розрахунки, формулу NDVI, геодезичні площі, валідацію кліматичних сезонів та роботу API.*

### 3. Модульні тести Frontend (vitest)
```bash
cd frontend && npm test
```
*6 тестів перевіряють симетрію перекладів i18n (українська/англійська), каталоги культур та нормалізацію ваг.*

### 4. Браузерні тести (Playwright E2E)
```bash
cd frontend && npx playwright test
```

---

## 📱 Тестування PWA на iPhone

1. Переконайтеся, що Mac та iPhone підключені до однієї Wi-Fi мережі.
2. Дізнайтеся локальну IP-адресу Mac: `ipconfig getifaddr en0` (наприклад, `192.168.1.45`).
3. Запустіть Next.js із доступом у мережу:
   ```bash
   cd frontend && npm run dev -- --hostname 0.0.0.0
   ```
4. Відкрийте Safari на iPhone: `http://192.168.1.45:3000/`.
5. Натисніть кнопку **«Поділитися»** (квадрат зі стрілкою) $\to$ **«На початковий екран»**.
6. FieldShift запуститься як окремий нативний додаток з іконкою, safe areas та нижньою навігацією.

---

## 🏛️ Структура репозиторію

```text
FIELDSHIFT_PRODUCT/
├── backend/
│   ├── alembic/              # Міграції бази даних PostGIS
│   ├── app/
│   │   ├── main.py           # FastAPI роутери та ендпоінти
│   │   ├── models.py         # SQLAlchemy PostGIS моделі
│   │   ├── schemas.py        # Pydantic схеми та валідація
│   │   ├── seed.py           # Ініціалізація демо-даних Полтави
│   │   └── services/
│   │       ├── power.py      # NASA POWER клієнт та нормалізатор
│   │       ├── hls.py        # NASA HLS NDVI аналізатор
│   │       ├── crops.py      # Агрономічний каталог культур
│   │       ├── analysis.py   # Багатофакторний двигун сівозмін
│   │       ├── ai_agronomist.py # Пояснюваний AI асистент
│   │       ├── iot.py        # Реєстр та симулятор телеметрії
│   │       └── safety.py     # Ukraine Resilience модуль
│   ├── tests/                # Pytest тести
│   └── pyproject.toml
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Головний Workspace
│   │   ├── welcome/page.tsx  # Публічний Landing Page
│   │   └── api/backend/      # Next.js BFF проксі
│   ├── components/
│   │   ├── workspace.tsx     # Головний робочий простір
│   │   ├── field-map.tsx     # Карта полів MapLibre GL
│   │   ├── field-editor.tsx  # Малювання полігонів полів
│   │   ├── climate-chart.tsx # Графіки Recharts
│   │   ├── devices-view.tsx  # Панель IoT та телеметрії
│   │   ├── safety-view.tsx   # Панель Ukraine Resilience
│   │   └── ai-explanation-dialog.tsx # Діалог пояснення AI
│   ├── lib/
│   │   ├── i18n.ts           # Повна локалізація UK / EN
│   │   ├── types.ts          # TypeScript інтерфейси
│   │   └── api.ts            # Клієнт API запитів
│   ├── tests/                # Vitest та Playwright тести
│   └── package.json
│
├── scripts/
│   ├── run_backend.sh        # Скрипт запуску FastAPI
│   ├── run_frontend.sh       # Скрипт запуску Next.js
│   ├── seed_demo.sh          # Скрипт міграцій та наповнення БД
│   └── verify_e2e.py         # 10-кроковий наскрізний верифікатор
├── .env                      # Конфігурація середовища
└── README.md
```

---

## 📜 Наукова чесність та дисклеймери

- **FieldShift є незалежною платформою**, розробленою для NASA Space Apps Challenge 2026 з використанням відкритих даних NASA Open Science Data. Вона не є офіційним продуктом NASA.
- Усі оцінки сівозмін розраховуються за прозорим багатокритеріальним агрономічним алгоритмом на основі фактичних опадів, сумарного випаровування та балансу культур, а не за фіктивними відсотками приросту урожайності.
- Дані NASA POWER надаються у форматі кліматичного реаналізу на сітці приблизно $0.5^\circ \times 0.625^\circ$, що чітко позначається в інтерфейсі.
- Розділ **Ukraine Resilience** орієнтується виключно на офіційні канали ДСНС та цивільну безпеку. Відсутність сигналу тривоги в інтерфейсі не є гарантією абсолютної безпеки.

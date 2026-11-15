from datetime import datetime, timezone

EMERGENCY_CONTACTS = [
    {
        'id': 'dsns',
        'title': 'Державна служба України з надзвичайних ситуацій (ДСНС)',
        'phone': '101',
        'description': 'Пожежна охорона, порятунок людей, виявлення підозрілих вибухонебезпечних предметів',
        'url': 'https://dsns.gov.ua/',
    },
    {
        'id': 'police',
        'title': 'Національна поліція України',
        'phone': '102',
        'description': 'Охорона правопорядку, фіксація правопорушень та надзвичайних подій',
        'url': 'https://www.npu.gov.ua/',
    },
    {
        'id': 'ambulance',
        'title': 'Екстрена медична допомога',
        'phone': '103',
        'description': 'Невідкладна медична допомога та евакуація постраждалих',
        'url': 'https://moz.gov.ua/',
    },
    {
        'id': 'single_emergency',
        'title': 'Єдиний номер екстреної допомоги',
        'phone': '112',
        'description': 'Єдина диспетчерська служба порятунку за європейським стандартом',
        'url': 'https://mvs.gov.ua/',
    },
]

CIVIL_SAFETY_CHECKLIST = [
    {
        'id': 'ch-1',
        'category': 'mine_safety',
        'title': 'Перевірка статусу саперного обстеження ділянки',
        'description': 'Переконайтеся, що поле внесено до реєстру обстежених/розмінованих територій або не зазнавало бойових дій.',
        'mandatory': True,
    },
    {
        'id': 'ch-2',
        'category': 'mine_safety',
        'title': 'Правило «Не підходь, не чіпай, телефонуй 101/112»',
        'description': 'У разі виявлення уламків дронів, боєприпасів або нерозірваних елементів негайно зупиніть роботи та позначте місце.',
        'mandatory': True,
    },
    {
        'id': 'ch-3',
        'category': 'personnel',
        'title': 'Комплектація аптечки першої допомоги (IFAK)',
        'description': 'У кабіні кожної одиниці техніки має бути сертифікований турнікет (CAT / SICH), кровоспинний бинт та бандаж.',
        'mandatory': True,
    },
    {
        'id': 'ch-4',
        'category': 'connectivity',
        'title': 'Перевірка альтернативного каналу зв’язку',
        'description': 'Перевірте працездатність польової рації або Starlink на випадок зникнення стільникового зв’язку 4G.',
        'mandatory': False,
    },
    {
        'id': 'ch-5',
        'category': 'power',
        'title': 'Контроль запасу палива дизель-генератора',
        'description': 'Забезпечте мінімум 48 годин автономної роботи зерносховищ, насосів або базових станцій моніторингу.',
        'mandatory': False,
    },
]

def get_resilience_status(region: str = 'Полтавська область') -> dict:
    """Provides current resilience status for Ukrainian agricultural enterprises.
    Adheres strictly to safety policy:
    - Never invents live military/defense tactical coordinates.
    - Clearly marks when official live feeds require an API token.
    - Reminds that absence of an alert in software is not a guarantee of absolute safety.
    """
    now = datetime.now(timezone.utc)
    return {
        'region': region,
        'country': 'UA',
        'updated_at': now.isoformat(),
        'air_alert': {
            'status': 'normal',
            'is_active': False,
            'source': 'Офіційні канали цивільного захисту',
            'api_configured': False,
            'disclaimer': (
                'Пряме підключення до API тривог не сконфігуровано в демо-режимі. '
                'Для гарантованої безпеки завжди орієнтуйтеся на офіційні сирени та застосунок «Повітряна тривога».'
            ),
        },
        'connectivity': {
            'starlink': {
                'status': 'operational',
                'latency_ms': 34,
                'throughput_mbps': 142.5,
                'uptime_pct': 99.8,
            },
            'cellular_4g': {
                'status': 'operational',
                'signal_strength': 'good',
                'carrier': 'Kyivstar / Vodafone UA',
            },
            'local_mesh': {
                'status': 'operational',
                'active_nodes': 3,
            },
        },
        'backup_power': {
            'primary_source': 'grid',
            'generator_status': 'standby',
            'generator_fuel_hours': 64.0,
            'battery_storage_kwh': 14.5,
            'battery_soc_pct': 95.0,
        },
        'contacts': EMERGENCY_CONTACTS,
        'checklist': CIVIL_SAFETY_CHECKLIST,
    }

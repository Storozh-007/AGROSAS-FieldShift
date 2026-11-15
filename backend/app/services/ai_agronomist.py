from app.services.crops import CROPS

def generate_explanation(field_name: str, evaluation: dict, lang: str = 'uk') -> dict:
    """Deterministic, transparent agronomic explanation derived strictly
    from the scientific analytics engine results.
    Never hallucinates uncalculated yield forecasts.
    """
    recommended_id = evaluation['recommended']
    strategies = {s['id']: s for s in evaluation['strategies']}
    winner = strategies[recommended_id]
    runner_up = next((s for s in evaluation['strategies'] if s['id'] != recommended_id), None)

    climate = evaluation['climate']
    scenario = evaluation['scenario']
    provenance = evaluation['provenance']
    explanation = evaluation['explanation']

    strategy_titles_uk = {
        'S1': 'Поточна сівозміна господарства',
        'S2': 'Стратегія регенерації ґрунту',
        'S3': 'Стратегія стійкості до посухи',
    }
    strategy_titles_en = {
        'S1': 'Current farm rotation',
        'S2': 'Soil regeneration strategy',
        'S3': 'Drought resilience strategy',
    }
    titles = strategy_titles_uk if lang == 'uk' else strategy_titles_en

    # Analyze key agronomic drivers
    water_gap = winner['rainfall_gap_mm']
    stress = climate['stress_index']
    temp = climate['temperature_c']
    rain = climate['precipitation_mm']
    margin = explanation['margin']
    strongest_criterion = explanation['strongest_contribution']

    criterion_names = {
        'uk': {
            'water': 'економія та доступність вологи',
            'soil': 'відновлення та захист ґрунту',
            'resilience': 'кліматична адаптивність',
            'economy': 'ринкова ліквідність культур',
        },
        'en': {
            'water': 'water conservation and availability',
            'soil': 'soil health and vegetative cover',
            'resilience': 'climatic risk resilience',
            'economy': 'market liquidity and feasibility',
        },
    }

    # Factor-by-factor breakdown
    factors = []
    if lang == 'uk':
        factors.append(
            f"Кліматичні умови сезону: середня температура вегетації {temp:.1f} °C, "
            f"сума опадів {rain:.0f} мм за період {', '.join(climate['seasons'])}."
        )
        if scenario['conditional']:
            factors.append(
                f"Сценарне коригування: враховано потепління +{scenario['temperature_delta']:.1f} °C "
                f"та зміну опадів {scenario['precipitation_delta']:+.0f}% (індекс кліматичного стресу {stress:.1f}/100)."
            )
        factors.append(
            f"Баланс вологи: орієнтовна потреба обраної сівозміни складає {winner['water_need_mm']} мм/сезон "
            f"(дефіцит опадів: {water_gap} мм)."
        )
        if winner['family_repeat_fraction'] > 0:
            factors.append(
                f"Чергування родин: виявлено часткове повторення культур однієї родини "
                f"({int(winner['family_repeat_fraction'] * 100)}% послідовності), що враховано штрафом у критерії ґрунту."
            )
        else:
            factors.append("Чергування родин: оптимальне, без безпосереднього повторення споріднених культур.")
    else:
        factors.append(
            f"Growing season climate: mean temperature {temp:.1f} °C, "
            f"cumulative precipitation {rain:.0f} mm over {', '.join(climate['seasons'])}."
        )
        if scenario['conditional']:
            factors.append(
                f"Scenario sensitivity: simulated +{scenario['temperature_delta']:.1f} °C warming "
                f"and {scenario['precipitation_delta']:+.0f}% precipitation anomaly (stress index {stress:.1f}/100)."
            )
        factors.append(
            f"Moisture balance: indicative crop water need is {winner['water_need_mm']} mm/season "
            f"(seasonal rainfall gap: {water_gap} mm)."
        )
        if winner['family_repeat_fraction'] > 0:
            factors.append(
                f"Crop family sequence: identified {int(winner['family_repeat_fraction'] * 100)}% consecutive family repetition, penalized in soil health criteria."
            )
        else:
            factors.append("Crop family sequence: optimal rotation without immediate consecutive monoculture.")

    # Narrative rationale
    if lang == 'uk':
        summary = (
            f"Стратегія {recommended_id} («{titles[recommended_id]}») визначена як найбільш відповідна "
            f"пріоритетам поля «{field_name}» із підсумковим балом {winner['score']} зі 100 "
            f"(перевага над альтернативою: +{margin:.1f} бала). "
            f"Вирішальний внесок забезпечив критерій «{criterion_names['uk'][strongest_criterion]}»."
        )
        runner_up_reason = ""
        if runner_up:
            runner_up_title = titles.get(runner_up['id'], runner_up['id'])
            runner_up_reason = (
                f"Стратегія {runner_up['id']} («{runner_up_title}») отримала {runner_up['score']} балів: "
                f"нижча оцінка зумовлена "
                + ("більшою потребою у волозі та чутливістю до посухи." if runner_up['criteria']['water'] < winner['criteria']['water'] else "меншим внеском у захист структури ґрунту.")
            )
        next_actions = [
            "Виконайте лабораторний агрохімічний аналіз ґрунту (pH, вміст гумусу, N-P-K).",
            "Перевірте наявність висівних дисків та налаштування сівалки під бобові або дрібнонасінні культури.",
            "Звірте доступні регіональні елеватори та контракти на збут запланованих культур.",
            "Підключіть польові датчики вологості ґрунту для калібрування супутникового водного балансу.",
        ]
    else:
        summary = (
            f"Strategy {recommended_id} ('{titles[recommended_id]}') ranks highest for field '{field_name}' "
            f"with an overall score of {winner['score']}/100 (+{margin:.1f} points over runner-up). "
            f"The primary driver was '{criterion_names['en'][strongest_criterion]}'."
        )
        runner_up_reason = ""
        if runner_up:
            runner_up_title = titles.get(runner_up['id'], runner_up['id'])
            runner_up_reason = (
                f"Strategy {runner_up['id']} ('{runner_up_title}') scored {runner_up['score']} points; "
                f"it received lower marks due to higher climatic moisture vulnerability or reduced soil cover."
            )
        next_actions = [
            "Conduct certified soil chemical testing (pH, organic carbon, available N-P-K).",
            "Verify planter metering plates and depth control for new crop seeds.",
            "Confirm regional grain elevator reception capacity and commercial contracts.",
            "Deploy in-situ soil moisture probes to calibrate satellite reanalysis observations.",
        ]

    data_sources_used = [
        {
            'name': 'NASA POWER',
            'product': 'Daily AG T2M & PRECTOTCORR',
            'period': f"{provenance['start']} — {provenance['end']}",
            'coverage': f"{round(provenance['coverage'] * 100)}%",
            'spatial_resolution': provenance.get('spatial_resolution', '0.5° × 0.625° reanalysis grid'),
        }
    ]

    return {
        'field_name': field_name,
        'recommended_id': recommended_id,
        'recommended_title': titles[recommended_id],
        'score': winner['score'],
        'margin': margin,
        'summary': summary,
        'runner_up_comparison': runner_up_reason,
        'factors': factors,
        'limitations': winner['limitations'],
        'next_actions': next_actions,
        'data_sources': data_sources_used,
        'is_llm_generated': False,
        'model_version': evaluation.get('model_version', 'rotation-heuristic-0.1'),
    }

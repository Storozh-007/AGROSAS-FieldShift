export type Metrics={gm_mean:number;revenue_mean:number;gm_p10:number;gm_p90:number;loss_prob:number;yearly_gm:number[];deficit_mm:number;etc_mm:number;irrigation_mm:number;n_fert_kg:number;erosion_t:number;c_factor:number;carbon_input_t:number;soc_change_t:number;soc_stock_t:number;pest_break:number;bare_days:number;families:number;legume_share:number};
export type Risk={crop:string;type:'heat'|'frost'|'winterkill'|'drought'|'season_short'|'sunflower_interval';years:number;of:number};
export type Strategy={id:string;kind:'current'|'balanced'|'soil'|'water'|'income';crops:string[];cover_crop:boolean;metrics:Metrics;criteria:Record<string,number>;groups:Record<'water'|'soil'|'resilience'|'economy',number>;score:number;monthly_deficit:number[];win_rate_vs_current:number|null;risks:Risk[];benefits:string[]};
export type Soil={sand_pct:number;clay_pct:number;silt_pct:number;texture:string;organic_matter_pct:number;ph:number|null;awc_mm_per_m:number;k_factor_si:number;hydrologic_group:string;source:string;native_resolution:string;confidence:string;map_unit?:string;drainage?:string};
export type Terrain={elevation_mean_m:number;relief_m:number;slope_mean_pct:number;slope_p90_pct:number;steep_share:number;ls_mean:number;low_spot_share:number;source:string;native_resolution:string};
export type ClimateYear={year:number;precip_mm:number;season_precip_mm:number;season_et0_mm:number;season_balance_mm:number;heat_days_32:number;frost_days:number;heavy_rain_days:number;gdd10:number};
export type Climate={n_years:number;precip_mean_mm:number;precip_cv:number;season_balance_mean_mm:number;season_balance_p10_mm:number;heat_days_mean:number;frost_days_mean:number;heavy_rain_days_mean:number;gdd10_mean:number;trend_per_decade:{season_balance_mm:number;heat_days_32:number;precip_mm:number;gdd10:number;tmean_c?:number};dry_year_share:number;erosivity_R:number;tmean_c?:number;precip_p10_mm?:number;method?:string;years?:ClimateYear[];source:string;native_resolution:string};
export type Threat={id:string;level:'high'|'medium'|'low';title:string;evidence:string;source:string};
export type Group='water'|'soil'|'resilience'|'economy';
export type Plan={threats:Threat[];goal:string;weights_source:string;weights_pct:Record<Group,number>;threat_weights:Record<Group,number>;goal_weights:Record<Group,number>;scenario_name:string;
 calendar:Record<string,{sow:number;days:number;stages:number[];kc:number[];winter:boolean}>;crop_params:Record<string,Record<string,number|string>>;site_params:{awc_mm_m:number;k_factor:number;ls:number;erosivity:number;hsg:string;cn:number;om_pct:number;soc_stock_t:number};strategies:Strategy[];recommended:string;current:string[];years:[number,number];n_years:number;searched:number;suitability:Record<string,number>;vulnerable_months:number[];bare_windows:{after:string;before:string;days:number}[];
 site:{soil:Soil;terrain?:Terrain;climate:Climate;climate_years?:ClimateYear[];soil_moisture?:{series:{month:string;root_wetness:number;anomaly:number}[];source:string;note:string}};
 evidence:{layer:string;source:string;resolution:string;confidence:string}[];gaps:string[];irrigated:boolean;scenario:{temperature_delta:number;precipitation_delta:number};
 assumptions:{n_price_usd_kg:number;irrigation_usd_mm:number;cover_crop_usd_ha:number;tolerable_soil_loss_t:number;crops:Record<string,{price:number;cost:number;ymax:number;name:string}>}};
export type Zone={zone:number;area_ha:number;share:number;productivity_index:number;relative_yield:number;slope_pct:number;erosion_t:number;twi:number;elevation_m:number;ndvi:number|null;limiting_factor:string;factor_shares:Record<string,number>;gm_per_ha:number|null;seed_rate_pct:number;n_rate_pct:number;center:[number,number]};
export type ZonesResult={k:number;zones:Zone[];has_ndvi:boolean;ndvi_scene:string|null;tolerable_loss_t:number;method:string;field:{id:string;name:string;area_ha:number};
 grid:{rows:number;cols:number;bounds:[number,number,number,number];cell_m:number;inside:number[][];elevation:number[][];slope_pct:number[][];flow?:number[][];zone:number[][];productivity:number[][];erosion:number[][];factor:string[][];ndvi:number[][]|null};
 samples:{points:{zone:number;row:number;col:number;lon:number;lat:number;order:number}[];route_m:number}};

export const KIND_LABEL:Record<Strategy['kind'],string>={current:'Ваша поточна',balanced:'Найкращий баланс під ваші пріоритети',soil:'Відновлення ґрунту',water:'Стійкість до посухи та води',income:'Максимум доходу без шкоди ґрунту'};
export const GROUP_LABEL={water:'Вода',soil:'Ґрунт',resilience:'Стійкість',economy:'Економіка'} as const;
export const RISK_LABEL:Record<Risk['type'],(r:Risk,name:string)=>string>={
 heat:(r,n)=>`${n}: спека в період цвітіння знижувала урожай >10% у ${r.years} з ${r.of} років`,
 frost:(r,n)=>`${n}: весняні заморозки після сівби у ${r.years} з ${r.of} років — пересів або пізніший строк`,
 winterkill:(r,n)=>`${n}: ризик вимерзання у ${r.years} з ${r.of} зим (сніговий покрив не врахований — перевірте локально)`,
 drought:(r,n)=>`${n}: водний стрес зрізав >25% урожаю у ${r.years} з ${r.of} років`,
 season_short:(r,n)=>`${n}: тепла не вистачало для дозрівання у ${r.years} з ${r.of} років`,
 sunflower_interval:(_r,n)=>`${n}: повернення раніше 6–7 років підвищує ризик склеротиніозу та вовчка`,
};
export const BENEFIT_LABEL:Record<string,string>={
 nitrogen_fixation:'Бобові фіксують азот — менше добрив під наступну культуру',
 deep_roots:'Глибоке коріння розпушує підґрунтя й дістає воду з глибини',
 winter_cover:'Поле вкрите взимку — менше ерозії та втрат азоту',
 drought_tolerant:'Посухостійкі культури тримають урожай у сухі роки',
 pest_break:'Довші перерви між культурами розривають цикли хвороб і шкідників',
 diversity:'3+ родини культур — ширший ринок і менший спільний ризик',
};
export const GAP_LABEL:Record<string,string>={
 soil_modelled:'Ґрунт — модельна карта SoilGrids 250 м. Аналіз ґрунту з поля замінить ці значення.',
 soil_fallback:'Ґрунтовий сервіс зараз недоступний — використано типовий суглинок. Перерахуйте паспорт пізніше або внесіть аналіз ґрунту.',
 prices_default:'Ціни — типові світові. Вкажіть свої ціни реалізації, щоб маржа стала вашою.',
 yield_potential_generic:'Потенціал урожаю — типовий для інтенсивного господарства, не відкалібрований вашими врожаями.',
 snow_cover_not_modelled:'Сніговий покрив не моделюється: ризик вимерзання може бути завищений.',
 pests_regional:'Хвороби й шкідники — правила інтервалів, не локальний моніторинг.',
 partial_sources:'Частина джерел не відповіла — деякі шари можуть бути неповні.',
};
export const FACTOR_LABEL:Record<string,{name:string;color:string;advice:string}>={
 erosion:{name:'Ерозія на схилі',color:'#c4473a',advice:'Не залишати голим восени, покривна культура, обробіток поперек схилу'},
 waterlogging:{name:'Перезволоження в низині',color:'#3b7fc4',advice:'Дренаж, без додаткового N, пізніший посів'},
 frost_pocket:{name:'Морозобійна низина',color:'#7c6bd6',advice:'Пізніші строки сівби, стійкіші сорти'},
 drought:{name:'Посушлива ділянка',color:'#e0a43a',advice:'Нижча густота −10%, посухостійкі культури, мульча'},
 low_vigor:{name:'Слабка вегетація',color:'#d9822b',advice:'Відібрати проби: pH, K, P; перевірити ущільнення'},
 none:{name:'Без суттєвих обмежень',color:'#4f9d4a',advice:'Стандартні норми'},
};
export const GLOSSARY:Record<string,string>={
 'ET':'Евапотранспірація — вода, яку поле віддає в повітря (випаровування з ґрунту + транспірація рослин), мм.',
 'ET0':'Еталонна евапотранспірація FAO‑56 — скільки води «просить» атмосфера за день. Потреба культури = Kc × ET0.',
 'Водний дефіцит':'Скільки води культурі не вистачило за сезон: потреба (Kc×ET0) мінус те, що вона змогла взяти з ґрунту.',
 'NDVI':'Індекс вегетації з супутника (−1…1). Вище — більше зеленої біомаси. Порівнюйте з тим самим періодом, не з іншими культурами.',
 'Аномалія вологості':'Наскільки волога кореневої зони цього місяця відрізняється від її середнього для цього місяця за 2001–сьогодні.',
 'RUSLE':'Втрати ґрунту A = R·K·LS·C·P: злива × вразливість ґрунту × схил × покриття культурою × протиерозійні заходи, т/га/рік.',
 'SOC':'Органічний вуглець ґрунту. Більше рослинних решток і менше ерозії — більше вуглецю і краща структура.',
 'P10/P90':'У 1 з 10 найгірших років маржа нижча за P10; у 1 з 10 найкращих — вища за P90.',
 'Заморозок':'Мінімальна температура ≤ 0 °C. Для озимих важлива температура вузла кущіння під снігом.',
};
export const money=(v:number)=>`${v<0?'−':''}$${Math.abs(Math.round(v)).toLocaleString('uk-UA')}`;
export const signed=(v:number,digits=0,unit='')=>`${v>0?'+':v<0?'−':''}${Math.abs(v).toFixed(digits)}${unit}`;
export const MONTHS=['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];

/** Plain-language reasons: the three biggest improvements vs current, with numbers. */
export function reasons(s:Strategy,base:Strategy){
 const m=s.metrics,b=base.metrics,out:{gain:number;text:string}[]=[];
 const add=(gain:number,text:string)=>{if(gain>0)out.push({gain,text})};
 add((m.gm_mean-b.gm_mean)/100,`маржа ${signed(m.gm_mean-b.gm_mean)} $/га на рік`);
 add((m.gm_p10-b.gm_p10)/100,`у поганий рік (P10) на ${money(m.gm_p10-b.gm_p10)}/га краще`);
 add((b.deficit_mm-m.deficit_mm)/40,`водний дефіцит менший на ${Math.round(b.deficit_mm-m.deficit_mm)} мм за сезон`);
 add(Math.log(Math.max(b.erosion_t,.01)/Math.max(m.erosion_t,.01))*2,`ерозія ${b.erosion_t.toFixed(1)} → ${m.erosion_t.toFixed(1)} т/га/рік`);
 add(m.soc_change_t/.08,`ґрунт накопичує на ${m.soc_change_t.toFixed(2)} т C/га/рік більше вуглецю`);
 add((b.n_fert_kg-m.n_fert_kg)/25,`азотних добрив на ${Math.round(b.n_fert_kg-m.n_fert_kg)} кг N/га менше`);
 add((m.pest_break-b.pest_break)*4,'довші перерви між культурами однієї групи хвороб');
 add((b.bare_days-m.bare_days)/40,`поле стоїть голим на ${Math.round(b.bare_days-m.bare_days)} днів менше`);
 return out.sort((a,b)=>b.gain-a.gain).slice(0,3).map(x=>x.text);
}
export function tradeoffs(s:Strategy,base:Strategy){
 const m=s.metrics,b=base.metrics,out:string[]=[];
 if(m.gm_mean<b.gm_mean-15)out.push(`маржа нижча на ${money(b.gm_mean-m.gm_mean)}/га`);
 if(m.deficit_mm>b.deficit_mm+15)out.push(`водний дефіцит більший на ${Math.round(m.deficit_mm-b.deficit_mm)} мм`);
 if(m.erosion_t>b.erosion_t*1.15)out.push(`ерозія вища: ${m.erosion_t.toFixed(1)} т/га`);
 if(m.n_fert_kg>b.n_fert_kg+20)out.push(`потрібно більше азоту: +${Math.round(m.n_fert_kg-b.n_fert_kg)} кг N/га`);
 if(m.irrigation_mm>b.irrigation_mm+20)out.push(`більше поливу: +${Math.round(m.irrigation_mm-b.irrigation_mm)} мм`);
 return out;
}

export const GOALS:{id:'stable'|'profit'|'water'|'soil';title:string;desc:string;icon:string}[]=[
 {id:'stable',title:'Стабільний дохід щороку',desc:'Менше збиткових років, навіть якщо в середньому трохи менше',icon:'⚖'},
 {id:'profit',title:'Максимум прибутку',desc:'Найвища середня маржа, ризик — прийнятний',icon:'$'},
 {id:'water',title:'Пережити посуху',desc:'Культури, які менше потребують води і не горять у спеку',icon:'💧'},
 {id:'soil',title:'Відновити ґрунт',desc:'Вуглець, менше ерозії й добрив — поле для дітей',icon:'🌱'},
];
export const LEVEL_UA={high:'висока',medium:'помірна',low:'низька'} as const;
export const SCENARIOS:{id:'now'|'trend2035'|'dry';title:string}[]=[{id:'now',title:'Клімат як зараз'},{id:'trend2035',title:'Тренд поля до 2035'},{id:'dry',title:'Сухий рік (1 з 10)'}];

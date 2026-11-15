/** Primary-source mission reference, checked 2026-11-13.
 * 3D geometry is educational, never an operational spacecraft configuration guarantee.
 * Orbit catalogue IDs identify spacecraft; instruments and derived datasets are separate.
 */
export type MissionDefinition = {
  id:string; name:string; agency:string; platform:string;
  kind:'spacecraft'|'instrument'|'historical'; status:string; statusNote:string;
  noradId?:number; modelPath?:string; modelFormat?:'glb'|'stl'; isSchematic:boolean;
  modelAttribution:string; modelSourceUrl?:string; modelNote?:string; requiresDraco?:boolean;
  workingPrinciple:string; workflow:string[]; specs:{label:string;value:string}[];
  sources:{title:string;url:string}[]; video:{title:string;url:string;mp4?:string};
  layerKey?:string; integrationNote:string;
};
export const MISSION_CHECKED_AT='2026-11-13';
export const NASA_MODEL_USAGE_URL='https://www.nasa.gov/nasa-brand-center/images-and-media/';
export const NASA_MODEL_REPOSITORY='https://github.com/nasa/NASA-3D-Resources';
const issModel={modelPath:'/missions/iss.glb',modelFormat:'glb' as const,isSchematic:false,modelAttribution:'NASA / Michael D. Carbajal · NASA 3D Resources',modelSourceUrl:'https://science.nasa.gov/3d-resources/international-space-station-iss-b/',modelNote:'Офіційна модель МКС (B), репрезентативна історична конфігурація. Розміщення сучасних експериментів і сонячних панелей може відрізнятися.'};
export const MISSION_CATALOG:MissionDefinition[]=[
 {
  id:'smap',name:'SMAP',agency:'NASA / JPL',platform:'SMAP',kind:'spacecraft',noradId:40376,
  status:'Пасивні та модельні продукти',statusNote:'Радар припинив передачу 7 липня 2015 року. Радіометр продовжив місію; L4 додає модель водного балансу.',
  modelPath:'/missions/smap.glb',modelFormat:'glb',isSchematic:false,modelAttribution:'NASA / JPL-Caltech · SMAP 3D resource',modelSourceUrl:'https://smap.jpl.nasa.gov/resources/99/smap-3d-model/?category=images',modelNote:'Офіційна навчальна модель апарата; обертання сцени не є телеметрією механізмів.',
  workingPrinciple:'L-діапазонний радіометр приймає природне мікрохвильове випромінювання поверхні. Вологість змінює його властивості. Обертова шестиметрова антена забезпечує конічне сканування; це пасивне вимірювання, а не лазерний промінь.',
  workflow:['Радіометр реєструє мікрохвильову яскравість поверхні.','Алгоритми оцінюють поверхневу вологість; L4 поєднує спостереження з моделлю.','Проєкт показує регіональний шар із датою й масштабом сітки.'],
  specs:[{label:'Антена',value:'6 м; номінально 14.6 об/хв'},{label:'Проєктна орбіта',value:'Близько 685 км; фактична висота — з орбітальних даних'},{label:'Шар у проєкті',value:'L4 · сітка 9 км; поверхня / коренева зона'}],
  sources:[{title:'NASA SMAP',url:'https://science.nasa.gov/mission/smap/'},{title:'Орбітальна геометрія й антена',url:'https://smap.jpl.nasa.gov/resources/39/smap-orbital-motion/'},{title:'Статус радара',url:'https://www.jpl.nasa.gov/news/nasa-soil-moisture-radar-ends-operations-mission-science-continues/'}],
  video:{title:'NASA: SMAP launch, deployment and scan',url:'https://svs.gsfc.nasa.gov/30577/',mp4:'https://svs.gsfc.nasa.gov/vis/a030000/a030500/a030577/SMAP_launch_deploy_scan_720p_59.97.mp4'},layerKey:'smap',integrationNote:'NASA GIBS SMAP L4 — регіональний контекст. Кореневий шар є модельним продуктом; це не показання зонда конкретного поля.'
 },
 {
  id:'gpm',name:'GPM Core Observatory / IMERG',agency:'NASA / JAXA',platform:'GPM Core Observatory',kind:'spacecraft',noradId:39574,
  status:'Продукти опадів',statusNote:'IMERG обʼєднує дані кількох супутників. Дата продукту та положення GPM Core — різні часові величини.',isSchematic:true,modelAttribution:'Схема проєкту за документацією NASA; офіційний GLB не підміняється іншою місією.',
  workingPrinciple:'Активний DPR надсилає радіолокаційні імпульси та аналізує відбиття від опадів, а пасивний GMI вимірює мікрохвильове випромінювання. Core Observatory допомагає узгоджувати вимірювання сузірʼя; IMERG поєднує кілька джерел у продукт опадів.',
  workflow:['DPR і GMI спостерігають структуру й інтенсивність опадів.','Калібрування та обʼєднання даних сузірʼя формують продукти GPM / IMERG.','На карті та 3D-полі показується датована візуалізація IMERG.'],
  specs:[{label:'Прилади',value:'DPR + GMI'},{label:'Нахил орбіти',value:'Номінально 65°'},{label:'Висота',value:'Після підняття орбіти 2023 року — близько 435 км; не фіксована телеметрія'},{label:'IMERG',value:'Регіональна сітка 0.1°'}],
  sources:[{title:'NASA Core Observatory та прилади',url:'https://gpm.nasa.gov/missions/GPM/core-observatory'},{title:'NASA: підняття орбіти',url:'https://gpm.nasa.gov/data/news/notification-upcoming-gpm-orbit-boost'},{title:'GPM data',url:'https://gpm.nasa.gov/data'}],
  video:{title:'NASA: GPM Core spacecraft and hurricane',url:'https://svs.gsfc.nasa.gov/11392/',mp4:'https://svs.gsfc.nasa.gov/vis/a010000/a011300/a011392/GPM_Beauty_NEW.mp4'},layerKey:'gpm',integrationNote:'GIBS IMERG показує інтенсивність опадів. Колір регіональної клітинки не є вимірюванням дощу всередині поля.'
 },
 {
  id:'landsat8',name:'Landsat 8',agency:'NASA / USGS',platform:'Landsat 8',kind:'spacecraft',noradId:39084,status:'Активна місія',statusNote:'Повторення окремого апарата номінально 16 діб; хмари й план зйомки впливають на доступність конкретного поля.',
  modelPath:'/missions/landsat8.glb',modelFormat:'glb',requiresDraco:true,isSchematic:false,modelAttribution:'NASA / Christopher R. Meaney · NASA 3D Resources',modelSourceUrl:'https://science.nasa.gov/3d-resources/landsat-8/',
  workingPrinciple:'OLI вимірює відбите сонячне світло в спектральних смугах, TIRS — теплове випромінювання. Червона й ближня інфрачервона смуги дозволяють обчислювати індекси рослинності після корекції та контролю якості.',
  workflow:['OLI / TIRS отримують спектральні вимірювання.','Обробка формує відбивну здатність, теплові продукти й маски якості.','HLS L30 дає датовану візуалізацію поверхні; NDVI в проєкті окремо розраховується із Sentinel‑2.'],
  specs:[{label:'Прилади',value:'OLI + TIRS'},{label:'Спектральні дані',value:'30 м; панхроматична смуга 15 м; TIRS 100 м'},{label:'Проєктна орбіта',value:'705 км; нахил 98.2°'},{label:'Повторення',value:'16 діб для одного апарата'}],
  sources:[{title:'NASA Landsat 8',url:'https://science.nasa.gov/mission/landsat-8/'},{title:'USGS Landsat 8',url:'https://www.usgs.gov/landsat-missions/landsat-8'}],
  video:{title:'NASA: Landsat 9 — близнюк Landsat 8 на тій самій орбіті 705 км',url:'https://svs.gsfc.nasa.gov/14858/',mp4:'https://svs.gsfc.nasa.gov/vis/a010000/a014800/a014858/L9_SlowPush_Web.mp4'},layerKey:'landsat',integrationNote:'NASA HLS L30 містить гармонізовані дані Landsat. Відео за посиланням демонструє споріднений Landsat 9 і підписане відповідно.'
 },
 {
  id:'landsat9',name:'Landsat 9',agency:'NASA / USGS',platform:'Landsat 9',kind:'spacecraft',noradId:49260,status:'Активна місія',statusNote:'Landsat 8 і 9 номінально зміщені на вісім діб. Це не гарантує безхмарного знімка через вісім днів.',
  modelPath:'/missions/landsat9.stl',modelFormat:'stl',isSchematic:false,modelAttribution:'NASA 3D Resources · Landsat 9 printable model',modelSourceUrl:'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Printing/Landsat%209',modelNote:'Офіційна STL-модель для друку: геометрія без фотографічних матеріалів; кольори переглядача умовні.',
  workingPrinciple:'OLI‑2 реєструє відбите світло, TIRS‑2 — теплове випромінювання. Сумісність із Landsat 8 продовжує довгий ряд спостережень суходолу для води, рослинності та землекористування.',
  workflow:['OLI‑2 / TIRS‑2 отримують дані під час проходу.','USGS і NASA обробляють та архівують сцени; продукти мають власну дату й якість.','HLS L30 забезпечує візуальний звʼязок із полем у проєкті.'],
  specs:[{label:'Прилади',value:'OLI‑2 + TIRS‑2'},{label:'Відбивна здатність',value:'30 м; панхроматична смуга 15 м'},{label:'Теплові дані',value:'100 м — вихідний масштаб TIRS‑2'},{label:'Повторення',value:'16 діб для одного апарата'}],
  sources:[{title:'NASA Landsat 9',url:'https://science.nasa.gov/mission/landsat-9/'},{title:'USGS орбітальні дані й NORAD ID',url:'https://www.usgs.gov/landsat-missions/definitive-ephemeris'}],
  video:{title:'NASA: Landsat 9 spacecraft animations',url:'https://svs.gsfc.nasa.gov/13259/',mp4:'https://svs.gsfc.nasa.gov/vis/a010000/a013200/a013259/13259_Landsat9_CA_beauty_pass_facebook_720.mp4'},layerKey:'landsat',integrationNote:'Спільний HLS L30 — продукт сімейства Landsat. Обирайте дату сцени, а не сприймайте поточну орбіту як уже отримане зображення.'
 },
 {
  id:'terra',name:'Terra / MODIS',agency:'NASA',platform:'Terra',kind:'spacecraft',noradId:25994,status:'Місія продовжує роботу',statusNote:'NASA позначає Terra активною. Орбіта дрейфує; номінальні початкові параметри не є поточними. ASTER і MODIS — різні прилади.',
  modelPath:'/missions/terra.glb',modelFormat:'glb',isSchematic:false,modelAttribution:'NASA / Christian A. Lopez · NASA 3D Resources',modelSourceUrl:'https://science.nasa.gov/3d-resources/terra/',modelNote:'Збережено офіційну геометрію та кольори матеріалів. Видалено посилання на відсутні в NASA GLB зовнішні TGA-текстури.',
  workingPrinciple:'MODIS сканує широку смугу у видимому та інфрачервоному діапазонах. Це дає часті спостереження великих територій; композити NDVI поєднують часові вимірювання з контролем якості.',
  workflow:['MODIS реєструє 36 спектральних смуг.','Алгоритми формують композити рослинності та температуру поверхні.','Шар MODIS у проєкті зберігає регіональну детальність при наближенні.'],
  specs:[{label:'MODIS',value:'36 спектральних смуг'},{label:'Просторова детальність приладу',value:'250 / 500 / 1000 м залежно від смуги'},{label:'Смуга огляду',value:'Близько 2330 км'},{label:'Шар NDVI',value:'Композит; дата не означає один миттєвий знімок'}],
  sources:[{title:'NASA Terra',url:'https://science.nasa.gov/mission/terra/'},{title:'NASA MODIS specifications',url:'https://terra.nasa.gov/data/modis-data'},{title:'NASA: поточна еволюція місії',url:'https://science.nasa.gov/science-research/earth-science/terra-the-end-of-an-era/'}],
  video:{title:'NASA: флот супутників спостереження Землі, 2025 — Terra серед них',url:'https://svs.gsfc.nasa.gov/5571/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005571/nasa_full_fleet_July2025_1080p60.mp4'},layerKey:'modis-ndvi',integrationNote:'Підключені MODIS NDVI та LST через NASA GIBS. Температура поверхні не дорівнює температурі повітря.'
 },
 {
  id:'viirs',name:'NOAA‑20 / VIIRS',agency:'NOAA / NASA',platform:'NOAA‑20',kind:'instrument',noradId:43013,status:'Поточне сімейство продуктів VIIRS',statusNote:'У проєкті поточний шар VIIRS привʼязаний до NOAA‑20. Suomi NPP має окремий архівний запис і власну модель.',
  isSchematic:true,modelAttribution:'Схема проєкту за документацією приладу; не модель Suomi NPP під іншою назвою.',
  workingPrinciple:'VIIRS — багатоспектральний радіометр на полярній платформі. Його видимі та інфрачервоні смуги дають спостереження рослинності, хмар, пожеж та інших властивостей поверхні.',
  workflow:['VIIRS спостерігає поверхню у видимих та інфрачервоних смугах.','Обробка й часові композити формують індекси рослинності.','Проєкт показує NOAA‑20 VIIRS NDVI як регіональний шар.'],
  specs:[{label:'Прилад',value:'VIIRS; 22 спектральні смуги'},{label:'Детальність приладу',value:'375 м (imaging) / 750 м (moderate)'},{label:'Платформа поточного шару',value:'NOAA‑20, а не Suomi NPP'}],
  sources:[{title:'NASA VIIRS / Suomi NPP',url:'https://science.nasa.gov/mission/suomi-npp/'},{title:'NASA VIIRS archive search',url:'https://search.earthdata.nasa.gov/search?q=VIIRS'}],
  video:{title:'NASA: флот супутників, 2025 — NOAA‑20 і Suomi NPP з VIIRS',url:'https://svs.gsfc.nasa.gov/5571/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005571/nasa_full_fleet_July2025_1080p60.mp4'},layerKey:'viirs-ndvi',integrationNote:'NOAA‑20 VIIRS NDVI через GIBS. Дані Suomi NPP після припинення поширення 2 листопада 2026 року не позначаються як нові.'
 },
 {
  id:'suomi-npp',name:'Suomi NPP / VIIRS — архів',agency:'NASA / NOAA',platform:'Suomi NPP',kind:'spacecraft',noradId:37849,status:'Поширення наукових даних завершено',statusNote:'Операційне поширення припинилося 2 листопада 2026 року о 15:40 UTC. NOAA планує початок зниження орбіти 1 грудня 2026 року; це план, а не вже виконаний маневр.',
  modelPath:'/missions/suomi-npp.glb',modelFormat:'glb',requiresDraco:true,isSchematic:false,modelAttribution:'NASA / Brian E. Kumanchik · NASA 3D Resources',modelSourceUrl:'https://science.nasa.gov/3d-resources/suomi-national-polar-orbiting-partnership-suomi-npp/',
  workingPrinciple:'Suomi NPP ніс кілька приладів, зокрема VIIRS, який вимірює видиме та інфрачервоне випромінювання. Цей апарат і NOAA‑20 мають споріднені продукти, але різні орбіти, дати та статуси.',
  workflow:['Suomi NPP збирав радіометричні спостереження.','Архівні продукти залишаються доступними з власними датами.','Для поточного NDVI проєкт використовує споріднений шар NOAA‑20, підписаний окремо.'],
  specs:[{label:'Прилад',value:'VIIRS на Suomi NPP'},{label:'Запуск',value:'28 жовтня 2011 року'},{label:'Поширення продуктів',value:'Завершено 2026‑11‑02 15:40 UTC'}],
  sources:[{title:'NASA Suomi NPP',url:'https://science.nasa.gov/mission/suomi-npp/'},{title:'NOAA: припинення поширення',url:'https://www.nesdis.noaa.gov/news/update-3-cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-november-02-2026-1540-utc-and-decommissioning-issued-october-30-2026-1400-utc'},{title:'NOAA: план зниження орбіти',url:'https://www.nesdis.noaa.gov/news/noaa-deorbit-the-suomi-npp-satellite-after-more-15-years-service'}],
  video:{title:'NASA: флот супутників, 2025 — Suomi NPP',url:'https://svs.gsfc.nasa.gov/5571/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005571/nasa_full_fleet_July2025_1080p60.mp4'},integrationNote:'Історичний апарат для навчання. Переходьте до NOAA‑20 / VIIRS для підключеного поточного шару.'
 },
 {
  id:'iss',name:'Міжнародна космічна станція',agency:'Міжнародне партнерство / NASA',platform:'ISS',kind:'spacecraft',noradId:25544,status:'Орбітальна платформа',statusNote:'МКС є носієм експериментів. ECOSTRESS і GEDI — прилади на станції, а не самостійні супутники.',...issModel,
  workingPrinciple:'МКС забезпечує живлення, звʼязок і орбітальну платформу для земних та космічних досліджень. Різні прилади станції мають власні методи вимірювання, покриття й розклад роботи.',
  workflow:['Станція рухається по орбіті та забезпечує інструменти.','Прилади ECOSTRESS і GEDI отримують різні типи спостережень.','Проєкт відкриває окремі сторінки приладів і датованих продуктів.'],
  specs:[{label:'Тип',value:'Космічна станція / носій приладів'},{label:'Нахил орбіти',value:'Близько 51.6°'},{label:'Поточне положення',value:'Потрібні свіжі орбітальні елементи; модель сама його не визначає'}],
  sources:[{title:'NASA International Space Station',url:'https://www.nasa.gov/international-space-station/'},{title:'NASA Earth science on ISS',url:'https://esrs.jsc.nasa.gov/ESRS/'}],
  video:{title:'NASA: флот спостереження Землі, 2025 — МКС з ECOSTRESS і GEDI',url:'https://svs.gsfc.nasa.gov/5571/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005571/nasa_full_fleet_July2025_1080p60.mp4'},integrationNote:'Обирайте ECOSTRESS або GEDI для принципу вимірювання й відповідних наборів даних.'
 },
 {
  id:'ecostress',name:'ECOSTRESS на МКС',agency:'NASA / JPL',platform:'ISS',kind:'instrument',noradId:25544,status:'Інструмент теплових спостережень',statusNote:'Орбітальний трек належить МКС. Придатність знімка залежить від покриття, хмарності та якості конкретного продукту.',...issModel,
  workingPrinciple:'Тепловий радіометр вимірює випромінювання поверхні у кількох смугах. З нього оцінюють температуру та випромінювальну здатність, а окремі моделі оцінюють евапотранспірацію.',
  workflow:['Прилад на МКС реєструє теплове випромінювання.','LST/емісивність і подальші ET-продукти обробляють з масками якості.','Проєкт пояснює джерело; без доступного растра не підставляє MODIS під назвою ECOSTRESS.'],
  specs:[{label:'Носій',value:'МКС'},{label:'Вихідна просторова детальність',value:'Близько 70 м; перевіряйте конкретний продукт'},{label:'Спостереження',value:'Теплове випромінювання поверхні; ET є похідною оцінкою'}],
  sources:[{title:'NASA ECOSTRESS data',url:'https://ecostress.jpl.nasa.gov/data'},{title:'NASA ECOSTRESS L2 user guide',url:'https://ecostress.jpl.nasa.gov/downloads/userguides/2_ECOSTRESS_L2_UserGuide_06182019.pdf'}],
  video:{title:'NASA: флот спостереження Землі, 2025 — ECOSTRESS на МКС',url:'https://svs.gsfc.nasa.gov/5571/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005571/nasa_full_fleet_July2025_1080p60.mp4'},integrationNote:'Каталог / доступ Earthdata. MODIS LST є іншим підключеним шаром і не підміняє ECOSTRESS.'
 },
 {
  id:'gedi',name:'GEDI на МКС',agency:'NASA / University of Maryland',platform:'ISS',kind:'instrument',noradId:25544,status:'Лідар рослинного покриву',statusNote:'GEDI вимірює окремі сліди лазера, не суцільну фотографію. Продукти сітки 1 км відрізняються від вихідних лазерних плям.',...issModel,
  workingPrinciple:'GEDI надсилає лазерні імпульси та вимірює часову форму повернення від крон і землі. Це допомагає оцінювати вертикальну структуру деревостану; показник не є прямим вимірюванням висоти пшениці.',
  workflow:['Лазерні імпульси формують вісім наземних треків.','Форма відбитого сигналу дає структуру крон і висоти.','Проєкт показує датований агрегований GEDI-шар як контекст довкілля.'],
  specs:[{label:'Носій',value:'МКС'},{label:'Лазерна пляма',value:'Приблизно 25 м; вибіркові треки'},{label:'Наземні треки',value:'8'},{label:'Широтне покриття',value:'Близько 51.6° пн. — 51.6° пд.'}],
  sources:[{title:'GEDI instrument specifications',url:'https://gedi.umd.edu/instrument/specifications/'},{title:'GEDI data',url:'https://gedi.umd.edu/data'}],
  video:{title:'NASA: GEDI lidar and waveform',url:'https://svs.gsfc.nasa.gov/13090/',mp4:'https://svs.gsfc.nasa.gov/vis/a010000/a013000/a013090/GEDI_beauty_waveform_youtube_720.mp4'},layerKey:'gedi',integrationNote:'GIBS GEDI canopy-height composite 2019–2023. Архівний агрегований шар не означає сьогоднішній лазерний прохід.'
 },
 {
  id:'srtm',name:'SRTM / Shuttle Endeavour',agency:'NASA / NGA / DLR / ASI',platform:'Shuttle Endeavour · STS‑99',kind:'historical',status:'Історична місія: лютий 2000',statusNote:'SRTM — експеримент 2000 року на шатлі. Його не слід показувати як діючий супутник у поточному треку.',
  isSchematic:true,modelAttribution:'Навчальна схема інтерферометрії за NASA; офіційна модель шатла не завантажена.',
  workingPrinciple:'Радіолокаційна інтерферометрія порівнювала спостереження антен у вантажному відсіку й на висувній щоглі. Різниця фаз дозволила відновити рельєф суходолу.',
  workflow:['Шатл виконав історичну радіолокаційну зйомку.','Обробка інтерферометричних вимірювань сформувала модель висот.','Проєкт накладає статичний рельєф SRTM, а не нове сканування 2026 року.'],
  specs:[{label:'Місія',value:'STS‑99 · лютий 2000'},{label:'Щогла',value:'Близько 60 м'},{label:'Покриття',value:'Приблизно 60° пн. — 56° пд.; перевіряйте продукт'},{label:'Тип продукту',value:'Модель рельєфу, не поточна висота посівів'}],
  sources:[{title:'NASA SRTM',url:'https://science.nasa.gov/mission/srtm/'},{title:'NASA Earthdata SRTM',url:'https://www.earthdata.nasa.gov/data/instruments/srtm'}],
  video:{title:'NASA: рельєф SRTM у дії — сценарії підйому рівня моря',url:'https://svs.gsfc.nasa.gov/3656/',mp4:'https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003656/strm_sea_level.mp4'},layerKey:'srtm',integrationNote:'Статична візуалізація рельєфу NASA GIBS; дата перегляду не змінює час зйомки SRTM.'
 },
 {
  id:'sentinel2',name:'Copernicus Sentinel‑2',agency:'ESA / Європейський Союз',platform:'Sentinel‑2C (трек); сімейство Sentinel‑2 (дані)',kind:'spacecraft',noradId:60989,status:'Сімейство оптичних місій',statusNote:'Трек одного апарата не є доказом зйомки поля. Архівні сцени можуть походити від 2A, 2B або 2C; назву платформи треба читати з метаданих.',
  isSchematic:true,modelAttribution:'Схема проєкту за матеріалами ESA; не позначається офіційним GLB.',
  workingPrinciple:'MSI вимірює відбите сонячне світло у видимих, червонокрайових, ближніх та короткохвильових інфрачервоних смугах. NDVI порівнює NIR і червону відбивну здатність після атмосферної корекції та маскування якості.',
  workflow:['MSI отримує багатоспектральний знімок.','L2A, масштаб/зсув відбивної здатності й SCL визначають придатні пікселі.','У проєкті NDVI = (B08 − B04) / (B08 + B04), обрізаний точно по контуру поля.'],
  specs:[{label:'Прилад',value:'MSI · 13 спектральних смуг'},{label:'Вихідна детальність',value:'10 / 20 / 60 м залежно від смуги'},{label:'Смуга огляду',value:'290 км'},{label:'Номінальна орбіта',value:'Близько 786 км'}],
  sources:[{title:'ESA Sentinel‑2',url:'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/Introducing_Sentinel-2'},{title:'Copernicus Sentinel‑2 documentation',url:'https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html'},{title:'NASA CDDIS catalog identifiers',url:'https://cddis.nasa.gov/sp3c_satlist.html'}],
  video:{title:'ESA Sentinel‑2 overview and mission animations',url:'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/Introducing_Sentinel-2'},layerKey:'sentinel-ndvi',integrationNote:'Підключений розрахунок 10‑метрового NDVI зі сцен L2A. HLS S30 — інший, гармонізований 30‑метровий продукт.'
 }
];
export const MISSIONS=MISSION_CATALOG;
/** Named project links keep mission identity and the desired product explicit. */
export function missionProjectHref(mission:MissionDefinition,fieldId?:string){const query=new URLSearchParams();if(fieldId)query.set('field',fieldId);query.set('mission',mission.id);if(mission.layerKey)query.set('layer',mission.layerKey);return `/farm-lab?${query.toString()}#${mission.layerKey?'layers':'resources'}`}

export type MissionMedia = {photo?:{src:string;alt:string;credit:string;source:string};videoSrc?:string;videoType?:string;decision:string};
/** Local, credited agency illustrations replace invented spacecraft geometry. */
export const MISSION_MEDIA:Record<string,MissionMedia>={
 smap:{photo:{src:'/missions/photos/smap.webp',alt:'SMAP над Землею — офіційна ілюстрація NASA',credit:'NASA / JPL-Caltech',source:'https://science.nasa.gov/mission/smap/'},videoSrc:'/missions/videos/smap-scan.webm',videoType:'video/webm',decision:'Чи варто перевірити запас вологи перед плануванням поливу?'},
 gpm:{photo:{src:'/missions/photos/gpm.jpg',alt:'GPM Core Observatory над Землею',credit:'NASA / Britt Griswold',source:'https://gpm.nasa.gov/image-gallery/gpm-core-satellite-visualization'},videoSrc:'/missions/videos/gpm-spacecraft.mp4',videoType:'video/mp4',decision:'Чи можуть недавні опади змінити потребу в поливі?'},
 viirs:{photo:{src:'/missions/photos/noaa20.jpg',alt:'Ілюстрація супутника NOAA-20 на орбіті',credit:'NOAA · NASA GLOBE Observer',source:'https://observer.globe.gov/news-events-and-people/news/-/obsnewsdetail/19589576/globe-clouds-new-satellite-matching-noaa-20'},decision:'Де зміна рослинного покриву потребує детальнішої перевірки?'},
 srtm:{photo:{src:'/missions/photos/srtm.jpg',alt:'Розгорнута щогла SRTM із шатла Endeavour під час місії STS-99',credit:'NASA · STS-99, лютий 2000',source:'https://science.nasa.gov/mission/srtm/'},decision:'Де рельєф може впливати на стік води та план обстеження?'},
 sentinel2:{photo:{src:'/missions/photos/sentinel2.png',alt:'Конструкція Sentinel-2: корпус, сонячні панелі, напрям польоту та надир',credit:'EADS Astrium · Copernicus SentiWiki',source:'https://sentiwiki.copernicus.eu/web/s2-mission'},decision:'Які ділянки поля мають нижчий NDVI та потребують огляду?'},
 landsat8:{decision:'Як зміни поверхні допомагають обрати ділянки для обстеження?'},
 landsat9:{decision:'Як порівняти стан поля між датованими спостереженнями?'},
 terra:{photo:{src:'/missions/photos/terra.webp',alt:'Офіційна ілюстрація супутника Terra',credit:'NASA',source:'https://science.nasa.gov/mission/terra/'},decision:'Чи збігається регіональна зміна рослинності з проблемою на полі?'},
 'suomi-npp':{decision:'Що показує архів спостережень і чим він відрізняється від нових даних?'},
 iss:{decision:'Які прилади на МКС можуть доповнити аналіз води й рослинності?'},
 ecostress:{decision:'Чи є тепловий стрес, який варто перевірити наземними вимірюваннями?'},
 gedi:{decision:'Як деревний покрив навколо поля впливає на його контекст?'}
};

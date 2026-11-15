"""Explainable bounded scheduling heuristic; outputs are conditional, not control commands."""
from datetime import datetime

def equipment_totals(scene):
    totals={k:0. for k in ['solar','wind','battery','pump','barn']}
    for item in scene.get('objects',[]):
        if item['enabled'] and item['kind'] in totals: totals[item['kind']]+=item['capacity']
    return totals

def electrical_islands(scene):
    objects=[x for x in scene.get('objects',[]) if x['enabled']]
    if scene.get('connections') is None:return [(equipment_totals(scene),True)]
    index={x['id']:x for x in objects};adj={id:set() for id in index}
    for edge in scene['connections']:
        a,b=edge['from'],edge['to']
        if edge['kind']=='power' and edge.get('enabled',True) and a in adj and b in adj:adj[a].add(b);adj[b].add(a)
    seen=set();result=[];has_pole=any(x['kind']=='pole' for x in objects)
    for id in index:
        if id in seen:continue
        stack=[id];group=[]
        while stack:
            key=stack.pop()
            if key in seen:continue
            seen.add(key);group.append(index[key]);stack.extend(adj[key])
        result.append((equipment_totals({'objects':group}),any(x['kind']=='pole' for x in group) or not has_pole and any(x['kind']=='battery' for x in group)))
    return result

def make_plan(weather, scene, area_ha, inputs):
    p=inputs.model_dump() if hasattr(inputs,'model_dump') else inputs
    totals=equipment_totals(scene);hours=weather['hours'];flow=totals['pump']*2.5
    target=p['target_mm']*area_ha*10;available=min(target,p['water_m3']);remaining=available
    # Solar-rich, low-rain windows, within the next 72 hours. A heuristic, not a global optimum.
    ranked=sorted(range(len(hours)),key=lambda i:(hours[i]['precipitation']>=2,-hours[i]['shortwave_radiation'],i))
    optimized={};baseline={}
    for i in ranked:
        if hours[i]['precipitation']>=2 or flow<=0: continue
        amount=min(remaining,flow);optimized[i]=amount;remaining-=amount
        if remaining<1e-8: break
    # Same water budget, conventional early-morning hours first, then remaining time.
    remain=sum(optimized.values())
    order=sorted(range(len(hours)),key=lambda i:(datetime.fromisoformat(hours[i]['time']).hour not in [3,4,5],i))
    for i in order:
        if flow<=0: break
        baseline[i]=min(remain,flow);remain-=baseline[i]
        if remain<1e-8:break
    def run(schedule):
        islands=electrical_islands(scene);stores=[t['battery']*p['initial_soc']/100 for t,grid in islands]
        moisture=p['initial_moisture'];result=[];sums=dict(wind_kwh=0.,pv_kwh=0.,grid_kwh=0.,unserved_kwh=0.,water_m3=0.,risk_hours=0,load_kwh=0.)
        for i,h in enumerate(hours):
            scheduled=schedule.get(i,0);pv=wind=demand=grid=unserved=water=0.
            hour=datetime.fromisoformat(h['time']).hour;start=p['outage_start'];end=p['outage_end']
            blackout=p['outage'] and (start<=hour<end if start<end else hour>=start or hour<end) if start!=end else False
            for j,(equipment,grid_connected) in enumerate(islands):
                own_pv=equipment['solar']*min(1,max(0,h['shortwave_radiation'])/1000)*.86
                speed=h.get('wind_speed_10m',0)/3.6;own_wind=equipment['wind']*(0 if speed<2.5 else 1 if speed>=11 else ((speed-2.5)/8.5)**3);generation=own_pv+own_wind
                pump_fraction=equipment['pump']/totals['pump'] if totals['pump'] else 0;own_water=scheduled*pump_fraction
                load=equipment['barn']+(own_water/flow*totals['pump'] if flow else 0)
                reserve=equipment['battery']*p['reserve_pct']/100;stored=stores[j]
                charge=min(max(0,generation-load),equipment['battery']*.5,max(0,equipment['battery']-stored)/.95)
                discharge=min(max(0,load-generation),equipment['battery']*.5,max(0,stored-reserve)*.95)
                stores[j]=max(0,min(equipment['battery'],stored+charge*.95-discharge/.95))
                deficit=max(0,load-generation-discharge);missing=deficit if blackout or not grid_connected else 0
                pv+=own_pv;wind+=own_wind;demand+=load;unserved+=missing;grid+=deficit-missing;water+=own_water*(1-missing/load if load>0 else 1)
            stored=sum(stores)
            moisture=max(0,min(p['field_capacity'],moisture+(h['precipitation']*.8+water/(area_ha*10)*.85-h['et0_fao_evapotranspiration']*p['kc'])/(p['root_depth_m']*10)))
            risk=moisture<p['wilting_point']+.5*(p['field_capacity']-p['wilting_point'])
            sums['wind_kwh']+=wind;sums['pv_kwh']+=pv;sums['grid_kwh']+=grid;sums['unserved_kwh']+=unserved;sums['water_m3']+=water;sums['load_kwh']+=demand-unserved;sums['risk_hours']+=int(risk)
            result.append({'time':h['time'],'wind_kw':round(wind,2),'pv_kw':round(pv,2),'load_kw':round(demand,2),'grid_kw':round(grid,2),'unserved_kw':round(unserved,2),'water_m3':round(water,2),'moisture_pct':round(moisture,2),'soc_pct':round(stored/totals['battery']*100,1) if totals['battery'] else 0,'rain_mm':h['precipitation'],'temperature_c':h['temperature_2m'],'reason':'Сонячне вікно / менше опадів' if scheduled and schedule is optimized else 'Базовий ранковий графік' if scheduled else ''})
        return {'totals':{k:round(v,2) for k,v in sums.items()},'hours':result}
    candidate=run(optimized);reference=run(baseline)
    warnings=[]
    if scene.get('connections') is not None and any(not connected and (t['barn']>0 or t['pump']>0) and t['solar']+t['wind']+t['battery']==0 for t,connected in electrical_islands(scene)):warnings.append('Є споживачі без електричного зʼєднання з джерелом. План показує незабезпечене навантаження; перевірте кабелі.')
    if flow<=0:warnings.append('У проєкті немає активного насоса з потужністю. Полив неможливий.')
    if available<target:warnings.append('Запас води менший за задану потребу поля.')
    if candidate['totals']['water_m3']+1<available:warnings.append('Дощ, продуктивність насоса або дефіцит енергії обмежують подачу води.')
    if candidate['totals']['risk_hours']>0:warnings.append('Модель показує виснаження доступної вологи. Перевірте ґрунт і графік з агрономом; сонячний графік може бути запізнілим.')
    return {'model_version':'water-energy-network-2','conditional':True,'equipment':totals,'requested_water_m3':round(target,2),'unmet_water_m3':round(max(0,target-candidate['totals']['water_m3']),2),'optimized':candidate,'baseline':reference,'grid_saving_kwh':round(reference['totals']['grid_kwh']-candidate['totals']['grid_kwh'],2),'cost_difference_uah':round((reference['totals']['grid_kwh']-candidate['totals']['grid_kwh'])*p['grid_price'],2),'warnings':warnings,'assumptions':['Вітер: прогноз ECMWF на 10 м, км/год → м/с; спрощена крива, без поправки на висоту ротора.','GHI / 1000 × встановлена PV-потужність × 0.86; без нахилу й затінення.','Витрата насоса: 2.5 м³/год на кВт, ефективність поливу 85%.','Порівняння за однакової запланованої води й того самого прогнозу; фактично подана вода може різнитися через дефіцит енергії.','Kc, глибина коренів і характеристики ґрунту задані користувачем. NDVI не є показанням вологості.'],'weather':{k:v for k,v in weather.items() if k!='hours'}}

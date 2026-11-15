"""Official USDA CDL point classifications; sampled agreement is not map accuracy."""
import asyncio,re,xml.etree.ElementTree as ET
from datetime import datetime,timezone
from collections import Counter
import httpx
from shapely.geometry import shape,Point
from pyproj import Transformer
URL='https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue'
CROP_MAP={23:'spring_wheat',1:'maize',5:'soybean',21:'barley',24:'wheat',4:'sorghum',6:'sunflower',53:'pea',2:'cotton',75:'almond'}
async def fetch_crop_history(geometry):
    poly=shape(geometry);pt=poly.representative_point()
    if not(-125<pt.x<-66 and 24<pt.y<50):return {'seasons':[],'coverage':'Поточний конектор USDA CDL охоплює континентальні США. Для цього поля введіть історію вручну.','source_url':'https://www.nass.usda.gov/Research_and_Science/Cropland/SARS1a.php'}
    l,b,r,t=poly.bounds;points=[pt]+[Point(l+(r-l)*x,b+(t-b)*y) for x,y in [(.25,.25),(.75,.25),(.25,.75),(.75,.75)]];points=[p for p in points if poly.covers(p)];transform=Transformer.from_crs(4326,5070,always_xy=True);coords=[transform.transform(p.x,p.y) for p in points];sem=asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=15) as client:
        async def pixel(year,xy):
            async with sem:
                try:
                    q=await client.get(URL,params={'year':year,'x':round(xy[0],3),'y':round(xy[1],3)});q.raise_for_status();value=' '.join(ET.fromstring(q.content).itertext());code=re.search(r'value:\s*(\d+)',value);category=re.search(r'category:\s*"([^"]+)"',value)
                    if not code:raise ValueError('Unrecognized CDL result')
                    return {'code':int(code[1]),'label':category[1] if category else str(code[1])}
                except Exception:return None
        latest=datetime.now(timezone.utc).year-1;seasons=[]
        for year in range(latest-4,latest+1):
            results=await asyncio.gather(*(pixel(year,xy) for xy in coords));valid=[v for v in results if v];count=Counter(v['code'] for v in valid)
            if not count:seasons.append({'year':year,'crop':None,'origin':'unavailable','samples':len(points),'valid_samples':0});continue
            code,n=count.most_common(1)[0];item=next(v for v in valid if v['code']==code)
            seasons.append({'year':year,'crop':CROP_MAP.get(code),'category':item['label'],'code':code,'sample_agreement':round(n/len(valid),3),'samples':len(points),'valid_samples':len(valid),'native_resolution_m':10 if year>=2024 else 30,'origin':'USDA_CDL_point_samples','source_url':URL,'sowing_date':None})
    return {'seasons':seasons,'fetched_at':datetime.now(timezone.utc).isoformat(),'source':'USDA NASS CDL / CropScape','source_url':'https://nassgeodata.gmu.edu/CropScape/devhelp/getexamples.html','coverage':'Класифікація кількох пікселів усередині межі, не верифікація всього поля. Узгодженість проб не є точністю моделі. Перевірте роки перед застосуванням до сівозміни.'}

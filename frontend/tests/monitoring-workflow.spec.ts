import {test,expect} from '@playwright/test';
test('farmer confirms five crop seasons and opens the spectral workspace',async({page,request})=>{
 test.setTimeout(90000);
 const response=await request.post('/api/backend/fields',{data:{name:'Monitoring workflow fixture',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},crop_history:['wheat'],soil_type:'loam'}});expect(response.ok()).toBeTruthy();const field=await response.json();
 try {
  await page.route('**/api/backend/fields/*/agronomy',async route=>{await new Promise(resolve=>setTimeout(resolve,200));await route.continue()});
  await page.goto(`/farm-lab?field=${field.id}`);
  await expect(page.getByRole('heading',{name:'Що росло на цьому полі'})).toBeVisible();
  await expect(page.locator('.season-rows select')).toHaveCount(5);
  const labels=await page.locator('.season-rows select').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')!));
  const latest=Number(labels.at(-1)!.split(' ').at(-1));
  for(const label of labels){const year=Number(label.split(' ').at(-1));await page.getByLabel(label,{exact:true}).selectOption(year%2?'soybean':'spring_wheat',{timeout:10000})}
  await page.getByRole('button',{name:'Підтвердити історію для сівозміни',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Історію підтверджено');
  await page.reload();await expect(page.getByLabel(`Культура ${latest}`,{exact:true})).toHaveValue(latest%2?'soybean':'spring_wheat');
  await page.getByRole('button',{name:'Спостереження Дані та перевірка поля',exact:true}).click();await page.locator('.evidence-deep > summary').click();
  await expect(page.getByLabel('Спектральний індекс')).toBeVisible();
  await expect(page.getByLabel('Спектральний індекс').locator('option')).toHaveCount(10);
  await page.getByLabel('Спектральний індекс').selectOption('NDMI');
  await expect(page.locator('.monitoring-source').first()).toContainText('20 м');
  await expect(page.locator('.lab-scene')).toHaveCount(0);
  await expect(page.locator('.crop-seasons')).toHaveCount(0);
 }finally{await request.delete(`/api/backend/fields/${field.id}`,{headers:{'Content-Type':'application/json'}})}
});

test('cached USDA classifications populate all seasons without another import click',async({page,request})=>{
 const response=await request.post('/api/backend/fields',{data:{name:'USDA autofill fixture',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},crop_history:['wheat'],soil_type:'loam'}});expect(response.ok()).toBeTruthy();const field=await response.json();
 try{
  const seasons=Array.from({length:5},(_,i)=>({year:2021+i,crop:i%2?'spring_wheat':'soybean',origin:'USDA_CDL_point_samples',sowing_date:null}));
  await page.route(`**/api/backend/fields/${field.id}/agronomy`,route=>route.fulfill({json:{seasons:[],cdl_history:{seasons,source:'USDA CDL'}}}));
  await page.goto(`/farm-lab?field=${field.id}`);
  for(const season of seasons)await expect(page.getByLabel(`Культура ${season.year}`,{exact:true})).toHaveValue(season.crop);
  await expect(page.locator('.crop-source-banner')).toContainText('Культури підставлено');
 }finally{await request.delete(`/api/backend/fields/${field.id}`,{headers:{'Content-Type':'application/json'}})}
});

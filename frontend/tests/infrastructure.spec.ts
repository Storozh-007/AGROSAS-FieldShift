import {test,expect} from '@playwright/test';

test('single-origin pages, API docs and protected upstream proxy',async({request})=>{
 for(const path of ['/','/earth','/dashboard','/fields','/satellites','/climate','/settings','/api/docs','/api/openapi.json','/api/health']){
  const response=await request.get(path);expect(response.status(),path).toBe(200);
 }
 const direct=await request.get('/api/fields');expect(direct.ok()).toBeTruthy();
 const proxied=await request.get('/api/backend/fields');expect(proxied.ok()).toBeTruthy();
 expect(await direct.json()).toEqual(await proxied.json());
 const denied=await request.post('/api/fields',{headers:{Origin:'https://untrusted.example'},data:{}});expect(denied.status()).toBe(403);
});

test('field created through gateway appears in browser and deletes cleanly',async({page,request})=>{
 const response=await request.post('/api/fields',{data:{name:'Compose E2E field',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},soil_type:'loam',crop_history:['wheat','pea','barley']}});
 expect(response.status()).toBe(201);const field=await response.json();
 try{
  expect(field.area_ha).toBeGreaterThan(0);await page.goto('/fields');
  await page.getByRole('button',{name:'Оберіть поле',exact:true}).click();await page.getByRole('button',{name:`Відкрити поле ${field.name}`,exact:true}).click();
  await expect(page.locator('.map-card h2')).toHaveText('Compose E2E field');
 }finally{expect((await request.delete(`/api/fields/${field.id}`)).status()).toBe(204);}
});

test('Earth renders WebGL and supports pause/resume',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/earth');await expect(page.locator('canvas')).toBeVisible({timeout:30000});
 await expect(page.getByText('LIVE ·',{exact:false}).first()).toBeVisible();
 const canvas=page.locator('canvas');expect(await canvas.evaluate((c:HTMLCanvasElement)=>c.width>0&&c.height>0)).toBeTruthy();
 const skip=page.getByRole('button',{name:'Пропустити'});if(await skip.isVisible())await skip.click();
 await page.getByTitle('Pause simulation').click();await expect(page.getByTitle('Play simulation')).toBeVisible();
 expect(errors).toEqual([]);
});

test('mobile fields layout stays inside viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/fields');
 await expect(page.locator('.bottom-nav')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('NASA history produces three rotations and climate controls recalculate scores',async({page,request})=>{
 test.setTimeout(180000);
 const created=await request.post('/api/fields',{data:{name:'NASA journey verification',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},soil_type:'loam',soil_ph:6.8,crop_history:['wheat','maize','sunflower']}});
 expect(created.status()).toBe(201);const field=await created.json();
 try{
  const observations=await request.post('/api/nasa/power',{timeout:150000,data:{field_id:field.id,start:'2024-04-01',end:'2024-09-30'}});
  expect(observations.status(),await observations.text()).toBe(200);
  const data=await observations.json();expect(data.source).toBe('NASA POWER');expect(data.rows.length).toBe(183);
  await page.goto('/analysis');await page.getByRole('button',{name:'Оберіть поле',exact:true}).click();await page.getByRole('button',{name:`Відкрити поле ${field.name}`,exact:true}).click();
  await expect(page.locator('.strategy-tabs [role=tab]').first()).toBeVisible({timeout:120000});expect(await page.locator('.strategy-tabs [role=tab]').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.threat')).toHaveCount(7);
  await page.getByRole('button',{name:/Сухий рік/}).click();await expect(page.getByRole('button',{name:/Сухий рік/})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.planner-busy')).toHaveCount(0,{timeout:120000});await expect(page.locator('.strategy-tabs [role=tab]').first()).toBeVisible();
 }finally{await request.delete(`/api/fields/${field.id}`);}
});

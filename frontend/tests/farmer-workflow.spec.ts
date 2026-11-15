import {test,expect} from '@playwright/test';
test('farmer turns a water constraint into a saved irrigation task and a reported result',async({page,request})=>{
 test.setTimeout(120000);
 const created=await request.post('/api/backend/fields',{data:{name:'Farmer outcome workflow fixture',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},soil_type:'loam',crop_history:['wheat']}});
 expect(created.ok()).toBeTruthy();const field=await created.json();
 try{
  expect((await request.put(`/api/backend/fields/${field.id}/design`,{data:{crop:'wheat',objects:[],connections:[]}})).ok()).toBeTruthy();
  await page.goto(`/farm-lab?field=${field.id}#plan`);
  await expect(page.locator('.ab-head h2')).toContainText('Що зробити на полі');await page.locator('#irrigation > summary').click();
  await expect(page.getByRole('heading',{name:'Що робити сьогодні',exact:true})).toBeVisible();
  await expect(page.locator('input[type="range"]:visible')).toHaveCount(0);
  await page.getByRole('button',{name:'Розрахувати 72 години',exact:true}).click();
  await expect(page.locator('.planner-results')).toBeVisible({timeout:45000});
  await expect(page.getByRole('button',{name:'Розрахувати 72 години',exact:true})).toBeEnabled({timeout:15000});
  const saved=await request.get(`/api/backend/fields/${field.id}/design`);const design=await saved.json();
  expect(design.revision).toBe(2);expect(design.objects.filter((o:{kind:string})=>o.kind==='pump')).toHaveLength(1);expect(design.objects.some((o:{kind:string})=>o.kind==='tank')).toBeTruthy();
  await expect(page.locator('.planner-results')).toBeVisible({timeout:45000});await expect(page.locator('.planner-results')).toContainText('Нестача до цілі');
  await expect(page.locator('.planner-provenance').last()).toContainText('ECMWF');
  await page.getByRole('button',{name:'Зберегти план у журнал',exact:true}).click();
  const task=page.locator('details[data-status="planned"]');await expect(task).toHaveCount(1,{timeout:45000});await task.locator('summary').click();
  await page.getByLabel(/^Фактично води для завдання /).fill('120');await page.getByLabel(/^Фактично енергії для завдання /).fill('50');
  await page.getByRole('button',{name:'Підтвердити виконання',exact:true}).click();
  await expect(page.locator('details[data-status="completed"]')).toContainText('Звіт користувача',{timeout:10000});
  const actions=await request.get(`/api/backend/fields/${field.id}/actions`);const records=await actions.json();expect(records[0].status).toBe('completed');expect(records[0].outcome).toMatchObject({water_m3:120,energy_kwh:50,origin:'user_reported'});
 }finally{expect((await request.delete(`/api/backend/fields/${field.id}`,{headers:{'Content-Type':'application/json'}})).status()).toBe(204)}
});

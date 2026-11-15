import {test, expect, type APIRequestContext} from '@playwright/test';

test.setTimeout(90000);
const geometry={type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]};
type Fixture={id:string;name:string};
async function createField(request:APIRequestContext,name:string,country='USA'):Promise<Fixture>{
  const response=await request.post('/api/backend/fields',{data:{name,geometry,crop_history:['wheat'],soil_type:'loam'}});
  expect(response.ok()).toBeTruthy();const field=await response.json();
  const profile=await request.put(`/api/backend/fields/${field.id}/profile`,{data:{operator_name:'Operations test fixture',country,region:'Test fixture'}});
  expect(profile.ok()).toBeTruthy();return{id:field.id,name};
}
async function removeFields(request:APIRequestContext,fields:Fixture[]){for(const field of fields)expect((await request.delete(`/api/backend/fields/${field.id}`,{headers:{'Content-Type':'application/json'}})).status()).toBe(204)}

test('examples stay behind a searchable regional picker and Escape returns focus',async({page,request})=>{
 const fixtures:Fixture[]=[];
 try{
  for(const [country,suffix] of [['USA','USA'],['DE','Europe'],['UA','Ukraine']])fixtures.push(await createField(request,`Operations chooser ${suffix}`,country));
  await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'Огляд господарства',exact:true})).toBeVisible();
  await expect(page.locator('.farm-orbit-fields')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const trigger=page.getByRole('button',{name:'Приклади полів',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'З яким полем працюємо?'});await expect(dialog).toBeVisible();
  await page.getByRole('textbox',{name:'Пошук поля'}).fill('Operations chooser');
  await expect(dialog.getByRole('button',{name:/Відкрити поле Operations chooser/})).toHaveCount(3);
  await dialog.getByRole('button',{name:/^Європа/}).click();
  await expect(dialog.getByRole('button',{name:'Відкрити поле Operations chooser Europe',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Відкрити поле Operations chooser USA',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await page.getByRole('textbox',{name:'Пошук поля'}).fill('Operations chooser Ukraine');
  await page.getByRole('button',{name:'Відкрити поле Operations chooser Ukraine',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toContainText('Operations chooser Ukraine');
 }finally{await removeFields(request,fixtures)}
});

test('farm opens on decisions and the twin shows an attached moving swath that pauses',async({page,request})=>{
 const field=await createField(request,'Operations scan verification');
 const pageErrors:string[]=[];page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await page.goto(`/farm-lab?field=${field.id}`);
  await expect(page.getByRole('button',{name:'Поле для моделі',exact:true})).toContainText(field.name);
  await expect(page.getByRole('button',{name:'Сівозміна 30 років клімату · стратегії',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('input[type="range"]:visible')).toHaveCount(0);await expect(page.locator('.lab-scene')).toHaveCount(0);
  await page.getByRole('button',{name:'Цифрова ферма Обладнання та зʼєднання',exact:true}).click();
  const scene=page.locator('.lab-scene');await expect(scene.locator('canvas')).toBeVisible({timeout:30000});
  await expect(scene).toHaveAttribute('data-satellite-model','NASA Landsat 8',{timeout:45000});
  await expect(scene).toHaveAttribute('data-scan-visual','surface-swath');
  const start=await scene.getAttribute('data-scan-progress');await expect(scene).not.toHaveAttribute('data-scan-progress',start!);
  await page.getByRole('button',{name:'Пауза прольоту',exact:true}).click();await expect(page.getByRole('button',{name:'Продовжити проліт',exact:true})).toBeVisible();
  // Allow one scheduled frame to consume the pause, then sample multiple frame intervals.
  await page.waitForTimeout(180);const paused=await scene.getAttribute('data-scan-progress');const pausedX=await scene.getAttribute('data-scan-x');
  await page.waitForTimeout(550);expect(await scene.getAttribute('data-scan-progress')).toBe(paused);expect(await scene.getAttribute('data-scan-x')).toBe(pausedX);
  await page.getByRole('button',{name:'Повторити проліт',exact:true}).click();
  await expect.poll(async()=>Number(await scene.getAttribute('data-scan-progress'))).toBeLessThan(.15);
  await expect(page.getByRole('button',{name:'Пауза прольоту',exact:true})).toBeVisible();expect(pageErrors).toEqual([]);
 }finally{await removeFields(request,[field])}
});

test('the deleted Soniachne example is absent from the field catalogue',async({request})=>{
 const response=await request.get('/api/backend/fields');expect(response.ok()).toBeTruthy();const fields=await response.json();
 expect(fields.some((field:{name:string})=>/сонячне/i.test(field.name))).toBeFalsy();
});

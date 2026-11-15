import {test,expect} from '@playwright/test';
test.setTimeout(90000);
let fixtureId='';
test.beforeEach(async({request})=>{const response=await request.post('/api/backend/fields',{data:{name:'Lab verification fixture',geometry:{type:'Polygon',coordinates:[[[34.45,49.62],[34.46,49.62],[34.46,49.61],[34.45,49.61],[34.45,49.62]]]},crop_history:['wheat'],soil_type:'loam'}});expect(response.ok()).toBeTruthy();fixtureId=(await response.json()).id});
test.afterEach(async({request})=>{if(fixtureId)expect((await request.delete(`/api/backend/fields/${fixtureId}`,{headers:{'Content-Type':'application/json'}})).status()).toBe(204)});
test('Sun and Moon ephemerides respond to the orbit time control',async({page})=>{
 await page.goto('/dashboard');await expect(page.locator('.celestial-body.sun')).toBeVisible({timeout:20000});await expect(page.locator('.celestial-body.moon')).toBeVisible();
 const before=await page.locator('.celestial-body.sun').getAttribute('style');const slider=page.getByLabel('Зсув часу орбіти');await slider.focus();await slider.press('End');
 await expect.poll(()=>page.locator('.celestial-body.sun').getAttribute('style')).not.toBe(before);
 await expect(page.locator('.celestial-body.moon span')).toContainText('МІСЯЦЬ ·');
});
test('field equipment plans open the matching farm model',async({page})=>{
 await page.goto('/dashboard');await expect(page.locator('.farm-beacon')).toBeVisible({timeout:20000});await page.locator('.farm-beacon').click();
 await expect(page.getByTestId('field-dossier')).toBeVisible({timeout:15000});await expect(page.locator('.planned-map-node')).toHaveCount(3);
 const href=await page.locator('.dossier-lab-link').getAttribute('href');await page.locator('.dossier-lab-link').click();
 await expect(page).toHaveURL(new RegExp('/farm-lab\\?field='));await expect(page.getByRole('heading',{name:'Що росло на цьому полі',exact:true})).toBeVisible({timeout:30000});
 expect(new URL(page.url()).searchParams.get('field')).toBe(new URL(href!,'http://localhost').searchParams.get('field'));
});

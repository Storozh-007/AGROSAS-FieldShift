import {test,expect} from '@playwright/test';

test('dashboard beacon flies to detailed field and back to the globe',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/dashboard');const explorer=page.getByTestId('farm-earth');
 await expect(explorer).toHaveAttribute('data-view','orbit');
 await expect(page.locator('.farm-beacon')).toBeVisible({timeout:20000});
 await expect(page.locator('.orbital-craft').first()).toBeAttached();
 await page.locator('.farm-beacon').click();
 await expect(explorer).toHaveAttribute('data-view','field',{timeout:15000});
 const dossier=page.getByTestId('field-dossier');await expect(dossier).toBeVisible();
 await expect(dossier.getByText(/Поточна культура|Культура · сценарій/)).toBeVisible();
 await expect(dossier.getByText('Ґрунт',{exact:true})).toBeVisible();
 await expect(page.locator('.farm-field-label')).toBeVisible();
 await page.getByRole('button',{name:'Паспорт поля',exact:true}).click();await expect(dossier).toBeHidden();
 await page.getByRole('button',{name:'Паспорт поля',exact:true}).click();await expect(dossier).toBeVisible();
 await page.getByRole('button',{name:'На орбіту',exact:true}).click();
 await expect(explorer).toHaveAttribute('data-view','orbit',{timeout:15000});
 await expect(page.locator('.farm-beacon')).toBeVisible();expect(errors).toEqual([]);
});

test('mobile orbit and field controls remain usable without overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/dashboard');
 await expect(page.locator('.farm-beacon')).toBeVisible({timeout:20000});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.locator('.farm-beacon').click();await expect(page.getByTestId('field-dossier')).toBeVisible({timeout:15000});
 await expect(page.locator('.bottom-nav')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('retina canvas renders native pixels and the brand image is transparent',async({browser})=>{
 test.setTimeout(90000);
 const context=await browser.newContext({viewport:{width:1440,height:950},deviceScaleFactor:2});
 try{const page=await context.newPage();await page.goto('/dashboard');await expect(page.locator('.farm-beacon')).toBeVisible({timeout:20000});
 const ratio=await page.locator('.farm-earth-canvas canvas').evaluate((canvas:HTMLCanvasElement)=>canvas.width/canvas.getBoundingClientRect().width);expect(ratio).toBeGreaterThanOrEqual(1.9);
 const alpha=await page.locator('.sidebar .agrosas-brand img').evaluate((image:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);return context.getImageData(0,0,1,1).data[3]});expect(alpha).toBe(0);
 }finally{await context.close()}
});

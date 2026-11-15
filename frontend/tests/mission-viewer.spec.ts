import {test,expect} from '@playwright/test';

test('missing official spacecraft meshes use real credited images',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mission of ['gpm','viirs','srtm','sentinel2']){
  await page.goto(`/missions?mission=${mission}`);
  const photo=page.locator('figure img');await expect(photo).toBeVisible();
  await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBeTruthy();
  await expect(page.locator('figure figcaption a')).toHaveAttribute('href',/^https:\/\//);
  await expect(page.locator('.mission-model canvas')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});

test('official SMAP demonstration is visible and actually plays',async({page})=>{
 test.setTimeout(60000);await page.goto('/missions?mission=smap');
 await page.getByRole('button',{name:'▶ Відео / приклад',exact:true}).click();
 const player=page.getByTestId('mission-official-video').first();await expect(player).toBeVisible();
 await player.evaluate(async(video:HTMLVideoElement)=>{video.muted=true;await video.play()});
 await expect.poll(()=>player.evaluate((video:HTMLVideoElement)=>video.currentTime)).toBeGreaterThan(0);
 await expect(player.locator('source')).toHaveAttribute('src','/missions/videos/smap-scan.webm');
});

test('mission working principle advances through user-selectable steps',async({page})=>{
 await page.goto('/missions?mission=gpm');
 const process=page.locator('section').filter({has:page.getByRole('heading',{name:'Від сигналу до перевірки поля'})});
 const steps=process.locator('button[aria-pressed]').filter({has:page.locator('b')});
 await expect(steps).toHaveCount(3);await steps.nth(1).click();await expect(steps.nth(1)).toHaveAttribute('aria-pressed','true');
 await expect(process.locator('svg[role="img"]')).toHaveAttribute('aria-label',/^Крок 2:/);
});

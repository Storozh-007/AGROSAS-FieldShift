import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { readFile, writeFile, utimes } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const target=fileURLToPath(new URL('../frontend/app/settings/page.tsx',import.meta.url));
const original=await readFile(target,'utf8');
const changed=original.replace('Налаштування платформи','Налаштування платформи · HMR verification');
if(changed===original)throw new Error('Settings heading not found');
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto('http://localhost:8080/settings');
 await page.locator('h1').waitFor();
 await writeFile(target,changed);
 await page.getByRole('heading',{name:'Налаштування платформи · HMR verification',exact:true}).waitFor({timeout:45000});
 console.log('PASS: browser received hot update through Caddy without navigation');
}finally{
 if(await readFile(target,'utf8')===changed)await writeFile(target,original);
 await browser.close();
}
const source=fileURLToPath(new URL('../backend/app/main.py',import.meta.url));
await utimes(source,new Date(),new Date());
console.log('Triggered backend reload; inspect dev backend logs and health check.');

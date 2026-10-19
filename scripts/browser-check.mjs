import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { startServer } from '../server/index.js';
const temp=mkdtempSync(join(tmpdir(),'diagram-desk-browser-'));
const evidence=resolve('.archify/browser');mkdirSync(evidence,{recursive:true});
const server=await startServer({port:0,databasePath:join(temp,'library.sqlite'),distDirectory:resolve('dist'),initializeCatalog:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();const errors=[];const external=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await context.route('**/*',route=>{
 const url=route.request().url();
 if(url.startsWith(server.origin)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
 external.push(url);return route.abort();
});
const report={catalog:[],checks:[]};
const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name);console.log('PASS',name);};
async function ready(){await page.locator('.archify-reader').waitFor();const frame=page.frameLocator('.archify-reader');await frame.locator('svg').first().waitFor();return frame;}
try{
 const diagrams=await(await fetch(`${server.origin}/api/diagrams`)).json();check('fresh install has eighteen records',diagrams.diagrams.length===18);
 const catalog=JSON.parse(readFileSync('catalog/index.json'));
 for(const theme of (process.env.BROWSER_INTERACTIONS_ONLY ? [] : ['light','dark'])){
  await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  for(const[slugIndex,item]of catalog.entries()){
   const row=diagrams.diagrams.find(d=>d.title===item.title);assert.ok(row);
   await page.setViewportSize({width:1440,height:1000});await page.goto(`${server.origin}/diagrams/${row.id}`);const frame=await ready();
   check(`${theme}: ${item.slug} has a native reader`,await frame.locator('svg').count()>0);
   await page.locator('iframe').screenshot({path:join(evidence,`${item.slug}-${theme}-desktop.png`)});
   await page.setViewportSize({width:390,height:844});
   check(`${theme}: ${item.slug} mobile page is contained`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${theme}: ${item.slug} learning text is readable`,await page.locator('.lesson-deck').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
   await page.screenshot({path:join(evidence,`${item.slug}-${theme}-mobile.png`),fullPage:true});
   report.catalog.push({slug:item.slug,theme,viewports:['1440x1000','390x844']});
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${server.origin}/new`);
 await page.getByLabel('Title',{exact:true}).fill('Browser verification');
 const candidate={schema_version:1,diagram_type:'architecture',meta:{title:'Browser verification',output:'diagram.html',locale:'en',quality_profile:'showcase'},components:[{id:'a',type:'frontend',label:'Request',pos:[40,40],size:[120,60]},{id:'b',type:'backend',label:'Response',pos:[300,40],size:[120,60]}],connections:[{from:'a',to:'b',label:'result'}]};
 await page.getByLabel('Archify JSON',{exact:true}).fill(JSON.stringify(candidate,null,2));await ready();
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForURL(/\/diagrams\/[a-f0-9-]+$/);await ready();const saved=page.url();
 check('create saves and opens a bookmarkable native lesson',saved.includes('/diagrams/'));
 await page.getByRole('button',{name:'Edit',exact:true}).click();await ready();await page.getByLabel('Title',{exact:true}).fill('Updated browser verification');
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForURL(saved);await ready();
 check('edit persists a changed title',await page.locator('h2.viewer__title').textContent()==='Updated browser verification');
 await page.reload();await ready();check('deep link survives reload',await page.locator('h2.viewer__title').textContent()==='Updated browser verification');
 await page.getByLabel('Search diagrams',{exact:true}).fill('Updated browser');await page.waitForTimeout(250);check('search finds the saved record',await page.locator('.library__item').count()===1);
 await page.getByRole('button',{name:'Edit',exact:true}).click();await ready();await page.getByLabel('Archify JSON',{exact:true}).fill('{bad');await page.waitForTimeout(300);check('invalid JSON blocks save',await page.getByRole('button',{name:'Save',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();await page.waitForURL(saved);await ready();
 await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();await page.waitForURL(`${server.origin}/`);
 const all=(await(await fetch(`${server.origin}/api/diagrams`)).json()).diagrams;check('delete removes only the new record',all.length===18);
 const nativeRecord=all.find(row=>row.title==='Agentic AI systems with tools');
 await page.goto(`${server.origin}/diagrams/${nativeRecord.id}`);const native=await ready();
 for(const format of ['svg','png']){
  await native.getByRole('button',{name:'Export diagram',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await native.locator(`[data-format="${format}"]`).click();
  const download=await downloadPromise;check(`native ${format.toUpperCase()} download succeeds`,(await download.failure())===null);
 }
 await native.getByRole('button',{name:'Find a node',exact:true}).click();
 await native.getByLabel('Search diagram nodes',{exact:true}).fill('LLM');
 await native.locator('.node-finder [aria-label^="Focus LLM,"]').click();
 check('node search opens its semantic explanation',await native.getByRole('button',{name:'Close semantic passport',exact:true}).isVisible());
 await native.getByRole('button',{name:'Close semantic passport',exact:true}).click();
 const svg=native.locator('.diagram-container > svg');
 const widthBefore=await svg.evaluate(el=>el.getBoundingClientRect().width);
 await native.getByRole('button',{name:'Zoom in',exact:true}).click();
 check('native zoom enlarges the diagram',await svg.evaluate(el=>el.getBoundingClientRect().width)>widthBefore);
 const phone=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const phonePage=await phone.newPage();await phonePage.goto(`${server.origin}/diagrams/${nativeRecord.id}`);
 const touchFrame=phonePage.frameLocator('iframe');await touchFrame.locator('.diagram-container > svg').waitFor();
 await phonePage.locator('iframe').scrollIntoViewIfNeeded();
 const touchContainer=touchFrame.locator('.diagram-container');
 await touchFrame.getByRole('button',{name:'Zoom in',exact:true}).click();
 const touchSvg=touchFrame.locator('.diagram-container > svg');
 const before=await touchSvg.evaluate(el=>el.style.transform);
 const frameRect=await phonePage.locator('iframe').boundingBox();
 const background=await touchContainer.evaluate(el=>{
   const bounds=el.getBoundingClientRect();
   for(let y=bounds.top+12;y<Math.min(innerHeight-20,bounds.bottom-12);y+=18){
     for(let x=bounds.left+180;x<bounds.right-12;x+=18){
       const target=document.elementFromPoint(x,y);
       if(target && el.contains(target) && !target.closest('[data-node-id],[data-relationship-hit-key],.diagram-nav') && ['svg','DIV','rect'].includes(target.tagName))return{x,y};
     }
   }
   return null;
 });
 assert.ok(background,'The native viewport has draggable background space.');
 const client=await phone.newCDPSession(phonePage);
 const tx=frameRect.x+background.x,ty=frameRect.y+background.y;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
 for(let i=1;i<=8;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx-i*15,y:ty}]});await phonePage.waitForTimeout(20);}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phonePage.waitForTimeout(150);
 check('phone touch gesture pans the contained native diagram',await touchSvg.evaluate(el=>el.style.transform)!==before);
 const scaleBefore=Number(await touchSvg.getAttribute('data-view-scale'));
 const pinchX=frameRect.x+Math.min(200,background.x),pinchY=frameRect.y+background.y;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pinchX-25,y:pinchY,id:1},{x:pinchX+25,y:pinchY,id:2}]});
 for(let i=1;i<=5;i++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pinchX-25-i*7,y:pinchY,id:1},{x:pinchX+25+i*7,y:pinchY,id:2}]});await phonePage.waitForTimeout(20);}
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 check('phone two-finger pinch increases native zoom',Number(await touchSvg.getAttribute('data-view-scale'))>scaleBefore);
 await phone.close();
 await page.setViewportSize({width:390,height:844});await page.goto(`${server.origin}/diagrams/${all[0].id}`);await ready();await page.getByRole('button',{name:'Browse lessons'}).click();await page.locator('#library').waitFor({state:'visible'});check('mobile library opens on demand',await page.locator('#library').isVisible());
 check('mobile drawer exposes modal semantics and makes the lesson inert',await page.locator('#library').getAttribute('role')==='dialog' && await page.locator('#stage').evaluate(el=>el.inert));
 await page.locator('.library__item').last().focus();await page.keyboard.press('Tab');
 check('mobile drawer wraps keyboard focus to its close button',await page.locator('.mobile-drawer__close').evaluate(el=>el===document.activeElement));
 await page.keyboard.press('Escape');await page.locator('#library').waitFor({state:'hidden'});
 check('Escape closes the drawer and returns focus',await page.locator('#library-toggle').evaluate(el=>el===document.activeElement) && !(await page.locator('#stage').evaluate(el=>el.inert)));
 await page.getByRole('button',{name:'Browse lessons'}).click();await page.locator('#library').waitFor({state:'visible'});await page.locator('.library__item').first().click();await ready();
 check('opening a lesson closes the drawer and focuses its heading',await page.locator('#viewer-title').evaluate(el=>el===document.activeElement) && await page.locator('#library-toggle').getAttribute('aria-expanded')==='false');
 await page.getByRole('button',{name:'Browse lessons'}).click();await page.locator('#library').waitFor({state:'visible'});await page.locator('#library-backdrop').click({position:{x:380,y:400}});await page.locator('#library').waitFor({state:'hidden'});
 check('the drawer backdrop closes the library',await page.locator('#library-toggle').getAttribute('aria-expanded')==='false');
 await page.getByRole('button',{name:'Browse lessons'}).click();await page.locator('#library').waitFor({state:'visible'});await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>!document.getElementById('stage').inert);
 check('desktop resizing restores the persistent library and lesson interaction',await page.locator('#library').isVisible() && await page.locator('#library').getAttribute('role')===null && !(await page.locator('#stage').evaluate(el=>el.inert)));
 check('no external runtime requests',external.length===0);check('no browser errors',errors.length===0);
 writeFileSync(join(evidence,process.env.BROWSER_INTERACTIONS_ONLY ? 'report-interactions.json' : 'report.json'),JSON.stringify(report,null,2));
 console.log(`${report.checks.length} browser checks passed; ${report.catalog.length} catalog/theme reviews captured at ${evidence}`);
}finally{await context.close();await browser.close();await server.close();rmSync(temp,{recursive:true,force:true});}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer, createReaderFrame } from '../src/preview.js';
import { JSDOM } from 'jsdom';

test('invalid JSON stays local and never reaches the renderer', async () => {
  let calls=0;const render=createRenderer(()=>{calls++;});
  assert.equal((await render('flowchart TD')).status,'error');assert.equal(calls,0);
});
test('native JSON previews use the server-owned reader URL', async () => {
  let request;const render=createRenderer(async(url,options)=>{request={url,...options};return{ok:true,json:async()=>({readerUrl:'/api/previews/test'})};});
  const result=await render(JSON.stringify({diagram_type:'architecture',meta:{title:'A'}}));
  assert.equal(result.readerUrl,'/api/previews/test');assert.equal(request.url,'/api/preview');assert.equal(JSON.parse(request.body).type,'architecture');
});
test('renderer diagnostics and transport errors are readable',async()=>{
  const source=JSON.stringify({diagram_type:'workflow',meta:{title:'A'}});
  assert.match((await createRenderer(async()=>({ok:false,json:async()=>({error:'Missing node'})}))(source)).message,/Missing node/);
  assert.match((await createRenderer(async()=>{throw new Error();})(source)).message,/local renderer/);
});
test('reader frames permit native scripts and downloads without host access',()=>{
  const doc=new JSDOM().window.document;const frame=createReaderFrame(doc,'/api/previews/test','Example');
  assert.equal(frame.getAttribute('sandbox'),'allow-scripts allow-downloads');assert.equal(frame.title,'Example');assert.equal(frame.getAttribute('referrerpolicy'),'no-referrer');
});

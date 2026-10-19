import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{compileDiagram,parseCandidate}from'./archify.js';import{createWorkspace,startTestServer,postDiagram,request}from'./harness.js';
const source=readFileSync(new URL('../catalog/diagrams/coordinated-research.json',import.meta.url),'utf8');
test('native compiler rejects invalid JSON, mismatched modes, and invalid schema',async()=>{
 assert.throws(()=>parseCandidate('bad','architecture'),/valid JSON/);assert.throws(()=>parseCandidate(source,'workflow'),/match/);
 const invalid=JSON.parse(source);delete invalid.components;await assert.rejects(compileDiagram(JSON.stringify(invalid),'architecture'),/components/);
});
test('typed API persists lesson metadata and isolates the native reader',async()=>{
 const workspace=createWorkspace();const server=await startTestServer(workspace);
 try{
  const result=await postDiagram(server.origin,{title:'Research',source,extra:{type:'architecture',lesson:{summary:'Learn ownership',objectives:['Identify the owner']}}});assert.equal(result.status,201);assert.equal(result.body.lesson.summary,'Learn ownership');
  const reader=await request(server.origin,'GET',`/api/diagrams/${result.body.id}/reader`);assert.equal(reader.status,200);assert.match(reader.headers.get('content-security-policy'),/sandbox allow-scripts allow-downloads/);assert.match(reader.headers.get('content-security-policy'),/connect-src 'none'/);assert.doesNotMatch(reader.headers.get('content-security-policy'),/allow-same-origin/);assert.match(reader.text,/<svg/);
  const bad=await postDiagram(server.origin,{title:'Bad',source:'{}',extra:{type:'architecture'}});assert.equal(bad.status,400);
  const injected=await postDiagram(server.origin,{title:'Bad reference',source,extra:{type:'architecture',lesson:{references:[{title:'Bad',url:'javascript:alert(1)'}]}}});assert.equal(injected.status,400);
  await server.close();const again=await startTestServer(workspace);try{const saved=await request(again.origin,'GET',`/api/diagrams/${result.body.id}`);assert.equal(saved.body.type,'architecture');assert.deepEqual(saved.body.lesson.objectives,['Identify the owner']);}finally{await again.close();}
 }finally{await server.close();workspace.cleanup();}
});

import test from 'node:test';import assert from 'node:assert/strict';import{JSDOM}from'jsdom';import{createViewerPanel}from'../src/viewer-panel.js';
function setup(render=async()=>({status:'ok',readerUrl:'/api/previews/test'})){
 const doc=new JSDOM().window.document;const panel=createViewerPanel({doc,render,onEdit:()=>{},onDelete:()=>{}});doc.body.append(panel.root);return{doc,panel};
}
const diagram={id:'one',title:'Example',type:'architecture',source:'{}',lesson:{summary:'A useful summary',objectives:['Trace the flow'],walkthrough:[{title:'Read',detail:'Follow the request.'}],decisions:['Keep ownership explicit.'],failureModes:['A tool can fail.'],takeaways:['Check receipts.'],references:[{title:'Reference',url:'https://example.com'}]}};
test('saved lessons expose teaching text and an isolated native reader',async()=>{
 const{doc,panel}=setup();await panel.showDiagram(diagram);assert.equal(doc.querySelector('iframe').title,'Interactive diagram: Example');assert.match(doc.body.textContent,/Follow the request/);assert.match(doc.body.textContent,/Why this design/);assert.equal(doc.querySelector('.lesson-references a').getAttribute('href'),'https://example.com');
});
test('an older render cannot replace a newly opened lesson',async()=>{
 let finish;const{doc,panel}=setup(source=>source==='old'?new Promise(resolve=>finish=resolve):Promise.resolve({status:'ok',readerUrl:'/new'}));
 const old=panel.showDiagram({...diagram,source:'old'});await panel.showDiagram({...diagram,title:'New',source:'new'});finish({status:'ok',readerUrl:'/old'});await old;assert.equal(doc.querySelector('iframe').getAttribute('src'),'/new');
});
test('render failure is announced and the lesson remains readable',async()=>{
 const{doc,panel}=setup(async()=>({status:'error',message:'Missing a node'}));await panel.showDiagram(diagram);assert.match(doc.querySelector('[role=alert]').textContent,/Missing a node/);assert.match(doc.body.textContent,/A useful summary/);
});
test('clearing the viewer supersedes a pending render',async()=>{
 let finish;const{doc,panel}=setup(()=>new Promise(resolve=>finish=resolve));const work=panel.showDiagram(diagram);panel.showEmpty();finish({status:'ok',readerUrl:'/old'});await work;assert.equal(doc.querySelector('iframe'),null);
});

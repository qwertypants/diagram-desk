import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{DatabaseSync}from'node:sqlite';import{openStore}from'./db.js';import{seedCatalog}from'./catalog.js';import{migrate}from'../scripts/migrate-archify.mjs';
const legacy=JSON.parse(readFileSync(new URL('../catalog/legacy.json',import.meta.url)));
function fixture(){const root=mkdtempSync(join(tmpdir(),'archify-migrate-'));const path=join(root,'library.sqlite');openStore(path).close();const db=new DatabaseSync(path);for(const row of legacy)db.prepare('INSERT INTO diagrams VALUES (?,?,?,?,?,?)').run(row.id,row.title,row.title.toLowerCase(),row.source,row.createdAt,row.updatedAt);db.close();return{path,close:()=>rmSync(root,{recursive:true,force:true})};}
test('dry run accounts for all thirteen records including the duplicate and changes nothing',async()=>{
 const f=fixture();try{const result=await migrate(f.path);assert.deepEqual(result,{changed:13,added:5,dryRun:true});const db=new DatabaseSync(f.path);assert.equal(db.prepare('SELECT source FROM diagrams WHERE id=?').get(legacy[0].id).source,legacy[0].source);db.close();}finally{f.close();}
});
test('unexpected edited source aborts before applying any conversion',async()=>{
 const f=fixture();try{const db=new DatabaseSync(f.path);db.prepare('UPDATE diagrams SET source=? WHERE id=?').run('changed',legacy[0].id);db.close();await assert.rejects(migrate(f.path,{apply:true}),/Unexpected legacy source/);const store=openStore(f.path);assert.equal(store.list().length,13);assert.equal(store.list().filter(row=>row.type).length,0);store.close();}finally{f.close();}
});
test('fresh startup seeds once and never resurrects deleted lessons',()=>{
 const root=mkdtempSync(join(tmpdir(),'archify-seed-'));try{const store=openStore(join(root,'a.sqlite'));seedCatalog(store);assert.equal(store.list().length,18);const id=store.list()[0].id;store.remove(id);seedCatalog(store);assert.equal(store.list().length,17);assert.equal(store.get(id),null);store.close();}finally{rmSync(root,{recursive:true,force:true});}
});
test('apply preserves IDs and timestamps, backs up originals, and reruns without overwriting edits',async()=>{
 const f=fixture();try{
  const result=await migrate(f.path,{apply:true});assert.equal(result.changed,13);assert.equal(result.added,5);
  const backup=new DatabaseSync(result.backupPath,{readOnly:true});assert.equal(backup.prepare('SELECT source FROM diagrams WHERE id=?').get(legacy[0].id).source,legacy[0].source);backup.close();
  const store=openStore(f.path);assert.equal(store.list().length,18);for(const original of legacy){const converted=store.get(original.id);assert.equal(converted.createdAt,original.createdAt);assert.equal(converted.updatedAt,original.updatedAt);assert.equal(JSON.parse(converted.source).diagram_type,converted.type);}
  const row=store.get(legacy[0].id);store.update(row.id,{...row,title:'My revision'});const removed=store.list().find(row=>row.id.startsWith('a1c0'));store.remove(removed.id);store.close();
  assert.equal((await migrate(f.path,{apply:true})).alreadyMigrated,true);const again=openStore(f.path);assert.equal(again.get(row.id).title,'My revision');assert.equal(again.get(removed.id),null);again.close();
 }finally{f.close();}
});
test('a failed metadata write rolls back every converted source',async()=>{
 const f=fixture();try{
  const db=new DatabaseSync(f.path);db.exec("CREATE TRIGGER reject_details BEFORE INSERT ON diagram_details BEGIN SELECT RAISE(ABORT, 'disk write rejected'); END");db.close();
  await assert.rejects(migrate(f.path,{apply:true}),/disk write rejected/);const store=openStore(f.path);for(const row of legacy)assert.equal(store.get(row.id).source,row.source);assert.equal(store.list().length,13);store.close();
 }finally{f.close();}
});

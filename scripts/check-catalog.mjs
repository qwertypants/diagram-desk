import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(readFileSync('catalog/index.json'));
const timestamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'');
const root=process.env.ARCHIFY_REVIEW_DIR??`.archify/catalog-${timestamp}-${process.pid}`;
let failures=0;
const accepted=[];
for(const item of catalog.filter(item => !process.env.CHECK_ONLY || process.env.CHECK_ONLY.split(',').includes(item.slug))){
 const folder=`${root}/${item.slug}`;mkdirSync(folder,{recursive:true});
 const args=['vendor/archify/bin/archify.mjs','finalize',item.type,`catalog/${item.file}`,`${folder}/${item.slug}.html`,'--quality','showcase','--json'];
 args.push('--out-dir',`${folder}/review-${timestamp}-${process.pid}`);
 const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:90000});
 writeFileSync(`${folder}/command.log`,result.stdout+'\n'+result.stderr);
 let receipt;try{receipt=JSON.parse(result.stdout)}catch{}
 console.log(item.slug,result.status===0?'PASS':'FAIL',receipt?.status??'',JSON.stringify(receipt?.diagnostics??receipt?.summary??{}).slice(0,1300));
 if(result.status!==0)failures++;
 else accepted.push({slug:item.slug,sourceSha256:createHash('sha256').update(readFileSync(`catalog/${item.file}`)).digest('hex'),artifactSha256:receipt.artifact.sha256,gates:receipt.gates,receipt:relative(process.cwd(),receipt.evidence.summaryReceipt)});
}
if(!failures && !process.env.CHECK_ONLY)writeFileSync('catalog/acceptance.json',JSON.stringify(accepted,null,2)+'\n');
console.log({failures,total:catalog.length,root:resolve(root)});process.exitCode=failures?1:0;

import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile,spawnSync} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
let api; try {api=await import('../scripts/verify-sources.mjs');} catch(e) {if(e.code!=='ERR_MODULE_NOT_FOUND') throw e;}
const cli=await import('../scripts/explain-pr.mjs');
const requireApi=()=>{assert.ok(api,'source verifier must exist');return api;};
const exec=promisify(execFile); let directory,base,head;
const git=async(...args)=>(await exec('git',['-C',directory,...args])).stdout.trim();
before(async()=>{
  directory=await mkdtemp(join(tmpdir(),'explain-source-')); await git('init','-q');
  await writeFile(join(directory,'kept.ts'),'first\nsecond\n'); await writeFile(join(directory,'deleted.ts'),'old\n'); await writeFile(join(directory,'binary.bin'),Buffer.from([0,1,2])); await symlink('kept.ts',join(directory,'link.ts'));
  await git('add','.'); await git('-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-qm','base'); base=await git('rev-parse','HEAD');
  await git('rm','-q','deleted.ts'); await git('-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-qm','head'); head=await git('rev-parse','HEAD');
});
after(async()=>{await rm(directory,{recursive:true,force:true});});
async function report() {
  const r=JSON.parse(await readFile(new URL('../examples/demo.json',import.meta.url),'utf8')); r.sample=false; r.pr.base=base;r.pr.head=head;
  r.flows=[{id:'flow',title:'Flow',status:'reviewed',entry:'entry',summary:'Example',limitations:[],nodes:[{id:'entry',title:'Entry',description:'Read',changed:false,input:'input',output:'output',state:[],sources:[{path:'kept.ts',side:'head',start:1,end:2}]}],edges:[],findings:[],scenarios:[]}]; return r;
}
test('verifies fixed head and deleted base lines without changing checkout',async()=>{
  const r=await report();r.flows[0].nodes[0].sources.push({path:'deleted.ts',side:'base',start:1,end:1});
  r.flows[0].scenarios.push({condition:'x',result:'y',assessment:'z',sources:[{path:'kept.ts',side:'head',start:2,end:2}]});
  const receipt=await requireApi().verifySources(r,{repo:directory});
  assert.equal(receipt.status,'passed'); assert.equal(receipt.checkedFiles,2); assert.equal(receipt.checkedRanges,3); assert.match(receipt.note,/semantic support not verified/); assert.equal(await git('rev-parse','HEAD'),head);
});
test('missing, out-of-range, and binary sources fail without exposing contents',async()=>{
  for(const change of [{path:'missing.ts'},{end:3},{path:'binary.bin',end:1}]) {
    const r=await report();Object.assign(r.flows[0].nodes[0].sources[0],change);
    const receipt=await requireApi().verifySources(r,{repo:directory}); assert.equal(receipt.status,'failed'); assert.equal(receipt.errors.length,1); assert.ok(!JSON.stringify(receipt).includes('first'));
  }
});
test('sample sources never receive a passing receipt',async()=>{
  const r=await report();r.sample=true;const receipt=await requireApi().verifySources(r,{repo:directory}); assert.equal(receipt.status,'not-applicable');assert.equal(receipt.checkedFiles,0);
});
test('remote sources are fetched once per side/path with pinned escaped GET arguments',async()=>{
  const r=await report(),calls=[];r.flows[0].nodes[0].sources[0].path='src/a file.ts';r.flows[0].nodes[0].sources.push({...r.flows[0].nodes[0].sources[0],start:2});
  const receipt=await requireApi().verifySources(r,{run:async(command,args)=>{calls.push({command,args});return Buffer.from(JSON.stringify({type:'file',encoding:'base64',content:Buffer.from('one\ntwo\n').toString('base64')}));}});
  assert.equal(receipt.status,'passed');assert.equal(calls.length,1);assert.equal(calls[0].command,'gh');assert.ok(calls[0].args.some(x=>x.includes(`src/a%20file.ts?ref=${head}`)));assert.ok(calls[0].args.includes('GET'));
});
test('remote directory metadata, large files, symlinks and malformed contents fail',async()=>{
  for(const metadata of [[{type:'file',path:'child.ts'}],{type:'dir'},{type:'symlink'}, {type:'file',encoding:'none',content:''},{type:'file',encoding:'base64',content:42},{type:'file',encoding:'base64',content:'!!!'}]) {
    const receipt=await requireApi().verifySources(await report(),{run:async()=>Buffer.from(JSON.stringify(metadata))});
    assert.equal(receipt.status,'failed');assert.equal(receipt.checkedFiles,0);assert.equal(receipt.errors.length,1);
  }
});
test('source CLI uses exit 0 for real ranges, 1 for invalid ranges, and 2 for samples',async()=>{
  requireApi();const file=join(directory,'report.json'),script=fileURLToPath(new URL('../scripts/verify-sources.mjs',import.meta.url));
  for(const [kind,code] of [['valid',0],['invalid',1],['sample',2]]) {
    const r=await report();if(kind==='sample')r.sample=true;if(kind==='invalid')r.flows[0].nodes[0].sources[0].end=3;await writeFile(file,JSON.stringify(r));
    const result=spawnSync(process.execPath,[script,file,'--repo',directory],{encoding:'utf8'});assert.equal(result.status,code,result.stderr);assert.ok(JSON.parse(result.stdout).status);
  }
});
test('excerpts must appear inside the cited range, allowing redaction markers',async()=>{
  const a=requireApi();
  for(const [excerpt,ok] of [['first',true],['first … second',true],['first ... second',true],['  first\n  second ',true],['nope',false],['second … first',false]]) {
    const r=await report(); r.flows[0].nodes[0].sources[0].excerpt=excerpt;
    const receipt=await a.verifySources(r,{repo:directory});
    assert.equal(receipt.status,ok?'passed':'failed',excerpt); assert.equal(receipt.checkedExcerpts,1);
    if(!ok) {assert.equal(receipt.errors[0].category,'excerpt'); assert.ok(!JSON.stringify(receipt).includes('first'));}
  }
  assert.equal(a.excerptMatches('a [redacted] c','a b c'),true); assert.equal(a.excerptMatches('a *** c','a b'),false);
});
test('fetch failures carry a category without echoing diagnostics',async()=>{
  const a=requireApi();
  const missing=await a.verifySources(Object.assign(await report(),{}),{repo:directory,run:async()=>{throw Object.assign(Error("fatal: path 'x' does not exist in 'abc'"),{stderr:'fatal: path does not exist'});}});
  assert.equal(missing.errors[0].category,'missing'); assert.ok(!JSON.stringify(missing).includes('abc'));
  const auth=await a.verifySources(await report(),{run:async()=>{throw Error('gh: HTTP 401: Bad credentials');}}); assert.equal(auth.errors[0].category,'auth');
  const binary=await a.verifySources(Object.assign(await report(),{flows:[{...(await report()).flows[0],nodes:[{...(await report()).flows[0].nodes[0],sources:[{path:'binary.bin',side:'head',start:1,end:1}]}]}]}),{repo:directory}); assert.equal(binary.errors[0].category,'binary');
  assert.equal(a.categorize(Error('HTTP 404: Not Found')),'missing'); assert.equal(a.categorize(Error('weird')),'unavailable');
});
test('local symlinks are rejected like remote symlinks',async()=>{
  const r=await report(); r.flows[0].nodes[0].sources[0].path='link.ts';
  const receipt=await requireApi().verifySources(r,{repo:directory});
  assert.equal(receipt.status,'failed'); assert.equal(receipt.errors[0].category,'unsupported'); assert.equal(receipt.checkedFiles,0);
});
test('source prints a numbered slice of a pinned file and refuses bad ranges and paths',async()=>{
  const evidence=join(directory,'evidence'); await writeFile(join(directory,'metadata.json'),''); // not used
  const {mkdir}=await import('node:fs/promises'); await mkdir(evidence,{recursive:true});
  await writeFile(join(evidence,'metadata.json'),JSON.stringify({host:'github.com',repo:'acme/billing',diffBase:base,before:{headRefOid:head}}));
  const out=await cli.sourceSlice(evidence,'head','kept.ts','1-2',{repo:directory});
  assert.match(out,/^# kept\.ts @ head [0-9a-f]{7} · lines 1-2 of 2\n1│ first\n2│ second\n$/);
  const old=await cli.sourceSlice(evidence,'base','deleted.ts',undefined,{repo:directory}); assert.match(old,/1│ old/);
  await assert.rejects(cli.sourceSlice(evidence,'head','kept.ts','5',{repo:directory}),/file has 2 lines/);
  await assert.rejects(cli.sourceSlice(evidence,'head','../kept.ts','1',{repo:directory}),/path/);
  await assert.rejects(cli.sourceSlice(evidence,'head','binary.bin','1',{repo:directory}),/binary/);
  await assert.rejects(cli.sourceSlice(evidence,'side','kept.ts','1',{repo:directory}),/side/);
  const script=fileURLToPath(new URL('../scripts/explain-pr.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,'source',evidence,'head','kept.ts','2-2','--repo',directory],{encoding:'utf8'}); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/2│ second/);
});

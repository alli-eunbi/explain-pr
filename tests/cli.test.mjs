import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, stat, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

let api;
try { api = await import('../skills/explain-pr/scripts/explain-pr.mjs'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const requireApi = () => { assert.ok(api, 'CLI implementation must exist'); return api; };
const source = () => ({path:'src/a.ts',side:'head',start:2,end:4});
const report = () => ({version:1,sample:true,pr:{url:'https://github.com/acme/billing/pull/2',repo:'acme/billing',number:2,base:'a'.repeat(40),head:'b'.repeat(40),title:'Renew'},summary:'Overview',limitations:['External service unread'],tests:{status:'not-run',note:'Read only'},flows:[{id:'renew',title:'Renewal',status:'partial',entry:'start',summary:'Flow summary',nodes:[{id:'start',title:'Request',description:'Receive request',changed:true,input:'ID',output:'Request',before:'Old',after:'New',state:[{name:'status',value:'active'}],sources:[source()]}],edges:[],findings:[{id:'risk',nodeId:'start',kind:'question',title:'Retry',condition:'DB failure',behavior:'Payment remains',impact:'Duplicate risk',sources:[source()]}],scenarios:[{condition:'Valid ID',result:'Request',assessment:'Code read',sources:[source()]}],limitations:['Race untested']}]});
const template = '<script>const REPORT = __EXPLAIN_PR_DATA__; const MARKDOWN = __EXPLAIN_PR_MARKDOWN__;</script>';

test('accepts grounded graph with an explicit bounded retry cycle', () => {
  const r=report(); r.flows[0].edges.push({from:'start',to:'start',label:'retry',kind:'failure',sources:[source()]});
  assert.equal(requireApi().validateReport(r),r);
});
test('rejects missing evidence, unreachable nodes, invalid endpoints and duplicate ids', () => {
  for (const [mutate,pattern] of [
    [r=>r.flows[0].nodes[0].sources=[],/sources/],
    [r=>r.flows[0].nodes.push({...r.flows[0].nodes[0],id:'other'}),/reach/],
    [r=>r.flows[0].edges.push({from:'start',to:'missing',label:'x',kind:'normal',sources:[source()]}),/missing|endpoint|exist/],
    [r=>r.flows[0].nodes.push({...r.flows[0].nodes[0]}),/duplicate/],
    [r=>r.flows[0].findings[0].condition='',/condition/],
    [r=>r.flows[0].scenarios[0].sources=[],/sources/],
    [r=>r.tests.note='',/note/],
    [r=>r.pr.number=3,/url/],
    [r=>r.flows[0].nodes[0].changed='yes',/changed/],
    [r=>r.flows[0].nodes[0].state[0].value=3,/value/]
  ]) { const r=report(); mutate(r); assert.throws(()=>requireApi().validateReport(r),pattern); }
});
test('unread is explicit and cannot carry purported reviewed nodes', () => {
  const r=report(), f=r.flows[0]; Object.assign(f,{status:'unread',entry:null,nodes:[],edges:[],findings:[],scenarios:[]});
  requireApi().validateReport(r);
  f.limitations=[]; assert.throws(()=>api.validateReport(r),/limitations/);
  f.limitations=['Not read']; f.nodes=report().flows[0].nodes; assert.throws(()=>api.validateReport(r),/unread|nodes/);
});
test('rejects arbitrary URLs, unsafe source paths and invalid line ranges', () => {
  for (const path of ['/etc/passwd','../a','src/../a','src//a','src\\a','src/a\n','https://evil/a','src/./a']) {
    const r=report(); r.flows[0].nodes[0].sources[0].path=path; assert.throws(()=>requireApi().validateReport(r),/path/);
  }
  const r=report(); r.flows[0].nodes[0].sources[0].url='https://evil'; assert.throws(()=>api.validateReport(r),/url|unknown/);
  delete r.flows[0].nodes[0].sources[0].url; r.flows[0].nodes[0].sources[0].end=1; assert.throws(()=>api.validateReport(r),/end|line/);
});
test('HTML data is inert and Markdown retains state, scenarios, findings and pinned links', () => {
  const r=report(); r.sample=false; r.summary='</script><script>alert(1)</script>'; r.flows[0].edges=[{from:'start',to:'start',label:'retry',kind:'failure',sources:[source()]}];
  const out=requireApi().renderReport(r,template);
  assert.ok(!out.html.includes('</script><script>'));
  assert.ok(out.html.includes('\\u003c/script>'));
  for(const value of ['active','Old','New','retry','DB failure','Payment remains','Duplicate risk','Valid ID','Race untested','Read only',`/blob/${'b'.repeat(40)}/src/a.ts#L2-L4`]) assert.ok(out.markdown.includes(value),value);
  assert.throws(()=>api.renderReport(r,'__EXPLAIN_PR_DATA__'),/template|token/i);
});
test('sample Markdown labels fictional source positions without fake links',()=>{
  const out=requireApi().renderReport(report(),template);
  assert.ok(out.markdown.includes('예시')); assert.ok(out.markdown.includes('src/a.ts'));
  assert.ok(!out.markdown.includes('https://github.com'));
});
test('unknown change status is explicit instead of invented',()=>{
  const r=report();r.flows[0].nodes[0].changed=null;
  assert.ok(requireApi().renderReport(r,template).markdown.includes('변경 여부 확인 못 함'));
});
test('render refuses overwrite and never overwrites input, including with force', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-test-'));
  try {
    const input=join(dir,'report.html'), output=join(dir,'view.html'); await writeFile(input,JSON.stringify(report()));
    await a.renderFiles(input,output,{template,markdown:true});
    assert.ok((await readFile(join(dir,'view.md'),'utf8')).includes('Renewal'));
    await assert.rejects(a.renderFiles(input,output,{template,markdown:true}),/exist|overwrite/i);
    await assert.rejects(a.renderFiles(input,input,{template,force:true}),/input/i);
    await a.renderFiles(input,output,{template,force:true,markdown:true});
    assert.equal(JSON.parse(await readFile(input,'utf8')).version,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('collect pins PR metadata around diff and saves private untrusted evidence', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-collect-')), output=join(dir,'evidence'), calls=[];
  const meta={url:report().pr.url,number:2,title:'Renew',baseRefOid:'a'.repeat(40),headRefOid:'b'.repeat(40)};
  try {
    await a.collectEvidence(meta.url,output,{runGh:async args=>{calls.push(args); return args[0]==='api'?'d'.repeat(40):args[1]==='diff'?'diff --git a/x b/x':JSON.stringify(meta);}});
    const saved=JSON.parse(await readFile(join(output,'metadata.json'),'utf8'));
    assert.equal(saved.status,'raw-untrusted-evidence'); assert.equal(saved.before.headRefOid,meta.headRefOid);
    assert.equal(saved.diffBase,'d'.repeat(40)); assert.equal(calls.length,4); assert.ok(calls.every(x=>Array.isArray(x)));
    assert.equal((await stat(join(output,'diff.patch'))).mode & 0o777,0o600);
    assert.equal((await stat(output)).mode & 0o777,0o700);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('collect fails without writing evidence when PR moves or gh fails', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-move-')), output=join(dir,'evidence');
  let views=0; const meta={url:report().pr.url,number:2,baseRefOid:'a'.repeat(40),headRefOid:'b'.repeat(40)};
  try {
    await assert.rejects(a.collectEvidence(meta.url,output,{runGh:async args=>args[0]==='api'?'d'.repeat(40):args[1]==='diff'?'patch':JSON.stringify({...meta,headRefOid:++views===1?meta.headRefOid:'c'.repeat(40)})}),/mov|changed/i);
    await assert.rejects(stat(output),/ENOENT/);
    await assert.rejects(a.collectEvidence(meta.url,output,{runGh:async()=>{throw Error('gh failed');}}),/gh failed/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('CLI executes through a skill symlink and returns nonzero for invalid reports',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'explain-symlink-'));
  try {
    const link=join(dir,'skill-command.mjs'), input=join(dir,'bad.json');
    await symlink(fileURLToPath(new URL('../skills/explain-pr/scripts/explain-pr.mjs',import.meta.url)),link);
    await writeFile(input,'{}');
    const result=spawnSync(process.execPath,[link,'validate',input],{encoding:'utf8'});
    assert.equal(result.status,1); assert.match(result.stderr,/version/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('collect splits the patch per file with a coverage budget summary', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-split-')), output=join(dir,'evidence');
  const meta={url:report().pr.url,number:2,title:'Renew',baseRefOid:'a'.repeat(40),headRefOid:'b'.repeat(40)};
  const diff='diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1,2 @@\n-old\n+new\n+more\ndiff --git "a/dir/y z.ts" "b/dir/y z.ts"\n--- "a/dir/y z.ts"\n+++ "b/dir/y z.ts"\n@@ -1 +1 @@\n-q\n+r\n';
  try {
    const result=await a.collectEvidence(meta.url,output,{runGh:async args=>args[0]==='api'?'d'.repeat(40):args[1]==='diff'?diff:JSON.stringify(meta)});
    const files=JSON.parse(await readFile(join(output,'files.json'),'utf8'));
    assert.equal(files.fileCount,2); assert.equal(files.changedLines,5); assert.equal(files.overBudget,false); assert.equal(files.budget.changedLines,a.BUDGET.changedLines);
    assert.deepEqual(files.files.map(f=>[f.path,f.added,f.deleted,f.patch]),[['x.ts',2,1,'hunks/001.patch'],['dir/y z.ts',1,1,'hunks/002.patch']]);
    const hunk=await readFile(join(output,'hunks/001.patch'),'utf8'); assert.ok(hunk.startsWith('diff --git a/x.ts')); assert.ok(!hunk.includes('y z'));
    assert.equal((await stat(join(output,'hunks/002.patch'))).mode & 0o777,0o600);
    assert.equal(result.files.fileCount,2); assert.equal(JSON.parse(await readFile(join(output,'metadata.json'),'utf8')).evidence.files,'files.json');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('splitPatch flags over-budget PRs and tolerates empty diffs', () => {
  const a=requireApi(); assert.deepEqual(a.splitPatch(''),[]);
  const big='diff --git a/f b/f\n--- /dev/null\n+++ b/f\n@@ -0,0 +1,'+(a.BUDGET.changedLines+1)+' @@\n'+'+x\n'.repeat(a.BUDGET.changedLines+1);
  const parts=a.splitPatch(big); assert.equal(parts[0].added,a.BUDGET.changedLines+1); assert.equal(parts[0].deleted,0);
});
test('Markdown labels follow lang from the report or the render option; unknown lang is rejected', () => {
  const a=requireApi(), r=report();
  const ko=a.renderReport(r,template).markdown; assert.ok(ko.includes('근거 예시')); assert.ok(!ko.includes('Evidence (sample)'));
  const en=a.renderReport(r,template,{lang:'en'}).markdown; assert.ok(en.includes('Evidence (sample)')); assert.ok(en.includes('Behavior by condition')); assert.ok(!en.includes('근거'));
  r.lang='en'; assert.ok(a.renderReport(r,template).markdown.includes('Overall limitations'));
  r.lang='fr'; assert.throws(()=>a.validateReport(r),/lang/);
  assert.throws(()=>a.renderReport(report(),template,{lang:'de'}),/lang/);
});
test('CLI accepts --lang for render and rejects it for validate', async () => {
  const dir=await mkdtemp(join(tmpdir(),'explain-lang-')), script=fileURLToPath(new URL('../skills/explain-pr/scripts/explain-pr.mjs',import.meta.url));
  try {
    const input=join(dir,'r.json'); await writeFile(input,JSON.stringify(report()));
    const ok=spawnSync(process.execPath,[script,'demo',join(dir,'d.html'),'--lang','en','--md'],{encoding:'utf8'}); assert.equal(ok.status,0,ok.stderr);
    assert.ok((await readFile(join(dir,'d.md'),'utf8')).includes('Sample data'));
    const noMd=spawnSync(process.execPath,[script,'demo',join(dir,'e.html')],{encoding:'utf8'}); assert.equal(noMd.status,0,noMd.stderr);
    await assert.rejects(stat(join(dir,'e.md')),/ENOENT/); assert.ok(!('markdownPath' in JSON.parse(noMd.stdout)));
    const bad=spawnSync(process.execPath,[script,'validate',input,'--lang','en'],{encoding:'utf8'}); assert.equal(bad.status,1); assert.match(bad.stderr,/Usage/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('render returns a coverage summary the agent can compare with its triage plan', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-summary-'));
  try {
    const input=join(dir,'r.json'); const r=report(); r.flows[0].nodes[0].sources[0].excerpt='x'; r.flows.push({id:'skipped',title:'Skipped',status:'unread',entry:null,summary:'Not read',nodes:[],edges:[],findings:[],scenarios:[],limitations:['budget']});
    await writeFile(input,JSON.stringify(r));
    const {summary}=await a.renderFiles(input,join(dir,'o.html'),{template});
    assert.deepEqual(summary.coverage,{reviewed:0,partial:1,unread:1}); assert.equal(summary.nodes,1); assert.equal(summary.findings,1); assert.equal(summary.excerpts,1); assert.equal(summary.lang,'ko'); assert.equal(summary.flows[1].id,'skipped');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('render creates the output directory when it is missing', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-mkdir-'));
  try {
    const input=join(dir,'r.json'); await writeFile(input,JSON.stringify(report()));
    const out=await a.renderFiles(input,join(dir,'deep','er','report.html'),{template});
    assert.ok((await readFile(out.htmlPath,'utf8')).includes('Renewal'));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('render refuses a dangling symlink at an output path with a clear error and writes nothing', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-half-'));
  try {
    const input=join(dir,'r.json'); await writeFile(input,JSON.stringify(report()));
    await symlink(join(dir,'elsewhere.html'),join(dir,'o.html')); // dangling symlink at the output path
    await assert.rejects(a.renderFiles(input,join(dir,'o.html'),{template}),/symlink|regular file/i);
    await assert.rejects(readFile(join(dir,'o.html')),/ENOENT/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('collect metadata stays small: no file list, second view keeps only the tips', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-slim-')), output=join(dir,'evidence');
  const meta={url:report().pr.url,number:2,title:'Renew',body:'b',baseRefOid:'a'.repeat(40),headRefOid:'b'.repeat(40),updatedAt:'t',files:[{path:'x',additions:1,deletions:0}]};
  try {
    await a.collectEvidence(meta.url,output,{runGh:async args=>args[0]==='api'?'d'.repeat(40):args[1]==='diff'?'diff --git a/x b/x\n--- /dev/null\n+++ b/x\n@@ -0,0 +1 @@\n+1\n':JSON.stringify(meta)});
    const saved=JSON.parse(await readFile(join(output,'metadata.json'),'utf8'));
    assert.equal(saved.before.files,undefined); assert.deepEqual(Object.keys(saved.after).sort(),['baseRefOid','headRefOid','updatedAt']); assert.equal(saved.before.title,'Renew');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('the minimal example validates and stays small enough to read whole', async () => {
  const a=requireApi(), text=await readFile(new URL('../skills/explain-pr/examples/minimal.json',import.meta.url),'utf8');
  a.validateReport(JSON.parse(text)); assert.ok(text.length<3500,`minimal.json is ${text.length} chars (demo.json is ~15000)`);
});
test('splitPatch decodes Git quoted UTF-8 and escaped quote paths', () => {
  const diff=String.raw`diff --git "a/\353\241\234\354\247\201\".ts" "b/\353\241\234\354\247\201\".ts"`+'\n@@ -1 +1 @@\n-old\n+new\n';
  assert.equal(requireApi().splitPatch(diff)[0].path,'로직".ts');
});
test('splitPatch counts header-like content only inside hunks', () => {
  const diff='diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n--- deleted content\n+++ added content\n';
  const part=requireApi().splitPatch(diff)[0];
  assert.equal(part.added,1); assert.equal(part.deleted,1);
});
test('splitPatch resolves spaced paths from file, rename and mode-only headers', () => {
  const a=requireApi(), path='nested b/odd.txt';
  const header=`diff --git a/${path} b/${path}\n`;
  const bodies=[
    `--- a/${path}\t\n+++ b/${path}\t\n@@ -1 +1 @@\n-old\n+new\n`,
    `--- a/${path}\t\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n`,
    'old mode 100644\nnew mode 100755\n',
    'Binary files a/nested b/odd.txt and b/nested b/odd.txt differ\n'
  ];
  for(const body of bodies) assert.equal(a.splitPatch(header+body)[0].path,path,body);
  for(const kind of ['rename','copy']) {
    assert.equal(a.splitPatch(`diff --git a/old b/${path}\nsimilarity index 100%\n${kind} from old\n${kind} to ${path}\n`)[0].path,path);
  }
});
test('collect rejects incomplete or inconsistent patch evidence before writing', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-incomplete-'));
  const diff='diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n';
  const meta={url:report().pr.url,number:2,baseRefOid:'a'.repeat(40),headRefOid:'b'.repeat(40),changedFiles:1,additions:1,deletions:1,files:[{path:'x',additions:1,deletions:1}]};
  const cases=[['',meta],[diff,{...meta,changedFiles:2}],[diff,{...meta,additions:2}],[diff,{...meta,deletions:2}],[diff,{...meta,files:[{path:'other',additions:1,deletions:1}]}],[diff,{...meta,files:[{path:'x',additions:2,deletions:1}]}]];
  try {
    for(const [i,[patch,metadata]] of cases.entries()) {
      const output=join(dir,String(i));
      await assert.rejects(a.collectEvidence(meta.url,output,{runGh:async args=>args[0]==='api'?'d'.repeat(40):args[1]==='diff'?patch:JSON.stringify(metadata)}),/incomplete|inconsistent/i);
      await assert.rejects(stat(output),/ENOENT/);
    }
    const result=await a.collectEvidence(meta.url,join(dir,'valid'),{runGh:async args=>args[0]==='api'?'d'.repeat(40):args[1]==='diff'?diff:JSON.stringify(meta)});
    assert.equal(result.files.fileCount,1); assert.equal(result.files.changedLines,2);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('render uses the lite viewer by default and the 3D viewer with --3d', async () => {
  const a=requireApi(), dir=await mkdtemp(join(tmpdir(),'explain-lite-')), root=fileURLToPath(new URL('../skills/explain-pr/',import.meta.url));
  try {
    const full=await readFile(join(root,a.TEMPLATES.threeD),'utf8'), lite=await readFile(join(root,a.TEMPLATES.lite),'utf8');
    assert.ok(full.includes('WebGLRenderer')); assert.ok(!lite.includes('WebGLRenderer')); assert.ok(lite.length<full.length*0.4,`lite ${lite.length} vs full ${full.length}`);
    const input=join(dir,'r.json'); await writeFile(input,JSON.stringify(report()));
    const l=await a.renderFiles(input,join(dir,'lite.html')); assert.equal(l.viewer,'lite'); assert.ok(!(await readFile(l.htmlPath,'utf8')).includes('WebGLRenderer'));
    const t=await a.renderFiles(input,join(dir,'3d.html'),{threeD:true}); assert.equal(t.viewer,'3d'); assert.ok((await readFile(t.htmlPath,'utf8')).includes('WebGLRenderer'));
    const script=join(root,'scripts/explain-pr.mjs');
    const r=spawnSync(process.execPath,[script,'demo',join(dir,'d.html'),'--3d'],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr); assert.equal(JSON.parse(r.stdout).viewer,'3d');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('an explicit --lang reaches the embedded viewer data', () => {
  const a=requireApi(), out=a.renderReport(report(),template,{lang:'en'});
  assert.ok(out.html.includes('"lang":"en"')); assert.ok(!out.html.includes('"lang":"ko"'));
  assert.ok(a.renderReport(report(),template).html.includes('"lang":"ko"'));
});
test('validate-skill accepts the repository and reports broken frontmatter', async () => {
  const {validateSkill}=await import('../skills/explain-pr/scripts/validate-skill.mjs');
  const root=fileURLToPath(new URL('../skills/explain-pr/',import.meta.url));
  process.env.EXPLAIN_PR_SKIP_DIRNAME='1';
  assert.deepEqual(await validateSkill(root),[]);
  const dir=await mkdtemp(join(tmpdir(),'explain-skill-'));
  try {
    const {cp}=await import('node:fs/promises'); await cp(root,dir,{recursive:true,filter:p=>!p.includes('node_modules')&&!p.includes('.backups')});
    await writeFile(join(dir,'SKILL.md'),'---\nname: Bad_Name\ndescription: <b>x</b>\n---\nSee [x](references/missing.md)\n');
    const problems=await validateSkill(dir); assert.ok(problems.some(p=>/lowercase/.test(p))); assert.ok(problems.some(p=>/XML/.test(p))); assert.ok(problems.some(p=>/missing file/.test(p)));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('demo --lang en uses the English sample report', async () => {
  const dir=await mkdtemp(join(tmpdir(),'explain-demo-en-')), script=fileURLToPath(new URL('../skills/explain-pr/scripts/explain-pr.mjs',import.meta.url));
  try {
    const r=spawnSync(process.execPath,[script,'demo',join(dir,'en.html'),'--lang','en'],{encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
    const html=await readFile(join(dir,'en.html'),'utf8'); assert.ok(html.includes('Subscription renewal logic change')); assert.ok(!/"title":"[^"]*[\uac00-\ud7a3]/.test(html));
    const k=spawnSync(process.execPath,[script,'demo',join(dir,'ko.html')],{encoding:'utf8'}); assert.equal(k.status,0,k.stderr);
    assert.ok((await readFile(join(dir,'ko.html'),'utf8')).includes('\uad6c\ub3c5 \uac31\uc2e0 \ub85c\uc9c1 \ubcc0\uacbd'));
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('validate-skill rejects network primitives in shipped viewer or scripts', async () => {
  const {validateSkill}=await import('../skills/explain-pr/scripts/validate-skill.mjs');
  const root=fileURLToPath(new URL('../skills/explain-pr/',import.meta.url)), dir=await mkdtemp(join(tmpdir(),'explain-net-'));
  try {
    const {cp}=await import('node:fs/promises'); await cp(root,dir,{recursive:true});
    assert.deepEqual(await validateSkill(dir),[]);
    await writeFile(join(dir,'assets/viewer-lite.html'),(await readFile(join(dir,'assets/viewer-lite.html'),'utf8')).replace('</body>','<script>fetch("https://x")</script></body>'));
    const problems=await validateSkill(dir); assert.ok(problems.some(p=>/viewer-lite\.html contains network primitives \(fetch\(\)/.test(p)),JSON.stringify(problems));
  } finally {await rm(dir,{recursive:true,force:true});}
});

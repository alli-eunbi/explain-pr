import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderFiles} from '../scripts/explain-pr.mjs';

test('a frozen offline viewer renders distinct reports without a build or template mutation',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const template=join(root,'assets/viewer.html');
 const before=await readFile(template);
 // The shipped viewer is already compiled, not a request to generate a screen.
 assert.doesNotMatch(before.toString(),/<script[^>]+src\s*=/i);
 assert.doesNotMatch(before.toString(),/<link[^>]+href\s*=\s*["']https?:/i);
 const dir=await mkdtemp(join(tmpdir(),'explain-pr-reuse-'));
 try {
  const report=JSON.parse(await readFile(join(root,'examples/demo.json'),'utf8'));
  await writeFile(join(dir,'one.json'),JSON.stringify(report));
  const one=await renderFiles(join(dir,'one.json'),join(dir,'one.html'),{markdown:true});
  report.pr.title='두 번째 리포트 — 서로 다른 데이터';
  report.flows=report.flows.filter(f=>f.status==='unread');
  await writeFile(join(dir,'two.json'),JSON.stringify(report));
  const two=await renderFiles(join(dir,'two.json'),join(dir,'two.html'),{markdown:true});
  assert.match(await readFile(one.htmlPath,'utf8'),/구독 갱신 로직 변경/);
  assert.match(await readFile(two.htmlPath,'utf8'),/두 번째 리포트/);
  assert.notEqual(await readFile(one.markdownPath,'utf8'),await readFile(two.markdownPath,'utf8'));
  assert.equal(createHash('sha256').update(await readFile(template)).digest('hex'),createHash('sha256').update(before).digest('hex'));
 } finally {await rm(dir,{recursive:true,force:true});}
});

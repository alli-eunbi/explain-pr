#!/usr/bin/env node
// Repository-level checks that CI runs and contributors can run locally: SKILL.md frontmatter per the Agent Skills
// spec, reference links that resolve, example reports that validate, and viewer templates that match the source build.
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReport} from './explain-pr.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

export async function validateSkill(dir=root) {
  const problems=[]; // per call, so repeated validations never inherit earlier findings
  const check=(ok,message)=>{if(!ok) problems.push(message);};
  const text=(await readFile(join(dir,'SKILL.md'),'utf8')).replace(/\r\n/g,'\n'); // tolerate CRLF checkouts
  const fm=text.match(/^---\n([\s\S]*?)\n---\n/);
  check(fm,'SKILL.md must start with YAML frontmatter');
  if(fm) {
    const fields=Object.fromEntries(fm[1].split('\n').map(line=>{const at=line.indexOf(':'); return at<0?[line.trim(),'']:[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
    const name=fields.name??'';
    check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)&&name.length<=64,'frontmatter name must be 1-64 lowercase letters, digits and single hyphens');
    check(name===basename(dir)||process.env.EXPLAIN_PR_SKIP_DIRNAME,'frontmatter name should match the directory name (set EXPLAIN_PR_SKIP_DIRNAME=1 outside an installed location)');
    const description=fields.description??'';
    check(description.length>=1&&description.length<=1024,'frontmatter description must be 1-1024 characters');
    check(!/<[a-z/][^>]*>/i.test(description)&&!/<[a-z/][^>]*>/i.test(name),'frontmatter must not contain XML tags');
    const body=text.slice(fm[0].length);
    check(body.split('\n').length<=500,'SKILL.md body should stay under 500 lines');
    for(const [,target] of body.matchAll(/\]\(((?:references|examples|scripts|assets)\/[^)#]+)\)/g)) {
      try {await stat(join(dir,target));} catch {problems.push(`SKILL.md links to a missing file: ${target}`);}
    }
  }
  for(const example of ['examples/demo.json','examples/demo.en.json','examples/minimal.json']) {
    try {const report=JSON.parse(await readFile(join(dir,example),'utf8')); validateReport(report); check(report.sample===true,`${example} must be marked sample:true`);}
    catch(error) {problems.push(`${example}: ${error.message}`);}
  }
  for(const template of ['assets/viewer.html','assets/viewer-lite.html']) {
    try {
      const html=await readFile(join(dir,template),'utf8');
      for(const token of ['__EXPLAIN_PR_DATA__','__EXPLAIN_PR_MARKDOWN__']) check(html.split(token).length===2,`${template} must contain exactly one ${token}`);
      check(!/<script[^>]+src\s*=/i.test(html)&&!/<link[^>]+href\s*=\s*["']https?:/i.test(html),`${template} must not load external resources`);
    } catch(error) {problems.push(`${template}: ${error.message}`);}
  }
  // The skill is offline by design: the viewer never talks to the network and the scripts reach GitHub only
  // through the user's own `gh` and `git`. Any network primitive appearing in shipped code is a red flag.
  const networkMarkers=['fetch(','XMLHttpRequest','WebSocket','sendBeacon','EventSource','node:http','node:https','node:net','node:dns','node:tls',"require('http","require('https"];
  const {readdir}=await import('node:fs/promises');
  const shipped=[...(await readdir(join(dir,'scripts'))).filter(f=>f.endsWith('.mjs')&&f!=='validate-skill.mjs').map(f=>'scripts/'+f),'assets/viewer.html','assets/viewer-lite.html'];
  for(const file of shipped) {
    let text; try {text=await readFile(join(dir,file),'utf8');} catch {continue;}
    const hits=networkMarkers.filter(m=>text.includes(m));
    if(hits.length) problems.push(`${file} contains network primitives (${hits.join(', ')}); shipped code must stay offline`);
  }
  return problems;
}

const invoked=process.argv[1]?await import('node:fs/promises').then(fs=>fs.realpath(process.argv[1])).catch(()=>null):null;
if(invoked===fileURLToPath(import.meta.url)) {
  const found=await validateSkill(process.argv[2]?resolve(process.argv[2]):root);
  if(found.length) {console.error('validate-skill: '+found.length+' problem(s)'); for(const p of found) console.error(' - '+p); process.exitCode=1;}
  else console.log('validate-skill: SKILL.md frontmatter, links, examples and viewer templates are consistent.');
}

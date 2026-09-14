#!/usr/bin/env node
// Load a rendered report in headless Chrome and check what the viewer actually produced (DOM after scripts ran).
// Used by CI on real Chrome; no npm dependencies. Usage:
//   node scripts/check-rendered.mjs report.html [--chrome PATH] [--lang ko|en] [--3d yes|no] [--screenshot out.png]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const run=promisify(execFile);
const CANDIDATES=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','google-chrome','google-chrome-stable','chromium','chromium-browser','chrome'];

function parseArgs(argv) {
  const options={file:null,chrome:process.env.EXPLAIN_PR_CHROME||null,lang:null,threeD:null,screenshot:null};
  for(let i=0;i<argv.length;i++) {
    const a=argv[i];
    if(a==='--chrome') options.chrome=argv[++i];
    else if(a==='--lang') options.lang=argv[++i];
    else if(a==='--3d') options.threeD=argv[++i];
    else if(a==='--screenshot') options.screenshot=argv[++i];
    else if(!options.file) options.file=a;
    else throw new Error(`unexpected argument ${a}`);
  }
  if(!options.file) throw new Error('Usage: check-rendered.mjs report.html [--chrome PATH] [--lang ko|en] [--3d yes|no] [--screenshot out.png]');
  return options;
}

async function chromeBinary(preferred) {
  for(const candidate of [preferred,...CANDIDATES].filter(Boolean)) {
    try {await run(candidate,['--version'],{timeout:15000}); return candidate;} catch {}
  }
  throw new Error('no Chrome/Chromium binary found; pass --chrome PATH or set EXPLAIN_PR_CHROME');
}

const FLAGS=['--headless=new','--disable-gpu','--hide-scrollbars','--window-size=1440,900','--virtual-time-budget=6000',...(process.env.EXPLAIN_PR_CHROME_NO_SANDBOX?['--no-sandbox']:[])];

export async function checkRendered(file,{chrome,lang,threeD,screenshot}={}) {
  const binary=await chromeBinary(chrome), url=pathToFileURL(resolve(file)).href;
  const {stdout:dom}=await run(binary,[...FLAGS,'--dump-dom',url],{maxBuffer:64*1024*1024,timeout:120000});
  const problems=[];
  const htmlLang=dom.match(/<html[^>]*\blang="([^"]*)"/)?.[1]??null;
  const followHidden=/<button[^>]*id="followMode"[^>]*\bhidden(?:=""|\s|>)/.test(dom);
  const flowchartNodes=(dom.match(/class="[^"]*\bflowchart-card\b/g)||[]).length;
  const flowButtons=(dom.match(/class="[^"]*\bflow-button\b/g)||[]).length;
  const tokensLeft=['__EXPLAIN_PR_DATA__','__EXPLAIN_PR_MARKDOWN__','__EXPLAIN_PR_BUNDLE__'].filter(t=>dom.includes(t));
  const sidebarHeading=dom.match(/<h2[^>]*data-i18n="ui.flows"[^>]*>([^<]*)<\/h2>/)?.[1]??null;
  if(!flowButtons) problems.push('no flow buttons rendered (viewer script did not run?)');
  if(!flowchartNodes) problems.push('no flowchart nodes rendered');
  if(tokensLeft.length) problems.push(`template tokens left unreplaced: ${tokensLeft.join(', ')}`);
  if(lang&&htmlLang!==lang) problems.push(`expected <html lang="${lang}">, got ${JSON.stringify(htmlLang)}`);
  if(lang==='en'&&sidebarHeading!=='Service flows') problems.push(`English UI not applied (sidebar heading ${JSON.stringify(sidebarHeading)})`);
  if(lang==='ko'&&sidebarHeading!=='서비스 흐름') problems.push(`Korean UI not applied (sidebar heading ${JSON.stringify(sidebarHeading)})`);
  if(threeD==='yes'&&followHidden) problems.push('3D mode button is hidden in a --3d render');
  if(threeD==='no'&&!followHidden) problems.push('3D mode button is visible in a lite render');
  if(screenshot) await run(binary,[...FLAGS,`--screenshot=${resolve(screenshot)}`,url],{timeout:120000});
  return {file,chrome:binary,htmlLang,followHidden,flowButtons,flowchartNodes,sidebarHeading,screenshot:screenshot?resolve(screenshot):null,problems};
}

const invoked=process.argv[1]?await import('node:fs/promises').then(fs=>fs.realpath(process.argv[1])).catch(()=>null):null;
if(invoked===fileURLToPath(import.meta.url)) {
  try {
    const options=parseArgs(process.argv.slice(2));
    const result=await checkRendered(options.file,options);
    console.log(JSON.stringify(result,null,2));
    if(result.problems.length) process.exitCode=1;
  } catch(error) {console.error(`check-rendered: ${error.message}`); process.exitCode=1;}
}

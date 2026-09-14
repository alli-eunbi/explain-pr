#!/usr/bin/env node
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateReport,parsePrUrl} from './explain-pr.mjs';

import {runCommand,readPinnedFile,decodeText,splitLines} from './pinned-source.mjs';
const note='Source files, line ranges and excerpt presence only; semantic support not verified. Business claims and PR completeness require agent review.';
// Classify a fetch failure without echoing the command output (it may contain paths or partial content).
export function categorize(error) {
  const text=`${error?.message??''} ${error?.stderr??''}`;
  if(/\b(401|403)\b|auth|log ?in|token|permission|forbidden|not authorized/i.test(text)) return 'auth';
  if(/\b404\b|not found|does not exist|exists on disk, but not in|bad object|invalid object name|no such/i.test(text)) return 'missing';
  if(/not a file|not supported file content|invalid base64/i.test(text)) return 'unsupported';
  return 'unavailable';
}
const normalize=s=>String(s).replace(/\s+/g,' ').trim();
// Redaction markers an author may use to elide a secret or a long span inside an excerpt.
const REDACTION=/…|\.\.\.|\[redacted\]|\[REDACTED\]|\*\*\*/;
export function excerptMatches(excerpt,rangeText) {
  const haystack=normalize(rangeText); let cursor=0;
  for(const piece of excerpt.split(REDACTION).map(normalize).filter(Boolean)) {const at=haystack.indexOf(piece,cursor); if(at<0) return false; cursor=at+piece.length;}
  return true;
}
export async function verifySources(report,{repo,run=runCommand}={}) {
  validateReport(report);
  const receipt={status:'passed',checkedFiles:0,checkedRanges:0,checkedExcerpts:0,note,files:[],errors:[]};
  if(report.sample) return {...receipt,status:'not-applicable',note:'Sample report: fictional sources are not verification targets. '+note};
  const groups=new Map();
  for(const flow of report.flows) for(const section of ['nodes','edges','findings','scenarios']) for(const item of flow[section]) for(const source of item.sources) {
    const key=JSON.stringify([source.side,source.path]);
    if(!groups.has(key)) groups.set(key,{side:source.side,path:source.path,ranges:[]});
    groups.get(key).ranges.push({start:source.start,end:source.end,excerpt:source.excerpt});
  }
  const {host,repo:remoteRepo}=parsePrUrl(report.pr.url);
  for(const group of groups.values()) {
    const sha=report.pr[group.side]; let contents;
    try {contents=await readPinnedFile({repo,host,remoteRepo,sha,path:group.path,run});}
    catch(error) {
      const category=categorize(error);
      const hint={auth:'Not authorized to read this source: check `gh auth status` and repository access for the pinned SHA.',missing:'No file at this path for the pinned SHA: check side (base/head), rename, or the SHA itself.',unsupported:'Path is a directory, symlink, or large-file encoding that cannot be read as text.',unavailable:'Source unavailable; command diagnostics suppressed.'}[category];
      receipt.errors.push({side:group.side,path:group.path,category,reason:hint}); continue;
    }
    let text;
    try {text=decodeText(contents);} catch {
      receipt.errors.push({side:group.side,path:group.path,category:'binary',reason:'Binary or non-UTF-8 source; line references cannot be verified.'}); continue;
    }
    const lineList=splitLines(text), lines=lineList.length;
    receipt.checkedFiles++;
    receipt.files.push({side:group.side,path:group.path,sha,lines});
    for(const {excerpt,...range} of group.ranges) {
      receipt.checkedRanges++;
      if(range.end>lines) {receipt.errors.push({side:group.side,path:group.path,...range,category:'range',reason:`Range exceeds ${lines} source lines.`}); continue;}
      if(excerpt===undefined) continue;
      receipt.checkedExcerpts++;
      if(!excerptMatches(excerpt,lineList.slice(range.start-1,range.end).join('\n'))) receipt.errors.push({side:group.side,path:group.path,...range,category:'excerpt',reason:'Excerpt not found inside the cited range (compared after whitespace normalization; … or [redacted] may elide text). Fix the range or the excerpt.'});
    }
  }
  if(receipt.errors.length) receipt.status='failed';
  return receipt;
}
async function main(args) {
  if(args.length!==1 && !(args.length===3&&args[1]==='--repo')) throw Error('Usage: verify-sources.mjs report.json [--repo PATH]');
  let report;
  try {report=JSON.parse(await readFile(args[0],'utf8'));} catch {throw Error('Cannot read report JSON; source contents are never printed.');}
  const receipt=await verifySources(report,{repo:args[2]});
  console.log(JSON.stringify(receipt,null,2));
  process.exitCode=receipt.status==='not-applicable'?2:receipt.status==='failed'?1:0;
}
const invokedPath=process.argv[1]?await realpath(process.argv[1]).catch(()=>null):null;
if(invokedPath===fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error=>{
  console.error(`verify-sources: ${error.message}`);process.exitCode=1;
});

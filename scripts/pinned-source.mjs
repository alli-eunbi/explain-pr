// Read one file at a pinned commit, from a local clone (git show) or through gh's contents API.
// Shared by verify-sources.mjs (bounds/excerpt checks) and `explain-pr.mjs source` (numbered range reads).
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);
export async function runCommand(command,args) {
  const result=await execute(command,args,{encoding:'buffer',maxBuffer:32*1024*1024,timeout:60000,env:{...process.env,GH_PROMPT_DISABLED:'1'}});
  return result.stdout;
}
// Returns a Buffer. Throws 'not a file' / 'not supported file content' / 'invalid base64' or the underlying command error.
export async function readPinnedFile({repo,host,remoteRepo,sha,path,run=runCommand}) {
  if(repo) {
    const type=await run('git',['-C',repo,'cat-file','-t',`${sha}:${path}`]);
    if(type.toString().trim()!=='blob') throw Error('not a file');
    // A symlink is also a blob; ls-tree exposes its 120000 mode. Keep local and remote (type:'symlink') verdicts the same.
    const entry=await run('git',['-C',repo,'ls-tree',sha,'--',path]);
    if(/^120000 /.test(entry.toString())) throw Error('not a file (symlink)');
    return run('git',['-C',repo,'show',`${sha}:${path}`]);
  }
  const encoded=path.split('/').map(segment=>encodeURIComponent(segment)).join('/');
  const response=await run('gh',['api','--hostname',host,`repos/${remoteRepo}/contents/${encoded}?ref=${sha}`,'--method','GET','-H','Accept: application/vnd.github+json']);
  const metadata=JSON.parse(response.toString('utf8'));
  if(!metadata || Array.isArray(metadata) || metadata.type!=='file' || metadata.encoding!=='base64' || typeof metadata.content!=='string') throw Error('not supported file content');
  const encodedContent=metadata.content.replace(/\r?\n/g,'');
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedContent)) throw Error('invalid base64');
  return Buffer.from(encodedContent,'base64');
}
// Decode as text; throws 'binary' for non-UTF-8 or control-character content.
export function decodeText(contents) {
  const text=new TextDecoder('utf-8',{fatal:true}).decode(contents);
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw Error('binary');
  return text;
}
export function splitLines(text) {const lines=text.split('\n'); if(text.endsWith('\n')) lines.pop(); return text.length?lines:[];}

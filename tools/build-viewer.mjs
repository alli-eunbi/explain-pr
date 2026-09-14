import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const skill=resolve(root,'skills/explain-pr');
const shell=await readFile(resolve(root,'src/shell.html'),'utf8');
for(const token of ['__EXPLAIN_PR_DATA__','__EXPLAIN_PR_MARKDOWN__','__EXPLAIN_PR_BUNDLE__']) {
  if(shell.split(token).length!==2)throw new Error(`Expected exactly one ${token}`);
}
// Two templates from one source: the full viewer (flowchart + 3D, bundles three.js) and a lite viewer
// (flowchart only) that swaps scene.js for a stub so readers who did not ask for 3D get a much smaller file.
const stubScene={name:'stub-scene',setup(b){b.onResolve({filter:/\/scene\.js$/},()=>({path:resolve(root,'src/scene-stub.js')}));}};
const out={};
for(const [name,plugins] of [['viewer.html',[]],['viewer-lite.html',[stubScene]]]) {
  const result=await build({
    entryPoints:[resolve(root,'src/app.js')],bundle:true,write:false,plugins,
    format:'iife',platform:'browser',target:['chrome110','safari16'],
    minify:true,legalComments:'inline',charset:'utf8',
  });
  const bundle=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const html=shell.replace('__EXPLAIN_PR_BUNDLE__',()=>bundle);
  await writeFile(resolve(skill,'assets',name),html);
  out[name]={bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')};
}
console.log(JSON.stringify({templates:out,runtime:'bundled offline; rebuilding is only for viewer development'},null,2));

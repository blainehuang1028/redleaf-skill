import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import http from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(new URL('../skills/redleaf/package.json',import.meta.url));
const {chromium}=require('playwright');
const destination=path.resolve(process.argv[2]||await fs.mkdtemp(path.join(os.tmpdir(),'redleaf-regression-')));
await fs.mkdir(destination,{recursive:true});
function run(args,{ok=true}={}){return new Promise((resolve,reject)=>{let log='';const p=spawn(process.execPath,args,{cwd:root,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);p.on('error',reject);p.on('close',code=>{if(ok&&code!==0)reject(new Error(log));else resolve({code,log});});});}
const render=async(name,file,args=[])=>{const out=path.join(destination,name);await run(['skills/redleaf/scripts/render.mjs',file,'--out',out,...args]);console.log(`PASS render ${name}`);return out;};
process.stdout.write((await run(['tests/long-image-boundaries.mjs'])).log);
const cases=[];
for(const theme of ['zhusha','canglan','canglv','zheshi','tenghuang'])cases.push(await render(`showcase-${theme}`,'tests/fixtures/showcase.md',['--theme',theme,'--cover-highlight','意有光']));
for(const [name,file,args] of [
 ['article','skills/redleaf/examples/article.md',[]],['rich','tests/fixtures/rich.md',[]],
 ['photo','tests/fixtures/photo.md',['--theme','canglv','--cover-image','lake.jpg']],
 ['long-image','tests/fixtures/long-image.md',['--theme','canglan','--no-cover']],
 ['nested','tests/fixtures/nested.md',['--no-cover']],
 ['linked-image','tests/fixtures/linked-image.md',['--no-cover']],
 ['image-heading','tests/fixtures/image-heading.md',['--no-cover']]
])cases.push(await render(name,file,args));
const checks=await run(['tests/verify.mjs',...cases]);process.stdout.write(checks.log);
const empty=path.join(destination,'empty.md');await fs.writeFile(empty,' \n\t\n');const rejected=await run(['skills/redleaf/scripts/render.mjs',empty,'--out',path.join(destination,'empty')],{ok:false});assert.notEqual(rejected.code,0);assert.match(rejected.log,/原稿为空/);
console.log('PASS empty source is rejected');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto(pathToFileURL(path.join(destination,'nested/document.html')).href);
 const lists=await page.evaluate(()=>[...document.querySelectorAll('ol ol > li')].map(li=>({text:li.textContent.trim(),value:li.getAttribute('value'),hidden:li.style.listStyleType==='none'})));
 assert(lists.length>=24);for(const li of lists){assert(li.text);const match=li.text.match(/^项目(\d+)：/);if(match&&!li.hidden)assert.equal(Number(li.value),Number(match[1]));else assert(li.hidden,'continuation hides duplicate marker');}
 await page.goto(pathToFileURL(path.join(destination,'image-heading/document.html')).href);
 assert(await page.evaluate(()=>{const heading=[...document.querySelectorAll('h2')].find(h=>h.textContent==='湖边的倒影');return Boolean(heading?.closest('.page').querySelector('img'));}));
 await page.goto(pathToFileURL(path.join(destination,'linked-image/document.html')).href);
 assert(await page.evaluate(()=>[...document.querySelectorAll('.image-slice img')].every(img=>img.closest('a')?.href==='https://example.com/guide')));
 console.log('PASS nested numbers, linked slices, heading with image');
 await page.goto(pathToFileURL(path.join(destination,'long-image/document.html')).href);
 const sliceQa=JSON.parse(await fs.readFile(path.join(destination,'long-image/qa.json'),'utf8'));
 const cutInk=await page.evaluate(async ({slices,dataUrl})=>{
  const img=new Image();img.src=dataUrl;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const bg=ctx.getImageData(0,0,1,1).data;
  return slices.slice(1).map(slice=>{
   const y=Math.round(slice.offset/slice.totalHeight*canvas.height),row=ctx.getImageData(0,y,canvas.width,1).data;
   let ink=0;for(let x=0;x<canvas.width;x++)if(Math.max(Math.abs(row[x*4]-bg[0]),Math.abs(row[x*4+1]-bg[1]),Math.abs(row[x*4+2]-bg[2]))>60)ink++;
   return ink/canvas.width;
  });
 },{slices:sliceQa.imageSlices,dataUrl:'data:image/png;base64,'+(await fs.readFile('tests/fixtures/guide-long.png')).toString('base64')});
 assert(cutInk.length>0);assert(cutInk.every(ratio=>ratio<.005),'cuts must cross blank rows in the original screenshot');
 console.log('PASS original screenshot cut rows contain no text');
 const solidUrl=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=600;const x=c.getContext('2d');x.fillStyle='#c04040';x.fillRect(0,0,100,600);return c.toDataURL();});
 const solidSource=path.join(destination,'solid-image.md');await fs.writeFile(solidSource,`![solid image](${solidUrl})`);
 const solidOut=await render('solid-image',solidSource,['--no-cover']);
 const solidQa=JSON.parse(await fs.readFile(path.join(solidOut,'qa.json'),'utf8'));
 assert(solidQa.passed);assert.equal(solidQa.imageSlices.length,1);assert.equal(solidQa.imageSlices[0].mode,'intact');
 assert(solidQa.warnings.some(w=>w.includes('完整缩放')));
 console.log('PASS unsplittable image stays intact with readability warning');
}finally{await browser.close();}
for(const name of ['long-image','linked-image']){
 const qa=JSON.parse(await fs.readFile(path.join(destination,name,'qa.json'),'utf8'));assert(qa.imageSlices.length>1);let offset=0;
 for(const slice of qa.imageSlices){assert(Math.abs(slice.offset-offset)<.01);offset+=slice.height;}assert(Math.abs(offset-qa.imageSlices[0].totalHeight)<.01);
}
console.log('PASS image slices cover original continuously');
// Isolated font-installer race with a valid fixed hash and synchronized responses.
const sandbox=await fs.mkdtemp(path.join(os.tmpdir(),'redleaf-font-test-'));await fs.mkdir(path.join(sandbox,'scripts'));await fs.mkdir(path.join(sandbox,'assets'));
await fs.copyFile(path.join(root,'skills/redleaf/scripts/fonts.mjs'),path.join(sandbox,'scripts/fonts.mjs'));
const bytes=Buffer.alloc(1024*1024,17),waiting=[];
const server=http.createServer((req,res)=>{waiting.push(res);if(waiting.length===2)for(const response of waiting)response.end(bytes);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 await fs.writeFile(path.join(sandbox,'assets/fonts-manifest.json'),JSON.stringify([{file:'fixture.bin',url:`http://127.0.0.1:${server.address().port}/font`,sha256:createHash('sha256').update(bytes).digest('hex')}]));
 await Promise.all([run([path.join(sandbox,'scripts/fonts.mjs')]),run([path.join(sandbox,'scripts/fonts.mjs')])]);
 assert.deepEqual(await fs.readFile(path.join(sandbox,'assets/fonts/fixture.bin')),bytes);assert.deepEqual(await fs.readdir(path.join(sandbox,'assets/fonts')),['fixture.bin']);
}finally{await new Promise(r=>server.close(r));}
console.log('PASS concurrent font installation');
console.log(`Verified outputs: ${destination}`);

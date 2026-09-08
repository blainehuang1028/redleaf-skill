// Example-specific editorial composition after the standard Redleaf export.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../skills/redleaf/package.json',import.meta.url));
const {chromium}=require('playwright');
const dir=path.resolve(process.argv[2]);
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(dir,'document.html')).href);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{
  const pages=[...document.querySelectorAll('#pages>.page')];
  if(pages.length!==11)throw Error('Expected the eleven-page Kyoto intermediate export');
  const text=()=>[...document.querySelectorAll('#pages .content')].map(c=>c.textContent.replace(/\s/g,'')).join('');
  const before=text();
  const groups=[[0],[1],[2,3],[4,5],[6,7],[8],[9,10]];
  groups.forEach((g,i)=>{const target=pages[g[0]],content=target.querySelector('.content');
   for(const index of g.slice(1)){content.append(...pages[index].querySelector('.content').childNodes);pages[index].remove();}
   if(i>=2&&i<=4){content.style.cssText='font-size:34px;line-height:1.75;padding-top:100px';content.querySelectorAll('img').forEach(img=>{img.style.cssText='height:410px;width:auto;max-width:100%;object-fit:contain';});content.querySelectorAll('blockquote').forEach(q=>q.style.cssText='font-size:38px;line-height:1.6;padding:0 0 0 24px;margin-bottom:28px');}
   if(i===1){content.style.cssText='padding-top:260px;font-size:40px;line-height:1.95';}
   if(i===6){content.style.cssText='padding-top:130px;font-size:36px;line-height:1.9';}
   target.id=`page-${i+1}`;target.querySelector('footer span:last-child').textContent=`${String(i+1).padStart(2,'0')} / 07`;
  });
  if(text()!==before)throw Error('Text changed during composition');
  const geometry=[...document.querySelectorAll('#pages>.page')].map((p,i)=>{const r=p.getBoundingClientRect(),c=p.querySelector('.content');return {page:i+1,width:r.width,height:r.height,contentBottom:Math.max(...[...c.children].map(x=>x.getBoundingClientRect().bottom-r.top)),footerTop:p.querySelector('footer').getBoundingClientRect().top-r.top,overflow:c.scrollWidth>c.clientWidth+1};});
  if(geometry.some(x=>x.contentBottom>1280.5||x.overflow))throw Error(JSON.stringify(geometry));
  return {textPreserved:true,geometry,pages:7};
 });
 await page.evaluate(()=>window.paintRedleaf());
 for(let i=0;i<7;i++)await page.locator('#pages>.page').nth(i).screenshot({path:path.join(dir,`${String(i+1).padStart(2,'0')}.png`)});
 for(let i=8;i<=11;i++)await fs.rm(path.join(dir,`${String(i).padStart(2,'0')}.png`));
 await fs.writeFile(path.join(dir,'document.html'),await page.content());
 for(const filename of ['qa.json','manifest.json']){const file=path.join(dir,filename),data=JSON.parse(await fs.readFile(file,'utf8'));data.pages=7;if(filename==='qa.json'){data.geometry=result.geometry;data.editorialComposition={textPreserved:true,script:'scripts/refine-kyoto-layout.mjs'};}await fs.writeFile(file,JSON.stringify(data,null,2));}
 let index=await fs.readFile(path.join(dir,'index.html'),'utf8');index=index.replace('11 页','7 页').replace(/<figure><a href="(?:08|09|10|11)\.png">.*?<\/figure>/g,'').replaceAll(' / 11',' / 07');await fs.writeFile(path.join(dir,'index.html'),index);
 console.log(result);
}finally{await browser.close();}

// Editorial cover line breaks; all source characters are preserved.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../skills/redleaf/package.json',import.meta.url));
const {chromium}=require('playwright');
const dir=path.resolve(process.argv[2]);
const file=path.join(dir,'document.html');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 await page.goto(pathToFileURL(file).href);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{
  const cover=document.querySelector('#pages>.page'),heading=cover.querySelector('h1'),tags=cover.querySelector('h1+p');
  const original=heading.textContent;const lines=['京都的另一面：','不在清水寺，在这 ','3 处避世「枯山水」'];
  if(lines.join('')!==original)throw new Error('Cover title differs from the supplied source');
  heading.replaceChildren(...lines.map((text,i)=>{const span=document.createElement('span');span.textContent=text;span.style.display='block';return span;}));
  if(!tags?.textContent.startsWith('#人文旅行'))throw new Error('Expected cover hashtags');
  tags.style.cssText='font-size:30px;line-height:1.8;color:var(--muted);letter-spacing:0';
  tags.innerHTML=tags.textContent.replace(' #东方美学','<br>#东方美学');
  const c=cover.querySelector('.content'),r=cover.getBoundingClientRect();
  const bottom=Math.max(...[...c.children].map(x=>x.getBoundingClientRect().bottom-r.top));
  if(bottom>1280||c.scrollWidth>c.clientWidth+1)throw new Error('Cover overflow');
  return {titlePreserved:true,contentBottom:bottom};
 });
 await page.locator('#pages>.page').first().screenshot({path:path.join(dir,'01.png'),animations:'disabled'});
 await fs.writeFile(file,await page.content());
 await fs.writeFile(path.join(dir,'cover-qa.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}

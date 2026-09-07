#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import YAML from 'yaml';
import {markdown,imageAsset,hash,escape} from './lib/markdown.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
const {values,positionals}=parseArgs({allowPositionals:true,options:{out:{type:'string'},theme:{type:'string'},config:{type:'string'},'no-cover':{type:'boolean'},'cover-highlight':{type:'string'},'cover-image':{type:'string'},help:{type:'boolean'}}});
if(values.help||!positionals.length){console.log('node scripts/render.mjs article.md --out output/new-folder [--theme zhusha|canglan|canglv|zheshi|tenghuang] [--config settings.yml] [--cover-highlight 原题片段] [--no-cover]');process.exit(values.help?0:1);}
if(positionals.length!==1)throw new Error('只接受一个 Markdown 文件。');
const input=path.resolve(positionals[0]);
const source=await fs.readFile(input,'utf8');
if(!source.trim())throw new Error('原稿为空，请提供 Markdown 内容。');
const settings=values.config?YAML.parse(await fs.readFile(path.resolve(values.config),'utf8'))||{}:{};
const allowed=new Set(['theme','cover','coverHighlight','author','assetMap','coverImage','pageStyles']);
for(const key of Object.keys(settings))if(!allowed.has(key))throw new Error(`未知配置项：${key}`);
if(settings.cover!==undefined&&typeof settings.cover!=='boolean')throw new Error('cover 必须是布尔值。');
for(const key of ['theme','coverHighlight','author','coverImage'])if(settings[key]!==undefined&&typeof settings[key]!=='string')throw new Error(`${key} 必须是字符串。`);
const tokens=JSON.parse(await fs.readFile(path.join(base,'assets/tokens.json'),'utf8'));
const config={theme:'zhusha',cover:true,author:'',...settings,...(values.theme?{theme:values.theme}:{}),...(values['no-cover']?{cover:false}:{}),...(values['cover-highlight']?{coverHighlight:values['cover-highlight']}:{})};
config.layout=tokens.layout;
if(settings.pageStyles){for(const [n,style] of Object.entries(settings.pageStyles)){if(!/^[1-9][0-9]*$/.test(n)||!style||typeof style!=='object')throw new Error('pageStyles 需要页码和样式对象。');for(const [key,value] of Object.entries(style)){if(!['markScale','markLift'].includes(key)||typeof value!=='number'||!Number.isFinite(value)||(key==='markScale'&&value<=0))throw new Error('pageStyles 只接受数值 markScale / markLift，markScale 必须大于零。');}}}
if(!tokens.themes[config.theme])throw new Error(`未知主题：${config.theme}`);
for(const name of ['serif.otf','sans.otf','sans-bold.otf','mono.ttf'])try{await fs.access(path.join(base,'assets/fonts',name));}catch{throw new Error('缺少字体；请在 skill 目录运行 npm run fonts。');}
if(values['cover-image'])config.coverImage=values['cover-image'];
const out=path.resolve(values.out||`redleaf-${new Date().toISOString().replace(/[:.]/g,'-')}`);
try{await fs.mkdir(out,{recursive:false});}catch(e){if(e.code==='EEXIST')throw new Error('输出目录已存在；请使用新的目录，保留上一次交付。');throw e;}
let browser,server;
try{
 await fs.cp(path.join(base,'assets'),path.join(out,'assets'),{recursive:true});
 await fs.cp(path.join(base,'licenses'),path.join(out,'licenses'),{recursive:true});
 await fs.writeFile(path.join(out,'source.md'),source);
 const parsed=await markdown(source,input,out,settings.assetMap||{},values.config?path.dirname(path.resolve(values.config)):path.dirname(input));config.title=parsed.title;
 if(config.coverImage){const asset=await imageAsset(config.coverImage,input,out,settings.assetMap||{},values.config?path.dirname(path.resolve(values.config)):path.dirname(input));config.coverAsset=asset.target;parsed.images.push({...asset,role:'cover'});}
 const main=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escape(parsed.title||'红笺')}</title><link rel="stylesheet" href="assets/redleaf.css"><style>#source{position:absolute;left:-20000px;top:0;width:880px;visibility:hidden}#pages{width:1080px}.page{margin-bottom:24px}</style><div id="source">${parsed.html}</div><main id="pages"></main><script src="assets/material.js"></script><script src="assets/paginate.js"></script></html>`;
 await fs.writeFile(path.join(out,'document.html'),main);
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.otf':'font/otf'};
 server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const name=decodeURIComponent(url.pathname).replace(/^\//,'');const file=path.resolve(out,name||'index.html');if(!file.startsWith(out+path.sep)){res.writeHead(403);return res.end();}const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{browser=await chromium.launch({headless:true});}catch(e){throw new Error(`Chromium 启动失败；请在 skill 目录运行 npx playwright install chromium。\n${e.message}`);}
 const page=await browser.newPage({viewport:{width:1080,height:1440},deviceScaleFactor:1});
 await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/document.html',{waitUntil:'load'});
 await page.evaluate(()=>window.ready);
 const qa=await page.evaluate(config=>window.paginateRedleaf(config),config);
 const pages=page.locator('#pages > .page');
 for(let i=0;i<qa.pages;i++){const filename=`${String(i+1).padStart(2,'0')}.png`;await pages.nth(i).screenshot({path:path.join(out,filename),animations:'disabled'});}
 const rendered=await page.evaluate(()=>{
  // Repaint canvas when opening the saved HTML; remove runtime-only source paginator.
  document.querySelector('script[src="assets/paginate.js"]')?.remove();
  document.querySelectorAll('.pigment').forEach(c=>c.remove());
  document.querySelectorAll('.paper').forEach(c=>delete c.dataset.painted);
  return '<!doctype html>\n'+document.documentElement.outerHTML;
 });
 await fs.writeFile(path.join(out,'document.html'),rendered);
 const imageTiles=Array.from({length:qa.pages},(_,i)=>{const n=String(i+1).padStart(2,'0');return `<figure><a href="${n}.png"><img src="${n}.png" alt="第 ${i+1} 页" loading="lazy"></a><figcaption>${n} / ${String(qa.pages).padStart(2,'0')}</figcaption></figure>`;}).join('');
 await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(parsed.title||'红笺预览')}</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#e5e1d6;color:#2b2c27;font:16px/1.7 system-ui}header{max-width:1240px;margin:0 auto 28px}h1{font-size:26px;font-weight:500}a{color:inherit;text-underline-offset:4px}main{max-width:1240px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{color:#716a5d;font-size:13px;margin-top:8px}@media(max-width:700px){body{padding:20px}main{grid-template-columns:1fr}}</style><header><h1>${escape(parsed.title||'红笺预览')}</h1><p>${qa.pages} 页 · ${escape(tokens.themes[config.theme].name)} · 1080 × 1440</p><a href="document.html">排版源文件</a> · <a href="source.md">原始 Markdown</a> · <a href="qa.json">完整性检查</a></header><main>${imageTiles}</main></html>`);
 const outputConfig={theme:config.theme,cover:config.cover,author:config.author,...(config.pageStyles?{pageStyles:config.pageStyles}:{}),assetMap:Object.fromEntries(parsed.images.map(a=>[a.source,a.target])),...(config.coverHighlight?{coverHighlight:config.coverHighlight}:{}),...(config.coverImage?{coverImage:config.coverImage}:{})};
 await fs.writeFile(path.join(out,'settings.yml'),YAML.stringify(outputConfig));
 const manifest={version:1,createdAt:new Date().toISOString(),source:{filename:path.basename(input),sha256:hash(Buffer.from(source))},theme:config.theme,pageSize:[1080,1440],pages:qa.pages,images:parsed.images,fonts:{family:'Source Han Serif SC / Source Han Sans SC',license:'SIL OFL 1.1'},provenance:'assets/tokens.json and licenses/'};
 if(errors.length)throw new Error('浏览器脚本错误：'+errors.join('; '));
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 await fs.writeFile(path.join(out,'qa.json'),JSON.stringify({...qa,sourceHash:manifest.source.sha256,browserErrors:errors,passed:true},null,2));
 console.log(JSON.stringify({out,pages:qa.pages,passed:true,preview:path.join(out,'index.html')},null,2));
}catch(e){await fs.writeFile(path.join(out,'FAILED.txt'),e.stack||String(e));throw e;}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}

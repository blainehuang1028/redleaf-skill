import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const t=JSON.parse(await fs.readFile('skills/redleaf/assets/tokens.json','utf8'));
function lum(hex){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;}
function contrast(a,b){a=lum(a);b=lum(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
const colorReport={};
for(const [name,v] of Object.entries(t.themes)){colorReport[name]={onPaper:contrast(v.text,t.canvas.paper),onWash:contrast(v.text,v.wash)};assert(colorReport[name].onPaper>=4.5,`${name} text/paper`);assert(colorReport[name].onWash>=4.5,`${name} text/wash`);}

for(const dir of process.argv.slice(2)){
 const qa=JSON.parse(await fs.readFile(path.join(dir,'qa.json'),'utf8'));
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 assert.equal(qa.passed,true);assert(qa.pages>0);assert.equal(qa.pages,manifest.pages);
 assert(qa.integrity.every(x=>x.ok));assert(qa.geometry.every(x=>!x.overflow&&x.contentBottom<=1280.5));
 assert(Math.abs(qa.monoWidths.i-qa.monoWidths.W)<=.1,'actual code font is monospace');
 assert.equal(sha(await fs.readFile(path.join(dir,'source.md'))),manifest.source.sha256);
 for(const asset of manifest.images)assert.equal(sha(await fs.readFile(path.join(dir,asset.target))),asset.sha256);
 for(let i=1;i<=qa.pages;i++){const png=await fs.readFile(path.join(dir,String(i).padStart(2,'0')+'.png'));assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1440);}
 console.log(`PASS ${dir}: ${qa.pages} pages, text/assets preserved, 1080x1440, real monospace`);
}
console.log('PASS all theme text contrasts >=4.5 on paper and wash');

import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
const base=new URL('../assets/',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('fonts-manifest.json',base),'utf8'));
await fs.mkdir(new URL('fonts/',base),{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
await Promise.all(manifest.map(async f=>{
 const dest=new URL(`fonts/${f.file}`,base);
 try{if(digest(await fs.readFile(dest))===f.sha256){console.log(`OK ${f.file}`);return;}}catch{}
 const res=await fetch(f.url,{signal:AbortSignal.timeout(120000)});if(!res.ok)throw new Error(`${f.file}: HTTP ${res.status}`);
 const data=Buffer.from(await res.arrayBuffer());if(digest(data)!==f.sha256)throw new Error(`${f.file}: SHA256 不匹配`);
 const temp=new URL(`fonts/${f.file}.${randomUUID()}.tmp`,base);
 try{await fs.writeFile(temp,data,{flag:'wx'});await fs.rename(temp,dest);console.log(`Installed ${f.file}`);}
 finally{await fs.rm(temp,{force:true});}
}));

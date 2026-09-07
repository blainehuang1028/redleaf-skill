import MarkdownIt from 'markdown-it';
import mark from 'markdown-it-mark';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function markdown(source,inputPath,out,assetMap={},assetBase=path.dirname(inputPath)) {
 const md=new MarkdownIt({html:false,linkify:false,typographer:false}).use(mark);
 md.block.ruler.before('paragraph','pagebreak',(state,start,end,silent)=>{
  const a=state.bMarks[start]+state.tShift[start],b=state.eMarks[start];
  if(state.src.slice(a,b).trim()!=='<!-- pagebreak -->')return false;
  if(!silent){const t=state.push('pagebreak','div',0);t.block=true;t.map=[start,start+1];state.line=start+1;}
  return true;
 });
 md.renderer.rules.pagebreak=()=>'<div data-pagebreak="true"></div>\n';
 const tokens=md.parse(source,{}),images=[],seen=new Map();
 const visit=async list=>{for(const token of list){
  if(token.type==='image'){
   const src=token.attrGet('src');
   const mapped=assetMap[src];
   if(!seen.has(src)){
    const asset=await imageAsset(src,inputPath,out,assetMap,assetBase);images.push(asset);seen.set(src,asset);
   }
   token.attrSet('src',seen.get(src).target);
  }
  if(token.children)await visit(token.children);
 }};
 await visit(tokens);
 let title='';
 const hi=tokens.findIndex(t=>t.type==='heading_open'&&t.tag==='h1');
 if(hi>=0)title=(tokens[hi+1].children||[]).map(t=>t.type==='text'||t.type==='code_inline'?t.content:t.type==='softbreak'||t.type==='hardbreak'?' ':t.type==='image'?t.content:'').join('');
 return {html:md.renderer.render(tokens,md.options,{}),title,images};
}

export async function imageAsset(src,inputPath,out,assetMap={},assetBase=path.dirname(inputPath)){
 const mapped=assetMap[src];
    let bytes;
    if(mapped){
     if(typeof mapped!=='string')throw new Error('素材映射必须是文件路径。');
     bytes=await fs.readFile(path.resolve(assetBase,mapped));
    }else if(/^https?:\/\//i.test(src)){
     const res=await fetch(src,{signal:AbortSignal.timeout(30000)});
     if(!res.ok)throw new Error(`图片请求失败 (${res.status}): ${src}`);
     bytes=Buffer.from(await res.arrayBuffer());
    }else if(src.startsWith('data:')){
     const m=src.match(/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,([\s\S]+)$/i);
     if(!m)throw new Error('只支持标准 base64 图片 data URL。');
     bytes=Buffer.from(m[2],'base64');
    }else{
     if(/^[a-z][a-z0-9+.-]*:/i.test(src))throw new Error(`不支持的图片协议：${src}`);
     bytes=await fs.readFile(path.resolve(path.dirname(inputPath),decodeURIComponent(src)));
    }
    const digest=hash(bytes);
    let ext='';
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='.png';
    else if(bytes[0]===255&&bytes[1]===216)ext='.jpg';
    else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')ext='.webp';
    else if(bytes.subarray(0,3).toString()==='GIF')ext='.gif';
    else if(/<svg[\s>]/i.test(bytes.toString('utf8',0,1000)))ext='.svg';
    else throw new Error(`无法识别图片格式：${src}`);
    const target=`media/${digest.slice(0,20)}${ext}`;
    await fs.mkdir(path.join(out,'media'),{recursive:true});await fs.writeFile(path.join(out,target),bytes);
 return {source:src,target,sha256:digest,bytes:bytes.length};
}

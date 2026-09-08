// Conservative raster segmentation: cut only across broad background bands.
// Short content blocks are kept with what follows, so headings do not dangle.
window.redleafImageBreaks=function(data,width,height,lineGaps=false){
 const background=[data[0],data[1],data[2]],gap=lineGaps?4:Math.max(8,Math.round(width*.04));
 const bands=[];let start=null;
 for(let y=0;y<height;y++){
  let ink=0;
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4;
   if(data[i+3]>20&&Math.max(...background.map((v,c)=>Math.abs(data[i+c]-v)))>60)ink++;
  }
  const blank=ink<=Math.max(1,width*.003);
  if(blank&&start===null)start=y;
  if((!blank||y===height-1)&&start!==null){
   const end=blank?y+1:y;
   if(end-start>=gap)bands.push({start,end});
   start=null;
  }
 }
 return bands.filter((band,i)=>band.start>0&&band.end<height&&(lineGaps||band.start-(bands[i-1]?.end||0)>=width*.16)).map(band=>Math.floor((band.start+band.end)/2));
};
/* Runs only over trusted renderer output: Markdown raw HTML is escaped upstream. */
window.paginateRedleaf=async function(config){
 const source=document.querySelector('#source'),root=document.querySelector('#pages');
 await Promise.all(['500 72px RedleafSerif','400 42px RedleafSans','700 42px RedleafSans','400 36px RedleafMono'].map(f=>document.fonts.load(f)));
 for(const font of document.fonts)if(font.status!=='loaded')throw new Error(`字体未加载：${font.family} ${font.weight}`);
 await Promise.all([...source.querySelectorAll('img')].map(img=>new Promise((resolve,reject)=>{
  if(img.complete)return img.naturalWidth?resolve():reject(new Error(`图片未加载：${img.getAttribute('src')}`));
  img.onload=resolve;img.onerror=()=>reject(new Error(`图片未加载：${img.getAttribute('src')}`));
 })));
 let current=null;
 const bodyPages=[];
 const bottom=config.layout.contentBottom;
 const warning=[];
 // Stable identities and explicit values survive nested Range fragments.
 for(const [i,li] of [...source.querySelectorAll('li')].entries()){
  li.dataset.listItem=String(i);li.dataset.nonempty=String(Boolean(li.textContent.trim()||li.querySelector('img,hr,br')));
 }
 for(const ol of source.querySelectorAll('ol')){
  let number=Number(ol.getAttribute('start')||1);
  for(const li of ol.children){li.setAttribute('value',String(number++));}
 }

 function newPage(){
  const page=document.createElement('article');page.className='page reading';page.dataset.theme=config.theme;
  page.innerHTML='<canvas class="paper" aria-hidden="true"></canvas><div class="content"></div><footer><span></span><span></span></footer>';
  root.append(page);current=page.querySelector('.content');bodyPages.push(page);return current;
 }
 function fits(node){current.append(node);const r=node.getBoundingClientRect(),p=current.closest('.page').getBoundingClientRect();
  const good=r.bottom-p.top<=bottom+.5&&node.scrollWidth<=current.clientWidth+1;
  if(!good)node.remove();return good;
 }
 function hasContent(){return current.children.length>0;}
 function measure(node){current.append(node);const r=node.getBoundingClientRect(),p=current.closest('.page').getBoundingClientRect();node.remove();return r.bottom-p.top;}
 function positions(node){
  // Grapheme boundaries preserve surrogate pairs and combining sequences.
  const list=[{node,offset:0}],segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});
  function walk(n){
   if(n.nodeType===Node.TEXT_NODE){for(const s of segmenter.segment(n.data))list.push({node:n,offset:s.index+s.segment.length});}
   else if(n.nodeType===Node.ELEMENT_NODE&&(n.tagName==='IMG'||n.tagName==='BR'||n.tagName==='HR')){
    const i=[...n.parentNode.childNodes].indexOf(n);list.push({node:n.parentNode,offset:i+1});
   }else for(const child of n.childNodes)walk(child);
  }
  walk(node);return list;
 }
 function cut(node,points,index){
  const a=node.cloneNode(false),b=node.cloneNode(false),r=document.createRange(),p=points[index];
  r.setStart(node,0);r.setEnd(p.node,p.offset);a.append(r.cloneContents());
  r.setStart(p.node,p.offset);r.setEnd(node,node.childNodes.length);b.append(r.cloneContents());
  for(const part of [a,b]){
   for(const li of [...part.querySelectorAll('li')].reverse())if(li.dataset.nonempty==='true'&&!li.textContent.trim()&&!li.querySelector('img,hr,br'))li.remove();
   for(const list of [...part.querySelectorAll('ol,ul')].reverse()){
    if(!list.children.length)list.remove();
    else if(list.tagName==='OL')list.setAttribute('start',list.firstElementChild.getAttribute('value')||'1');
   }
  }
  const continued=new Set([...a.querySelectorAll('li')].map(li=>li.dataset.listItem));
  for(const li of b.querySelectorAll('li'))if(continued.has(li.dataset.listItem))li.style.listStyleType='none';
  return [a,b];
 }
 function splitText(node){
  const points=positions(node);let lo=1,hi=points.length-2,best=0;
  while(lo<=hi){const m=(lo+hi)>>1,[part]=cut(node,points,m);if(fits(part)){part.remove();best=m;lo=m+1;}else hi=m-1;}
  if(!best)return null;
  // Prefer a nearby word/phrase boundary; never change the stored text.
  const floor=Math.max(1,best-24);
  for(let i=best;i>=floor;i--){const [a]=cut(node,points,i);if(/[\s，。；！？、,.!?;:]$/.test(a.textContent)){best=i;break;}}
  return cut(node,points,best);
 }
 function table(node){
  const rows=[...node.querySelectorAll(':scope > tbody > tr')];
  if(!rows.length)return flowText(node);
  let first=true;
  function shell(){const t=node.cloneNode(false);for(const el of node.children)if(el.tagName!=='TBODY'){const c=el.cloneNode(true);if(!first)c.dataset.repeat='true';t.append(c);}t.append(document.createElement('tbody'));return t;}
  let chunk=shell();current.append(chunk);
  for(const row of rows){
   chunk.querySelector('tbody').append(row.cloneNode(true));
   if(measureExisting(chunk)>bottom+.5||chunk.scrollWidth>current.clientWidth+1){
    chunk.querySelector('tbody').lastElementChild.remove();
    if(!chunk.querySelector('tbody').children.length){chunk.remove();if(!hasContent())throw new Error(`表格 ${node.dataset.source} 单行超出页面；请拆分这一行或列。`);}
    else first=false;
    newPage();chunk=shell();current.append(chunk);chunk.querySelector('tbody').append(row.cloneNode(true));
    if(measureExisting(chunk)>bottom+.5||chunk.scrollWidth>current.clientWidth+1)throw new Error(`表格 ${node.dataset.source} 单行超出页面；请拆分这一行或列。`);
   }
  }
 }
 function measureExisting(node){return node.getBoundingClientRect().bottom-current.closest('.page').getBoundingClientRect().top;}
 function list(node){
  const children=[...node.children];let index=0;
  const originalStart=Number(node.getAttribute('start')||1);
  function shell(){const c=node.cloneNode(false);if(c.tagName==='OL')c.setAttribute('start',String(originalStart+index));return c;}
  let chunk=shell();current.append(chunk);
  for(let li of children){
   li=li.cloneNode(true);chunk.append(li);
   if(measureExisting(chunk)<=bottom+.5){index++;continue;}
   li.remove();
   if(chunk.children.length){newPage();chunk=shell();current.append(chunk);}
   else if(current.children.length>1){chunk.remove();newPage();chunk=shell();current.append(chunk);}
   chunk.append(li);
   if(measureExisting(chunk)<=bottom+.5){index++;continue;}
   li.remove();chunk.remove();
   // A single long item is split within a list shell. Continuation hides only its repeated marker.
   let remainder=shell();remainder.append(li);
   while(true){
    if(fits(remainder))break;
    const split=splitText(remainder);
    if(!split)throw new Error(`列表 ${node.dataset.source} 无法分页。`);
    const [part,rest]=split;if(!fits(part))throw new Error('列表分页测量不一致。');
    newPage();remainder=rest;
   }
   index++;chunk=shell();current.append(chunk);
  }
  if(!chunk.children.length)chunk.remove();
 }
 function flowText(node){
  let remaining=node;
  while(true){
   if(fits(remaining))return;
   if(remaining.querySelector('img')||remaining.tagName==='FIGURE'){
    if(hasContent()){newPage();continue;}
    // Fit images inside a full page, keeping aspect ratio; text is never scaled.
    remaining.querySelectorAll('img').forEach(img=>{img.style.maxHeight='1000px';img.style.maxWidth='100%';img.style.width='auto';});
    if(fits(remaining))return;
   }
   const split=splitText(remaining);
   if(!split){if(hasContent()){newPage();continue;}throw new Error(`内容块 ${node.dataset.source} 无法放入一页，请调整素材或显式分段。`);}
   const [part,rest]=split;
   // Avoid tiny fragments on an already occupied page.
   current.append(part);const ph=part.getBoundingClientRect().height,ps=getComputedStyle(part);const minHeight=parseFloat(ps.lineHeight)*1.8+parseFloat(ps.paddingTop)+parseFloat(ps.paddingBottom);part.remove();
   if(hasContent()&&ph<minHeight&&!part.querySelector('img')){newPage();continue;}
   if(!fits(part))throw new Error('分页测量不一致。');
   newPage();rest.classList.add('continued');remaining=rest;
  }
 }
 const imageSlices=[];
 function tallImage(node){
  const img=node.querySelector('img');
  if(!img||node.textContent.trim()||node.querySelectorAll('img').length!==1)return false;
  const original=source.querySelector(`[data-source="${node.dataset.source}"] img`);
  const width=current.clientWidth,height=width*original.naturalHeight/original.naturalWidth;
  const capacity=bottom-config.layout.marginTop-36;
  if(height<=capacity)return false;
  if(hasContent()){
   const trailing=[];let last=current.lastElementChild;
   while(last&&/^H[1-6]$/.test(last.tagName)){trailing.unshift(last);last=last.previousElementSibling;}
   if(last){trailing.forEach(el=>el.remove());newPage();current.append(...trailing);}
  }
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(original.naturalWidth,1024);canvas.height=Math.round(original.naturalHeight*canvas.width/original.naturalWidth);
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(original,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  const cuts=window.redleafImageBreaks(pixels,canvas.width,canvas.height).map(y=>y*height/canvas.height);
  const lineCuts=window.redleafImageBreaks(pixels,canvas.width,canvas.height,true).map(y=>y*height/canvas.height);
  const probe=document.createElement('div');current.append(probe);
  const firstAvailable=bottom-(probe.getBoundingClientRect().top-current.closest('.page').getBoundingClientRect().top)-36;probe.remove();
  const segments=[];let cursor=0;
  while(cursor<height){
   const available=segments.length?capacity:firstAvailable;
   const end=height-cursor<=available?height:(cuts.filter(y=>y>cursor+100&&y<=cursor+available).at(-1)??lineCuts.filter(y=>y>cursor+available*.4&&y<=cursor+available).at(-1));
   if(end===undefined)break;
   segments.push({offset:cursor,height:end-cursor});cursor=end;
  }
  if(cursor<height){
   // Preserve an unbreakable image in full instead of silently cutting content.
   if(firstAvailable<=0)throw new Error('长图前标题占满页面，请显式分页。');
   const scale=Math.min(1,firstAvailable/height);
   img.style.width=width*scale+'px';img.style.height=height*scale+'px';
   if(!fits(node))throw new Error('完整长图无法排入页面，请单独提供原图。');
   warning.push('长图未找到安全分页空白，已完整缩放保留；请检查可读性，必要时提供分段素材。');
   imageSlices.push({source:node.dataset.source,offset:0,height,totalHeight:height,width:width*scale,mode:'intact'});
   return true;
  }
  let offset=0,count=0;
  while(offset<height){
   const frame=document.createElement('div');
   frame.className='image-slice';frame.dataset.source=node.dataset.source;
   frame.style.width=width+'px';frame.style.height='1px';current.append(frame);
   const top=frame.getBoundingClientRect().top-current.closest('.page').getBoundingClientRect().top;frame.remove();
   const available=bottom-top-36;
   if(available<100)throw new Error('长图前标题占满页面，请显式分页。');
   const size=segments[count].height;frame.style.height=size+'px';
   const copy=img.cloneNode(true);copy.style.width=width+'px';copy.style.height=height+'px';copy.style.top=-offset+'px';
   if(count)copy.dataset.repeat='true';
   let wrapped=copy;
   for(let ancestor=img.parentElement;ancestor&&ancestor!==node;ancestor=ancestor.parentElement){const shell=ancestor.cloneNode(false);shell.append(wrapped);wrapped=shell;}
   frame.append(wrapped);
   if(!fits(frame))throw new Error('长图分段超出边界。');
   imageSlices.push({source:node.dataset.source,offset,height:size,totalHeight:height,width,mode:'whitespace'});
   offset+=size;count++;if(offset<height)newPage();
  }
  return true;
 }
 const originals=[];
 for(const [i,block] of [...source.children].entries()){
  if(block.hasAttribute('data-pagebreak')){if(current&&hasContent())newPage();continue;}
  block.dataset.source=`s${i+1}`;originals.push(block);
  if(!current)newPage();
  const copy=block.cloneNode(true);
  if(/^H[1-6]$/.test(copy.tagName)){
   const after=measure(copy),next=source.children[i+1];let imageBottom=0;
   if(next?.querySelector('img')&&!next.textContent.trim()){
    const preview=next.cloneNode(true);current.append(copy,preview);imageBottom=measureExisting(preview);copy.remove();preview.remove();
   }
   if(hasContent()&&(after>bottom-240||imageBottom>bottom))newPage();
  }
  if(tallImage(copy))continue;
  if(fits(copy))continue;
  if(copy.tagName==='TABLE')table(copy);
  else if(copy.tagName==='OL'||copy.tagName==='UL')list(copy);
  else flowText(copy);
 }
 // A trailing explicit break is not a blank page.
 for(const page of [...bodyPages])if(!page.querySelector('.content').children.length){page.remove();bodyPages.splice(bodyPages.indexOf(page),1);}
 const normalize=s=>s.replace(/\s+/gu,'');
 const integrity=[];
 for(const original of originals){
  const parts=[...root.querySelectorAll(`[data-source="${original.dataset.source}"]`)];
  const clean=parts.map(p=>{const c=p.cloneNode(true);c.querySelectorAll('[data-repeat]').forEach(x=>x.remove());return c;});
  const expected=original.textContent,actual=clean.map(c=>c.textContent).join('');
  const code=original.tagName==='PRE';
  const textMatch=code?expected===actual:normalize(expected)===normalize(actual);
  const expectImages=[...original.querySelectorAll('img')].map(x=>x.getAttribute('src'));
  const gotImages=clean.flatMap(c=>[...c.querySelectorAll('img')].map(x=>x.getAttribute('src')));
  // A split inline link can legitimately occur in more than one fragment.
  const expectedLinks=[...new Set([...original.querySelectorAll('a')].map(x=>x.getAttribute('href')))];
  const actualLinks=[...new Set(clean.flatMap(c=>[...c.querySelectorAll('a')].map(x=>x.getAttribute('href'))))];
  const ok=textMatch&&JSON.stringify(expectImages)===JSON.stringify(gotImages)&&JSON.stringify(expectedLinks)===JSON.stringify(actualLinks);
  integrity.push({source:original.dataset.source,tag:original.tagName,fragments:parts.length,characters:expected.length,exactCode:code?textMatch:null,ok});
 }
 if(integrity.some(x=>!x.ok))throw new Error('原文完整性校验失败：'+integrity.filter(x=>!x.ok).map(x=>x.source).join(','));
 if(config.cover&&config.title){
  const cover=document.createElement('article');cover.className='page cover';cover.dataset.theme=config.theme;
  cover.innerHTML='<canvas class="paper" aria-hidden="true"></canvas><div class="content"><h1></h1></div><footer><span></span><span></span></footer>';
  const heading=cover.querySelector('h1');
  let displayTitle=config.title;
  const lead=config.title.match(/^(.{2,16}?[，：])([\s\S]{4,})$/);
  if(lead&&(!config.coverHighlight||lead[2].includes(config.coverHighlight))){const p=document.createElement('p');p.className='audience';p.textContent=lead[1];heading.before(p);displayTitle=lead[2];}
  if(displayTitle.length>26||config.coverAsset)heading.style.fontSize='72px';
  const highlight=config.coverHighlight;
  if(highlight){const i=displayTitle.indexOf(highlight);if(i<0)throw new Error('封面强调文字不在原题目中。');heading.append(document.createTextNode(displayTitle.slice(0,i)));const em=document.createElement('span');em.className='accent';em.dataset.wash='cover';em.textContent=highlight;heading.append(em,document.createTextNode(displayTitle.slice(i+highlight.length)));}
  else heading.textContent=displayTitle;
  root.prepend(cover);
  if(config.coverAsset){
   const image=document.createElement('img');image.alt='用户提供的封面图片';image.src=config.coverAsset;
   const available=bottom-(heading.getBoundingClientRect().bottom-cover.getBoundingClientRect().top)-52;
   if(available<180)throw new Error('封面标题与图片空间不足，请单独安排题图页。');
   image.style.cssText=`display:block;margin:52px auto 0;max-width:100%;width:auto;height:auto;max-height:${Math.min(580,available)}px;object-fit:contain`;
   heading.after(image);await image.decode();
  }
  if(heading.getBoundingClientRect().bottom-cover.getBoundingClientRect().top>bottom)throw new Error('标题过长，请关闭封面或提供明确的封面排版方案；原题目未删改。');
 }
 source.remove();
 const pages=[...root.querySelectorAll('.page')];
 if(!pages.length)throw new Error('原稿没有可排版内容。');
 pages.forEach((page,i)=>{const parts=page.querySelector('footer').children;parts[0].textContent=config.author||'';parts[1].textContent=`${String(i+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`;page.id=`page-${i+1}`;const overrides=config.pageStyles?.[String(i+1)];if(overrides){if(overrides.markScale!==undefined)page.style.setProperty('--mark-scale',overrides.markScale);if(overrides.markLift!==undefined)page.style.setProperty('--mark-lift',overrides.markLift);}});
 await window.paintRedleaf();
 const probe=document.createElement('canvas').getContext('2d');const codeElement=root.querySelector('pre code,code');probe.font=codeElement?getComputedStyle(codeElement).font:'400 36px RedleafMono';const monoWidths={i:probe.measureText('iiiiiiii').width,W:probe.measureText('WWWWWWWW').width};
 if(Math.abs(monoWidths.i-monoWidths.W)>.1)throw new Error('代码等宽字体检查失败。');
 const geometry=pages.map((page,i)=>{const r=page.getBoundingClientRect(),c=page.querySelector('.content'),children=[...c.children];return {page:i+1,width:r.width,height:r.height,contentBottom:Math.max(0,...children.map(x=>x.getBoundingClientRect().bottom-r.top)),footerTop:page.querySelector('footer').getBoundingClientRect().top-r.top,overflow:children.some(x=>x.scrollWidth>c.clientWidth+1)};});
 if(geometry.some(g=>g.overflow||g.contentBottom>bottom+.5))throw new Error('页面超出内容边界。');
 return {pages:pages.length,integrity,geometry,monoWidths,imageSlices,warnings:warning};
};

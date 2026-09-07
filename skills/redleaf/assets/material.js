// Deterministic paper and pigment studies. No image-generation service or external imagery.
function random(seed) {return () => {seed|=0; seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function field(w,h,rnd){const a=Array.from({length:w*h},()=>rnd());return (x,y)=>{const ix=Math.floor(x)% (w-1),iy=Math.floor(y)%(h-1),tx=x-Math.floor(x),ty=y-Math.floor(y);return (a[iy*w+ix]*(1-tx)+a[iy*w+ix+1]*tx)*(1-ty)+(a[(iy+1)*w+ix]*(1-tx)+a[(iy+1)*w+ix+1]*tx)*ty;};}
function paper(canvas,index){
 if(canvas.dataset.painted)return;
 canvas.dataset.painted="true";
 canvas.width=1080;canvas.height=1440;
 const ctx=canvas.getContext('2d'),rnd=random(31027+index*7919),cloud=field(26,34,rnd),grain=field(220,290,rnd),im=ctx.createImageData(1080,1440);
 for(let y=0;y<1440;y++)for(let x=0;x<1080;x++){
  const p=(y*1080+x)*4;
  const variation=(cloud(x/45,y/45)-.5)*2.4+(grain(x/5,y/5)-.5)*1.2+(rnd()-.5)*2.2;
  im.data[p]=244+variation;im.data[p+1]=239+variation;im.data[p+2]=227+variation;im.data[p+3]=255;
 }
 ctx.putImageData(im,0,0);
 for(let i=0;i<1400;i++){
  const x=rnd()*1080,y=rnd()*1440,angle=rnd()*Math.PI,len=1+rnd()*12;
  ctx.strokeStyle=i%3===0?'rgba(255,253,240,.12)':'rgba(117,105,79,.028)';ctx.lineWidth=.3+rnd()*.65;
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(angle)*len*.5,y+Math.sin(angle)*len*.35,x+Math.cos(angle)*len,y+Math.sin(angle)*len);ctx.stroke();
 }
}
function pigment(canvas,w,h,seed,strength,rgb){
 canvas.width=Math.ceil(w);canvas.height=Math.ceil(h);
 const ctx=canvas.getContext('2d'),rnd=random(seed),noise=field(Math.ceil(w/8)+3,Math.ceil(h/3)+3,rnd),edge=field(Math.ceil(w/10)+3,4,rnd),im=ctx.createImageData(canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const top=h*.21+(edge(x/10,0)-.5)*h*.18;
  const bottom=h*.81+(edge(x/10,1)-.5)*h*.16;
  const edgeDistance=Math.min(y-top,bottom-y,x-(h*.1+(y/h)*3),w-x-(h*.12+(1-y/h)*4));
  let a=Math.max(0,Math.min(1,(edgeDistance+1.2)/2.5));
  const n=noise(x/8,y/3); a*=.45+n*.65;
  if(n>.88&&y>h*.35&&y<h*.7)a*=.3;
  a*=.65+.35*(1-x/w);a*=strength;
  const p=(y*canvas.width+x)*4;im.data[p]=rgb[0];im.data[p+1]=rgb[1];im.data[p+2]=rgb[2];im.data[p+3]=Math.round(a*255);
 }
 ctx.putImageData(im,0,0);
}
window.paintRedleaf = async()=>{

 await document.fonts.ready;
 document.querySelectorAll(".pigment").forEach(c=>c.remove());
 document.querySelectorAll('.paper').forEach(paper);
 for(const [i,el] of [...document.querySelectorAll('[data-wash],mark')].entries()){
  const parent=el.closest('.page');if(!parent)continue;
  const parentRect=parent.getBoundingClientRect();
  const range=document.createRange();range.selectNodeContents(el);
  const all=[...range.getClientRects()].filter(r=>r.width>0);
  // Nested inline markup can return duplicate rectangles; one stroke per visible run.
  const rects=all.filter((r,i)=>!all.some((q,j)=>j<i&&Math.abs(q.left-r.left)<1&&Math.abs(q.top-r.top)<1&&Math.abs(q.width-r.width)<1));
  for(const [j,r] of rects.entries()){
   const c=document.createElement('canvas');c.className='pigment';
   const cover=el.dataset.wash==='cover';
   const hex=getComputedStyle(parent).getPropertyValue('--pigment').trim();
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   const style=getComputedStyle(parent),scale=parseFloat(style.getPropertyValue('--mark-scale'))||1,lift=parseFloat(style.getPropertyValue('--mark-lift'))||0;
   const baseHeight=cover?64:46;
   const w=r.width+28,h=baseHeight*scale;
   c.style.left=(r.left-parentRect.left-14)+'px';
   c.style.top=((cover?r.bottom-parentRect.top-39:r.bottom-parentRect.top-33)-lift-(h-baseHeight)*.25)+'px';
   pigment(c,w,h,700+i*10+j,cover?.64:.25,rgb);parent.append(c);
  }
 }
 window.materialReady=true;
};
window.ready=window.paintRedleaf();

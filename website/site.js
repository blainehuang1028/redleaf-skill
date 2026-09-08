const names={zhusha:['朱砂','写观点，也写心事'],canglan:['苍蓝','记新知，也记所思'],canglv:['苍绿','读草木，也读日常'],zheshi:['赭石','收经验，也收时光'],tenghuang:['藤黄','摘好句，也留微光']};
let selection=0;
for(const button of document.querySelectorAll('[data-theme]'))button.addEventListener('click',async()=>{
 const theme=button.dataset.theme,[name,note]=names[theme],version=++selection;
 document.getElementById('theme-note').textContent=`正在展开${name}样张…`;
 const images=[1,2,3].map(i=>{const image=new Image();image.src=`assets/${theme}-${i}.webp`;return image;});
 try{await Promise.all(images.map(i=>i.decode()));if(version!==selection)return;
 document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelectorAll('[data-sample]').forEach((img,i)=>{img.src=images[i].src;img.alt=`${name}主题${['文字封面','阅读正文','引用与列表'][i]}`;});
 document.querySelectorAll('[data-full]').forEach(a=>a.href=`assets/${theme}-${a.dataset.full}-full.webp`);
 document.getElementById('theme-note').textContent=`${name} · ${note}`;
 }catch{if(version===selection)document.getElementById('theme-note').textContent='图片未能加载，请再次选择主题。';}
});
document.getElementById('copy-prompt')?.addEventListener('click',async()=>{const text=document.getElementById('prompt').textContent,status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(text);status.textContent='已复制，交给你的 Agent 即可。';}catch{const range=document.createRange();range.selectNodeContents(document.getElementById('prompt'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='请按 ⌘C 或 Ctrl+C 复制已选中的文字。';}});
document.querySelector('[data-copy="install-command"]')?.addEventListener('click',async()=>{const el=document.getElementById('install-command'),status=document.getElementById('install-status');try{await navigator.clipboard.writeText(el.textContent);status.textContent='已复制，在终端运行即可安装。';}catch{const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='请按 ⌘C 或 Ctrl+C 复制已选中的命令。';}});

// Native dialog keeps keyboard focus within the preview and supports Escape.
const previewLinks=[...document.querySelectorAll('.gallery a[href],.picture-grid figure a[href]')].filter(a=>a.querySelector('img')&&/\.(png|webp|jpe?g)(?:[?#]|$)/i.test(a.href));
if(previewLinks.length){
 const dialog=document.createElement('dialog');
 dialog.className='lightbox';
 dialog.setAttribute('aria-label','样张预览');
 dialog.innerHTML='<div class="lightbox-toolbar"><p class="lightbox-caption"></p><button type="button" autofocus aria-label="关闭图片预览">关闭 ×</button></div><div class="lightbox-body"><img alt=""><p class="lightbox-status" role="status"></p></div>';
 document.body.append(dialog);
 const image=dialog.querySelector('img'),caption=dialog.querySelector('.lightbox-caption'),status=dialog.querySelector('.lightbox-status');
 let opener=null,request=0;
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.classList.contains('lightbox-body'))dialog.close();});
 dialog.addEventListener('close',()=>{request++;document.documentElement.classList.remove('preview-open');image.removeAttribute('src');opener?.focus({preventScroll:true});});
 for(const link of previewLinks){
  link.setAttribute('aria-haspopup','dialog');
  link.addEventListener('click',async event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();opener=link;
   const version=++request;
   caption.textContent=link.querySelector('img').alt;
   image.alt=caption.textContent;image.hidden=true;
   status.textContent='正在加载原图…';
   image.src=link.href;
   document.documentElement.classList.add('preview-open');dialog.showModal();
   try{await image.decode();if(version!==request)return;image.hidden=false;status.textContent='';}
   catch{if(version===request)status.textContent='图片加载失败，请关闭后重试。';}
  });
 }
}

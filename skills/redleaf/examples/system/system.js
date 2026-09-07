const frames=[...document.querySelectorAll('iframe')];
const themes={zhusha:'个人文章、观点与批注',canglan:'教程、研究与工具说明',canglv:'阅读、观察与日常记录',zheshi:'经验、复盘与手记',tenghuang:'淡染提示，配苍黄文字'};
let active='zhusha';
function resize(){frames.forEach(f=>{f.style.transform=`scale(${f.parentElement.clientWidth/1080})`;});}
async function applyTheme(){await Promise.all(frames.map(async f=>{const page=f.contentDocument.querySelector('.page');if(!page)return;page.dataset.theme=active;await f.contentWindow.paintRedleaf?.();}));}
window.ready=Promise.all([document.fonts.ready,...frames.map(f=>new Promise(resolve=>{async function done(){await f.contentWindow.ready;resize();resolve();}if(f.contentWindow.ready)done();else f.addEventListener('load',done,{once:true});}))]).then(()=>{resize();return applyTheme();});
new ResizeObserver(resize).observe(document.querySelector('.samples'));
document.querySelectorAll('[data-pick]').forEach(button=>button.addEventListener('click',async()=>{active=button.dataset.pick;document.querySelectorAll('[data-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.getElementById('theme-status').textContent=`当前：${button.textContent} · ${themes[active]}`;window.themeReady=applyTheme();await window.themeReady;}));

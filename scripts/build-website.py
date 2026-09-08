# -*- coding: utf-8 -*-
"""Build portable static assets from verified renderer outputs."""
from pathlib import Path
import argparse, json, shutil, zipfile
from PIL import Image, ImageDraw, ImageFont
from fontTools import subset
parser=argparse.ArgumentParser()
parser.add_argument('--outputs',default='output/release')
parser.add_argument('--editorial',help='Verified Kyoto editorial export directory')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
outputs=root/args.outputs
site=root/'website'
assets=site/'assets'
assets.mkdir(exist_ok=True)
# Remove superseded generated PNG previews; renderer originals remain in output.
for pattern in ['zhusha-*.png','canglan-*.png','canglv-*.png','zheshi-*.png','tenghuang-*.png','photo-full.png']:
    for old in assets.glob(pattern): old.unlink()
themes=['zhusha','canglan','canglv','zheshi','tenghuang']
for theme in themes:
    folder=outputs/('showcase-'+theme)
    assert json.loads((folder/'qa.json').read_text())['passed']
    for n in range(1,4):
        source=folder/f'{n:02}.png'
        Image.open(source).save(assets/f'{theme}-{n}-full.webp',quality=92)
        Image.open(source).resize((810,1080),Image.Resampling.LANCZOS).save(assets/f'{theme}-{n}.webp',quality=86)
# Hero is the explicitly requested ImageGen phone mockup; retain it.
photo=outputs/'photo/01.png'
Image.open(photo).resize((810,1080),Image.Resampling.LANCZOS).save(assets/'photo.webp',quality=87)
Image.open(photo).save(assets/'photo-full.webp',quality=92)
# Social preview is a crop of a real exported page, not an invented screenshot.
Image.open(outputs/'showcase-zhusha/02.png').resize((810,1080)).save(assets/'share.jpg',quality=88)
shutil.copytree(root/'skills/redleaf/licenses',assets/'licenses',dirs_exist_ok=True)
im=Image.new('RGB',(64,64),'#f4efe3');draw=ImageDraw.Draw(im)
font=ImageFont.truetype(str(root/'skills/redleaf/assets/fonts/serif.otf'),46)
draw.text((9,-1),'笺',fill='#873b38',font=font);im.save(assets/'favicon.png')
folder=root/args.editorial if args.editorial else outputs/'editorial';qa=json.loads((folder/'qa.json').read_text());assert qa['passed']
example=site/'examples/article';example.mkdir(parents=True,exist_ok=True)
for old in example.glob('[0-9][0-9].png'): old.unlink()
for old in example.glob('[0-9][0-9].webp'): old.unlink()
figures=[]
for n in range(1,qa['pages']+1):
    filename=f'{n:02}.webp';Image.open(folder/f'{n:02}.png').save(example/filename,quality=92)
    figures.append(f'<figure><a href="{filename}?v=kyoto-20260908"><img src="{filename}?v=kyoto-20260908" alt="京都的另一面：第 {n} 页" width="1080" height="1440" loading="lazy"></a><figcaption>{n:02} / {qa["pages"]:02}</figcaption></figure>')
example.joinpath('index.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>京都的另一面 · 完整图文 · 红笺</title><link rel="stylesheet" href="../../site.css?v=layout-20260908b"><script src="../../site.js?v=layout-20260908b" defer></script></head><body id="top" class="article-page"><header class="nav wrap"><a class="brand" href="../../index.html">红笺<span>Redleaf</span></a><a href="../../sources.html">来源与许可</a></header><main class="wrap"><a class="back-link" href="../../index.html#story">← 返回首页</a><div class="section-title"><h1>京都的另一面</h1><p>不在清水寺，在这 3 处避世「枯山水」。</p><p>作者原文 · 5 张摄影作品 · 朱砂主题 · 7 页图文<br>按页浏览，点开图片可放大阅读。</p><p><a href="source.zip?v=kyoto-20260908" download>下载原文与配图 ↓</a> · <a href="../../index.html#start">用自己的文章试一篇 ↗</a></p><p><a href="../../sources.html">摄影署名与许可</a> · <a href="pages.zip" download>下载 7 张原尺寸 PNG ↓</a></p></div><div class="gallery article-gallery" aria-label="完整京都图文，共七页">'''+''.join(figures)+'</div></main></body></html>')
example.joinpath('source.md').write_text((root/'tests/fixtures/editorial.md').read_text())
if (example/'lake.jpg').exists(): (example/'lake.jpg').unlink()
shutil.copytree(root/'tests/fixtures/kyoto',example/'kyoto',dirs_exist_ok=True)
with zipfile.ZipFile(example/'source.zip','w',zipfile.ZIP_DEFLATED) as source_zip:
    source_zip.write(example/'source.md','source.md')
    for p in sorted((example/'kyoto').rglob('*')):
        if p.is_file():source_zip.write(p,p.relative_to(example))
with zipfile.ZipFile(example/'pages.zip','w',zipfile.ZIP_DEFLATED) as page_zip:
    for p in sorted(folder.glob('[0-9][0-9].png')):page_zip.write(p,p.name)
    page_zip.write(root/'tests/fixtures/kyoto/CREDITS.md','CREDITS.md')
# Retain existing shared links while retiring the screenshot showcase.
legacy=site/'examples/long-image'
for old in legacy.glob('[0-9][0-9].webp'): old.unlink()
legacy.joinpath('index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../article/index.html"><title>完整图文 · 红笺</title><a href="../article/index.html">查看完整图文作品</a></html>')
text=''.join(p.read_text() for p in site.rglob('*') if p.suffix in ['.html','.js'])
for name in ['serif','sans']:
    opts=subset.Options();opts.flavor='woff2'
    font=subset.load_font(str(root/f'skills/redleaf/assets/fonts/{name}.otf'),opts)
    sub=subset.Subsetter(options=opts);sub.populate(text=text);sub.subset(font)
    # Subsets are derivative fonts; use new internal family names.
    family='Redleaf Web '+name.capitalize()
    for record in font['name'].names:
        if record.nameID in (1,4,6,16):
            value=family.replace(' ','') if record.nameID==6 else family
            record.string=value.encode(record.getEncoding())
    subset.save_font(font,str(assets/f'{name}.woff2'),opts)
(site/'downloads').mkdir(exist_ok=True)
shutil.copyfile(root/'dist/redleaf-skill.zip',site/'downloads/redleaf-skill.zip')
shutil.copyfile(root/'LICENSE',site/'LICENSE.txt')
with zipfile.ZipFile(root/'dist/redleaf-website.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(site.rglob('*')):
        if p.is_file() and p.name not in ('.DS_Store','README.md'):
            archive.write(p,p.relative_to(site))
print('Built website assets and dist/redleaf-website.zip')

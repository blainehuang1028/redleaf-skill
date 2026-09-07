"""Build portable static assets from verified renderer outputs."""
from pathlib import Path
import argparse, json, shutil, zipfile
from PIL import Image, ImageDraw, ImageFont
from fontTools import subset
parser=argparse.ArgumentParser()
parser.add_argument('--outputs',default='output/release')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
outputs=root/args.outputs
site=root/'website'
assets=site/'assets'
assets.mkdir(exist_ok=True)
themes=['zhusha','canglan','canglv','zheshi','tenghuang']
for theme in themes:
    folder=outputs/('showcase-'+theme)
    assert json.loads((folder/'qa.json').read_text())['passed']
    for n in range(1,4):
        source=folder/f'{n:02}.png'
        shutil.copyfile(source,assets/f'{theme}-{n}.png')
        Image.open(source).resize((810,1080),Image.Resampling.LANCZOS).save(assets/f'{theme}-{n}.webp',quality=86)
shutil.copyfile(assets/'zhusha-2.webp',assets/'hero.webp')
photo=outputs/'photo/01.png'
Image.open(photo).resize((810,1080),Image.Resampling.LANCZOS).save(assets/'photo.webp',quality=87)
shutil.copyfile(photo,assets/'photo-full.png')
# Social preview is a crop of a real exported page, not an invented screenshot.
Image.open(outputs/'showcase-zhusha/02.png').resize((810,1080)).save(assets/'share.jpg',quality=88)
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
shutil.copytree(root/'skills/redleaf/licenses',assets/'licenses',dirs_exist_ok=True)
im=Image.new('RGB',(64,64),'#f4efe3');draw=ImageDraw.Draw(im)
font=ImageFont.truetype(str(root/'skills/redleaf/assets/fonts/serif.otf'),46)
draw.text((9,-1),'笺',fill='#873b38',font=font);im.save(assets/'favicon.png')
folder=outputs/'long-image';qa=json.loads((folder/'qa.json').read_text());assert qa['passed']
example=site/'examples/long-image';example.mkdir(parents=True,exist_ok=True)
figures=[]
for n in range(1,qa['pages']+1):
    filename=f'{n:02}.png';shutil.copyfile(folder/filename,example/filename)
    figures.append(f'<figure><a href="{filename}"><img src="{filename}" alt="长截图第 {n} 页" width="1080" height="1440" loading="lazy"></a><figcaption>{n:02} / {qa["pages"]:02}</figcaption></figure>')
example.joinpath('index.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>长截图完整示例 · 红笺</title><link rel="stylesheet" href="../../site.css"><style>.gallery{grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:70px}@media(max-width:700px){.gallery{grid-template-columns:1fr}}</style></head><body><header class="nav wrap"><a class="brand" href="../../index.html">红笺<span>Redleaf</span></a><a href="../../sources.html">来源与许可</a></header><main class="wrap"><div class="section-title"><h2>长图续景，细读有径。</h2><p>使用指南的真实手机网页截图，按原比例连续分段。点开图片查看原尺寸。</p></div><div class="gallery">'''+''.join(figures)+'</div></main></body></html>')
(site/'downloads').mkdir(exist_ok=True)
shutil.copyfile(root/'dist/redleaf-skill.zip',site/'downloads/redleaf-skill.zip')
shutil.copyfile(root/'LICENSE',site/'LICENSE.txt')
with zipfile.ZipFile(root/'dist/redleaf-website.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in sorted(site.rglob('*')):
        if p.is_file() and p.name not in ('.DS_Store','README.md'):
            archive.write(p,p.relative_to(site))
print('Built website assets and dist/redleaf-website.zip')

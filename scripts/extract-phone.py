"""Extract this approved studio mockup using its dark outer phone silhouette.

The screen is enclosed by the silhouette, so internal white/paper pixels stay opaque.
No image resynthesis, screen replacement, or color-key removal inside the device.
"""
from pathlib import Path
from PIL import Image, ImageDraw
source=Path(__file__).resolve().parent.parent/'website/assets/kyoto-phone.webp'
im=Image.open(source).convert('RGBA')
assert im.size==(1024,1536)
mask=Image.new('L',im.size,0);draw=ImageDraw.Draw(mask)
rows=[]
for y in range(50,1480):
    edges=[x for x in range(140,880) if max(im.getpixel((x,y))[:3])<105]
    if len(edges)<2:continue
    left,right=min(edges),max(edges)
    # Reject isolated shadow/noise outside the connected device silhouette.
    if right-left<150:continue
    rows.append((y,left,right))
    draw.line((left,y,right,y),fill=255)
    if left>0:mask.putpixel((left-1,y),100)
    if right+1<im.width:mask.putpixel((right+1,y),100)
assert len(rows)>1380 and all(r-l>500 for y,l,r in rows if 180<y<1350)
im.putalpha(mask)
out=source.with_name('kyoto-phone-transparent.webp');im.save(out,quality=94,method=6)
assert Image.open(out).getchannel('A').getextrema()==(0,255)
print('Saved true RGBA cutout:',out,'bounds:',mask.getbbox())

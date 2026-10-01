# Texture/thumbnail pipeline for the Higgsfield images (needs pillow + numpy). usage: python3 tools/process-textures.py <workdir with src/ and out/>
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
S = sys.argv[1]
src = S + '/src'; out = S + '/out'

def seamless(im, blend=0.25):
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    sh = np.roll(np.roll(a, h//2, 0), w//2, 1)
    # weight: 1 in the center, 0 at edges
    yy = np.minimum(np.arange(h), h-1-np.arange(h)) / (h*blend)
    xx = np.minimum(np.arange(w), w-1-np.arange(w)) / (w*blend)
    wy = np.clip(yy, 0, 1)[:, None]; wx = np.clip(xx, 0, 1)[None, :]
    wgt = (wy * wx)[..., None]
    wgt = wgt*wgt*(3-2*wgt)
    r = a*wgt + sh*(1-wgt)
    return Image.fromarray(np.clip(r, 0, 255).astype(np.uint8))

sand = Image.open(src+'/t_sand.png').convert('RGB')
seamless(sand).resize((1024,1024), Image.LANCZOS).save(out+'/tex/sand.webp', quality=85)
wood = Image.open(src+'/t_wood.png').convert('RGB')
seamless(wood).resize((1024,1024), Image.LANCZOS).save(out+'/tex/wood.webp', quality=85)

room = Image.open(src+'/bg_room.png').convert('RGB')
room = room.filter(ImageFilter.GaussianBlur(7))
room = ImageEnhance.Brightness(room).enhance(0.85)
room.resize((2048, int(2048*room.height/room.width)), Image.LANCZOS).save(out+'/tex/room.webp', quality=80)
for n in ['bg_reef','bg_amazon']:
    im = Image.open(src+f'/{n}.png').convert('RGB')
    im.resize((2048, int(2048*im.height/im.width)), Image.LANCZOS).save(out+f'/tex/{n[3:]}.webp', quality=82)

# fish thumbnails with background removed via flood fill from borders
fish = ['clownfish','bluetang','yellowtang','mandarin','moorish','lionfish','neon','angelfish','discus','betta','goldfish','gramma','corydoras','blacktip','epaulette','bala']
for f in fish:
    p = src+f'/{f}.png'
    if not os.path.exists(p): print('missing', f); continue
    im = Image.open(p).convert('RGB')
    im.thumbnail((640, 640))
    w, h = im.size
    work = im.copy()
    sentinel = (255, 0, 255)
    for xy in [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(w//2,h-1),(0,h//2),(w-1,h//2)]:
        if work.getpixel(xy) != sentinel:
            ImageDraw.floodfill(work, xy, sentinel, thresh=38)
    a = np.asarray(work)
    mask = ~((a[...,0]==255)&(a[...,1]==0)&(a[...,2]==255))
    alpha = Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = im.copy(); rgba.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    rgba = rgba.crop(bbox); rgba.thumbnail((320, 220), Image.LANCZOS)
    rgba.save(out+f'/thumbs/{f}.webp', quality=85)
print('ok')

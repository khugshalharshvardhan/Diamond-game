#!/usr/bin/env python3
"""Re-extract this pack's PNGs from the supplied source board."""
from pathlib import Path
import argparse
import json
import shutil
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import cv2

BASE = None
SRC = None
ASSETS = []

def bg_plane(a):
    h,w,_=a.shape
    y,x=np.mgrid[-1:1:complex(h),-1:1:complex(w)]
    X=np.stack([np.ones_like(x),x,y,x*y,x*x,y*y],-1)
    bord=np.zeros((h,w),bool); bord[:2]=1; bord[-2:]=1; bord[:,:2]=1; bord[:,-2:]=1
    good=bord & (a.max(2)<90)
    if good.sum()<20:good=bord
    pred=np.full_like(a,np.median(a[bord],axis=0))
    for _ in range(4):
        if good.sum()<8:break
        coef=np.linalg.lstsq(X[good],a[good],rcond=None)[0]
        pred=X@coef
        d=np.linalg.norm(a-pred,axis=2)
        limit=max(6,float(np.median(d[good]))*2.8)
        good=bord&(d<limit)
    return np.clip(pred,0,255)


def auto_cut(im,glow=False,threshold=12):
    a=np.array(im.convert('RGB')).astype(float);bg=bg_plane(a)
    diff=np.max(np.abs(a-bg),axis=2)
    mask=diff>threshold
    labs,n=ndimage.label(mask); sizes=np.bincount(labs.ravel()); sizes[0]=0
    mask=sizes[labs]>=3
    if glow:
        core=ndimage.binary_fill_holes(diff>80)
        core=ndimage.binary_dilation(core,iterations=1)
        alpha=np.where(core,1,np.clip((diff-6)/80,0,.88))
        labs,n=ndimage.label(alpha>.06); sz=np.bincount(labs.ravel()); sz[0]=0
        alpha=np.where(sz[labs]>=8,alpha,0)
        # Remove the original dark matte from semi-transparent glow pixels.
        rgb=np.clip((a-bg*(1-alpha[...,None]))/np.maximum(alpha[...,None],.01),0,255)
        rgb[core]=a[core]
    else:
        mask=ndimage.binary_fill_holes(mask)
        dist=ndimage.distance_transform_edt(~mask)
        alpha=np.where(mask,1,np.where(dist<=1.1,np.clip((diff-4)/12,0,.8),0))
        rgb=a
    out=np.dstack([rgb,alpha*255]).astype('uint8');out[alpha==0,:3]=0
    return Image.fromarray(out)


def shape_cut(im,mode,radius=5):
    w,h=im.size;s=4
    mask=Image.new('L',(w*s,h*s),0);d=ImageDraw.Draw(mask)
    if mode=='ellipse':d.ellipse((s/2,s/2,w*s-s/2,h*s-s/2),fill=255)
    elif mode=='node':
        d.ellipse((1*s,0,(w-1)*s,(w-2)*s),fill=255)
        d.rounded_rectangle((6*s,26*s,(w-5)*s,(h-1)*s),radius=7*s,fill=255)
    else:d.rounded_rectangle((s/2,s/2,w*s-s/2,h*s-s/2),radius=radius*s,fill=255)
    mask=mask.resize((w,h),Image.Resampling.LANCZOS)
    out=im.convert('RGBA');out.putalpha(mask);return out


def guided_cut(im,points):
    a=np.array(im.convert('RGB')); h,w=a.shape[:2]
    poly=np.zeros((h,w),np.uint8);cv2.fillPoly(poly,[np.array(points,np.int32)],1)
    core=cv2.erode(poly,np.ones((3,3),np.uint8),iterations=1)
    extended=cv2.dilate(poly,np.ones((3,3),np.uint8),iterations=2)
    gm=np.full((h,w),cv2.GC_BGD,np.uint8)
    gm[extended>0]=cv2.GC_PR_BGD;gm[poly>0]=cv2.GC_PR_FGD;gm[core>0]=cv2.GC_FGD
    gm[0,:]=cv2.GC_BGD;gm[-1,:]=cv2.GC_BGD;gm[:,0]=cv2.GC_BGD;gm[:,-1]=cv2.GC_BGD
    cv2.setRNGSeed(4)
    cv2.grabCut(a,gm,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK)
    keep=(gm==cv2.GC_FGD)|(gm==cv2.GC_PR_FGD)
    keep=ndimage.binary_fill_holes(keep)
    rgba=np.dstack([a,keep.astype(np.uint8)*255]);rgba[~keep,:3]=0
    return Image.fromarray(rgba)



def glyph_cut(im,ellipse=False):
    a=np.asarray(im.convert('RGB')).astype(float); h,w=a.shape[:2]
    v=a.max(2)
    seed=v>88
    if ellipse:
        yy,xx=np.mgrid[0:h,0:w]
        roi=((xx-(w-1)/2)/(w/2-.4))**2+((yy-(h-1)/2)/(h/2-.4))**2<=1
        seed &= roi
    else:roi=np.ones((h,w),bool)
    labs,n=ndimage.label(seed);sizes=np.bincount(labs.ravel());sizes[0]=0
    seed &= sizes[labs]>=2
    core=ndimage.binary_fill_holes(seed)
    outer=ndimage.binary_dilation(core,iterations=1)&roi
    alpha=np.where(core,1,np.where(outer,np.clip((v-15)/75,0,.95),0))
    rgba=np.dstack([a,alpha*255]).astype(np.uint8);rgba[alpha==0,:3]=0
    return Image.fromarray(rgba)


def export_all():
    manifest=[]
    for i,spec in enumerate(ASSETS):
        box=spec['box'];im=SRC.crop(box); mode=spec['mode']
        if mode in ('auto','glow'):im=auto_cut(im,mode=='glow',spec.get('threshold',12))
        elif mode in ('rounded','ellipse','node'):im=shape_cut(im,mode,spec.get('radius',5))
        elif mode=='grabcut':im=guided_cut(im,spec['polygon'])
        elif mode=='glyph':
            im=glyph_cut(im,spec.get('ellipseROI',False))
            if spec['path'].endswith('/padlock.png'):
                a=np.asarray(im).copy();labs,n=ndimage.label(a[:,:,3]>30);sz=np.bincount(labs.ravel());sz[0]=0
                if sz.size>1:a[sz[labs]<sz.max()*.12,3]=0
                im=Image.fromarray(a)
        else:im=im.convert('RGBA')
        if spec.get('rejectGreen'):
            a=np.asarray(im).copy(); r,g,b=[a[:,:,k].astype(float) for k in range(3)]
            hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
            reject=(hsv[:,:,0]>=28)&(hsv[:,:,0]<=99)&(hsv[:,:,1]>45)&(hsv[:,:,2]>35)
            a[reject,3]=0
            labs,n=ndimage.label(a[:,:,3]>32)
            sizes=np.bincount(labs.ravel());sizes[0]=0
            if sizes.size>1:
                keep=sizes[labs]>=max(4,sizes.max()*.05)
                a[~keep,3]=0
            im=Image.fromarray(a)
        transparent=mode!='crop'
        # Trim empty matte and provide a safe 4 px transparent gutter.
        trim=(0,0,im.width,im.height)
        if transparent:
            trim=im.getchannel('A').point(lambda v:255 if v>3 else 0).getbbox() or trim
            im=im.crop(trim)
            pad=4;canvas=Image.new('RGBA',(im.width+2*pad,im.height+2*pad));canvas.alpha_composite(im,(pad,pad));im=canvas
        else:pad=0
        p=BASE/spec['path'];p.parent.mkdir(parents=True,exist_ok=True);im.save(p,optimize=True)
        up=None
        if spec.get('upscale',True):
            up='upscaled-4x/'+spec['path']
            q=BASE/up;q.parent.mkdir(parents=True,exist_ok=True)
            im.resize((im.width*4,im.height*4),Image.Resampling.LANCZOS).save(q,optimize=True)
        parts=Path(spec['path']).parts
        cat=parts[1] if parts[0]=='assets' else 'references'
        sub='/'.join(parts[1:-1])
        ident='/'.join(parts[:-1]+(Path(parts[-1]).stem,))
        anchor=spec.get('anchor','center')
        pivot=[im.width/2,im.height-pad] if anchor=='bottom-center' else [im.width/2,im.height/2]
        manifest.append(dict(id=ident,name=Path(spec['path']).stem.replace('_',' ').title(),category=cat,group=sub,path=spec['path'],upscaled4x=up,
            width=im.width,height=im.height,sourceRect=dict(x=box[0],y=box[1],width=box[2]-box[0],height=box[3]-box[1]),
            sourceTrim=list(trim),padding=pad,hasTransparency=transparent,alphaTreatment=mode,
            pivotPixels=pivot,pivotNormalized=[round(pivot[0]/im.width,5),round(pivot[1]/im.height,5)],
            quality=spec.get('quality','source-resolution'),notes=spec.get('note',''),frames=1))
    return manifest


def main():
    global BASE, SRC, ASSETS
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=root / 'references/source-overview.png')
    parser.add_argument('--config', type=Path, default=root / 'tools/extraction-config.json')
    parser.add_argument('--output', type=Path, default=root)
    parser.add_argument('--skip-upscaled', action='store_true', help='Export native PNGs only.')
    args = parser.parse_args()
    try:
        BASE = args.output.resolve()
        BASE.mkdir(parents=True, exist_ok=True)
        SRC = Image.open(args.source).convert('RGB')
        ASSETS = json.loads(args.config.read_text(encoding='utf-8'))
        if not isinstance(ASSETS, list):
            raise ValueError('The configuration must contain a list of asset definitions.')
        for spec in ASSETS:
            candidate = (BASE / spec['path']).resolve()
            if not candidate.is_relative_to(BASE):
                raise ValueError('An asset path points outside the output directory.')
            if args.skip_upscaled:
                spec['upscale'] = False
        manifest = export_all()
        ref = BASE / 'references/source-overview.png'
        ref.parent.mkdir(parents=True, exist_ok=True)
        if args.source.resolve() != ref.resolve():
            shutil.copyfile(args.source, ref)
        result = {
            'title': 'Diamond Heroes - extracted PNG asset pack',
            'version': 1,
            'sourceImage': 'references/source-overview.png',
            'sourceWidth': SRC.width,
            'sourceHeight': SRC.height,
            'provenance': 'Extracted from the supplied flattened source; no missing art generated.',
            'upscaledNote': '4x exports are enlargements, not additional source detail.',
            'assets': manifest,
        }
        (BASE / 'assets.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(f'Exported {len(manifest)} asset and reference entries to {BASE}')
    except (OSError, ValueError, KeyError, cv2.error) as exc:
        parser.exit(1, f'Extraction failed: {exc}\n')


if __name__ == '__main__':
    main()

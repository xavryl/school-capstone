'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Kind = 'avatar' | 'banner';

/** What each kind is cropped to, and what comes out the other end. */
const SHAPE: Record<Kind, { ratio: number; out: number; round: boolean; title: string }> = {
  avatar: { ratio: 1, out: 512, round: true, title: 'Position your picture' },
  banner: { ratio: 3, out: 1500, round: false, title: 'Position your banner' },
};

/**
 * Crop before upload, rather than storing whatever came off the phone and
 * hoping object-fit hides the difference.
 *
 * The frame is fixed to the shape the page will show, and the picture moves
 * behind it: drag to pan, the slider to zoom. Nothing is uploaded until the
 * canvas has redrawn only the visible part, so a 4MB photo becomes a 512px
 * square and the browser never has to download the rest of it again.
 *
 * No library. A crop is a rectangle and a scale, and canvas already knows how
 * to draw one image region into another.
 */
export default function ImageCropper({
  file,
  kind,
  onCancel,
  onDone,
}: {
  file: File;
  kind: Kind;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const shape = SHAPE[kind];
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  // null means "wherever centred is", so a freshly chosen picture opens on its
  // middle and a zoom before the first drag stays centred too.
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [working, setWorking] = useState(false);

  // The object URL is the only thing here that has to be cleaned up by hand.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the frame once it is on screen; it is sized in CSS so the crop
  // window matches the shape the profile page will use.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFrame({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [src]);

  // Cover fit: the smallest scale at which the picture still fills the frame.
  const base =
    natural && frame.w
      ? Math.max(frame.w / natural.w, frame.h / natural.h)
      : 1;
  const scale = base * zoom;
  const shownW = natural ? natural.w * scale : 0;
  const shownH = natural ? natural.h * scale : 0;

  // Panning stops where the picture would pull away from an edge, so there is
  // never a transparent gap in the crop.
  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(frame.w - shownW, x)),
      y: Math.min(0, Math.max(frame.h - shownH, y)),
    }),
    [frame.w, frame.h, shownW, shownH],
  );

  // Applied rather than stored: zoom changes the limits, and re-clamping in an
  // effect would show one frame with the picture pulled off its edge first.
  const at = clamp(
    offset?.x ?? (frame.w - shownW) / 2,
    offset?.y ?? (frame.h - shownH) / 2,
  );

  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: at.x, oy: at.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  async function confirm() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setWorking(true);

    // What the frame is showing, in the picture's own pixels.
    const sx = -at.x / scale;
    const sy = -at.y / scale;
    // Never ask for a pixel past the edge: at zoom 1 the binding dimension is
    // exactly the picture's own, and floating point can land a hair over.
    const sw = Math.min(frame.w / scale, natural.w - sx);
    const sh = Math.min(frame.h / scale, natural.h - sy);

    const outW = shape.out;
    const outH = Math.round(shape.out / shape.ratio);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setWorking(false);
      return;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', 0.9),
    );
    setWorking(false);
    if (!blob) return;

    onDone(new File([blob], `${kind}.jpg`, { type: 'image/jpeg' }));
  }

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label={shape.title}>
      <div className="cropper">
        <div className="cropper-head">
          <strong>{shape.title}</strong>
          <span className="muted small">Drag the picture, and zoom to fill the frame.</span>
        </div>

        <div
          ref={frameRef}
          className={`cropper-frame${shape.round ? ' round' : ''}`}
          style={{ aspectRatio: String(shape.ratio) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                setZoom(1);
                setOffset(null);
              }}
              style={{
                width: shownW || undefined,
                height: shownH || undefined,
                transform: `translate(${at.x}px, ${at.y}px)`,
              }}
            />
          )}
          <span className="cropper-grid" aria-hidden="true" />
        </div>

        <label className="cropper-zoom">
          <span className="label">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" onClick={onCancel} disabled={working}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={working || !natural}>
            {working ? 'Cropping…' : 'Use this'}
          </button>
        </div>
      </div>
    </div>
  );
}

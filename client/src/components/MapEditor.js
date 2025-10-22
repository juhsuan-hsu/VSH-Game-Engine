import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './MapEditor.css';

export default function MapEditor({ imageUrl, steps = [], onMovePin }) {
  const wrapRef = useRef(null);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [imgRect, setImgRect] = useState({ w: 1, h: 1, ox: 0, oy: 0 });

  const DEBUG =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugPins') === '1';

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgNatural({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      recomputeImageRect(); 
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const recomputeImageRect = () => {
    const el = wrapRef.current;
    if (!el || !imgNatural.w || !imgNatural.h) return;

    const cr = el.getBoundingClientRect();
    const cw = cr.width;
    const ch = cr.height;

    const scale = Math.min(cw / imgNatural.w, ch / imgNatural.h);
    const w = imgNatural.w * scale;
    const h = imgNatural.h * scale;
    const ox = (cw - w) / 2;
    const oy = (ch - h) / 2;

    setImgRect({ w, h, ox, oy });

    if (DEBUG) {
      console.log('[BUILDER][MapEditor] contain rect', { container: { cw, ch }, natural: imgNatural, drawn: { w, h, ox, oy } });
    }
  };

  useLayoutEffect(() => {
    recomputeImageRect();
    const ro = new ResizeObserver(() => recomputeImageRect());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onWin = () => recomputeImageRect();
    window.addEventListener('resize', onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, [imgNatural.w, imgNatural.h]);

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const pxToNorm = (px, py) => {
    const { w, h, ox, oy } = imgRect;
    const x = (px - ox) / w;
    const y = (py - oy) / h;
    return { x: clamp01(x), y: clamp01(y) };
  };

  const normToPx = (pos) => {
    const { w, h, ox, oy } = imgRect;
    return {
      left: `${ox + pos.x * w}px`,
      top: `${oy + pos.y * h}px`,
    };
  };

  const onCanvasClick = (e) => {
    if (!wrapRef.current) return;
    if (e.target.closest('.map-pin')) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pos = pxToNorm(px, py);

    if (Number.isInteger(selectedIndex)) onMovePin?.(selectedIndex, pos);

    if (DEBUG) {
      console.log('[BUILDER][MapEditor] click ->', { px, py, pos });
    }
  };

  const dragState = useRef({ dragging: false, index: -1 });
  const startDrag = (e, i) => {
    dragState.current = { dragging: true, index: i };
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd, { passive: false });
    try { e.target.setPointerCapture?.(e.pointerId); } catch {}
    e.preventDefault();
  };

  const onDragMove = (e) => {
    if (!dragState.current.dragging || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pos = pxToNorm(px, py);
    onMovePin?.(dragState.current.index, pos);

    if (DEBUG) {
      console.log('[BUILDER][MapEditor] drag ->', dragState.current.index, pos);
    }

    e.preventDefault();
  };

  const onDragEnd = () => {
    dragState.current = { dragging: false, index: -1 };
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
  };

  const options = useMemo(
    () =>
      steps.map((s, i) => ({
        idx: i,
        label: `${s.title || `Mission ${i + 1}`} (#${i + 1})`,
      })),
    [steps]
  );

  useEffect(() => {
    if (selectedIndex > steps.length - 1) setSelectedIndex(0);
  }, [steps.length, selectedIndex]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label>
          Place pin for mission:&nbsp;
          <select
            value={String(selectedIndex)}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {options.map(o => (
              <option key={o.idx} value={o.idx}>{o.label}</option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: 12, color: '#666' }}>
          Tip: click on the map to set the pin; drag pins to fine-tune.
        </span>
      </div>

      <div
        className="map-wrap"
        ref={wrapRef}
        style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'none' }}
        onClick={onCanvasClick}
      >
        {steps.map((s, i) => {
          const pos = s?.mapPos;
          if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return null;

          return (
            <button
              key={i}
              type="button"
              className="map-pin"
              style={normToPx(pos)}
              title={s.title || `Mission ${i + 1}`}
              onPointerDown={(ev) => startDrag(ev, i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
        Tip: drag numbers to move; Save to persist.
      </p>
    </div>
  );
}

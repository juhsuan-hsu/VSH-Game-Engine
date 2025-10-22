import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchGameById } from '../api';
import { jwtDecode } from 'jwt-decode';
import QRCodeReader from '../components/QRCodeReader';
import ARViewer from '../components/ARViewer';
import Modal from "../components/Modal";
import './GamePage.css';

export default function GamePage() {
  const apiBase = (process.env.REACT_APP_API_BASE?.replace(/\/+$/, '')) || '/api';
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [unlockedSteps, setUnlockedSteps] = useState({});
  const [answers, setAnswers] = useState({});
  const [resultMessages, setResultMessages] = useState({});
  const [answeredCorrect, setAnsweredCorrect] = useState({});
  const [activeScannerIndex, setActiveScannerIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [activeARIndex, setActiveARIndex] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const testMode = searchParams.get('test') === '1';

  const hasGPS = (game?.steps || []).some((s) => s?.triggerMethod === 'GPS');

  // map sizing + zoom
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [coverScale0, setCoverScale0] = useState(1);
  const [mapScale, setMapScale] = useState(1);
  const mapScrollRef = useRef(null);
  const mapCanvasRef = useRef(null);

  const [dialog, setDialog] = useState({ open: false });
  const openDialog = (opts) => setDialog({ open: true, ...opts });
  const closeDialog = () => setDialog({ open: false });

  const [activeCardIndex, setActiveCardIndex] = useState(null);

  // geolocation watch
  const [watching, setWatching] = useState(false);
  const watchIdRef = React.useRef(null);

  const [debug, setDebug] = useState(false);
  const [metrics, setMetrics] = useState({
    scroll: { w: 0, h: 0, sw: 0, sh: 0, sl: 0, st: 0 },
    canvas: { w: 0, h: 0 },
    scale: 1,
  });
  const [pinchDebug, setPinchDebug] = useState({
    active: false,
    factor: 1,
    count: 0,
    applied: false,
  });
  const scaleRef = useRef(1);
  useEffect(() => { scaleRef.current = mapScale; }, [mapScale]);

  // zoom around cursor
  const zoomAt = (nextScale, clientX, clientY) => {
    const sc = mapScrollRef.current;
    const cv = mapCanvasRef.current;
    if (!sc || !cv) { setMapScale(nextScale); return; }

    const rect = sc.getBoundingClientRect();
    const viewX = clientX - rect.left;
    const viewY = clientY - rect.top;

    const oldW = cv.offsetWidth;
    const oldH = cv.offsetHeight;

    const contentX = sc.scrollLeft + viewX;
    const contentY = sc.scrollTop + viewY;
    const rx = contentX / oldW;
    const ry = contentY / oldH;

    const s = Math.min(6, Math.max(0.5, nextScale));
    setMapScale(s);

    requestAnimationFrame(() => {
      const newW = cv.offsetWidth;
      const newH = cv.offsetHeight;
      sc.scrollLeft = Math.max(0, Math.min(rx * newW - viewX, sc.scrollWidth - sc.clientWidth));
      sc.scrollTop  = Math.max(0, Math.min(ry * newH - viewY, sc.scrollHeight - sc.clientHeight));
    });
  };

  // base size
  useEffect(() => {
    if (!game?.map?.imageUrl) return;
    const sc = mapScrollRef.current;
    if (!sc) return;
    setBaseSize({ w: sc.clientWidth, h: sc.clientHeight });
  }, [game?.map?.imageUrl]);

  useEffect(() => {
    if (!game?.steps?.length) return;
    const total = game.steps.length;
    const unlockedCount = Object.values(unlockedSteps || {}).filter(Boolean).length;
    if (total > 0 && unlockedCount === total) {
      openDialog({
        title: "You did it!",
        message: game.finalMessage || "You've completed the game. Thanks for playing!",
        confirmText: "Finish",
        onConfirm: () => closeDialog()
      });
    }
  }, [unlockedSteps, game]);

  const measure = () => {
    const sc = mapScrollRef.current;
    const cv = mapCanvasRef.current;
    if (!sc || !cv) return;
    setMetrics({
      scroll: { w: sc.clientWidth, h: sc.clientHeight, sw: sc.scrollWidth, sh: sc.scrollHeight, sl: sc.scrollLeft, st: sc.scrollTop },
      canvas: { w: cv.offsetWidth, h: cv.offsetHeight },
      scale: mapScale,
    });
  };

  useEffect(() => {
    const url = game?.map?.imageUrl;
    if (!url) return;
    const sc = mapScrollRef.current;
    if (!sc) return;

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setImgSize({ w, h });

      const s0 = Math.max(sc.clientWidth / w, sc.clientHeight / h);
      setCoverScale0(s0);

      requestAnimationFrame(() => {
        const renderW = w * s0 * scaleRef.current;
        const renderH = h * s0 * scaleRef.current;
        sc.scrollLeft = Math.max(0, (renderW - sc.clientWidth) / 2);
        sc.scrollTop  = Math.max(0, (renderH - sc.clientHeight) / 2);
      });
    };
    img.src = url;
  }, [game?.map?.imageUrl, baseSize.w, baseSize.h]);

  useEffect(() => {
    const sc = mapScrollRef.current;
    if (!sc) return;

    const pointers = new Map();
    let active = false;
    let rect = sc.getBoundingClientRect();

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid  = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) });
    const inside = (pt) => pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom;
    const getTwo = () => {
      const arr = [...pointers.values()];
      return arr.length >= 2 ? [arr[0], arr[1]] : null;
    };
    let lastD = 0;

    const startPinch = () => { if (active) return; sc.style.touchAction = 'none'; active = true; lastD = 0; };
    const endPinch   = () => { if (!active) return; active = false; lastD = 0; sc.style.touchAction = 'pan-x pan-y'; };

    const onPointerDown = (e) => {
      sc.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pair = getTwo();
      if (pair && inside(pair[0]) && inside(pair[1])) { startPinch(); e.preventDefault(); }
    };
    const onPointerMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pair = getTwo();
      if (!pair) return;
      if (!active && inside(pair[0]) && inside(pair[1])) startPinch();
      if (!active) return;
      e.preventDefault();
      const d = dist(pair[0], pair[1]);
      if (!lastD) { lastD = d; return; }
      const factor = d / lastD;
      if (Math.abs(factor - 1) > 0.01) {
        const m = mid(pair[0], pair[1]);
        const next = clamp(scaleRef.current * factor, 0.5, 6);
        zoomAt(next, m.x, m.y);
        lastD = d;
      }
    };
    const onPointerUpOrCancel = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) endPinch(); };

    sc.addEventListener('pointerdown',  onPointerDown,       { passive: false });
    sc.addEventListener('pointermove',  onPointerMove,       { passive: false });
    sc.addEventListener('pointerup',    onPointerUpOrCancel, { passive: false });
    sc.addEventListener('pointercancel',onPointerUpOrCancel, { passive: false });

    const onResize = () => { rect = sc.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);
    sc.style.touchAction = 'pan-x pan-y';

    return () => {
      sc.removeEventListener('pointerdown', onPointerDown);
      sc.removeEventListener('pointermove', onPointerMove);
      sc.removeEventListener('pointerup', onPointerUpOrCancel);
      sc.removeEventListener('pointercancel', onPointerUpOrCancel);
      window.removeEventListener('resize', onResize);
      sc.style.touchAction = 'pan-x pan-y';
    };
  }, [baseSize]);

  useEffect(() => {
    if (!game?.map?.imageUrl) return;
    const sc = mapScrollRef.current;
    if (sc) {
      setBaseSize({ w: sc.clientWidth, h: sc.clientHeight });
      requestAnimationFrame(() => {
        const cv = mapCanvasRef.current;
        if (!cv) return;
        sc.scrollLeft = Math.max(0, (cv.offsetWidth  - sc.clientWidth)  / 2);
        sc.scrollTop  = Math.max(0, (cv.offsetHeight - sc.clientHeight) / 2);
      });
    }
  }, [game?.map?.imageUrl]);

  // debug
  useEffect(() => { measure(); }, [mapScale, baseSize, game?.map?.imageUrl]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const loadGame = async () => {
      try {
        const res = await fetchGameById(id);
        setGame(res.data);
        setLoading(false);

        if (res.data?.map?.imageUrl) {
          setMapScale(1);
          requestAnimationFrame(() => {
            const sc = mapScrollRef.current;
            const cv = mapCanvasRef.current;
            if (sc && cv) {
              sc.scrollLeft = Math.max(0, (cv.offsetWidth  - sc.clientWidth)  / 2);
              sc.scrollTop  = Math.max(0, (cv.offsetHeight - sc.clientHeight) / 2);
            }
          });
        }

        const token = localStorage.getItem('token');
        if (token) {
          const decoded = jwtDecode(token);
          setRole(decoded.role);
        }
      } catch (err) {
        console.error('Error loading game:', err);
      }
    };
    loadGame();
  }, [id]);

  const toRad = (val) => (val * Math.PI) / 180;
  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleUnlockAR = (index) => setUnlockedSteps((prev) => ({ ...prev, [index]: true }));

  const unlockAndOpen = (i) => {
    setUnlockedSteps((prev) => {
      if (prev[i]) return prev;
      const next = { ...prev, [i]: true };
      openDialog({
        title: 'Congrats!',
        message: 'Location confirmed! You’ve unlocked this mission.',
        confirmText: 'Open',
        onConfirm: () => { closeDialog(); setActiveCardIndex(i); }
      });
      return next;
    });
  };

  const toggleWatch = () => {
    if (!navigator.geolocation) {
      openDialog({ title: 'Geolocation', message: 'Geolocation is not supported on this device.', onConfirm: closeDialog });
      return;
    }
    if (!watching) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          (game.steps || []).forEach((s, i) => {
            const gps = s?.gps;
            if (!gps || !gps.lat || !gps.lon || !gps.radius) return;
            const d = distanceMeters(latitude, longitude, Number(gps.lat), Number(gps.lon));
            if (d <= Number(gps.radius)) unlockAndOpen(i);  // no direct open here
          });
        },
        (err) => { console.error('watchPosition error', err); },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
      watchIdRef.current = id; setWatching(true);
    } else {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null; setWatching(false);
    }
  };

  // map pin pixel position
  const pinPx = (pos) => {
    const s = coverScale0 * mapScale;
    const isNormalized =
      pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) &&
      pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1;

    const left = (isNormalized ? pos.x * imgSize.w : pos.x) * s;
    const top  = (isNormalized ? pos.y * imgSize.h : pos.y) * s;
    return { left: `${left}px`, top: `${top}px` };
  };

  if (!game || loading) return <p>Loading game...</p>;

  const handleQRDetect = (index, data) => {
    if (index === 'global') {
      const found = (game.steps || []).findIndex((s) => (s.qrCode || '') === data);
      if (found >= 0) {
        setUnlockedSteps((prev) => ({ ...prev, [found]: true }));
        setActiveScannerIndex(null);
        openDialog({
          title: 'Congrats!',
          message: 'QR matched. You unlocked this mission.',
          confirmText: 'Open',
          onConfirm: () => { closeDialog(); setActiveCardIndex(found); }
        });
      } else {
        openDialog({
          title: 'No match',
          message: 'No mission matches this QR code.',
          confirmText: 'OK',
          onConfirm: closeDialog,
        });
      }
      return;
    }
    const expected = game.steps[index].qrCode;
    if (data === expected) {
      setUnlockedSteps((prev) => ({ ...prev, [index]: true }));
      setActiveScannerIndex(null);
      openDialog({
        title: 'Congrats!',
        message: 'QR matched. You unlocked this mission.',
        confirmText: 'Open',
        onConfirm: () => { closeDialog(); setActiveCardIndex(index); }
      });
    } else {
      openDialog({
        title: "Oops",
        message: "That QR doesn't match this step. Try again.",
        confirmText: "OK",
        onConfirm: closeDialog
      });
    }
  };

  const handleAnswerSubmit = (index) => {
    const input = (answers[index] || '').trim().toLowerCase();
    const correct = (game.steps[index].correctAnswer || '').trim().toLowerCase();

    const isCorrect = input === correct && correct.length > 0;

    setResultMessages((prev) => ({
      ...prev,
      [index]: isCorrect ? game.steps[index].correctMessage : game.steps[index].wrongMessage,
    }));

    if (isCorrect) {
      setAnsweredCorrect((prev) => ({ ...prev, [index]: true }));
      openDialog({
        title: 'Correct! 🎉',
        message: game.steps[index].correctMessage || 'Nice work!',
        confirmText: 'Close',
        onConfirm: closeDialog
      });
    } else {
      openDialog({
        title: 'Try again',
        message: game.steps[index].wrongMessage || 'That answer is not correct yet.',
        confirmText: 'Close',
        onConfirm: closeDialog
      });
    }
  };

  const handleLocationDetect = (index) => {
    if (!navigator.geolocation) {
      openDialog({ title: 'Geolocation', message: 'Geolocation is not supported by your browser.', onConfirm: closeDialog });
      return;
    }
    const gps = game.steps[index]?.gps;
    if (!gps || !gps.lat || !gps.lon || !gps.radius) {
      openDialog({ title: 'GPS missing', message: 'No valid GPS data for this mission.', onConfirm: closeDialog });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const R = 6371000;
        const dLat = toRad(gps.lat - userLat);
        const dLon = toRad(gps.lon - userLon);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(userLat)) * Math.cos(toRad(gps.lat)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance <= gps.radius) {
          setUnlockedSteps((prev) => ({ ...prev, [index]: true }));
          openDialog({
            title: "Congrats!",
            message: "Location confirmed! You've unlocked this mission.",
            confirmText: "Open",
            onConfirm: () => { closeDialog(); setActiveCardIndex(index); }
          });
        } else {
          openDialog({
            title: 'Too far',
            message: `You are ${Math.round(distance)}m from the target. Move closer and try again.`,
            confirmText: 'OK',
            onConfirm: closeDialog,
          });
        }
      },
      (error) => {
        console.error(error);
        openDialog({ title: 'Geolocation', message: 'Unable to retrieve your location.', onConfirm: closeDialog });
      }
    );
  };

  return (
    <div className="game-play-page">
      {game.coverImage && (
        <div className="game-cover-container">
          <img src={game.coverImage} alt="Game Cover" className="game-cover-image" />
        </div>
      )}

      <h1>{game.title}</h1>
      {game.intro && <p className="description">{game.intro}</p>}

      {/* Full-page map */}
      {game.map?.imageUrl && (
        <div className={`map-fullscreen ${debug ? 'debug-on' : ''}`} role="dialog" aria-label="Map">
          <div className="map-toolbar">
            <div className="map-tools-left">
              <button className="map-close" onClick={() => navigate(-1)}>🏠</button>
              <button className="map-close" onClick={() => setActiveCardIndex('intro')}>ⓘ</button>
            </div>
            <div className="map-tools-right">
              <button className="map-tool" onClick={() => setActiveScannerIndex('global')}>⛶QR</button>

              {testMode && <span className="badge test">TEST MODE</span>}
              {testMode && (
                <>
                  <button className="map-tool" onClick={() => setUnlockedSteps({})} title="Lock all missions again">
                    Reset Locks
                  </button>
                  <button
                    className="map-tool"
                    onClick={() => {
                      const all = {};
                      (game.steps || []).forEach((_, i) => (all[i] = true));
                      setUnlockedSteps(all);
                      openDialog({
                        title: 'All unlocked',
                        message: 'All missions unlocked for testing.',
                        onConfirm: closeDialog,
                      });
                    }}
                    title="Unlock every mission"
                  >
                    Unlock All
                  </button>
                </>
              )}

              {hasGPS && (
                <button className={`map-tool ${watching ? 'on' : ''}`} onClick={toggleWatch}>
                  {watching ? 'GPS:ON🟢' : 'GPS:OFF🔴'}
                </button>
              )}
            </div>
          </div>

          <div className="map-scroll" ref={mapScrollRef}>
            <div
              className="map-canvas"
              ref={mapCanvasRef}
              style={{
                width:  imgSize.w * coverScale0 * mapScale + 'px',
                height: imgSize.h * coverScale0 * mapScale + 'px',
              }}
            >
              <img
                src={game.map.imageUrl}
                alt="Map"
                className="map-img"
                style={{
                  width:  imgSize.w * coverScale0 * mapScale + 'px',
                  height: imgSize.h * coverScale0 * mapScale + 'px',
                }}
              />
              {(game.steps || []).map((s, i) => {
                const pos = s.mapPos || {};
                const hasPos = Number.isFinite(pos.x) && Number.isFinite(pos.y);
                if (!hasPos) return null;
                const unlocked = !!unlockedSteps[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className={`map-pin ${unlocked ? 'unlocked' : 'locked'}`}
                    style={pinPx(pos)}
                    data-i={i}
                    title={(s.title || `Mission ${i + 1}`) + (unlocked ? '' : ' (locked)')}
                    onClick={() => setActiveCardIndex(i)}
                    onPointerDown={(e) => {
                      if (e.pointerType === 'mouse') {
                        e.stopPropagation();
                        setActiveCardIndex(i);
                      }
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="map-legend">
            <span className="dot unlocked" /> Unlocked
            <span className="dot locked" /> Locked
          </div>
        </div>
      )}

      {Number.isInteger(activeCardIndex) && (() => {
        const i = activeCardIndex;
        const s = game.steps[i] || {};
        const unlocked = !!unlockedSteps[i];
        const solved = !!answeredCorrect[i];

        return (
          <Modal
            open
            title={s.title || `Mission ${i + 1}`}
            confirmText="Close"
            onConfirm={() => setActiveCardIndex(null)}
            onCancel={() => setActiveCardIndex(null)}
          >
            {s.hintImageUrl && <img src={s.hintImageUrl} alt="Hint" className="modal-hero" />}
            {s.hintText && <p className="modal-msg"><strong>Hint:</strong> {s.hintText}</p>}
            {s.triggerMethod === 'AR' && s.arImageUrl && (
              <img
                src={s.arImageUrl}
                alt="AR Target Preview"
                className="modal-hero"
                style={{ border: '1px solid #ccc', borderRadius: '8px' }}
              />
            )}

            {!unlocked && (
              <>
                <p className="modal-msg" style={{color:'#b91c1c', fontWeight:600}}>
                  This mission is locked. Use a trigger to unlock.
                </p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                  <button className="btn" onClick={() => setActiveScannerIndex(i)}>⛶ QR</button>
                  {s.triggerMethod === 'GPS' && (
                    <button className="btn" onClick={() => handleLocationDetect(i)}>Detect location</button>
                  )}
                  {s.triggerMethod === 'AR' && (
                    <button className="btn" onClick={() => setActiveARIndex(i)}>⛶ AR</button>
                  )}
                </div>
              </>
            )}

            {unlocked && (
              s.missionType === 'information' ? (
                <div className="modal-msg" style={{ whiteSpace:'pre-line' }}>{s.message}</div>
              ) : (
                <>
                  <p className="modal-msg"><strong>Question:</strong></p>
                  <p className="modal-msg" style={{ whiteSpace:'pre-line', marginTop: -8 }}>{s.question}</p>

                  {solved ? (
                    <div className="solved-box">
                      <div className="solved-row">✅ <strong>Solved</strong></div>
                      {s.correctAnswer && (
                        <div className="solved-answer">Correct answer: <code>{s.correctAnswer}</code></div>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={answers[i] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Type your answer"
                        className="form-control full"
                        style={{ marginBottom: 10 }}
                      />
                      <button className="btn primary" onClick={() => handleAnswerSubmit(i)}>Submit</button>
                    </>
                  )}
                </>
              )
            )}
          </Modal>
        );
      })()}

      {activeCardIndex === 'intro' && (
        <Modal
          open
          title={game.title}
          confirmText="Close"
          onConfirm={() => setActiveCardIndex(null)}
          onCancel={() => setActiveCardIndex(null)}
        >
          {game.coverImage && <img src={game.coverImage} alt="Cover" className="modal-hero" />}
          {game.intro && <p className="modal-msg">{game.intro}</p>}
        </Modal>
      )}

      {game.steps.map((step, i) => {
        const type = step.missionType || 'short-answer';
        return (
          <div key={i} className="step-block">
            <h3>{step.title || `Mission ${i + 1}`}</h3>

            {!unlockedSteps[i] ? (
              <>
                {step.hintImageUrl && <img src={step.hintImageUrl} alt="Hint" className="hint-img" />}
                {step.triggerMethod === 'AR' && step.arImageUrl && (
                  <div style={{ marginTop: '10px' }}>
                    <p><strong>AR Target (For dev testing):</strong></p>
                    <img
                      src={step.arImageUrl}
                      alt="AR Target"
                      style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: '6px', marginTop: '4px' }}
                    />
                  </div>
                )}

                <p><strong>Hint:</strong> {step.hintText}</p>

                <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
                  {step.triggerMethod === 'GPS' && (
                    <button className="mission-button" onClick={() => handleLocationDetect(i)}>Detect my Location</button>
                  )}
                  {step.triggerMethod === 'AR' && (
                    <button
                      className="mission-button"
                      disabled={!Number.isInteger(step.arTargetIndex)}
                      title={Number.isInteger(step.arTargetIndex) ? '' : 'Upload AR image + .mind first'}
                      onClick={() => setActiveARIndex(i)}
                    >
                      Start AR Scanner
                    </button>
                  )}
                  <button className="mission-button" onClick={() => setActiveScannerIndex(i)}>Scan QR</button>
                  {role === 'Mod' && (
                    <button className="mission-button" onClick={() => setUnlockedSteps((prev) => ({ ...prev, [i]: true }))}>
                      Skip this step (Mod only)
                    </button>
                  )}
                </div>

                {activeScannerIndex === i && (
                  <div className="qr-overlay">
                    <QRCodeReader onDetect={(data) => handleQRDetect(i, data)} onClose={() => setActiveScannerIndex(null)} />
                  </div>
                )}
              </>
            ) : (
              <>
                {type === 'information' ? (
                  <div className="info-box">
                    <p style={{ whiteSpace: 'pre-line' }}>{step.message}</p>
                  </div>
                ) : (
                  <>
                    <p><strong>Question:</strong></p>
                    <p style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{step.question}</p>
                    <input
                      type="text"
                      value={answers[i] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                      placeholder="Type your answer"
                    />
                    <button onClick={() => handleAnswerSubmit(i)}>Submit</button>
                    {resultMessages[i] && <p className="result-msg">{resultMessages[i]}</p>}
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {activeARIndex !== null && (() => {
        const step = game.steps[activeARIndex] || {};
        const targetIndex = Number.isInteger(step.arTargetIndex) ? step.arTargetIndex : activeARIndex;
        const mindFileUrl = `${apiBase}/ar/mindfile/${game._id}/${targetIndex}`;

        return (
          <ARViewer
            mindFileUrl={mindFileUrl}
            targetIndex={targetIndex}
            onDetect={() => {
              handleUnlockAR(activeARIndex);
              openDialog({
                title: 'Congrats!',
                message: 'You found the AR target.',
                confirmText: 'Open',
                onConfirm: () => { closeDialog(); setActiveCardIndex(activeARIndex); }
              });
            }}
            onClose={() => setActiveARIndex(null)}
          />
        );
      })()}

      {activeScannerIndex === 'global' && (
        <div className="qr-overlay">
          <QRCodeReader onDetect={(data) => handleQRDetect('global', data)} onClose={() => setActiveScannerIndex(null)} />
        </div>
      )}

      <Modal
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        image={dialog.image}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm || closeDialog}
        onCancel={dialog.onCancel}
      />
    </div>
  );
}

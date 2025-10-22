import React, { useEffect, useRef, useState } from 'react';

export default function ARViewer({ mindFileUrl, targetIndex = 0, onClose, onDetect }) {
  const containerRef = useRef();
  const [targetFound, setTargetFound] = useState(false);

  useEffect(() => {
    if (!mindFileUrl) {
      alert('Missing AR target file');
      onClose();
      return;
    }

    const sceneWrapper = document.createElement('iframe');
    sceneWrapper.srcdoc = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
        </head>
        <body style="margin: 0; overflow: hidden;">
          <a-scene
            mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false"
            embedded
            style="width: 100vw; height: 100vh"
          >
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
            ${Array.from({ length: 10 }).map((_, i) => `
              <a-entity id="ar-target-${i}" mindar-image-target="targetIndex: ${i}">
                <a-plane color="blue" opacity="0.5" position="0 0 0" height="1" width="1"></a-plane>
              </a-entity>
            `).join('')}
          </a-scene>
        </body>
      </html>
    `;

    sceneWrapper.style.width = '100%';
    sceneWrapper.style.height = '100%';
    sceneWrapper.style.border = 'none';
    sceneWrapper.allow = 'camera *';

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(sceneWrapper);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [mindFileUrl]);

  useEffect(() => {
    const interval = setInterval(() => {
      const iframe = containerRef.current?.querySelector('iframe');
      const iframeDoc = iframe?.contentDocument;

      if (!iframeDoc) return;

      const scene = iframeDoc.querySelector('a-scene');
      if (!scene || scene.hasAttribute('data-event-attached')) return;

      scene.setAttribute('data-event-attached', 'true');

      const targets = iframeDoc.querySelectorAll('[mindar-image-target]');
      targets.forEach(target => {
        target.addEventListener('targetFound', () => {
          console.log('[ARViewer] Target found!');
          setTargetFound(true);
        });
      });

      clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      zIndex: 9999,
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {targetFound && (
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10001,
          textAlign: 'center',
          maxWidth: '90vw',
        }}>
          <h2>Congrats!</h2>
          <p>You found the AR target.</p>
          <button
            onClick={() => {
              onDetect?.();
              onClose?.();
            }}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Confirm
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10000,
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          padding: '8px 14px',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Close
      </button>
    </div>
  );
}

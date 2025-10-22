import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import './QRCodeReader.css';

export default function QRCodeReader({ onDetect, onClose }) {
  const scanner = useRef(null);

  useEffect(() => {
    const qrRegionId = "qr-reader";
    scanner.current = new Html5Qrcode(qrRegionId);

    scanner.current
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          setTimeout(() => {
            scanner.current.stop()
              .then(() => {
                onDetect(decodedText);
                onClose();
              })
              .catch(() => {
                onDetect(decodedText);
                onClose();
              });
          }, 700); // 700ms delay
        },
        (errorMsg) => {}
      );

    return () => {
      if (scanner.current && scanner.current.getState() === 2) {
        scanner.current.stop().catch(() => {});
      }
    };
  }, [onDetect]);

  const handleClose = () => {
    if (scanner.current && scanner.current.getState() === 2) {
      scanner.current.stop().then(onClose).catch(onClose);
    } else {
      onClose();
    }
  };

  return (
    <div className="qr-overlay">
      <div id="qr-reader" />
      <button className="close-button" onClick={handleClose}>✕</button>
    </div>
  );
}

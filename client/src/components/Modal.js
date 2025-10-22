import React from "react";
import "./modal.css";

export default function Modal({
  open,
  title,
  message,
  image,
  confirmText = "OK",
  cancelText,
  onConfirm,
  onCancel,
  children, 
}) {
  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onCancel || onConfirm}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          {onCancel && (
            <button className="modal-x" onClick={onCancel} aria-label="Close">×</button>
          )}
        </div>

        {image && <img src={image} alt="" className="modal-hero" />}
        {children ? children : (message && <p className="modal-msg">{message}</p>)}

        <div className="modal-actions">
          {cancelText && <button className="btn" onClick={onCancel}>{cancelText}</button>}
          <button className="btn primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

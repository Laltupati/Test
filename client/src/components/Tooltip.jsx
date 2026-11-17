import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const Tooltip = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const hideTimer = useRef(null);

  const show = useCallback((e) => {
    clearTimeout(hideTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10,
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 100);
  }, []);

  const keepVisible = useCallback(() => {
    clearTimeout(hideTimer.current);
    setVisible(true);
  }, []);

  if (!text) return children;

  // Clone the child to attach mouse events WITHOUT wrapping in a new element.
  // This preserves -webkit-line-clamp on .card-desc.
  const child = React.cloneElement(children, {
    onMouseEnter: show,
    onMouseLeave: hide,
  });

  const tooltip = (
    <div
      className={`tooltip${visible ? ' show' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, 0)',
      }}
      onMouseEnter={keepVisible}
      onMouseLeave={hide}
    >
      {text}
    </div>
  );

  return (
    <>
      {child}
      {createPortal(tooltip, document.body)}
    </>
  );
};

export default Tooltip;



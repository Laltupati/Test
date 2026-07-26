import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toolDetails from '../data/toolDetails';

const TRANSITION_MS = 340; // must match CSS transition duration

const ToolDetailsSheet = ({ toolId, tutorialUrl, output, tools, onClose }) => {
  const [isOpen, setIsOpen]     = useState(false);
  const [activeId, setActiveId] = useState(null); // id to render while animating
  const closeTimer = useRef(null);

  // --- Open: new toolId arrives ---
  useEffect(() => {
    if (toolId) {
      clearTimeout(closeTimer.current);
      setActiveId(toolId);          // mount content immediately
      // Small RAF delay so the browser paints the hidden state first,
      // then adds is-open → triggers slide-up transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
    }
  }, [toolId]);

  // --- Close: toolId cleared ---
  useEffect(() => {
    if (!toolId && isOpen) {
      setIsOpen(false);             // remove is-open → triggers slide-down
      closeTimer.current = setTimeout(() => {
        setActiveId(null);          // unmount content after animation
      }, TRANSITION_MS);
    }
  }, [toolId]);

  // Keyboard & body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleKeydown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeydown);
    document.body.classList.add('tool-sheet-open');
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.classList.remove('tool-sheet-open');
    };
  }, [isOpen, onClose]);

  // Don't render anything if there's no content at all
  if (!activeId) return null;

  const details = toolDetails[activeId] || {
    title: 'Tool Information',
    overview: 'Details are not available for this tool yet.',
    capabilities: ['Tool overview and key capabilities will be added soon.']
  };

  return createPortal(
    <div className={`tool-sheet${isOpen ? ' is-open' : ''}`}>
      {/* Dimmed overlay — click to close */}
      <div className="tool-sheet__overlay" onClick={onClose} />

      <section
        className="tool-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tool-sheet__handle" />

        <div className="tool-sheet__head">
          <div className="tool-sheet__title-wrap">
            <p className="tool-sheet__eyebrow">Tool Details</p>
            <h3 className="tool-sheet__title" id="tool-sheet-title">
              {details.title}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              className="btn-g" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '7px', 
                padding: '9px 18px', 
                fontSize: '13px',
                fontWeight: '700',
                background: '#0051BA',
                color: '#ffffff',
                border: '1px solid #003388',
                borderRadius: '6px',
                cursor: tutorialUrl ? 'pointer' : 'default',
                opacity: tutorialUrl ? 1 : 0.5,
              }}
              onClick={(e) => {
                e.preventDefault();
                if (tutorialUrl) window.open(tutorialUrl, '_blank');
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
              Tutorial
            </button>
            <button
              type="button"
              className="tool-sheet__close"
              aria-label="Close tool details"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className="tool-sheet__body">
          <div className="tool-sheet__section">
            <p className="tool-sheet__label">Tool Overview</p>
            <p className="tool-sheet__overview">{details.overview}</p>
          </div>

          <div className="tool-sheet__section">
            <p className="tool-sheet__label">Key Capabilities</p>
            <ul className="tool-sheet__list">
              {details.capabilities.map((cap, i) => (
                <li key={i}>{cap}</li>
              ))}
            </ul>
          </div>

          {output && output.length > 0 && (
            <div className="tool-sheet__section">
              <p className="tool-sheet__label">Output Formats</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {output.map((o, i) => (
                  <span key={i} className="spec-chip">{o}</span>
                ))}
              </div>
            </div>
          )}

          {tools && tools.length > 0 && (
            <div className="tool-sheet__section">
              <p className="tool-sheet__label">Tools &amp; Technologies</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {tools.map((t, i) => (
                  <span key={i} className="spec-chip">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
};

export default ToolDetailsSheet;


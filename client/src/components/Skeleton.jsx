/**
 * Skeleton Loaders
 * Reusable skeleton placeholder components shown while data loads from the backend.
 *
 * Exports:
 *  - SkeletonCategoryPage   – domain tile grid (CategoryPage)
 *  - SkeletonUseCaseCards   – agent card grid (UseCases)
 *  - SkeletonJourneySolutions – journey solution cards (AiAgents Phase 3)
 */

import React from 'react';
import '../assets/css/skeleton.css';

/* ── shared helper ── */
const Sk = ({ className = '', style }) => (
  <div className={`sk-shimmer ${className}`} style={style} />
);

/* ════════════════════════════════════════════════════════════
   1. CATEGORY PAGE — domain tile grid
   ════════════════════════════════════════════════════════════ */
export const SkeletonCategoryPage = ({ sections = 2, tilesPerSection = 4 }) => (
  <>
    {Array.from({ length: sections }).map((_, si) => (
      <div key={si} className="sk-cat-section">
        <Sk className="sk-block sk-cat-section-title" />
        <div className="sk-cat-grid">
          {Array.from({ length: tilesPerSection }).map((_, ti) => (
            <Sk key={ti} className="sk-cat-tile" />
          ))}
        </div>
      </div>
    ))}
  </>
);

/* ════════════════════════════════════════════════════════════
   2. USE CASE CARDS — agent card grid
   ════════════════════════════════════════════════════════════ */
export const SkeletonUseCaseCards = ({ count = 8 }) => (
  <>
    {/* Filter bar shimmer */}
    <div className="sk-filter-bar">
      {['pill-wide', 'pill', 'pill-sm', 'pill', 'pill-wide', 'pill-sm'].map((v, i) => (
        <Sk key={i} className={`sk-shimmer sk-pill sk-${v}`} />
      ))}
    </div>

    {/* Card grid shimmer */}
    <div className="sk-cards-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-card">
          <Sk className="sk-card-image" />
          <Sk className="sk-card-badge" />
          <Sk className="sk-block sk-card-title" />
          <Sk className="sk-block sk-card-desc-1" />
          <Sk className="sk-block sk-card-desc-2" />
          <Sk className="sk-card-btn" />
        </div>
      ))}
    </div>
  </>
);

/* ════════════════════════════════════════════════════════════
   3. JOURNEY SOLUTIONS — mini solution cards in Phase 3
   ════════════════════════════════════════════════════════════ */
export const SkeletonJourneySolutions = ({ count = 4 }) => (
  <div className="sk-solutions-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="sk-sol-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Sk className="sk-shimmer sk-sol-title" />
          <Sk className="sk-shimmer sk-sol-status" />
        </div>
        <Sk className="sk-shimmer sk-sol-line" />
        <Sk className="sk-shimmer sk-sol-line-short" />
        <Sk className="sk-shimmer sk-sol-btn" />
      </div>
    ))}
  </div>
);

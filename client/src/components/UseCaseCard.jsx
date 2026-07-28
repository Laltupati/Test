import React from 'react';
import AppIcon from './AppIcon';

const UseCaseCard = ({ uc, onInfoClick }) => {
  const outputItems = Array.isArray(uc.output) ? uc.output : [];
  const toolItems = Array.isArray(uc.tools) ? uc.tools : [];

  return (
    <div className="card" style={{ '--dc': uc.color }}>
      <div className="card-bar"></div>
      <div className="card-vis">
        <div 
          className="vis-bg" 
          style={{ 
            backgroundImage: uc.image 
              ? `url("${uc.image}")` 
              : `linear-gradient(145deg, ${uc.color}33, ${uc.color}66)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {!uc.image && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: uc.color || '#003087' }}>
              <AppIcon name={uc.icon} size={52} strokeWidth={1.25} />
            </div>
          )}
        </div>
        {!uc.image && (
          <div className="card-icon">
            <AppIcon name={uc.icon} size={28} strokeWidth={1.5} style={{ color: uc.color || '#003087' }} />
          </div>
        )}

      </div>
      <div className="card-body">
        <div className="card-dom">{uc.domainLabel}</div>
        <div className="card-title">{uc.title}</div>

        <div className="card-desc" title={uc.description}>{uc.description}</div>
      </div>
      <div className="card-foot">
        {/* i button — opens ToolDetailsSheet */}
        <button
          className="btn-i"
          type="button"
          aria-label="View tool details"
          aria-expanded="false"
          onClick={() => onInfoClick({ id: uc.id, tutorialUrl: uc.tutorialUrl, output: uc.output, tools: uc.tools })}
        >
          Info
        </button>
        {uc.launchUrl && (
          <button 
            className="btn-l" 
            disabled={uc.status === 'Coming Soon'}
            onClick={() => {
              if (uc.launchUrl && uc.status !== 'Coming Soon') {
                window.open(uc.launchUrl, '_blank');
              }
            }}
          >
            {uc.status === 'Coming Soon' ? 'Coming Soon' : 'Launch'}
          </button>
        )}
      </div>
    </div>
  );
};

export default UseCaseCard;


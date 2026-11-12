import React, { useState, useEffect } from 'react';
import type { Project } from '../../types';
import { getEmbedUrl } from '../../utils/videoHelpers';

interface SplitModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

const getPhaseBadge = (phase: string) => {
  switch (phase) {
    case 'Concept': return '🔵 Architecture';
    case 'Dev': return '🟡 Development';
    case 'Live': return '🟢 Production Live';
    default: return phase;
  }
};

const SplitModal: React.FC<SplitModalProps> = ({ project, isOpen, onClose }) => {
  const [activeResource, setActiveResource] = useState<{ type: string; url: string | null; embed_code: string | null } | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      setIframeError(false);
      setIsDescExpanded(false);
      // Set default resource to video if available, otherwise first available
      const videoResource = project.resources.find(r => r.resource_type === 'video');
      const firstResource = project.resources[0];
      const defaultResource = videoResource || firstResource;
      if (defaultResource) {
        setActiveResource({ type: defaultResource.resource_type, url: defaultResource.url, embed_code: defaultResource.embed_code });
      } else {
        setActiveResource(null);
      }
      setIframeKey(prev => prev + 1);
    }
  }, [isOpen, project]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const handleResourceClick = (resource: { type: string; url: string | null; embed_code: string | null }) => {
    setActiveResource(resource);
    setIframeError(false);
    setIframeKey(prev => prev + 1);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return 'fa-solid fa-play';
      case 'docs': return 'fa-solid fa-file-lines';
      case 'github': return 'fa-brands fa-github';
      default: return 'fa-solid fa-link';
    }
  };

  const getResourceLabel = (type: string) => {
    switch (type) {
      case 'video': return 'Video Demo';
      case 'docs': return 'Documentation';
      case 'github': return 'GitHub Repository';
      default: return type;
    }
  };

  const isGitHubUrl = activeResource?.type === 'github' || 
    (activeResource?.url && (
      activeResource.url.includes('github.com') || 
      activeResource.url.includes('github.io')
    ));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-7xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-fade-in-up border border-slate-300 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/90 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md shadow-lg"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Left Panel: Blueprint Details */}
        <div className="w-full md:w-[35%] bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 bg-white border-b border-slate-200 shadow-sm z-10 flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <i className="fa-solid fa-microchip"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{project.title}</h2>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                {project.client_name ? `Client: ${project.client_name}` : 'Architecture Blueprint'}
              </p>
            </div>
          </div>
          
          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto flex-grow space-y-6">
            {/* Lifecycle Badges */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Lifecycle Stage</label>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                  {getPhaseBadge(project.phase)}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Core Scope & Objectives</label>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {!isDescExpanded && project.description.length > 300
                    ? `${project.description.slice(0, 300)}...`
                    : project.description}
                </p>
                {project.description.length > 300 && (
                  <button
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-2 focus:outline-none flex items-center gap-1"
                  >
                    <span>{isDescExpanded ? 'Show less' : 'Show more'}</span>
                    <i className={`fa-solid ${isDescExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                  </button>
                )}
              </div>
            </div>

            {/* Architecture Capabilities */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Architectural Modules</label>
              <ul className="text-xs text-slate-700 space-y-2 list-none">
                {project.capabilities.map((cap) => (
                  <li key={cap.id} className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">
                      <i className="fa-solid fa-check-circle text-xs"></i>
                    </span>
                    <span>{cap.capability}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Toggle Viewing Resources */}
            <div className="pt-2 border-t border-slate-200">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">View Interactive Media</label>
              <div className="flex flex-col gap-2">
                {project.resources.map((resource) => (
                  <div key={resource.id} className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleResourceClick({ type: resource.resource_type, url: resource.url, embed_code: resource.embed_code })}
                      className={`flex-1 flex items-center space-x-3 px-4 py-3 rounded-lg border transition-all text-left ${
                        activeResource?.url === resource.url && activeResource?.embed_code === resource.embed_code
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <i className={`${getResourceIcon(resource.resource_type)} text-sm`}></i>
                      <span className="text-xs font-medium">{getResourceLabel(resource.resource_type)}</span>
                    </button>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white border border-slate-200 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                        title="Open link directly in a new tab"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Video / Docs / GitHub Viewer */}
        <div className="w-full md:w-[65%] bg-slate-900 relative flex flex-col h-full">
          
          {/* Top Bar with Direct External Link Action & GitHub Enterprise SSO */}
          {activeResource && activeResource.url && (
            <div className="bg-slate-800/90 backdrop-blur-md px-6 py-3 border-b border-slate-700/80 flex items-center justify-between z-20 shadow-sm">
              <div className="flex items-center space-x-2 text-slate-300 text-xs font-medium truncate max-w-[50%]">
                <i className={`${getResourceIcon(activeResource.type)} text-blue-400`}></i>
                <span className="truncate">{getResourceLabel(activeResource.type)}:</span>
                <span className="text-slate-400 truncate font-mono text-[11px]">{activeResource.url}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {isGitHubUrl && (
                  <a
                    href="https://github.com/enterprises/kpmg-emu/sso"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                    title="Sign in with KPMG GitHub Enterprise SSO to access protected repositories and docs"
                  >
                    <i className="fa-brands fa-github text-sm"></i>
                    <span>KPMG GitHub Enterprise Login</span>
                  </a>
                )}
                <a
                  href={activeResource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md"
                  title="Open link directly in a new browser tab"
                >
                  <span>Open in New Tab</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
              </div>
            </div>
          )}

          {/* Loading overlay - only show when no resource is available */}
          {!activeResource && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-3 text-slate-400"></i>
              <span className="text-sm font-medium">Loading Resource...</span>
            </div>
          )}

          {/* Render Embed Code (YouTube / Custom iFrames) */}
          {activeResource && activeResource.embed_code ? (
            <div
              key={iframeKey}
              className="relative w-full h-full z-10 bg-transparent overflow-hidden flex-grow"
            >
              <style>{`
                .embed-container iframe {
                  width: 100% !important;
                  height: 100% !important;
                  max-width: 100% !important;
                  max-height: 100% !important;
                  object-fit: cover;
                }
              `}</style>
              <div
                className="embed-container w-full h-full"
                dangerouslySetInnerHTML={{ __html: activeResource.embed_code }}
              />
            </div>
          ) : activeResource && activeResource.url ? (
            <div className="relative w-full h-full z-10 bg-transparent overflow-hidden flex-grow">
              {/* GitHub & Documentation Launchpad View (Bypasses Browser X-Frame-Options DENY) */}
              {isGitHubUrl ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-200 p-8 text-center bg-slate-900/95">
                  <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-100 text-4xl mb-6 shadow-xl">
                    <i className={activeResource?.type === 'docs' || activeResource?.url?.includes('github.io') ? "fa-solid fa-file-lines text-blue-400" : "fa-brands fa-github text-white"}></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-white">{project.title} {activeResource?.type === 'docs' ? 'Documentation' : 'Repository'}</h3>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    Browser security policies (<code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">X-Frame-Options: DENY</code>) prevent GitHub pages from rendering inside embedded frames. Click below to open the resource directly in a new tab.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <a
                      href={activeResource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center justify-center space-x-2.5"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-sm"></i>
                      <span>Open {activeResource?.type === 'docs' ? 'Documentation' : 'Repository'} in New Tab</span>
                    </a>
                    <a
                      href="https://github.com/enterprises/kpmg-emu/sso"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center space-x-2"
                      title="Re-authenticate if you are not currently signed into KPMG GitHub Enterprise"
                    >
                      <i className="fa-solid fa-shield-halved text-xs text-slate-400"></i>
                      <span>KPMG SSO Portal</span>
                    </a>
                  </div>
                </div>
              ) : !iframeError ? (
                <iframe
                  key={iframeKey}
                  src={getEmbedUrl(activeResource.url) || activeResource.url}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  title={project.title}
                  onError={() => setIframeError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 p-8 text-center bg-slate-900/95">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-3xl mb-4">
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">External Link Security Policy</h4>
                  <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                    This external documentation or video resource enforces security restrictions that prevent iframe embedding.
                  </p>
                  <a
                    href={activeResource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center space-x-2"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>Open Resource in New Tab</span>
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default SplitModal;

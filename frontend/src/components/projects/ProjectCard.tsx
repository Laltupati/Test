import React from 'react';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onViewDetails: (project: Project) => void;
}

const getPhaseBadge = (phase: string) => {
  switch (phase) {
    case 'Concept': return '🔵';
    case 'Dev': return '🟡';
    case 'Live': return '🟢';
    default: return '';
  }
};

const getPhaseTitle = (phase: string) => {
  switch (phase) {
    case 'Concept': return 'Architecture Phase';
    case 'Dev': return 'In Development';
    case 'Live': return 'Live/Production';
    default: return '';
  }
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onViewDetails }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const badges = project.phase === 'Concept' ? '🔵' : project.phase === 'Dev' ? '🟡' : '🟢';
  const tags = project.tags.map(t => t.name).join(',');

  const isLongDescription = project.description.length > 300;
  const displayDescription = !isExpanded && isLongDescription
    ? `${project.description.slice(0, 300)}...`
    : project.description;

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between animate-fade-in-up"
      data-badges={badges}
      data-tags={tags}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-slate-900 text-base">{project.title}</h3>
          <div className="flex space-x-1 text-sm">
            <span title={getPhaseTitle(project.phase)}>{getPhaseBadge(project.phase)}</span>
          </div>
        </div>
        {project.client_name && (
          <div className="flex items-center mb-2">
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-semibold uppercase tracking-wider">
              <i className="fa-solid fa-building mr-1"></i>{project.client_name}
            </span>
          </div>
        )}
        <div className="mb-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {displayDescription}
          </p>
          {isLongDescription && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-1 focus:outline-none flex items-center gap-1"
            >
              <span>{isExpanded ? 'Show less' : 'Show more'}</span>
              <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
            </button>
          )}
        </div>
      </div>
      <div>
        <div className="flex flex-wrap gap-1 mb-3">
          {project.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono"
            >
              {tag.name}
            </span>
          ))}
        </div>
        {project.resources && project.resources.some(r => r.url) && (
          <div className="flex flex-wrap gap-1.5 mb-3 pt-2 border-t border-slate-100">
            {project.resources.map((res) => res.url ? (
              <a
                key={res.id}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2 py-1 rounded border border-slate-200 transition-colors flex items-center space-x-1"
                title={`Open ${res.resource_type} in new tab`}
              >
                <i className={`${res.resource_type === 'video' ? 'fa-solid fa-play' : res.resource_type === 'docs' ? 'fa-solid fa-file-lines' : 'fa-brands fa-github'} text-[10px]`}></i>
                <span className="capitalize">{res.resource_type === 'docs' ? 'Documentation' : res.resource_type === 'github' ? 'GitHub' : 'Video'}</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400"></i>
              </a>
            ) : null)}
          </div>
        )}
        <button
          onClick={() => onViewDetails(project)}
          className="w-full text-center py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
        >
          <i className="fa-solid fa-layer-group mr-1.5"></i> View Solution Details
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;

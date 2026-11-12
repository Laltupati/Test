import React from 'react';
import type { Project } from '../../types';

interface HeroSummaryProps {
  projects: Project[];
  onFilterByPhase: (phase: string | null) => void;
  activePhaseFilter: string | null;
}

const HeroSummary: React.FC<HeroSummaryProps> = ({ projects, onFilterByPhase, activePhaseFilter }) => {
  const totalProjects = projects.length;
  const conceptCount = projects.filter(p => p.phase === 'Concept').length;
  const devCount = projects.filter(p => p.phase === 'Dev').length;
  const liveCount = projects.filter(p => p.phase === 'Live').length;

  const conceptHours = projects.filter(p => p.phase === 'Concept').reduce((sum, p) => sum + p.hours_saved, 0);
  const devHours = projects.filter(p => p.phase === 'Dev').reduce((sum, p) => sum + p.hours_saved, 0);
  const liveHours = projects.filter(p => p.phase === 'Live').reduce((sum, p) => sum + p.hours_saved, 0);
  const totalHours = conceptHours + devHours + liveHours;

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'Concept': return '🔵';
      case 'Dev': return '🟡';
      case 'Live': return '🟢';
      default: return '';
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'Concept': return 'Discovery Phase';
      case 'Dev': return 'Building Phase';
      case 'Live': return 'Production Phase';
      default: return '';
    }
  };

  const getPhaseSubLabel = (phase: string) => {
    switch (phase) {
      case 'Concept': return 'Concept / Architecture';
      case 'Dev': return 'In Development';
      case 'Live': return 'Live Pilots & Prod';
      default: return '';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Concept': return { bg: 'bg-blue-100', text: 'text-blue-600', hover: 'hover:bg-blue-50' };
      case 'Dev': return { bg: 'bg-amber-100', text: 'text-amber-600', hover: 'hover:bg-amber-50' };
      case 'Live': return { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'hover:bg-emerald-50' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-600', hover: 'hover:bg-slate-50' };
    }
  };

  return (
    <section className="bg-white border-b border-slate-200 py-6 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4 shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow">
              {totalProjects}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Mapped</div>
              <div className="text-sm font-bold text-slate-800">AI Initiatives</div>
            </div>
          </div>

          {/* Concept */}
          <div
            className={`bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4 shadow-sm cursor-pointer transition-colors ${activePhaseFilter === 'Concept' ? 'bg-blue-50 ring-2 ring-blue-500' : getPhaseColor('Concept').hover}`}
            onClick={() => onFilterByPhase(activePhaseFilter === 'Concept' ? null : 'Concept')}
          >
            <div className={`w-12 h-12 rounded-lg ${getPhaseColor('Concept').bg} ${getPhaseColor('Concept').text} flex items-center justify-center text-xl font-bold`}>
              {conceptCount}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{getPhaseLabel('Concept')}</div>
              <div className="text-sm font-bold text-slate-800 flex items-center">
                <span className="mr-1">{getPhaseBadge('Concept')}</span> {getPhaseSubLabel('Concept')}
              </div>
              <div className="text-xs text-slate-500 mt-1">{conceptHours} hrs saved</div>
            </div>
          </div>

          {/* Dev */}
          <div
            className={`bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4 shadow-sm cursor-pointer transition-colors ${activePhaseFilter === 'Dev' ? 'bg-amber-50 ring-2 ring-amber-500' : getPhaseColor('Dev').hover}`}
            onClick={() => onFilterByPhase(activePhaseFilter === 'Dev' ? null : 'Dev')}
          >
            <div className={`w-12 h-12 rounded-lg ${getPhaseColor('Dev').bg} ${getPhaseColor('Dev').text} flex items-center justify-center text-xl font-bold`}>
              {devCount}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{getPhaseLabel('Dev')}</div>
              <div className="text-sm font-bold text-slate-800 flex items-center">
                <span className="mr-1">{getPhaseBadge('Dev')}</span> {getPhaseSubLabel('Dev')}
              </div>
              <div className="text-xs text-slate-500 mt-1">{devHours} hrs saved</div>
            </div>
          </div>

          {/* Live */}
          <div
            className={`bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center space-x-4 shadow-sm cursor-pointer transition-colors ${activePhaseFilter === 'Live' ? 'bg-emerald-50 ring-2 ring-emerald-500' : getPhaseColor('Live').hover}`}
            onClick={() => onFilterByPhase(activePhaseFilter === 'Live' ? null : 'Live')}
          >
            <div className={`w-12 h-12 rounded-lg ${getPhaseColor('Live').bg} ${getPhaseColor('Live').text} flex items-center justify-center text-xl font-bold`}>
              {liveCount}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{getPhaseLabel('Live')}</div>
              <div className="text-sm font-bold text-slate-800 flex items-center">
                <span className="mr-1">{getPhaseBadge('Live')}</span> {getPhaseSubLabel('Live')}
              </div>
              <div className="text-xs text-slate-500 mt-1">{liveHours} hrs saved</div>
            </div>
          </div>
        </div>

        {/* Total Hours Saved */}
        <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div>
              <div className="text-xs text-blue-500 font-semibold uppercase tracking-wider">Total Hours Saved</div>
              <div className="text-2xl font-bold text-blue-700">{totalHours.toLocaleString()} hrs</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Across all phases</div>
            <div className="text-sm font-semibold text-slate-700">{totalProjects} initiatives</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSummary;

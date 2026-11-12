import React from 'react';

interface TagNavProps {
  tags: string[];
  activeTag: string;
  onTagSelect: (tag: string) => void;
}

const TagNav: React.FC<TagNavProps> = ({ tags, activeTag, onTagSelect }) => {
  return (
    <nav className="bg-slate-100 border-b border-slate-200 sticky top-16 z-20 shadow-sm overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-4 shrink-0">Filter by Domain:</div>
        <div className="flex space-x-2 py-3 overflow-x-auto no-scrollbar text-xs font-medium w-full">
          <button
            onClick={() => onTagSelect('all')}
            className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap shadow-sm ${
              activeTag === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            Show All Solutions
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagSelect(tag)}
              className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                activeTag === tag
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default TagNav;

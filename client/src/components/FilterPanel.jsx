import React, { useState } from 'react';

const FilterPanel = ({ filters, setFilters, collapsed }) => {
  const [openGroups, setOpenGroups] = useState({
    domain: true,
    tech: true,
    cap: true
  });

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleFilter = (type, val) => {
    setFilters(prev => {
      const isSelected = prev[type].includes(val);
      if (isSelected) {
        return { ...prev, [type]: prev[type].filter(item => item !== val) };
      } else {
        return { ...prev, [type]: [...prev[type], val] };
      }
    });
  };

  const resetFilters = () => {
    setFilters({ domain: [], tech: [], cap: [] });
  };

  const renderCheckbox = (type, val, label, count) => {
    const isChecked = filters[type].includes(val);
    return (
      <div className={`cb-row ${isChecked ? 'checked' : ''}`} onClick={() => toggleFilter(type, val)}>
        <div className="cb-box"><span className="cb-tick">✓</span></div>
        <span className="cb-label">{label}</span>
        <span className="cb-count">{count}</span>
      </div>
    );
  };

  return (
    <div className={`filter-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="fp-header">
        <span className="fp-title">Filters</span>
        <button className="fp-reset" onClick={resetFilters}>Reset</button>
      </div>

      <div className={`fg ${openGroups.domain ? 'open' : ''}`}>
        <div className="fg-head" onClick={() => toggleGroup('domain')}>
          <span className="fg-label">Domain</span>
          <span className="fg-arrow">▼</span>
        </div>
        <div className="fg-body">
          {renderCheckbox('domain', 'banking-finance', 'Banking and Finance', 4)}
          {renderCheckbox('domain', 'hr', 'HR', 2)}
          {renderCheckbox('domain', 'healthcare', 'HealthCare', 1)}
          {renderCheckbox('domain', 'insurance', 'Insurance', 1)}
          {renderCheckbox('domain', 'technology', 'Technology', 3)}
        </div>
      </div>

      <div className={`fg ${openGroups.tech ? 'open' : ''}`}>
        <div className="fg-head" onClick={() => toggleGroup('tech')}>
          <span className="fg-label">Technology</span>
          <span className="fg-arrow">▼</span>
        </div>
        <div className="fg-body">
          {renderCheckbox('tech', 'agent-ai', 'Agent AI', 10)}
          {renderCheckbox('tech', 'rag', 'RAG', 3)}
          {renderCheckbox('tech', 'ml', 'ML', 7)}
          {renderCheckbox('tech', 'dl', 'DL', 1)}
        </div>
      </div>

      <div className={`fg ${openGroups.cap ? 'open' : ''}`}>
        <div className="fg-head" onClick={() => toggleGroup('cap')}>
          <span className="fg-label">Capabilities</span>
          <span className="fg-arrow">▼</span>
        </div>
        <div className="fg-body">
          {renderCheckbox('cap', 'content-generation', 'Content Generation', 5)}
          {renderCheckbox('cap', 'text-summarization', 'Text Summarization', 3)}
          {renderCheckbox('cap', 'classification', 'Classification/Regression', 4)}
          {renderCheckbox('cap', 'qa-systems', 'Q&A Systems', 3)}
          {renderCheckbox('cap', 'document-analysis', 'Document Analysis', 4)}
        </div>
      </div>

    </div>
  );
};

export default FilterPanel;

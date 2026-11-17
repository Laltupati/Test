import React from 'react';
import { mockAiUsage } from '../mockData';

export default function AIServicesModels() {
  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">AI Services & Models</h1>
          <p className="ad-page-subtitle">Model usage and Azure AI service status</p>
        </div>
      </div>

      <div className="ad-panel">
        <div className="ad-panel-header"><h2 className="ad-panel-title">Model Usage Share (Today)</h2></div>
        {mockAiUsage.topModels.map((m) => (
          <div className="ad-model-row" key={m.name}>
            <div className="ad-model-row-top"><span>{m.name}</span><span>{m.pct}%</span></div>
            <div className="ad-model-bar-bg"><div className="ad-model-bar-fill" style={{ width: `${m.pct}%` }} /></div>
          </div>
        ))}
        <div className="ad-mock-note">
          Illustrative placeholder — wiring this to real data means calling Azure OpenAI's usage/metrics
          API (or Azure Monitor) per deployment and aggregating by model.
        </div>
      </div>
    </>
  );
}

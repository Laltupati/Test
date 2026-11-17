import React, { useEffect, useMemo, useState } from 'react';

const money = (value, currency = 'USD') => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const compact = (value) => {
  const n = Number(value || 0);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
};
const pct = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;
const isoToday = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`;
const fmtDate = (raw) => {
  const s = String(raw || '');
  const compactDate = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  const value = compactDate ? `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}` : s;
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Panel({ title, subtitle, right, children, className = '' }) {
  return <section className={`uc2-panel ${className}`}>
    <div className="uc2-panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{right && <div>{right}</div>}</div>
    <div className="uc2-panel-body">{children}</div>
  </section>;
}

function Stat({ label, value, sub, tone = 'blue' }) {
  return <div className={`uc2-stat ${tone}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function Empty({ children }) { return <div className="uc2-empty">{children}</div>; }

function LineChart({ rows = [], series = [], currency = null, height = 180 }) {
  if (!rows.length || !series.length) return <Empty>No data returned for the selected period.</Empty>;
  const w = 760; const h = height; const left = 52; const right = 12; const top = 12; const bottom = 28;
  const all = rows.flatMap(r => series.map(s => Number(r[s.key] || 0)));
  const max = Math.max(...all, 1); const min = Math.min(...all, 0); const range = Math.max(max - min, 1);
  const x = i => left + i * (w - left - right) / Math.max(rows.length - 1, 1);
  const y = v => h - bottom - ((Number(v || 0) - min) / range) * (h - top - bottom);
  const formatY = v => currency ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : compact(v);
  const yTicks = [max, min + range * .75, min + range * .5, min + range * .25, min];
  const colors = ['#20bdf5', '#51dc84', '#ffb43b', '#a88cff'];
  return <div className="uc2-line-chart">
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
      {yTicks.map((v, i) => { const yy = y(v); return <g key={i}><line x1={left} x2={w-right} y1={yy} y2={yy} className="uc2-grid-line"/><text x={left-7} y={yy+3} className="uc2-axis-label" textAnchor="end">{formatY(v)}</text></g>; })}
      {series.map((s, si) => {
        const points = rows.map((r, i) => `${x(i)},${y(r[s.key])}`).join(' ');
        return <g key={s.key}><polyline points={points} fill="none" stroke={s.color || colors[si % colors.length]} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
          {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[s.key])} r="2.2" fill={s.color || colors[si % colors.length]}><title>{`${fmtDate(r.date)} • ${s.label}: ${currency ? money(r[s.key], currency) : Number(r[s.key] || 0).toLocaleString()}`}</title></circle>)}</g>;
      })}
      {rows.map((r, i) => {
        const step = rows.length <= 10 ? 1 : Math.max(1, Math.ceil((rows.length - 1) / 7));
        if (i !== 0 && i !== rows.length - 1 && i % step !== 0) return null;
        const anchor = i === 0 ? 'start' : (i === rows.length - 1 ? 'end' : 'middle');
        return <text key={`x-${i}`} x={x(i)} y={h-7} className="uc2-axis-label" textAnchor={anchor}>{fmtDate(r.date)}</text>;
      })}
    </svg>
    <div className="uc2-legend">{series.map((s, i) => <span key={s.key}><i style={{background:s.color || colors[i % colors.length]}} />{s.label}</span>)}</div>
  </div>;
}

function HorizontalBars({ rows = [], valueKey = 'amount', labelKey = 'name', currency = null, maxRows = 8, scrollable = false }) {
  const data = rows.slice(0, maxRows); if (!data.length) return <Empty>No data returned for the selected period.</Empty>;
  const max = Math.max(...data.map(x => Number(x[valueKey] || 0)), 1);
  return <div className={`uc2-bars ${scrollable ? 'uc2-bars-scrollable' : ''}`}>{data.map((row, i) => <div className="uc2-bar" key={`${row[labelKey]}-${i}`}>
    <div className="uc2-bar-label"><span title={row[labelKey]}>{row[labelKey]}</span><b>{currency ? money(row[valueKey], currency) : compact(row[valueKey])}</b></div>
    <div className="uc2-bar-track"><i style={{width:`${Math.max(1.5, Number(row[valueKey] || 0)/max*100)}%`}} /></div>
  </div>)}</div>;
}

function Donut({ rows = [], total = 0, currency = 'USD', centerLabel = 'Total' }) {
  const data = rows.filter(x => Number(x.amount || 0) > 0).slice(0, 7);
  if (!data.length) return <Empty>No cost distribution returned.</Empty>;
  const sum = data.reduce((s,x)=>s+Number(x.amount||0),0) || 1;
  const colors = ['#168cff','#18c8dc','#43d36b','#ffb23f','#8c6cff','#f25575','#9eb9d8'];
  let acc=0;
  const stops=data.map((x,i)=>{const a=acc/sum*360; acc+=Number(x.amount||0); const b=acc/sum*360; return `${colors[i]} ${a}deg ${b}deg`;}).join(', ');
  const centerAmount = Number(total || sum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="uc2-donut-wrap"><div className="uc2-donut" style={{background:`conic-gradient(${stops})`}}><div><span className="uc2-donut-currency">{currency}</span><strong>{centerAmount}</strong><span>{centerLabel}</span></div></div>
    <div className="uc2-donut-legend">{data.map((x,i)=><div key={x.name}><i style={{background:colors[i]}}/><span title={x.name}>{x.name}</span><b>{pct(Number(x.amount||0)/sum*100)}</b></div>)}</div></div>;
}

function csvEscape(v) {
  const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadText(filename, text, type='text/csv;charset=utf-8') {
  const blob = new Blob([text], {type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function toCsv(headers, rows) { return [headers, ...rows].map(r=>r.map(csvEscape).join(',')).join('\n'); }

export default function UsageCost({ cost, costLoading = false, costError = null, reloadCost }) {
  const [dashboard, setDashboard] = useState('resource');
  const [startDate, setStartDate] = useState(cost?.period?.startDate || monthStart());
  const [endDate, setEndDate] = useState(cost?.period?.endDate || isoToday());
  const [groupFilter, setGroupFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [llmAppFilter, setLlmAppFilter] = useState('all');
  const [llmModelFilter, setLlmModelFilter] = useState('all');
  const [llmGroupFilter, setLlmGroupFilter] = useState('all');

  useEffect(() => {
    if (cost?.period?.startDate) setStartDate(cost.period.startDate);
    if (cost?.period?.endDate) setEndDate(cost.period.endDate);
  }, [cost?.period?.startDate, cost?.period?.endDate]);

  useEffect(() => {
    if (!cost?.costDetailsPending || costLoading) return undefined;
    const delay = Math.min(60000, Math.max(5000, Number(cost.retryAfterSeconds || 15) * 1000));
    const timer = window.setTimeout(() => {
      reloadCost?.({ startDate: cost.period?.startDate || startDate, endDate: cost.period?.endDate || endDate, force: false });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [cost?.costDetailsPending, cost?.retryAfterSeconds, cost?.period?.startDate, cost?.period?.endDate, costLoading, reloadCost, startDate, endDate]);

  const refresh = (force=true) => reloadCost?.({ startDate, endDate, force });
  const apply = () => {
    if (!startDate || !endDate || endDate < startDate) return;
    reloadCost?.({ startDate, endDate, force: true });
  };

  const real = !!cost?.configured && (Array.isArray(cost?.resources) || Array.isArray(cost?.dailyCost));
  const currency = cost?.currency || 'USD';

  const costDataAvailable = cost?.costAvailable !== false;
  const groups = (cost?.byResourceGroup?.length ? cost.byResourceGroup : (cost?.resourceGroups || []).map(name => ({ name, amount: null })));
  const services = cost?.byService || [];
  const regions = cost?.byRegion || [];
  const resources = cost?.resources || [];
  const serviceCount = cost?.serviceCount ?? new Set(resources.map(r => r.serviceName || r.type).filter(Boolean)).size;
  const resourceDetails = cost?.resourceCostDetails || [];
  const llm = cost?.llm || {};
  const deployments = llm.deployments || [];
  const openAiUsage = cost?.openAiUsage || [];
  const llmMetricsAvailable = openAiUsage.some(x => !x.metricsUnavailable);
  const llmCostDetails = llm.costDetails || [];
  const llmBillingAvailable = cost?.sourceStatus?.llmBilling === 'live' || llmCostDetails.length > 0;

  const serviceNames = useMemo(()=>[...new Set(resources.map(r=>r.serviceName).filter(Boolean))].sort(),[resources]);
  const regionNames = useMemo(()=>[...new Set(resources.map(r=>r.location).filter(Boolean))].sort(),[resources]);
  const filteredResources = useMemo(()=>resources.filter(r=>{
    const g=groupFilter==='all'||String(r.resourceGroup||'').toLowerCase()===groupFilter.toLowerCase();
    const s=serviceFilter==='all'||r.serviceName===serviceFilter;
    const reg=regionFilter==='all'||r.location===regionFilter;
    const q=search.trim().toLowerCase();
    const hit=!q||`${r.name} ${r.resourceGroup} ${r.type} ${r.serviceName} ${r.location}`.toLowerCase().includes(q);
    return g&&s&&reg&&hit;
  }),[resources,groupFilter,serviceFilter,regionFilter,search]);

  // Every dashboard visual uses the same filtered ActualCost detail rows. This
  // makes RG/service/region selection behave like Azure Cost Analysis rather
  // than filtering only the resource table.
  const filteredResourceIds = useMemo(()=>new Set(filteredResources.map(r=>String(r.id||'').toLowerCase())),[filteredResources]);
  const filteredDetails = useMemo(()=>resourceDetails.filter(d=>{
    const id=String(d.resourceId||'').toLowerCase();
    return filteredResourceIds.has(id);
  }),[resourceDetails,filteredResourceIds]);
  const hasDashboardFilter = groupFilter!=='all'||serviceFilter!=='all'||regionFilter!=='all'||!!search.trim();
  const filteredTotal = useMemo(()=>{
    if (!hasDashboardFilter) return Number(cost?.totalCost||0);
    return filteredDetails.reduce((sum,r)=>sum+Number(r.cost||0),0);
  },[hasDashboardFilter,cost?.totalCost,filteredDetails]);
  const filteredDaily = useMemo(()=>{
    if (!hasDashboardFilter) return cost?.dailyCost||[];
    const datedDetails = filteredDetails.filter(r => r.usageDate);
    if (!datedDetails.length) return [];
    const m=new Map(); datedDetails.forEach(r=>{const d=String(r.usageDate||'').slice(0,10); if(d)m.set(d,(m.get(d)||0)+Number(r.cost||0));});
    const out=[]; for(let d=new Date(`${startDate}T00:00:00Z`),e=new Date(`${endDate}T00:00:00Z`);d<=e;d=new Date(d.getTime()+86400000)){const k=d.toISOString().slice(0,10);out.push({date:k,amount:m.get(k)||0,currency});} return out;
  },[hasDashboardFilter,cost?.dailyCost,filteredDetails,startDate,endDate,currency]);
  const aggregateFiltered = (keyFn) => { const m=new Map(); filteredResources.forEach(r=>{const k=keyFn(r)||'Unknown';m.set(k,(m.get(k)||0)+Number(r.cost||0));}); return [...m].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount); };
  const filteredServices = useMemo(()=>hasDashboardFilter?aggregateFiltered(r=>r.serviceName||r.type):services,[hasDashboardFilter,filteredResources,services]);
  const filteredRegions = useMemo(()=>hasDashboardFilter?aggregateFiltered(r=>r.location||'Unknown'):regions,[hasDashboardFilter,filteredResources,regions]);
  const filteredGroups = useMemo(()=>hasDashboardFilter?aggregateFiltered(r=>r.resourceGroup||'Unassigned'):groups,[hasDashboardFilter,filteredResources,groups]);

  const tokenByModel = useMemo(()=>{
    const m=new Map(); deployments.forEach(d=>{const k=d.modelName && d.modelName!=='—' ? d.modelName : d.deploymentName; const x=m.get(k)||{name:k,amount:0}; x.amount+=Number(d.totalTokens||0); m.set(k,x);}); return [...m.values()].sort((a,b)=>b.amount-a.amount);
  },[deployments]);
  // Normalize telemetry to the selected date range. Azure metrics can omit days
  // with zero traffic; filling those dates avoids misleadingly sparse charts.
  const tokenDailySource = useMemo(() => {
    const byDate = new Map((llm.tokenDaily || []).map(row => [String(row.date || '').slice(0, 10), row]));
    const rows = [];
    for (let d = new Date(`${startDate}T00:00:00Z`), end = new Date(`${endDate}T00:00:00Z`); d <= end; d = new Date(d.getTime() + 86400000)) {
      const date = d.toISOString().slice(0, 10);
      const row = byDate.get(date) || {};
      rows.push({ date, inputTokens: Number(row.inputTokens || 0), outputTokens: Number(row.outputTokens || 0), totalTokens: Number(row.totalTokens || (Number(row.inputTokens || 0) + Number(row.outputTokens || 0))), requests: Number(row.requests || 0), cacheMatchRatePct: row.cacheMatchRatePct == null ? null : Number(row.cacheMatchRatePct) });
    }
    return rows;
  }, [llm.tokenDaily, startDate, endDate]);
  const requestDaily = tokenDailySource.map(x => ({ date: x.date, requests: x.requests }));
  const cacheDaily = tokenDailySource.filter(x => x.cacheMatchRatePct != null).map(x => ({ date: x.date, cache: x.cacheMatchRatePct }));
  const llmBreakup=[
    {name:'Input cost',amount:Number(llm.costBreakdown?.input||0)},
    {name:'Output cost',amount:Number(llm.costBreakdown?.output||0)},
    {name:'Cached input cost',amount:Number(llm.costBreakdown?.cache||0)},
    {name:'Other',amount:Number(llm.costBreakdown?.other||0)},
  ];

  // Always expose the complete Playground application catalogue in the LLM
  // filter, even when an app has no safely attributable billing/telemetry rows
  // for the selected period. This prevents the filter from collapsing to only
  // Pro-Manager/Unassigned when Azure billing lacks caller identity.
  const llmApps = useMemo(()=>[...new Set([
    ...(cost?.applications||[]).map(x=>x.name).filter(name => !/qualiverse\s*ai/i.test(String(name || ''))),
    ...llmCostDetails.map(x=>x.applicationName),
    ...deployments.map(x=>x.applicationName),
  ].filter(Boolean))].sort(),[cost?.applications,llmCostDetails,deployments]);
  const llmModels = useMemo(()=>[...new Set([...llmCostDetails.map(x=>x.model), ...deployments.map(x=>x.modelName).filter(x=>x&&x!=='—')].filter(Boolean))].sort(),[llmCostDetails,deployments]);
  const llmGroups = useMemo(()=>[...new Set([...llmCostDetails.map(x=>x.resourceGroupName), ...deployments.map(x=>x.resourceGroup)].filter(Boolean))].sort(),[llmCostDetails,deployments]);
  const filteredLlmCosts = useMemo(()=>llmCostDetails.filter(x=>(llmAppFilter==='all'||x.applicationName===llmAppFilter)&&(llmModelFilter==='all'||x.model===llmModelFilter)&&(llmGroupFilter==='all'||x.resourceGroupName===llmGroupFilter)),[llmCostDetails,llmAppFilter,llmModelFilter,llmGroupFilter]);
  const filteredDeployments = useMemo(()=>deployments.filter(x=>(llmAppFilter==='all'||x.applicationName===llmAppFilter)&&(llmModelFilter==='all'||x.modelName===llmModelFilter)&&(llmGroupFilter==='all'||x.resourceGroup===llmGroupFilter)),[deployments,llmAppFilter,llmModelFilter,llmGroupFilter]);
  const llmFilteredCost = filteredLlmCosts.reduce((s,x)=>s+Number(x.cost||0),0);
  const llmFilteredInput = filteredDeployments.reduce((s,x)=>s+Number(x.inputTokens||0),0);
  const llmFilteredOutput = filteredDeployments.reduce((s,x)=>s+Number(x.outputTokens||0),0);
  const llmFilteredTotalTokens = filteredDeployments.reduce((s,x)=>s+Number(x.totalTokens||0),0);
  const llmFilteredRequests = filteredDeployments.reduce((s,x)=>s+Number(x.requests||0),0);
  const llmFilteredCache = (()=>{const v=filteredDeployments.map(x=>x.cacheMatchRatePct).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+Number(b),0)/v.length:null;})();
  const aggLlmCost=(key)=>{const m=new Map();filteredLlmCosts.forEach(x=>{const k=x[key]||'Unassigned';m.set(k,(m.get(k)||0)+Number(x.cost||0));});return [...m].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);};
  const llmCostByApp=(()=>{
    const rows=aggLlmCost('applicationName');
    const seen=new Set(rows.map(r=>String(r.name||'').toLowerCase()));
    (cost?.applications||[]).forEach(app=>{
      const name=String(app.name||'').trim();
      if(name && !/qualiverse\s*ai/i.test(name) && !seen.has(name.toLowerCase())) rows.push({name,amount:0});
    });
    if(!rows.some(r=>/^unassigned$/i.test(r.name))) rows.push({name:'Unassigned / resource mapping needed',amount:0});
    return rows.sort((a,b)=>b.amount-a.amount);
  })();
  const llmCostByFilteredModel=aggLlmCost('model');
  const llmFilteredBreakup=['input','output','cache','other'].map(k=>({name:k==='cache'?'Cached input cost':`${k[0].toUpperCase()+k.slice(1)} cost`,amount:filteredLlmCosts.filter(x=>x.tokenType===k).reduce((s,x)=>s+Number(x.cost||0),0)}));
  const llmDailyFiltered=(()=>{const m=new Map();filteredLlmCosts.forEach(x=>{const r=m.get(x.usageDate)||{date:x.usageDate,totalCost:0};r.totalCost+=Number(x.cost||0);m.set(x.usageDate,r);});return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));})();

  const exportData = (kind) => {
    const stamp=`${startDate}_to_${endDate}`;
    if (kind==='resource') {
      const allowedIds = new Set(filteredResources.map(r => String(r.id || '').toLowerCase()));
      const headers=['UsageDate','ResourceId','ResourceType','ResourceLocation','ResourceGroupName','ServiceName','ServiceTier','Meter','CostUSD','Cost','Currency'];
      const detailRows = resourceDetails.filter(r => !allowedIds.size || allowedIds.has(String(r.resourceId || '').toLowerCase())).slice().sort((a,b)=>String(a.usageDate||'').localeCompare(String(b.usageDate||''))||String(a.resourceGroupName||'').localeCompare(String(b.resourceGroupName||''))||String(a.serviceName||'').localeCompare(String(b.serviceName||''))||String(a.resourceId||'').localeCompare(String(b.resourceId||'')));
      const rows=(detailRows.length ? detailRows : filteredResources).map(r=> detailRows.length
        ? [r.usageDate,r.resourceId,r.resourceType,r.resourceLocation,r.resourceGroupName,r.serviceName,r.serviceTier,r.meter,r.costUSD,r.cost,r.currency]
        : [startDate,r.id,r.type,r.location,r.resourceGroup,r.serviceName,r.sku,'',r.currency==='USD'?r.cost:'',r.cost,r.currency||currency]);
      downloadText(`azure-resource-group-data_${stamp}.csv`,toCsv(headers,rows));
    } else if (kind==='llm') {
      const headers=['Period Start','Period End','Azure OpenAI Resource','Resource Group','Deployment','Model','Model Version','Input Tokens','Output Tokens','Total Tokens','Requests','Cache Match Rate %'];
      const rows=deployments.map(d=>[startDate,endDate,d.resourceName,d.resourceGroup,d.deploymentName,d.modelName,d.modelVersion,d.inputTokens,d.outputTokens,d.totalTokens,d.requests,d.cacheMatchRatePct]);
      downloadText(`azure-llm-tokens_${stamp}.csv`,toCsv(headers,rows));
    } else if (kind==='llm-cost') {
      const headers=['Period Start','Period End','Azure OpenAI Resource','Resource Group','Input Cost','Output Cost','Cache Cost','Other Cost','Total Actual LLM Cost','Currency'];
      const rows=openAiUsage.map(x=>[startDate,endDate,x.resourceName,x.resourceGroup,x.inputCost,x.outputCost,x.cacheCost,x.otherCost,x.cost,currency]);
      downloadText(`azure-llm-cost_${stamp}.csv`,toCsv(headers,rows));
    } else if (kind==='llm-template') {
      // Export in the same business-friendly shape as the supplied LLM token
      // cost template. Billed cost is Azure ActualCost; token counts come from
      // Azure Monitor and are joined at model/type level when a safe match is
      // available. We deliberately leave a token cell blank rather than invent
      // a token quantity when Azure billing and telemetry cannot be joined.
      const headers=['UsageDate','ResourceGroupName','ServiceName','ServiceTier','Meter','CostUSD','Cost','Currency','No of Tokens','Total Token','Application Name'];
      const tokenPool=new Map();
      filteredDeployments.forEach(d=>{
        const model=String(d.modelName||d.deploymentName||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        const cur=tokenPool.get(model)||{input:0,output:0,total:0};
        cur.input+=Number(d.inputTokens||0);cur.output+=Number(d.outputTokens||0);cur.total+=Number(d.totalTokens||0);tokenPool.set(model,cur);
      });
      const seen=new Set();
      const rows=filteredLlmCosts.slice().sort((a,b)=>String(a.usageDate||'').localeCompare(String(b.usageDate||''))||String(a.meter||'').localeCompare(String(b.meter||''))).map(x=>{
        const modelKey=String(x.model||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        const t=tokenPool.get(modelKey);
        const k=`${modelKey}|${x.tokenType}`;
        let tokens=''; let total='';
        if(t&&!seen.has(k)){tokens=x.tokenType==='input'?t.input:x.tokenType==='output'?t.output:''; total=t.total||''; seen.add(k);}
        return [x.usageDate,x.resourceGroupName,x.serviceName||'Foundry Models','OpenAI',x.meter,x.currency==='USD'?x.cost:'',x.cost,x.currency||currency,tokens,total,x.applicationName];
      });
      downloadText(`llm-token-cost-dashboard_${stamp}.csv`,toCsv(headers,rows));
    } else if (kind==='json') {
      downloadText(`azure-usage-cost_${stamp}.json`,JSON.stringify(cost,null,2),'application/json');
    }
  };

  if (!cost && costLoading) return <div className="uc2-page"><div className="uc2-loading"><strong>Loading Azure Cost Analysis and Azure Monitor metrics…</strong><span /></div></div>;
  if (!real) return <div className="uc2-page"><div className="ad-page-header"><div><h1 className="ad-page-title">Usage & Cost</h1><p className="ad-page-subtitle">Azure Cost Analysis + Azure OpenAI monitoring</p></div></div><div className="uc-config-card uc-graf-config"><div className="uc-config-icon">$</div><div><h2>Azure Cost Intelligence is not available yet</h2><p>{costError || cost?.error || cost?.reason || 'Verify the subscription ID, monitored resource groups and managed identity permissions.'}</p></div></div></div>;

  return <div className="uc2-page">
    <div className="uc2-toolbar">
      <div><div className="uc2-eyebrow">AZURE FINOPS + GENAI OBSERVABILITY</div><h1>Usage & Cost</h1><p>Live Azure Cost Analysis and Azure OpenAI token telemetry. No end-user data is collected.</p></div>
      <div className="uc2-controls">
        <label>From<input type="date" value={startDate} max={endDate || isoToday()} onChange={e=>setStartDate(e.target.value)} /></label>
        <label>To<input type="date" value={endDate} min={startDate} max={isoToday()} onChange={e=>setEndDate(e.target.value)} /></label>
        <button className="uc2-primary" onClick={apply} disabled={costLoading || !startDate || !endDate || endDate < startDate}>{costLoading?'Loading…':'Apply'}</button>
        <select className="uc2-export" defaultValue="" onChange={e=>{if(e.target.value) exportData(e.target.value); e.target.value='';}}><option value="" disabled>Export ▾</option><option value="resource" disabled={!costDataAvailable}>Resource cost CSV</option><option value="llm">LLM token CSV</option><option value="llm-cost" disabled={!costDataAvailable}>LLM cost CSV</option><option value="llm-template" disabled={!costDataAvailable}>LLM token cost template CSV</option><option value="json">Full snapshot JSON</option></select>
        <button className="uc2-secondary" onClick={()=>refresh(true)} disabled={costLoading}>↻ Refresh</button>
      </div>
    </div>

    <div className="uc2-meta-row"><span className={`uc2-live ${!costDataAvailable?'partial':cost.stale?'stale':''}`}><i />{!costDataAvailable?'COST DATA DEFERRED':cost.stale?'CACHED AZURE COST':'LIVE AZURE COST'}</span><span>Selected period: <b>{cost.period?.startDate} → {cost.period?.endDate}</b></span><span>Updated: <b>{cost.asOf?new Date(cost.asOf).toLocaleString():'—'}</b></span><span>Source: <b>{cost.costQuerySource==='cost-details-report'?'Azure Cost Details ActualCost + Azure Monitor':'Azure Cost Management ActualCost + Azure Monitor'}</b></span></div>
    <div className="uc2-meta-row uc2-source-status">
      <span>Cost: <b>{String(cost.sourceStatus?.cost|| (cost.stale?'cached':'live')).toUpperCase()}</b></span>
      <span>Daily trend: <b>{String(cost.sourceStatus?.daily||'unknown').toUpperCase()}</b></span>
      <span>Distributions: <b>{String(cost.sourceStatus?.distributions||'unknown').toUpperCase()}</b></span>
      <span>LLM billing: <b>{String(cost.sourceStatus?.llmBilling||'unknown').toUpperCase()}</b></span>
      <span>LLM telemetry: <b>{String(cost.sourceStatus?.llmTelemetry||'unknown').toUpperCase()}</b></span>
    </div>
    {(cost.partial || cost.stale || costError) && (() => {
      const warnings = cost.warnings || [];
      const throttled = !!cost.throttled || warnings.some(w => /throttl|429|deferred/i.test(String(w)));
      const primary = cost.costDetailsPending
        ? `Azure Cost Query is throttled, so the server is generating an Azure Cost Details report automatically. This page will retry the report in about ${Math.max(1, Math.ceil(Number(cost.retryAfterSeconds || 15)/60))} min; no manual refresh is required.`
        : throttled
        ? (costDataAvailable
          ? `Azure Cost Management refresh is deferred. Showing the latest successful cost snapshot${cost.retryAfterSeconds ? `; next server retry in about ${Math.max(1, Math.ceil(cost.retryAfterSeconds/60))} min.` : '.'}`
          : `Azure Cost Management is temporarily throttled. The server will use the Cost Details report fallback; resource inventory and Azure Monitor token telemetry can still be current.`)
        : (costError || warnings[0] || 'Some Azure data is temporarily unavailable.');
      const nonThrottleWarnings = warnings.filter(w => !/throttl|429|deferred/i.test(String(w)));
      return <div className={`uc2-warning ${throttled?'uc2-warning-compact':''}`}><b>{throttled?'Azure cost data status:':'Data quality notice:'}</b> {primary}{nonThrottleWarnings.length>0 && <details><summary>Other details</summary><ul>{nonThrottleWarnings.slice(0,6).map((w,i)=><li key={i}>{w}</li>)}</ul></details>}</div>;
    })()}

    <div className="uc2-tabs"><button className={dashboard==='resource'?'active':''} onClick={()=>setDashboard('resource')}>Resource Cost Dashboard</button><button className={dashboard==='llm'?'active':''} onClick={()=>setDashboard('llm')}>LLM Token & Cost Dashboard</button></div>

    {dashboard==='resource' ? <>
      <div className="uc2-filterbar"><select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="all">All resource groups</option>{groups.map(g=><option key={g.name} value={g.name}>{g.name}</option>)}</select><select value={serviceFilter} onChange={e=>setServiceFilter(e.target.value)}><option value="all">All services</option>{serviceNames.map(s=><option key={s}>{s}</option>)}</select><select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)}><option value="all">All regions</option>{regionNames.map(r=><option key={r}>{r}</option>)}</select><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search resources…" /></div>
      <div className="uc2-kpis"><Stat label="Actual Azure Cost" value={costDataAvailable?money(filteredTotal,currency):'—'} sub={costDataAvailable?`${cost.period?.days||0} day selected period`:'Waiting for Azure Cost Management'} tone="cyan"/><Stat label="Resource-attributed Cost" value={costDataAvailable?money(hasDashboardFilter?filteredTotal:cost.resourceAttributedCost,currency):'—'} sub={costDataAvailable?'Cost tied to ResourceId':'Cost temporarily unavailable'}/><Stat label="Total Resources" value={compact(hasDashboardFilter?filteredResources.length:cost.resourceCount)} sub="ARM resource inventory" tone="blue"/><Stat label="Resource Groups" value={compact(hasDashboardFilter?new Set(filteredResources.map(r=>String(r.resourceGroup||'').toLowerCase()).filter(Boolean)).size:cost.resourceGroupCount)} sub={hasDashboardFilter?"Filtered resource groups":(cost.allSubscriptionResourceGroups ? "All subscription resource groups" : "Configured cost scopes")} tone="green"/><Stat label="Azure Services" value={compact(hasDashboardFilter?new Set(filteredResources.map(r=>r.serviceName||r.type).filter(Boolean)).size:serviceCount)} sub="Services in ARM inventory" tone="purple"/></div>
      <div className="uc2-grid resource-grid">
        <Panel title="Daily Azure Cost Trend" subtitle="ActualCost from Azure Cost Management" className="span-2">{costDataAvailable?<LineChart rows={filteredDaily} series={[{key:'amount',label:'Actual cost'}]} currency={currency}/>:<Empty>Azure Cost Management is temporarily unavailable. No zero-cost assumption is being made.</Empty>}</Panel>
        <Panel title="Cost by Service" subtitle="Resource-attributed spend">{costDataAvailable?<Donut rows={filteredServices} total={filteredTotal} currency={currency} centerLabel="Attributed"/>:<Empty>Cost distribution will appear after the next successful Azure Cost refresh.</Empty>}</Panel>
        <Panel title="Cost by Resource Group" subtitle={cost.allSubscriptionResourceGroups ? "Actual cost across all subscription resource groups" : "Actual cost grouped by configured resource groups"} className="span-2">{costDataAvailable?<HorizontalBars rows={filteredGroups} currency={currency} maxRows={filteredGroups.length} scrollable/>:<Empty>Resource groups are discovered, but cost values are awaiting Azure Cost Management.</Empty>}</Panel>
        <Panel title="Cost by Region" subtitle="Resource-attributed geographic distribution">{costDataAvailable?<Donut rows={filteredRegions} total={filteredTotal} currency={currency} centerLabel="Attributed"/>:<Empty>Region cost distribution is temporarily unavailable.</Empty>}</Panel>
        <Panel title="Top Resources by Cost" subtitle={`${filteredResources.length} resources in current filters`} className="span-3" right={<button className="uc2-link" onClick={()=>exportData('resource')}>Export CSV</button>}><div className="uc2-table-wrap"><table className="uc2-table"><thead><tr><th>Resource</th><th>Resource Group</th><th>Service</th><th>Resource Type</th><th>Region</th><th>Tier</th><th>Actual Cost</th></tr></thead><tbody>{filteredResources.length?filteredResources.map(r=><tr key={r.id}><td><b>{r.name}</b></td><td>{r.resourceGroup||'—'}</td><td>{r.serviceName||'—'}</td><td>{r.type||'—'}</td><td>{r.location||'—'}</td><td>{r.sku||'—'}</td><td className="money"><b>{costDataAvailable?money(r.cost,currency):'—'}</b></td></tr>):<tr><td colSpan="7"><Empty>No resources match the current filters.</Empty></td></tr>}</tbody></table></div></Panel>
      </div>
    </> : <>
      <div className="uc2-filterbar"><select value={llmAppFilter} onChange={e=>setLlmAppFilter(e.target.value)}><option value="all">All applications</option>{llmApps.map(x=><option key={x} value={x}>{x}</option>)}</select><select value={llmModelFilter} onChange={e=>setLlmModelFilter(e.target.value)}><option value="all">All models</option>{llmModels.map(x=><option key={x} value={x}>{x}</option>)}</select><select value={llmGroupFilter} onChange={e=>setLlmGroupFilter(e.target.value)}><option value="all">All resource groups</option>{llmGroups.map(x=><option key={x} value={x}>{x}</option>)}</select><button className="uc2-secondary" onClick={()=>{setLlmAppFilter('all');setLlmModelFilter('all');setLlmGroupFilter('all');}}>Reset filters</button></div>
      <div className="uc2-kpis"><Stat label="Actual LLM Cost" value={llmBillingAvailable?money(llmFilteredCost,currency):'—'} sub={llmBillingAvailable?'Azure billed ActualCost':'Billed-cost detail not available yet'} tone="purple"/><Stat label="Total Tokens" value={llmMetricsAvailable?compact(llmFilteredTotalTokens):'—'} sub="Input + output / Azure Monitor" tone="cyan"/><Stat label="Input Tokens" value={llmMetricsAvailable?compact(llmFilteredInput):'—'} sub="Processed prompt tokens" tone="green"/><Stat label="Output Tokens" value={llmMetricsAvailable?compact(llmFilteredOutput):'—'} sub="Generated completion tokens" tone="green"/><Stat label="Model Requests" value={llmMetricsAvailable?compact(llmFilteredRequests):'—'} sub="Azure OpenAI requests" tone="blue"/><Stat label="Cache Match Rate" value={llmMetricsAvailable&&llmFilteredCache!=null?pct(llmFilteredCache):'—'} sub={llmFilteredCache!=null?'Azure Monitor':'Metric not exposed by Azure Monitor'} tone="cyan"/></div>
      <div className="uc2-grid llm-grid">
        <Panel title="Daily LLM Billed Cost" subtitle="ActualCost from Azure Cost Management" className="span-2">{llmBillingAvailable?<LineChart rows={llmDailyFiltered} series={[{key:'totalCost',label:'LLM billed cost'}]} currency={currency}/>:<Empty>LLM billed-cost data has not been returned for this period.</Empty>}</Panel>
        <Panel title="Cost by Application" subtitle="Application ownership of Azure OpenAI resources">{llmBillingAvailable?<HorizontalBars rows={llmCostByApp} currency={currency}/>:<Empty>LLM billed-cost data has not been returned for this period.</Empty>}</Panel>
        <Panel title="Token Usage Over Time" subtitle="Input, output and total tokens from Azure Monitor" className="span-2"><LineChart rows={tokenDailySource} series={[{key:'inputTokens',label:'Input tokens',color:'#20bdf5'},{key:'outputTokens',label:'Output tokens',color:'#52dc82'},{key:'totalTokens',label:'Total tokens',color:'#ffb23f'}]}/></Panel>
        <Panel title="LLM Cost Breakup" subtitle="Actual Cost Management meter classification">{!costDataAvailable?<Empty>Azure billed-cost data is temporarily unavailable; token telemetry remains independent.</Empty>:llmBillingAvailable?<Donut rows={llmFilteredBreakup} total={llmFilteredCost} currency={currency} centerLabel="LLM cost"/>:<Empty>LLM billed-cost data has not been returned for this period.</Empty>}</Panel>
        <Panel title="Model Requests Over Time" subtitle="Request volume by selected date range" className="span-2"><LineChart rows={requestDaily} series={[{key:'requests',label:'Requests',color:'#2a91ff'}]}/></Panel>
        <Panel title="Token Cache Match Rate" subtitle="Average cache match rate reported by Azure Monitor"><LineChart rows={cacheDaily} series={[{key:'cache',label:'Cache match %',color:'#71d046'}]}/></Panel>
        <Panel title="Tokens by Model / Deployment" subtitle="Total inference tokens"><HorizontalBars rows={tokenByModel} /></Panel>
        <Panel title="Actual LLM Cost by Meter / Model" subtitle="Billed cost from Azure Cost Management">{!costDataAvailable?<Empty>Azure billed-cost data is temporarily unavailable.</Empty>:llmBillingAvailable?<HorizontalBars rows={llmCostByFilteredModel} currency={currency}/>:<Empty>Billed model cost will appear after the next successful Cost Management refresh.</Empty>}</Panel>
        <Panel title="Azure OpenAI Deployments" subtitle="No end-user identity or user-level token data" className="span-3" right={<div className="uc2-table-actions"><button className="uc2-link" onClick={()=>exportData('llm')}>Export tokens</button><button className="uc2-link" onClick={()=>exportData('llm-cost')}>Export cost</button><button className="uc2-link" onClick={()=>exportData('llm-template')}>Export template</button></div>}><div className="uc2-table-wrap"><table className="uc2-table"><thead><tr><th>Azure OpenAI Resource</th><th>Resource Group</th><th>Deployment</th><th>Model</th><th>Version</th><th>Input Tokens</th><th>Output Tokens</th><th>Total Tokens</th><th>Requests</th><th>Cache Match</th></tr></thead><tbody>{filteredDeployments.length?filteredDeployments.map((d,i)=><tr key={`${d.resourceId}-${d.deploymentName}-${i}`}><td><b>{d.resourceName}</b></td><td>{d.resourceGroup}</td><td>{d.deploymentName}</td><td>{d.modelName}</td><td>{d.modelVersion}</td><td>{compact(d.inputTokens)}</td><td>{compact(d.outputTokens)}</td><td><b>{compact(d.totalTokens)}</b></td><td>{compact(d.requests)}</td><td>{pct(d.cacheMatchRatePct)}</td></tr>):<tr><td colSpan="10"><Empty>No deployment-level token metrics were returned for this period.</Empty></td></tr>}</tbody></table></div></Panel>
      </div>
    </>}

    <div className="uc2-footer"><span>Cost source: Azure Cost Management Query API with automatic Generate Cost Details Report fallback • ActualCost</span><span>Token source: Azure Monitor Metrics • ProcessedPromptTokens / GeneratedTokens / TokenTransaction / AzureOpenAIRequests</span></div>
  </div>;
}

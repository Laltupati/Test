import React, { useState, useEffect } from 'react';

const Admin = () => {
  // const [data, setData] = useState({
  //   overview: [],
  //   monitoring: [],
  //   executionStats: null
  // });

  // useEffect(() => {
  //   fetch('http://localhost:3000/api/system-health')
  //     .then(res => res.json())
  //     .then(fetchedData => setData(fetchedData))
  //     .catch(err => console.error("Error fetching system health data:", err));
  // }, []);

  // return (
  //   <div className="page active" id="page-admin">
  //     <div className="sec-title">System Health Overview</div>
  //     <div className="health-row">
  //       {data.overview.map(item => (
  //         <div key={item.id} className="hcard">
  //           <div className={`hcard-icon ${item.colorClass}`}>{item.icon}</div>
  //           <div className="hcard-info">
  //             <div className="hcard-val">{item.title}</div>
  //             <div className="hcard-lbl">{item.label}</div>
  //             <div className={`hcard-sub ${item.subClass}`}>{item.subText}</div>
  //           </div>
  //         </div>
  //       ))}
  //     </div>

  //     <div className="two-col" style={{ marginBottom: '20px' }}>
  //       <div className="panel">
  //         <div className="sec-title" style={{ marginBottom: '14px' }}>Real-Time Agent Monitoring</div>
  //         <table className="mon-table">
  //           <thead>
  //             <tr>
  //               <th>Solution</th>
  //               <th>Status</th>
  //               <th>Health</th>
  //               <th>Requests</th>
  //               <th>Success</th>
  //               <th>Actions</th>
  //             </tr>
  //           </thead>
  //           <tbody>
  //             {data.monitoring.map(item => (
  //               <tr key={item.id}>
  //                 <td>{item.solution}</td>
  //                 <td><span className={`tbadge ${item.statusClass}`}><span className="tb-dot"></span>{item.status}</span></td>
  //                 <td><div className="pbar-wrap"><div className={`pbar ${item.healthColor}`} style={{ width: `${item.health}%` }}></div></div></td>
  //                 <td>{item.requests}</td>
  //                 <td>{item.success}</td>
  //                 <td>
  //                   <div className="tbl-btns">
  //                     <button className="tbl-btn view">View</button>
  //                     {item.status === 'Running' || item.status === 'Warning' ? (
  //                       <button className="tbl-btn">⏸</button>
  //                     ) : (
  //                       <>
  //                         <button className="tbl-btn green-btn">▶</button>
  //                         <button className="tbl-btn red-btn">✕</button>
  //                       </>
  //                     )}
  //                   </div>
  //                 </td>
  //               </tr>
  //             ))}
  //           </tbody>
  //         </table>
  //       </div>

  //       <div className="panel">
  //         <div className="sec-title" style={{ marginBottom: '14px' }}>Active Alerts and Notifications</div>
  //         <div className="alert-item al-crit">
  //           <div className="al-icon">🔴</div>
  //           <div className="al-body">
  //             <div className="al-msg">CRITICAL: Bank Complaints agent failed — Model endpoint unavailable</div>
  //             <div className="al-time">2 min ago</div>
  //           </div>
  //           <div className="al-badge alb-crit">CRITICAL</div>
  //         </div>
  //         <div className="alert-item al-warn">
  //           <div className="al-icon">🟡</div>
  //           <div className="al-body">
  //             <div className="al-msg">WARNING: NL Query Agent performance degraded — Response time increased by 45%</div>
  //             <div className="al-time">15 min ago</div>
  //           </div>
  //           <div className="al-badge alb-warn">WARNING</div>
  //         </div>
  //         <div className="alert-item al-info">
  //           <div className="al-icon">🔵</div>
  //           <div className="al-body">
  //             <div className="al-msg">INFO: System maintenance scheduled for tonight at 2:00 AM EST (approx. 30 min downtime)</div>
  //             <div className="al-time">1 hour ago</div>
  //           </div>
  //           <div className="al-badge alb-info">INFO</div>
  //         </div>
  //         <div className="alert-item al-info" style={{ marginTop: '8px' }}>
  //           <div className="al-icon">🔵</div>
  //           <div className="al-body">
  //             <div className="al-msg">INFO: Financial Outlook Generator v2.1 deployment completed successfully</div>
  //             <div className="al-time">3 hours ago</div>
  //           </div>
  //           <div className="al-badge alb-info">INFO</div>
  //         </div>

  //         {data.executionStats && (
  //           <div style={{ marginTop: '20px' }}>
  //             <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Execution Statistics</div>
  //             <div className="estat-row"><span className="estat-label">Total Use Cases Count</span><span className="estat-val">{data.executionStats.totalCount}</span></div>
  //             <div className="estat-row"><span className="estat-label">Use Case Pass Count</span><span className="estat-val">{data.executionStats.passCount}</span></div>
  //             <div className="estat-row"><span className="estat-label">Active Right Now</span><span className="estat-val">{data.executionStats.activeNow}</span></div>
  //             <div className="estat-row"><span className="estat-label">Total Requests Today</span><span className="estat-val">{data.executionStats.totalRequestsToday}</span></div>
  //           </div>
  //         )}
  //       </div>
  //     </div>
      
  //     {/* Additional Charts Row and Execution Details omitted for brevity in conversion, 
  //         but they can be identically ported over by translating HTML to JSX classNames */}
  //   </div>
  // );

  return (
    <div className="page active ai-agents-page">
      <div className="ai-agents-hero">
        <div className="ai-agents-eyebrow">Admin Panel</div>
        <h1 className="ai-agents-title">Coming Soon</h1>
        <p className="ai-agents-sub">
          We are working on a dedicated Admin Panel experience. Check back soon.
        </p>
      </div>

    </div>
  );
};

export default Admin;
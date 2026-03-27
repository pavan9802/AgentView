export const metricsTabStyles = `
  /* metric cards */
  .mrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .mcard{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:10px;}
  .mlbl{font-size:9px;letter-spacing:.14em;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:5px;}
  .mval{font-size:18px;font-family:var(--head);font-weight:700;line-height:1;}
  .msub{font-size:10px;color:var(--text-dim);margin-top:3px;}
  .chtitle{font-size:9px;letter-spacing:.14em;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:10px;}

  /* chart tooltip */
  .ctip{background:var(--surface2);border:1px solid var(--border2);padding:6px 10px;border-radius:3px;font-size:10px;}
  .ctip .tl{color:var(--text-dim);}.ctip .tv{color:var(--green);font-weight:600;}

  /* context pie legend */
  .cleg{display:flex;flex-direction:column;gap:5px;margin-top:8px;}
  .crow{display:flex;align-items:center;justify-content:space-between;font-size:10px;}
  .cdl{display:flex;align-items:center;gap:6px;}
  .cdot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}

  /* approval card */
  .acard{background:var(--surface2);border:1px solid var(--amber);border-radius:4px;padding:12px;animation:fin .3s ease;}
  .ahdr{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--amber);font-weight:600;margin-bottom:8px;letter-spacing:.05em;}
  .acmd{background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:8px 10px;font-size:11px;color:var(--text);margin-bottom:10px;word-break:break-all;}
  .abtns{display:flex;gap:8px;}
  .btn{flex:1;padding:6px;border-radius:3px;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.05em;cursor:pointer;border:1px solid;transition:all .15s;}
  .approve{background:var(--green-muted);border-color:var(--green);color:var(--green);}
  .approve:hover{background:var(--green);color:var(--bg);}
  .reject{background:var(--red-dim);border-color:var(--red);color:var(--red);}
  .reject:hover{background:var(--red);color:#fff;}
`;

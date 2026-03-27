export const topbarStyles = `
  .topbar{grid-column:1/-1;display:flex;align-items:center;gap:20px;padding:0 16px;background:var(--surface);border-bottom:1px solid var(--border);font-size:11px;}
  .logo{font-family:var(--head);font-size:13px;color:var(--green);letter-spacing:.08em;font-weight:700;}
  .sep{width:1px;height:20px;background:var(--border2);flex-shrink:0;}
  .tbs{display:flex;align-items:center;gap:6px;color:var(--text-dim);white-space:nowrap;}
  .tbs b{color:var(--text);font-weight:500;}
  .pulse{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 2s infinite;}
  .pulse.amber{background:var(--amber);box-shadow:0 0 6px var(--amber);}
  .tbr{margin-left:auto;display:flex;align-items:center;gap:14px;}
  .bwrap{display:flex;align-items:center;gap:8px;}
  .bbar{width:90px;height:4px;background:var(--border2);border-radius:2px;overflow:hidden;}
  .bfill{height:100%;border-radius:2px;transition:width .6s,background .4s;}
`;

export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#080c0f;--surface:#0d1318;--surface2:#111920;--surface3:#152028;
    --border:#1c2a35;--border2:#243444;
    --green:#00ff9d;--green-muted:rgba(0,255,157,0.10);
    --amber:#ffb347;--amber-dim:rgba(255,179,71,0.13);
    --red:#ff4d6a;--red-dim:rgba(255,77,106,0.13);
    --blue:#4da6ff;--blue-dim:rgba(77,166,255,0.11);
    --purple:#b464ff;--purple-dim:rgba(180,100,255,0.11);
    --text:#c8d8e4;--text-dim:#5a7a8c;--text-muted:#3a5264;
    --mono:'JetBrains Mono',monospace;--head:'Space Mono',monospace;
  }
  body{background:var(--bg);font-family:var(--mono);color:var(--text);height:100vh;overflow:hidden;}
  .dashboard{display:grid;grid-template-rows:44px 1fr;grid-template-columns:230px 1fr 290px;height:100vh;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes fin{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}

  /* shared */
  .divider{height:1px;background:var(--border);flex-shrink:0;}
  .empty{color:var(--text-muted);font-size:10px;text-align:center;padding:16px 0;}
  .badge{font-size:9px;padding:1px 6px;border-radius:2px;font-weight:600;letter-spacing:.04em;}
  .badge-running{background:var(--green-muted);color:var(--green);}
  .badge-complete{background:var(--blue-dim);color:var(--blue);}
  .badge-paused{background:var(--amber-dim);color:var(--amber);}
`;

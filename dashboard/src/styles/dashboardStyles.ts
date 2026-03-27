export const styles = `
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

  /* topbar */
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
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}

  /* sidebar */
  .sidebar{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
  .sb-hdr{padding:10px 14px 8px;font-size:9px;letter-spacing:.15em;color:var(--text-muted);font-weight:600;text-transform:uppercase;border-bottom:1px solid var(--border);flex-shrink:0;}
  .slist{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
  .sitem{padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;position:relative;}
  .sitem:hover{background:var(--surface2);}
  .sitem.active{background:var(--green-muted);border-left:2px solid var(--green);padding-left:12px;}
  .sitem.unread::after{content:'';position:absolute;right:10px;top:12px;width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green);}
  .sname{font-size:11px;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .smeta{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-top:3px;}
  .badge{font-size:9px;padding:1px 6px;border-radius:2px;font-weight:600;letter-spacing:.04em;}
  .badge-running{background:var(--green-muted);color:var(--green);}
  .badge-complete{background:var(--blue-dim);color:var(--blue);}
  .badge-paused{background:var(--amber-dim);color:var(--amber);}

  /* main */
  .main{display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;background:var(--bg);}
  .thdr{padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .sdot.running{background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 1.5s infinite;}
  .sdot.complete{background:var(--blue);}
  .sdot.paused{background:var(--amber);}
  .tname{font-size:13px;font-weight:700;color:var(--text);font-family:var(--head);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .tmeta{margin-left:auto;display:flex;gap:14px;font-size:10px;color:var(--text-dim);align-items:center;}
  .tmeta b{font-weight:500;}

  .feed{overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
  .fi{display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:3px;font-size:11px;animation:fin .2s ease;}
  .fi:hover{background:var(--surface2);}
  @keyframes fin{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
  .fts{color:var(--text-muted);font-size:10px;width:58px;flex-shrink:0;}
  .ftool{font-size:9px;font-weight:600;padding:2px 7px;border-radius:2px;flex-shrink:0;letter-spacing:.04em;}
  .t-Read{background:var(--blue-dim);color:var(--blue);}
  .t-Write{background:var(--amber-dim);color:var(--amber);}
  .t-Bash{background:var(--green-muted);color:var(--green);}
  .t-Grep{background:var(--purple-dim);color:var(--purple);}
  .t-Glob{background:var(--purple-dim);color:var(--purple);}
  .t-WebSearch{background:var(--blue-dim);color:var(--blue);}
  .t-thinking{background:rgba(255,255,255,.04);color:var(--text-muted);}
  .farg{color:var(--text-dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .farg em{color:var(--text);font-style:normal;}
  .fdur{color:var(--text-muted);font-size:10px;flex-shrink:0;min-width:44px;text-align:right;}
  .tmark{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:10px;color:var(--text-muted);margin:2px 0;}
  .tmark::before,.tmark::after{content:'';flex:1;height:1px;background:var(--border);}

  /* prompt bar */
  .pbar{border-top:1px solid var(--border);background:var(--surface);padding:10px 12px;display:flex;gap:8px;align-items:center;flex-shrink:0;}
  .ppfx{color:var(--green);font-size:12px;flex-shrink:0;}
  .pinput{flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-family:var(--mono);font-size:11px;padding:7px 10px;outline:none;transition:border-color .15s;}
  .pinput:focus{border-color:var(--green);}
  .pinput::placeholder{color:var(--text-muted);}
  .pbtn{background:var(--green-muted);border:1px solid var(--green);color:var(--green);font-family:var(--mono);font-size:10px;font-weight:600;padding:7px 14px;border-radius:3px;cursor:pointer;transition:all .15s;white-space:nowrap;letter-spacing:.05em;}
  .pbtn:hover{background:var(--green);color:var(--bg);}
  .pbtn:disabled{opacity:.4;cursor:not-allowed;}

  /* right panel */
  .rp{background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
  .ptabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;}
  .ptab{flex:1;padding:10px 4px;text-align:center;font-size:9px;letter-spacing:.1em;color:var(--text-muted);cursor:pointer;transition:all .12s;text-transform:uppercase;font-weight:600;border-bottom:2px solid transparent;}
  .ptab:hover{color:var(--text-dim);}
  .ptab.active{color:var(--green);border-bottom-color:var(--green);}
  .pbody{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}

  /* cards */
  .mrow{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .mcard{background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:10px;}
  .mlbl{font-size:9px;letter-spacing:.14em;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:5px;}
  .mval{font-size:18px;font-family:var(--head);font-weight:700;line-height:1;}
  .msub{font-size:10px;color:var(--text-dim);margin-top:3px;}
  .divider{height:1px;background:var(--border);flex-shrink:0;}
  .chtitle{font-size:9px;letter-spacing:.14em;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:10px;}

  /* tooltip */
  .ctip{background:var(--surface2);border:1px solid var(--border2);padding:6px 10px;border-radius:3px;font-size:10px;}
  .ctip .tl{color:var(--text-dim);}.ctip .tv{color:var(--green);font-weight:600;}

  /* context legend */
  .cleg{display:flex;flex-direction:column;gap:5px;margin-top:8px;}
  .crow{display:flex;align-items:center;justify-content:space-between;font-size:10px;}
  .cdl{display:flex;align-items:center;gap:6px;}
  .cdot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}

  /* bar rows */
  .blist{display:flex;flex-direction:column;gap:4px;}
  .brow{display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border-radius:3px;font-size:10px;border:1px solid var(--border);}
  .blbl{color:var(--text-muted);flex-shrink:0;}
  .bwrap{flex:1;height:3px;background:var(--border2);border-radius:2px;overflow:hidden;}
  .bfill2{height:100%;border-radius:2px;transition:width .4s;}
  .bval{color:var(--text-dim);flex-shrink:0;font-size:10px;min-width:36px;text-align:right;}

  /* approval */
  .acard{background:var(--surface2);border:1px solid var(--amber);border-radius:4px;padding:12px;animation:fin .3s ease;}
  .ahdr{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--amber);font-weight:600;margin-bottom:8px;letter-spacing:.05em;}
  .acmd{background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:8px 10px;font-size:11px;color:var(--text);margin-bottom:10px;word-break:break-all;}
  .abtns{display:flex;gap:8px;}
  .btn{flex:1;padding:6px;border-radius:3px;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.05em;cursor:pointer;border:1px solid;transition:all .15s;}
  .approve{background:var(--green-muted);border-color:var(--green);color:var(--green);}
  .approve:hover{background:var(--green);color:var(--bg);}
  .reject{background:var(--red-dim);border-color:var(--red);color:var(--red);}
  .reject:hover{background:var(--red);color:#fff;}

  /* alerts */
  .alert{display:flex;gap:8px;padding:8px 10px;border-radius:3px;font-size:10px;line-height:1.5;border:1px solid;}
  .alert-warn{background:var(--amber-dim);border-color:rgba(255,179,71,.28);}
  .alert-info{background:var(--blue-dim);border-color:rgba(77,166,255,.22);}
  .aicon{flex-shrink:0;}
  .abody{color:var(--text-dim);}.abody strong{color:var(--text);}
  .empty{color:var(--text-muted);font-size:10px;text-align:center;padding:16px 0;}
`;

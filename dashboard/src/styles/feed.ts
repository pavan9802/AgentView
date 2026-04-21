export const feedStyles = `
  /* feed panel layout */
  .main{display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;background:var(--bg);}

  /* session header */
  .thdr{padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .sdot.running{background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 1.5s infinite;}
  .sdot.complete{background:var(--blue);}
  .sdot.paused{background:var(--amber);}
  .tname{font-size:13px;font-weight:700;color:var(--text);font-family:var(--head);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .tmeta{margin-left:auto;display:flex;gap:14px;font-size:10px;color:var(--text-dim);align-items:center;}
  .tmeta b{font-weight:500;}

  /* feed list */
  .feed{overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
  .fi{display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:3px;font-size:11px;animation:fin .2s ease;}
  .fi:hover{background:var(--surface2);}
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

  /* reasoning typewriter */
  .reasoning-text{color:var(--text-muted);font-style:italic;}
  .reasoning-cursor{display:inline-block;width:1px;height:10px;background:var(--text-muted);margin-left:1px;vertical-align:middle;animation:blink .8s step-end infinite;}
  .reasoning-timer{color:var(--text-muted);font-size:10px;flex-shrink:0;min-width:28px;text-align:right;}
  @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
`;

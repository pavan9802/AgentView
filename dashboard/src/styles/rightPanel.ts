export const rightPanelStyles = `
  .rp{background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
  .ptabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;}
  .ptab{flex:1;padding:10px 4px;text-align:center;font-size:9px;letter-spacing:.1em;color:var(--text-muted);cursor:pointer;transition:all .12s;text-transform:uppercase;font-weight:600;border-bottom:2px solid transparent;}
  .ptab:hover{color:var(--text-dim);}
  .ptab.active{color:var(--green);border-bottom-color:var(--green);}
  .pbody{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
`;

export const sidebarStyles = `
  .sidebar{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
  .sb-hdr{padding:10px 14px 8px;font-size:9px;letter-spacing:.15em;color:var(--text-muted);font-weight:600;text-transform:uppercase;border-bottom:1px solid var(--border);flex-shrink:0;}
  .slist{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border2) transparent;}
  .sitem{padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;position:relative;}
  .sitem:hover{background:var(--surface2);}
  .sitem.active{background:var(--green-muted);border-left:2px solid var(--green);padding-left:12px;}
  .sitem.unread::after{content:'';position:absolute;right:10px;top:12px;width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green);}
  .sname{font-size:11px;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .smeta{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-top:3px;}
`;

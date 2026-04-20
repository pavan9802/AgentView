export const promptBarStyles = `
  .pbar-wrap{display:flex;flex-direction:column;flex-shrink:0;}
  .pbar-error{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;background:var(--red-dim);border-top:1px solid var(--red);animation:fin .15s ease;}
  .pbar-error-msg{color:var(--red);font-size:10px;font-family:var(--mono);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pbar-error-dismiss{background:none;border:none;color:var(--red);font-size:11px;cursor:pointer;flex-shrink:0;opacity:.7;padding:0 2px;}
  .pbar-error-dismiss:hover{opacity:1;}
  .pbar{border-top:1px solid var(--border);background:var(--surface);padding:10px 12px;display:flex;gap:8px;align-items:center;flex-shrink:0;}
  .ppfx{color:var(--green);font-size:12px;flex-shrink:0;}
  .pinput{flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-family:var(--mono);font-size:11px;padding:7px 10px;outline:none;transition:border-color .15s;}
  .pinput:focus{border-color:var(--green);}
  .pinput::placeholder{color:var(--text-muted);}
  .pbtn{background:var(--green-muted);border:1px solid var(--green);color:var(--green);font-family:var(--mono);font-size:10px;font-weight:600;padding:7px 14px;border-radius:3px;cursor:pointer;transition:all .15s;white-space:nowrap;letter-spacing:.05em;}
  .pbtn:hover{background:var(--green);color:var(--bg);}
  .pbtn:disabled{opacity:.4;cursor:not-allowed;}
`;

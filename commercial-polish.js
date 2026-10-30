(function(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;

  function apply(){
    const d=frame.contentDocument;
    if(!d||!d.head||!d.body)return;

    if(!d.getElementById('ayvo-commercial-polish')){
      const s=d.createElement('style');
      s.id='ayvo-commercial-polish';
      s.textContent=`
        .detail-drawer{background:#fff!important;color:var(--ink)!important;padding:0!important;border-right:0!important;overflow:hidden!important}
        .detail-drawer .drawer-body{color:var(--ink)!important}
        .table-wrap th{position:sticky;top:0;z-index:2}
        .table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border:1px solid #e3e7ec;border-top:0;border-radius:0 0 8px 8px;background:#fff;color:#75818c;font-size:8.8px}
        .table-wrap.has-commercial-footer{border-radius:8px 8px 0 0!important}
        .pager{display:flex;align-items:center;gap:4px}.pager button{width:28px;height:28px;border:1px solid #dfe4e9;background:#fff;border-radius:6px;color:#53606c;font-size:9px;cursor:pointer}.pager button.active{background:#1f61bd;color:#fff;border-color:#1f61bd}.pager button:disabled{opacity:.45;cursor:default}
        .module-health{display:flex;align-items:center;gap:7px;margin:0 0 10px;padding:8px 10px;background:#fff;border:1px solid #e5e9ee;border-radius:8px;color:#677480;font-size:8.8px}.module-health i{width:7px;height:7px;border-radius:50%;background:#2c8157}.module-health b{color:#33404c;font-size:9px}.module-health span:last-child{margin-left:auto;color:#8a949e}
        .head-actions{display:flex;align-items:center;gap:7px}.head-actions .tiny-action{border:1px solid #dfe4e9;background:#fff;border-radius:6px;min-height:30px;padding:0 9px;font-size:9px;font-weight:650;color:#4e5c69;cursor:pointer}.head-actions .tiny-action:hover{background:#f7f9fb}
        @media(max-width:780px){.topbar .actions .command-actions{grid-column:1/-1!important}.table-footer{align-items:flex-start;flex-direction:column}.pager{align-self:flex-end}}
      `;
      d.head.appendChild(s);
    }

    d.querySelectorAll('table thead th:last-child').forEach(th=>{if(!th.textContent.trim())th.textContent='Ações'});
  }

  function boot(){try{apply();setTimeout(apply,150);setTimeout(apply,600)}catch(e){console.error('AYVO commercial polish',e)}}
  if(frame.contentDocument?.readyState==='complete'||frame.contentDocument?.readyState==='interactive')boot();
  frame.addEventListener('load',boot);
})();
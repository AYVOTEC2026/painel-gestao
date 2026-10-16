(function(){
  const frame=document.getElementById('appFrame');
  if(!frame) return;

  const THEME_ID='ayvo-commercial-suite';
  const state={searchOpen:false,notificationsOpen:false,profileOpen:false};

  const pages={
    dashboard:['Painel executivo','Visão consolidada da operação, receita e pontos de atenção.'],
    locacoes:['Locações','Contratos, ocupação, cobranças e renovação dos espaços comerciais.'],
    parque:['Parque infantil','Controle de acesso, permanência, reservas e segurança em tempo real.'],
    quadras:['Quadras','Agenda, ocupação, recorrência e disponibilidade das quadras.'],
    festas:['Eventos e festas','Pipeline comercial, propostas, contratos e execução dos eventos.'],
    financeiro:['Financeiro','Recebimentos, despesas, inadimplência e resultado operacional.'],
    crm:['Clientes e relacionamento','Base de clientes, segmentos, campanhas e automações de comunicação.'],
    relatorios:['Relatórios','Indicadores executivos e exportações gerenciais.'],
    config:['Administração','Usuários, permissões, integrações, segurança e parâmetros da operação.']
  };

  const icons={
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
    bell:'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>',
    chevron:'<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>',
    close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
    building:'<svg viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v14M8 21v-7h8v7M4 10h16"></path></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
    shield:'<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"></path><path d="m9 12 2 2 4-4"></path></svg>'
  };

  function qs(d,s){return d.querySelector(s)}
  function qsa(d,s){return [...d.querySelectorAll(s)]}
  function txt(el,v){if(el)el.textContent=v}
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function iconButton(label,icon,extra=''){return `<button class="cmd-icon ${extra}" type="button" aria-label="${label}">${icon}</button>`}

  function installStyles(d){
    let style=d.getElementById(THEME_ID);
    if(style)return;
    style=d.createElement('style');
    style.id=THEME_ID;
    style.textContent=`
      :root{
        --bg:#f4f6f8!important;--panel:#fff!important;--panel2:#f8fafb!important;--ink:#17212b!important;--muted:#66727e!important;
        --line:#e4e8ed!important;--line2:#d7dde4!important;--dark:#121a22!important;--dark2:#121a22!important;
        --blue:#2466c5!important;--blue2:#1d56a6!important;--blue-soft:#eef4fb!important;--blue-line:#d8e5f5!important;
        --green:#28784f!important;--green-soft:#edf7f1!important;--amber:#96651e!important;--amber-soft:#fbf5e8!important;
        --red:#a54242!important;--red-soft:#fbefef!important;--violet:#6251a2!important;--violet-soft:#f2eff9!important;
        --shadow:0 1px 2px rgba(15,23,42,.035),0 5px 16px rgba(15,23,42,.025)!important;
        --shadow2:0 18px 50px rgba(15,23,42,.17)!important;--r:10px!important;--r2:8px!important;
      }
      html,body{background:var(--bg)!important;color:var(--ink)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif!important}
      body{font-size:13px!important}
      .login{background:#121a22!important;grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr)!important}
      .login-hero{padding:58px 64px!important;background:linear-gradient(180deg,#121a22 0%,#17222d 100%)!important}
      .login-brand{gap:12px!important}.login-brand .brandmark{width:44px!important;height:44px!important;border-radius:9px!important;background:#1a2632!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:none!important}
      .login-copy{max-width:620px!important}.login-copy .ey{font-size:10px!important;letter-spacing:.11em!important;color:#90b9ed!important;font-weight:700!important}
      .login-copy h1{font-size:43px!important;line-height:1.08!important;letter-spacing:-.03em!important;margin:14px 0 17px!important;font-weight:680!important}
      .login-copy p{font-size:15px!important;line-height:1.65!important;color:#adb8c4!important}
      .login-points{gap:10px!important;margin-top:28px!important}.login-point{border:1px solid rgba(255,255,255,.08)!important;background:rgba(255,255,255,.025)!important;border-radius:8px!important;padding:14px 15px!important}
      .login-point b{font-size:12px!important;font-weight:650!important}.login-point small{font-size:10.5px!important;color:#94a2b1!important}
      .login-panel{background:#fff!important;padding:44px!important;box-shadow:none!important;border-left:1px solid #e7eaee!important}.login-box{max-width:390px!important}
      .login-box h2{font-size:25px!important;letter-spacing:-.02em!important;font-weight:680!important;margin-bottom:7px!important}.login-box p{font-size:12.5px!important;line-height:1.55!important;margin-bottom:25px!important}
      .demo-note{border:1px solid #e7eaee!important;background:#fafbfc!important;border-radius:7px!important;font-size:10px!important}
      .app{grid-template-columns:242px minmax(0,1fr)!important;min-height:100vh!important}
      aside{background:#121a22!important;padding:18px 12px 14px!important;border-right:1px solid rgba(255,255,255,.04)!important}
      .brand{padding:3px 8px 17px!important}.brand .brandmark{border-radius:9px!important;background:#1a2632!important;box-shadow:none!important}.brand b{font-size:15px!important;font-weight:670!important}.brand small{font-size:8.5px!important;letter-spacing:.08em!important;color:#8090a0!important}
      .nav{gap:2px!important}.nav-group-label{padding:15px 10px 6px!important;color:#647382!important;font-size:8.5px!important;text-transform:uppercase!important;letter-spacing:.12em!important;font-weight:800!important;pointer-events:none}
      .nav button{min-height:38px!important;border-radius:7px!important;padding:9px 10px!important;color:#aeb9c4!important;font-size:11.5px!important;font-weight:560!important;gap:9px!important}
      .nav button:hover{background:rgba(255,255,255,.045)!important;color:#fff!important}.nav button.active{background:#1c2a38!important;color:#fff!important;box-shadow:inset 2px 0 0 #4b8de0!important}
      .nav button .ico,.nav button .ico svg{width:16px!important;height:16px!important}.nav button.active .ico{color:#7fb2f2!important}
      .side-foot{gap:8px!important}.side-card{background:rgba(255,255,255,.025)!important;border-color:rgba(255,255,255,.06)!important;border-radius:8px!important;padding:10px!important}.side-card small{font-size:8.5px!important;color:#748291!important}.side-card b{font-size:10.5px!important;font-weight:600!important}
      main{padding:0 26px 42px!important;min-width:0!important}
      .topbar{position:sticky!important;top:0!important;z-index:35!important;margin:0 -26px 22px!important;padding:13px 26px!important;background:rgba(244,246,248,.96)!important;backdrop-filter:blur(10px)!important;border-bottom:1px solid #e5e9ee!important;align-items:center!important}
      .topbar .ey{font-size:8.5px!important;letter-spacing:.09em!important;color:#718096!important}.topbar h1{font-size:22px!important;line-height:1.15!important;margin:3px 0 2px!important;letter-spacing:-.025em!important;font-weight:680!important}.subtitle{font-size:11px!important;color:#74808b!important}
      .topbar .actions{gap:7px!important}.topbar .actions>.badge,.topbar .actions>.avatar{display:none!important}.topbar .actions>.btn{display:none!important}
      .command-actions{display:flex!important;align-items:center!important;gap:7px!important}
      .cmd-btn,.cmd-icon{border:1px solid #dce2e8;background:#fff;color:#24313e;border-radius:7px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:10.5px;font-weight:650;padding:0 11px;cursor:pointer;box-shadow:0 1px 1px rgba(16,24,40,.02)}
      .cmd-btn:hover,.cmd-icon:hover{background:#f9fafb;border-color:#cfd7df}.cmd-btn.primary{background:#1f61bd;color:#fff;border-color:#1f61bd}.cmd-btn.primary:hover{background:#1b56a8}
      .cmd-icon{width:36px;padding:0;position:relative}.cmd-icon svg,.cmd-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}
      .notification-dot{position:absolute;right:7px;top:7px;width:6px;height:6px;border-radius:50%;background:#c64949;border:2px solid #fff}
      .unit-switcher{max-width:220px}.cmd-user{padding:0 8px 0 5px}.cmd-user .user-avatar{width:27px;height:27px;border-radius:6px;background:#18232e;color:#fff;display:grid;place-items:center;font-size:8.5px;font-weight:800}.cmd-user .user-copy{text-align:left;line-height:1.15}.cmd-user .user-copy b{display:block;font-size:10px}.cmd-user .user-copy small{display:block;color:#7d8792;font-size:8.5px;margin-top:2px}
      .view{animation:none!important}.view.active{display:block!important}
      .grid{gap:11px!important}.card{border:1px solid #e4e8ed!important;border-radius:9px!important;box-shadow:var(--shadow)!important;padding:15px!important;background:#fff!important}
      .head{margin-bottom:12px!important}.head h2{font-size:12.5px!important;font-weight:680!important;letter-spacing:-.01em!important}.head span{font-size:9.5px!important;color:#76818c!important}
      .stat{position:relative!important;overflow:hidden!important}.stat:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:#d7e5f5}.stat small{font-size:9.8px!important}.stat strong{font-size:24px!important;letter-spacing:-.025em!important;margin:7px 0 5px!important;font-weight:700!important}.stat em{font-size:9px!important;font-weight:600!important}
      .bar{height:4px!important;background:#edf0f3!important}.bar i{background:#4b86d1!important}
      .btn{border-radius:7px!important;min-height:34px!important;padding:8px 11px!important;font-size:10.5px!important;font-weight:650!important;box-shadow:none!important}.btn.primary{background:#1f61bd!important;border-color:#1f61bd!important;box-shadow:none!important}.btn.soft{background:#f2f6fb!important;color:#24599a!important;border-color:#dbe7f5!important}
      input,select,textarea{border-radius:7px!important}.toolbar{padding:10px!important;background:#fff!important;border:1px solid #e4e8ed!important;border-radius:9px!important;margin-bottom:11px!important}.toolbar input,.toolbar select{border-radius:7px!important;background:#fff!important}
      .table-wrap{border-radius:8px!important;border-color:#e3e7ec!important;background:#fff!important}.table-wrap table{background:#fff!important}th{background:#f8f9fb!important;color:#74808c!important;font-size:8.5px!important;letter-spacing:.055em!important;font-weight:750!important}td{font-size:10.5px!important;color:#293540!important}th,td{padding:10px 11px!important}.table-wrap tbody tr{transition:background .12s ease}.table-wrap tbody tr:hover{background:#f8fafc!important}
      .status{border-radius:999px!important;padding:4px 7px!important;font-size:8.5px!important;font-weight:720!important}.round{border-radius:7px!important;background:#f0f4f8!important;color:#425466!important}
      .row{border-radius:8px!important;padding:10px!important;border-color:#e6eaee!important;margin-bottom:6px!important}.row b{font-size:10.8px!important}.row small{font-size:9px!important}.metric{padding:9px 0!important}.metric span{font-size:10px!important}.metric b{font-size:10.5px!important}
      .note{border-style:solid!important;background:#f8fafb!important;border-color:#e5e9ee!important;border-radius:8px!important;color:#65717d!important;font-size:9.5px!important;line-height:1.55!important}
      .map{gap:8px!important}.unit{border-radius:8px!important;box-shadow:none!important}.unit.free{background:#fafbfc!important}.week{gap:7px!important}.day{border-radius:8px!important}.slot{border-radius:6px!important;background:#f0f5fb!important}.pipeline{gap:7px!important}.stage{border-radius:8px!important}.deal{border-radius:7px!important;background:#fafbfc!important}
      .doc{border-radius:8px!important}.modal-bg{background:rgba(8,13,18,.52)!important;backdrop-filter:blur(2px)!important}.modal{border-radius:10px!important;padding:18px!important;box-shadow:var(--shadow2)!important}.close{border-radius:6px!important}.actions-row{border-top-color:#e6eaee!important}
      .executive-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:11px}.exec-kpi{background:#fff;border:1px solid #e4e8ed;border-radius:9px;padding:14px;min-width:0;box-shadow:var(--shadow)}.exec-kpi .k-label{font-size:9px;color:#71808e;font-weight:600}.exec-kpi .k-value{font-size:22px;letter-spacing:-.025em;font-weight:720;margin-top:7px;white-space:nowrap}.exec-kpi .k-foot{font-size:8.8px;color:#687582;margin-top:5px}.exec-kpi .k-foot.good{color:#28784f}.exec-kpi .k-foot.bad{color:#a54242}
      .executive-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(340px,.6fr);gap:11px}.exec-card{background:#fff;border:1px solid #e4e8ed;border-radius:9px;box-shadow:var(--shadow);padding:15px}.exec-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.exec-head h2{font-size:12.5px;margin:0}.exec-head span{font-size:9px;color:#7a8590}.revenue-bars{display:grid;gap:11px}.revenue-row{display:grid;grid-template-columns:100px minmax(0,1fr) 90px;gap:10px;align-items:center}.revenue-row span{font-size:9.5px;color:#5f6c78}.revenue-track{height:7px;background:#eef1f4;border-radius:99px;overflow:hidden}.revenue-track i{display:block;height:100%;background:#568ed5;border-radius:99px}.revenue-row b{text-align:right;font-size:9.5px}
      .attention-list{display:grid;gap:7px}.attention-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid #e7eaee;border-radius:8px;background:#fff;cursor:pointer}.attention-item:hover{background:#fafbfc}.attention-item .dot{width:7px;height:7px;border-radius:50%;background:#c68a32}.attention-item.critical .dot{background:#bd4b4b}.attention-item.info .dot{background:#4c83c7}.attention-item b{display:block;font-size:10.2px}.attention-item small{display:block;color:#78838e;font-size:8.8px;margin-top:3px}.attention-item .chev{color:#8e99a4}.attention-item .chev svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2}
      .executive-secondary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:11px}.mini-summary{background:#fff;border:1px solid #e4e8ed;border-radius:9px;padding:14px;box-shadow:var(--shadow)}.mini-summary .mini-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.mini-summary .mini-head b{font-size:10.5px}.mini-summary .mini-head span{font-size:8.5px;color:#7a8590}.mini-line{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid #eef1f4}.mini-line:first-of-type{border-top:0}.mini-line span{font-size:9px;color:#6b7782}.mini-line b{font-size:9.5px}
      .commercial-status-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.commercial-status{padding:9px 10px;border:1px solid #e5e9ee;border-radius:7px;background:#fafbfc}.commercial-status small{display:block;color:#78848f;font-size:8.5px}.commercial-status b{display:block;font-size:9.5px;margin-top:3px}
      .popover{position:fixed;z-index:1200;background:#fff;border:1px solid #dfe4ea;border-radius:10px;box-shadow:0 20px 50px rgba(16,24,40,.17);overflow:hidden}.notification-panel{width:350px}.popover-head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-bottom:1px solid #edf0f3}.popover-head b{font-size:11px}.popover-head button{border:0;background:transparent;color:#53606c;font-size:9px;cursor:pointer}.notification-item{display:grid;grid-template-columns:8px 1fr;gap:9px;padding:11px 14px;border-bottom:1px solid #f0f2f4}.notification-item:last-child{border-bottom:0}.notification-item .n-dot{width:7px;height:7px;border-radius:50%;background:#c5842d;margin-top:4px}.notification-item.critical .n-dot{background:#bd4848}.notification-item b{font-size:9.8px;display:block}.notification-item small{font-size:8.7px;color:#78838e;display:block;margin-top:3px;line-height:1.35}.notification-foot{padding:10px 14px;background:#fafbfc;font-size:8.8px;color:#677480}
      .profile-panel{width:235px;padding:7px}.profile-summary{padding:10px;border-bottom:1px solid #edf0f3;margin-bottom:5px}.profile-summary b{display:block;font-size:10.5px}.profile-summary small{display:block;font-size:8.8px;color:#7b8792;margin-top:3px}.profile-action{width:100%;border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:6px;font-size:9.5px;color:#35414d;cursor:pointer}.profile-action:hover{background:#f5f7f9}
      .search-overlay{position:fixed;inset:0;z-index:1300;background:rgba(11,17,23,.35);backdrop-filter:blur(2px);display:flex;justify-content:center;align-items:flex-start;padding-top:11vh}.search-box{width:min(640px,calc(100vw - 32px));background:#fff;border:1px solid #dfe4ea;border-radius:11px;box-shadow:0 24px 70px rgba(16,24,40,.2);overflow:hidden}.search-input-wrap{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid #e8ecf0}.search-input-wrap svg{width:17px;height:17px;fill:none;stroke:#66727e;stroke-width:1.8}.search-input-wrap input{border:0!important;outline:0!important;box-shadow:none!important;font-size:13px!important;width:100%;padding:4px 0!important}.search-results{max-height:420px;overflow:auto;padding:7px}.search-group{padding:7px 8px 5px;color:#89939d;text-transform:uppercase;font-size:8px;letter-spacing:.1em;font-weight:800}.search-result{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;padding:10px;border-radius:7px;text-align:left;cursor:pointer}.search-result:hover,.search-result.active{background:#f3f6f9}.search-result b{font-size:10px;display:block}.search-result small{display:block;font-size:8.5px;color:#7a8590;margin-top:2px}.search-result span{font-size:8.5px;color:#8a949e}
      .detail-backdrop{position:fixed;inset:0;background:rgba(10,15,20,.28);z-index:1390}.detail-drawer{position:fixed;right:0;top:0;bottom:0;width:min(480px,100vw);background:#fff;z-index:1400;box-shadow:-24px 0 60px rgba(16,24,40,.18);display:flex;flex-direction:column}.drawer-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px;border-bottom:1px solid #e7ebef}.drawer-head .ey{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#7e8994;font-weight:800}.drawer-head h3{font-size:17px;margin:5px 0 0;letter-spacing:-.02em}.drawer-close{border:1px solid #e0e5ea;background:#fff;border-radius:7px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer}.drawer-close svg{width:15px;height:15px;fill:none;stroke:#52606d;stroke-width:1.8}.drawer-body{padding:17px;overflow:auto}.drawer-section{border:1px solid #e6eaee;border-radius:8px;margin-bottom:10px}.drawer-section-title{padding:10px 12px;border-bottom:1px solid #edf0f3;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#687582}.drawer-grid{display:grid;grid-template-columns:1fr 1fr}.drawer-field{padding:10px 12px;border-bottom:1px solid #f0f2f4}.drawer-field:nth-child(odd){border-right:1px solid #f0f2f4}.drawer-field small{display:block;font-size:8.5px;color:#7c8791}.drawer-field b{display:block;font-size:10.5px;margin-top:3px}.timeline{padding:4px 12px 10px}.timeline-item{position:relative;padding:9px 0 9px 18px;border-left:1px solid #dfe5ea}.timeline-item:before{content:"";position:absolute;left:-4px;top:14px;width:7px;height:7px;border-radius:50%;background:#5a8bc8}.timeline-item b{font-size:9.5px;display:block}.timeline-item small{display:block;font-size:8.5px;color:#7a8590;margin-top:3px}.drawer-actions{display:flex;gap:8px;padding:12px 17px;border-top:1px solid #e7ebef;background:#fafbfc;margin-top:auto}.drawer-actions .btn{flex:1}
      .config-extra{margin-top:11px}.audit-list{display:grid}.audit-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eef1f4}.audit-row:last-child{border-bottom:0}.audit-icon{width:32px;height:32px;border-radius:7px;background:#f2f5f8;display:grid;place-items:center;color:#51606f}.audit-icon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}.audit-row b{font-size:10px;display:block}.audit-row small{font-size:8.8px;color:#7b8792;display:block;margin-top:3px}.audit-row time{font-size:8.3px;color:#8b959e}
      #ayvoDemoBadge{background:#fff!important;color:#697582!important;border:1px solid #dfe5ea!important;border-radius:6px!important;box-shadow:0 2px 8px rgba(16,24,40,.06)!important;font-weight:650!important;letter-spacing:0!important}
      @media(max-width:1180px){.executive-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.executive-layout{grid-template-columns:1fr}.executive-secondary{grid-template-columns:1fr 1fr}.unit-switcher{display:none}.app{grid-template-columns:82px minmax(0,1fr)!important}.nav-group-label,.brand div:last-child,.side-card{display:none!important}}
      @media(max-width:780px){
        .nav-group-label{display:none!important}.app{display:block!important}.topbar{position:relative!important;margin:0 -12px 15px!important;padding:12px!important;background:#f4f6f8!important;backdrop-filter:none!important}.topbar .subtitle{max-width:94%!important}.command-actions{width:100%!important;display:grid!important;grid-template-columns:1fr auto auto!important}.command-actions .cmd-btn.primary{width:100%!important}.cmd-user .user-copy{display:none!important}.cmd-user{width:36px!important;padding:0!important}.cmd-user .user-avatar{margin:auto!important}.executive-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.exec-kpi{padding:12px}.exec-kpi .k-value{font-size:19px}.executive-layout,.executive-secondary{grid-template-columns:1fr}.revenue-row{grid-template-columns:78px minmax(0,1fr) 70px}.notification-panel{width:calc(100vw - 24px)}.detail-drawer{width:100vw}.search-overlay{padding-top:6vh}.commercial-status-strip{grid-template-columns:1fr}
      }
      @media(max-width:390px){.executive-kpis{grid-template-columns:1fr 1fr}.exec-kpi .k-value{font-size:17px}}
    `;
    d.head.appendChild(style);
  }

  function commercializeCopy(d){
    d.title='AYVO Gestão | Operação e Performance';
    document.title='AYVO Gestão | Operação e Performance';

    txt(qs(d,'.login-copy .ey'),'FOOD PARK • UNIDADE NOVA');
    const loginH1=qs(d,'.login-copy h1');
    if(loginH1)loginH1.textContent='O caixa do box e o livro do contador no mesmo sistema.';
    const loginP=qs(d,'.login-copy p');
    if(loginP)loginP.textContent='Comece sem movimento. Cada venda gera a taxa da administração, o líquido do lojista e o arquivo do mês.';
    const loginTitle=qs(d,'.login-box h2'); if(loginTitle)loginTitle.textContent='Entrar na operação';
    const loginText=qs(d,'.login-box p'); if(loginText)loginText.textContent='Depois do acesso, crie o food park vazio ou abra a demonstração para a proprietária.';
    const demo=qs(d,'.demo-note'); if(demo)demo.innerHTML='<b>Unidade nova.</b> A demonstração só existe para apresentar a operação completa.';
    const brand=qs(d,'.brand b'); if(brand)brand.textContent='AYVO Gestão';
    const brandSmall=qs(d,'.brand small'); if(brandSmall)brandSmall.textContent='Operação e performance';
    const foot=qs(d,'.login-foot'); if(foot)foot.textContent='AYVO Tecnologia • Inteligência que transforma';

    const noteLoc=qs(d,'#locacoes .note');
    if(noteLoc)noteLoc.innerHTML='<b>Cobrança automática ativa.</b> WhatsApp conectado • próximo ciclo de cobrança: 05/10 • reajustes e vencimentos monitorados.';
    const noteFin=qs(d,'#financeiro .note');
    if(noteFin)noteFin.innerHTML='<b>Conciliação operacional.</b> Pix ativo • recebíveis de cartão disponíveis após configuração do gateway • integração bancária preparada.';
    const noteCrm=qs(d,'#crm .note');
    if(noteCrm)noteCrm.innerHTML='<b>Jornada automatizada ativa.</b> Clientes podem entrar em campanhas por comportamento, recorrência, aniversário ou inatividade.';
    
    qsa(d,'#crm .head h2').forEach(h=>{if(clean(h.textContent)==='Segmentação inteligente')h.textContent='Segmentos de clientes'});
    qsa(d,'#financeiro .status').forEach(s=>{if(clean(s.textContent)==='Simulado')s.textContent='Integração pendente'});
    qsa(d,'.head h2').forEach(h=>{if(clean(h.textContent)==='Automações de WhatsApp')h.textContent='Automações de comunicação'});
  }

  function groupNavigation(d){
    const nav=qs(d,'.nav'); if(!nav||nav.dataset.grouped)return;
    nav.dataset.grouped='1';
    const map=[
      ['dashboard','Visão geral'],
      ['locacoes','Operação'],
      ['financeiro','Gestão'],
      ['crm','Relacionamento'],
      ['config','Administração']
    ];
    map.forEach(([id,label])=>{
      const btn=nav.querySelector(`[data-view="${id}"]`);
      if(btn){
        const marker=d.createElement('div'); marker.className='nav-group-label'; marker.textContent=label;
        nav.insertBefore(marker,btn);
      }
    });
    const labels={dashboard:'Painel executivo',locacoes:'Locações',parque:'Parque infantil',quadras:'Quadras',festas:'Eventos e festas',financeiro:'Financeiro',crm:'Clientes e CRM',relatorios:'Relatórios',config:'Administração'};
    qsa(d,'.nav button[data-view]').forEach(b=>{const span=b.querySelector('span'); if(span&&labels[b.dataset.view])span.textContent=labels[b.dataset.view]});
    const sideCards=qsa(d,'.side-card');
    if(sideCards[0])sideCards[0].innerHTML='<small>Unidade atual</small><b>Complexo Família Fortaleza</b>';
    if(sideCards[1])sideCards[1].innerHTML='<small>Ambiente</small><b style="color:#9eb2c6">Tecnologia por AYVO</b>';
  }

  function buildCommandBar(d,w){
    const top=qs(d,'.topbar'); if(!top||top.dataset.commercial)return;
    top.dataset.commercial='1';
    const left=top.firstElementChild;
    if(left){
      const ey=left.querySelector('.ey'); if(ey)ey.textContent='Complexo Família Fortaleza • Unidade Matriz';
      txt(qs(d,'#pageTitle'),pages.dashboard[0]); txt(qs(d,'#pageSub'),pages.dashboard[1]);
    }
    const actions=qs(d,'.actions'); if(!actions)return;
    const wrap=d.createElement('div'); wrap.className='command-actions';
    wrap.innerHTML=`
      <button class="cmd-btn unit-switcher" type="button" data-unit>${icons.building}<span>Complexo Família • Matriz</span></button>
      ${iconButton('Buscar',icons.search,'cmd-search')}
      <button class="cmd-btn primary" type="button" data-quick>${icons.plus}<span>Novo registro</span></button>
      <button class="cmd-icon cmd-notify" type="button" aria-label="Notificações">${icons.bell}<i class="notification-dot"></i></button>
      <button class="cmd-btn cmd-user" type="button" data-profile><span class="user-avatar">AD</span><span class="user-copy"><b>Administrador</b><small>Gestão completa</small></span></button>
    `;
    actions.appendChild(wrap);

    wrap.querySelector('[data-quick]').onclick=()=>w.openModal&&w.openModal('quickModal');
    wrap.querySelector('.cmd-search').onclick=()=>openSearch(d,w);
    wrap.querySelector('.cmd-notify').onclick=e=>toggleNotifications(d,e.currentTarget);
    wrap.querySelector('[data-profile]').onclick=e=>toggleProfile(d,e.currentTarget,w);
    wrap.querySelector('[data-unit]').onclick=()=>w.toast&&w.toast('Unidade atual: Complexo Família Fortaleza • Matriz');

    qsa(d,'.nav button[data-view]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.view;
        setTimeout(()=>{
          if(pages[id]){txt(qs(d,'#pageTitle'),pages[id][0]);txt(qs(d,'#pageSub'),pages[id][1])}
          closeTransient(d);
        },0);
      });
    });
  }

  function buildDashboard(d,w){
    const sec=qs(d,'#dashboard'); if(!sec||sec.dataset.commercial)return;
    sec.dataset.commercial='1';
    sec.innerHTML=`
      <div class="executive-kpis">
        <div class="exec-kpi"><div class="k-label">Receita realizada</div><div class="k-value">R$ 82,3 mil</div><div class="k-foot good">+8,7% vs. mês anterior</div></div>
        <div class="exec-kpi"><div class="k-label">Resultado operacional</div><div class="k-value">R$ 50,5 mil</div><div class="k-foot good">Margem de 61,3%</div></div>
        <div class="exec-kpi"><div class="k-label">A receber</div><div class="k-value">R$ 14,2 mil</div><div class="k-foot bad">R$ 7,8 mil vencidos</div></div>
        <div class="exec-kpi"><div class="k-label">Ocupação dos espaços</div><div class="k-value">74%</div><div class="k-foot">Média consolidada • 30 dias</div></div>
        <div class="exec-kpi"><div class="k-label">Pessoas no parque</div><div class="k-value" id="dashKids">18</div><div class="k-foot">45% da capacidade atual</div></div>
      </div>
      <div class="executive-layout">
        <div class="exec-card">
          <div class="exec-head"><h2>Receita por unidade de negócio</h2><span>Setembro/2026</span></div>
          <div class="revenue-bars">
            <div class="revenue-row"><span>Locações</span><div class="revenue-track"><i style="width:100%"></i></div><b>R$ 40.800</b></div>
            <div class="revenue-row"><span>Quadras</span><div class="revenue-track"><i style="width:41%"></i></div><b>R$ 16.920</b></div>
            <div class="revenue-row"><span>Parque</span><div class="revenue-track"><i style="width:34%"></i></div><b>R$ 13.740</b></div>
            <div class="revenue-row"><span>Eventos</span><div class="revenue-track"><i style="width:27%"></i></div><b>R$ 10.850</b></div>
          </div>
          <div class="commercial-status-strip">
            <div class="commercial-status"><small>Receita recorrente</small><b>R$ 40,8 mil</b></div>
            <div class="commercial-status"><small>Receita variável</small><b>R$ 41,5 mil</b></div>
            <div class="commercial-status"><small>Previsão do mês</small><b>R$ 96,5 mil</b></div>
          </div>
        </div>
        <div class="exec-card">
          <div class="exec-head"><h2>Atenção necessária</h2><span>4 ocorrências</span></div>
          <div class="attention-list">
            <button class="attention-item critical" type="button" data-jump="financeiro"><i class="dot"></i><span><b>2 cobranças vencidas</b><small>R$ 7.800 pendentes de recebimento</small></span><i class="chev">${icons.chevron}</i></button>
            <button class="attention-item" type="button" data-jump="locacoes"><i class="dot"></i><span><b>Contrato vence em 18 dias</b><small>Contêiner 07 • Açaí & Cia</small></span><i class="chev">${icons.chevron}</i></button>
            <button class="attention-item info" type="button" data-jump="parque"><i class="dot"></i><span><b>Pico de ocupação às 18h</b><small>32 reservas antecipadas</small></span><i class="chev">${icons.chevron}</i></button>
            <button class="attention-item" type="button" data-jump="festas"><i class="dot"></i><span><b>Evento com saldo pendente</b><small>Festa Helena • R$ 1.450</small></span><i class="chev">${icons.chevron}</i></button>
          </div>
        </div>
      </div>
      <div class="executive-secondary">
        <div class="mini-summary"><div class="mini-head"><b>Operação de hoje</b><span>Atualizado agora</span></div>
          <div class="mini-line"><span>Check-ins no parque</span><b>67</b></div><div class="mini-line"><span>Reservas de quadra</span><b>18</b></div><div class="mini-line"><span>Eventos programados</span><b>2</b></div><div class="mini-line"><span>Reservas totais</span><b>31</b></div>
        </div>
        <div class="mini-summary"><div class="mini-head"><b>Performance comercial</b><span>30 dias</span></div>
          <div class="mini-line"><span>Propostas emitidas</span><b>23</b></div><div class="mini-line"><span>Contratos fechados</span><b>14</b></div><div class="mini-line"><span>Conversão</span><b>61%</b></div><div class="mini-line"><span>Ticket médio</span><b>R$ 3.575</b></div>
        </div>
        <div class="mini-summary"><div class="mini-head"><b>Relacionamento</b><span>90 dias</span></div>
          <div class="mini-line"><span>Clientes cadastrados</span><b>1.842</b></div><div class="mini-line"><span>Recorrência</span><b>42%</b></div><div class="mini-line"><span>Mensagens entregues</span><b>98,4%</b></div><div class="mini-line"><span>Automações ativas</span><b>4</b></div>
        </div>
      </div>
    `;
    qsa(sec,'[data-jump]').forEach(b=>b.onclick=()=>navigate(d,b.dataset.jump));
  }

  function enhanceSections(d,w){
    qsa(d,'.table-wrap tbody tr').forEach((tr,i)=>{
      if(tr.dataset.detailBound)return;
      tr.dataset.detailBound='1'; tr.style.cursor='pointer';
      tr.addEventListener('click',e=>{
        if(e.target.closest('button,a,input,select'))return;
        const sec=tr.closest('.view'); if(!sec)return;
        openRowDetail(d,w,sec.id,tr,i);
      });
    });

    const locNote=qs(d,'#locacoes .note');
    if(locNote&&!locNote.nextElementSibling?.classList?.contains('commercial-status-strip')){
      const strip=d.createElement('div');strip.className='commercial-status-strip';
      strip.innerHTML='<div class="commercial-status"><small>WhatsApp</small><b>Conectado</b></div><div class="commercial-status"><small>Cobrança automática</small><b>Ativa</b></div><div class="commercial-status"><small>Próximo ciclo</small><b>05/10</b></div>';
      locNote.after(strip);
    }

    const config=qs(d,'#config');
    if(config&&!qs(d,'#commercialAdminExtra')){
      const wrap=d.createElement('div');wrap.id='commercialAdminExtra';wrap.className='grid cols2 config-extra';
      wrap.innerHTML=`
        <div class="card"><div class="head"><h2>Segurança e acesso</h2><span>Políticas da conta</span></div>
          <div class="metric"><span>Autenticação em duas etapas</span><b style="color:var(--green)">Disponível</b></div>
          <div class="metric"><span>Tempo de sessão</span><b>8 horas</b></div>
          <div class="metric"><span>Registro de atividades</span><b style="color:var(--green)">Ativo</b></div>
          <div class="metric"><span>Permissões por função</span><b>Configuradas</b></div>
        </div>
        <div class="card"><div class="head"><h2>Atividade recente</h2><span>Auditoria</span></div><div class="audit-list">
          <div class="audit-row"><i class="audit-icon">${icons.shield}</i><span><b>Cobrança enviada para Burger 85</b><small>Administrador • Financeiro</small></span><time>14:32</time></div>
          <div class="audit-row"><i class="audit-icon">${icons.clock}</i><span><b>Reserva da Quadra 3 atualizada</b><small>Recepção • Agenda</small></span><time>13:58</time></div>
          <div class="audit-row"><i class="audit-icon">${icons.building}</i><span><b>Contrato do Contêiner 07 revisado</b><small>Administrador • Locações</small></span><time>11:16</time></div>
        </div></div>`;
      config.appendChild(wrap);
    }

    const rel=qs(d,'#relatorios');
    if(rel){
      qsa(rel,'.metric span').forEach(s=>{if(clean(s.textContent)==='NPS estimado')s.textContent='NPS'});
    }
  }

  function navigate(d,id){
    const btn=qs(d,`.nav button[data-view="${id}"]`);
    if(btn){btn.click();try{btn.scrollIntoView({block:'nearest',inline:'center'})}catch(_){}}
  }

  function openRowDetail(d,w,section,tr,index){
    const cells=[...tr.cells].map(c=>clean(c.innerText));
    let eyebrow='Registro'; let title=cells[1]||cells[0]||'Detalhes'; let fields=[]; let timeline=[]; let primary='Editar registro';
    if(section==='locacoes'){
      eyebrow='Locação comercial'; title=cells[1]||'Contrato';
      fields=[['Espaço',cells[0]||'—'],['Operação',cells[1]||'—'],['Valor mensal',cells[2]||'—'],['Vencimento',cells[3]||'—'],['Vigência',cells[4]||'—'],['Situação',cells[5]||'—']];
      timeline=[['Cobrança do mês processada','Hoje, 09:10'],['Contrato revisado pela administração','18/09, 16:42'],['Documento disponível no histórico','05/09, 08:25']];
      primary='Abrir contrato';
    }else if(section==='financeiro'){
      eyebrow='Conta a receber'; title=cells[1]||'Recebível';
      fields=[['Origem',cells[0]||'—'],['Cliente',cells[1]||'—'],['Valor',cells[2]||'—'],['Vencimento',cells[3]||'—'],['Status',cells[4]||'—'],['Canal de cobrança','WhatsApp']];
      timeline=[['Cobrança automática verificada','Hoje, 08:45'],['Lembrete de vencimento enviado','09/09, 09:00'],['Título criado no financeiro','01/09, 10:12']];
      primary='Enviar cobrança';
    }else if(section==='parque'){
      eyebrow='Acesso ao parque'; title=cells[0]||'Check-in';
      fields=[['Criança',cells[0]||'—'],['Responsável',cells[1]||'—'],['Entrada',cells[2]||'—'],['Plano',cells[3]||'—'],['Permanência',cells[4]||'—'],['Identificação','Pulseira QR']];
      timeline=[['Check-in autorizado','Hoje'],['Responsável validado','No acesso'],['Pulseira vinculada','Entrada']];
      primary='Ver cadastro';
    }else{
      fields=[['Registro',title],['Módulo',pages[section]?.[0]||section],['Status','Ativo'],['Atualização','Hoje']];
      timeline=[['Registro atualizado','Hoje'],['Operação registrada no histórico','Hoje']];
    }
    openDrawer(d,w,{eyebrow,title,fields,timeline,primary});
  }

  function openDrawer(d,w,data){
    closeDrawer(d);
    const bd=d.createElement('div');bd.className='detail-backdrop';bd.id='commercialDetailBackdrop';
    const dr=d.createElement('aside');dr.className='detail-drawer';dr.id='commercialDetailDrawer';
    dr.innerHTML=`
      <div class="drawer-head"><div><div class="ey">${escapeHtml(data.eyebrow)}</div><h3>${escapeHtml(data.title)}</h3></div><button class="drawer-close" type="button">${icons.close}</button></div>
      <div class="drawer-body">
        <div class="drawer-section"><div class="drawer-section-title">Resumo</div><div class="drawer-grid">${data.fields.map(f=>`<div class="drawer-field"><small>${escapeHtml(f[0])}</small><b>${escapeHtml(f[1])}</b></div>`).join('')}</div></div>
        <div class="drawer-section"><div class="drawer-section-title">Histórico do registro</div><div class="timeline">${data.timeline.map(t=>`<div class="timeline-item"><b>${escapeHtml(t[0])}</b><small>${escapeHtml(t[1])}</small></div>`).join('')}</div></div>
        <div class="drawer-section"><div class="drawer-section-title">Responsabilidade</div><div class="drawer-grid"><div class="drawer-field"><small>Responsável atual</small><b>Administrador</b></div><div class="drawer-field"><small>Última atualização</small><b>Hoje</b></div></div></div>
      </div>
      <div class="drawer-actions"><button class="btn" type="button" data-secondary>Fechar</button><button class="btn primary" type="button" data-primary>${escapeHtml(data.primary)}</button></div>`;
    d.body.appendChild(bd);d.body.appendChild(dr);
    bd.onclick=()=>closeDrawer(d);dr.querySelector('.drawer-close').onclick=()=>closeDrawer(d);dr.querySelector('[data-secondary]').onclick=()=>closeDrawer(d);
    dr.querySelector('[data-primary]').onclick=()=>w.toast&&w.toast(data.primary+' • ação disponível na operação');
  }

  function closeDrawer(d){qs(d,'#commercialDetailBackdrop')?.remove();qs(d,'#commercialDetailDrawer')?.remove()}

  function openSearch(d,w){
    qs(d,'#commercialSearch')?.remove();
    const overlay=d.createElement('div');overlay.className='search-overlay';overlay.id='commercialSearch';
    const records=[
      ['Painel executivo','Indicadores, receita e alertas','dashboard','Módulo'],
      ['Locações','Contratos e espaços comerciais','locacoes','Módulo'],
      ['Parque infantil','Check-ins, reservas e segurança','parque','Módulo'],
      ['Quadras','Agenda e ocupação','quadras','Módulo'],
      ['Eventos e festas','Propostas, contratos e checklist','festas','Módulo'],
      ['Financeiro','Recebíveis e resultado operacional','financeiro','Módulo'],
      ['Clientes e CRM','Segmentos e campanhas','crm','Módulo'],
      ['Burger 85','Contêiner 04 • cobrança vencida','financeiro','Cliente'],
      ['Açaí & Cia','Contêiner 07 • renovação em 18 dias','locacoes','Contrato'],
      ['Festa Helena','26/09 • saldo de R$ 1.450','festas','Evento']
    ];
    overlay.innerHTML=`<div class="search-box"><div class="search-input-wrap">${icons.search}<input type="text" placeholder="Buscar módulo, cliente, contrato ou evento" autofocus></div><div class="search-results"></div></div>`;
    d.body.appendChild(overlay);
    const input=overlay.querySelector('input'),results=overlay.querySelector('.search-results');
    const render=()=>{
      const q=clean(input.value).toLowerCase();
      const hits=records.filter(r=>!q||(r[0]+' '+r[1]+' '+r[3]).toLowerCase().includes(q));
      results.innerHTML='<div class="search-group">'+(q?'Resultados':'Acesso rápido')+'</div>'+hits.map((r,i)=>`<button class="search-result ${i===0?'active':''}" type="button" data-view="${r[2]}"><span><b>${escapeHtml(r[0])}</b><small>${escapeHtml(r[1])}</small></span><span>${escapeHtml(r[3])}</span></button>`).join('');
      qsa(results,'.search-result').forEach(b=>b.onclick=()=>{navigate(d,b.dataset.view);overlay.remove()});
    };
    render();input.oninput=render;overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
    input.onkeydown=e=>{if(e.key==='Escape')overlay.remove();if(e.key==='Enter'){results.querySelector('.search-result')?.click()}};
    setTimeout(()=>input.focus(),0);
  }

  function positionPopover(panel,anchor,d){
    const r=anchor.getBoundingClientRect(); panel.style.top=(r.bottom+7)+'px';
    const width=parseInt(getComputedStyle(panel).width)||350;
    panel.style.left=Math.max(12,Math.min(innerWidth-width-12,r.right-width))+'px';
  }

  function toggleNotifications(d,anchor){
    const existing=qs(d,'#commercialNotifications'); if(existing){existing.remove();return}
    closeTransient(d);
    const p=d.createElement('div');p.className='popover notification-panel';p.id='commercialNotifications';
    p.innerHTML=`<div class="popover-head"><b>Notificações</b><button type="button">Marcar como lidas</button></div>
      <div class="notification-item critical"><i class="n-dot"></i><span><b>2 cobranças vencidas</b><small>Locações totalizam R$ 7.800 em atraso.</small></span></div>
      <div class="notification-item"><i class="n-dot"></i><span><b>Contrato próximo do vencimento</b><small>Contêiner 07 vence em 18 dias.</small></span></div>
      <div class="notification-item"><i class="n-dot"></i><span><b>Saldo de evento pendente</b><small>Festa Helena possui R$ 1.450 a receber.</small></span></div>
      <div class="notification-item"><i class="n-dot"></i><span><b>Pico de ocupação previsto</b><small>Parque infantil: maior fluxo esperado às 18h.</small></span></div>
      <div class="notification-foot">Central de alertas operacionais • dados demonstrativos</div>`;
    d.body.appendChild(p);positionPopover(p,anchor,d);
    p.querySelector('.popover-head button').onclick=()=>{qsa(p,'.notification-item').forEach(x=>x.style.opacity='.55');anchor.querySelector('.notification-dot')?.remove()};
  }

  function toggleProfile(d,anchor,w){
    const existing=qs(d,'#commercialProfile'); if(existing){existing.remove();return}
    closeTransient(d);
    const p=d.createElement('div');p.className='popover profile-panel';p.id='commercialProfile';
    p.innerHTML=`<div class="profile-summary"><b>Administrador</b><small>admin@complexofamilia.com.br</small></div>
      <button class="profile-action" type="button">Minha conta</button><button class="profile-action" type="button">Preferências</button><button class="profile-action" type="button">Central de ajuda</button><button class="profile-action" type="button" data-exit>Sair do sistema</button>`;
    d.body.appendChild(p);positionPopover(p,anchor,d);p.querySelector('[data-exit]').onclick=()=>w.sair&&w.sair();
  }

  function closeTransient(d){qs(d,'#commercialNotifications')?.remove();qs(d,'#commercialProfile')?.remove()}

  function refineDemoBadge(d){
    const badge=qs(d,'#ayvoDemoBadge'); if(badge)badge.textContent='Ambiente demonstrativo';
  }

  function bindGlobal(d,w){
    if(d.body.dataset.commercialBound)return; d.body.dataset.commercialBound='1';
    d.addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch(d,w)}
      if(e.key==='Escape'){qs(d,'#commercialSearch')?.remove();closeTransient(d);closeDrawer(d)}
    });
    d.addEventListener('click',e=>{
      if(!e.target.closest('.cmd-notify')&&!e.target.closest('#commercialNotifications'))qs(d,'#commercialNotifications')?.remove();
      if(!e.target.closest('[data-profile]')&&!e.target.closest('#commercialProfile'))qs(d,'#commercialProfile')?.remove();
    });
  }

  function apply(){
    const d=frame.contentDocument,w=frame.contentWindow;
    if(!d||!d.head||!d.body)return;
    installStyles(d);
    commercializeCopy(d);
    groupNavigation(d);
    buildCommandBar(d,w);
    buildDashboard(d,w);
    enhanceSections(d,w);
    refineDemoBadge(d);
    bindGlobal(d,w);
  }

  function boot(){
    try{apply();setTimeout(apply,120);setTimeout(apply,500)}catch(err){console.error('AYVO commercial suite',err)}
  }
  if(frame.contentDocument?.readyState==='complete'||frame.contentDocument?.readyState==='interactive')boot();
  frame.addEventListener('load',boot);
})();
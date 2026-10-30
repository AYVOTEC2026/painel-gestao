(function () {
  const frame = document.getElementById('appFrame');
  if (!frame) return;
  const L = window.AyvoFoodParkLedger;
  if (!L) return;

  const KEY = 'ayvo.foodpark.v1';
  const MODULES_KEY = 'ayvo.foodpark.modules';
  const BRAND = { name: 'Pepama Food Park', logo: 'assets/pepama-logo.png', icon: 'assets/pepama-icon.png' };
  // Telas principais do food park, na ordem do menu.
  const MAIN_VIEWS = ['dashboard', 'pdv', 'locacoes', 'contabilidade', 'config'];
  // Telas herdadas do complexo de lazer: só aparecem se ligadas em Configurações.
  const EXTRA_VIEWS = [
    ['parque', 'Parque infantil'],
    ['bilheteria', 'Loja e bilheteria'],
    ['quadras', 'Quadras'],
    ['festas', 'Eventos e festas'],
    ['crm', 'Clientes e campanhas']
  ];
  // Financeiro e Relatórios antigos foram absorvidos pela tela Financeiro (id contabilidade).
  const RETIRED_VIEWS = ['financeiro', 'relatorios'];
  let state = load();
  let modules = loadModules();
  let cart = [];
  let payMethod = 'pix';
  let stallId = '';
  let month = monthNow();

  function loadModules() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MODULES_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function saveModules() {
    try { localStorage.setItem(MODULES_KEY, JSON.stringify(modules)); } catch (err) { /* navegador sem armazenamento */ }
  }
  function viewEnabled(id) {
    if (RETIRED_VIEWS.includes(id)) return false;
    if (EXTRA_VIEWS.some(v => v[0] === id)) return !!modules[id];
    return true;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { onboarded: false };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return { onboarded: false };
      return parsed;
    } catch (err) {
      return { onboarded: false };
    }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function money(n) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }
  function monthNow() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  }
  function nowIso() {
    const n = new Date();
    const p = x => String(x).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  }
  function toast(w, msg) { if (w && typeof w.toast === 'function') w.toast(msg); }
  function keep(next) {
    if (!L.booksBalanced(next)) throw new Error('O lançamento não fechou em débitos e créditos. Nada foi salvo.');
    state = next;
    save();
  }
  function stallName(id) {
    const stall = (state.stalls || []).find(s => s.id === id);
    return stall ? stall.name : 'Box';
  }
  function methodLabel(id) {
    const method = L.METHODS.find(m => m.id === id);
    return method ? method.label : id;
  }
  function monthLabel(ym) {
    return String(ym || '').split('-').reverse().join('/');
  }
  function shortDate(day) {
    const parts = String(day || '').slice(0, 10).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
  }

  // Tudo que pede uma ação do administrador. Alimenta o Início e o sino do topo.
  function pendencias(includeCash) {
    if (!state.onboarded) return [];
    const out = [];
    if (includeCash && !L.openSession(state)) {
      out.push({ level: 'warn', title: 'Caixa fechado', detail: 'Abra o caixa para começar a vender.', act: 'open-cash', label: 'Abrir caixa' });
    }
    (state.charges || []).filter(c => c.status === 'aberto').forEach(c => out.push({
      level: 'bad',
      title: `Aluguel em aberto • ${stallName(c.stallId)}`,
      detail: `${money(c.amount)} • mês ${monthLabel(c.competence)}`,
      act: 'pay-rent',
      id: c.id,
      label: 'Marcar como recebido'
    }));
    (state.bills || []).filter(b => b.status === 'aberto').forEach(b => out.push({
      level: 'warn',
      title: `${b.direction === 'pagar' ? 'Conta a pagar' : 'Conta a receber'} • ${b.description}`,
      detail: `${money(b.amount)}${b.due ? ' • vence ' + shortDate(b.due) : ''}`,
      act: 'pay-bill',
      id: b.id,
      label: b.direction === 'pagar' ? 'Marcar como paga' : 'Marcar como recebida'
    }));
    return out;
  }

  function addStyle(d) {
    if (d.getElementById('foodparkStyle')) return;
    const st = d.createElement('style');
    st.id = 'foodparkStyle';
    st.textContent = `
      .fp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}
      .fp-split{display:grid;grid-template-columns:1.15fr .85fr;gap:13px}
      .fp-pdv{display:grid;grid-template-columns:1.2fr .8fr;gap:13px;align-items:start}
      .fp-stalls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .fp-stalls button,.fp-pay button,.fp-tabs button{border:1px solid var(--line2);background:#fff;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:750}
      .fp-stalls button.active,.fp-pay button.active,.fp-tabs button.active{background:#f7ece5;border-color:#c9937a;color:#8a4426}
      .fp-pay{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .fp-quote{display:grid;gap:6px;margin:10px 0;padding:10px;border-radius:12px;background:#fffaf5;border:1px dashed #e8cbbb;font-size:11px}
      .fp-quote div{display:flex;justify-content:space-between;gap:10px}
      .fp-check{display:grid;gap:8px}
      .fp-check div{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
      .fp-check i{width:8px;height:8px;border-radius:50%;background:#d0d5db}
      .fp-check i.on{background:#2f8f5b}
      .fp-box{cursor:pointer;font:inherit;text-align:left;width:100%;color:inherit}
      .fp-box:hover{border-color:#c9937a}
      .fp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .fp-panel{display:none}.fp-panel.active{display:block}
      .fp-terminal .fp-stalls button,.fp-terminal .product button,.fp-terminal .fp-pay button{min-height:46px}
      .fp-note{font-size:11px;color:var(--muted);line-height:1.5}
      .fp-setup{display:grid;gap:10px}
      .product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .product small{display:block;color:var(--muted);margin:4px 0 8px}
      .cart-line{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
      .nav button[data-view="pdv"],.nav button[data-view="contabilidade"]{display:flex!important}
      html .nav button.fp-off,html .nav .fp-extra-label.fp-off,html .nav .nav-group-label:not(.fp-extra-label){display:none!important}
      .unit-switcher{display:none!important}
      .brand.fp-brand{padding:2px 4px 14px!important}
      .fp-logo{display:block;width:100%;max-width:190px;aspect-ratio:300/244;object-fit:cover;border-radius:14px;box-shadow:0 6px 18px rgba(60,35,25,.14)}
      .fp-logo-icon{display:none;width:46px;height:46px;border-radius:12px;margin:0 auto}
      .fp-kpis.fp-kpis-3{grid-template-columns:repeat(3,minmax(0,1fr))}
      .fp-status{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;margin-bottom:13px;border-radius:12px;background:#fff;border:1px solid var(--line);border-left:4px solid #b9a69a}
      .fp-status.open{border-left-color:#2f8f5b}
      .fp-status b{display:block;font-size:14px}.fp-status span{display:block;font-size:11px;color:var(--muted);margin-top:3px}
      .fp-todo{display:grid;gap:8px}
      .fp-todo-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px}
      .fp-todo-item i{width:8px;height:8px;border-radius:50%;background:#d9a441}.fp-todo-item.bad i{background:#b64848}
      .fp-todo-item b{display:block;font-size:11.5px}.fp-todo-item small{display:block;color:var(--muted);font-size:10px;margin-top:2px}
      .fp-empty{padding:16px;border-radius:10px;background:#f6faf7;border:1px solid #d9ebe0;color:#2f6f4b;font-size:11.5px}
      .fp-step{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#f7ece5;color:#8a4426;font-size:10px;font-weight:800;margin-right:7px}
      .fp-label{font-size:10.5px;color:var(--muted);font-weight:750;margin:12px 0 6px}
      .fp-box small{display:block}
      .fp-toolbar{align-items:center}.fp-toolbar .fp-month{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700}.fp-toolbar .fp-month input{flex:none;min-width:0;width:170px}
      .fp-toolbar .fp-push{margin-left:auto}
      .fp-quick{display:grid;grid-template-columns:1fr 1fr;gap:9px}.fp-quick .btn{min-height:52px;font-size:12px}
      .fp-modules{display:grid;gap:8px;margin-top:10px}
      .fp-modules label{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:12px;cursor:pointer}
      .fp-modules input{width:18px;height:18px;accent-color:#a05433}
      .notification-item{width:100%;border:0;background:transparent;text-align:left;cursor:pointer}.notification-item:hover{background:#fafafa}
      .cart-line{align-items:center}
      .fp-logo{max-width:160px;margin:0 auto}
      @media(max-width:1180px){.fp-logo{display:none}.fp-logo-icon{display:block}}
      @media(max-width:900px){.fp-kpis,.fp-kpis.fp-kpis-3,.fp-split,.fp-pdv,.product-grid{grid-template-columns:1fr}.fp-pay{grid-template-columns:1fr 1fr}.fp-status{flex-direction:column;align-items:stretch}.fp-toolbar .fp-push{margin-left:0;width:100%}}
    `;
    d.head.appendChild(st);
  }

  function titles() {
    return {
      dashboard: ['Início', 'O que precisa da sua atenção hoje.'],
      pdv: ['PDV', 'Escolha o box, adicione os itens e finalize a venda.'],
      locacoes: ['Boxes e lojistas', 'Quem ocupa cada box, quanto paga de aluguel e o cardápio.'],
      contabilidade: ['Financeiro', 'Resultado do mês, acerto com os lojistas, contas e arquivos para o contador.'],
      parque: ['Parque infantil', 'Módulo extra • dados de exemplo.'],
      bilheteria: ['Loja e bilheteria', 'Módulo extra • dados de exemplo.'],
      quadras: ['Quadras', 'Módulo extra • dados de exemplo.'],
      festas: ['Eventos e festas', 'Módulo extra • dados de exemplo.'],
      crm: ['Clientes e campanhas', 'Módulo extra • dados de exemplo.'],
      config: ['Configurações', 'Dados do food park, taxas e módulos extras.']
    };
  }

  function activate(d, w, id) {
    if (!viewEnabled(id)) id = 'dashboard';
    const btn = d.querySelector(`.nav button[data-view="${id}"]`);
    d.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b === btn));
    d.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
    const map = titles();
    const title = d.getElementById('pageTitle');
    const sub = d.getElementById('pageSub');
    if (map[id] && title) title.textContent = map[id][0];
    if (map[id] && sub) sub.textContent = map[id][1];
    if (w.meta) w.meta[id] = map[id] || w.meta[id];
    try { w.scrollTo(0, 0); } catch (err) { /* iframe ainda abrindo */ }
  }

  function ensureNav(d, w) {
    const nav = d.querySelector('.nav');
    if (!nav) return;
    const icon = paths => `<i class="ico"><svg viewBox="0 0 24 24">${paths}</svg></i>`;
    const add = (id, label, svg, before) => {
      if (nav.querySelector(`[data-view="${id}"]`)) return;
      const btn = d.createElement('button');
      btn.dataset.view = id;
      btn.innerHTML = `${icon(svg)}<span>${label}</span>`;
      const ref = nav.querySelector(`[data-view="${before}"]`);
      if (ref) nav.insertBefore(btn, ref); else nav.appendChild(btn);
      btn.addEventListener('click', () => activate(d, w, id));
    };
    add('pdv', 'PDV', '<path d="M4 7h16v10H4z"/><path d="M8 17v2M16 17v2M7 11h4"/>', 'locacoes');
    add('contabilidade', 'Financeiro', '<path d="M4 19h16M6 16V8M10 16V8M14 16V8M18 16V8M3 8l9-4 9 4z"/>', 'financeiro');
    const labels = { dashboard: 'Início', pdv: 'PDV', locacoes: 'Boxes', contabilidade: 'Financeiro', config: 'Configurações' };
    EXTRA_VIEWS.forEach(([id, label]) => { labels[id] = label; });
    nav.querySelectorAll('button[data-view]').forEach(btn => {
      const span = btn.querySelector('span');
      if (span && labels[btn.dataset.view]) span.textContent = labels[btn.dataset.view];
    });

    let extraLabel = nav.querySelector('.fp-extra-label');
    if (!extraLabel) {
      extraLabel = d.createElement('div');
      extraLabel.className = 'nav-group-label fp-extra-label';
      extraLabel.textContent = 'Módulos extras';
    }
    const order = [...MAIN_VIEWS, null, ...EXTRA_VIEWS.map(v => v[0]), ...RETIRED_VIEWS];
    order.forEach(id => {
      const node = id === null ? extraLabel : nav.querySelector(`[data-view="${id}"]`);
      if (node) nav.appendChild(node);
    });
    nav.querySelectorAll('button[data-view]').forEach(btn => btn.classList.toggle('fp-off', !viewEnabled(btn.dataset.view)));
    extraLabel.classList.toggle('fp-off', !EXTRA_VIEWS.some(v => modules[v[0]]));
    const current = d.querySelector('.nav button.active');
    if (current && !viewEnabled(current.dataset.view)) activate(d, w, 'dashboard');
    // O `meta` do original.html é const e não fica em window; o nav-hotfix do celular lê w.meta.
    w.meta = Object.assign(w.meta || {}, titles());
  }

  function ensureViews(d) {
    const main = d.querySelector('main');
    if (!main) return;
    if (!d.getElementById('pdv')) {
      const sec = d.createElement('section');
      sec.className = 'view';
      sec.id = 'pdv';
      const fin = d.getElementById('financeiro');
      main.insertBefore(sec, fin || null);
    }
    if (!d.getElementById('contabilidade')) {
      const sec = d.createElement('section');
      sec.className = 'view';
      sec.id = 'contabilidade';
      const fin = d.getElementById('financeiro');
      main.insertBefore(sec, fin || null);
    }
  }

  // Marca e nomes do app. Os textos do login ficam em orange-white-theme.js.
  function brand(d) {
    const name = state.onboarded && state.park ? state.park.name : BRAND.name;
    const city = state.onboarded && state.park ? state.park.city : '';
    const side = d.querySelector('aside .brand');
    if (side && !side.classList.contains('fp-brand')) {
      side.classList.add('fp-brand');
      side.innerHTML = `<img class="fp-logo" src="${BRAND.logo}" alt="${esc(BRAND.name)}"><img class="fp-logo-icon" src="${BRAND.icon}" alt="">`;
    }
    const cards = d.querySelectorAll('.side-card');
    if (cards[0]) cards[0].innerHTML = `<small>Unidade</small><b>${esc(name)}</b>`;
    if (cards[1]) cards[1].innerHTML = '<small>Tecnologia</small><b>AYVO</b>';
    const ey = d.querySelector('.topbar .ey');
    if (ey) ey.textContent = city ? `${name} • ${city}` : name;
    d.title = BRAND.name;
    document.title = BRAND.name;
    const email = d.getElementById('loginEmail');
    if (email && /complexofamilia/i.test(email.value)) email.value = 'admin@foodpark.com.br';
  }

  function checklist() {
    const stalls = state.stalls || [];
    const products = stalls.reduce((n, s) => n + (s.products || []).length, 0);
    const items = [
      [!!state.onboarded, 'Dados do food park'],
      [stalls.some(s => s.status === 'ativo'), 'Primeiro lojista no box'],
      [products > 0, 'Cardápio com preço'],
      [!!L.openSession(state), 'Caixa aberto'],
      [(state.sales || []).some(s => s.status === 'paga'), 'Primeira venda no PDV']
    ];
    return items;
  }

  function renderDashboard(d) {
    const sec = d.getElementById('dashboard');
    if (!sec || !state.onboarded) return;
    const view = L.dashboard(state, nowIso());
    const session = L.openSession(state);
    const steps = checklist();
    const done = steps.filter(s => s[0]).length;
    const todo = pendencias(false);
    const recent = (state.sales || []).filter(s => s.status === 'paga').slice(0, 5);
    const setup = done < steps.length
      ? `<div class="card" style="margin-bottom:13px"><div class="head"><h2>Primeiros passos</h2><span>${done} de ${steps.length} feitos</span></div><div class="fp-check">${steps.map(step => `<div><i class="${step[0] ? 'on' : ''}"></i><span>${step[1]}</span><b>${step[0] ? 'feito' : 'falta'}</b></div>`).join('')}</div><div class="actions-row"><button class="btn" data-act="go" data-go="locacoes">Cadastrar lojista</button><button class="btn primary" data-act="go" data-go="pdv">Ir para o PDV</button></div></div>`
      : '';
    sec.innerHTML = `
      <div class="fp-status ${view.cashOpen ? 'open' : ''}">
        <div><b>${view.cashOpen ? 'Caixa aberto' : 'Caixa fechado'}</b><span>${view.cashOpen ? `Aberto às ${esc(String(session.openedAt).slice(11, 16))} • ${view.todayTickets} vendas hoje` : 'Abra o caixa para começar a vender.'}</span></div>
        ${view.cashOpen ? '<button class="btn primary" data-act="go" data-go="pdv">Ir para o PDV</button>' : '<button class="btn primary" data-act="open-cash">Abrir caixa</button>'}
      </div>
      <div class="fp-kpis fp-kpis-3">
        <div class="card stat"><small>Vendas de hoje</small><strong>${money(view.todayGross)}</strong><em>${view.todayTickets} pedidos • média ${money(view.averageTicket)}</em></div>
        <div class="card stat"><small>Ganho do food park hoje</small><strong>${money(view.todayAdmin)}</strong><em>Taxa sobre as vendas dos boxes</em></div>
        <div class="card stat"><small>Resultado do mês</small><strong>${money(view.monthResult)}</strong><em>Aluguéis + taxas − despesas</em></div>
      </div>
      <div style="margin-top:13px">${setup}</div>
      <div class="fp-split">
        <div class="card"><div class="head"><h2>Pendências</h2><span>${todo.length ? todo.length + (todo.length === 1 ? ' item' : ' itens') : ''}</span></div>${todo.length
          ? `<div class="fp-todo">${todo.map(t => `<div class="fp-todo-item ${t.level}"><i></i><span><b>${esc(t.title)}</b><small>${esc(t.detail)}</small></span><button class="btn" data-act="${t.act}" data-id="${esc(t.id || '')}">${esc(t.label)}</button></div>`).join('')}</div>`
          : '<div class="fp-empty">Nada pendente. Aluguéis e contas estão em dia.</div>'}<span id="dashKids" hidden></span></div>
        <div class="card"><div class="head"><h2>Últimas vendas</h2><button class="btn" data-act="go" data-go="pdv">Ver no PDV</button></div>${recent.length ? `<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Box</th><th>Pagamento</th><th>Total</th></tr></thead><tbody>${recent.map(sale => `<tr><td>${L.pad(sale.number, 4)}</td><td>${esc(stallName(sale.stallId))}</td><td>${esc(methodLabel(sale.method))}</td><td>${money(sale.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="note">Nenhuma venda ainda. Abra o caixa e registre o primeiro pedido no PDV.</div>'}</div>
      </div>`;
  }

  function renderBoxes(d) {
    const sec = d.getElementById('locacoes');
    if (!sec || !state.onboarded) return;
    const boxes = Number(state.park.boxes) || 0;
    const byBox = {};
    state.stalls.filter(s => s.status === 'ativo').forEach(s => { byBox[s.box] = s; });
    const cards = [];
    for (let n = 1; n <= boxes; n += 1) {
      const stall = byBox[n];
      if (!stall) {
        cards.push(`<button class="unit free fp-box" data-act="new-stall" data-box="${n}"><span class="dot"></span><span class="n">Box ${L.pad(n, 2)}</span><b>Disponível</b><small>Cadastrar lojista</small></button>`);
      } else {
        const openRent = state.charges.filter(c => c.stallId === stall.id && c.status === 'aberto').reduce((acc, c) => acc + c.amount, 0);
        cards.push(`<button class="unit fp-box ${openRent ? 'late' : ''}" data-act="menu" data-stall="${stall.id}"><span class="dot"></span><span class="n">Box ${L.pad(stall.box, 2)}</span><b>${esc(stall.name)}</b><small>${money(stall.rent)} / mês • taxa ${esc(stall.feePercent)}%</small><small>${openRent ? 'Aluguel em aberto ' + money(openRent) : 'Aluguel em dia'}</small></button>`);
      }
    }
    const occupied = Object.keys(byBox).length;
    sec.innerHTML = `
      <div class="toolbar fp-toolbar"><button class="btn primary" data-act="new-stall">Novo lojista</button><span class="fp-note">${occupied} de ${boxes} boxes ocupados.</span></div>
      <div class="card"><div class="head"><h2>Mapa dos boxes</h2><span>Clique num box para ver o cardápio ou cadastrar um lojista</span></div><div class="map">${cards.join('')}</div></div>
      <div class="card" style="margin-top:13px"><div class="head"><h2>Lojistas</h2></div><div class="table-wrap"><table><thead><tr><th>Box</th><th>Operação</th><th>Responsável</th><th>Aluguel</th><th>Taxa sobre vendas</th><th></th></tr></thead><tbody>
        ${(state.stalls.filter(s => s.status === 'ativo').map(s => `<tr><td>${L.pad(s.box, 2)}</td><td>${esc(s.name)}</td><td>${esc(s.owner || '—')}</td><td>${money(s.rent)}</td><td>${esc(s.feePercent)}%</td><td><button class="btn" data-act="menu" data-stall="${s.id}">Cardápio</button></td></tr>`).join('')) || '<tr><td colspan="6">Nenhum lojista ainda.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function renderPdv(d) {
    const sec = d.getElementById('pdv');
    if (!sec || !state.onboarded) return;
    const session = L.openSession(state);
    const stalls = state.stalls.filter(s => s.status === 'ativo');
    if (!stallId || !stalls.some(s => s.id === stallId)) stallId = stalls[0] ? stalls[0].id : '';
    const stall = stalls.find(s => s.id === stallId);
    sec.innerHTML = `
      <div class="fp-pdv">
        <div class="card">
          <div class="head"><h2><span class="fp-step">1</span>Escolha o box e os itens</h2><span>${session ? 'Caixa aberto' : 'Caixa fechado'}</span></div>
          <div class="fp-stalls">${stalls.map(s => `<button type="button" data-act="pick-stall" data-stall="${s.id}" class="${s.id === stallId ? 'active' : ''}">${L.pad(s.box, 2)} • ${esc(s.name)}</button>`).join('') || '<div class="note">Cadastre um lojista e o cardápio antes de vender.</div>'}</div>
          <div class="product-grid">${stall ? stall.products.filter(p => p.active !== false).map(p => `<div class="product"><b>${esc(p.name)}</b><small>${p.stock == null ? '&nbsp;' : 'Estoque: ' + p.stock}</small><strong>${money(p.price)}</strong><button class="btn soft full" data-act="add" data-product="${p.id}" style="margin-top:9px">Adicionar</button></div>`).join('') : ''}</div>
        </div>
        <div class="card" id="fpCartCard">
          <div class="head"><h2><span class="fp-step">2</span>Pedido</h2><button class="btn" data-act="clear-cart">Limpar</button></div>
          <div class="fp-note" style="margin-bottom:8px">${session ? 'Caixa aberto às ' + esc(String(session.openedAt).slice(11, 16)) + ' com ' + money(session.openingFloat) + ' de troco' : 'Abra o caixa antes de vender.'}</div>
          <div class="actions-row" style="justify-content:flex-start;margin-top:0">
            ${session ? '<button class="btn" data-act="move">Tirar ou colocar dinheiro</button><button class="btn" data-act="close-cash">Fechar caixa</button>' : '<button class="btn primary" data-act="open-cash">Abrir caixa</button>'}
          </div>
          <div id="fpCartLines" style="margin-top:12px"></div>
          <div class="form-grid" style="margin-top:12px">
            <div class="field"><label>Mesa ou comanda</label><input id="fpTable" placeholder="Opcional"></div>
            <div class="field"><label>Desconto (R$)</label><input id="fpDiscount" type="number" min="0" step="0.01" value="0"></div>
            <div class="field full"><label>Nome do cliente</label><input id="fpCustomer" placeholder="Opcional"></div>
          </div>
          <div class="fp-label"><span class="fp-step">3</span>Forma de pagamento</div>
          <div class="fp-pay" id="fpPay">${L.METHODS.map(m => `<button type="button" data-act="pay" data-method="${m.id}" class="${m.id === payMethod ? 'active' : ''}">${m.label}</button>`).join('')}</div>
          <div id="fpQuote" class="fp-quote"></div>
          <button class="btn primary full" data-act="finish">Finalizar venda</button>
        </div>
      </div>
      <div class="card" style="margin-top:13px"><div class="head"><h2>Vendas deste caixa</h2><span>Cancelar uma venda desfaz o lançamento</span></div><div id="fpSessionSales"></div></div>`;
    renderCart(d);
    renderSessionSales(d);
  }

  function renderCart(d) {
    const lines = d.getElementById('fpCartLines');
    const quoteBox = d.getElementById('fpQuote');
    if (!lines || !quoteBox || !state.onboarded) return;
    lines.innerHTML = cart.length ? cart.map((item, index) => `<div class="cart-line"><span>${item.qty}× ${esc(item.name)}</span><span>${money(item.price * item.qty)} <button class="btn" data-act="remove" data-index="${index}">×</button></span></div>`).join('') : '<div class="note">Nenhum item no pedido.</div>';
    let quote = null;
    let error = '';
    try {
      if (cart.length && stallId) {
        quote = L.quoteSale(state, {
          stallId,
          method: payMethod,
          discount: Number(d.getElementById('fpDiscount')?.value || 0),
          items: cart.map(item => ({ productId: item.productId, qty: item.qty }))
        });
      }
    } catch (err) { error = err.message; }
    quoteBox.innerHTML = error ? `<div class="note">${esc(error)}</div>` : quote ? `<div><span>Total do cliente</span><b>${money(quote.total)}</b></div><div><span>Taxa da maquininha</span><b>${money(quote.cardFee)}</b></div><div><span>Taxa do food park (${esc(quote.adminPercent)}%)</span><b>${money(quote.adminFee)}</b></div><div><span>Fica para o lojista</span><b>${money(quote.netStall)}</b></div><div><span>Quem recebe o dinheiro</span><b>${quote.holder === 'lojista' ? 'Lojista' : 'Food park'}</b></div>` : '<div class="fp-note">Adicione itens para ver quanto fica para o lojista e para o food park.</div>';
  }

  function renderSessionSales(d) {
    const box = d.getElementById('fpSessionSales');
    if (!box || !state.onboarded) return;
    const session = L.openSession(state);
    const sales = session ? state.sales.filter(s => s.sessionId === session.id).slice(0, 8) : [];
    box.innerHTML = sales.length ? `<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Box</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${sales.map(s => `<tr><td>${L.pad(s.number, 4)}</td><td>${esc(stallName(s.stallId))}</td><td>${money(s.total)}</td><td>${s.status === 'paga' ? '<span class="status ok">Paga</span>' : '<span class="status bad">Cancelada</span>'}</td><td>${s.status === 'paga' && !s.settledAt ? `<button class="btn" data-act="cancel" data-sale="${s.id}">Cancelar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="note">Ainda não há venda nesta sessão de caixa.</div>';
  }

  function renderAccounting(d) {
    const sec = d.getElementById('contabilidade');
    if (!sec || !state.onboarded) return;
    const report = L.dre(state, month);
    const rows = L.settlement(state, month);
    const charges = state.charges.filter(c => c.competence === month);
    const book = state.ledger.filter(line => L.ymOf(line.at) === month).slice(-25).reverse();
    const today = L.expectedByMethod((state.sales || []).filter(s => s.status === 'paga' && L.dayOf(s.at) === L.dayOf(nowIso())));
    const todayTotal = L.METHODS.reduce((acc, m) => acc + (Number(today[m.id]) || 0), 0);
    const tabs = [['dre', 'Resultado do mês'], ['repasse', 'Acerto com lojistas'], ['contas', 'Contas e aluguéis'], ['caixa', 'Caixa de hoje'], ['livro', 'Lançamentos']];
    sec.innerHTML = `
      <div class="toolbar fp-toolbar"><label class="fp-month"><span>Mês</span><input id="fpMonth" type="month" value="${esc(month)}"></label><span class="fp-note fp-push">Arquivos para o contador (CSV):</span><button class="btn" data-act="export" data-file="vendas">Vendas</button><button class="btn" data-act="export" data-file="lancamentos">Lançamentos</button><button class="btn" data-act="export" data-file="dre">Resultado</button><button class="btn" data-act="export" data-file="repasses">Acertos</button></div>
      <div class="fp-kpis">
        <div class="card stat"><small>Vendas dos boxes</small><strong>${money(report.grossSales)}</strong><em>${report.tickets} pedidos • dinheiro dos lojistas</em></div>
        <div class="card stat"><small>Receita do food park</small><strong>${money(report.revenue)}</strong><em>Aluguéis + taxas</em></div>
        <div class="card stat"><small>Despesas</small><strong>${money(report.expense)}</strong><em>Contas do mês</em></div>
        <div class="card stat"><small>Resultado do mês</small><strong>${money(report.result)}</strong><em>Receita − despesas</em></div>
      </div>
      <div class="fp-tabs" style="margin-top:13px">${tabs.map(t => `<button type="button" data-act="tab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>
      <div class="fp-panel" data-panel="dre"><div class="card"><div class="head"><h2>Resultado do mês</h2><span>As vendas dos boxes não contam como receita do food park, só a taxa e o aluguel</span></div><div class="table-wrap"><table><thead><tr><th>Conta</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${report.lines.filter(line => Number(line.amount)).map(line => `<tr><td>${esc(line.label)}</td><td>${line.nature === 'receita' ? 'Entrada' : 'Saída'}</td><td>${money(line.amount)}</td></tr>`).join('') || '<tr><td colspan="3">Nada lançado neste mês.</td></tr>'}<tr><td><b>Resultado</b></td><td></td><td><b>${money(report.result)}</b></td></tr></tbody></table></div></div></div>
      <div class="fp-panel" data-panel="repasse"><div class="card"><div class="head"><h2>Acerto com lojistas</h2><span>${esc(monthLabel(month))}</span></div><div class="table-wrap"><table><thead><tr><th>Box</th><th>Vendas</th><th>Taxa da maquininha</th><th>Taxa do food park</th><th>Aluguel em aberto</th><th>Acerto</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td>${L.pad(row.box, 2)} • ${esc(row.name)}</td><td>${money(row.gross)}</td><td>${money(row.cardFee)}</td><td>${money(row.adminFee)}</td><td>${money(row.rentOpen)}</td><td>${row.direction === 'zerado' ? 'Acertado' : (row.direction === 'pagar_lojista' ? 'Pagar ao lojista ' : 'Receber do lojista ') + money(row.amount)}</td><td>${row.direction === 'zerado' ? '' : `<button class="btn primary" data-act="settle" data-stall="${row.stallId}">Registrar acerto</button>`}</td></tr>`).join('') || '<tr><td colspan="7">Sem lojistas.</td></tr>'}</tbody></table></div><p class="fp-note">Pix, cartão e voucher caem na conta do food park, que repassa ao lojista o que é dele. No dinheiro é o contrário: o lojista recebe e deve a taxa. "Registrar acerto" fecha essa conta e o aluguel em aberto do mês.</p></div></div>
      <div class="fp-panel" data-panel="contas"><div class="grid cols2"><div class="card"><div class="head"><h2>Aluguéis do mês</h2><span>${esc(monthLabel(month))}</span></div><div class="table-wrap"><table><thead><tr><th>Box</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>${charges.map(c => `<tr><td>${esc(stallName(c.stallId))}</td><td>${money(c.amount)}</td><td>${c.status === 'pago' ? '<span class="status ok">Recebido</span>' : '<span class="status warn">Em aberto</span>'}</td><td>${c.status === 'aberto' ? `<button class="btn" data-act="pay-rent" data-id="${c.id}">Marcar como recebido</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum aluguel neste mês.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="head"><h2>Contas a pagar e receber</h2><button class="btn primary" data-act="new-bill">Nova conta</button></div><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>${state.bills.map(b => `<tr><td>${esc(b.description)}</td><td>${money(b.amount)}</td><td>${b.status === 'pago' ? '<span class="status ok">Quitada</span>' : '<span class="status warn">Em aberto</span>'}</td><td>${b.status === 'aberto' ? `<button class="btn" data-act="pay-bill" data-id="${b.id}">${b.direction === 'pagar' ? 'Marcar como paga' : 'Marcar como recebida'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="4">Nenhuma conta lançada.</td></tr>'}</tbody></table></div></div></div></div>
      <div class="fp-panel" data-panel="caixa"><div class="card"><div class="head"><h2>Vendas de hoje por forma de pagamento</h2><span>Para conferir o caixa</span></div>${L.METHODS.map(m => `<div class="metric"><span>${m.label}${m.holder === 'lojista' ? ' • fica com o lojista' : ''}</span><b>${money(today[m.id] || 0)}</b></div>`).join('')}<div class="metric"><span><b>Total</b></span><b>${money(todayTotal)}</b></div></div></div>
      <div class="fp-panel" data-panel="livro"><div class="card"><div class="head"><h2>Lançamentos do mês</h2><span>Os ${book.length} mais recentes</span></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Conta</th><th>Descrição</th><th>Débito</th><th>Crédito</th></tr></thead><tbody>${book.map(line => `<tr><td>${esc(String(line.at).slice(0, 16).replace('T', ' '))}</td><td>${esc(L.ACCOUNT_LABELS[line.account] || line.account)}</td><td>${esc(line.memo)}</td><td>${line.debit ? money(line.debit) : ''}</td><td>${line.credit ? money(line.credit) : ''}</td></tr>`).join('') || '<tr><td colspan="5">Sem lançamentos.</td></tr>'}</tbody></table></div><p class="fp-note">Visão do contador, em partidas dobradas. O mês completo está nos arquivos CSV no topo da tela.</p></div></div>`;
    const active = sec.dataset.tab || 'dre';
    sec.querySelectorAll('[data-act="tab"]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === active));
    sec.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === active));
  }

  function renderConfig(d) {
    const sec = d.getElementById('config');
    if (!sec || !state.onboarded) return;
    sec.innerHTML = `<div class="grid cols2">
      <div class="card" id="fpSettings"><div class="head"><h2>Dados do food park</h2><span>Usados no PDV e no financeiro</span></div>
        <div class="metric"><span>Nome</span><b>${esc(state.park.name)}</b></div>
        <div class="metric"><span>Cidade</span><b>${esc(state.park.city || 'Não informada')}</b></div>
        <div class="metric"><span>CNPJ</span><b>${esc(state.park.cnpj || 'Não informado')}</b></div>
        <div class="metric"><span>Quantidade de boxes</span><b>${esc(state.park.boxes)}</b></div>
        <div class="metric"><span>Taxa padrão sobre as vendas</span><b>${esc(state.park.adminFeePercent)}%</b></div>
        <div class="metric"><span>Taxa da maquininha (débito / crédito)</span><b>${esc(state.park.fees.debito)}% / ${esc(state.park.fees.credito)}%</b></div>
        <div class="actions-row"><button class="btn primary" data-act="edit-park">Editar dados e taxas</button></div>
      </div>
      <div class="card"><div class="head"><h2>Módulos extras</h2></div>
        <p class="fp-note">Ligue só o que existir no seu espaço. Esses módulos ainda mostram dados de exemplo.</p>
        <div class="fp-modules">${EXTRA_VIEWS.map(([id, label]) => `<label><input type="checkbox" data-module="${id}" ${modules[id] ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>
      </div>
    </div>
    <div class="card" style="margin-top:13px"><div class="head"><h2>Demonstração e recomeço</h2></div>
      <p class="fp-note">A demonstração substitui os dados deste navegador por um food park de exemplo. Recomeçar apaga tudo e volta para a implantação.</p>
      <div class="actions-row"><button class="btn" data-act="load-demo">Carregar demonstração</button><button class="btn danger" data-act="reset">Recomeçar do zero</button></div>
    </div>`;
  }

  // Substitui os atalhos do botão "Novo registro", que ainda apontavam para o complexo de lazer.
  function renderQuick(d) {
    const box = d.querySelector('#quickModal .modal');
    if (!box) return;
    const session = L.openSession(state);
    box.innerHTML = `<div class="modal-top"><h3>O que você quer fazer?</h3><button class="close" data-act="quick-close">×</button></div>
      <div class="fp-quick">
        <button class="btn primary" data-act="go" data-go="pdv">Nova venda</button>
        <button class="btn" data-act="${session ? 'close-cash' : 'open-cash'}">${session ? 'Fechar caixa' : 'Abrir caixa'}</button>
        <button class="btn" data-act="new-stall">Novo lojista</button>
        <button class="btn" data-act="new-bill">Lançar conta a pagar ou receber</button>
      </div>`;
  }

  function exposeToTopbar(d, w) {
    w.ayvoPendencias = () => pendencias(true);
    w.ayvoSearchRecords = () => {
      const pages = titles();
      const views = MAIN_VIEWS.concat(EXTRA_VIEWS.map(v => v[0])).filter(viewEnabled);
      const stalls = state.onboarded ? state.stalls.filter(s => s.status === 'ativo') : [];
      return views.map(id => [pages[id][0], pages[id][1], id, 'Tela'])
        .concat(stalls.map(s => [s.name, `Box ${L.pad(s.box, 2)}${s.owner ? ' • ' + s.owner : ''}`, 'locacoes', 'Lojista']));
    };
    const dot = d.querySelector('.cmd-notify .notification-dot');
    if (dot) dot.style.display = pendencias(true).length ? '' : 'none';
  }

  function render(d, w) {
    if (!state.onboarded) {
      showOnboarding(d, w);
      return;
    }
    const next = L.ensureMonthlyRents(state, nowIso());
    if (next.ledger.length !== state.ledger.length) { state = next; save(); }
    brand(d);
    renderDashboard(d);
    renderBoxes(d);
    renderPdv(d);
    renderAccounting(d);
    renderConfig(d);
    renderQuick(d);
    ensureNav(d, w);
    exposeToTopbar(d, w);
    const app = d.getElementById('app');
    if (app && !app.classList.contains('hidden')) hideOnboarding(d);
  }

  function modal(d, id, html) {
    let bg = d.getElementById(id);
    if (bg) bg.remove();
    bg = d.createElement('div');
    bg.className = 'modal-bg show';
    bg.id = id;
    bg.innerHTML = `<div class="modal">${html}</div>`;
    d.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
    bg.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => bg.remove()));
    return bg;
  }

  function showOnboarding(d, w) {
    if (d.getElementById('fpOnboarding')) return;
    const app = d.getElementById('app');
    if (!app || app.classList.contains('hidden')) return;
    const bg = d.createElement('div');
    bg.className = 'modal-bg show';
    bg.id = 'fpOnboarding';
    bg.innerHTML = `<div class="modal">
      <div class="modal-top"><h3>Vamos configurar o food park</h3></div>
      <p class="fp-note">Preencha os dados básicos para começar do zero. Se quiser só conhecer o sistema, abra a demonstração.</p>
      <div class="fp-setup">
        <div class="field"><label>Nome do food park</label><input id="fpName" placeholder="Ex.: ${esc(BRAND.name)}"></div>
        <div class="form-grid">
          <div class="field"><label>Cidade</label><input id="fpCity" placeholder="Cidade"></div>
          <div class="field"><label>CNPJ</label><input id="fpCnpj" placeholder="Opcional agora"></div>
          <div class="field"><label>Quantidade de boxes</label><input id="fpBoxes" type="number" min="4" max="24" value="8"></div>
          <div class="field"><label>Taxa de administração (%)</label><input id="fpFee" type="number" min="0" max="100" step="0.1" value="10"></div>
        </div>
      </div>
      <div class="actions-row"><button class="btn" id="fpDemo">Ver demonstração</button><button class="btn primary" id="fpCreate">Começar do zero</button></div></div>`;
    d.body.appendChild(bg);
    bg.querySelector('#fpCreate').onclick = () => {
      const name = bg.querySelector('#fpName').value.trim();
      if (name.length < 2) { toast(w, 'Informe o nome do food park'); return; }
      const boxes = Math.max(4, Math.min(24, Number(bg.querySelector('#fpBoxes').value) || 8));
      const fee = Number(bg.querySelector('#fpFee').value);
      state = L.blank({
        name,
        city: bg.querySelector('#fpCity').value.trim(),
        cnpj: bg.querySelector('#fpCnpj').value.trim(),
        boxes,
        adminFeePercent: fee >= 0 && fee <= 100 ? fee : 10
      });
      state.mode = 'empty';
      cart = [];
      save();
      bg.remove();
      render(d, w);
      activate(d, w, 'dashboard');
      toast(w, 'Food park criado sem movimento. Cadastre o primeiro box.');
    };
    bg.querySelector('#fpDemo').onclick = () => loadDemo(d, w, bg);
  }

  function hideOnboarding(d) {
    const bg = d.getElementById('fpOnboarding');
    if (bg) bg.remove();
  }

  function loadDemo(d, w, bg) {
    state = L.demo(new Date().toISOString());
    state.park.name = BRAND.name;
    cart = [];
    month = monthNow();
    save();
    if (bg) bg.remove();
    render(d, w);
    activate(d, w, 'dashboard');
    toast(w, 'Demonstração carregada com vendas de exemplo.');
  }

  function download(d, name, text) {
    const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
    const a = d.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function onClick(d, w, event) {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const quick = btn.closest('#quickModal');
    if (quick) quick.classList.remove('show');
    try {
      if (act === 'quick-close') return;
      if (act === 'go') { activate(d, w, btn.dataset.go); return; }
      if (act === 'pick-stall') { stallId = btn.dataset.stall; cart = []; renderPdv(d); return; }
      if (act === 'pay') { payMethod = btn.dataset.method; d.querySelectorAll('#fpPay button').forEach(b => b.classList.toggle('active', b.dataset.method === payMethod)); renderCart(d); return; }
      if (act === 'add') return addToCart(d, w, btn.dataset.product);
      if (act === 'remove') { cart.splice(Number(btn.dataset.index), 1); renderCart(d); return; }
      if (act === 'clear-cart') { cart = []; renderCart(d); return; }
      if (act === 'finish') return finishSale(d, w);
      if (act === 'open-cash') return openCashModal(d, w);
      if (act === 'close-cash') return closeCashModal(d, w);
      if (act === 'move') return moveModal(d, w);
      if (act === 'cancel') return cancelModal(d, w, btn.dataset.sale);
      if (act === 'new-stall') return stallModal(d, w, btn.dataset.box);
      if (act === 'menu') return menuModal(d, w, btn.dataset.stall);
      if (act === 'tab') {
        const sec = d.getElementById('contabilidade');
        sec.dataset.tab = btn.dataset.tab;
        renderAccounting(d);
        return;
      }
      if (act === 'export') {
        const bundle = L.exportBundle(state, month);
        download(d, `foodpark-${btn.dataset.file}-${month}.csv`, bundle[btn.dataset.file]);
        toast(w, 'Arquivo gerado para o contador');
        return;
      }
      if (act === 'settle') {
        keep(L.registerSettlement(state, btn.dataset.stall, month, 'pix', nowIso()));
        render(d, w); toast(w, 'Repasse lançado no livro');
        d.getElementById('contabilidade').dataset.tab = 'repasse';
        renderAccounting(d);
        return;
      }
      if (act === 'pay-rent') {
        keep(L.payCharge(state, btn.dataset.id, 'pix', nowIso()));
        render(d, w); toast(w, 'Aluguel recebido');
        return;
      }
      if (act === 'pay-bill') {
        keep(L.payBill(state, btn.dataset.id, 'pix', nowIso()));
        render(d, w); toast(w, 'Conta baixada');
        return;
      }
      if (act === 'new-bill') return billModal(d, w);
      if (act === 'edit-park') return parkModal(d, w);
      if (act === 'load-demo') {
        if (!confirm('A demonstração substitui os dados desta unidade neste navegador.')) return;
        loadDemo(d, w);
        return;
      }
      if (act === 'reset') {
        if (!confirm('Apagar a operação deste navegador e começar do zero?')) return;
        localStorage.removeItem(KEY);
        state = { onboarded: false };
        cart = [];
        render(d, w);
        activate(d, w, 'dashboard');
      }
    } catch (err) {
      toast(w, err.message || 'Não foi possível concluir.');
    }
  }

  function addToCart(d, w, productId) {
    const stall = state.stalls.find(s => s.id === stallId);
    const product = stall && stall.products.find(p => p.id === productId);
    if (!product) return;
    const current = cart.find(item => item.productId === productId);
    const qty = current ? current.qty + 1 : 1;
    if (product.stock != null && qty > product.stock) { toast(w, 'Estoque insuficiente'); return; }
    if (current) current.qty += 1;
    else cart.push({ productId, name: product.name, price: product.price, qty: 1 });
    renderCart(d);
  }

  function finishSale(d, w) {
    const result = L.commitSale(state, {
      stallId,
      method: payMethod,
      discount: Number(d.getElementById('fpDiscount')?.value || 0),
      customer: d.getElementById('fpCustomer')?.value || '',
      table: d.getElementById('fpTable')?.value || '',
      items: cart.map(item => ({ productId: item.productId, qty: item.qty }))
    }, nowIso());
    keep(result.state);
    const sale = result.sale;
    cart = [];
    render(d, w);
    activate(d, w, 'pdv');
    modal(d, 'fpReceipt', `
      <div class="modal-top"><h3>Pedido ${L.pad(sale.number, 4)}</h3><button class="close" data-close>×</button></div>
      <div class="doc"><div class="doc-title">${esc(stallName(sale.stallId))}</div><p>Pagamento em ${esc(methodLabel(sale.method))}. ${sale.holder === 'lojista' ? 'O dinheiro fica com o lojista, que deve a taxa ao food park.' : 'O valor entrou na conta do food park, que repassa ao lojista a parte dele.'}</p><hr>
        ${sale.items.map(item => `<div class="metric"><span>${item.qty}× ${esc(item.name)}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}
        <div class="metric"><span>Total</span><b>${money(sale.total)}</b></div>
        <div class="metric"><span>Taxa do food park</span><b>${money(sale.adminFee)}</b></div>
        <div class="metric"><span>Fica para o lojista</span><b>${money(sale.netStall)}</b></div>
      </div>
      <div class="actions-row"><button class="btn" id="fpSeeBooks">Ver no financeiro</button><button class="btn primary" data-close>Nova venda</button></div>`);
    d.getElementById('fpSeeBooks').onclick = () => {
      d.getElementById('fpReceipt').remove();
      activate(d, w, 'contabilidade');
    };
    toast(w, `Venda ${L.pad(sale.number, 4)} registrada`);
  }

  function openCashModal(d, w) {
    const bg = modal(d, 'fpCashOpen', `<div class="modal-top"><h3>Abrir caixa</h3><button class="close" data-close>×</button></div><div class="field"><label>Troco que fica no caixa (R$)</label><input id="fpFloat" type="number" min="0" step="0.01" value="200"></div><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpOpenSave">Abrir</button></div>`);
    bg.querySelector('#fpOpenSave').onclick = () => {
      try {
        keep(L.openCash(state, { openingFloat: bg.querySelector('#fpFloat').value }, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'pdv'); toast(w, 'Caixa aberto');
      } catch (err) { toast(w, err.message); }
    };
  }

  function closeCashModal(d, w) {
    const session = L.openSession(state);
    if (!session) return;
    const expected = L.expectedByMethod(L.sessionSales(state, session.id));
    const bg = modal(d, 'fpCashClose', `<div class="modal-top"><h3>Fechar caixa</h3><button class="close" data-close>×</button></div><p class="fp-note">Conte o que entrou em cada forma de pagamento. Se o valor contado for diferente do sistema, a diferença entra no resultado como quebra de caixa.</p>${L.METHODS.map(m => `<div class="field"><label>${m.label} (sistema: ${money(expected[m.id] || 0)})</label><input data-count="${m.id}" type="number" min="0" step="0.01" value="${expected[m.id] || 0}"></div>`).join('')}<div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpCloseSave">Fechar caixa</button></div>`);
    bg.querySelector('#fpCloseSave').onclick = () => {
      const counted = {};
      L.METHODS.forEach(m => { counted[m.id] = bg.querySelector(`[data-count="${m.id}"]`).value; });
      try {
        keep(L.closeCash(state, { counted }, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'pdv');
        toast(w, 'Caixa fechado');
      } catch (err) { toast(w, err.message); }
    };
  }

  function moveModal(d, w) {
    const bg = modal(d, 'fpMove', `<div class="modal-top"><h3>Tirar ou colocar dinheiro no caixa</h3><button class="close" data-close>×</button></div><div class="field"><label>O que vai fazer</label><select id="fpMoveType"><option value="sangria">Tirar dinheiro do caixa (sangria)</option><option value="suprimento">Colocar troco no caixa (suprimento)</option></select></div><div class="field"><label>Valor (R$)</label><input id="fpMoveAmount" type="number" min="0" step="0.01"></div><div class="field"><label>Motivo</label><input id="fpMoveNote" placeholder="Ex.: troco para o box 02"></div><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpMoveSave">Lançar</button></div>`);
    bg.querySelector('#fpMoveSave').onclick = () => {
      try {
        keep(L.cashMove(state, {
          type: bg.querySelector('#fpMoveType').value,
          amount: bg.querySelector('#fpMoveAmount').value,
          note: bg.querySelector('#fpMoveNote').value
        }, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'pdv'); toast(w, 'Movimento de caixa lançado');
      } catch (err) { toast(w, err.message); }
    };
  }

  function cancelModal(d, w, saleId) {
    const bg = modal(d, 'fpCancel', `<div class="modal-top"><h3>Cancelar venda</h3><button class="close" data-close>×</button></div><div class="field"><label>Motivo</label><input id="fpReason" placeholder="Ex.: pedido duplicado"></div><div class="actions-row"><button class="btn" data-close>Voltar</button><button class="btn danger" id="fpCancelSave">Estornar</button></div>`);
    bg.querySelector('#fpCancelSave').onclick = () => {
      try {
        keep(L.cancelSale(state, saleId, bg.querySelector('#fpReason').value, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'pdv'); toast(w, 'Venda estornada no livro');
      } catch (err) { toast(w, err.message); }
    };
  }

  function stallModal(d, w, box) {
    const free = [];
    const used = new Set(state.stalls.filter(s => s.status === 'ativo').map(s => Number(s.box)));
    for (let n = 1; n <= Number(state.park.boxes); n += 1) if (!used.has(n)) free.push(n);
    const selected = box && free.includes(Number(box)) ? Number(box) : free[0];
    if (!selected) { toast(w, 'Todos os boxes estão ocupados'); return; }
    const bg = modal(d, 'fpStall', `<div class="modal-top"><h3>Novo lojista</h3><button class="close" data-close>×</button></div><div class="form-grid">
      <div class="field"><label>Box</label><select id="fpStallBox">${free.map(n => `<option value="${n}" ${n === selected ? 'selected' : ''}>Box ${L.pad(n, 2)}</option>`).join('')}</select></div>
      <div class="field"><label>Operação</label><input id="fpStallName" placeholder="Nome no cardápio"></div>
      <div class="field"><label>Responsável</label><input id="fpStallOwner"></div>
      <div class="field"><label>Documento</label><input id="fpStallDoc" placeholder="CPF ou CNPJ"></div>
      <div class="field"><label>WhatsApp</label><input id="fpStallPhone"></div>
      <div class="field"><label>Aluguel mensal</label><input id="fpStallRent" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label>Taxa sobre vendas (%)</label><input id="fpStallFee" type="number" min="0" max="100" step="0.1" value="${esc(state.park.adminFeePercent)}"></div>
    </div><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpStallSave">Salvar box</button></div>`);
    bg.querySelector('#fpStallSave').onclick = () => {
      try {
        keep(L.createStall(state, {
          box: bg.querySelector('#fpStallBox').value,
          name: bg.querySelector('#fpStallName').value,
          owner: bg.querySelector('#fpStallOwner').value,
          document: bg.querySelector('#fpStallDoc').value,
          phone: bg.querySelector('#fpStallPhone').value,
          rent: bg.querySelector('#fpStallRent').value,
          feePercent: bg.querySelector('#fpStallFee').value
        }, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'locacoes'); toast(w, 'Lojista cadastrado e aluguel lançado, se houver');
      } catch (err) { toast(w, err.message); }
    };
  }

  function menuModal(d, w, id) {
    const stall = state.stalls.find(s => s.id === id);
    if (!stall) return;
    const bg = modal(d, 'fpMenu', `<div class="modal-top"><h3>Cardápio • ${esc(stall.name)}</h3><button class="close" data-close>×</button></div>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th>Preço</th><th>Estoque</th></tr></thead><tbody>${stall.products.map(p => `<tr><td>${esc(p.name)}</td><td>${money(p.price)}</td><td>${p.stock == null ? 'Livre' : p.stock}</td></tr>`).join('') || '<tr><td colspan="3">Cardápio vazio.</td></tr>'}</tbody></table></div>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Novo item</label><input id="fpItemName"></div>
        <div class="field"><label>Preço</label><input id="fpItemPrice" type="number" min="0" step="0.01"></div>
        <div class="field"><label>Categoria</label><input id="fpItemCat" value="Cardápio"></div>
        <div class="field"><label>Estoque (vazio = sem controle)</label><input id="fpItemStock" type="number" min="0" step="1"></div>
      </div>
      <div class="actions-row"><button class="btn" data-act="go" data-go="pdv" data-close>Vender neste box</button><button class="btn primary" id="fpItemSave">Incluir item</button></div>`);
    bg.querySelector('#fpItemSave').onclick = () => {
      try {
        const stock = bg.querySelector('#fpItemStock').value;
        keep(L.addProduct(state, stall.id, {
          name: bg.querySelector('#fpItemName').value,
          price: bg.querySelector('#fpItemPrice').value,
          category: bg.querySelector('#fpItemCat').value,
          stock: stock === '' ? null : stock
        }));
        bg.remove(); menuModal(d, w, stall.id); renderBoxes(d); renderPdv(d);
        toast(w, 'Item incluído no cardápio');
      } catch (err) { toast(w, err.message); }
    };
    bg.querySelector('[data-go="pdv"]').onclick = () => { stallId = stall.id; cart = []; activate(d, w, 'pdv'); renderPdv(d); };
  }

  function billModal(d, w) {
    const bg = modal(d, 'fpBill', `<div class="modal-top"><h3>Nova conta</h3><button class="close" data-close>×</button></div><div class="form-grid">
      <div class="field"><label>Tipo</label><select id="fpBillDir"><option value="pagar">A pagar</option><option value="receber">A receber</option></select></div>
      <div class="field"><label>Categoria</label><select id="fpBillCat"><option value="energia">Energia</option><option value="agua">Água</option><option value="marketing">Marketing</option><option value="manutencao">Manutenção</option><option value="folha">Folha</option><option value="outras">Outras</option></select></div>
      <div class="field full"><label>Descrição</label><input id="fpBillDesc"></div>
      <div class="field"><label>Valor</label><input id="fpBillAmount" type="number" min="0" step="0.01"></div>
      <div class="field"><label>Vencimento</label><input id="fpBillDue" type="date" value="${L.dayOf(nowIso())}"></div>
    </div><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpBillSave">Lançar</button></div>`);
    bg.querySelector('#fpBillSave').onclick = () => {
      try {
        keep(L.addBill(state, {
          direction: bg.querySelector('#fpBillDir').value,
          category: bg.querySelector('#fpBillCat').value,
          description: bg.querySelector('#fpBillDesc').value,
          amount: bg.querySelector('#fpBillAmount').value,
          due: bg.querySelector('#fpBillDue').value
        }, nowIso()));
        bg.remove(); render(d, w); activate(d, w, 'contabilidade');
        d.getElementById('contabilidade').dataset.tab = 'contas';
        renderAccounting(d);
        toast(w, 'Conta lançada na competência');
      } catch (err) { toast(w, err.message); }
    };
  }

  function parkModal(d, w) {
    const bg = modal(d, 'fpPark', `<div class="modal-top"><h3>Dados do food park</h3><button class="close" data-close>×</button></div><div class="form-grid">
      <div class="field"><label>Nome</label><input id="fpEditName" value="${esc(state.park.name)}"></div>
      <div class="field"><label>Cidade</label><input id="fpEditCity" value="${esc(state.park.city || '')}"></div>
      <div class="field"><label>CNPJ</label><input id="fpEditCnpj" value="${esc(state.park.cnpj || '')}"></div>
      <div class="field"><label>Taxa padrão sobre as vendas (%)</label><input id="fpEditFee" type="number" min="0" max="100" step="0.1" value="${esc(state.park.adminFeePercent)}"></div>
      <div class="field"><label>Maquininha no débito (%)</label><input id="fpEditDebit" type="number" min="0" max="20" step="0.01" value="${esc(state.park.fees.debito)}"></div>
      <div class="field"><label>Maquininha no crédito (%)</label><input id="fpEditCredit" type="number" min="0" max="20" step="0.01" value="${esc(state.park.fees.credito)}"></div>
    </div><p class="fp-note">A taxa padrão vale para lojistas novos. Vendas já feitas permanecem com a taxa da época.</p><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="fpParkSave">Salvar</button></div>`);
    bg.querySelector('#fpParkSave').onclick = () => {
      const fee = Number(bg.querySelector('#fpEditFee').value);
      if (!(fee >= 0 && fee <= 100)) { toast(w, 'Taxa inválida'); return; }
      state.park.name = bg.querySelector('#fpEditName').value.trim() || state.park.name;
      state.park.city = bg.querySelector('#fpEditCity').value.trim();
      state.park.cnpj = bg.querySelector('#fpEditCnpj').value.trim();
      state.park.adminFeePercent = fee;
      state.park.fees.debito = Number(bg.querySelector('#fpEditDebit').value) || 0;
      state.park.fees.credito = Number(bg.querySelector('#fpEditCredit').value) || 0;
      save(); bg.remove(); render(d, w); toast(w, 'Dados do food park atualizados');
    };
  }

  function bind(d, w) {
    if (d.documentElement.dataset.foodparkBound === '1') return;
    d.documentElement.dataset.foodparkBound = '1';
    d.addEventListener('click', event => onClick(d, w, event));
    d.addEventListener('change', event => {
      const id = event.target && event.target.dataset && event.target.dataset.module;
      if (!id) return;
      modules[id] = !!event.target.checked;
      saveModules();
      ensureNav(d, w);
      exposeToTopbar(d, w);
      toast(w, event.target.checked ? 'Módulo ligado no menu' : 'Módulo desligado do menu');
    });
    d.addEventListener('input', event => {
      if (event.target && (event.target.id === 'fpDiscount')) renderCart(d);
      if (event.target && event.target.id === 'fpMonth') {
        month = event.target.value || monthNow();
        const sec = d.getElementById('contabilidade');
        if (sec) sec.dataset.tab = sec.dataset.tab || 'dre';
        renderAccounting(d);
      }
    });
    const prev = w.entrar;
    w.entrar = function () {
      if (typeof prev === 'function') prev();
      render(d, w);
      if (state.onboarded) activate(d, w, 'dashboard');
    };
    const nav = d.querySelector('.nav');
    if (nav) nav.addEventListener('click', () => setTimeout(() => {
      const active = d.querySelector('.nav button.active');
      if (active && titles()[active.dataset.view]) activate(d, w, active.dataset.view);
    }, 40));
  }

  function boot(attempt) {
    const d = frame.contentDocument;
    const w = frame.contentWindow;
    if (!d || !w || !d.getElementById('dashboard') || !d.querySelector('.nav')) {
      if (attempt < 25) setTimeout(() => boot(attempt + 1), 200);
      return;
    }
    const commercialReady = d.getElementById('dashboard').dataset.commercial === '1' || attempt > 12;
    if (!commercialReady) { setTimeout(() => boot(attempt + 1), 200); return; }
    try {
      addStyle(d);
      ensureNav(d, w);
      ensureViews(d);
      bind(d, w);
      brand(d);
      exposeToTopbar(d, w);
      if (state.onboarded) render(d, w);
      d.documentElement.dataset.foodpark = '1';
      if (!d.documentElement.dataset.foodparkRefresh) {
        d.documentElement.dataset.foodparkRefresh = '1';
        [900, 1800].forEach(delay => setTimeout(() => {
          try {
            ensureNav(d, w);
            ensureViews(d);
            brand(d);
            if (state.onboarded && !d.getElementById('fpOnboarding')) render(d, w);
          } catch (err) { console.error('AYVO food park', err); }
        }, delay));
      }
    } catch (err) {
      console.error('AYVO food park', err);
    }
  }

  frame.addEventListener('load', () => boot(0));
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') boot(0);
})();

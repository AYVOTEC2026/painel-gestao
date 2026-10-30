(function(){
  const frame=document.getElementById('appFrame');
  if(!frame)return;

  const icon=(paths)=>`<span class="ico"><svg viewBox="0 0 24 24">${paths}</svg></span>`;
  const money=(n)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
  const safe=(v)=>String(v||'').replace(/[<>]/g,'').trim();

  function addStyle(d){
    if(d.getElementById('parkOpsStyle'))return;
    const st=d.createElement('style');st.id='parkOpsStyle';st.textContent=`
      :root{
        --blue:#a05433!important;--blue2:#8a4426!important;--blue-soft:#f7ece5!important;--blue-line:#e8cbbb!important;
        --bg:#f7f7f5!important;--panel:#ffffff!important;--panel2:#fffaf5!important;--dark:#22201e!important;--dark2:#302b27!important;
        --amber:#8a4426!important;--amber-soft:#f7ece5!important;
      }
      .login{background:radial-gradient(1000px circle at 15% 10%,rgba(160,84,51,.22),transparent 55%),linear-gradient(135deg,#211f1c,#302a25 58%,#201e1b)!important}
      .login-copy .ey,.topbar .ey{color:#a05433!important}.field input:focus,.field select:focus,.field textarea:focus{border-color:#c9937a!important;box-shadow:0 0 0 3px rgba(160,84,51,.12)!important}
      .nav button.active{background:linear-gradient(90deg,rgba(160,84,51,.32),rgba(160,84,51,.06))!important;box-shadow:inset 3px 0 0 #a05433!important}
      .btn.primary{background:linear-gradient(145deg,#c27454,#8a4426)!important;box-shadow:0 8px 18px rgba(160,84,51,.22)!important}
      .btn.soft{background:#f7ece5!important;border-color:#e8cbbb!important;color:#8a4426!important}.info{background:#f7ece5!important;color:#8a4426!important}
      .round{background:#f7ece5!important;color:#8a4426!important}.bar i,.bc i{background:linear-gradient(90deg,#c27454,#a05433)!important}.slot{background:#f7ece5!important;border-color:#e8cbbb!important}
      .park-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:20px;border-radius:16px;background:linear-gradient(120deg,#f7ece5,#fff 65%);border:1px solid #e8cbbb;margin-bottom:13px;box-shadow:var(--shadow)}
      .park-hero h2{font-size:20px;margin:0 0 6px}.park-hero p{margin:0;color:var(--muted);font-size:11px;line-height:1.55;max-width:720px}.park-hero .rule{background:#a05433;color:#fff;border-radius:12px;padding:13px 16px;font-weight:850;font-size:12px;text-align:center;min-width:180px;box-shadow:0 9px 22px rgba(160,84,51,.22)}.park-hero .rule small{display:block;font-size:9px;opacity:.85;margin-top:4px;font-weight:650}
      .ops-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:#f7ece5;border:1px solid #e8cbbb;color:#8a4426;font-size:9px;font-weight:800}
      .pos-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:13px}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.product{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.product b{font-size:11px}.product small{display:block;color:var(--muted);font-size:9px;margin:5px 0 9px}.product strong{font-size:12px;color:#8a4426}.cart-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:10px}.cart-total{display:flex;justify-content:space-between;font-size:13px;font-weight:850;padding:13px 0}.kpi-orange strong{color:#8a4426}.container-occupancy{grid-template-columns:repeat(3,1fr)!important}.container-occupancy .unit{min-height:118px}.container-occupancy .unit .contract{margin-top:8px;font-size:8.8px;color:var(--muted)}
      @media(max-width:900px){.park-hero{align-items:flex-start;flex-direction:column}.park-hero .rule{width:100%}.pos-grid{grid-template-columns:1fr}.product-grid{grid-template-columns:1fr 1fr}.container-occupancy{grid-template-columns:1fr 1fr!important}}
      @media(max-width:560px){.product-grid,.container-occupancy{grid-template-columns:1fr!important}}
    `;d.head.appendChild(st);
  }

  function navButton(d){
    const nav=d.querySelector('.nav');if(!nav||nav.querySelector('[data-view="bilheteria"]'))return;
    const btn=d.createElement('button');btn.dataset.view='bilheteria';
    btn.innerHTML=`${icon('<path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/>')}<span>Loja & Bilheteria</span>`;
    const ref=nav.querySelector('[data-view="parque"]'); if(ref&&ref.nextSibling)nav.insertBefore(btn,ref.nextSibling);else nav.appendChild(btn);
    btn.addEventListener('click',()=>{
      d.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
      d.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const v=d.getElementById('bilheteria');if(v)v.classList.add('active');
      const t=d.getElementById('pageTitle'),s=d.getElementById('pageSub');if(t)t.textContent='Loja & Bilheteria';if(s)s.textContent='Pulseiras, day use, brinquedos, caixa e histórico de compras em um único ponto de atendimento.';
      d.defaultView.scrollTo({top:0,behavior:'smooth'});
    });
  }

  function buildBilheteria(d,w){
    if(d.getElementById('bilheteria'))return;
    const main=d.querySelector('main');const fin=d.getElementById('financeiro');if(!main||!fin)return;
    const sec=d.createElement('section');sec.className='view';sec.id='bilheteria';sec.innerHTML=`
      <div class="park-hero"><div><span class="ops-chip">Operação central do parque</span><h2 style="margin-top:9px">Bilheteria, loja e pulseiras</h2><p>O mesmo atendimento vende o acesso ao parque, day use e produtos da loja. Cada venda fica ligada ao responsável, à criança e ao CRM para histórico, campanhas e recorrência.</p></div><div class="rule">PAGUE 1H • USE 2H<small>Benefício aplicado automaticamente na pulseira</small></div></div>
      <div class="grid cols4"><div class="card stat kpi-orange"><small>Pulseiras ativas</small><strong id="opsWrist">34</strong><em>acesso em andamento</em></div><div class="card stat"><small>Day use hoje</small><strong id="opsDay">12</strong><em>clientes liberados</em></div><div class="card stat"><small>Vendas da loja</small><strong>R$ 1.840</strong><em>hoje</em></div><div class="card stat"><small>Ticket médio</small><strong>R$ 68,40</strong><em>bilheteria + loja</em></div></div>
      <div class="pos-grid" style="margin-top:13px"><div class="card"><div class="head"><h2>Venda rápida</h2><span>PDV do contêiner</span></div><div class="product-grid">
        <div class="product"><b>Pulseira Parque</b><small>1h paga + 1h bônus</small><strong>R$ 35,00</strong><button class="btn soft full" data-add="35|Pulseira Parque" style="margin-top:9px">Adicionar</button></div>
        <div class="product"><b>Day Use</b><small>Acesso diário conforme regra operacional</small><strong>R$ 75,00</strong><button class="btn soft full" data-add="75|Day Use" style="margin-top:9px">Adicionar</button></div>
        <div class="product"><b>Brinquedo</b><small>Item demonstrativo da loja</small><strong>R$ 39,90</strong><button class="btn soft full" data-add="39.9|Brinquedo" style="margin-top:9px">Adicionar</button></div>
        <div class="product"><b>Meia antiderrapante</b><small>Acessório para uso no parque</small><strong>R$ 18,00</strong><button class="btn soft full" data-add="18|Meia antiderrapante" style="margin-top:9px">Adicionar</button></div>
        <div class="product"><b>Combo diversão</b><small>Pulseira + item da loja</small><strong>R$ 64,90</strong><button class="btn soft full" data-add="64.9|Combo diversão" style="margin-top:9px">Adicionar</button></div>
        <div class="product"><b>Crédito adicional</b><small>Serviço extra / ajuste de caixa</small><strong>R$ 20,00</strong><button class="btn soft full" data-add="20|Crédito adicional" style="margin-top:9px">Adicionar</button></div>
      </div></div><div class="card"><div class="head"><h2>Venda atual</h2><button class="btn" id="clearCart">Limpar</button></div><div class="field"><label>Responsável</label><input id="saleResponsible" placeholder="Nome do responsável"></div><div class="field"><label>Criança / cliente</label><input id="saleClient" placeholder="Nome"></div><div id="cartItems"><div class="note">Nenhum item adicionado.</div></div><div class="cart-total"><span>Total</span><span id="cartTotal">R$ 0,00</span></div><div class="field"><label>Pagamento</label><select id="salePay"><option>Pix</option><option>Cartão</option><option>Dinheiro</option></select></div><button class="btn primary full" id="finishSale">Finalizar venda e vincular ao CRM</button></div></div>
      <div class="grid cols2" style="margin-top:13px"><div class="card"><div class="head"><h2>Controle de pulseiras</h2><button class="btn primary" id="newWrist">Nova pulseira</button></div><div class="table-wrap"><table><thead><tr><th>Criança</th><th>Responsável</th><th>Entrada</th><th>Validade</th><th>Tipo</th><th>Status</th></tr></thead><tbody id="wristTable"><tr><td>Helena Souza</td><td>Marina Souza</td><td>14:20</td><td>16:20</td><td>1h + 1h bônus</td><td><span class="status ok">Ativa</span></td></tr><tr><td>Lucas Lima</td><td>Paulo Lima</td><td>13:40</td><td>Dia inteiro</td><td>Day Use</td><td><span class="status info">Day use</span></td></tr></tbody></table></div></div><div class="card"><div class="head"><h2>Visão comercial</h2><span>CRM integrado</span></div><div class="metric"><span>Comprou pulseira + loja</span><b>18 clientes</b></div><div class="metric"><span>Usou parque + quadra</span><b>11 clientes</b></div><div class="metric"><span>Potenciais festas</span><b>9 famílias</b></div><div class="metric"><span>Clientes recorrentes</span><b>42%</b></div><div class="note" style="margin-top:12px">Toda compra alimenta o CRM com preferências, frequência, aniversário, serviços utilizados e ticket médio, permitindo campanhas segmentadas pelo WhatsApp.</div></div></div>`;
    main.insertBefore(sec,fin);

    let cart=[];
    const render=()=>{const box=d.getElementById('cartItems'),total=cart.reduce((a,b)=>a+b.value,0);box.innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-line"><span>${safe(x.name)}</span><span>${money(x.value)} <button class="btn" data-rm="${i}" style="padding:3px 6px;margin-left:4px">×</button></span></div>`).join(''):'<div class="note">Nenhum item adicionado.</div>';d.getElementById('cartTotal').textContent=money(total);box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.rm),1);render()});};
    sec.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const [v,n]=b.dataset.add.split('|');cart.push({value:Number(v),name:n});render()});
    d.getElementById('clearCart').onclick=()=>{cart=[];render()};
    d.getElementById('finishSale').onclick=()=>{if(!cart.length){w.toast('Adicione pelo menos um item à venda');return}const total=cart.reduce((a,b)=>a+b.value,0),client=safe(d.getElementById('saleClient').value)||'Cliente balcão';w.toast(`Venda de ${money(total)} concluída • ${client} vinculado ao CRM`);cart=[];render();d.getElementById('saleClient').value='';d.getElementById('saleResponsible').value=''};
    d.getElementById('newWrist').onclick=()=>openWristModal(d,w);
  }

  function openWristModal(d,w){
    let bg=d.getElementById('opsWristModal');if(bg)bg.remove();bg=d.createElement('div');bg.className='modal-bg show';bg.id='opsWristModal';bg.innerHTML=`<div class="modal"><div class="modal-top"><h3>Nova pulseira / Day Use</h3><button class="close" data-close>×</button></div><div class="form-grid"><div class="field"><label>Criança / cliente</label><input data-v="client"></div><div class="field"><label>Responsável</label><input data-v="resp"></div><div class="field"><label>Tipo</label><select data-v="type"><option>Parque • 1h paga + 1h bônus</option><option>Day Use</option></select></div><div class="field"><label>Pagamento</label><select><option>Pix</option><option>Cartão</option><option>Dinheiro</option></select></div><div class="field full"><label>Observações</label><textarea placeholder="Alergias, restrições, retirada autorizada..."></textarea></div></div><div class="actions-row"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="opsSaveWrist">Liberar pulseira</button></div></div>`;d.body.appendChild(bg);const close=()=>bg.remove();bg.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);d.getElementById('opsSaveWrist').onclick=()=>{const c=safe(bg.querySelector('[data-v="client"]').value)||'Novo cliente',r=safe(bg.querySelector('[data-v="resp"]').value)||'Responsável',t=bg.querySelector('[data-v="type"]').value;const now=new Date(),start=now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),end=t.startsWith('Day')?'Dia inteiro':new Date(now.getTime()+120*60000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});const tr=d.createElement('tr');tr.innerHTML=`<td>${c}</td><td>${r}</td><td>${start}</td><td>${end}</td><td>${t.startsWith('Day')?'Day Use':'1h + 1h bônus'}</td><td><span class="status ${t.startsWith('Day')?'info':'ok'}">${t.startsWith('Day')?'Day use':'Ativa'}</span></td>`;d.getElementById('wristTable').prepend(tr);if(t.startsWith('Day'))d.getElementById('opsDay').textContent=Number(d.getElementById('opsDay').textContent)+1;else d.getElementById('opsWrist').textContent=Number(d.getElementById('opsWrist').textContent)+1;close();w.toast('Pulseira liberada e cliente registrado no CRM')};
  }

  function rebuildRentals(d){
    const sec=d.getElementById('locacoes');if(!sec)return;
    const map=sec.querySelector('.map');if(map){map.classList.add('container-occupancy');map.innerHTML=[
      ['01','Hamburgueria Central','R$ 4.200 • Em dia','ok'],['02','Pizza do Point','R$ 4.000 • Em dia','ok'],['03','Doces & Cia','R$ 3.800 • Em dia','ok'],['04','Operação comercial','R$ 3.900 • Em dia','ok'],['05','Loja parceira','R$ 3.700 • Em dia','ok'],['06','Cafeteria','R$ 4.100 • Em dia','ok'],['07','Disponível','Pronto para locação','free'],['08','Operação comercial','R$ 3.900 • Vencido','late'],['09','Disponível','Pronto para locação','free']
    ].map(x=>`<div class="unit ${x[3]==='free'?'free':x[3]==='late'?'late':''}"><div class="dot"></div><span class="n">Contêiner ${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small><div class="contract">Contrato, vencimento, reajuste e cobranças integrados ao financeiro.</div></div>`).join('')}
    const firstStat=sec.querySelector('.stat strong');if(firstStat)firstStat.textContent='9';
    const notes=[...sec.querySelectorAll('.note')];notes.forEach(n=>{if(/12|contêiner|container/i.test(n.textContent))n.textContent='Gestão dos 9 contêineres comerciais com contrato, mensalidade, vencimento, reajuste, caução, status financeiro e histórico do locatário.'});
  }

  function upgradePark(d,w){
    const sec=d.getElementById('parque');if(!sec)return;
    if(!sec.querySelector('.park-hero')){const hero=d.createElement('div');hero.className='park-hero';hero.innerHTML='<div><span class="ops-chip">Regra operacional</span><h2 style="margin-top:9px">Controle do parque por pulseira</h2><p>O tempo é controlado pelo sistema desde a liberação da pulseira. Na modalidade padrão, o cliente paga 1 hora e recebe automaticamente mais 1 hora de bônus, totalizando 2 horas de uso.</p></div><div class="rule">1H PAGA + 1H BÔNUS<small>2 horas liberadas no sistema</small></div>';sec.prepend(hero)}
    const modal=d.getElementById('checkinModal');if(modal){const plan=modal.querySelector('#kidPlan');if(plan)plan.innerHTML='<option>1 hora paga + 1 hora bônus • R$ 35</option><option>Day Use • R$ 75</option>';const save=[...modal.querySelectorAll('button')].find(b=>/Confirmar check-in/i.test(b.textContent));if(save)save.textContent='Liberar pulseira';}
    const oldAdd=w.addKid;if(typeof oldAdd==='function'&&!w.__opsKidOverride){w.__opsKidOverride=true;w.addKid=function(){const plan=d.getElementById('kidPlan')?.value||'';oldAdd();const row=d.querySelector('#kidsTable tr');if(row&&plan.includes('1 hora')){if(row.cells[3])row.cells[3].textContent='2 horas (1h + 1h bônus)';w.toast('Pulseira liberada por 2 horas • promoção aplicada automaticamente')}else if(plan.includes('Day Use')){if(row&&row.cells[3])row.cells[3].textContent='Day Use';w.toast('Day Use liberado e registrado no CRM')}}}
  }

  function upgradeCourts(d){
    const modal=d.getElementById('courtModal');if(!modal)return;const duration=[...modal.querySelectorAll('.field')].find(f=>/Duração/i.test(f.textContent))?.querySelector('select');if(duration)duration.innerHTML='<option>1 hora</option><option>2 horas</option><option>3 horas</option>';
    const sec=d.getElementById('quadras');if(sec&&!sec.querySelector('[data-court-note]')){const n=d.createElement('div');n.dataset.courtNote='1';n.className='note';n.style.marginBottom='13px';n.innerHTML='<b style="color:var(--ink)">Reservas centralizadas:</b> disponibilidade, sinal/pagamento, confirmação por WhatsApp, recorrência e histórico do cliente ficam vinculados ao CRM.';sec.prepend(n)}
  }

  function upgradeParties(d){
    const sec=d.getElementById('festas');if(!sec||sec.querySelector('[data-party-space]'))return;const c=d.createElement('div');c.dataset.partySpace='1';c.className='card';c.style.marginBottom='13px';c.innerHTML='<div class="head"><h2>Locação de espaço para festas e eventos</h2><span>Agenda + proposta + contrato</span></div><div class="grid cols4"><div class="stat"><small>Espaços disponíveis</small><strong>3</strong><em>configuráveis</em></div><div class="stat"><small>Eventos no mês</small><strong>8</strong><em>confirmados</em></div><div class="stat"><small>Propostas abertas</small><strong>5</strong><em>CRM comercial</em></div><div class="stat"><small>Sinais recebidos</small><strong>R$ 7,4 mil</strong><em>financeiro integrado</em></div></div>';sec.prepend(c)
  }

  function upgradeCRM(d){
    const sec=d.getElementById('crm');if(!sec||sec.querySelector('[data-ops-crm]'))return;const n=d.createElement('div');n.dataset.opsCrm='1';n.className='note';n.style.marginBottom='13px';n.innerHTML='<b style="color:var(--ink)">CRM 360° do parque:</b> clientes de pulseira, day use, loja, quadras, festas e locações ficam em uma base única. O histórico permite campanhas por frequência, aniversário, ticket, serviço utilizado e última visita.';sec.prepend(n)
  }

  function boot(){
    const d=frame.contentDocument,w=frame.contentWindow;if(!d||!w)return;
    try{addStyle(d);navButton(d);buildBilheteria(d,w);rebuildRentals(d);upgradePark(d,w);upgradeCourts(d);upgradeParties(d);upgradeCRM(d);const badge=d.getElementById('ayvoDemoBadge');if(badge){badge.style.background='#a05433';badge.style.borderColor='#c27454'}}catch(e){console.error('AYVO park operations',e)}
  }
  frame.addEventListener('load',()=>setTimeout(boot,220));
  if(frame.contentDocument?.readyState==='complete')setTimeout(boot,220);
})();
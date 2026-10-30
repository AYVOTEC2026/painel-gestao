import { api } from './api.js';
import { esc, icone, marcaSvg, iniciais, campo, avisar } from './ui.js';

/* Ilustração da praça: contêineres com toldo e varal de luzes. */
const CENA = `
<svg class="entrada-cena" viewBox="0 0 720 230" role="img" aria-label="Fileira de contêineres de comida com toldos listrados e varal de luzes">
  <defs>
    <pattern id="toldo" width="24" height="16" patternUnits="userSpaceOnUse"><rect width="12" height="16" fill="#f28c18"/><rect x="12" width="12" height="16" fill="#fff3e2"/></pattern>
  </defs>
  ${(() => {
    // Varal preso a cada 180px, com a curva do fio caindo entre os postes; as lâmpadas pendem do fio.
    const fio = x => 50 + 26 * Math.sin(Math.PI * ((x % 180) / 180));
    const pontos = [];
    for (let x = 0; x <= 720; x += 10) pontos.push(`${x},${fio(x).toFixed(1)}`);
    const lampadas = [];
    for (let x = 22; x < 720; x += 31) {
      const y = fio(x);
      lampadas.push(`<line x1="${x}" y1="${y.toFixed(1)}" x2="${x}" y2="${(y + 7).toFixed(1)}" stroke="#3d6b64" stroke-width="1.2"/><circle cx="${x}" cy="${(y + 11).toFixed(1)}" r="4.5" fill="${x % 3 ? '#f6b25e' : '#ffd9a8'}"/>`);
    }
    return `<polyline points="${pontos.join(' ')}" fill="none" stroke="#3d6b64" stroke-width="1.5"/>${lampadas.join('')}`;
  })()}
  <g>
    <rect x="18" y="118" width="150" height="92" fill="#1f4c46"/><rect x="10" y="104" width="166" height="18" fill="url(#toldo)"/>
    <rect x="34" y="136" width="70" height="38" rx="3" fill="#f6b25e" opacity=".9"/><rect x="116" y="140" width="36" height="70" fill="#163c37"/>
    <rect x="190" y="98" width="128" height="112" fill="#2a5c55"/><rect x="182" y="84" width="144" height="18" fill="url(#toldo)"/>
    <rect x="204" y="116" width="100" height="44" rx="3" fill="#ffd9a8" opacity=".9"/><rect x="230" y="172" width="48" height="38" fill="#1f4c46"/>
    <rect x="340" y="126" width="168" height="84" fill="#1f4c46"/><rect x="332" y="112" width="184" height="18" fill="url(#toldo)"/>
    <rect x="356" y="144" width="88" height="34" rx="3" fill="#f6b25e" opacity=".9"/><rect x="456" y="148" width="36" height="62" fill="#163c37"/>
    <rect x="530" y="106" width="132" height="104" fill="#2a5c55"/><rect x="522" y="92" width="148" height="18" fill="url(#toldo)"/>
    <rect x="546" y="124" width="100" height="40" rx="3" fill="#ffd9a8" opacity=".9"/><rect x="574" y="176" width="44" height="34" fill="#1f4c46"/>
    <rect x="684" y="132" width="60" height="78" fill="#1f4c46"/><rect x="676" y="118" width="70" height="18" fill="url(#toldo)"/>
  </g>
  <rect x="0" y="210" width="720" height="20" fill="#0d2724"/>
</svg>`;

function arte(titulo, texto) {
  return `
    <section class="entrada-arte">
      <div class="marca"><div class="marca-selo">${marcaSvg}</div><div><b>AYVO Gestão</b><small>Food park e lazer</small></div></div>
      <div class="entrada-texto">
        <h1>${esc(titulo)}</h1>
        <p>${esc(texto)}</p>
        <ul class="entrada-lista">
          <li>${icone('boxes')}<span><b>Boxes alugados.</b> Contratos anexados, aluguel de cada mês e quem está em atraso.</span></li>
          <li>${icone('pulseira')}<span><b>Parque por pulseira.</b> A criança é cadastrada e o tempo conta desde a entrega.</span></li>
          <li>${icone('quadra')}<span><b>Quadras, loja e festas.</b> Agenda, PDV e eventos no mesmo caixa e no mesmo financeiro.</span></li>
        </ul>
      </div>
      ${CENA}
    </section>`;
}

export async function telaDeEntrada(raiz, aoEntrar) {
  let pub;
  try {
    pub = await api.publico();
  } catch (err) {
    raiz.innerHTML = `<div class="carregando-tela">${esc(err.message)}</div>`;
    return;
  }
  if (!pub.instalado) return instalacao(raiz, pub, aoEntrar);
  return login(raiz, pub, aoEntrar);
}

function login(raiz, pub, aoEntrar) {
  const demo = pub.demo;
  raiz.innerHTML = `
    <div class="entrada">
      ${arte('O complexo inteiro num lugar só.', 'Aluguel dos boxes, pulseiras do parque, loja e day use, quadras e festas: cada área com a sua tela e um financeiro que junta tudo.')}
      <section class="entrada-painel">
        <div class="entrada-caixa">
          <h2>Entrar</h2>
          <p>${esc(pub.nomeParque || 'Complexo')}</p>
          <div class="erro-form oculto" id="erroEntrada" role="alert"></div>
          <form id="formEntrada" novalidate>
            ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, extra: 'autocomplete="username" autocapitalize="off"' })}
            ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, extra: 'autocomplete="current-password"' })}
            <button class="botao primario grande largo" type="submit">Entrar</button>
          </form>
          ${demo ? `
            <div class="entrada-demo">
              <h3>Conhecer pela demonstração</h3>
              <p>Escolha um perfil para entrar direto. Os dados são fictícios.</p>
              ${demo.perfis.map(p => `
                <button type="button" class="perfil-demo" data-email="${esc(p.email)}">
                  <span class="avatar">${esc(iniciais(p.nome))}</span>
                  <span><b>${esc({ dono: 'Proprietária', recepcao: 'Recepção', monitor: 'Monitor do parque' }[p.papel] || p.papelNome)}</b><small>${esc(p.descricao)}</small></span>
                  ${icone('seta')}
                </button>`).join('')}
            </div>` : ''}
          <p class="entrada-rodape">Esqueceu a senha? Peça para a gestão definir uma nova em Administração, aba Equipe.</p>
        </div>
      </section>
    </div>`;

  const erro = raiz.querySelector('#erroEntrada');
  const form = raiz.querySelector('#formEntrada');
  const botao = form.querySelector('button[type=submit]');

  async function tentar(email, senha) {
    erro.classList.add('oculto');
    botao.classList.add('carregando');
    try {
      const r = await api.entrar(email, senha);
      history.replaceState(null, '', '#/' + r.usuario.inicio);
      await aoEntrar();
    } catch (err) {
      erro.innerHTML = `${icone('alerta')}<span>${esc(err.message)}</span>`;
      erro.classList.remove('oculto');
    } finally {
      botao.classList.remove('carregando');
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    if (!d.email || !d.senha) {
      erro.innerHTML = `${icone('alerta')}<span>Preencha e-mail e senha.</span>`;
      erro.classList.remove('oculto');
      return;
    }
    tentar(d.email, d.senha);
  });
  raiz.querySelectorAll('.perfil-demo').forEach(b => b.addEventListener('click', () => tentar(b.dataset.email, demo.senha)));
  setTimeout(() => form.querySelector('input').focus(), 30);
}

function instalacao(raiz, pub, aoEntrar) {
  raiz.innerHTML = `
    <div class="entrada">
      ${arte('Vamos preparar o seu complexo.', 'Leva um minuto: o nome do complexo e o seu acesso de gestão. Boxes, quadras, produtos e o parque você cadastra depois, com calma.')}
      <section class="entrada-painel">
        <div class="entrada-caixa">
          <h2>Primeiro acesso</h2>
          <p>Estes dados podem ser alterados depois em Configurações.</p>
          <div class="erro-form oculto" id="erroInstalar" role="alert"></div>
          <form id="formInstalar" novalidate>
            <div class="form-secao">
              <h3>O complexo</h3>
              <div class="grade-form">
                ${campo({ nome: 'parqueNome', rotulo: 'Nome do complexo', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Pepama Food Park' })}
                ${campo({ nome: 'cidade', rotulo: 'Cidade', classe: 'inteira', placeholder: 'Ex.: Fortaleza, CE' })}
              </div>
            </div>
            <div class="form-secao">
              <h3>Seu acesso de gestão</h3>
              <div class="grade-form">
                ${campo({ nome: 'nome', rotulo: 'Seu nome', obrigatorio: true, classe: 'inteira' })}
                ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, classe: 'inteira', extra: 'autocomplete="username"' })}
                ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, classe: 'inteira', ajuda: 'Pelo menos 6 caracteres.', extra: 'autocomplete="new-password" minlength="6"' })}
                ${pub.exigeCodigo ? campo({ nome: 'codigo', rotulo: 'Código de instalação', obrigatorio: true, classe: 'inteira', ajuda: 'Fornecido pela AYVO junto com o endereço do sistema.' }) : ''}
              </div>
            </div>
            <button class="botao primario grande largo" type="submit" style="margin-top:8px">Criar food park</button>
          </form>
        </div>
      </section>
    </div>`;
  const form = raiz.querySelector('#formInstalar');
  const erro = raiz.querySelector('#erroInstalar');
  const botao = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    erro.classList.add('oculto');
    const d = Object.fromEntries(new FormData(form).entries());
    botao.classList.add('carregando');
    try {
      const r = await api.instalar({
        codigo: d.codigo,
        parque: { nome: d.parqueNome, cidade: d.cidade },
        dono: { nome: d.nome, email: d.email, senha: d.senha }
      });
      history.replaceState(null, '', '#/' + r.usuario.inicio);
      await aoEntrar();
      avisar('Complexo criado. Comece pela Administração: quadras, parque e equipe.');
    } catch (err) {
      erro.innerHTML = `${icone('alerta')}<span>${esc(err.message)}</span>`;
      erro.classList.remove('oculto');
      erro.scrollIntoView({ block: 'nearest' });
    } finally {
      botao.classList.remove('carregando');
    }
  });
}

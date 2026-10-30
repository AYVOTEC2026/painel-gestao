import { api } from './api.js';
import { esc, icone, iniciais, campo, avisar } from './ui.js';

/* Fim de tarde no Pepama: sol em arco (o mesmo da logo), food park ao fundo e o parquinho na frente. */
const CENA = `
<svg class="entrada-cena" viewBox="0 0 900 560" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Parquinho ao pôr do sol, com escorregador, balanço, cama elástica, balões e pipa; ao fundo, os contêineres do food park e coqueiros">
  <defs>
    <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#33251f" stop-opacity="0"/>
      <stop offset=".55" stop-color="#7d4a30" stop-opacity=".55"/>
      <stop offset="1" stop-color="#e8964e" stop-opacity=".95"/>
    </linearGradient>
    <radialGradient id="sol" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#ffe0ad"/><stop offset="1" stop-color="#f2a23a"/></radialGradient>
    <pattern id="toldo" width="20" height="12" patternUnits="userSpaceOnUse"><rect width="10" height="12" fill="#a05433"/><rect x="10" width="10" height="12" fill="#f6e7d8"/></pattern>
  </defs>
  <rect width="900" height="390" fill="url(#ceu)"/>
  <g class="cena-sol">
    <circle cx="640" cy="380" r="200" fill="none" stroke="#f2a23a" stroke-width="3" opacity=".22"/>
    ${(() => {
      // Raios só na metade de cima, como no arco da logo.
      const raios = [];
      for (let g = 195; g <= 345; g += 15) {
        const r = g * Math.PI / 180;
        raios.push(`<line x1="${(640 + 138 * Math.cos(r)).toFixed(1)}" y1="${(380 + 138 * Math.sin(r)).toFixed(1)}" x2="${(640 + 178 * Math.cos(r)).toFixed(1)}" y2="${(380 + 178 * Math.sin(r)).toFixed(1)}" stroke="#f6b866" stroke-width="6" stroke-linecap="round" opacity=".6"/>`);
      }
      return raios.join('');
    })()}
    <circle cx="640" cy="380" r="118" fill="url(#sol)"/>
  </g>
  <g transform="translate(170 -40)">
  <g class="cena-pipa">
    <path d="M188 214c22 18 8 40 34 54s14 38 40 50" fill="none" stroke="#f6e7d8" stroke-width="2" opacity=".7"/>
    <path d="M206 240l14-8-2 15zM228 270l15-5-5 14z" fill="#f2a23a"/>
    <polygon points="188,112 222,152 188,212 154,152" fill="#f2a23a"/>
    <polygon points="188,112 222,152 188,152" fill="#ffd39a"/>
    <path d="M188 112v100M154 152h68" stroke="#a05433" stroke-width="2"/>
  </g>
  </g>
  <path d="M0 384h900v40H0z" fill="#5e463a"/>
  <g class="cena-foodpark">
    ${(() => {
      // Contêineres do food park sobre a linha do horizonte, com janela acesa e toldo listrado.
      const caixas = [[300, 84, 50], [392, 96, 60], [496, 80, 46], [584, 100, 58], [692, 88, 52], [788, 104, 62]];
      return caixas.map(([x, w, h], i) => `<rect x="${x}" y="${384 - h}" width="${w}" height="${h}" fill="${i % 2 ? '#4a372d' : '#3a2a22'}"/>
        <rect x="${x - 5}" y="${384 - h - 10}" width="${w + 10}" height="12" fill="url(#toldo)"/>
        <rect x="${x + 12}" y="${384 - h + 12}" width="${w - 24}" height="${Math.round(h / 2.6)}" rx="2" fill="#ffd9a8" opacity=".92"/>`).join('');
    })()}
    ${(() => {
      // Varal de luzes entre os coqueiros, caindo em curva entre os pontos de apoio.
      const fio = x => 262 + 22 * Math.sin(Math.PI * (((x - 250) % 200) / 200));
      const pts = [];
      for (let x = 250; x <= 860; x += 10) pts.push(`${x},${fio(x).toFixed(1)}`);
      const lampadas = [];
      for (let x = 262; x < 860; x += 26) lampadas.push(`<circle cx="${x}" cy="${(fio(x) + 7).toFixed(1)}" r="3.6" fill="${x % 3 ? '#ffd39a' : '#f6b866'}"/>`);
      return `<polyline points="${pts.join(' ')}" fill="none" stroke="#2a1f1a" stroke-width="1.5" opacity=".8"/>${lampadas.join('')}`;
    })()}
  </g>
  <g class="cena-coqueiros" fill="#4d5f3e">
    <path d="M150 470c-14-70-10-150 22-220" fill="none" stroke="#3a2a22" stroke-width="13" stroke-linecap="round"/>
    <path d="M172 250c-40-26-86-22-116 6 40-6 78 0 116-6zM172 250c-18-40-58-62-98-56 36 14 70 30 98 56zM172 250c22-38 64-52 104-40-38 6-72 20-104 40zM172 250c40-12 86 2 110 34-36-18-74-26-110-34zM172 250c-30 16-50 48-52 86 18-36 34-60 52-86z"/>
    <path d="M846 470c12-66 8-140-20-206" fill="none" stroke="#3a2a22" stroke-width="12" stroke-linecap="round"/>
    <path d="M826 264c38-26 82-24 110 2-38-4-74 2-110-2zM826 264c16-38 54-58 92-52-34 12-66 28-92 52zM826 264c-22-36-62-50-100-38 36 6 68 18 100 38zM826 264c-38-10-80 4-102 34 34-18 70-26 102-34z"/>
  </g>
  <path d="M0 424c120-16 260-20 420-10s300 14 480-8v154H0z" fill="#6b4c3e"/>
  <path d="M90 560c30-60 130-96 290-100s300 30 420 100z" fill="#8f5f43" opacity=".55"/>
  <g class="cena-balanco" stroke="#f6e7d8" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M120 540l42-136 42 136M290 540l42-136 42 136M162 404h170"/>
    <g stroke-width="2.5"><path d="M205 404v86M237 404v86"/><path d="M272 404l20 80M300 404l22 76"/></g>
    <rect x="198" y="488" width="46" height="8" rx="3" fill="#a05433" stroke="none"/>
    <rect x="286" y="478" width="44" height="8" rx="3" fill="#f2a23a" stroke="none" transform="rotate(-12 308 482)"/>
  </g>
  <g class="cena-escorregador">
    <path d="M436 270c-6 40 4 70 18 100M470 258c4 40 0 74-10 110M500 268c10 36 6 70-38 102" fill="none" stroke="#f6e7d8" stroke-width="1.5" opacity=".8"/>
    <ellipse cx="436" cy="250" rx="20" ry="25" fill="#a05433"/><ellipse cx="470" cy="236" rx="20" ry="25" fill="#f2a23a"/><ellipse cx="502" cy="250" rx="20" ry="25" fill="#f6e7d8"/>
    <path d="M430 418l38-48 38 48z" fill="#f2a23a"/>
    <path d="M438 538l8-120M478 538l8-120M498 418v120" stroke="#f6e7d8" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M441 510h41M443 486h41M445 462h41M447 440h41" stroke="#f6e7d8" stroke-width="4" stroke-linecap="round"/>
    <rect x="432" y="414" width="76" height="10" rx="3" fill="#f6e7d8"/>
    <path d="M504 424c40 10 50 60 74 92 10 14 24 20 44 22" fill="none" stroke="#f2a23a" stroke-width="18" stroke-linecap="round"/>
    <path d="M504 418c40 10 50 60 74 92 10 14 24 20 44 22" fill="none" stroke="#ffd39a" stroke-width="4" stroke-linecap="round" opacity=".8"/>
  </g>
  <g class="cena-cama-elastica">
    <path d="M664 504l-8 40M776 504l8 40M720 512v32" stroke="#f6e7d8" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="720" cy="500" rx="84" ry="19" fill="#241a15" stroke="#a05433" stroke-width="7"/>
    <circle cx="812" cy="526" r="17" fill="#f6e7d8"/>
    <path d="M812 509a17 17 0 0 1 0 34c-8-9-8-25 0-34z" fill="#a05433"/><path d="M795 526h34" stroke="#f2a23a" stroke-width="5"/>
  </g>
  <rect y="548" width="900" height="12" fill="#241a15"/>
</svg>`;

function arte(titulo, texto) {
  return `
    <section class="entrada-arte">
      <img class="entrada-logo" src="/marca/pepama-logo.png" alt="Pepama Food Park">
      <div class="entrada-texto">
        <h1>${esc(titulo)}</h1>
        <p>${esc(texto)}</p>
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
      ${arte('Tudo do Pepama num lugar só.', 'Food park, parque infantil, quadras e festas, com o caixa e as contas de cada área.')}
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

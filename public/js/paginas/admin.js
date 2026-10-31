import { esc, icone, dinheiro, iniciais, selo, avisar, abrirModal, confirmar, campo, campoDinheiro, validarEmPortugues } from '../ui.js';
import { api } from '../api.js';
import { preencher } from '../mensagens.js';
import { abas, abaAtual } from './comum.js';

const ABAS = ['complexo', 'equipe', 'parque', 'quadras', 'eventos', 'mensagens', 'historico', 'demonstracao'];
let equipe = null;
// Mensagem aberta no editor e textos ainda não salvos, que sobrevivem à troca de mensagem.
let mensagemAberta = null;
const rascunhos = {};

const senhaSugerida = () => {
  const l = 'abcdefghjkmnpqrstuvwxyz';
  const x = () => l[Math.floor(Math.random() * l.length)];
  const n = () => Math.floor(Math.random() * 10);
  return `${x()}${x()}${x()}${x()}${n()}${n()}${n()}${n()}`;
};
const quando = iso => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '');
const numeroBr = v => String(v).replace('.', ',');

/* ---------------------------------------------------------------- abas */

function complexo(d, ctx) {
  const c = d.config;
  return `<div class="duas-colunas" style="margin-top:0">
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Dados do complexo</h2><p>O nome aparece no menu e nos arquivos do contador.</p></div></div>
      <form id="formComplexo" class="grade-form">
        ${campo({ nome: 'nome', rotulo: 'Nome', valor: d.nome, obrigatorio: true, classe: 'inteira' })}
        ${campo({ nome: 'cidade', rotulo: 'Cidade', valor: c.cidade })}
        ${campo({ nome: 'cnpj', rotulo: 'CNPJ', valor: c.cnpj, placeholder: '00.000.000/0000-00' })}
        ${campo({ nome: 'telefone', rotulo: 'Telefone', valor: c.telefone, classe: 'inteira' })}
        ${campo({ nome: 'abre', rotulo: 'Abre às', tipo: 'time', valor: c.horario.abre, obrigatorio: true, ajuda: 'Define a agenda das quadras.' })}
        ${campo({ nome: 'fecha', rotulo: 'Fecha às', tipo: 'time', valor: c.horario.fecha, obrigatorio: true })}
        ${campo({ nome: 'taxaDebito', rotulo: 'Taxa da maquininha no débito', tipo: 'number', valor: c.taxas.debito, sufixo: '%', extra: 'min="0" max="20" step="0.01"' })}
        ${campo({ nome: 'taxaCredito', rotulo: 'Taxa da maquininha no crédito', tipo: 'number', valor: c.taxas.credito, sufixo: '%', extra: 'min="0" max="20" step="0.01"' })}
        <p class="nota inteira">A taxa da maquininha entra como despesa a cada venda no cartão.</p>
        <div class="inteira"><button type="submit" class="botao primario">Salvar alterações</button></div>
      </form>
    </section>
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Minha senha</h2><p>${esc(ctx.usuario.email)}</p></div></div>
      ${ctx.usuario.demo ? '<p class="nota">O acesso de demonstração usa a senha padrão e não pode ser alterado.</p>' : `
      <form id="formSenha" class="grade-form">
        ${campo({ nome: 'atual', rotulo: 'Senha atual', tipo: 'password', obrigatorio: true, classe: 'inteira', extra: 'autocomplete="current-password"' })}
        ${campo({ nome: 'nova', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, classe: 'inteira', ajuda: 'Pelo menos 6 caracteres. Os outros aparelhos conectados saem.', extra: 'minlength="6" autocomplete="new-password"' })}
        <div class="inteira"><button type="submit" class="botao">Trocar senha</button></div>
      </form>`}
    </section>
  </div>`;
}

function htmlEquipe() {
  if (!equipe) return '<p class="nota">Carregando equipe…</p>';
  return equipe.pessoas.map(p => `
    <div class="pessoa ${p.ativo ? '' : 'inativa'}">
      <div class="avatar">${esc(iniciais(p.nome))}</div>
      <div><b>${esc(p.nome)}${p.eu ? ' (você)' : ''}</b><small>${esc(p.email)}${p.ultimoAcesso ? `, último acesso ${esc(quando(p.ultimoAcesso))}` : ', ainda não entrou'}</small></div>
      ${p.ativo ? selo(p.papelNome, p.papel === 'dono' ? 'info' : '') : selo('Desativado', 'problema')}
      <div class="cabecalho-acoes">
        ${p.ativo && !p.eu ? `<button class="botao pequeno fantasma" data-e="perfil" data-id="${p.id}">Mudar perfil</button>` : ''}
        ${p.ativo && !p.demo ? `<button class="botao pequeno" data-e="senha" data-id="${p.id}">${icone('cadeado')}Nova senha</button>` : ''}
        ${p.eu ? '' : p.ativo ? `<button class="botao pequeno perigo" data-e="desativar" data-id="${p.id}">Desativar</button>` : `<button class="botao pequeno" data-e="reativar" data-id="${p.id}">Reativar</button>`}
      </div>
    </div>`).join('');
}

function equipeAba() {
  return `<div class="duas-colunas" style="margin-top:0">
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Pessoas com acesso</h2><p>Cada pessoa entra com o próprio e-mail. Assim o histórico mostra quem fez cada coisa.</p></div>
        <button type="button" class="botao primario" data-e="nova">${icone('mais')}Adicionar pessoa</button></div>
      <div id="listaEquipe">${htmlEquipe()}</div>
    </section>
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Perfis de acesso</h2></div></div>
      <dl class="glossario uma-coluna">
        <div><dt>Gestão</dt><dd>Vê e altera tudo: boxes, financeiro, contabilidade, relatórios, equipe e configurações.</dd></div>
        <div><dt>Recepção</dt><dd>Abre e fecha o caixa, vende na loja e na bilheteria, vende pulseiras e cuida das reservas de quadra. Não vê o financeiro.</dd></div>
        <div><dt>Monitor do parque</dt><dd>Registra a entrada e a saída das crianças e acompanha o tempo de cada uma.</dd></div>
      </dl>
    </section>
  </div>`;
}

function parqueAba(d) {
  const p = d.config.parque;
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Parque infantil</h2><p>Tempos de pulseira, preços e a regra do tempo excedente.</p></div></div>
    <form id="formParque">
      <h3 class="sub-titulo">Tempos de pulseira</h3>
      <div class="planos-editor" id="planos">${p.planos.map(linhaPlano).join('')}</div>
      <button type="button" class="botao pequeno" data-e="mais-plano">${icone('mais')}Adicionar tempo</button>
      <p class="nota">Deixe os minutos vazios para pulseira sem limite de tempo (dia livre).</p>
      <div class="separador"></div>
      <div class="grade-form">
        ${campo({ nome: 'capacidade', rotulo: 'Capacidade do parque', tipo: 'number', valor: p.capacidade, obrigatorio: true, extra: 'min="1"', ajuda: 'Acima disso, o sistema não vende pulseira.' })}
        ${campo({ nome: 'alerta', rotulo: 'Avisar quando faltar (min)', tipo: 'number', valor: p.alerta, obrigatorio: true, extra: 'min="0" max="60"', ajuda: 'O cartão da criança fica laranja.' })}
        ${campo({ nome: 'tolerancia', rotulo: 'Tolerância (min)', tipo: 'number', valor: p.tolerancia, obrigatorio: true, extra: 'min="0" max="60"', ajuda: 'Atraso que não é cobrado.' })}
        ${campo({ nome: 'bloco', rotulo: 'Cobrar a cada (min)', tipo: 'number', valor: p.bloco, obrigatorio: true, extra: 'min="5" max="60"' })}
        ${campoDinheiro({ nome: 'valorBloco', rotulo: 'Valor de cada bloco excedente', valor: p.valorBloco, obrigatorio: true, classe: 'inteira', ajuda: 'Ex.: R$ 5,00 a cada 15 minutos começados depois da tolerância.' })}
      </div>
      <button type="submit" class="botao primario" style="margin-top:16px">Salvar parque infantil</button>
    </form>
  </section>`;
}

function linhaPlano(p = {}) {
  return `<div class="plano-linha" data-id="${esc(p.id || '')}">
    <input name="nome" value="${esc(p.nome || '')}" placeholder="Nome, ex.: 1 hora" aria-label="Nome do tempo" required>
    <div class="campo-sufixo"><input name="minutos" type="number" min="5" max="720" value="${p.minutos == null ? '' : p.minutos}" placeholder="Livre" aria-label="Minutos"><span>min</span></div>
    <div class="campo-prefixo"><span>R$</span><input name="preco" type="number" min="0" step="0.01" value="${p.preco == null ? '' : p.preco}" aria-label="Preço" required></div>
    <button type="button" class="botao fantasma pequeno" data-e="tirar-plano" aria-label="Remover este tempo">${icone('lixeira')}</button>
  </div>`;
}

function quadrasAba(d) {
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Quadras</h2><p>O preço da hora calcula o valor de cada reserva (pode ser alterado na hora de reservar).</p></div>
      <button type="button" class="botao primario" data-e="nova-quadra">${icone('mais')}Nova quadra</button></div>
    ${d.quadras.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Quadra</th><th>Modalidade</th><th class="num">Preço da hora</th><th></th></tr></thead>
      <tbody>${d.quadras.map(q => `<tr class="${q.ativa ? '' : 'apagada'}"><td><b>${esc(q.nome)}</b>${q.ativa ? '' : '<small>Fora da agenda</small>'}</td><td>${esc(q.modalidade)}</td><td class="num">${esc(dinheiro(q.precoHora))}</td>
        <td class="acoes"><button type="button" class="botao pequeno fantasma" data-e="quadra" data-id="${q.id}">${icone('lapis')}Editar</button></td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="nota">Nenhuma quadra cadastrada.</p>'}
  </section>`;
}

function eventosAba(d) {
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Espaços para eventos</h2><p>Aparecem na escolha do espaço ao cadastrar um evento.</p></div></div>
    <form id="formEspacos">
      ${campo({ nome: 'espacos', rotulo: 'Um espaço por linha', tipo: 'textarea', valor: d.config.espacos.join('\n') })}
      <button type="submit" class="botao primario" style="margin-top:12px">Salvar espaços</button>
    </form>
  </section>`;
}

/* --------------------------------------------------- mensagens do WhatsApp */

const variaveisErradas = (m, texto) => [...new Set([...texto.matchAll(/\{([^{}]*)\}/g)].map(x => x[1]))].filter(v => !m.variaveis[v]);

/** O texto como chega: as variáveis viram o exemplo, destacadas; as que não existem ficam marcadas. */
const previa = (m, texto) => esc(texto).replace(/\{([^{}]*)\}/g, (marca, v) => (m.variaveis[v] ? `<mark>${esc(m.exemplo[v])}</mark>` : `<mark class="desconhecida">${marca}</mark>`));

const situacaoDaMensagem = m => (rascunhos[m.id] != null ? 'Não salva' : m.editada ? 'Editada' : 'Texto padrão');

function mensagensAba(d) {
  const atual = d.mensagens.find(m => m.id === mensagemAberta) || d.mensagens[0];
  mensagemAberta = atual.id;
  const grupos = [...new Set(d.mensagens.map(m => m.grupo))];
  const texto = rascunhos[atual.id] != null ? rascunhos[atual.id] : atual.texto;
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Mensagens do WhatsApp</h2><p>Os textos que a equipe envia pelos botões de WhatsApp do sistema. Escreva do jeito que o complexo fala; nome, valor e data de cada pessoa entram sozinhos.</p></div></div>
    <div class="mensagens">
      <nav class="mensagens-lista" aria-label="Mensagens">${grupos.map(g => `
        <div class="mensagens-grupo"><span>${esc(g)}</span>${d.mensagens.filter(m => m.grupo === g).map(m => `
          <button type="button" class="mensagem-item ${m.id === atual.id ? 'ativa' : ''}" data-msg="${m.id}" ${m.id === atual.id ? 'aria-current="true"' : ''}>
            <b>${esc(m.titulo)}</b><small class="${rascunhos[m.id] != null ? 'rascunho' : m.editada ? 'editada' : ''}">${situacaoDaMensagem(m)}</small>
          </button>`).join('')}</div>`).join('')}
      </nav>
      <div class="mensagem-editor">
        <div class="mensagem-cabeca"><h3>${esc(atual.titulo)}</h3><p>${esc(atual.quando)}</p></div>
        <div class="mensagem-corpo">
          <div class="mensagem-escrita">
            <label for="msgTexto">Texto da mensagem</label>
            <textarea id="msgTexto" rows="8" maxlength="1000" spellcheck="true">${esc(texto)}</textarea>
            <div class="mensagem-info"><span id="msgAviso" role="status"></span><span id="msgContador"></span></div>
            <div class="variaveis" role="group" aria-label="Colocar uma variável no texto">${Object.entries(atual.variaveis).map(([v, desc]) => `
              <button type="button" class="variavel" data-var="${esc(v)}"><b>{${esc(v)}}</b><span>${esc(desc)}</span></button>`).join('')}</div>
          </div>
          <div class="mensagem-previa" aria-live="polite">
            <span>Como chega no WhatsApp</span>
            <div class="previa-chat"><div class="previa-balao" id="msgPrevia"></div></div>
            <small>Com dados de exemplo. Os destacados mudam para cada pessoa.</small>
          </div>
        </div>
        <div class="mensagem-acoes">
          <button type="button" class="botao primario" data-msg-acao="salvar">Salvar mensagem</button>
          ${atual.editada || rascunhos[atual.id] != null ? '<button type="button" class="botao" data-msg-acao="padrao">Voltar ao texto padrão</button>' : ''}
          <a class="botao fantasma" id="msgTestar" target="_blank" rel="noopener">${icone('whatsapp')}Testar no meu WhatsApp</a>
        </div>
      </div>
    </div>
  </section>`;
}

function ligarMensagens(corpo, ctx) {
  const m = ctx.dadosAtuais().mensagens.find(x => x.id === mensagemAberta);
  const area = corpo.querySelector('#msgTexto');
  if (!m || !area) return;
  const mostrar = () => {
    const erradas = variaveisErradas(m, area.value);
    corpo.querySelector('#msgPrevia').innerHTML = previa(m, area.value) || '<span class="nota">A mensagem está vazia.</span>';
    corpo.querySelector('#msgAviso').textContent = erradas.length ? `${erradas.map(v => `{${v}}`).join(', ')} não ${erradas.length === 1 ? 'existe' : 'existem'} nesta mensagem.` : '';
    corpo.querySelector('#msgContador').textContent = `${area.value.length.toLocaleString('pt-BR')} de 1.000 letras`;
    corpo.querySelector('#msgTestar').href = `https://wa.me/?text=${encodeURIComponent(preencher(area.value, m.exemplo))}`;
  };
  area.addEventListener('input', () => {
    if (area.value === m.texto) delete rascunhos[m.id]; else rascunhos[m.id] = area.value;
    const marca = corpo.querySelector(`[data-msg="${m.id}"] small`);
    marca.textContent = situacaoDaMensagem(m);
    marca.className = rascunhos[m.id] != null ? 'rascunho' : m.editada ? 'editada' : '';
    mostrar();
  });
  mostrar();

  corpo.addEventListener('click', async e => {
    const item = e.target.closest('[data-msg]');
    if (item) { mensagemAberta = item.dataset.msg; ctx.desenhar(); return; }
    const variavel = e.target.closest('[data-var]');
    if (variavel) {
      area.focus();
      area.setRangeText(`{${variavel.dataset.var}}`, area.selectionStart, area.selectionEnd, 'end');
      area.dispatchEvent(new Event('input'));
      return;
    }
    const botao = e.target.closest('[data-msg-acao]');
    if (!botao || botao.classList.contains('carregando')) return;
    const padrao = botao.dataset.msgAcao === 'padrao';
    const rascunho = rascunhos[m.id];
    delete rascunhos[m.id];
    botao.classList.add('carregando');
    try {
      await ctx.acao('salvar-mensagem', padrao ? { id: m.id, padrao: true } : { id: m.id, texto: area.value },
        padrao ? 'A mensagem voltou ao texto padrão.' : 'Mensagem salva. Os botões de WhatsApp já usam o texto novo.');
      await ctx.atualizarSessao();
    } catch (err) {
      if (rascunho != null) rascunhos[m.id] = rascunho;
      avisar(err.message, 'erro');
      botao.classList.remove('carregando');
    }
  });
}

function historicoAba() {
  if (!equipe) return '<section class="bloco"><p class="nota">Carregando histórico…</p></section>';
  const frase = a => (!a.usuarioNome || a.usuarioNome === 'Sistema' ? `<b>Sistema:</b> ${esc(a.resumo)}` : `<b>${esc(a.usuarioNome)}</b> ${esc(a.resumo.charAt(0).toLowerCase() + a.resumo.slice(1))}`);
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Quem fez o quê</h2><p>As últimas 80 ações registradas, da mais recente para a mais antiga.</p></div></div>
    ${equipe.atividade.length ? `<ol class="atividade">${equipe.atividade.map(a => `<li><time>${esc(quando(a.criadoEm))}</time><span>${frase(a)}</span></li>`).join('')}</ol>` : '<p class="nota">Nada registrado ainda.</p>'}
  </section>`;
}

function demonstracaoAba(d) {
  if (d.modo === 'demo') {
    return `<section class="bloco">
      <div class="bloco-cabeca"><div><h2>Demonstração</h2></div></div>
      <p class="nota" style="font-size:14.5px;max-width:70ch">O complexo está com <b>dados fictícios</b>, recriados todo dia, para apresentar o sistema. Quando for operar de verdade, apague a demonstração: o complexo começa vazio, com o seu acesso, e você cadastra boxes, contratos, quadras, produtos e a equipe.</p>
      <button type="button" class="botao primario" data-e="real" style="margin-top:16px">Começar operação real</button>
    </section>`;
  }
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Demonstração</h2></div></div>
    ${d.temMovimento ? '<p class="nota">O complexo já tem movimento real. A demonstração só pode ser carregada num complexo vazio, para não apagar dados.</p>'
      : '<p class="nota" style="font-size:14.5px">Quer mostrar o sistema funcionando antes de cadastrar tudo? Carregue um complexo fictício com boxes alugados, parque, quadras, loja e eventos.</p><button type="button" class="botao" data-e="demo" style="margin-top:14px">Carregar demonstração</button>'}
  </section>`;
}

/* -------------------------------------------------------------- modais */

function novaPessoa(ctx, raiz) {
  abrirModal({
    titulo: 'Adicionar pessoa',
    subtitulo: 'Ela entra com o e-mail e a senha abaixo.',
    corpo: `<form class="grade-form">
      ${campo({ nome: 'nome', rotulo: 'Nome', obrigatorio: true, classe: 'inteira' })}
      ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, classe: 'inteira', extra: 'autocapitalize="off"' })}
      <div class="campo inteira"><span class="rotulo">Perfil</span><div class="escolhas">
        <label class="escolha"><input type="radio" name="papel" value="recepcao" checked><span><b>Recepção</b><small>Caixa, PDV, pulseiras e quadras.</small></span></label>
        <label class="escolha"><input type="radio" name="papel" value="monitor"><span><b>Monitor do parque</b><small>Entrada e saída das crianças.</small></span></label>
        <label class="escolha"><input type="radio" name="papel" value="eventos"><span><b>Eventos</b><small>Só festas e eventos: orçamento, pagamentos e contrato.</small></span></label>
        <label class="escolha"><input type="radio" name="papel" value="dono"><span><b>Gestão</b><small>Tudo, inclusive financeiro e equipe.</small></span></label>
      </div></div>
      ${campo({ nome: 'senha', rotulo: 'Senha inicial', valor: senhaSugerida(), obrigatorio: true, classe: 'inteira', ajuda: 'Anote e passe para a pessoa. Ela pode trocar depois.', extra: 'minlength="6" autocomplete="off"' })}
    </form>`,
    botao: 'Adicionar à equipe',
    aoEnviar: async v => { await api.novaPessoa(v); avisar(`${v.nome} pode entrar com ${v.email}.`); await carregarEquipe(raiz); }
  });
}

async function carregarEquipe(raiz) {
  try { equipe = await api.equipe(); } catch (err) { avisar(err.message, 'erro'); return; }
  const lista = raiz.querySelector('#listaEquipe');
  if (lista) lista.innerHTML = htmlEquipe();
  const hist = raiz.querySelector('[data-aba="historico"]');
  if (hist) hist.innerHTML = historicoAba();
}

function salvarQuadra(ctx, q) {
  abrirModal({
    titulo: q ? q.nome : 'Nova quadra',
    corpo: `<form class="grade-form">
      ${campo({ nome: 'nome', rotulo: 'Nome', valor: q ? q.nome : '', obrigatorio: true, placeholder: 'Ex.: Quadra 5' })}
      ${campo({ nome: 'modalidade', rotulo: 'Modalidade', valor: q ? q.modalidade : '', placeholder: 'Ex.: Beach tennis' })}
      ${campoDinheiro({ nome: 'precoHora', rotulo: 'Preço da hora', valor: q ? q.precoHora : '', obrigatorio: true, classe: 'inteira' })}
      ${q ? `<label class="escolha inteira"><input type="checkbox" name="ativa" ${q.ativa ? 'checked' : ''}><span><b>Na agenda</b><small>Desmarque para tirar a quadra da agenda (reforma, por exemplo).</small></span></label>` : ''}
    </form>`,
    botao: q ? 'Salvar' : 'Cadastrar quadra',
    aoEnviar: v => ctx.acao('salvar-quadra', { quadraId: q ? q.id : undefined, nome: v.nome, modalidade: v.modalidade, precoHora: v.precoHora, ativa: q ? v.ativa === 'on' : true }, q ? 'Quadra atualizada.' : 'Quadra cadastrada.')
  });
}

function operacaoReal(ctx) {
  const d = ctx.dadosAtuais();
  const demoUser = ctx.usuario.demo;
  abrirModal({
    titulo: 'Começar a operação real',
    subtitulo: 'Os dados de demonstração são apagados e o complexo começa vazio.',
    largo: true,
    corpo: `<form>
      <div class="form-secao"><h3>O complexo</h3><div class="grade-form">
        ${campo({ nome: 'parqueNome', rotulo: 'Nome do complexo', valor: d.nome, obrigatorio: true, classe: 'inteira' })}
        ${campo({ nome: 'cidade', rotulo: 'Cidade', valor: d.config.cidade, classe: 'inteira' })}
      </div></div>
      ${demoUser ? `<div class="form-secao"><h3>Seu acesso</h3><p class="nota" style="margin:-4px 0 10px">Você está no acesso de demonstração, que será desligado. Crie o seu.</p><div class="grade-form">
        ${campo({ nome: 'nome', rotulo: 'Seu nome', obrigatorio: true, classe: 'inteira' })}
        ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, classe: 'inteira', extra: 'autocapitalize="off" autocomplete="username"' })}
        ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, classe: 'inteira', ajuda: 'Pelo menos 6 caracteres.', extra: 'minlength="6" autocomplete="new-password"' })}
      </div></div>` : ''}
    </form>`,
    botao: 'Apagar demonstração e começar',
    botaoTipo: 'perigo cheio',
    aoEnviar: async v => {
      await api.operacaoReal({ parque: { nome: v.parqueNome, cidade: v.cidade }, dono: demoUser ? { nome: v.nome, email: v.email, senha: v.senha } : undefined });
      await ctx.atualizarSessao();
      ctx.ir('admin/complexo');
      avisar('Pronto. Comece cadastrando as quadras, os tempos do parque e a equipe.');
    }
  });
}

/* ---------------------------------------------------------------- tela */

export default {
  tela: 'admin',
  titulo: 'Administração',
  descricao: 'Dados do complexo, equipe, parque infantil, quadras, espaços de eventos, mensagens do WhatsApp e o histórico de quem fez o quê.',

  render(ctx) {
    const d = ctx.dados;
    const aba = abaAtual(ctx.rota, ABAS);
    const conteudo = { complexo, equipe: equipeAba, parque: parqueAba, quadras: quadrasAba, eventos: eventosAba, mensagens: mensagensAba, historico: historicoAba, demonstracao: demonstracaoAba }[aba](d, ctx);
    return `${abas('admin', aba, [['complexo', 'Complexo'], ['equipe', 'Equipe'], ['parque', 'Parque infantil'], ['quadras', 'Quadras'], ['eventos', 'Eventos'], ['mensagens', 'Mensagens'], ['historico', 'Histórico'], ['demonstracao', 'Demonstração']])}
      <div data-aba="${aba}">${conteudo}</div>`;
  },

  ligar(raiz, ctx) {
    const aba = abaAtual(ctx.rota, ABAS);
    const corpo = raiz.querySelector('#corpoPagina');
    corpo.querySelectorAll('form').forEach(validarEmPortugues);
    if (aba === 'equipe' || aba === 'historico') carregarEquipe(raiz);
    if (aba === 'mensagens') ligarMensagens(corpo, ctx);

    const enviar = (id, fn) => {
      const form = corpo.querySelector(id);
      if (!form) return;
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const botao = form.querySelector('button[type=submit]');
        botao.classList.add('carregando');
        try { await fn(form, Object.fromEntries(new FormData(form).entries())); } catch (err) { avisar(err.message, 'erro'); } finally { botao.classList.remove('carregando'); }
      });
    };
    enviar('#formComplexo', async (_f, v) => { await ctx.acao('editar-complexo', v, 'Dados do complexo salvos.'); await ctx.atualizarSessao(); });
    enviar('#formSenha', async (f, v) => { await api.minhaSenha(v.atual, v.nova); f.reset(); avisar('Senha trocada.'); });
    enviar('#formEspacos', (_f, v) => ctx.acao('editar-espacos', { espacos: v.espacos.split('\n') }, 'Espaços salvos.'));
    enviar('#formParque', (f, v) => {
      const planos = [...f.querySelectorAll('.plano-linha')].map(l => ({
        id: l.dataset.id, nome: l.querySelector('[name=nome]').value, minutos: l.querySelector('[name=minutos]').value, preco: l.querySelector('[name=preco]').value
      }));
      return ctx.acao('config-parque', { ...v, planos }, 'Parque infantil salvo.');
    });

    corpo.addEventListener('click', async e => {
      const alvo = e.target.closest('[data-e]');
      if (!alvo) return;
      const d = ctx.dadosAtuais();
      const pessoa = equipe && equipe.pessoas.find(p => String(p.id) === alvo.dataset.id);
      try {
        switch (alvo.dataset.e) {
          case 'nova': return novaPessoa(ctx, raiz);
          case 'senha':
            return abrirModal({ titulo: `Nova senha para ${pessoa.nome}`, subtitulo: 'A pessoa sai dos aparelhos conectados e entra com a senha nova.', corpo: `<form>${campo({ nome: 'senha', rotulo: 'Nova senha', valor: senhaSugerida(), obrigatorio: true, ajuda: 'Anote e passe para a pessoa.', extra: 'minlength="6" autocomplete="off"' })}</form>`, botao: 'Definir senha', aoEnviar: async v => { await api.alterarPessoa(pessoa.id, { senha: v.senha }); avisar('Senha definida.'); await carregarEquipe(raiz); } });
          case 'perfil':
            return abrirModal({ titulo: `Perfil de ${pessoa.nome}`, corpo: `<form>${campo({ nome: 'papel', rotulo: 'Perfil', valor: pessoa.papel, opcoes: [['recepcao', 'Recepção'], ['monitor', 'Monitor do parque'], ['eventos', 'Eventos'], ['dono', 'Gestão']].map(([valor, texto]) => ({ valor, texto })) })}</form>`, botao: 'Salvar perfil', aoEnviar: async v => { await api.alterarPessoa(pessoa.id, { papel: v.papel }); avisar('Perfil alterado.'); await carregarEquipe(raiz); } });
          case 'desativar':
            if (!(await confirmar({ titulo: `Desativar ${pessoa.nome}?`, texto: 'A pessoa sai de todos os aparelhos na hora e não entra mais. O histórico do que ela fez continua guardado.', botao: 'Desativar', perigo: true }))) return;
            await api.alterarPessoa(pessoa.id, { ativo: false }); avisar('Acesso desativado.'); return carregarEquipe(raiz);
          case 'reativar':
            await api.alterarPessoa(pessoa.id, { ativo: true }); avisar('Acesso reativado.'); return carregarEquipe(raiz);
          case 'mais-plano': {
            corpo.querySelector('#planos').insertAdjacentHTML('beforeend', linhaPlano());
            return corpo.querySelector('#planos .plano-linha:last-child input').focus();
          }
          case 'tirar-plano':
            if (corpo.querySelectorAll('.plano-linha').length <= 1) return avisar('O parque precisa de pelo menos um tempo de pulseira.', 'erro');
            return alvo.closest('.plano-linha').remove();
          case 'nova-quadra': return salvarQuadra(ctx, null);
          case 'quadra': return salvarQuadra(ctx, d.quadras.find(q => q.id === Number(alvo.dataset.id)));
          case 'real': return operacaoReal(ctx);
          case 'demo':
            if (!(await confirmar({ titulo: 'Carregar a demonstração?', texto: 'O complexo recebe boxes, crianças, vendas, reservas e eventos fictícios. Depois você apaga tudo em "Começar operação real".', botao: 'Carregar' }))) return;
            await api.carregarDemo(); await ctx.atualizarSessao(); ctx.ir('painel'); return avisar('Demonstração carregada.');
          default:
        }
      } catch (err) {
        avisar(err.message, 'erro');
      }
    });
  }
};

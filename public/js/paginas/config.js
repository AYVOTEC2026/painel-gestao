import { esc, icone, avisar, abrirModal, confirmar, campo, campoPorcento, validarEmPortugues } from '../ui.js';
import { api } from '../api.js';

function operacaoReal(ctx) {
  const demoUser = ctx.usuario.demo;
  abrirModal({
    titulo: 'Começar a operação real',
    subtitulo: 'Os dados de demonstração são apagados e o food park começa vazio.',
    largo: true,
    corpo: `<form>
      <div class="form-secao">
        <h3>O food park</h3>
        <div class="grade-form">
          ${campo({ nome: 'parqueNome', rotulo: 'Nome do food park', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Food Park da Orla' })}
          ${campo({ nome: 'cidade', rotulo: 'Cidade', valor: ctx.visao.parque.cidade })}
          ${campo({ nome: 'boxes', rotulo: 'Quantos boxes', tipo: 'number', valor: ctx.visao.parque.boxes, extra: 'min="1" max="60"' })}
          ${campoPorcento({ nome: 'taxa', rotulo: 'Taxa sobre as vendas', valor: ctx.visao.parque.taxa, classe: 'inteira' })}
        </div>
      </div>
      ${demoUser ? `<div class="form-secao">
        <h3>Seu acesso</h3>
        <p class="nota" style="margin:-4px 0 10px">Você está no acesso de demonstração, que será desligado. Crie o seu.</p>
        <div class="grade-form">
          ${campo({ nome: 'nome', rotulo: 'Seu nome', obrigatorio: true, classe: 'inteira' })}
          ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, classe: 'inteira', extra: 'autocapitalize="off" autocomplete="username"' })}
          ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, classe: 'inteira', ajuda: 'Pelo menos 6 caracteres.', extra: 'minlength="6" autocomplete="new-password"' })}
        </div>
      </div>` : ''}
    </form>`,
    botao: 'Apagar demonstração e começar',
    botaoTipo: 'perigo cheio',
    aoEnviar: async d => {
      await api.operacaoReal({
        parque: { nome: d.parqueNome, cidade: d.cidade, boxes: d.boxes, taxa: d.taxa },
        dono: demoUser ? { nome: d.nome, email: d.email, senha: d.senha } : undefined
      });
      await ctx.recarregar();
      await ctx.atualizarSessao();
      ctx.ir('inicio');
      avisar('Pronto. O food park está vazio e pronto para a operação real.');
    }
  });
}

export default {
  titulo: 'Configurações',
  descricao: 'Dados do food park, taxas, sua senha e a demonstração.',
  ajuda: 'config',

  render(ctx) {
    const p = ctx.visao.parque;
    const t = p.maquininha;
    const demo = p.modo === 'demo';
    const vazio = ctx.visao.boxes.length === 0;
    return `
      <div class="duas-colunas" style="margin-top:0">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Food park</h2><p>Aparece no topo do sistema e nos arquivos do contador.</p></div></div>
          <form id="formParque">
            <div class="grade-form">
              ${campo({ nome: 'nome', rotulo: 'Nome', valor: p.nome, obrigatorio: true, classe: 'inteira' })}
              ${campo({ nome: 'cidade', rotulo: 'Cidade', valor: p.cidade })}
              ${campo({ nome: 'cnpj', rotulo: 'CNPJ', valor: p.cnpj, placeholder: '00.000.000/0000-00' })}
              ${campo({ nome: 'boxes', rotulo: 'Quantidade de boxes', tipo: 'number', valor: p.boxes, extra: 'min="1" max="60"', classe: 'inteira', ajuda: 'Pode aumentar quando quiser. Para diminuir, os boxes do fim precisam estar livres.' })}
            </div>
            <div class="form-secao" style="margin-top:20px">
              <h3>Taxas</h3>
              <div class="grade-form">
                ${campoPorcento({ nome: 'taxa', rotulo: 'Taxa sobre as vendas', valor: p.taxa, classe: 'inteira', dica: 'Padrão para lojistas novos. Cada lojista pode ter a própria taxa, ajustada no box.' })}
                ${campoPorcento({ nome: 'debito', rotulo: 'Maquininha: débito', valor: t.debito, extra: 'min="0" max="20" step="0.01"' })}
                ${campoPorcento({ nome: 'credito', rotulo: 'Maquininha: crédito', valor: t.credito, extra: 'min="0" max="20" step="0.01"' })}
                ${campoPorcento({ nome: 'pix', rotulo: 'Pix', valor: t.pix, extra: 'min="0" max="20" step="0.01"' })}
                ${campoPorcento({ nome: 'voucher', rotulo: 'Voucher', valor: t.voucher, extra: 'min="0" max="20" step="0.01"' })}
              </div>
              <p class="nota" style="margin-top:10px">As taxas da maquininha são descontadas do lojista. Vendas já feitas continuam com a taxa da época.</p>
            </div>
            <div class="cabecalho-acoes" style="margin-top:18px"><button type="submit" class="botao primario">Salvar alterações</button></div>
          </form>
        </section>

        <div>
          <section class="bloco">
            <div class="bloco-cabeca"><div><h2>Minha senha</h2><p>${esc(ctx.usuario.email)}</p></div></div>
            ${ctx.usuario.demo ? '<p class="nota">O acesso de demonstração usa a senha padrão e não pode ser alterado.</p>' : `
            <form id="formSenha" class="grade-form">
              ${campo({ nome: 'atual', rotulo: 'Senha atual', tipo: 'password', obrigatorio: true, classe: 'inteira', extra: 'autocomplete="current-password"' })}
              ${campo({ nome: 'nova', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, classe: 'inteira', ajuda: 'Pelo menos 6 caracteres. Os outros aparelhos onde você está conectado saem.', extra: 'minlength="6" autocomplete="new-password"' })}
              <div class="inteira"><button type="submit" class="botao">Trocar senha</button></div>
            </form>`}
          </section>

          <section class="bloco" id="blocoDemo">
            <div class="bloco-cabeca"><div><h2>Demonstração</h2></div></div>
            ${demo ? `
              <p class="nota" style="margin-bottom:14px">O food park está com <b>dados fictícios</b>, recriados todo dia, para apresentar o sistema. Quando for operar de verdade, apague a demonstração e comece do zero.</p>
              <button type="button" class="botao primario" data-c="real">Começar operação real</button>` : vazio ? `
              <p class="nota" style="margin-bottom:14px">Quer mostrar o sistema funcionando antes de cadastrar os lojistas? Carregue uma praça fictícia com cinco boxes e um mês de vendas.</p>
              <button type="button" class="botao" data-c="demo">Carregar demonstração</button>` : `
              <p class="nota">A demonstração só pode ser carregada em um food park sem lojistas, para não apagar dados reais.</p>`}
          </section>

          <section class="bloco">
            <div class="bloco-cabeca"><div><h2>Suporte</h2></div></div>
            <p class="nota">Sistema AYVO Food Park. Dúvidas sobre o uso estão em <a href="#/ajuda">Ajuda</a>. Para problemas técnicos, fale com a AYVO Tecnologia.</p>
          </section>
        </div>
      </div>`;
  },

  ligar(raiz, ctx) {
    const corpo = raiz.querySelector('#corpoPagina');
    corpo.querySelectorAll('form').forEach(validarEmPortugues);
    if (ctx.rota.sub === 'operacao' && ctx.visao.parque.modo === 'demo') {
      setTimeout(() => operacaoReal(ctx), 80);
      history.replaceState(null, '', '#/config');
    }
    corpo.querySelector('#formParque').addEventListener('submit', async e => {
      e.preventDefault();
      const botao = e.target.querySelector('button[type=submit]');
      const d = Object.fromEntries(new FormData(e.target).entries());
      botao.classList.add('carregando');
      try {
        await ctx.acao('editar-parque', {
          nome: d.nome, cidade: d.cidade, cnpj: d.cnpj, boxes: d.boxes, taxa: d.taxa,
          maquininha: { debito: d.debito, credito: d.credito, pix: d.pix, voucher: d.voucher }
        }, 'Dados do food park salvos.');
        await ctx.atualizarSessao();
      } catch (err) {
        avisar(err.message, 'erro');
        botao.classList.remove('carregando');
      }
    });
    const formSenha = corpo.querySelector('#formSenha');
    if (formSenha) formSenha.addEventListener('submit', async e => {
      e.preventDefault();
      const botao = e.target.querySelector('button[type=submit]');
      const d = Object.fromEntries(new FormData(e.target).entries());
      botao.classList.add('carregando');
      try {
        await api.minhaSenha(d.atual, d.nova);
        e.target.reset();
        avisar('Senha trocada.');
      } catch (err) {
        avisar(err.message, 'erro');
      } finally {
        botao.classList.remove('carregando');
      }
    });
    corpo.addEventListener('click', async e => {
      const alvo = e.target.closest('[data-c]');
      if (!alvo) return;
      if (alvo.dataset.c === 'real') operacaoReal(ctx);
      if (alvo.dataset.c === 'demo') {
        const ok = await confirmar({ titulo: 'Carregar a demonstração?', texto: 'O food park recebe cinco lojistas fictícios e um mês de vendas. Depois você pode apagar tudo em "Começar operação real".', botao: 'Carregar demonstração' });
        if (!ok) return;
        try {
          await ctx.acao('carregar-demo', {}, 'Demonstração carregada.');
          await ctx.atualizarSessao();
        } catch (err) {
          avisar(err.message, 'erro');
        }
      }
    });
  }
};

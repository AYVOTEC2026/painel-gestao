import { esc, icone, iniciais, selo, avisar, abrirModal, confirmar, campo } from '../ui.js';
import { api } from '../api.js';

let dados = null;

const senhaSugerida = () => {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const n = () => Math.floor(Math.random() * 10);
  const l = () => letras[Math.floor(Math.random() * letras.length)];
  return `${l()}${l()}${l()}${l()}${n()}${n()}${n()}${n()}`;
};

const quando = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
};

function htmlPessoas() {
  if (!dados) return '<p class="nota">Carregando equipe…</p>';
  return dados.pessoas.map(p => `
    <div class="pessoa ${p.ativo ? '' : 'inativa'}">
      <div class="avatar">${esc(iniciais(p.nome))}</div>
      <div><b>${esc(p.nome)}${p.eu ? ' (você)' : ''}</b><small>${esc(p.email)}${p.ultimoAcesso ? `, último acesso ${esc(quando(p.ultimoAcesso))}` : ', ainda não entrou'}</small></div>
      ${p.ativo ? selo(p.papelNome, p.papel === 'dono' ? 'info' : '') : selo('Desativado', 'problema')}
      <div class="cabecalho-acoes">
        ${p.ativo && !p.demo ? `<button class="botao pequeno" data-e="senha" data-id="${p.id}">${icone('cadeado')}Nova senha</button>` : ''}
        ${p.eu ? '' : p.ativo ? `<button class="botao pequeno perigo" data-e="desativar" data-id="${p.id}">Desativar</button>` : `<button class="botao pequeno" data-e="reativar" data-id="${p.id}">Reativar</button>`}
      </div>
    </div>`).join('');
}

function htmlAtividade() {
  if (!dados) return '';
  if (!dados.atividade.length) return '<p class="nota">Nada registrado ainda.</p>';
  // Ações de pessoas viram frase ("Carla abriu o caixa..."); as automáticas ficam como aviso do sistema.
  const frase = a => (!a.usuarioNome || a.usuarioNome === 'Sistema')
    ? `<b>Sistema:</b> ${esc(a.resumo)}`
    : `<b>${esc(a.usuarioNome)}</b> ${esc(a.resumo.charAt(0).toLowerCase() + a.resumo.slice(1))}`;
  return `<ol class="atividade">${dados.atividade.map(a => `
    <li><time>${esc(quando(a.criadoEm))}</time><span>${frase(a)}</span></li>`).join('')}</ol>`;
}

async function carregar(raiz) {
  try {
    dados = await api.equipe();
  } catch (err) {
    avisar(err.message, 'erro');
    return;
  }
  const pessoas = raiz.querySelector('#listaPessoas');
  const atividade = raiz.querySelector('#listaAtividade');
  if (pessoas) pessoas.innerHTML = htmlPessoas();
  if (atividade) atividade.innerHTML = htmlAtividade();
}

function adicionar(raiz) {
  abrirModal({
    titulo: 'Adicionar pessoa',
    subtitulo: 'Ela entra com o e-mail e a senha abaixo.',
    corpo: `<form class="grade-form">
      ${campo({ nome: 'nome', rotulo: 'Nome', obrigatorio: true, classe: 'inteira' })}
      ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, classe: 'inteira', extra: 'autocapitalize="off"' })}
      <div class="campo inteira"><span class="rotulo">Perfil de acesso</span>
        <div class="escolhas">
          <label class="escolha"><input type="radio" name="papel" value="caixa" checked><span><b>Caixa</b><small>${esc(dados.papeis.caixa.descricao)}</small></span></label>
          <label class="escolha"><input type="radio" name="papel" value="dono"><span><b>Gestão</b><small>${esc(dados.papeis.dono.descricao)}</small></span></label>
        </div>
      </div>
      ${campo({ nome: 'senha', rotulo: 'Senha inicial', valor: senhaSugerida(), obrigatorio: true, classe: 'inteira', ajuda: 'Anote e passe para a pessoa. Ela pode trocar depois em Configurações.', extra: 'minlength="6" autocomplete="off"' })}
    </form>`,
    botao: 'Adicionar à equipe',
    aoEnviar: async d => {
      await api.novaPessoa(d);
      avisar(`${d.nome} pode entrar com ${d.email}.`);
      await carregar(raiz);
    }
  });
}

function novaSenha(raiz, pessoa) {
  abrirModal({
    titulo: `Nova senha para ${pessoa.nome}`,
    subtitulo: 'A pessoa sai de todos os aparelhos e entra de novo com esta senha.',
    corpo: `<form>${campo({ nome: 'senha', rotulo: 'Nova senha', valor: senhaSugerida(), obrigatorio: true, ajuda: 'Anote e passe para a pessoa.', extra: 'minlength="6" autocomplete="off"' })}</form>`,
    botao: 'Definir senha',
    aoEnviar: async d => {
      await api.alterarPessoa(pessoa.id, { senha: d.senha });
      avisar('Senha definida.');
      await carregar(raiz);
    }
  });
}

export default {
  titulo: 'Equipe',
  descricao: 'Quem tem acesso ao sistema e o que cada pessoa fez.',
  ajuda: 'equipe',
  acoesCabecalho: () => `<button type="button" class="botao primario" id="adicionarPessoa">${icone('mais')}Adicionar pessoa</button>`,

  render() {
    return `
      <div class="duas-colunas" style="margin-top:0">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Pessoas com acesso</h2><p>Cada pessoa entra com o próprio e-mail. Não compartilhe senhas.</p></div></div>
          <div id="listaPessoas">${htmlPessoas()}</div>
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Atividade recente</h2><p>Aberturas de caixa, vendas, cancelamentos e mudanças, com o nome de quem fez.</p></div></div>
          <div id="listaAtividade">${htmlAtividade()}</div>
        </section>
      </div>`;
  },

  ligar(raiz) {
    carregar(raiz);
    raiz.querySelector('#adicionarPessoa').addEventListener('click', () => { if (dados) adicionar(raiz); });
    raiz.querySelector('#corpoPagina').addEventListener('click', async e => {
      const alvo = e.target.closest('[data-e]');
      if (!alvo || !dados) return;
      const pessoa = dados.pessoas.find(p => String(p.id) === alvo.dataset.id);
      if (!pessoa) return;
      try {
        if (alvo.dataset.e === 'senha') {
          novaSenha(raiz, pessoa);
        } else if (alvo.dataset.e === 'desativar') {
          const ok = await confirmar({
            titulo: `Desativar ${pessoa.nome}?`,
            texto: 'A pessoa sai de todos os aparelhos na hora e não consegue mais entrar. O histórico do que ela fez continua guardado. Dá para reativar depois.',
            botao: 'Desativar acesso',
            perigo: true
          });
          if (!ok) return;
          await api.alterarPessoa(pessoa.id, { ativo: false });
          avisar(`Acesso de ${pessoa.nome} desativado.`);
          await carregar(raiz);
        } else if (alvo.dataset.e === 'reativar') {
          await api.alterarPessoa(pessoa.id, { ativo: true });
          avisar(`Acesso de ${pessoa.nome} reativado.`);
          await carregar(raiz);
        }
      } catch (err) {
        avisar(err.message, 'erro');
      }
    });
  }
};

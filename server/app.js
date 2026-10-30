'use strict';

const path = require('path');
const express = require('express');
const A = require('./acesso');
const D = require('./dominio/datas');
const { PAPEIS, papelValido, podeVerTela } = require('./dominio/permissoes');
const { PADRAO, completar } = require('./dominio/configuracao');
const { criarAcessos } = require('./persistencia/acessos');
const { inserir } = require('./persistencia/banco');
const { executarAcao } = require('./servicos');
const { prepararParque } = require('./servicos/preparo');
const operacao = require('./consultas/operacao');
const gestao = require('./consultas/gestao');
const { exportar } = require('./consultas/exportar');
const { gerarPacote } = require('./consultas/pacote');
const demo = require('./demo');

const HASH_FALSO = A.hashSenha('senha-que-ninguem-usa');
const TIPOS_ANEXO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/xml', 'text/xml'];
// Quem pode receber anexo: contrato de locação, evento e despesa (nota fiscal).
const DONOS_ANEXO = { contrato: { tabela: 'contratos', nome: 'contrato' }, evento: { tabela: 'eventos', nome: 'evento' }, conta: { tabela: 'contas', nome: 'despesa' } };

const TELAS = {
  painel: operacao.painel,
  pdv: operacao.pdv,
  parque: operacao.parque,
  quadras: operacao.quadras,
  boxes: gestao.boxes,
  eventos: gestao.eventos,
  loja: gestao.loja,
  financeiro: gestao.financeiro,
  contabilidade: gestao.contabilidade,
  relatorios: gestao.relatorios,
  admin: gestao.admin
};
// Telas que mostram o parque infantil: na demonstração, elas mantêm crianças entrando e saindo.
const MOSTRAM_PARQUE = ['painel', 'pdv', 'parque'];

const rota = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function lerPessoa(d) {
  const nome = String((d && d.nome) || '').trim();
  const email = String((d && d.email) || '').trim().toLowerCase();
  if (nome.length < 2) throw new A.ErroUsuario('Informe o nome da pessoa.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new A.ErroUsuario('Informe um e-mail válido.');
  return { nome, email };
}

function lerComplexo(p) {
  const nome = String((p && p.nome) || '').trim();
  if (nome.length < 2) throw new A.ErroUsuario('Informe o nome do complexo.');
  return { nome, cidade: String((p && p.cidade) || '').trim().slice(0, 80) };
}

function criarApp({ cfg, banco, agora }) {
  const app = express();
  const acessos = criarAcessos(banco);
  const publico = path.join(__dirname, '..', 'public');
  const freioLogin = new A.Freio(8, 15 * 60 * 1000);
  const freioInstalacao = new A.Freio(10, 15 * 60 * 1000);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'",
      "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"
    ].join('; '));
    next();
  });
  app.use(express.json({ limit: '300kb' }));

  // Pedido que altera dados precisa vir desta mesma origem (proteção contra CSRF):
  // JSON, ou envio de anexo com cabeçalho próprio que outro site não consegue mandar.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origem = req.headers.origin;
    if (origem) {
      let host = '';
      try { host = new URL(origem).host; } catch (_) { host = ''; }
      if (host !== req.headers.host) return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    if (req.path === '/anexos' && req.method === 'POST') {
      if (!req.headers['x-arquivo-nome'] || !TIPOS_ANEXO.includes(String(req.headers['content-type'] || '').split(';')[0])) {
        return res.status(415).json({ erro: 'Envie um arquivo PDF, XML, JPG, PNG ou WEBP.' });
      }
      return next();
    }
    // DELETE vindo de outro site já esbarra na checagem prévia do navegador (CORS); sem corpo, não precisa de JSON.
    if (req.method === 'DELETE' && !req.headers['content-length']) return next();
    if (!req.is('application/json')) return res.status(415).json({ erro: 'Envie os dados em JSON.' });
    next();
  });

  app.use('/api', rota(async (req, _res, next) => {
    const token = A.lerCookie(req, A.COOKIE);
    if (token) {
      req.tokenHash = A.hashToken(token);
      req.usuario = await acessos.sessoes.buscar(req.tokenHash);
    }
    next();
  }));

  const exigir = (...papeis) => (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Sua sessão terminou. Entre novamente para continuar.', codigo: 'LOGIN' });
    if (papeis.length && !papeis.includes(req.usuario.papel)) return res.status(403).json({ erro: 'Seu perfil não tem acesso a esta área.' });
    next();
  };

  const perfil = u => ({
    id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel].nome, demo: !!u.demo,
    telas: PAPEIS[u.papel].telas, inicio: PAPEIS[u.papel].inicio
  });

  async function abrirSessao(req, res, usuario) {
    const token = A.novoToken();
    await acessos.sessoes.criar(A.hashToken(token), usuario.id, new Date(Date.now() + A.DURACAO_SESSAO_MS));
    await acessos.usuarios.registrarAcesso(usuario.id);
    res.setHeader('Set-Cookie', A.cookieDeSessao(req, token, A.DURACAO_SESSAO_MS));
  }

  const registrar = (req, acao, resumo) => acessos.historico.registrar(req.usuario.parqueId, {
    usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao, resumo
  });

  /* -------------------------------------------------------------- público */

  app.get('/api/saude', rota(async (_req, res) => {
    await banco.query('select 1');
    res.json({ ok: true, banco: 'postgres', versao: require('../package.json').version });
  }));

  app.get('/api/publico', rota(async (_req, res) => {
    const parque = await acessos.parques.primeiro();
    let perfisDemo = null;
    if (parque && parque.modo === 'demo') {
      const lista = await acessos.usuarios.demos(parque.id);
      if (lista.length) {
        perfisDemo = {
          senha: cfg.senhaDemo,
          perfis: lista.map(u => ({ email: u.email, nome: u.nome, papel: u.papel, papelNome: PAPEIS[u.papel].nome, descricao: PAPEIS[u.papel].descricao }))
        };
      }
    }
    res.json({ instalado: !!parque, nomeParque: parque ? parque.nome : '', exigeCodigo: !!cfg.codigoInstalacao, demo: perfisDemo });
  }));

  app.post('/api/entrar', rota(async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const senha = String((req.body && req.body.senha) || '');
    if (!email || !senha) throw new A.ErroUsuario('Informe e-mail e senha.');
    const chave = `${req.ip}|${email}`;
    if (freioLogin.bloqueado(chave)) throw new A.ErroUsuario('Muitas tentativas seguidas. Espere 15 minutos e tente de novo.', 429);
    const usuario = await acessos.usuarios.porEmail(email);
    // Confere a senha mesmo sem usuário, para a resposta não revelar quais e-mails existem.
    const confere = A.senhaConfere(senha, usuario ? usuario.senhaHash : HASH_FALSO);
    if (!usuario || !usuario.ativo || !confere) {
      freioLogin.falhou(chave);
      throw new A.ErroUsuario('E-mail ou senha não conferem. Confira e tente de novo.');
    }
    freioLogin.limpar(chave);
    await abrirSessao(req, res, usuario);
    res.json({ usuario: perfil(usuario) });
  }));

  app.post('/api/sair', rota(async (req, res) => {
    if (req.tokenHash) await acessos.sessoes.apagar(req.tokenHash);
    res.setHeader('Set-Cookie', `${A.COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  }));

  app.post('/api/instalar', rota(async (req, res) => {
    if (await acessos.parques.primeiro()) throw new A.ErroUsuario('Este sistema já foi instalado. Entre com seu e-mail e senha.', 409);
    if (freioInstalacao.bloqueado(req.ip)) throw new A.ErroUsuario('Muitas tentativas seguidas. Espere 15 minutos.', 429);
    if (cfg.codigoInstalacao && String((req.body && req.body.codigo) || '').trim() !== cfg.codigoInstalacao) {
      freioInstalacao.falhou(req.ip);
      throw new A.ErroUsuario('Código de instalação incorreto. Peça o código à AYVO.', 403);
    }
    const complexo = lerComplexo(req.body && req.body.parque);
    const dono = lerPessoa(req.body && req.body.dono);
    A.validarSenhaNova(req.body.dono.senha);
    const config = Object.assign({}, PADRAO, { cidade: complexo.cidade });
    const p = await banco.query("insert into parques (nome, modo, config) values ($1, 'real', $2) returning id", [complexo.nome, JSON.stringify(config)]);
    const usuario = await acessos.usuarios.criar({ parqueId: p.rows[0].id, ...dono, papel: 'dono', senhaHash: A.hashSenha(req.body.dono.senha) });
    await acessos.historico.registrar(p.rows[0].id, { usuarioId: usuario.id, usuarioNome: usuario.nome, acao: 'instalacao', resumo: `Instalou o sistema do ${complexo.nome}.` });
    await abrirSessao(req, res, usuario);
    res.json({ usuario: perfil(usuario) });
  }));

  /* ------------------------------------------------------------ com login */

  // Sem login responde 200 com usuario nulo: é o estado normal da tela de entrada, não um erro.
  app.get('/api/sessao', rota(async (req, res) => {
    if (!req.usuario) return res.json({ usuario: null });
    const p = await acessos.parques.ler(req.usuario.parqueId);
    res.json({ usuario: perfil(req.usuario), parque: { nome: p.nome, modo: p.modo } });
  }));

  app.get('/api/tela/:nome', exigir(), rota(async (req, res) => {
    const nome = req.params.nome;
    if (!Object.prototype.hasOwnProperty.call(TELAS, nome)) throw new A.ErroUsuario('Tela não encontrada.', 404);
    if (!podeVerTela(req.usuario.papel, nome)) throw new A.ErroUsuario('Seu perfil não tem acesso a esta tela.', 403);
    const parqueId = req.usuario.parqueId;
    const ts = agora();
    await prepararParque(banco, { parqueId, agora: ts, senhaDemo: cfg.senhaDemo, simular: MOSTRAM_PARQUE.includes(nome) });
    const p = await acessos.parques.ler(parqueId);
    res.json(await TELAS[nome](banco, { parqueId, agora: ts, config: completar(p.config), params: req.query || {}, papel: req.usuario.papel }));
  }));

  app.post('/api/acao/:nome', exigir(), rota(async (req, res) => {
    const resultado = await executarAcao(banco, { nome: req.params.nome, parqueId: req.usuario.parqueId, usuario: req.usuario, agora: agora(), dados: req.body });
    res.json({ ok: true, resultado });
  }));

  app.get('/api/exportar/:arquivo', exigir('dono'), rota(async (req, res) => {
    const mes = D.mesValido(req.query.mes) ? req.query.mes : D.mesDe(agora());
    const conteudo = await exportar(banco, req.usuario.parqueId, req.params.arquivo, mes);
    if (conteudo == null) throw new A.ErroUsuario('Arquivo desconhecido.', 404);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="complexo-${req.params.arquivo}-${mes}.csv"`);
    res.send(conteudo);
  }));

  /** Pacote do contador: ZIP com as despesas do mês, as notas fiscais e um resumo. */
  app.get('/api/exportar-pacote', exigir('dono'), async (req, res, next) => {
    const mes = D.mesValido(req.query.mes) ? req.query.mes : D.mesDe(agora());
    const completo = req.query.completo === '1';
    try {
      const p = await acessos.parques.ler(req.usuario.parqueId);
      const nome = `contador-${p.nome.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${mes}${completo ? '-completo' : '-despesas'}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
      res.setHeader('Cache-Control', 'no-store');
      const r = await gerarPacote(banco, { parqueId: req.usuario.parqueId, mes, completo, saida: res, agora: agora() });
      res.end();
      await registrar(req, 'contador', `Exportou o pacote ${completo ? 'completo' : 'de despesas'} de ${mes} para o contador (${r.despesas} despesas, ${r.arquivos} arquivos).`);
    } catch (err) {
      // Depois que o ZIP começou a sair não dá mais para responder com erro: corta o download.
      if (res.headersSent) {
        console.error('[pacote]', err);
        res.destroy(err);
        return;
      }
      res.removeHeader('Content-Disposition');
      next(err);
    }
  });

  /* -------------------------------------------------------------- anexos */

  app.post('/api/anexos', exigir('dono'), express.raw({ type: TIPOS_ANEXO, limit: '10mb' }), rota(async (req, res) => {
    const tipo = Object.prototype.hasOwnProperty.call(DONOS_ANEXO, req.query.tipo) ? req.query.tipo : 'contrato';
    const donoId = Number(req.query.id);
    const dono = await banco.query(`select id from ${DONOS_ANEXO[tipo].tabela} where parque_id = $1 and id = $2`, [req.usuario.parqueId, donoId]);
    if (!dono.rows[0]) throw new A.ErroUsuario(`${DONOS_ANEXO[tipo].nome.replace(/^./, c => c.toUpperCase())} não encontrado.`, 404);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new A.ErroUsuario('O arquivo chegou vazio. Tente de novo.');
    const mime = req.headers['content-type'].split(';')[0];
    if (mime.endsWith('/xml') && !/^\s*(\uFEFF)?\s*</.test(req.body.subarray(0, 200).toString('utf8'))) {
      throw new A.ErroUsuario('Esse arquivo não parece um XML de nota fiscal.');
    }
    let nome = 'arquivo';
    try { nome = decodeURIComponent(String(req.headers['x-arquivo-nome'])); } catch (_) { nome = 'arquivo'; }
    nome = nome.replace(/[\\/:*?"<>|\r\n]/g, '').trim().slice(0, 120) || 'arquivo';
    const anexo = await inserir(banco, 'anexos', {
      parque_id: req.usuario.parqueId, dono_tipo: tipo, dono_id: donoId, nome, mime,
      tamanho: req.body.length, conteudo: req.body, enviado_por: req.usuario.nome, criado_em: agora()
    });
    await registrar(req, 'anexo', `Anexou "${nome}" ${tipo === 'conta' ? 'à despesa' : `ao ${DONOS_ANEXO[tipo].nome}`}.`);
    res.json({ ok: true, anexo: { id: anexo.id, nome } });
  }));

  app.get('/api/anexos/:id', exigir('dono'), rota(async (req, res) => {
    const q = await banco.query('select nome, mime, conteudo from anexos where parque_id = $1 and id = $2', [req.usuario.parqueId, Number(req.params.id)]);
    const a = q.rows[0];
    if (!a) throw new A.ErroUsuario('Arquivo não encontrado.', 404);
    // PDF e imagem abrem direto no navegador. XML sempre baixa, isolado: um XML aberto
    // como página poderia executar código no endereço do sistema.
    const xml = a.mime.endsWith('/xml');
    if (xml) res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    else res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Content-Disposition', `${req.query.baixar || xml ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.nome)}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(a.conteudo);
  }));

  app.delete('/api/anexos/:id', exigir('dono'), rota(async (req, res) => {
    const q = await banco.query('delete from anexos where parque_id = $1 and id = $2 returning nome, dono_tipo', [req.usuario.parqueId, Number(req.params.id)]);
    if (!q.rows[0]) throw new A.ErroUsuario('Arquivo não encontrado.', 404);
    await registrar(req, 'anexo', `Removeu o arquivo "${q.rows[0].nome}".`);
    res.json({ ok: true });
  }));

  /* -------------------------------------------------------------- equipe */

  app.get('/api/equipe', exigir('dono'), rota(async (req, res) => {
    const pessoas = await acessos.usuarios.listar(req.usuario.parqueId);
    res.json({
      pessoas: pessoas.map(u => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel].nome, ativo: u.ativo, demo: u.demo, ultimoAcesso: u.ultimoAcesso, eu: u.id === req.usuario.id })),
      papeis: PAPEIS,
      atividade: await acessos.historico.listar(req.usuario.parqueId, 80)
    });
  }));

  app.post('/api/equipe', exigir('dono'), rota(async (req, res) => {
    const pessoa = lerPessoa(req.body);
    if (!papelValido(req.body.papel)) throw new A.ErroUsuario('Escolha o perfil de acesso.');
    A.validarSenhaNova(req.body.senha);
    const u = await acessos.usuarios.criar({ parqueId: req.usuario.parqueId, ...pessoa, papel: req.body.papel, senhaHash: A.hashSenha(req.body.senha) });
    await registrar(req, 'equipe', `Cadastrou ${u.nome} no perfil ${PAPEIS[u.papel].nome}.`);
    res.json({ ok: true });
  }));

  app.patch('/api/equipe/:id', exigir('dono'), rota(async (req, res) => {
    const alvo = await acessos.usuarios.porId(Number(req.params.id));
    if (!alvo || alvo.parqueId !== req.usuario.parqueId) throw new A.ErroUsuario('Pessoa não encontrada.', 404);
    const corpo = req.body || {};
    const campos = {};
    const feito = [];
    if (corpo.papel !== undefined && corpo.papel !== alvo.papel) {
      if (!papelValido(corpo.papel)) throw new A.ErroUsuario('Perfil inválido.');
      campos.papel = corpo.papel;
      feito.push(`Mudou ${alvo.nome} para o perfil ${PAPEIS[corpo.papel].nome}.`);
    }
    if (corpo.ativo !== undefined && !!corpo.ativo !== alvo.ativo) {
      campos.ativo = !!corpo.ativo;
      feito.push(`${campos.ativo ? 'Reativou' : 'Desativou'} o acesso de ${alvo.nome}.`);
    }
    if (corpo.senha !== undefined) {
      if (alvo.demo) throw new A.ErroUsuario('Os acessos de demonstração usam a senha padrão.');
      A.validarSenhaNova(corpo.senha);
      campos.senhaHash = A.hashSenha(corpo.senha);
      feito.push(`Definiu uma nova senha para ${alvo.nome}.`);
    }
    const eu = alvo.id === req.usuario.id;
    const perdeGestao = campos.ativo === false || (campos.papel && campos.papel !== 'dono');
    if (eu && perdeGestao) throw new A.ErroUsuario('Você não pode desativar o próprio acesso nem sair da gestão.');
    if (alvo.papel === 'dono' && perdeGestao) {
      const gestores = (await acessos.usuarios.listar(req.usuario.parqueId)).filter(u => u.ativo && u.papel === 'dono');
      if (gestores.length <= 1) throw new A.ErroUsuario('O complexo precisa de pelo menos uma pessoa na gestão.');
    }
    if (!feito.length) return res.json({ ok: true });
    await acessos.usuarios.atualizar(alvo.id, campos);
    // Desativou ou trocou a senha: os aparelhos onde a pessoa estava conectada saem na hora.
    if (campos.ativo === false || campos.senhaHash) await acessos.sessoes.apagarDoUsuario(alvo.id, eu ? req.tokenHash : '');
    for (const resumo of feito) await registrar(req, 'equipe', resumo);
    res.json({ ok: true });
  }));

  app.post('/api/minha-senha', exigir(), rota(async (req, res) => {
    const u = await acessos.usuarios.porId(req.usuario.id);
    if (u.demo) throw new A.ErroUsuario('Os acessos de demonstração usam a senha padrão.');
    if (!A.senhaConfere(String((req.body && req.body.atual) || ''), u.senhaHash)) throw new A.ErroUsuario('A senha atual não confere.');
    A.validarSenhaNova(req.body.nova);
    await acessos.usuarios.atualizar(u.id, { senhaHash: A.hashSenha(req.body.nova) });
    await acessos.sessoes.apagarDoUsuario(u.id, req.tokenHash);
    await registrar(req, 'equipe', 'Trocou a própria senha.');
    res.json({ ok: true });
  }));

  /* ---------------------------------------------------- demonstração */

  /**
   * Fim da demonstração: apaga os dados fictícios, cria o acesso da proprietária
   * (quando ela estava no acesso de demonstração) e desliga os acessos de demonstração.
   */
  app.post('/api/operacao-real', exigir('dono'), rota(async (req, res) => {
    const parqueId = req.usuario.parqueId;
    const p = await acessos.parques.ler(parqueId);
    if (p.modo !== 'demo') throw new A.ErroUsuario('Este complexo já está em operação real.');
    const complexo = lerComplexo(req.body && req.body.parque);
    let usuario = req.usuario;
    if (req.usuario.demo) {
      const dono = lerPessoa(req.body && req.body.dono);
      A.validarSenhaNova(req.body.dono.senha);
      usuario = await acessos.usuarios.criar({ parqueId, ...dono, papel: 'dono', senhaHash: A.hashSenha(req.body.dono.senha) });
    }
    await banco.transacao(async tx => {
      await tx.query('select id from parques where id = $1 for update', [parqueId]);
      await demo.apagarOperacao(tx, parqueId);
      const config = Object.assign({}, PADRAO, { cidade: complexo.cidade });
      await tx.query("update parques set nome = $2, config = $3, modo = 'real', demo_dia = null where id = $1", [parqueId, complexo.nome, JSON.stringify(config)]);
    });
    await acessos.usuarios.desativarDemos(parqueId);
    await acessos.historico.registrar(parqueId, { usuarioId: usuario.id, usuarioNome: usuario.nome, acao: 'operacao-real', resumo: `Apagou a demonstração e começou a operação real do ${complexo.nome}.` });
    if (usuario !== req.usuario) {
      await acessos.sessoes.apagar(req.tokenHash);
      await abrirSessao(req, res, usuario);
    }
    res.json({ usuario: perfil(usuario) });
  }));

  /** Carrega a demonstração num complexo real que ainda não tem movimento nenhum. */
  app.post('/api/carregar-demo', exigir('dono'), rota(async (req, res) => {
    const parqueId = req.usuario.parqueId;
    const mov = await banco.query('select (select count(*) from movimentos where parque_id = $1)::int + (select count(*) from contratos where parque_id = $1)::int as n', [parqueId]);
    if (mov.rows[0].n > 0) throw new A.ErroUsuario('Este complexo já tem movimento real. A demonstração apagaria esses dados.');
    await demo.recriarDemo(banco, { parqueId, agora: agora() });
    await registrar(req, 'demo', 'Carregou os dados de demonstração.');
    res.json({ ok: true });
  }));

  /* ------------------------------------------------------------ arquivos */

  app.use(express.static(publico, { index: 'index.html', setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }));
  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publico, 'index.html')));

  app.use((err, req, res, _next) => {
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ erro: 'Arquivo grande demais. O limite é 10 MB.' });
    if (err instanceof A.ErroUsuario || (err && err.usuario)) return res.status(err.status || 400).json({ erro: err.message });
    console.error('[erro]', req.method, req.originalUrl, err);
    res.status(500).json({ erro: 'Algo deu errado no servidor. Tente de novo e, se continuar, avise a AYVO.' });
  });

  return { app, acessos };
}

module.exports = { criarApp };

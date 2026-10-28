'use strict';

const path = require('path');
const express = require('express');
const L = require('./dominio/ledger');
const { ACOES } = require('./dominio/acoes');
const { construirVisao, precisaPreparar, preparar } = require('./dominio/visao');
const { PAPEIS, papelValido } = require('./dominio/permissoes');
const A = require('./acesso');

const HASH_FALSO = A.hashSenha('senha-que-ninguem-usa');

const rota = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function lerPessoa(d) {
  const nome = String((d && d.nome) || '').trim();
  const email = String((d && d.email) || '').trim().toLowerCase();
  if (nome.length < 2) throw new A.ErroUsuario('Informe o nome da pessoa.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new A.ErroUsuario('Informe um e-mail válido.');
  return { nome, email };
}

function lerParqueNovo(p) {
  p = p || {};
  const parque = {
    nome: String(p.nome || '').trim(),
    cidade: String(p.cidade || '').trim(),
    cnpj: String(p.cnpj || '').trim(),
    boxes: Math.floor(Number(p.boxes) || 8),
    taxa: p.taxa === '' || p.taxa == null ? 10 : Number(p.taxa)
  };
  if (parque.nome.length < 2) throw new A.ErroUsuario('Informe o nome do food park.');
  if (!(parque.boxes >= 1 && parque.boxes <= 60)) throw new A.ErroUsuario('O food park precisa ter entre 1 e 60 boxes.');
  if (!(parque.taxa >= 0 && parque.taxa <= 100)) throw new A.ErroUsuario('A taxa de administração precisa ficar entre 0 e 100%.');
  return parque;
}

function estadoVazio(parque) {
  const estado = L.blank({ name: parque.nome, city: parque.cidade, cnpj: parque.cnpj, boxes: parque.boxes, adminFeePercent: parque.taxa });
  estado.mode = 'real';
  return estado;
}

/** Erros do livro contábil são mensagens para a pessoa ("Abra o caixa..."), não falhas do servidor. */
function executarAcao(acao, estado, dados, ctx) {
  try {
    return acao.executar(estado, dados, ctx);
  } catch (err) {
    if (err instanceof A.ErroUsuario) throw err;
    if (err && err.constructor === Error) throw new A.ErroUsuario(err.message);
    throw err;
  }
}

function criarApp({ cfg, repo, agora }) {
  const app = express();
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
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '));
    next();
  });
  app.use(express.json({ limit: '200kb' }));

  // Pedido que altera dados precisa vir desta mesma origem e em JSON (proteção contra CSRF).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origem = req.headers.origin;
    if (origem) {
      let host = '';
      try { host = new URL(origem).host; } catch (_) { host = ''; }
      if (host !== req.headers.host) return res.status(403).json({ erro: 'Origem não permitida.' });
    }
    if (!req.is('application/json')) return res.status(415).json({ erro: 'Envie os dados em JSON.' });
    next();
  });

  app.use('/api', rota(async (req, _res, next) => {
    const token = A.lerCookie(req, A.COOKIE);
    if (token) {
      req.tokenHash = A.hashToken(token);
      req.usuario = await repo.sessoes.buscar(req.tokenHash);
    }
    next();
  }));

  const exigir = (...papeis) => (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Sua sessão terminou. Entre novamente para continuar.', codigo: 'LOGIN' });
    if (papeis.length && !papeis.includes(req.usuario.papel)) return res.status(403).json({ erro: 'Seu perfil não tem acesso a esta área.' });
    next();
  };

  const perfil = u => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    papelNome: PAPEIS[u.papel].nome,
    demo: !!u.demo,
    telas: PAPEIS[u.papel].telas,
    inicio: PAPEIS[u.papel].inicio
  });

  async function abrirSessao(req, res, usuario) {
    const token = A.novoToken();
    await repo.sessoes.criar(A.hashToken(token), usuario.id, new Date(Date.now() + A.DURACAO_SESSAO_MS));
    await repo.usuarios.registrarAcesso(usuario.id);
    res.setHeader('Set-Cookie', A.cookieDeSessao(req, token, A.DURACAO_SESSAO_MS));
  }

  const registrar = (req, acao, resumo) => repo.historico.registrar(req.usuario.parqueId, {
    usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao, resumo
  });

  /** Estado pronto para exibir: demonstração do dia gerada e aluguel do mês lançado. */
  async function estadoPronto(parqueId) {
    const lido = await repo.lerParque(parqueId);
    const ts = agora();
    if (!precisaPreparar(lido.estado, ts)) return lido.estado;
    return repo.comParque(parqueId, estado => {
      if (!precisaPreparar(estado, ts)) return { resultado: estado };
      const p = preparar(estado, ts);
      return { estado: p.estado, historico: { acao: 'sistema', resumo: p.resumo, usuarioNome: 'Sistema' }, resultado: p.estado };
    });
  }

  /* ------------------------------------------------------------ público */

  app.get('/api/saude', rota(async (_req, res) => {
    await repo.saudavel();
    res.json({ ok: true, banco: repo.modo });
  }));

  app.get('/api/publico', rota(async (_req, res) => {
    const parque = await repo.primeiroParque();
    let demo = null;
    if (parque) {
      const lido = await repo.lerParque(parque.id);
      const perfis = lido.estado.mode === 'demo' ? await repo.usuarios.demos(parque.id) : [];
      if (perfis.length) {
        demo = {
          senha: cfg.senhaDemo,
          perfis: perfis.map(u => ({ email: u.email, nome: u.nome, papel: u.papel, papelNome: PAPEIS[u.papel].nome, descricao: PAPEIS[u.papel].descricao }))
        };
      }
    }
    res.json({
      instalado: !!parque,
      nomeParque: parque ? parque.nome : '',
      exigeCodigo: !!cfg.codigoInstalacao,
      semBanco: repo.modo === 'memoria',
      demo
    });
  }));

  app.post('/api/entrar', rota(async (req, res) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const senha = String((req.body && req.body.senha) || '');
    if (!email || !senha) throw new A.ErroUsuario('Informe e-mail e senha.');
    const chave = `${req.ip}|${email}`;
    if (freioLogin.bloqueado(chave)) throw new A.ErroUsuario('Muitas tentativas seguidas. Espere 15 minutos e tente de novo.', 429);
    const usuario = await repo.usuarios.porEmail(email);
    // Confere a senha mesmo sem usuário, para a resposta não revelar quais e-mails existem.
    const confere = A.senhaConfere(senha, usuario ? usuario.senhaHash : HASH_FALSO);
    if (!usuario || !usuario.ativo || !confere) {
      freioLogin.falhou(chave);
      throw new A.ErroUsuario('E-mail ou senha não conferem. Confira e tente de novo.');
    }
    freioLogin.limpar(chave);
    // A entrada fica no "último acesso" da pessoa; o histórico guarda só o que muda o food park.
    await abrirSessao(req, res, usuario);
    res.json({ usuario: perfil(usuario) });
  }));

  app.post('/api/sair', rota(async (req, res) => {
    if (req.tokenHash) await repo.sessoes.apagar(req.tokenHash);
    res.setHeader('Set-Cookie', `${A.COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  }));

  app.post('/api/instalar', rota(async (req, res) => {
    if (await repo.primeiroParque()) throw new A.ErroUsuario('Este sistema já foi instalado. Entre com seu e-mail e senha.', 409);
    if (freioInstalacao.bloqueado(req.ip)) throw new A.ErroUsuario('Muitas tentativas seguidas. Espere 15 minutos.', 429);
    if (cfg.codigoInstalacao && String((req.body && req.body.codigo) || '').trim() !== cfg.codigoInstalacao) {
      freioInstalacao.falhou(req.ip);
      throw new A.ErroUsuario('Código de instalação incorreto. Peça o código à AYVO.', 403);
    }
    const parque = lerParqueNovo(req.body && req.body.parque);
    const dono = lerPessoa(req.body && req.body.dono);
    A.validarSenhaNova(req.body.dono.senha);
    const id = await repo.criarParque(estadoVazio(parque));
    const usuario = await repo.usuarios.criar({ parqueId: id, ...dono, papel: 'dono', senhaHash: A.hashSenha(req.body.dono.senha) });
    await repo.historico.registrar(id, { usuarioId: usuario.id, usuarioNome: usuario.nome, acao: 'instalacao', resumo: `Instalou o food park ${parque.nome}.` });
    await abrirSessao(req, res, usuario);
    res.json({ usuario: perfil(usuario) });
  }));

  /* ---------------------------------------------------------- com login */

  // Sem login responde 200 com usuario nulo: é o estado normal da tela de entrada, não um erro.
  app.get('/api/sessao', rota(async (req, res) => {
    if (!req.usuario) return res.json({ usuario: null });
    const lido = await repo.lerParque(req.usuario.parqueId);
    res.json({
      usuario: perfil(req.usuario),
      parque: { nome: lido.estado.park.name, modo: lido.estado.mode },
      semBanco: repo.modo === 'memoria'
    });
  }));

  app.get('/api/visao', exigir(), rota(async (req, res) => {
    const estado = await estadoPronto(req.usuario.parqueId);
    res.json(construirVisao(estado, { agora: agora(), mes: req.query.mes, papel: req.usuario.papel }));
  }));

  app.post('/api/acao/:nome', exigir(), rota(async (req, res) => {
    const nome = req.params.nome;
    const acao = Object.prototype.hasOwnProperty.call(ACOES, nome) ? ACOES[nome] : null;
    if (!acao) throw new A.ErroUsuario('Ação desconhecida.', 404);
    if (!acao.papeis.includes(req.usuario.papel)) throw new A.ErroUsuario('Seu perfil não pode fazer isso. Fale com a gestão do food park.', 403);
    const ts = agora();
    const saida = await repo.comParque(req.usuario.parqueId, atual => {
      const base = precisaPreparar(atual, ts) ? preparar(atual, ts).estado : atual;
      const r = executarAcao(acao, base, req.body || {}, { agora: ts, usuario: req.usuario });
      // Última barreira: nada que desequilibre débitos e créditos chega ao banco.
      if (!L.booksBalanced(r.estado)) throw new Error(`Ação ${nome} gerou lançamentos desbalanceados.`);
      return {
        estado: r.estado,
        historico: { usuarioId: req.usuario.id, usuarioNome: req.usuario.nome, acao: nome, resumo: r.resumo },
        resultado: { estado: r.estado, resultado: r.resultado || null }
      };
    });
    res.json({
      ok: true,
      resultado: saida.resultado,
      visao: construirVisao(saida.estado, { agora: ts, mes: req.query.mes, papel: req.usuario.papel })
    });
  }));

  app.get('/api/exportar/:arquivo', exigir('dono'), rota(async (req, res) => {
    const arquivo = req.params.arquivo;
    if (!['vendas', 'lancamentos', 'dre', 'repasses'].includes(arquivo)) throw new A.ErroUsuario('Arquivo desconhecido.', 404);
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : L.ymOf(agora());
    const lido = await repo.lerParque(req.usuario.parqueId);
    const pacote = L.exportBundle(lido.estado, mes);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="foodpark-${arquivo}-${mes}.csv"`);
    res.send('﻿' + pacote[arquivo]);
  }));

  /* -------------------------------------------------------------- equipe */

  app.get('/api/equipe', exigir('dono'), rota(async (req, res) => {
    const pessoas = await repo.usuarios.listar(req.usuario.parqueId);
    const atividade = await repo.historico.listar(req.usuario.parqueId, 60);
    res.json({
      pessoas: pessoas.map(u => ({
        id: u.id, nome: u.nome, email: u.email, papel: u.papel, papelNome: PAPEIS[u.papel].nome,
        ativo: u.ativo, demo: u.demo, ultimoAcesso: u.ultimoAcesso, eu: u.id === req.usuario.id
      })),
      papeis: PAPEIS,
      atividade
    });
  }));

  app.post('/api/equipe', exigir('dono'), rota(async (req, res) => {
    const pessoa = lerPessoa(req.body);
    const papel = req.body.papel;
    if (!papelValido(papel)) throw new A.ErroUsuario('Escolha o perfil de acesso.');
    A.validarSenhaNova(req.body.senha);
    const u = await repo.usuarios.criar({ parqueId: req.usuario.parqueId, ...pessoa, papel, senhaHash: A.hashSenha(req.body.senha) });
    await registrar(req, 'equipe', `Cadastrou ${u.nome} no perfil ${PAPEIS[papel].nome}.`);
    res.json({ ok: true });
  }));

  app.patch('/api/equipe/:id', exigir('dono'), rota(async (req, res) => {
    const alvo = await repo.usuarios.porId(Number(req.params.id));
    if (!alvo || alvo.parqueId !== req.usuario.parqueId) throw new A.ErroUsuario('Pessoa não encontrada.', 404);
    const corpo = req.body || {};
    const campos = {};
    const feito = [];
    if (corpo.nome !== undefined) { campos.nome = lerPessoa({ nome: corpo.nome, email: alvo.email }).nome; feito.push(`Atualizou o nome de ${campos.nome}.`); }
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
      const gestores = (await repo.usuarios.listar(req.usuario.parqueId)).filter(u => u.ativo && u.papel === 'dono');
      if (gestores.length <= 1) throw new A.ErroUsuario('O food park precisa de pelo menos uma pessoa na gestão.');
    }
    if (!feito.length) return res.json({ ok: true });
    await repo.usuarios.atualizar(alvo.id, campos);
    // Desativou ou trocou a senha: os aparelhos onde a pessoa estava logada saem na hora.
    if (campos.ativo === false || campos.senhaHash) await repo.sessoes.apagarDoUsuario(alvo.id, eu ? req.tokenHash : '');
    for (const resumo of feito) await registrar(req, 'equipe', resumo);
    res.json({ ok: true });
  }));

  app.post('/api/minha-senha', exigir(), rota(async (req, res) => {
    const u = await repo.usuarios.porId(req.usuario.id);
    if (u.demo) throw new A.ErroUsuario('Os acessos de demonstração usam a senha padrão.');
    if (!A.senhaConfere(String((req.body && req.body.atual) || ''), u.senhaHash)) throw new A.ErroUsuario('A senha atual não confere.');
    A.validarSenhaNova(req.body.nova);
    await repo.usuarios.atualizar(u.id, { senhaHash: A.hashSenha(req.body.nova) });
    await repo.sessoes.apagarDoUsuario(u.id, req.tokenHash);
    await registrar(req, 'equipe', 'Trocou a própria senha.');
    res.json({ ok: true });
  }));

  /**
   * Fim da demonstração: apaga os dados fictícios, cria o acesso da proprietária
   * (quando ela estava no acesso de demonstração) e desliga os acessos de demonstração.
   */
  app.post('/api/operacao-real', exigir('dono'), rota(async (req, res) => {
    const parqueId = req.usuario.parqueId;
    const lido = await repo.lerParque(parqueId);
    if (lido.estado.mode !== 'demo') throw new A.ErroUsuario('Este food park já está em operação real.');
    const parque = lerParqueNovo(req.body && req.body.parque);
    let usuario = req.usuario;
    if (req.usuario.demo) {
      const dono = lerPessoa(req.body && req.body.dono);
      A.validarSenhaNova(req.body.dono.senha);
      usuario = await repo.usuarios.criar({ parqueId, ...dono, papel: 'dono', senhaHash: A.hashSenha(req.body.dono.senha) });
    }
    await repo.comParque(parqueId, () => ({
      estado: estadoVazio(parque),
      historico: { usuarioId: usuario.id, usuarioNome: usuario.nome, acao: 'operacao-real', resumo: `Apagou a demonstração e começou a operação real de ${parque.nome}.` }
    }));
    await repo.usuarios.desativarDemos(parqueId);
    if (usuario !== req.usuario) {
      await repo.sessoes.apagar(req.tokenHash);
      await abrirSessao(req, res, usuario);
    }
    res.json({ usuario: perfil(usuario) });
  }));

  /* ------------------------------------------------------------- arquivos */

  app.get('/js/ledger.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'dominio', 'ledger.js'));
  });
  app.use(express.static(publico, {
    index: 'index.html',
    setHeaders: res => res.setHeader('Cache-Control', 'no-cache')
  }));
  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publico, 'index.html')));

  app.use((err, req, res, _next) => {
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados inválidos.' });
    if (err instanceof A.ErroUsuario || (err && err.usuario)) return res.status(err.status || 400).json({ erro: err.message });
    console.error('[erro]', req.method, req.originalUrl, err);
    res.status(500).json({ erro: 'Algo deu errado no servidor. Tente de novo e, se continuar, avise a AYVO.' });
  });

  return app;
}

module.exports = { criarApp };

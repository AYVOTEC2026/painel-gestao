'use strict';

const crypto = require('crypto');

const COOKIE = 'fp_sessao';
const DURACAO_SESSAO_MS = 14 * 24 * 60 * 60 * 1000;

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const chave = crypto.scryptSync(String(senha), sal, 64);
  return `scrypt$${sal.toString('hex')}$${chave.toString('hex')}`;
}

function senhaConfere(senha, guardado) {
  const [tipo, salHex, chaveHex] = String(guardado || '').split('$');
  if (tipo !== 'scrypt' || !salHex || !chaveHex) return false;
  const esperado = Buffer.from(chaveHex, 'hex');
  const calculado = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

function validarSenhaNova(senha) {
  if (String(senha || '').length < 6) throw new ErroUsuario('A senha precisa ter pelo menos 6 caracteres.');
}

function novoToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return '';
}

function cookieDeSessao(req, token, maxAgeMs) {
  const partes = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (req.secure) partes.push('Secure');
  return partes.join('; ');
}

/** Erro que a pessoa entende e consegue corrigir: vira resposta 400 com a mensagem. */
class ErroUsuario extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

/**
 * Freio simples de tentativas de login por IP + e-mail, em memória.
 * Basta para um protótipo de uma instância; em produção com várias réplicas, mover para o banco.
 */
class Freio {
  constructor(limite, janelaMs) {
    this.limite = limite;
    this.janelaMs = janelaMs;
    this.contagem = new Map();
  }
  bloqueado(chave) {
    const item = this.contagem.get(chave);
    if (!item) return false;
    if (Date.now() > item.ate) { this.contagem.delete(chave); return false; }
    return item.n >= this.limite;
  }
  falhou(chave) {
    const item = this.contagem.get(chave);
    if (!item || Date.now() > item.ate) this.contagem.set(chave, { n: 1, ate: Date.now() + this.janelaMs });
    else item.n += 1;
  }
  limpar(chave) { this.contagem.delete(chave); }
}

module.exports = {
  COOKIE,
  DURACAO_SESSAO_MS,
  hashSenha,
  senhaConfere,
  validarSenhaNova,
  novoToken,
  hashToken,
  lerCookie,
  cookieDeSessao,
  ErroUsuario,
  Freio
};

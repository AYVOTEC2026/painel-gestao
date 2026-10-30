/* Mensagens do WhatsApp com o texto que a gestão escreveu em Administração, aba Mensagens. */

import { linkWhatsapp } from './ui.js';

let modelos = {};

/** Guarda os textos que chegam com a sessão. */
export const usarMensagens = textos => { modelos = textos || {}; };

export const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';

/** Troca {nome}, {valor}... pelos dados. Variável sem dado fica à vista, para quem envia perceber e completar. */
export const preencher = (texto, dados) =>
  String(texto || '').replace(/\{([^{}]+)\}/g, (marca, v) => (dados[v] != null && dados[v] !== '' ? String(dados[v]) : marca));

/** Link do WhatsApp com a mensagem já escrita, ou vazio se não houver telefone. */
export const zap = (id, fone, dados) => linkWhatsapp(fone, preencher(modelos[id], dados));

/** Conversa sem mensagem pronta: só o cumprimento. */
export const conversa = (fone, nome) => linkWhatsapp(fone, `Olá, ${primeiroNome(nome)}! `);

'use strict';

const zlib = require('node:zlib');
const { crc32 } = require('../server/zip');

/**
 * Lê um ZIP pelo diretório central, como fazem o Windows e o macOS, e confere
 * cabeçalho local, tamanho e CRC de cada arquivo. Devolve nome → { dados, metodo }.
 */
function lerZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fim < 0) throw new Error('ZIP sem o registro de fim do diretório central');
  const total = buf.readUInt16LE(fim + 10);
  const tamanhoCentral = buf.readUInt32LE(fim + 12);
  let p = buf.readUInt32LE(fim + 16);
  if (p + tamanhoCentral !== fim) throw new Error('diretório central fora do lugar');
  const arquivos = new Map();
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`entrada ${i} do diretório central inválida`);
    const flags = buf.readUInt16LE(p + 8);
    const metodo = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const comprimido = buf.readUInt32LE(p + 20);
    const tamanho = buf.readUInt32LE(p + 24);
    const nNome = buf.readUInt16LE(p + 28);
    const nExtra = buf.readUInt16LE(p + 30);
    const nComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nNome);
    if (!(flags & 0x0800)) throw new Error(`${nome}: nome sem a marca de UTF-8`);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`${nome}: cabeçalho local inválido`);
    if (buf.toString('utf8', local + 30, local + 30 + buf.readUInt16LE(local + 26)) !== nome) throw new Error(`${nome}: nome diferente no cabeçalho local`);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const bruto = buf.subarray(inicio, inicio + comprimido);
    const dados = metodo === 8 ? zlib.inflateRawSync(bruto) : metodo === 0 ? Buffer.from(bruto) : null;
    if (!dados) throw new Error(`${nome}: método ${metodo} desconhecido`);
    if (dados.length !== tamanho) throw new Error(`${nome}: tamanho ${dados.length}, esperado ${tamanho}`);
    if (crc32(dados) !== crc) throw new Error(`${nome}: CRC não confere`);
    arquivos.set(nome, { dados, metodo });
    p += 46 + nNome + nExtra + nComentario;
  }
  return arquivos;
}

module.exports = { lerZip };

'use strict';

const zlib = require('zlib');
const { once } = require('events');

/*
 * ZIP mínimo (formato PKWARE 2.0), escrito direto na resposta HTTP: um arquivo por
 * vez, sem montar o pacote inteiro na memória. Nomes em UTF-8 (bit 11), PDF e imagem
 * guardados sem compressão (já são comprimidos), texto comprimido com deflate.
 */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i += 1) c = TABELA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Data e hora no formato do MS-DOS, que o ZIP usa. */
function dataDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const data = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

const JA_COMPRIMIDOS = /\.(pdf|jpe?g|png|webp|zip)$/i;

class EscritorZip {
  constructor(saida) {
    this.saida = saida;
    this.posicao = 0;
    this.central = [];
  }

  async escrever(buf) {
    this.posicao += buf.length;
    if (!this.saida.write(buf)) await once(this.saida, 'drain');
  }

  async adicionar(nome, conteudo, quando = new Date()) {
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(String(conteudo), 'utf8');
    const comprimir = !JA_COMPRIMIDOS.test(nome) && dados.length > 64;
    const gravado = comprimir ? zlib.deflateRawSync(dados, { level: 6 }) : dados;
    const metodo = comprimir ? 8 : 0;
    const crc = crc32(dados);
    const nomeBuf = Buffer.from(nome, 'utf8');
    const { hora, data } = dataDos(quando);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(gravado.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28);

    this.central.push({ nomeBuf, metodo, hora, data, crc, comprimido: gravado.length, tamanho: dados.length, posicao: this.posicao });
    await this.escrever(Buffer.concat([local, nomeBuf]));
    await this.escrever(gravado);
  }

  async finalizar() {
    const inicio = this.posicao;
    for (const e of this.central) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(20, 4);
      c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(e.metodo, 10);
      c.writeUInt16LE(e.hora, 12);
      c.writeUInt16LE(e.data, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(e.comprimido, 20);
      c.writeUInt32LE(e.tamanho, 24);
      c.writeUInt16LE(e.nomeBuf.length, 28);
      c.writeUInt32LE(e.posicao, 42);
      await this.escrever(Buffer.concat([c, e.nomeBuf]));
    }
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(this.central.length, 8);
    fim.writeUInt16LE(this.central.length, 10);
    fim.writeUInt32LE(this.posicao - inicio, 12);
    fim.writeUInt32LE(inicio, 16);
    await this.escrever(fim);
  }
}

/** Nome de arquivo seguro em qualquer computador: sem acento, sem barra, curto. */
function nomeDeArquivo(texto, max = 90) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,()$-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim() || 'arquivo';
}

module.exports = { EscritorZip, nomeDeArquivo, crc32 };

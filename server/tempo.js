'use strict';

/**
 * Hora local do food park no formato que o livro contábil usa ("2026-10-28T14:30:05").
 * O livro recorta dia e mês direto do texto, então a hora precisa estar no fuso da casa,
 * não em UTC: uma venda às 22h em Fortaleza não pode cair no dia seguinte.
 */
function relogio(fuso) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  return function agora(data = new Date()) {
    const p = {};
    formato.formatToParts(data).forEach(parte => { p[parte.type] = parte.value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
}

module.exports = { relogio };

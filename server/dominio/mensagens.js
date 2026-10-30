'use strict';

/*
 * Mensagens prontas do WhatsApp. A gestão edita o texto em Administração; as
 * variáveis entre chaves, como {nome}, viram os dados de quem recebe na hora de
 * abrir a conversa. Só o texto editado fica salvo, então quem não mexeu recebe
 * as melhorias do texto padrão.
 */

const NOME = { nome: 'Primeiro nome de quem recebe' };

const MENSAGENS = {
  aluguel_lembrete: {
    grupo: 'Boxes',
    titulo: 'Lembrete de aluguel',
    quando: 'Botão WhatsApp do box com aluguel a vencer.',
    variaveis: { ...NOME, box: 'Número do box', mes: 'Mês do aluguel', valor: 'Valor em aberto', vencimento: 'Dia do vencimento' },
    exemplo: { nome: 'Joana', box: '03', mes: 'novembro', valor: 'R$ 2.500,00', vencimento: '10/11' },
    padrao: 'Olá, {nome}! Tudo bem? Passando para lembrar que o aluguel do box {box} de {mes}, no valor de {valor}, vence em {vencimento}. Qualquer dúvida, estamos à disposição.'
  },
  aluguel_vencido: {
    grupo: 'Boxes',
    titulo: 'Cobrança de aluguel atrasado',
    quando: 'Botão "Cobrar no WhatsApp", no box e na aba Inadimplência.',
    variaveis: { ...NOME, box: 'Número do box', cobrancas: 'O que está em aberto, com valor e vencimento', total: 'Total em atraso', dias: 'Dias de atraso da cobrança mais antiga' },
    exemplo: { nome: 'Joana', box: '03', cobrancas: 'aluguel de outubro (R$ 2.500,00, venceu em 10/10)', total: 'R$ 2.500,00', dias: '19 dias' },
    padrao: 'Olá, {nome}! Tudo bem? Consta em aberto no box {box}: {cobrancas}. Total de {total}. Pode verificar, por favor?'
  },
  contrato_renovacao: {
    grupo: 'Boxes',
    titulo: 'Renovação de contrato',
    quando: 'Botão WhatsApp do box com contrato terminando nos próximos 60 dias.',
    variaveis: { ...NOME, box: 'Número do box', fim: 'Data em que o contrato termina', dias: 'Quanto tempo falta' },
    exemplo: { nome: 'Joana', box: '03', fim: '30/11/2026', dias: '31 dias' },
    padrao: 'Olá, {nome}! O contrato do box {box} termina em {fim}. Vamos conversar sobre a renovação? Podemos marcar um horário nesta semana.'
  },
  orcamento_evento: {
    grupo: 'Eventos e festas',
    titulo: 'Lembrete de orçamento',
    quando: 'Botão WhatsApp de um evento que ainda é orçamento.',
    variaveis: { ...NOME, evento: 'Nome do evento', data: 'Data do evento', espaco: 'Espaço reservado', valor: 'Valor do orçamento', sinal: 'Sinal para garantir a data' },
    exemplo: { nome: 'Patrícia', evento: 'Aniversário da Alice', data: '22/11', espaco: 'Salão de festas', valor: 'R$ 3.200,00', sinal: 'R$ 1.000,00' },
    padrao: 'Olá, {nome}! Tudo bem? O orçamento de {evento} no dia {data}, no espaço {espaco}, ficou em {valor}. Para garantir a data, o sinal é de {sinal}. Posso confirmar a reserva?'
  },
  evento_saldo: {
    grupo: 'Eventos e festas',
    titulo: 'Lembrete do evento com saldo',
    quando: 'Botão WhatsApp de um evento confirmado que ainda tem saldo a receber.',
    variaveis: { ...NOME, evento: 'Nome do evento', data: 'Data do evento', horario: 'Horário do evento', espaco: 'Espaço reservado', saldo: 'Saldo a receber' },
    exemplo: { nome: 'Patrícia', evento: 'Aniversário da Alice', data: '22/11', horario: 'das 15:00 às 19:00', espaco: 'Salão de festas', saldo: 'R$ 2.200,00' },
    padrao: 'Olá, {nome}! Está chegando: {evento} no dia {data}, {horario}, no espaço {espaco}. Ficou um saldo de {saldo} para acertar até o dia. Qualquer ajuste, é só falar!'
  },
  evento_lembrete: {
    grupo: 'Eventos e festas',
    titulo: 'Lembrete do evento',
    quando: 'Botão WhatsApp de um evento confirmado e já quitado.',
    variaveis: { ...NOME, evento: 'Nome do evento', data: 'Data do evento', horario: 'Horário do evento', espaco: 'Espaço reservado' },
    exemplo: { nome: 'Patrícia', evento: 'Aniversário da Alice', data: '22/11', horario: 'das 15:00 às 19:00', espaco: 'Salão de festas' },
    padrao: 'Olá, {nome}! Está chegando: {evento} no dia {data}, {horario}, no espaço {espaco}. Está tudo pronto por aqui. Qualquer ajuste, é só falar!'
  },
  quadra_reserva: {
    grupo: 'Quadras',
    titulo: 'Confirmação de reserva',
    quando: 'Botão WhatsApp de uma reserva de quadra.',
    variaveis: { ...NOME, quadra: 'Nome da quadra', data: 'Dia da reserva', horario: 'Horário da reserva', valor: 'Valor da reserva' },
    exemplo: { nome: 'Marcos', quadra: 'Quadra 1', data: 'sábado, 31/10', horario: '18:00 às 19:00', valor: 'R$ 120,00' },
    padrao: 'Olá, {nome}! Confirmando sua reserva da {quadra} em {data}, das {horario}. Valor: {valor}. Até lá!'
  },
  parque_tempo: {
    grupo: 'Parque infantil',
    titulo: 'Aviso do fim do tempo',
    quando: 'Ícone do WhatsApp no cartão da criança, no parque.',
    variaveis: { ...NOME, crianca: 'Primeiro nome da criança', termina: 'Hora em que o tempo acaba', pulseira: 'Tempo da pulseira' },
    exemplo: { nome: 'Mariana', crianca: 'Theo', termina: '16:40', pulseira: '1 hora' },
    padrao: 'Olá, {nome}! Aqui é do parque infantil. O tempo de {crianca} termina às {termina}. Pode vir buscar ou renovar a pulseira na recepção.'
  },
  item_devolucao: {
    grupo: 'Aluguel de equipamentos',
    titulo: 'Devolução de item alugado',
    quando: 'Botão WhatsApp de um item alugado que ainda não voltou.',
    variaveis: { ...NOME, item: 'Item e quantidade', saiu: 'Hora em que o item saiu', ate: 'Hora combinada para devolver' },
    exemplo: { nome: 'Leandro', item: '2 raquetes de beach tennis', saiu: '15:10', ate: '17:10' },
    padrao: 'Olá, {nome}! O aluguel de {item} terminou às {ate}. Pode devolver na recepção, por favor? Obrigado!'
  }
};

/** Só os textos editados, e só de mensagens que existem. */
function editadas(salvas) {
  const s = salvas && typeof salvas === 'object' ? salvas : {};
  return Object.fromEntries(Object.keys(MENSAGENS).filter(id => typeof s[id] === 'string' && s[id].trim()).map(id => [id, s[id]]));
}

/** Texto de cada mensagem: o editado pela gestão ou o padrão. */
const textos = config => Object.fromEntries(Object.entries(MENSAGENS).map(([id, m]) => [id, (config.mensagens || {})[id] || m.padrao]));

/** Variáveis escritas no texto que a mensagem não conhece, como {nmoe}. */
const variaveisDesconhecidas = (id, texto) =>
  [...new Set([...String(texto).matchAll(/\{([^{}]*)\}/g)].map(m => m[1]))].filter(v => !MENSAGENS[id].variaveis[v]);

module.exports = { MENSAGENS, editadas, textos, variaveisDesconhecidas };

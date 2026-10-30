/* Textos de ajuda. Escritos para quem trabalha no complexo, não para quem programa. */

export const GLOSSARIO = [
  ['Box', 'Contêiner, loja ou quiosque que o complexo aluga para outra empresa (pizzaria, açaí, hamburgueria).'],
  ['Locatário', 'A empresa que aluga um box. Vende os próprios produtos, no próprio caixa.'],
  ['Contrato de locação', 'O acordo com o locatário: valor do aluguel, dia de vencimento, prazo, caução e reajuste. O arquivo assinado fica anexado no box.'],
  ['Aluguel do mês', 'Cobrança lançada sozinha todo mês para cada contrato ativo, com o vencimento no dia combinado.'],
  ['Inadimplência', 'Aluguel ou cobrança que passou do vencimento sem pagamento. O sistema conta os dias de atraso.'],
  ['Caução', 'Valor que o locatário deixa como garantia no início do contrato e recebe de volta no fim, se estiver tudo certo.'],
  ['Cobrança avulsa', 'Valor extra cobrado de um locatário: energia do medidor, água, conserto. Entra junto com os aluguéis.'],
  ['Pulseira', 'O ingresso do parque infantil. Ao vender, a criança é cadastrada e o tempo começa a contar na entrega.'],
  ['Tempo excedente', 'Quando a criança passa do tempo da pulseira. Depois da tolerância, cada bloco de minutos começado é cobrado na saída.'],
  ['Day use', 'Ingresso para passar o dia no complexo. É vendido no PDV, como os produtos da loja.'],
  ['Grupo fixo', 'Reserva de quadra que se repete toda semana no mesmo horário, como uma turma ou uma pelada.'],
  ['Sinal', 'Primeiro pagamento de um evento. Ao receber o sinal, o evento passa de orçamento para confirmado.'],
  ['Fundo de troco', 'Dinheiro que fica na gaveta ao abrir o caixa, para dar troco.'],
  ['Sangria', 'Retirada de dinheiro da gaveta durante o dia, para não acumular valor no caixa.'],
  ['Fechamento do caixa', 'Conferência do fim do dia: o sistema mostra quanto deveria haver em cada forma de pagamento e você informa o que contou.'],
  ['Quebra de caixa', 'Diferença entre o que o sistema esperava e o que foi contado no fechamento.'],
  ['Receita', 'Tudo o que o complexo ganha: aluguéis, pulseiras, loja, day use, quadras, eventos.'],
  ['Despesa', 'Tudo o que o complexo gasta: energia, água, folha, manutenção, compras, taxas de cartão.'],
  ['Resultado', 'Receitas menos despesas. É o lucro (ou prejuízo) do mês.'],
  ['Competência', 'O mês a que um valor pertence, mesmo que seja pago depois. O aluguel de outubro é de outubro, ainda que pago em novembro.']
];

export const ROTINA_DIA = [
  ['Abra o caixa', 'No PDV, informe o troco que ficou na gaveta.'],
  ['Venda pulseiras no parque', 'Cadastre a criança e o responsável. O tempo começa a contar na entrega da pulseira.'],
  ['Venda na loja e na bilheteria', 'No PDV: raquetes, bolas, bebidas e day use.'],
  ['Receba as reservas de quadra', 'Na agenda das quadras, toque na reserva e registre o pagamento.'],
  ['Registre a saída das crianças', 'Se passou do tempo, o sistema calcula o excedente.'],
  ['Feche o caixa', 'Conte o dinheiro e confira a maquininha. Diferenças ficam registradas.']
];

export const ROTINA_MES = [
  ['Acompanhe os aluguéis', 'Em Boxes, aba Cobranças: quem pagou e quem está em atraso. Cobre pelo WhatsApp direto do sistema.'],
  ['Lance as despesas', 'Em Financeiro: energia, água, folha, manutenção. Marque como paga quando pagar.'],
  ['Confira o resultado', 'Em Contabilidade: quanto entrou, quanto saiu e o lucro de cada área.'],
  ['Envie os arquivos ao contador', 'Em Contabilidade, aba Para o contador: quatro planilhas do mês.']
];

export const PERGUNTAS = [
  ['Vendi uma pulseira errada. Como corrijo?', 'No parque, toque na criança e use "Cancelar pulseira" com o motivo. O valor é devolvido pela mesma forma de pagamento e o cancelamento fica registrado com o seu nome.'],
  ['A criança passou do tempo. Quanto cobrar?', 'O sistema calcula sozinho na saída: depois da tolerância, cobra cada bloco de minutos começado, pelo valor configurado em Administração. Se quiser liberar sem cobrar, desmarque a cobrança na saída.'],
  ['Registrei uma venda errada no PDV.', 'Em "Movimento deste caixa", toque em Cancelar ao lado da venda e escreva o motivo. O estoque volta e o valor é estornado.'],
  ['Como sei quem está devendo aluguel?', 'No Painel aparece o aviso de aluguel vencido. Em Boxes, a aba Inadimplência mostra cada locatário, quanto deve e há quantos dias, com um botão para cobrar pelo WhatsApp.'],
  ['Onde guardo o contrato assinado?', 'Em Boxes, toque no box e use "Anexar arquivo". Aceita PDF ou foto (até 10 MB). O arquivo fica no sistema, junto do contrato.'],
  ['Como funciona o grupo fixo da quadra?', 'Ao reservar, escolha repetir toda semana. O sistema cria todas as datas de uma vez e avisa se algum horário já estiver ocupado.'],
  ['Por que um evento virou "confirmado" sozinho?', 'Porque recebeu o primeiro pagamento (o sinal). Depois da festa, marque como realizado; o saldo que faltar continua aparecendo para receber.'],
  ['Os dados ficam salvos onde?', 'Num banco de dados no servidor, não no aparelho. Dá para entrar de qualquer computador ou celular e ver as mesmas informações.']
];

const lista = itens => `<ul>${itens.map(i => `<li>${i}</li>`).join('')}</ul>`;
const termos = nomes => `<dl class="glossario uma-coluna">${GLOSSARIO.filter(g => nomes.includes(g[0])).map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>`;

export const AJUDA = {
  painel: {
    titulo: 'Como ler o painel',
    html: `
      <p>O painel responde: quanto entrou hoje, o que está acontecendo agora no complexo e o que precisa de você.</p>
      ${lista([
        '<b>Entrou hoje</b> soma tudo o que foi recebido hoje em todas as áreas: pulseiras, loja, day use, quadras, aluguéis e eventos.',
        '<b>Agora no complexo</b> mostra quantas crianças estão no parque, quantas quadras estão em jogo e se o caixa está aberto.',
        '<b>Resultado do mês</b> é tudo o que o complexo ganhou no mês menos as despesas.',
        '<b>O que precisa de atenção</b> lista aluguel vencido, contrato terminando, contas a pagar, criança que passou do tempo e estoque baixo. Cada aviso leva direto ao lugar de resolver.'
      ])}
      <p>A tela se atualiza sozinha a cada meio minuto.</p>`
  },
  pdv: {
    titulo: 'Como usar o PDV',
    html: `
      <p>O PDV é o caixa da recepção: vende os produtos da loja e os ingressos da bilheteria (day use).</p>
      ${lista([
        'Toque nos itens para montar o pedido. Use + e − para ajustar a quantidade.',
        'Escolha a forma de pagamento. No dinheiro, digite quanto o cliente entregou e o sistema mostra o troco.',
        'Toque em <b>Finalizar venda</b>. O estoque baixa sozinho.',
        'Pulseira do parque? Use o botão <b>Vender pulseira</b>: ele abre o cadastro da criança.'
      ])}
      <h3>Durante e no fim do dia</h3>
      ${lista([
        '<b>Retirar dinheiro</b> (sangria) quando a gaveta acumular notas; <b>Colocar troco</b> quando faltar.',
        'Tudo o que entrou neste caixa (vendas, pulseiras, quadras) aparece em <b>Movimento deste caixa</b>.',
        '<b>Fechar o caixa</b>: o sistema mostra quanto deveria haver em cada forma de pagamento. Você digita o que contou.'
      ])}
      ${termos(['Fundo de troco', 'Sangria', 'Fechamento do caixa', 'Quebra de caixa'])}`
  },
  parque: {
    titulo: 'Como funciona o parque infantil',
    html: `
      <p>Cada pulseira vendida é uma criança cadastrada com o tempo contando a partir da entrega.</p>
      ${lista([
        '<b>Nova entrada</b>: nome e idade da criança, o responsável e o telefone, o tempo da pulseira e a forma de pagamento. Anote alergias e quem pode buscar.',
        'A lista <b>Dentro do parque</b> fica em ordem de quem sai primeiro. Laranja é tempo acabando; vermelho é tempo passado.',
        'Na <b>saída</b>, o sistema mostra quanto tempo a criança ficou e, se passou do tempo, quanto cobrar a mais.',
        'O parque não aceita mais crianças que a capacidade configurada.'
      ])}
      ${termos(['Pulseira', 'Tempo excedente'])}`
  },
  quadras: {
    titulo: 'Como funciona a agenda das quadras',
    html: `
      ${lista([
        'Cada coluna é uma quadra; cada linha, meia hora. Toque num horário livre para reservar.',
        'Toque numa reserva para receber o pagamento ou cancelar.',
        'Para turmas e peladas, marque <b>repetir toda semana</b>: o sistema cria todas as datas e avisa se houver conflito.',
        '<b>A receber</b> lista jogos que já aconteceram e não foram pagos.'
      ])}
      ${termos(['Grupo fixo'])}`
  },
  boxes: {
    titulo: 'Boxes e locações',
    html: `
      <p>Os boxes são alugados para outras empresas. O complexo recebe o aluguel; as vendas são de cada locatário.</p>
      ${lista([
        'Toque num <b>box livre</b> para fechar um contrato: empresa, valor, dia de vencimento, prazo e caução.',
        'Toque num <b>box ocupado</b> para ver o contrato, anexar o arquivo assinado, lançar uma cobrança avulsa e ver o histórico de pagamentos.',
        'O <b>aluguel de cada mês</b> é lançado sozinho, com o vencimento no dia combinado.',
        'A aba <b>Inadimplência</b> mostra quem está em atraso, há quantos dias, com um botão para cobrar pelo WhatsApp.'
      ])}
      ${termos(['Contrato de locação', 'Inadimplência', 'Caução', 'Cobrança avulsa'])}`
  },
  loja: {
    titulo: 'Loja e bilheteria',
    html: `
      ${lista([
        '<b>Produtos da loja</b>: raquetes, bolas, acessórios, bebidas. Com controle de estoque opcional e aviso de estoque mínimo.',
        '<b>Ingressos</b>: day use e outros ingressos, sem estoque.',
        '<b>Entrada de estoque</b>: quando a mercadoria chegar. Se informar o custo, ele vira uma despesa de compra no financeiro.',
        'A venda acontece no <b>PDV</b>; aqui você cuida do cadastro, dos preços e do estoque.'
      ])}`
  },
  eventos: {
    titulo: 'Eventos e festas',
    html: `
      ${lista([
        'Todo evento começa como <b>orçamento</b>: data, espaço, convidados, valor e o que está incluso.',
        'Ao receber o <b>sinal</b>, o evento passa a <b>confirmado</b> e a data fica garantida.',
        'Registre cada pagamento; o sistema mostra o saldo que falta.',
        'Depois da festa, marque como <b>realizado</b>. Se cancelar, informe quanto devolver.'
      ])}
      ${termos(['Sinal'])}`
  },
  financeiro: {
    titulo: 'Como funciona o financeiro',
    html: `
      <p>O financeiro mostra o dinheiro de verdade: o que entrou e o que saiu, de todas as áreas.</p>
      ${lista([
        '<b>Entradas</b> nascem sozinhas das vendas, pulseiras, reservas, aluguéis e eventos.',
        '<b>Despesas</b> você lança: energia, água, folha, manutenção. Pode lançar já paga ou para pagar no vencimento.',
        '<b>A receber</b> junta aluguéis em aberto, saldos de eventos e outras receitas.',
        '<b>Caixas</b> mostra cada fechamento do dia e as diferenças.'
      ])}
      ${termos(['Receita', 'Despesa', 'Competência'])}`
  },
  contabilidade: {
    titulo: 'Contabilidade',
    html: `
      ${lista([
        '<b>Resultado</b>: quanto cada área rendeu no mês, as despesas e o lucro.',
        '<b>Saldos</b>: quanto há em caixa, no banco, em cartões a receber, aluguéis a receber, contas a pagar e cauções.',
        '<b>Livro contábil</b>: cada operação gera um débito e um crédito iguais. É o que o contador confere.',
        '<b>Para o contador</b>: as planilhas do mês, prontas para enviar.'
      ])}
      ${termos(['Resultado', 'Competência'])}`
  },
  relatorios: {
    titulo: 'Relatórios',
    html: `${lista([
      'Receita de cada área mês a mês e o resultado do complexo.',
      'Parque: horários de pico, média de crianças por dia e tempo médio de permanência.',
      'Quadras: quanto de cada quadra ficou ocupado no mês.',
      'Boxes: ocupação e quanto dos aluguéis foi recebido em cada mês.'
    ])}`
  },
  admin: {
    titulo: 'Administração',
    html: `${lista([
      '<b>Complexo</b>: nome, horário de funcionamento e taxas da maquininha.',
      '<b>Equipe</b>: cada pessoa entra com o próprio e-mail e senha, em um de três perfis: Gestão, Recepção ou Monitor do parque.',
      '<b>Parque infantil</b>: tempos de pulseira, preços, capacidade e regra do tempo excedente.',
      '<b>Quadras</b> e <b>espaços de eventos</b>: cadastro e preço por hora.',
      '<b>Histórico</b>: tudo o que cada pessoa fez, com data e hora.'
    ])}`
  }
};

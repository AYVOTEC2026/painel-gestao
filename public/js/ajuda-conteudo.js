/* Textos de ajuda. Escritos para quem opera o food park, não para quem programa. */

export const GLOSSARIO = [
  ['Box', 'Cada espaço da praça onde funciona uma operação (hamburgueria, açaí, pizzaria). Tem número fixo.'],
  ['Lojista', 'A empresa ou pessoa que ocupa um box e vende os próprios produtos.'],
  ['Aluguel', 'Valor fixo por mês que o lojista paga pelo box. Vence no dia 10.'],
  ['Taxa sobre as vendas', 'Percentual de cada venda que fica com o food park. Pode ser diferente por lojista.'],
  ['Taxa da maquininha', 'O que a operadora do cartão cobra em débito e crédito. É descontada do lojista, não do food park.'],
  ['Acerto do mês (repasse)', 'A conta final com cada lojista: o food park entrega o dinheiro das vendas no Pix e cartão e desconta aluguel e taxas.'],
  ['Fundo de troco', 'Dinheiro que fica na gaveta ao abrir o caixa, para dar troco.'],
  ['Sangria', 'Retirada de dinheiro da gaveta durante o dia, para não acumular valor no caixa.'],
  ['Suprimento', 'Dinheiro colocado na gaveta durante o dia, quando o troco acaba.'],
  ['Fechamento do caixa', 'Conferência no fim do expediente: o sistema mostra o que deveria ter entrado em cada forma de pagamento e você informa o que contou.'],
  ['Quebra de caixa', 'Diferença entre o que o sistema esperava e o que foi contado no fechamento. Entra no resultado como despesa (falta) ou ajuste (sobra).'],
  ['Faturamento dos boxes', 'Tudo o que os clientes pagaram. A maior parte é dos lojistas, por isso não é receita do food park.'],
  ['Receita do food park', 'O que é de fato da administração: aluguéis, taxas sobre as vendas e outras receitas.'],
  ['Resultado', 'Receita do food park menos as despesas (energia, água, folha, manutenção). É o lucro da operação no mês.'],
  ['Competência', 'O mês a que um valor pertence, mesmo que seja pago depois. O aluguel de outubro é da competência de outubro.'],
  ['Livro contábil', 'Lista de todos os lançamentos, cada um com débito e crédito do mesmo valor. É o que o contador usa.']
];

export const ROTINA_DIA = [
  ['Abra o caixa', 'Informe quanto dinheiro de troco ficou na gaveta.'],
  ['Registre cada pedido', 'Escolha o box, toque nos itens e na forma de pagamento. A comanda mostra a divisão do valor antes de confirmar.'],
  ['Retire dinheiro quando acumular', 'Use "Retirar dinheiro" (sangria) para levar notas ao cofre. Fica registrado quem retirou e quanto.'],
  ['Feche o caixa no fim do dia', 'Conte o dinheiro e confira o relatório da maquininha. O sistema compara com as vendas e registra qualquer diferença.']
];

export const ROTINA_MES = [
  ['Receba os aluguéis', 'No dia 10, em Financeiro > Aluguéis. Quem não pagou pode ter o valor descontado no acerto.'],
  ['Lance as contas do mês', 'Energia, água, manutenção, folha. Em Financeiro > Contas, com a data de vencimento.'],
  ['Faça o acerto com cada lojista', 'Em Financeiro > Acerto com lojistas. O sistema mostra quanto pagar ou receber de cada um.'],
  ['Envie os arquivos ao contador', 'Em Financeiro > Para o contador, baixe as quatro planilhas do mês e encaminhe.']
];

export const PERGUNTAS = [
  ['Registrei uma venda errada. E agora?', 'Na tela Caixa, em "Vendas deste caixa", toque em Cancelar e escreva o motivo. O valor sai das contas e o estoque volta. O cancelamento fica registrado com o nome de quem fez. Vendas que já entraram em um acerto com o lojista não podem ser canceladas.'],
  ['Por que o faturamento dos boxes não aparece como receita do food park?', 'Porque o dinheiro das vendas é dos lojistas. O food park só fica com o aluguel e com a taxa sobre as vendas. Separar as duas coisas evita pagar imposto sobre dinheiro que não é seu.'],
  ['Quem fica com o dinheiro de cada forma de pagamento?', 'Dinheiro em espécie fica no box, com o lojista; a taxa do food park sobre essa venda fica a receber dele. Pix, débito, crédito e voucher entram na conta do food park, que repassa ao lojista no acerto do mês.'],
  ['Como cadastro um funcionário do caixa?', 'Em Equipe, toque em Adicionar pessoa e escolha o perfil Caixa. Ele só vê a tela de caixa e esta ajuda. Se a pessoa sair da empresa, desative o acesso: ela é desconectada na hora.'],
  ['Mudei o aluguel de um lojista. Quando vale?', 'A partir do próximo mês. O aluguel do mês atual já foi lançado com o valor antigo.'],
  ['O que acontece se o caixa ficar aberto de um dia para o outro?', 'Nada se perde, mas as vendas dos dois dias ficam no mesmo fechamento. O Início avisa quando isso acontece; feche o caixa e abra um novo.'],
  ['Os dados ficam salvos onde?', 'Em um banco de dados no servidor, não no aparelho. Você pode entrar de qualquer computador ou celular e ver as mesmas informações.']
];

const lista = itens => `<ul>${itens.map(i => `<li>${i}</li>`).join('')}</ul>`;
const termos = nomes => `<dl class="glossario" style="grid-template-columns:1fr">${GLOSSARIO.filter(g => nomes.includes(g[0])).map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>`;

export const AJUDA = {
  inicio: {
    titulo: 'Como ler o Início',
    html: `
      <p>O Início responde três perguntas: quanto vendemos hoje, quanto o food park ganhou no mês e o que precisa de atenção agora.</p>
      <h3>Os números de cima</h3>
      ${lista([
        '<b>Vendido hoje</b> é tudo o que os clientes pagaram nos boxes desde a abertura.',
        '<b>Taxas de hoje</b> é a parte dessas vendas que fica com o food park.',
        '<b>Resultado do mês</b> é receita do food park menos despesas. É o lucro até agora.'
      ])}
      <h3>O que precisa de atenção</h3>
      <p>Aluguel vencido, conta perto do vencimento, caixa aberto há mais de um dia, estoque acabando. Cada aviso tem um botão que leva direto ao lugar de resolver.</p>
      <p>A tela se atualiza sozinha a cada minuto, então dá para acompanhar as vendas do caixa de outro aparelho.</p>`
  },
  caixa: {
    titulo: 'Como usar o caixa',
    html: `
      <h3>Para vender</h3>
      ${lista([
        'Escolha o <b>box</b> que está vendendo.',
        'Toque nos <b>itens</b>. Cada toque soma uma unidade; use + e − na comanda para ajustar.',
        'Escolha a <b>forma de pagamento</b>. A barra colorida mostra na hora quanto fica com o lojista, com o food park e com a maquininha.',
        'Toque em <b>Finalizar venda</b>. O recibo aparece em seguida.'
      ])}
      <h3>Durante o dia</h3>
      ${lista([
        '<b>Retirar dinheiro</b> (sangria): quando a gaveta acumula notas demais.',
        '<b>Colocar troco</b> (suprimento): quando o troco acaba.',
        '<b>Cancelar</b> uma venda: em "Vendas deste caixa", com o motivo.'
      ])}
      <h3>No fim do dia</h3>
      <p>Toque em <b>Fechar o caixa</b>. Para cada forma de pagamento, o sistema mostra o valor esperado; você digita o que contou. Diferenças ficam registradas como quebra de caixa.</p>
      ${termos(['Fundo de troco', 'Sangria', 'Suprimento', 'Quebra de caixa'])}`
  },
  boxes: {
    titulo: 'Boxes e lojistas',
    html: `
      <p>Cada quadro é um box da praça. Os ocupados têm o toldo listrado; os livres aparecem tracejados.</p>
      ${lista([
        'Toque em um <b>box livre</b> para cadastrar o lojista: nome da operação, responsável, aluguel e taxa sobre as vendas.',
        'Toque em um <b>box ocupado</b> para ver o mês do lojista, editar o contrato e montar o cardápio.',
        'Itens do cardápio podem ser <b>pausados</b> quando acabam e reativados depois, sem perder o histórico.',
        'O <b>estoque</b> é opcional. Se preencher, o caixa avisa e bloqueia quando acabar.'
      ])}
      <p>O aluguel do mês é lançado automaticamente no primeiro acesso de cada mês, com vencimento no dia 10.</p>
      ${termos(['Aluguel', 'Taxa sobre as vendas'])}`
  },
  financeiro: {
    titulo: 'Como funciona o financeiro',
    html: `
      <p>Tudo aqui nasce das vendas do caixa e dos lançamentos que você faz. Não existe planilha paralela.</p>
      <h3>O caminho do dinheiro</h3>
      ${lista([
        '<b>Dinheiro em espécie</b> fica no box. O lojista fica devendo a taxa do food park sobre essa venda.',
        '<b>Pix, débito, crédito e voucher</b> entram na conta do food park. O food park fica devendo ao lojista o valor da venda, já sem a taxa e sem o custo da maquininha.',
        'No <b>acerto do mês</b>, as duas contas se compensam, junto com o aluguel em aberto. Sobra um único valor: pagar ao lojista ou receber dele.'
      ])}
      <h3>As abas</h3>
      ${lista([
        '<b>Resumo do mês</b>: receita, despesas e resultado do food park.',
        '<b>Acerto com lojistas</b>: o repasse de cada box.',
        '<b>Aluguéis</b> e <b>Contas</b>: o que receber e o que pagar.',
        '<b>Livro contábil</b> e <b>Para o contador</b>: os lançamentos e as planilhas do mês.'
      ])}
      ${termos(['Faturamento dos boxes', 'Receita do food park', 'Resultado', 'Competência'])}`
  },
  equipe: {
    titulo: 'Equipe e acessos',
    html: `
      <p>Cada pessoa entra com o próprio e-mail e senha. Assim o histórico mostra quem abriu o caixa, quem vendeu e quem cancelou.</p>
      ${lista([
        '<b>Gestão</b> vê e altera tudo: vendas, lojistas, financeiro, equipe e configurações.',
        '<b>Caixa</b> abre e fecha o caixa, registra vendas e cancela vendas do caixa aberto. Não vê o financeiro.',
        'Quando alguém sai da equipe, <b>desative o acesso</b>. A pessoa é desconectada de todos os aparelhos na hora.',
        'Esqueceu a senha? Use <b>Nova senha</b> ao lado do nome e passe a senha nova para a pessoa.'
      ])}`
  },
  config: {
    titulo: 'Configurações',
    html: `
      ${lista([
        '<b>Taxa sobre as vendas</b> é a padrão para lojistas novos. Quem já está cadastrado mantém a própria taxa, que pode ser mudada no box.',
        '<b>Taxas da maquininha</b> são as que a sua operadora cobra. Vendas já feitas continuam com a taxa da época.',
        'A <b>quantidade de boxes</b> pode aumentar a qualquer momento. Para diminuir, os boxes do fim precisam estar livres.'
      ])}`
  }
};

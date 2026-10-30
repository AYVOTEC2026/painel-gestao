# AYVO Gestão

Sistema de gestão para um complexo de lazer com food park: boxes alugados para outras empresas, parque infantil por pulseira, loja e bilheteria (day use), quadras, eventos e festas, financeiro e contabilidade. Tem banco de dados (Postgres), login por pessoa e três perfis de acesso.

## Quem usa e o que vê

| Perfil | Para quem | Telas |
|---|---|---|
| **Gestão** | Proprietária, gerente | Painel executivo, PDV, Boxes, Parque infantil, Loja e bilheteria, Quadras, Eventos e festas, Contabilidade, Financeiro, Relatórios, Administração |
| **Recepção** | Caixa da recepção | PDV, Parque infantil, Quadras |
| **Monitor do parque** | Quem cuida das crianças | Parque infantil |

As permissões são conferidas no servidor, não só escondidas na tela. Toda ação que muda o complexo (venda, pulseira, reserva, recebimento, cancelamento, contrato) fica no histórico com o nome de quem fez, em **Administração > Histórico**.

Cada tela tem um botão **Como funciona?** com a explicação daquela tela. A página **Ajuda** traz como o complexo ganha dinheiro, a rotina do dia e do mês, um glossário e perguntas frequentes.

## O que cada área faz

- **Boxes**: contêineres e quiosques alugados para outras empresas. Contrato com o arquivo assinado anexado (PDF ou foto), aluguel lançado sozinho todo mês com o vencimento combinado, cobranças avulsas (energia do medidor), caução, inadimplência com dias de atraso e cobrança pelo WhatsApp.
- **Parque infantil**: a venda da pulseira cadastra a criança e o responsável e começa a contar o tempo na entrega. A tela mostra quem precisa sair primeiro; na saída, o excedente é calculado pela regra configurada (tolerância e blocos de minutos).
- **PDV**: o caixa da recepção. Vende produtos da loja e ingressos de day use, aluga equipamentos, calcula o troco, vende pulseira pelo atalho e fecha o caixa conferindo cada forma de pagamento.
- **Loja e bilheteria**: cadastro, preços e estoque (com aviso de estoque mínimo). Cada produto é **de venda** (sai e não volta) ou **de aluguel** (sai e volta, cobrado por hora, por dia ou por uso). A entrada de mercadoria vira despesa de compra, com a nota fiscal anexada.
- **Quadras**: agenda do dia em grade, reserva por toque no horário livre, grupos fixos semanais, recebimento e a lista do que ficou a receber.
- **Eventos e festas**: orçamento, sinal que confirma a data, pagamentos, saldo, contrato anexado.
- **Financeiro**: extrato de tudo o que entrou e saiu, contas a pagar e a receber, fechamentos de caixa e as notas fiscais das despesas.
- **Contabilidade**: resultado do mês por área, saldos, livro contábil e o pacote do contador.
- **Relatórios**: resultado mês a mês, receita de cada área, horários de pico do parque, ocupação das quadras e recebimento dos aluguéis.

## Aluguel de equipamentos

Raquete, guarda-sol, cadeira e bola que saem e voltam. No cadastro, o item de aluguel tem o preço por hora, por dia ou por uso e o total de unidades que o complexo tem.

- **No PDV**, aba Aluguel: a recepção escolhe o item, o tempo (1 a 8 horas, 1 a 7 dias) e escreve quem leva, com o WhatsApp opcional. O valor sai do preço vezes unidades vezes tempo, e o sistema marca a hora de devolver: horas contadas da saída; diária até o fechamento do complexo.
- **Itens alugados fora** mostra quem está com cada item, até quando e quem passou da hora, com o botão do WhatsApp e o **Devolvido**, que libera a unidade.
- O PDV não aluga mais unidades do que estão livres. Cancelar a venda devolve à prateleira só o que ainda estava com o cliente.
- O Painel avisa os itens que passaram da hora de voltar. A receita entra numa conta própria, **Aluguel de equipamentos**, no resultado e nos relatórios.

## Mensagens do WhatsApp

Todos os botões de WhatsApp do sistema abrem a conversa com uma mensagem pronta, e a gestão escolhe o texto em **Administração > Mensagens**: lembrete e cobrança de aluguel do box, renovação de contrato, orçamento e lembrete de evento (com ou sem saldo), confirmação de reserva de quadra, aviso do fim do tempo no parque e devolução de item alugado.

Cada mensagem tem variáveis, como `{nome}`, `{valor}` e `{vencimento}`, que viram os dados da pessoa na hora de enviar. O editor mostra uma prévia com dados de exemplo e deixa testar no próprio WhatsApp. O servidor recusa variável que não existe naquela mensagem. Só o texto editado é salvo; quem não mexe continua recebendo o texto padrão atualizado. O catálogo fica em [server/dominio/mensagens.js](server/dominio/mensagens.js).

## Notas fiscais e o pacote do contador

Cada despesa guarda o documento que a comprova para o imposto de renda: nota fiscal, cupom, recibo, fatura de consumo, guia de imposto ou folha. Quando não há documento, a despesa só é aceita como "sem documento" com o motivo escrito.

- **Lançar pela nota**: ao soltar o XML de uma NF-e (produtos) ou NFS-e (serviços, padrão ABRASF ou nacional) em "Lançar despesa", o sistema preenche fornecedor, CNPJ, número, valor, vencimento e descrição. A leitura acontece no navegador ([public/js/nota-fiscal.js](public/js/nota-fiscal.js)); o arquivo vai junto como anexo.
- **Anexar depois**: na aba Financeiro → Notas fiscais, cada despesa do mês é uma linha onde se solta o PDF, a foto ou o XML. Aceita vários arquivos por despesa, até 10 MB cada.
- **Cobrança**: o Painel avisa quando há despesa sem nota, primeiro as do mês passado (o que o contador está fechando).
- **Pacote do contador**: em Contabilidade → Para o contador, um ZIP do mês com:
  - `LEIA-ME.html`: resumo para abrir no navegador, com totais por categoria, cada despesa com link para a nota, as pendências e as justificativas;
  - `despesas-AAAA-MM.csv`: fornecedor, CNPJ, tipo e número do documento, valor, pagamento e o nome de cada arquivo;
  - `notas/`: os arquivos com nome organizado (`vencimento - categoria - fornecedor - NF número`);
  - `relatorios/` (no pacote completo): livro contábil, DRE, extrato e aluguéis.

O ZIP é escrito direto na resposta, um arquivo por vez ([server/zip.js](server/zip.js)), sem dependência externa. XML anexado nunca abre como página: sempre baixa, com política de segurança isolada.

## Rodar no computador

```bash
npm install
createdb painel_gestao                     # Postgres local
DATABASE_URL=postgres://localhost/painel_gestao SEED_DEMO=true npm run dev
```

Abra http://localhost:3000. Na tela de entrada há três botões de demonstração: **Proprietária**, **Recepção** e **Monitor do parque** (senha `demo1234`). Sem `DATABASE_URL` o servidor não sobe e explica o motivo.

## Subir na VPS (Easypanel)

1. **Banco:** *+ Serviço* > **Postgres**. Copie a *URL de Conexão Interna*.
2. **App:** *+ Serviço* > **App**.
   - *Fonte*: GitHub, repositório `AYVOTEC2026/painel-gestao`, branch `feat/painel-com-banco` (ou `main` depois do merge), caminho `/`.
   - *Construção*: Dockerfile.
   - Auto Deploy ligado para cada envio republicar sozinho.
3. **Ambiente** do app:

   ```
   DATABASE_URL=<URL de Conexão Interna do passo 1>
   SEED_DEMO=true
   SENHA_DEMO=demo1234
   NOME_DEMO=Pepama
   TZ=America/Fortaleza
   ```

4. **Domínios**: destino na porta **3000**, HTTPS ligado.
5. **Implantar.** As tabelas são criadas e atualizadas sozinhas a cada subida. Para conferir: `https://<domínio>/api/saude` responde `{"ok":true,"banco":"postgres","versao":"..."}`.

Os anexos (contratos, eventos e notas fiscais) ficam no próprio Postgres; não precisa de volume.

### Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão com o Postgres (obrigatória). |
| `DATABASE_SSL=1` | Liga TLS para banco fora da VPS. O Postgres do próprio Easypanel não precisa. |
| `SEED_DEMO=true` | Banco **vazio** nasce com o complexo de demonstração e os três acessos prontos. Banco com dados não é tocado. |
| `SENHA_DEMO` | Senha dos acessos de demonstração (padrão `demo1234`). |
| `NOME_DEMO` | Nome do complexo na demonstração. Só vale quando o banco nasce; depois, troque em Administração. |
| `CODIGO_INSTALACAO` | Sem demonstração, a primeira tela é a de instalação. Com este código definido, só quem tem o código instala. |
| `TZ` | Fuso do complexo (padrão `America/Fortaleza`). Define o "hoje" das vendas, das pulseiras e da agenda. |

## Da demonstração para a operação real

A demonstração tem 10 boxes (8 alugados, um inadimplente e um contrato terminando), parque com crianças entrando e saindo, loja, quadras com grupos fixos e festas com sinal pago. Ela é recriada todo dia e o parque recebe e libera crianças sozinho, para a apresentação sempre parecer viva. Quando a cliente fechar:

1. Ela entra como **Proprietária** e clica em **Começar operação real** (na faixa do topo ou em Administração > Demonstração).
2. Informa o nome do complexo e cria o **próprio acesso**.
3. O sistema apaga os dados fictícios, desliga os acessos de demonstração e a deixa logada com a conta nova.
4. Em **Administração** ela cadastra as quadras, os tempos e preços do parque, os espaços de eventos, a equipe e o texto das mensagens do WhatsApp; em **Boxes**, os contêineres e contratos; em **Loja e bilheteria**, os produtos de venda, os itens de aluguel e o day use.

## Como o dinheiro é contabilizado

As regras ficam em [server/dominio/contabil.js](server/dominio/contabil.js), em partidas dobradas: cada operação grava débitos e créditos iguais, e o servidor recusa gravar qualquer operação que não feche.

- **Receitas por área**: aluguel dos boxes, cobranças aos locatários, multas de atraso, parque infantil, loja, aluguel de equipamentos, bilheteria e day use, quadras, eventos, outras.
- **Aluguel** é receita do mês a que pertence (competência), lançado no início do mês; o recebimento baixa o "aluguéis a receber". O que fica em aberto depois do vencimento é a inadimplência.
- **Venda no cartão** separa a taxa da maquininha como despesa; o líquido fica em "cartões a receber".
- **Caução** é dinheiro do locatário guardado pelo complexo (passivo), não receita.
- **Caixa**: o troco entra na gaveta ao abrir; no fechamento o dinheiro contado é recolhido e qualquer diferença vira quebra de caixa.

## Estrutura

```
server/
  main.js                 sobe o servidor, migra o banco, mantém a demonstração do dia
  app.js                  rotas da API, login, permissões, anexos, cabeçalhos de segurança
  acesso.js               senha (scrypt), sessão por cookie, freio de tentativas
  demo.js                 gera a demonstração em lote e simula o movimento do parque
  dominio/                regras puras: contabilidade, datas, dinheiro, parque, quadras, aluguéis, perfis
  servicos/               cada ação do sistema numa transação (caixa, parque, quadras, eventos, locações...)
  consultas/              o que cada tela recebe, as planilhas e o pacote do contador
  zip.js                  escritor de ZIP em fluxo, para o pacote do contador
  persistencia/           conexão, migrações SQL e acessos (pessoas, sessões, histórico)
public/
  index.html, css/app.css
  js/app.js               moldura, menu, rotas e atualização automática
  js/paginas/*.js         uma tela por arquivo
  js/graficos.js          colunas e barras acessíveis, com tabela dos números
  js/ajuda-conteudo.js    textos de ajuda e glossário
  js/nota-fiscal.js       lê o XML da NF-e e da NFS-e para preencher a despesa
test/                     regras puras, leitura de notas, ZIP e o roteiro completo da API no Postgres
```

## Testes

```bash
TEST_DATABASE_URL=postgres://localhost/painel_gestao_test npm test
```

Use um banco só para isso: o teste apaga e recria o banco de teste a cada execução. Sem `TEST_DATABASE_URL`, só as regras puras rodam.

## O que é protótipo e o que falta para produção

O protótipo já guarda tudo em tabelas próprias no Postgres (vendas, pulseiras, reservas, cobranças, livro contábil), com cada operação numa transação. Antes de escalar:

- **Uma instância só**: o freio de tentativas de login fica na memória do processo. Com mais de uma réplica, movê-lo para o banco.
- **Sem integração de pagamento**: Pix, cartão e boleto são registrados manualmente. Integração com maquininha, gateway, boleto automático e emissão fiscal ficam para a fase de produção.
- **Anexos no banco**: bom para contratos e notas (até 10 MB cada). Com anos de notas acumuladas, mover para um armazenamento de arquivos (S3 ou compatível) e manter no banco só a referência.
- **Notas recebidas por e-mail**: hoje a nota é anexada à mão. Uma evolução natural é buscar as NF-e emitidas contra o CNPJ do complexo direto na SEFAZ (manifestação do destinatário), com certificado digital.
- **Backup**: ligar as cópias de segurança do Postgres no Easypanel antes da operação real.

## Versão anterior

O painel estático original (HTML com temas sobrepostos e dados no `localStorage`) está na tag `prototipo-estatico`.

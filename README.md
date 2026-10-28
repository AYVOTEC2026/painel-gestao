# AYVO Food Park

Sistema de gestão para food park: caixa (PDV) por box, cadastro de lojistas e cardápios, acerto mensal com cada lojista, financeiro e arquivos para o contador. Tem banco de dados (Postgres), login por pessoa e dois perfis de acesso.

## Quem usa e o que vê

| Perfil | Para quem | Telas |
|---|---|---|
| **Gestão** | Proprietária, gerente | Início, Caixa, Boxes e lojistas, Financeiro, Equipe, Configurações, Ajuda |
| **Caixa** | Funcionário do caixa | Caixa e Ajuda |

As permissões são conferidas no servidor, não só escondidas na tela. Toda ação que muda o food park (venda, cancelamento, acerto, cadastro) fica no histórico com o nome de quem fez, em **Equipe > Atividade recente**.

Cada tela tem um botão **Como funciona?** com a explicação daquela tela. A página **Ajuda** traz o fluxo do dinheiro, a rotina do dia e do mês, um glossário e perguntas frequentes.

## Rodar no computador

```bash
npm install
createdb painel_gestao                     # Postgres local
DATABASE_URL=postgres://localhost/painel_gestao SEED_DEMO=true npm run dev
```

Abra http://localhost:3000. Na tela de entrada há dois botões de demonstração: **Proprietária** e **Funcionário do caixa** (senha `demo1234`).

Sem `DATABASE_URL` o sistema também sobe, mas em memória: tudo some ao reiniciar. Uma faixa vermelha avisa quando isso acontece.

## Subir na VPS (Easypanel)

1. **Banco:** no projeto do Easypanel, *+ Service* > **Postgres**. Nome sugerido: `painel_gestao_db`. Copie a *Internal Connection URL*.
2. **App:** *+ Service* > **App**.
   - *Source*: GitHub, repositório `AYVOTEC2026/painel-gestao`, branch `feat/painel-com-banco` (ou `main` depois do merge), caminho `/`.
   - *Build*: Dockerfile.
   - Ative **Auto Deploy** para cada push republicar sozinho.
3. **Environment** do app:

   ```
   DATABASE_URL=<Internal Connection URL do passo 1>
   SEED_DEMO=true
   SENHA_DEMO=demo1234
   TZ=America/Fortaleza
   ```

4. **Domains**: aponte o domínio para a porta **3000** com HTTPS ligado.
5. **Deploy.** As tabelas são criadas sozinhas na primeira subida e a demonstração é carregada. Para conferir, abra `https://<domínio>/api/saude`: a resposta deve ser `{"ok":true,"banco":"postgres"}`.

Não precisa de volume: tudo fica no Postgres.

### Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão com o Postgres. Sem ela, roda em memória. |
| `DATABASE_SSL=1` | Liga TLS para banco fora da VPS. O Postgres do próprio Easypanel não precisa. |
| `SEED_DEMO=true` | Banco **vazio** nasce com o food park de demonstração e os dois acessos prontos. Banco com dados não é tocado. |
| `SENHA_DEMO` | Senha dos acessos de demonstração (padrão `demo1234`). |
| `CODIGO_INSTALACAO` | Sem demonstração, a primeira tela é a de instalação. Com este código definido, só quem tem o código instala. |
| `TZ` | Fuso do food park (padrão `America/Fortaleza`). Define o "hoje" das vendas. |

## Da demonstração para a operação real

A demonstração é recriada todo dia, com cinco lojistas e o mês corrente de vendas, para o painel sempre parecer vivo na apresentação. Quando a cliente fechar:

1. Ela entra como **Proprietária** e clica em **Começar operação real** (na faixa do topo ou em Configurações).
2. Informa o nome do food park, os boxes, a taxa e cria o **próprio acesso** (e-mail e senha).
3. O sistema apaga os dados fictícios, desliga os acessos de demonstração e a deixa logada com a conta nova.
4. Em **Equipe**, ela cadastra os funcionários do caixa.

Para uma instalação nova sem demonstração, suba sem `SEED_DEMO` e defina `CODIGO_INSTALACAO`. A primeira pessoa que abrir o endereço com o código cria o food park e o acesso de gestão.

## Como o dinheiro é contabilizado

A regra fica em [server/dominio/ledger.js](server/dominio/ledger.js), em partidas dobradas (cada lançamento tem débito e crédito iguais). O servidor se recusa a gravar qualquer operação que desequilibre o livro.

- **Dinheiro em espécie** fica com o lojista; a taxa do food park sobre a venda vira conta a receber.
- **Pix, cartão e voucher** entram no food park, que fica devendo ao lojista o líquido (sem taxa do parque e sem maquininha).
- O **acerto do mês** compensa as duas coisas e o aluguel em aberto, e resulta em um único valor: pagar ou receber.
- O **faturamento dos boxes** não é receita do food park. Receita é aluguel, taxa e outras receitas.

## Estrutura

```
server/
  main.js              sobe o servidor, migra o banco, carrega a demonstração
  app.js               rotas da API, login, permissões, cabeçalhos de segurança
  acesso.js            senha (scrypt), sessão por cookie, freio de tentativas
  dominio/ledger.js    regras do food park e contabilidade (também roda no navegador para prévia da venda)
  dominio/acoes.js     cada ação do sistema: quem pode e o que ela muda
  dominio/visao.js     o que cada tela recebe, conforme o perfil
  persistencia/        Postgres (produção) e memória (testes), mesma interface
public/
  index.html, css/app.css
  js/app.js            moldura, menu e rotas
  js/paginas/*.js      uma tela por arquivo
  js/ajuda-conteudo.js textos de ajuda e glossário
test/                  regras contábeis e API completa (memória e Postgres)
```

## Testes

```bash
npm test                                                   # regras + API em memória
TEST_DATABASE_URL=postgres://localhost/painel_gestao_test npm test   # inclui o Postgres
```

O banco de teste é apagado a cada execução. Use um banco só para isso.

## O que é protótipo e o que falta para produção

Pronto para apresentar e para um piloto com um food park. Antes de escalar:

- **Armazenamento:** a operação de cada food park é um documento JSONB, alterado com a linha travada (duas vendas simultâneas entram em fila, sem conflito). Isso aguenta bem um food park por alguns meses. Para volume alto ou vários anos de histórico, vendas e lançamentos devem ir para tabelas próprias.
- **Uma instância só:** o freio de tentativas de login fica na memória do processo. Com mais de uma réplica, movê-lo para o banco.
- **Sem integração de pagamento:** Pix, cartão e voucher são registrados manualmente no caixa. Integração com maquininha ou gateway e emissão fiscal ficam para a fase de produção.
- **Backup:** configurar o backup automático do Postgres no Easypanel antes da operação real.

## Versão anterior

O painel estático anterior (HTML com temas sobrepostos e dados no `localStorage`) está preservado na tag `prototipo-estatico`.

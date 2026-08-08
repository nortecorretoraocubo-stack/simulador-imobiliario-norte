# Simulador Imobiliário Norte — Etapa 1

Fundação técnica do PWA responsivo e instalável. Esta versão contém a estrutura modular, navegação, formulários iniciais, persistência em `localStorage`, manifest e Service Worker. Os motores MCMV, SAC, Price e fluxo de obras serão adicionados nas etapas seguintes.

## Executar localmente

O Service Worker exige HTTP/HTTPS. Não abra apenas o arquivo `index.html` com duplo clique.

### Com Python

```bash
cd simulador-imobiliario-norte
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Publicar gratuitamente no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos mantendo `index.html` na raiz.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/root`.
6. Salve e abra o endereço fornecido pelo GitHub.

Todos os caminhos foram escritos de forma relativa para funcionar em um subdiretório do GitHub Pages.

## Instalar no iPhone

1. Abra o endereço publicado usando o Safari.
2. Toque no botão de compartilhar.
3. Escolha **Adicionar à Tela de Início**.
4. Confirme em **Adicionar**.

No iPhone, a instalação é feita pelo menu do Safari; o evento de instalação automática pode não ser exibido.

## O que funciona nesta etapa

- layout responsivo;
- navegação por hash, compatível com GitHub Pages;
- formulário do comprador;
- formulário do imóvel;
- rascunho salvo localmente;
- resumo dos dados informados;
- detecção de conexão;
- PWA e cache offline após o primeiro carregamento;
- versão do aplicativo e versão da base de regras separadas.

## Aviso

Esta fundação ainda não calcula financiamento. Ela prepara a estrutura segura para os motores das etapas seguintes.

## Atualização 1.1 — Fluxo navegável

A fundação agora inclui sete etapas visíveis: Comprador, Imóvel, Enquadramento, Comparação, Composição, Fluxo e Resumo. A barra de progresso muda automaticamente conforme a navegação. A paleta utiliza azul-marinho como base e verde-claro para destaques, ações concluídas e progresso.


## Etapa 2 — Bloco 1: Base de regras JSON

Esta versão inclui a primeira base parametrizada do motor de regras:

- `income-bands.json`: faixas e subfaixas de renda;
- `interest-rates.json`: taxas nominais anuais por faixa e condição FGTS;
- `municipalities.json`: município e agrupamento regional inicial;
- `property-limits.json`: tetos por faixa;
- `financing-quotas.json`: cota padrão e tratamento da cota excepcional;
- `subsidies.json`: subsídio indicativo e avisos;
- `terms.json`: prazo máximo e limite por idade;
- `construction-flow.json`: parâmetros do fluxo de obras;
- `legal-notices.json`: avisos obrigatórios;
- `rules-index.json`: índice central dos arquivos de regras.

As regras ainda não são aplicadas automaticamente na interface. Essa conexão será feita no Bloco 2, por meio do carregador e do repositório de regras.

## Etapa 2 — Bloco 2

A base JSON agora é carregada e validada automaticamente na inicialização. A tela **Enquadramento** exibe o diagnóstico da base. Os módulos de cálculo poderão consumir as regras pelo `rulesRepository`.

## Etapa 2 — Bloco 3

Esta versão corrige a estrutura de `construction-flow.json` e adiciona o primeiro motor funcional de enquadramento. A tela Enquadramento agora calcula faixa, subfaixa, condição de cotista, teto do imóvel, taxa nominal, taxa efetiva, cota padrão, prazo máximo e base da cota. Também apresenta um diagnóstico visual do raciocínio aplicado.

## Correção v1.6.2

- remove definitivamente as abas Comparação e Composição;
- corrige a leitura da regra `construction-flow`;
- impede que a navegação force o retorno ao topo;
- altera o Service Worker para priorizar arquivos novos quando houver internet, mantendo o fallback offline.

Ao trocar uma versão antiga que já foi aberta em `localhost:8000`, limpe uma única vez o Service Worker antigo conforme as instruções entregues junto ao arquivo.

## Etapa 6 — Resultado v1.10.0

- Tela de resultado simplificada para apresentação ao cliente.
- Resumo do imóvel, financiamento, entrada, FGTS, subsídio, prazo e taxa.
- Primeira e última parcelas financeiras estimadas para Price ou SAC.
- Fluxo de entrada exibido de forma resumida.
- Botão recolhível **Análise detalhada** com enquadramento, limites, base da cota, verificações e alertas técnicos.
- Informações sobre avaliação favorável e parcela bônus permanecem somente na análise detalhada.

### Correção v1.10.0

- Corrigida a chave da regra do fluxo de obras na página Resultado (`construction-flow`).
- O botão **Continuar para resultado** agora abre o resumo sem interromper a navegação.
- Adicionada a meta tag moderna `mobile-web-app-capable` para eliminar o aviso de compatibilidade no Chrome.


## Novidade v1.10.0 — Alternativa SBPE

Quando renda ou imóvel não se enquadram no MCMV, o sistema passa a apresentar automaticamente uma simulação SBPE.

- SFH para avaliação de até R$ 2.250.000,00;
- SFI acima desse valor;
- cotas configuradas em 80% no SAC e 70% no Price;
- prazo máximo de 420 meses, respeitando a idade;
- taxa SBPE editável na tela de enquadramento;
- referência inicial CAIXA de 11,49% a.a. + TR para SFH;
- sem subsídio automático;
- FGTS considerado apenas na linha SFH, sujeito às regras oficiais.

A TR, os seguros e o CET não são projetados automaticamente nesta versão.


## Novidades da versão 1.10.0

- Base da cota: associativo em obras utiliza a avaliação bancária; imóvel pronto utiliza o menor valor entre venda e avaliação.
- Estimativa configurável de 4% a 5% para impostos, cartório e despesas bancárias.
- Em imóvel pronto, a reserva estimada aparece no resumo do cliente e na análise detalhada.
- Em imóvel em obras, a estimativa aparece apenas na análise detalhada.


## Etapa 7 - Relatórios (v1.10.0)

A tela de Resultado agora oferece:

- envio do resumo pelo WhatsApp;
- cópia da mensagem para a área de transferência;
- PDF Cliente com uma página limpa e link clicável para o WhatsApp do Corretor Norte;
- PDF Corretor com uma segunda página de análise detalhada;
- impressão usando o mesmo layout do PDF Cliente.

Para gerar o PDF, clique em **PDF Cliente** ou **PDF Corretor** e, na janela aberta, escolha **Imprimir / Salvar em PDF**. No iPhone, use a opção de impressão/compartilhamento do Safari para salvar ou enviar o documento.


## v1.11.0 — Subsídio aproximado e revisão de taxas

- Incluído marcador no comprador: **Marque se houver mais de um proponente ou dependente**.
- Subsídio MCMV estimado automaticamente por interpolação entre pontos da tabela de referência fornecida, com teto indicativo de R$ 55.000 na região Sudeste.
- Para rendas entre R$ 4.000 e R$ 5.000, o modelo faz redução proporcional até zero em R$ 5.000 para evitar tratar a estimativa como benefício garantido.
- Entrada total = valor de venda - financiamento - FGTS - subsídio estimado.
- Resultado do cliente, PDF e WhatsApp exibem o subsídio mesmo quando for R$ 0,00.
- Taxas do MCMV revisadas com a tabela oficial do Ministério das Cidades atualizada em 28/06/2026. Os valores já usados pelo motor estavam compatíveis com as faixas vigentes e foram mantidos; foi atualizada a fonte/metadados.
- O subsídio continua sendo estimativa comercial e nunca substitui o cálculo oficial do agente financeiro.

## v1.11.1 — Entrada manual reduz o financiamento
- Na edição manual do fluxo, aumentar a entrada reduz automaticamente o financiamento estimado.
- A composição final passa a obedecer: fluxo de pagamento + financiamento + FGTS + subsídio = valor de venda.
- O financiamento nunca aumenta além do valor aprovado no enquadramento.
- Se o fluxo manual ficar abaixo da entrada mínima, o resultado fica bloqueado até completar a diferença.
- Se a entrada ultrapassar todo o saldo da compra, o sistema sinaliza excesso.
- Primeira e última parcelas são recalculadas com o financiamento ajustado.


## v1.12.0 — Projeção com correção
- Proposta de percentual pago durante obras (20% a 100%, respeitando mínimo ditado pelo financiamento máximo).
- Distribuição automática por percentuais de ato, mensais e intermediárias; saldo vai para chaves.
- Projeção INCC cumulativa sobre parcelas após o ato.
- Pró-soluto projetado por IGP-M.
- Para Associativo: estimativa de evolução de obra baseada no saldo teoricamente liberado conforme curva de progresso de 36 meses e juros mensais do financiamento.
- Para SFH em obras com repasse no final: indicador de risco do saldo projetado pelo INCC em relação à capacidade atual de financiamento por renda.
- Projeção fica oculta no app e é opcional em PDF/impressão.


## v1.13.1 — Dois caminhos de obra, datas e intermediárias

- Associativo em obras mantém o motor automático da v1.11 e recebe a projeção com INCC/evolução de obra.
- SFH em obras mantém o motor percentual da v1.12 e a análise de risco de repasse.
- Vencimento selecionável nos dias 5, 10, 15 ou 20.
- Prazo de obra limitado a 2–60 meses.
- Edição manual permite intermediárias trimestrais, semestrais, anuais ou livres, limitadas a 12.
- Para periodicidades fixas, a primeira data define automaticamente as seguintes. No modo livre, cada intermediária recebe mês/ano próprio dentro do prazo da obra.
- A projeção identifica quando mensal, intermediária e chaves coincidem no mesmo mês.
- Campos numéricos bloqueiam notação exponencial, sinais e colagens com caracteres não numéricos.


## v1.13.1 — Regras de enquadramento por modalidade

- Modalidade **SFH** direciona obrigatoriamente para **SBPE**, independentemente da renda e do valor do imóvel.
- O MCMV automático só é avaliado para modalidade **Associativo**.
- Para MCMV, o teto do imóvel é validado pelo **valor de avaliação bancária**.
- **Novo ou Usado + Pronto + Associativo**: base da cota = menor entre venda e avaliação.
- **Novo + Em obras + Associativo**: base da cota = avaliação bancária.
- **Usado + Em obras** é uma combinação inválida e foi bloqueada na interface.
- **Meses até as chaves** é obrigatório somente quando a situação é **Em obras**.


## v1.13.2 — Parâmetros no resultado

- O Resultado do cliente passa a exibir a renda familiar utilizada na simulação.
- O Resultado informa se foi marcado mais de um proponente ou dependente para fins de composição/subsídio.
- O PDF Cliente e o PDF Corretor passam a incluir esses dois parâmetros em uma seção compacta.
- Nenhuma alteração foi feita nas regras financeiras ou de enquadramento desta versão.

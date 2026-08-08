# Projeção com correção — v1.12.0

## Finalidade
Ferramenta comercial de projeção. Não substitui planilha da construtora, cronograma físico-financeiro, contrato bancário, medição da CAIXA ou índices futuros efetivamente publicados.

## INCC
Referência inicial: INCC-M acumulado em 12 meses de 6,71% (FGV IBRE, junho/2026), convertido para taxa mensal equivalente (~0,5427% a.m.).
- Ato: sem correção.
- Mensal n: valor-base × (1 + INCC mensal)^n.
- Intermediária: corrigida até o mês estimado de pagamento.
- Chaves: corrigida por todo o período restante até a entrega.

## Pró-soluto
Referência inicial: IGP-M acumulado em 12 meses de 3,16% (FGV IBRE, junho/2026), convertido para taxa mensal equivalente (~0,2596% a.m.). As parcelas de pró-soluto são projetadas após as chaves com correção cumulativa pelo IGP-M.

## Evolução de obra — Associativo
A CAIXA libera recursos conforme a evolução/medição da obra. O encargo de obra real depende do saldo já liberado e pode incluir juros, atualização monetária, seguros e tarifa administrativa.

A projeção do Simulador Norte usa:
- primeira cobrança no 2º mês após o ato;
- obra teórica de 36 meses;
- curva cumulativa de avanço: 0m=0%, 6m=8%, 12m=25%, 18m=50%, 24m=78%, 30m=93%, 36m=100%;
- juros estimados = saldo teoricamente liberado × taxa mensal nominal do financiamento.

TR futura, MIP, DFI e tarifa de administração não são estimados automaticamente.

## SFH em obras com repasse no final
Para imóvel novo em obras, modalidade SFH com financiamento bancário apenas na conclusão, o saldo a financiar é projetado pelo INCC até as chaves e comparado com a capacidade atual de financiamento por renda.

Classificação comercial de risco:
- Baixo: saldo projetado utiliza até 85% da capacidade atual pela renda.
- Moderado: acima de 85% e até 100%.
- Alto: acima de 100%.

A classificação não é aprovação, recomendação de crédito ou previsão de renda futura; serve apenas para revelar margem ou ausência de margem na proposta atual.

## Proposta durante obras
O corretor informa entre 20% e 100% do valor do imóvel para a parte não financiada. O mínimo aumenta automaticamente quando o financiamento máximo suportado exigir percentual maior. FGTS e subsídio compõem a parte não financiada; o restante vira fluxo direto do comprador.

O fluxo automático divide o valor em:
- ato (%);
- mensais (%);
- intermediárias (%);
- chaves = percentual restante.

O modo manual anterior permanece disponível e continua permitindo pró-soluto.

## Atualização v1.13.0 — caminhos de obra e calendário

A aplicação separa os imóveis em obras em dois caminhos:

1. **Associativo em obras:** conserva o algoritmo automático tradicional da v1.11 (ato, mensais, intermediárias e chaves conforme limites comerciais). A projeção acrescenta INCC cumulativo e evolução de obra estimada.
2. **SFH em obras:** utiliza a proposta percentual da construtora introduzida na v1.12, com definição de percentual para obras e distribuição percentual entre ato, mensais e intermediárias; o restante é destinado às chaves. A projeção mantém o indicador de risco do repasse futuro.

O usuário escolhe vencimento nos dias 5, 10, 15 ou 20. O ato é considerado na data da simulação; a primeira mensal ocorre no mês seguinte, e as chaves são posicionadas no último mês informado de obra.

No modo manual, intermediárias podem ser trimestrais, semestrais, anuais ou livres, com limite de 12. Nas periodicidades fixas, o usuário escolhe mês/ano da primeira e as demais são calculadas pelo intervalo. No modo livre, cada intermediária recebe mês/ano independente dentro do período da obra.

Na tabela de projeção, quando obrigações coincidem, o número da parcela é identificado, por exemplo, como `9 + Intermediária` ou `16 + Chaves`. A coluna Parcela Fluxo representa a soma das obrigações daquele mês após a correção aplicável.

# Guia da base de regras — Etapa 2, Bloco 1

A pasta `data/defaults` contém a tabela padrão do aplicativo.

## Regra de segurança

Quando não houver condição oficial cadastrada, o sistema não deverá inferir taxa, cota ou subsídio. O comportamento esperado será exigir edição manual ou apresentar “condição pendente de validação”.

## Vigência

Cada conjunto contém versão, data de atualização, início de vigência, fonte e status ativo.

## Próximo bloco

O Bloco 2 carregará os arquivos pelo `rules-index.json`, validará a estrutura e permitirá substituir a tabela padrão por uma versão salva no `localStorage`.

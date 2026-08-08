# Carregamento das regras — Etapa 2, Bloco 2

O aplicativo carrega primeiro `data/defaults/rules-index.json`. Em seguida, busca todos os arquivos listados no índice, valida sua estrutura mínima e os disponibiliza por meio do `rulesRepository`.

## Módulos

- `rules-loader.js`: carrega o índice e os arquivos JSON.
- `rules-validator.js`: valida campos obrigatórios, listas e identificadores duplicados.
- `rules-repository.js`: fornece acesso centralizado e somente leitura às regras.

## Diagnóstico

A tela **Enquadramento** mostra:

- versão da base;
- arquivos carregados;
- resultado da validação;
- origem da base.

Este bloco ainda não calcula o enquadramento. O cálculo entra no Bloco 3.

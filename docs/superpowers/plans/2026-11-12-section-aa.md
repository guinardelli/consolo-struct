# Seção A–A: integração e correção

> Execução sequencial nesta sessão, preservando a contribuição do PR #24.

**Objetivo:** concluir os requisitos das issues #19, #20 e #21.
**Especificação:** corpos das issues #19–21 no GitHub.
**Arquitetura:** apresentação restrita a `Drawing.tsx`; usar o centroide e os níveis existentes, sem alterar domínio, persistência ou detalhamento.
**Tecnologias:** React, TypeScript, Vitest e Playwright; Node >=22.12.

## Restrições

- Preservar os commits do autor do PR #24 e as funcionalidades atuais de master.
- Executar a cota antes do grampo; não trabalhar em paralelo no componente.
- Preservar N1/N3, níveis, quantidades, seleção, demais vistas e exportações.

## Revisão prioritária

- Camadas desiguais: d’ termina no centroide de todas as barras.
- Bitolas pequenas e zoom: contornos completos de N2 não cruzam N3.
- Costura inferior: mesma correção nas duas faces e em todos os níveis.
- Arranjos extremos: não mover barras verticalmente nem simular nova regra de cálculo.
- Arquivos e resultados: iguais para as mesmas entradas.

## Tarefa 1: integrar PR #24

Arquivos: componente, estilos, testes de editor e documentação já presentes no PR.

- [x] Conferir master e PRs existentes; publicar avisos de início.
- [x] Criar branch e mesclar os commits originais, preservando ambas as partes do histórico.
- [x] Executar regressões de editor; seis testes aprovados.
- [x] Atualizar validação com resultados reais e capturas; merge `314d5f4`, PR #37.

## Tarefa 2: corrigir N2

Arquivos: `src/components/Drawing.tsx`, `tests/e2e/editor.spec.ts`, documentação.
Consome: d’ integrado, `stitchLevels` existentes e bitolas da peça.
Produz: círculos N2 internos ao contorno visível de N3.

- [x] Publicar aviso na #21 antes da correção.
- [x] Escrever teste de círculos completos, níveis e quantidades com variações de largura, cobrimento e bitolas; observar falha sobre master integrado.
- [x] Usar posição interna derivada de cobrimento/bitolas e raio proporcional à escala, incluindo traços e cantos arredondados.
- [x] Executar regressões, comparar entradas/resultados e inspecionar capturas claro/escuro.
- [x] Executar format:check, check (280), build e test:e2e (84); revisão independente sem defeitos acionáveis.
- [x] Publicado PR #38, dependente da integração de #37.

## Registro

- Base: `fa8c8908f58ce05ccd5bfc17ba123045da166a54`.
- PR original: `d02bd8e5c3316c0ccab019afc0548505e6641554`.
- Conta conectada sem permissão de integração no upstream; entregar PRs e informar essa limitação.
- Decisão: trabalhar sequencialmente em branches locais no checkout inicialmente limpo; manter commits originais e publicar contribuições pelo fork existente.
- Decisão: a folga para o contorno visível de N3 é apenas gráfica, escalada com a vista; não modifica o layout físico, níveis ou regras de dimensionamento.
- A CI do upstream exige autorização de um mantenedor para executar a contribuição do fork; todas as verificações documentadas acima foram executadas localmente.

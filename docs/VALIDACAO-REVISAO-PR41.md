# Revisão do PR #41 — disposição física N3/N3G

Resposta técnica ao [comentário de Ricardo Corsini](https://github.com/ricardocorsini/consolo-struct/pull/41#issuecomment-6837544138). Branch `feat/n4-constructive-reinforcement`, revisão iniciada no commit `94cb89cb66987bf6a47cec9a4c644e86a39aa891`. Fork master sincronizado com a master original `fa8c890` antes da correção.

## Defeito confirmado e correção

A regressão `tests/n3Interference.test.ts` foi executada antes da correção e falhou: `shortFixture()` com somente `stirrupBranches = 4` tinha penetração entre o estribo externo e o grampo. As duas peças estavam em x = 28,15 mm e compartilhavam o trecho inferior descrito no comentário. Os 315 testes existentes passavam sem detectar isso.

O grampo N3G agora ocupa um plano próprio. Mantêm-se as estações externas de N3 e seu passo. Para cada par, o afastamento de eixos é `Δx = φN3 + max(20 mm; φN3; 1,2·agregado)`, dirigido para o interior da peça. A folga é a mesma já usada na verificação de congestionamento de N3, sem criar uma nova alegação normativa. Altura, caminho, comprimento exato, corte e massa do grampo são calculados na estação deslocada, respeitando face inclinada/recortada, mandril e pontas retas dos ganchos.

A distribuição dos grampos conserva o passo máximo externo quando cabe. Pares que se aproximam demais no meio do comprimento ou não cabem entre os cobrimentos recebem erros específicos `transverse-clearance`, `transverse-clash` e/ou `transverse-cover`. O detector de colisão inclui segmentos e curvas amostradas, além da verificação da distância entre planos. Não se reduz folga, cobrimento, diâmetro, mandril ou quantidade para aparentar uma solução. O cálculo resistente mantém os quatro ramos e seus limites existentes; uma capacidade numérica não libera um arranjo com erro de fabricação.

A seção A–A passa a identificar a **projeção do par**, com as duas estações; as N4 são representadas no plano do ramo que as contém. Elevação, planta, 3D, detalhamento e quantitativos usam os mesmos planos reais. Não há alteração de arquivo/schema, classes de aço, geometria do concreto, percurso físico de N1/N2, percurso longitudinal de N4 ou capacidade da própria N4.

## Caso numérico em mm

`shortFixture()`, quatro ramos, cinco pares, Ø6,3, agregado de 19 mm. Folga livre = 22,8 mm; afastamento de eixos = 29,1 mm.

| Grandeza da primeira dupla |                  Antes |                 Depois |
| -------------------------- | ---------------------: | ---------------------: |
| x do externo N3            |                  28,15 |                  28,15 |
| x do grampo N3G            |                  28,15 |                  57,25 |
| Profundidade inferior N3   |      452,1586679479129 |      452,1586679479129 |
| Profundidade inferior N3G  |      452,1586679479129 |     435,99200128124625 |
| Comprimento exato N3G      |     1100,3981105599703 |      1068,064777226637 |
| Quantidades por peça       | 5 externos + 5 grampos | 5 externos + 5 grampos |
| Área N3 fornecida (mm²)    |      623,4490621048944 |      623,4490621048944 |

A massa total da peça passa de 17,40656412702757 para 17,41463935100448 kg: os grampos mudam de altura conforme o sentido do deslocamento e os comprimentos de corte são arredondados para cima. Não se congelam quantitativos incompatíveis com os percursos corrigidos. Os quatro percursos de N4 permanecem iguais e não colidem com N3/N3G neste caso.

## Verificação e composição

A correção isolada passou nos oito testes novos de geometria e nos 35 testes existentes de N4, além de oito fluxos de interface de N4/interferência. Os testes cobrem o caso reportado, perfil mantido/recortado, cobrimento, mandris, pontas completas, estações reais de 3D, projeções, contagens, comprimento/corte/massa, congestionamento com colisão e falta de espaço com um único par.

Uma comparação direta com o checkout original do PR verificou 36 cálculos completos, combinando dois/quatro ramos, três modelos, manter/remover concreto e três bitolas N3: resultados permaneceram idênticos. Nos 18 casos de dois ramos, o modelo completo de detalhamento e o modelo 3D também permaneceram idênticos.

A composição incorpora os commits originais de #42 (incluindo #37/#24) e #38, preservando autoria e histórico: `b154f1c6317b68174b16a8f72ef3273f94a7d46b` e `446a9e11007c3755177b5c0a33b1555449d7c173` são ancestrais. Os merges locais são `b1dfcc5` e `ea8df50`. Conflitos do changelog foram resolvidos preservando os dois conjuntos de entradas. Não há merge no repositório original; a atualização é feita na branch do fork que alimenta o PR existente.

N2 em #38 pressupunha o antigo retângulo gráfico de N3. O cálculo do afastamento dos símbolos passou a usar o contorno físico, o raio de mandril e a espessura real de N3 da #41. As regressões agora leem o path efetivamente renderizado e verificam o símbolo inteiro, inclusive os traços, com ambas as faces, temas, camadas, zoom/pan e quatro ramos. Níveis, contagens e cálculo de N2 permanecem iguais.

Dois cenários de #38 eram viáveis no retângulo gráfico anterior, mas não no contorno inclinado de N3: a edição para cobrimento 35 / N2 Ø12,5 / N3 Ø8 e a peça 500 × 600, ponta de 200 mm, N2 Ø16, três camadas. Para conferir contenção integral, as fixtures usam agora pontas de 300 e 500 mm, respectivamente. O segundo cenário original continua em uma regressão própria: a seção mostra **N2 sem espaço no contorno projetado de N3** e conserva os níveis originais. O aviso se refere à projeção e não se apresenta como nova verificação resistente ou certificação de interferência global N2/N3.

A regressão de #42 que comparava o SVG inteiro da elevação foi adaptada para ignorar apenas `data-transverse-position`: a coordenada transversal de N4 muda com a largura, embora a projeção longitudinal permaneça igual. Todas as coordenadas visíveis continuam comparadas. As regressões de d’ e enquadramento em 1000/2000/6000 mm permanecem ativas.

A correção isolada está em `934438b`, seguida dos dois merges e de uma correção de composição. O conjunto final passou em:

| Comando                                                                                               | Resultado                       |
| ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| `npm run check`                                                                                       | 331 testes em 19 arquivos       |
| `npx playwright test tests/e2e/editor.spec.ts tests/e2e/n3-interference.spec.ts tests/e2e/n4.spec.ts` | 22 testes                       |
| `npm run format:check`                                                                                | Aprovado                        |
| `npm run build`                                                                                       | Aprovado                        |
| `npx playwright install chromium`                                                                     | Executado; navegador disponível |
| `npm run test:e2e`                                                                                    | 96 testes em 17 arquivos        |

As falhas intermediárias de composição não foram ignoradas: incluíram uma expectativa de metadados de N4 no SVG, uma leitura de N3 como retângulo e os dois cenários sem espaço citados acima. A suíte final foi executada após as correções, sem editar código durante sua execução. O build conserva os avisos preexistentes do Zod, importação de `detailing/job.ts` e tamanho de chunks.

Capturas atualizadas da composição:

- [Seção A–A com d’, N2, N3/N3G e N4](images/pr41-revisao-secao.png)
- [Elevação com os planos longitudinais distintos](images/pr41-revisao-elevacao.png)
- [Modelo 3D com o par separado](images/pr41-revisao-3d.png)

As imagens anteriores da entrega original em `VALIDACAO-N4-CONSTRUTIVA.md` são históricas. Esta revisão não incorpora as outras propostas ainda abertas, como #39, #43 ou a migração de aço da issue #35: a colisão entre os dois contratos independentes de esquema 5 ainda precisa ser conciliada antes de integrar essa migração de aço junto com N4.

## Limitações

A folga é a decisão construtiva existente do programa aplicada ao par; não houve consulta nova a textos normativos nem certificação do arranjo executivo. A solução e as restrições geométricas precisam da revisão técnica do mantenedor. Não houve revisão independente nesta sessão. Tauri nativo não executado: Rust/Cargo e seus pré-requisitos não estão disponíveis. Testes web não substituem validação nativa.

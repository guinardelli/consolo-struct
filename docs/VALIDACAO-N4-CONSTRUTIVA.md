# Validação — N3 de 2/4 ramos e N4 construtiva (issue #31)

Contribuição para [a issue #31](https://github.com/ricardocorsini/consolo-struct/issues/31), na branch `feat/n4-constructive-reinforcement`, a partir de `master` atualizado em `fa8c8908f58ce05ccd5bfc17ba123045da166a54`. O fork foi sincronizado antes da implementação.

## Implementado

- `rebar.stirrupBranches` admite somente **2 ou 4**, com padrão 2. `rebar.constructiveDiameter` tem padrão **8 mm**, editável na guia Armaduras. N4 é obrigatória, com quantidade derivada dos ramos N3; não existe chave para desligá-la.
- `As,N3,prov = ramosN3 × quantidadeN3 × πφ²/4`. A sugestão usa `ceil(As,N3,req / (ramosN3 × πφ²/4))`, conservando os limites existentes de quantidade e espaçamento. Demanda, N2 e demais fórmulas resistentes não mudam.
- N4 acompanha a face inferior, inclusive o recorte, prolonga-se no suporte e dobra verticalmente na ponta. Não participa de capacidades resistentes nem da sugestão automática.
- N3 com quatro ramos gera um estribo externo e um grampo interno por posição, ambos da bitola N3. O grampo tem dois ganchos de 135° com pontas retas completas `max(5φ; 50 mm)`. O desenvolvimento inclui retas e arcos, sem consumir a ponta reta em um arredondamento de vértice.
- `detailing/transverse.ts` concentra as formas, posições e interseções com os cortes. Elevação, seção A–A, 3D, detalhamento, quadro e saídas usam essa geometria. N4 é quantificada uma vez; o antigo porta-estribos não é gerado.
- As posições de fabricação têm prefixos por família: N1, N2, N2I, N3, N3G, N4, P1, TS e PINO, com sufixos para formas diferentes. Isso reserva N4 para a construtiva também no quadro. N5 é fendilhamento e N6 é suspensão, com os mesmos campos `splitting*` e `suspension*`, valores e verificações, sem dupla contagem.
- A positiva do modo viga continua independente como **P1**. N4 é produzida também nesse modo; interferência entre as duas famílias é uma pendência impeditiva, sem supressão silenciosa de barras ou alteração das entradas.

## Migração e impactos

O esquema passa de **4 para 5**. Projetos dos esquemas 1–4 recebem dois ramos N3 e N4 Ø8, mesmo se o antigo porta-estribos estivesse desligado ou tivesse outra bitola. Essa é a regra explícita da issue; não há tentativa de adivinhar se a antiga bitola era uma escolha do usuário. Campos obsoletos `detailing.mounting` e `mountingDiameter` são retirados na leitura.

Fendilhamento/suspensão permanecem nos campos semânticos anteriores. Se um produtor de esquema 1 já os tiver fornecido, esses quatro valores também são conservados; os demais dados novos de cálculo de esquema 1 continuam exigindo conferência. Resultados serializados não são restaurados. Ramos/bitola entram na assinatura de entradas e participam do histórico; cada peça conserva suas escolhas. Os geradores de exemplos passam a emitir esquema 5; exemplos legados versionados permanecem como casos de importação.

Para cinco posições N3 Ø6,3:

| Ramos | As,N3,prov (mm²)  | Barras N4 |
| ----- | ----------------- | --------- |
| 2     | 311,7245310524472 | 2         |
| 4     | 623,4490621048944 | 4         |

A diferença é exatamente o número de ramos; não há arredondamento intermediário. Mudar apenas a bitola de N4 conserva valores, verificações e resultado resistente da sugestão, mas invalida a memória anterior e atualiza os quantitativos de fabricação.

SVG/DXF/PDF de detalhamento e CSV de aço contêm a forma, quantidade, comprimento e massa de N4 e as duas peças físicas de N3 quando há quatro ramos. O CSV geral acrescenta ramos/área N3 e quantidade, bitola, comprimento e massa N4. A memória/PDF e auditoria identificam a nova convenção. Exportações geométricas continuam sendo somente contorno não executivo, como antes.

## Pendências físicas

O afastamento normal inferior usa cobrimento, bitolas N3/N4 e espaço para o canto arredondado do estribo. Há verificações de espaço transversal, mandril, ponta frontal, cobrimento e colisões entre segmentos de N4 e N1/P1, incluindo as curvas e pernas do gancho de N1. Arranjos incompatíveis recebem pendência impeditiva, sem diminuir cobrimento, bitola ou dobra para fazê-los caber. Uma forma que não comporta seu mandril não recebe comprimento de corte aparentemente válido no quadro.

A indicação de capacidade no cálculo continua separada das pendências de fabricação. N4 não foi adicionada como verificação resistente para reprovar ou aprovar um cálculo por causa da bitola construtiva.

## Validado

Antes da implementação, `npm run check` passou com **280 testes**.

| Comando                                    | Resultado                                                 |
| ------------------------------------------ | --------------------------------------------------------- |
| `npm run format:check`                     | Aprovado                                                  |
| `npm run check`                            | Aprovado: **315 testes em 17 arquivos**                   |
| `npm run build`                            | Aprovado                                                  |
| `npx playwright install chromium`          | Executado; navegador disponível                           |
| `npx playwright test tests/e2e/n4.spec.ts` | Aprovado: **6 testes**, também na execução integral final |
| `npm run test:e2e`                         | Aprovado: **83 testes em 16 arquivos**                    |

Após a conferência final da projeção em planta (o grampo conserva sua própria largura), foram repetidos `npm run check`, `npm run build`, `npm run format:check` e `npx playwright test tests/e2e/n4.spec.ts tests/e2e/detailing.spec.ts tests/e2e/beam-arrangement.spec.ts`: **315 testes unitários e 11 fluxos de interface aprovados**. A suíte integral de 83 testes está registrada na execução anterior a esse ajuste de projeção.

Os **35 testes unitários novos** em `tests/n4.test.ts` cobrem CA1–CA8: padrões, esquemas 1–4, validação de ramos/bitola, isolamento por peça, assinatura, fórmula, demanda/passo, sugestão, independência resistente da N4, N5/N6, forma externa/grampo, pontas retas e desenvolvimento, percurso inclinado/recortado, eixos 2D/3D, quantidades, massa, CSV/SVG/DXF/PDF/auditoria e arranjos incompatíveis. Os testes PDF descomprimem os streams do PDF vetorial para conferir os textos efetivamente gravados.

Os seis testes de navegador cobrem edição, histórico, arquivo salvo/reaberto, migração, N5/N6, invalidação e cálculo auditável, seleção por teclado, ambos os temas, 2/4 ramos na seção e elevação, 3D translúcido, exportações do detalhamento e edição de N4 em janela estreita.

Uma comparação com resultados capturados **antes** da implementação verificou **162 cenários**: três modelos × três resistências de concreto × três produções × dois níveis de forças × três bitolas N3. Com dois ramos, valores intermediários, estados e demandas/capacidades das verificações permaneceram idênticos. As sugestões em nove entradas dessa matriz também permaneceram iguais. Três snapshots numéricos dessa base têm hashes fixados no teste novo.

Uma segunda comparação executou a implementação original em checkout separado e a atual em **12 arranjos**, combinando modelos, manter/remover concreto e disposição convencional/viga. Excluindo somente o porta-estribos substituído e as famílias novas, as barras existentes conservaram exatamente formas, quantidades, bitolas, aço, mandris, comprimentos exatos e comprimentos de corte.

Os hashes históricos de materiais/classes de aço não foram substituídos. As fixtures mantêm os campos novos ausentes e `tests/reference/legacy-n4-labels.ts` normaliza somente os rótulos públicos alterados antes da comparação histórica; não normaliza números, fórmulas, estados nem assinaturas. As expectativas de versão foram atualizadas para 5 e as expectativas gráficas foram atualizadas onde N4 e as curvas reais de N3 substituem a representação anterior. Falhas novas de ajuste N4 após recorte permanecem cobertas separadamente, preservando as pendências anteriores.

## Capturas reais de Chromium

- [Seção A–A e controles, tema claro](images/n4-secao-claro.png).
- [Seção A–A, tema escuro](images/n4-secao-escuro.png).
- [Elevação com prolongamento e dobra frontal, tema escuro](images/n4-elevacao-escuro.png).
- [Quatro N4 e estribo/grampo na vista 3D](images/n4-3d.png).
- [Edição em janela de 390 px](images/n4-estreita.png).

## Não validado, integração e limites

O aplicativo nativo Tauri não foi executado: Rust/Cargo e seus pré-requisitos não estão disponíveis neste ambiente. O build web não é um teste nativo. Os avisos preexistentes de otimização do Zod, importação estática/dinâmica de `detailing/job.ts` e tamanho dos chunks permanecem; nenhuma dependência foi acrescentada.

As correções de seção #19/#21 ainda estavam nos PRs abertos #37/#38, e a projeção de famílias #36 no #39, fora de `master`, na inspeção desta entrega. Esta branch preserva a base atual e não incorpora PRs pendentes de terceiros. **Antes do merge, integrar essas contribuições ou resolver os conflitos de `Drawing.tsx` preservando d′, N2 interno e a N4 obrigatória como única substituta do porta-estribos.** Não foi exercitada uma combinação com essas branches ainda não integradas.

A execução usou o modelo disponibilizado nesta sessão, sem escolher outro modelo ou esforço. Não foi obtida revisão independente de outro agente/profissional; revisão de código, comparações com a base e testes foram feitos nesta execução. A revisão técnica independente permanece necessária no PR.

As regras de ramos/quantidade/bitola N4 seguem as decisões de produto confirmadas na issue. Não houve consulta ou reprodução integral de normas nem alteração da demanda N3 ou dos critérios resistentes de N2/N5/N6. N5/N6 continuam sem detalhamento integral; a compatibilização de suporte, aparelho de apoio, soldas e disposição executiva continua fora do gerador. Testes aprovados não representam certificação normativa ou liberação para execução.

PR manual sugerido: **Adiciona N4 construtiva obrigatória e N3 com dois ou quatro ramos efetivos**. Relacionar com **Closes #31** e citar os impactos de migração, cálculo e exportações acima.

## Revisão posterior ao comentário do PR #41

O comentário do mantenedor confirmou uma interferência não coberta pela entrega original: N3 e N3G compartilhavam o trecho inferior no mesmo plano. A correção, as regressões que falharam antes dela, os exemplos numéricos e a composição com #42/#38 estão em [Validação da revisão do PR #41](VALIDACAO-REVISAO-PR41.md). Esse registro posterior substitui a pendência de composição acima para essas duas frentes; as capturas desta página são da versão anterior à correção física.

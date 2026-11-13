# Detalhamento de consolos - versão 0.5

O módulo produz desenhos locais soltos: elevação de armaduras, planta dos tirantes, cortes A-A e B-B, formas de dobramento, relação de barras e resumo de aço. Os arquivos não recebem folha A1 nem formato obrigatório. Cada peça conserva sua identificação, quantidade, revisão e notas.

## Usar

1. Abra `examples/detalhamento/consolos-detalhados.lume.json` para conhecer o padrão.
2. Selecione a aba **Detalhamento**. O desenho abre enquadrado pela largura; arraste para navegar e use a roda para aproximar. **Ajustar detalhes à tela** enquadra o conjunto inteiro.
3. Escolha **Somente este consolo** ou **Todos os consolos**. O segundo modo inclui todos os tipos cadastrados, cada qual com sua quantidade, mais um resumo geral.
4. Configure revisão, disposição do tirante, penetração no suporte e armaduras complementares. Os parâmetros físicos de geometria, cargas, bitolas e contagens permanecem nas propriedades do modelo. O detalhamento usa esses valores atuais.
5. Exporte DXF, PDF, SVG ou quadro CSV pelos botões dessa aba. Não confundir com o antigo comando **Geometria DXF**, que exporta somente o contorno em mm.

## Unidades e representação

- O modelo de cálculo continua em mm/N/MPa. A saída de detalhamento converte as coordenadas para **cm**. O DXF declara `$INSUNITS=5`, sem depender de conversão manual no CAD.
- As bitolas permanecem em **mm**. Dimensões de formas, posições, mandris, cobrimentos e comprimentos de corte são em **cm**.
- O DXF contém LINE, ARC, CIRCLE e TEXT editáveis, com camadas FORMAS, ARMADURAS, COTAS, TEXTOS, EIXOS e ALERTAS. As cotas são linhas e textos explícitos; não são restrições paramétricas nativas do CAD.
- A geometria e as formas estão a 1:1 em cm no DXF. O PDF usa uma página de dimensão livre por tipo e uma página adicional de resumo quando todos são gerados. Sua escala nominal é 1:10 ao imprimir em tamanho real, sem “ajustar à página”.
- Os cortes identificam sua coordenada x. A-A atravessa o primeiro estribo vertical; B-B atravessa o centro do apoio. As costuras horizontais aparecem como seções de barras onde cruzam o plano do corte.
- As barras do pilar não são inferidas: o suporte aparece como fragmento, com indicação de interrupção. Sua compatibilização pertence ao projeto de conjunto.

## Tirante simples e duplo

**Duplo** significa duas camadas de tirante na mesma face do suporte; não representa consolos nos dois lados de um pilar. A contagem de ramos e a bitola são os dados físicos já usados no motor. Alterar o número de camadas recalcula o centroide e a altura útil.

Uma alça horizontal em U fornece **dois ramos longitudinais**. Portanto, quatro ramos não são quatro alças: são duas barras físicas em U, distribuídas conforme as camadas escolhidas. Cada camada deve ter contagem par. O quadro conta barras físicas. As camadas e formas diferentes têm posições próprias, com o diâmetro interno frontal da segunda camada configurável; zero repete o valor principal.

As alças de uma mesma camada são aninhadas, respeitando mandris, cobrimento, distância livre e espaçamento máximo entre ramos. Uma combinação que não cabe recebe pendência impeditiva, sem diminuir o mandril para produzir uma aparência de solução. Na ancoragem soldada, os ramos retos e a barra transversal são quantificados separadamente; as soldas precisam de sua especificação e verificação.

## N3 de dois/quatro ramos e N4 construtiva

A guia Armaduras permite escolher **2 ou 4 ramos efetivos de N3 por posição**. A distribuição longitudinal é a mesma do cálculo. Cada posição produz um estribo fechado externo; com quatro ramos, também um grampo interno em U com duas pernas e ganchos de 135°, da mesma bitola. O quadro registra separadamente as duas barras físicas (N3 e N3G), com comprimentos próprios em cada seção.

**N4 · Armadura construtiva** é obrigatória, com duas ou quatro barras derivadas de N3 e Ø8 mm inicial editável. Substitui o porta-estribos opcional; sua configuração antiga não permanece no fluxo ativo nem gera barras adicionais. N4 não participa de resistência ou sugestão automática.

O eixo longitudinal acompanha a poligonal inferior com afastamento normal baseado em cobrimento, bitola N3, metade da bitola N4 e folga para o canto arredondado do estribo. As posições transversais são simétricas, uma por vértice inferior interno. O percurso se prolonga no suporte, com cobrimento posterior, e dobra verticalmente na ponta, com mandril da própria bitola e ponta reta mínima geométrica de 8φ. O gerador não interpreta essa ponta como dimensionamento resistente/ancoragem certificada da N4.

`detailing/transverse.ts` é a fonte comum das formas N3/N4, projeções da modelagem, seções, 3D e quadros. Arcos e retas do eixo determinam o desenvolvimento; o corte da N4 nos desenhos considera interseções reais do percurso com o plano da seção. A quantidade do tipo multiplica comprimento e massa uma única vez.

Falta de espaço, invasão de cobrimento e colisão com N1 geram pendência impeditiva. Não se reduzem bitola, cobrimento, mandril ou ponta para aparentar solução. No modo viga, a positiva continua independente, identificada como **P1**; N4 também é produzida e eventual colisão entre as famílias deve ser compatibilizada pelo projetista. As barras são mantidas e quantificadas separadamente enquanto houver a pendência.

As posições usam prefixos de família estáveis: N1, N2, N2I (costura inferior), N3, N3G, N4, P1 (positiva), TS (transversal soldada) e PINO. Formas diferentes da mesma família recebem sufixos, como N3-1. A convenção pública das especiais passa a **N5 fendilhamento e N6 suspensão**; suas formas integrais continuam fora do gerador e, quando informadas, mantêm a pendência existente.

## Comprimentos de corte e ganchos

O comprimento nominal é a soma dos segmentos retos e dos arcos da **linha de centro**. Não se obtém somando cotas externas. Para curva de diâmetro interno D e bitola φ, o raio da linha de centro é `(D + φ)/2`.

- Mandris das barras principais: NBR 6118:2026, tabela 9.1. Mandris dos estribos: tabela 9.2. Combinações não previstas nas tabelas recebem pendência.
- Ganchos de estribos: dois de 135°, voltados para o interior, com ponta reta `max(5φ; 50 mm)`, conforme 9.4.6.1. As figuras são projeções nominais; as extremidades de fechamento se sobrepõem fora do plano.
- Estribo retangular de largura W e altura H entre eixos: três cantos de 90° e dois ganchos de 135°. O desenvolvimento nominal é `2(W+H) + (3π−8)R + 2p`, sendo R o raio do eixo e p a ponta reta de cada gancho.
- Alça frontal com dois cantos de 90°: `2A + W + (π−4)R`, sendo A a projeção longitudinal entre cantos virtuais e extremidades retas e W a largura entre eixos. O desenho identifica A, W e D.
- Quando há gancho de 90° no suporte, o comprimento de suas curvas e pontas entra no desenvolvimento. A projeção e a ponta são dados distintos. A ponta reta deve ter pelo menos 8φ; o percurso real é comparado com o comprimento disponível declarado no cálculo.
- C é arredondado **para cima a 0,1 cm**. O pequeno excedente é incorporado à ponta reta. O desenho e o quadro informam essa convenção. Ajustes de máquina, tolerâncias de dobra e compatibilização final precisam da conferência do fabricante/projetista.

As formas de estribos verticais acompanham a face inferior inclinada com cobrimento normal a essa face. Comprimentos diferentes recebem posições diferentes. As costuras superiores são distribuídas abaixo da última camada do tirante, na zona superior do cálculo; as inferiores ficam no trecho restante, sem ultrapassar a face inclinada. O programa verifica os espaçamentos reais desse arranjo. A tabela e as formas derivam do mesmo modelo, evitando divergência entre o desenho e a lista.

## Quadro de aço

Cada linha contém posição, aço, bitola, barras por peça, barras totais, C unitário, C total e massa total. O resumo agrupa por classe de aço e bitola. A quantidade do tipo multiplica os quantitativos uma única vez. O resumo geral soma todos os tipos; a identificação completa de uma posição é, por exemplo, **C01/N1**.

A massa usa área circular e densidade de 7 850 kg/m³, com o comprimento de corte adotado. Não inclui perdas de oficina, reserva de compra, emendas adicionais ou barras do suporte não cadastradas. O CSV usa separador ponto e vírgula, decimal com vírgula e proteção contra fórmulas em campos editáveis.

## Referências gráficas analisadas

Os dois DWGs fornecidos foram convertidos e inspecionados localmente. Do exemplo de consolos foram incorporadas a combinação de vistas/cortes, as formas das barras soltas, a identificação por posição e os quadros de comprimento e massa. Do exemplo dos pilares foram incorporadas planta e cortes adicionais, indicação das camadas do tirante e dobras com identificação própria na segunda camada. O padrão novo é independente: não reaproveita seus valores como dimensionamento nem redistribui os DWGs de terceiros no pacote.

## Situação de emissão e limites

O módulo recalcula a peça atual e acrescenta verificações de fabricação. Falhas de concreto, ancoragem, espaço para alças, contagens, ganchos ou cobrimento geram **Pendências impeditivas - corrigir antes da execução**, também nos arquivos exportados. Na ausência dessas falhas, a emissão recebe **Para conferência do responsável técnico**. Exportar é permitido para revisão mesmo com pendências; exportar não aprova a peça.

Os pinos opcionais têm espaçamento entre eixos e deslocamento transversal configuráveis, com cotas no corte. Zero no espaçamento ativa distribuição simétrica dentro do apoio. São verificadas as interferências geométricas com tirante e estribos verticais. São desenhados e quantificados com embutimento e espera; sua resistência, ancoragem e ligação à peça apoiada não são dimensionadas por este módulo. A configuração com armaduras especiais de suspensão ou fendilhamento não possui ainda suas formas completas de fabricação: recebe pendência impeditiva e informa a ausência no quadro. O detalhamento do pilar e do aparelho de apoio completo, soldas qualificadas, ganchos semicirculares de barras lisas CA-25, dentes Gerber e consolos nas duas faces permanecem fora do gerador local.

As vistas 2D/3D de modelagem continuam esquemáticas, com etiquetas de famílias; as posições de fabricação e os comprimentos desta versão estão na aba Detalhamento. O motor estrutural é o 0.3.0; esta entrega não amplia seu escopo para análise espacial ou global.

## Reproduzir exemplos e testar

```bash
npm ci
npm run check
node scripts/generate-detail-examples.mjs
npm run build
npm run test:e2e
```

O gerador de exemplos usa o carregador TypeScript do Vite já instalado no projeto. Não exige um conversor DWG no computador do usuário: a referência foi analisada durante o desenvolvimento e as novas saídas DXF são geradas diretamente pelo aplicativo.

## Disposição física do par N3/N3G

Com quatro ramos, N3 e N3G ocupam planos longitudinais distintos. N3 conserva as estações e o passo anteriores. O grampo é deslocado para o interior por `Δx = φN3 + max(20 mm; φN3; 1,2·agregado)`, reutilizando a folga livre de N3 já adotada pelo gerador. O sentido muda na metade do comprimento para respeitar os cobrimentos nas duas extremidades. Cada grampo recebe altura e comprimento calculados na sua própria estação, incluindo a face inclinada/recortada e as pontas completas dos ganchos de 135°.

A seção identifica a projeção do par e suas estações. As quatro N4 são projetadas no plano do ramo que as contém; não se apresentam os dois estribos como se ocupassem uma única seção física. Elevação, planta, 3D, formas e quantitativos usam as mesmas coordenadas. As duas peças continuam compondo quatro ramos por par, sem mudar demanda ou passo de cálculo; o maior passo da distribuição dos grampos não excede o passo externo quando o arranjo cabe.

Falta de espaço longitudinal, invasão do cobrimento ou colisão de trechos/curvas de N3/N3G geram erros impeditivos específicos. Não se diminui a folga, o diâmetro ou o mandril, nem se move N1 ou N4 para esconder o problema. O arranjo continua sujeito à conferência executiva; a capacidade numérica de quatro ramos não aprova um detalhamento congestionado. Consulte [a revisão do PR #41](VALIDACAO-REVISAO-PR41.md).

# Motor 0.4.0 — critérios LC-ELU-2026.2

A revisão 0.7 acrescenta a política complementar e a reação deslocada descritas em [Comparação Base Consolo](COMPARACAO-BASE-CONSOLO.md). As equações abaixo definem a base normativa/documentada; quando o complemento está ativo, usa-se ainda o envelope bibliográfico explicitado na seção seguinte.

## Complementos El Debs e reação deslocada

Trecho §3.5.1, pp.125–130: com a opção ativa, H estimado recebe piso 0,20V (H de análise é preservado e verificado), h2≥h/2, costura≥0,5Va/(0,9d fy), estribos verticais≥0,2As,tirante. Em 0,4≤a/d≤1, As do tirante recebe também o equilíbrio completo de El Debs e verificam-se τ≤0,20fcd e a biela simplificada com z=0,9d, hbie=0,2d e β=1/0,85. Mantém-se o termo Hdh. Esses complementos não substituem exigências normativas. Peças novas ativam a opção; arquivos anteriores sem esse campo a importam desativada.

A cota geométrica a é o centro do aparelho. A posição de cálculo a_calc pode ser deslocada para fora em c_ap/6 ou envelopada por max(a;0,75L). A excentricidade total é Δa+Hh_ap/V e precisa permanecer no núcleo c_ap/6 para contato integral. Na abertura geométrica usa-se c_eff=c_ap−2|Δa|, subárea conservadora contida no aparelho; a2 continua medido até sua borda física. O novo a_calc governa classificação e equilíbrio.

## Alcance

Este documento especifica o que o programa calcula e permite reproduzir suas decisões. O motor trata **consolo simples de concreto armado, seção retangular junto ao suporte, ações estáticas no plano médio e ELU de combinações normais**. Os caminhos são bielas e tirantes (curto), atrito-cisalhamento (muito curto) e, para 1 < a/d ≤ 2, viga em balanço (flexão simples e cisalhamento). A sugestão de armaduras é uma busca discreta, seguida das mesmas verificações usadas para o arranjo informado.

A implementação não equivale à aplicação integral de duas normas a um projeto. Cada resultado tem estado `pass`, `fail`, `review`, `invalid` ou `unsupported`. `pass` significa atendimento às verificações implementadas, sob as entradas e hipóteses registradas; não é aprovação executiva da peça ou da estrutura. Uma pendência `review` não é transformada em atendimento.

## Referências analisadas

Foram lidos os documentos fornecidos nesta solicitação, incluindo as seções gerais às quais os capítulos de consolos remetem. A paginação abaixo é a impressa, não o índice do visualizador PDF.

| Fonte                                                                    | Recorte usado                                                              | Aplicação                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ABNT NBR 6118:2026                                                       | §§7.4–7.5, 8.2–8.3, 9.3–9.5, 17.3.5.2, 18.3.2.2, 21.2, 22.2, 22.3 e 22.5.1 | Durabilidade, materiais, aderência, ancoragem, mínimos, modelos resistentes e disposições de consolos |
| ABNT NBR 9062:2017                                                       | §§6.3.4, 7.3.1–7.3.9 e 9.2.1.1; pp.46–55 para consolos                     | Classificação, ações horizontais, atrito, tirante, costura, suspensão e geometria                     |
| El Debs, _Concreto pré-moldado — fundamentos e aplicações_, trecho cap.4 | §4.3.1.1, pp.115–116; §4.4.4, pp.137–148                                   | Fendilhamento transversal, equilíbrio com braço 0,9d, comparação dos modelos e costura                |
| José Milton de Araújo, _Curso de Concreto Armado_, vol.4, trecho cap.4   | §4.5, pp.114–125                                                           | Geometria do modelo biela-tirante e exemplo numérico                                                  |

A edição bibliográfica completa dos dois livros não foi inferida a partir de trechos sem folha de rosto. O trecho de El Debs remete explicitamente à NBR 9062/85. Textos, tabelas, páginas digitalizadas e PDFs das fontes não são redistribuídos no pacote. Há equações implementadas e referências para consulta nos exemplares do usuário.

## Decisões entre fontes

| Questão                    | Diferença encontrada                                                                                     | Decisão do motor                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| γn                         | 6118 §22.2 indica pelo menos 1,2; 9062 §7.3.1.1 distingue produção e predominância da ação permanente    | `max(1,2; γn9062; γn informado)`. É política conservadora explícita, não declaração de que os textos são idênticos                |
| Fronteira a/d = 0,5        | A classificação literal da 6118 inclui a fronteira em curtos; a 9062 a inclui em muito curtos            | Convenção da 9062. A memória registra o modelo; bielas pode ser solicitado para monolítico                                        |
| Costura                    | 9062 expressa **área por altura**; 6118 prescreve **área total** de pelo menos 40% do tirante nos curtos | Converter corretamente as grandezas e usar o envelope descrito adiante                                                            |
| Resistência no muito curto | Limites de 6 MPa e coeficientes antigos aparecem em El Debs                                              | Usar a expressão da 9062:2017, com teto 8 MPa; não copiar limites históricos como norma atual                                     |
| H mínimo                   | O livro traz a aproximação histórica H/V = 0,20                                                          | Usar tipo de apoio da 9062:2017 ou resultante de análise justificada                                                              |
| Taxa mecânica máxima       | ω = 0,15 aparece no tratamento histórico                                                                 | Não apresentá-la como limite atual. No modelo de atrito, a demonstração de ductilidade permanece pendente de análise complementar |
| Suspensão                  | O tratamento simplificado do livro pode atribuir parcela da reação ao mecanismo direto                   | Dimensionar para **100% da ação indireta**, conforme as normas fornecidas                                                         |
| Barra soldada              | Regras de várias barras transversais e regra de barra única são diferentes                               | Barra única com mesmo diâmetro, geometria e qualificação específica; não usar a regra de 60% do tirante                           |
| CA-60 / aderência          | A definição de η1 depende da superfície do fio/barra                                                     | Preservar η1 = 2,25 para CA-50 e 1,00 para CA-25/CA-60; CA-60 pendente de confirmação pelo responsável técnico, conforme issue #3 |

## Unidades e entradas

Internamente: **mm, N, MPa = N/mm² e mm²**. Na interface: cm, kN, MPa e cm², sempre com conversão explícita. Contagens inteiras. Sem arredondamento intermediário; arredondar somente na apresentação.

- `a` geométrico: distância da face do suporte ao centro físico do apoio; `a_calc`: distância até a resultante adotada, coincidente com a quando não há deslocamento.
- `bearingLength`: comprimento da área de transmissão na direção de a; não é o cobrimento.
- `bearingWidth`: largura efetiva transversal centrada. Não se presume dispersão transversal até toda a largura do consolo.
- `bearingHeight`: altura da linha de ação de H acima da superfície superior do concreto.
- `columnWidth`: dimensão disponível do suporte na direção da ancoragem.
- N1: ramos longitudinais resistentes. Uma alça horizontal tem dois ramos na mesma camada.
- N2/N2b: estribos horizontais fechados nos 2/3 d superiores e terço inferior.
- N3: posições de armadura vertical, com **2 ou 4 ramos efetivos**, configurados em `rebar.stirrupBranches`. Quatro ramos correspondem a um estribo fechado externo mais um grampo interno da mesma bitola, por posição.
- `As,N3,prov = ramosN3 × quantidadeN3 × πφ²/4`; a sugestão arredonda para cima `As,N3,req/(ramosN3 × πφ²/4)` e mantém os limites existentes de quantidade e espaçamento. Demanda e distribuição longitudinal não mudam. Cinco posições Ø6,3 resultam em 311,7245310524472 mm² com dois ramos e 623,4490621048944 mm² com quatro.
- N4 é construtiva obrigatória: `quantidadeN4 = ramosN3`, bitola inicial Ø8 mm em `rebar.constructiveDiameter`. Não é somada a nenhuma capacidade nem dimensionada pela sugestão. Seu ajuste físico pertence às pendências de detalhamento.
- N5: fendilhamento transversal; N6: suspensão. Mantêm dois ramos efetivos por estribo e os campos `splitting*`/`suspension*`, sem dupla contagem.
- As áreas de confinamento da ancoragem e de armadura local do suporte são informadas como áreas efetivas, com direção e ancoragem compatíveis. O software não presume sua existência.

### Altura útil

Para cada camada, o centro da primeira fileira está em `c + φN3 + φN1/2 + acréscimo`. O espaço livre vertical entre fileiras é `max(20 mm; φN1; 0,5 dag)`. As barras se distribuem entre as camadas; o centroide é ponderado pelo número de barras. `d = h − d′`.

Todo novo arranjo da busca automática recalcula d, a/d, forças internas, armaduras mínimas e todas as combinações. Não se usa altura útil fixa após alterar bitola ou camadas.

### Busca de armadura sugerida

A busca avalia bitolas em ordem crescente (6,3; 8; 10; 12,5; 16; 20; 25 mm), contagens de 2 a 24 e camadas de 1 a 3. O passo de contagem é 2 para alças e 1 para barra soldada. Mantém a pontuação `área + camadas·0,001 + contagem·0,00001`: a área tem prioridade; camadas e contagem são critérios de desempate. Não se procura uma solução de uma camada a qualquer custo de área.

Antes do julgamento, cada candidato recebe o dimensionamento de quantidades de costura superior e inferior, estribos, fendilhamento e suspensão, seguido de recálculo. A viga mantém o dimensionamento por área e pelo menor espaçamento máximo entre as combinações; acima de h = 600 mm, N2 não é alterado como costura e a pele continua `review`. Demandas omitidas por domínio de flexão inválido não são convertidas em contagens NaN; a falha do domínio continua bloqueando a proposta.

Além dos ids críticos anteriores, entram `stitch`, `stitchSpacing`, `stitchZone`, `stitchClear`, `stitchDiameter`, `lowerStitch`, `lowerSpacing`, `transverse`, `suspension` e `splitting`. A costura e suas regras de disposição só se aplicam fora de viga ou, na viga, com h ≤ 600 mm; a costura inferior só no muito curto; `transverse` só fora de viga; suspensão só na carga indireta. `splitting` está presente com exigência zero quando não há fendilhamento a dimensionar. Condições de zona, espaço livre e diâmetro continuam sendo restrições geométricas: a busca não muda a bitola secundária para contorná-las. O candidato só é viável com resultado calculável, diferente de `invalid`, e nenhuma falha crítica após o dimensionamento. Conferências `review`, ancoragem informada e demais pendências externas não viram aprovação.

Em cada bitola, todas as camadas da primeira contagem viável são avaliadas antes de encerrar essa bitola. Uma contagem reprovada não impede testar as seguintes. A poda só ocorre quando a área supera **estritamente** a melhor área, preservando empates entre bitolas. `candidates` registra somente os arranjos avaliados após os descartes por camadas incompatíveis ou linhas ímpares, independentemente de quantos recálculos foram necessários.

Sem solução, a mensagem apresenta os rótulos críticos reprovados em todos os candidatos avaliados; sem interseção, usa o último arranjo avaliado da maior bitola. Se o dimensionamento exceder o esquema de edição e o motor não fornecer verificações, preserva a mensagem de domínio e as falhas da avaliação anterior para diagnóstico. Entradas fora do domínio recebem as razões do motor; ausência de candidatos avaliados é declarada. Nenhum dado é alterado nesses casos. As fórmulas, coeficientes e limites do motor permanecem iguais. Consulte a [validação da issue #16](VALIDACAO-BUSCA-ARMADURA.md).

## Ações

No modo característico:

`Vd = (Vk + peso próprio opcional) × γf × γn`

`Hinformado,d = max(0; Hk × γf × γn)`

No modo de cálculo, V e H já incluem os coeficientes, inclusive γn. O fator aplicado pelo motor é 1. As combinações são **fornecidas pelo usuário**; o programa não decompõe G/Q, não gera combinações segundo NBR 8681 e não usa coeficientes excepcionais.

| Apoio com movimento horizontal permitido | H estimado / Vd |
| ---------------------------------------- | --------------: |
| Seco                                     |            0,80 |
| Argamassa                                |            0,50 |
| Elastômero                               |            0,16 |
| PTFE                                     |            0,08 |
| Aço / aço não soldado                    |            0,25 |
| Concreto / chapa metálica                |            0,40 |

No modo estimado, H informado é **adicional**: `Hd = Hestimado + max(Hinformado,d; 0)`. Isso evita descontar uma compressão favorável da estimativa normativa. No modo análise, H é a resultante total e exige justificativa, mesmo quando nulo. Apoios impedidos, grauteados ou soldados não aceitam a estimativa.

O peso próprio usa 25 kN/m³ e o volume do prisma trapezoidal (ou da seção recortada, quando aplicada). É concentrado em a apenas se isso for conservador em momento: `xG = L(h+2h2)/(3(h+h2)) ≤ a`. Caso contrário, exige combinação equivalente justificada. Com recorte, área e xG são integrados no polígono da seção. θ e c2 dependem somente da geometria e do arranjo do tirante, não das forças V/H; portanto, o perfil é definido antes de adicionar o peso, sem iteração. Cada candidato de armadura recalcula esse perfil. Não se acrescenta automaticamente a forças já de cálculo nem à opção de carga indireta. Não se inclui peso do elemento apoiado sem entrada explícita.

Cada combinação conserva seu par simultâneo V/H. O envelope é feito **separadamente para cada verificação**. A combinação que maximiza As do tirante não necessariamente governa contato, ancoragem ou outro requisito.

## Materiais

### Classes de aço do tirante

As classes e suas regras estão centralizadas em `src/domain/steel.ts`. O seletor **Modelo > Materiais > Classe de aço do tirante** oferece:

| Classe | fyk (MPa) | η1 da aderência                    |
| ------ | --------- | ---------------------------------- |
| CA-25  | 250       | 1,00                               |
| CA-50  | 500       | 2,25                               |
| CA-60  | 600       | 1,00 — **pendente de confirmação** |

Os valores de η1 são os existentes, preservados exatamente conforme a [issue #3](https://github.com/ricardocorsini/consolo-struct/issues/3). Para CA-60, o valor conservador 1,00 aguarda decisão do mantenedor/engenheiro responsável sobre a superfície do fio/barra; esta contribuição não resolve essa decisão nem afirma confirmação normativa. Não se transfere automaticamente η1 = 2,25 de CA-50 para CA-60. Referências para consulta: NBR 6118:2026 §§8.3 e 9.3.2.

O mesmo módulo concentra os fatores de pino da alça, a exigência de gancho de CA-25 e os limites de aplicabilidade de dobramento de CA-60. As fórmulas e bitolas permanecem iguais. A resistência de cálculo continua usando o fyk numérico e os coeficientes dos materiais já adotados. O aço transversal conserva o esquema 500/600 MPa, apresentado pelos mesmos rótulos CA-50/CA-60.

A classe é derivada da leitura de `materials.fyk`, que permanece **numérico** no arquivo; não se grava um novo campo de classe. A evolução para o esquema 5 decorre de N3/N4. Um valor legado como 420 MPa abre e permanece 420 MPa ao salvar. O seletor mostra **Personalizado (420 MPa), não suportado**, e o motor mantém a mensagem e o estado `unsupported`. A escolha de uma classe válida é explícita e participa de Desfazer/Refazer. Não há arredondamento ou enquadramento automático por faixa.

Relatório, PDF, desenhos e quadro de aço usam os rótulos do módulo, sem inventar classes como CA-42 para valores personalizados. A prévia geométrica de mandris de valores legados mantém seu comportamento histórico, sem atribuir uma classe nem tornar o aço calculável. Essa compatibilidade de desenho não valida a ancoragem; o detalhamento continua sinalizando o cálculo fora do escopo.

### Coeficientes dos materiais

Combinação normal: padrões γc = 1,40 e γs = 1,15. Ambos são editáveis **por peça**, entre 1,0 e 2,0, em Cálculo ou em **Configurações > Dimensionamento > Coeficientes dos materiais da peça selecionada**. Projetos antigos recebem os padrões ao abrir, introduzidos no esquema 4 e preservados no esquema 5. Alterar o processo de produção não preenche nem reduz coeficientes automaticamente.

Pares de referência adotados exatamente como informados na [issue #2](https://github.com/ricardocorsini/consolo-struct/issues/2), sem acesso aos textos normativos nesta contribuição:

| Processo                                          | γc de referência | γs de referência |
| ------------------------------------------------- | ---------------- | ---------------- |
| Pré-moldado (`precast`)                           | 1,40             | 1,15             |
| Moldado no local (`cast`)                         | 1,40             | 1,15             |
| Pré-fabricado com controle de fábrica (`factory`) | 1,30             | 1,10             |

A redução para pré-fabricados é tratada como **permissão** da NBR 9062:2017 §8.1, conforme a issue, e exige decisão explícita do responsável técnico. O produto não certifica o enquadramento do elemento nessa permissão. Referências: NBR 9062:2017 §8.1; NBR 6118:2026. A confirmação normativa e das condições reais de produção cabe ao responsável técnico; não se reproduz texto das normas.

Cada coeficiente adotado abaixo da referência de produção é listado, com valor adotado e referência, numa verificação `materialSafety` com estado **review**. A edição não é bloqueada por esse motivo. Igualdade ou valores superiores não geram essa pendência. Uma falha em outra verificação ainda pode determinar o estado geral `fail`; o aviso individual continua `review`. Adotados e referências ficam registrados na memória, PDF e cálculo auditável. As notas de detalhamento registram valores alterados e eventuais pendências, preservando os desenhos padrão.

`fcd = fck/γc`; `fyd = fyk/γs`; `αv2 = 1−fck/250`.

Também se usam os coeficientes adotados em `fctd = 0,7 fctm/γc`, na ancoragem, e em `fywd = min(fywk/γs; 435 MPa)`. A armadura mínima por flexão recebe os mesmos γc e γs. Permanecem os tetos de 435 MPa de `fydLimited` e `fywd`, sem alteração das demais fórmulas ou constantes.

Para C30/CA-50, 1,40/1,15 produz `fcd = 21,4285714286 MPa` e `fyd = 434,7826086957 MPa`; 1,30/1,10 produz `fcd = 23,0769230769 MPa` e `fyd = 454,5454545455 MPa`. Neste segundo caso o tirante usa **435 MPa** pelo teto existente; a variação da armadura não é necessariamente a estimativa de 4,3% da issue. Unidades internas permanecem mm, N e MPa, sem arredondamento intermediário. γf, γn, combinações e classes de aço não são alterados por esta configuração.

Para os modelos de consolo adota-se conservadoramente `fy = min(fyd; 435 MPa)`, conforme recomendação do trecho de El Debs. Para costura e suspensão, o limite 435 MPa também é explícito na 9062. A ancoragem usa fyd do material, sem reduzir artificialmente a força de escoamento.

Resistências de bielas/nós da 6118 §22.3.2:

- fcd1 = 0,85 αv2 fcd;
- fcd2 = 0,60 αv2 fcd;
- fcd3 = 0,72 αv2 fcd.

Por padrão, o motor adota fcd2 para a biela fissurada, fcd3 no nó sob apoio e fcd1 no nó comprimido junto ao suporte. Na biela também se compara o limite da 9062 (fcd para carga direta; 0,85 fcd indireta), conservando o menor. A escolha alternativa descrita a seguir afeta somente a verificação da biela.

### Critério selecionável do limite da biela

O parâmetro `design.strutLimit` pertence à **peça selecionada**. Pode ser editado em **Configurações > Dimensionamento > Limite da biela da peça selecionada** ou no mesmo controle em **Cálculo > Modelo e ações** das propriedades. Não é uma mudança global nos critérios das demais peças. Novas peças e arquivos antigos sem o campo usam `fcd2`.

Os limites abaixo seguem exatamente a proposta da issue #5. Para fck = 30 MPa, γc = 1,4 e αv2 = 0,88:

| Valor                       | Limite da verificação `strut` | Limite em MPa | Restrição                                     |
| --------------------------- | ----------------------------- | ------------: | --------------------------------------------- |
| `fcd2` (padrão conservador) | `min(0,60·αv2·fcd; β·fcd)`    |       11,3143 | β = 1 para carga direta ou 0,85 para indireta |
| `fcd3`                      | `0,72·αv2·fcd`                |       13,5771 | Carga direta ou indireta                      |
| `indirect085`               | `0,85·fcd`                    |       18,2143 | Somente carga indireta                        |
| `direct100`                 | `fcd`                         |       21,4286 | Somente carga direta                          |

Não há arredondamento intermediário; os números da tabela foram arredondados apenas para apresentação. O padrão conserva os valores e as verificações anteriores. As opções incompatíveis com a introdução da carga ficam desabilitadas. Um arquivo editado à mão com `direct100`/carga indireta ou `indirect085`/carga direta recebe `unsupported` com a explicação em português; não é silenciosamente convertido para outro critério.

**Apenas o limite de `strut`, no modelo de bielas e tirantes, muda.** Sua tensão solicitante e geometria não mudam. Nós (`nodeSupport`), apoio (`bearing`), escoamento prévio (`ductility`, ainda calculado com fcd2/fcd3/fcd1 originais), inclinação (`angleMin`) e verificações complementares de El Debs mantêm seus valores. Atrito-cisalhamento e viga em balanço não usam esse limite: uma escolha compatível com a carga fica registrada, mas não altera as verificações desses modelos nem acrescenta uma conferência de biela que não foi aplicada.

Quando uma alternativa é aplicada à biela, a verificação adicional `strutLimitCriterion` tem estado **`review`**, com o critério, o limite escolhido e o limite do padrão em MPa. Essa conferência não aprova nem reprova por si só; uma falha de outra verificação continua sendo falha. Mesmo que `strut` passe com o limite menos conservador, a pendência `review` permanece, inclusive na sugestão de armaduras. Memória, relatório, PDF e cálculo auditável registram a fórmula escolhida e essa pendência. O campo foi introduzido no esquema **4** e permanece no esquema **5** atual.

As referências informadas para as alternativas são as indicadas na issue #5 do repositório: NBR 6118 §22.3.2 (`fcd3`) e NBR 9062:2017 §7.3.4.1, alíneas b (`indirect085`) e a (`direct100`). **Essas indicações não foram conferidas no texto normativo nesta contribuição.** Não se afirma equivalência ou aplicabilidade normativa das alternativas; elas exigem avaliação do responsável técnico. Não foram reproduzidos textos de normas.

`fctm = 0,3 fck^(2/3)` até C50; acima, `2,12 ln[1+0,1(fck+8)]`, conforme o documento de 2026. `fctk,inf = 0,7 fctm`; `fctk,sup = 1,3 fctm`.

Na avaliação da armadura mínima de flexão, empregam-se αc e ηc da edição fornecida, com `ηc=1` até C40 e `(40/fck)^(1/3)` acima. Não se introduz ηc silenciosamente nas expressões próprias de §22.3.2.

## Modelos resistentes

### Curto — 0,5 < a/d ≤ 1

Geometria baseada em Araújo, §4.5:

`tanθ = (d−d′)/(a+c_ap/2)`; `z = a tanθ`; `e = d′+h_ap`.

Limitar a inclinação ao domínio de §22.3.1: tanθ entre 0,57 e 2. O modelo pode reduzir a altura efetiva para respeitar o limite superior. Não aumentar uma tangente insuficiente: nesse caso há falha.

`T = Vd a/z + Hd(1+e/z)`

`Fc = (Vd+Hd e/a)/senθ`

A largura da biela é obtida por expansão do apoio na altura 2d′. O programa limita essa abertura à dispersão 1:2 relativa à vertical: `c1 = min(c_ap+2d′/tanθ; c_ap+2d′)`; `c2=c1 senθ`. Essa redução da área é uma adaptação conservadora documentada em relação à geometria do livro; não se altera o equilíbrio de momentos adotado.

`σb = Fc/(b_eff c2)`

Além do modelo geométrico, usa-se o piso simplificado da 9062 §7.3.5.3:

`As9062 = [(0,1+a/d)Vd + Hd]/fy`.

`Asmodelo = max(T/fy; As9062)`.

A verificação de escoamento prévio compara a capacidade do tirante com a força de tirante na primeira resistência do concreto, sob crescimento proporcional de V/H. É uma verificação mecânica do **modelo adotado**, não uma promessa de ductilidade global:

`As,ef fy ≤ T × min(fcd2/σb; fcd3/σapoio,max; fcd1/σn)`.

### Muito curto — a/d ≤ 0,5

Automático: atrito-cisalhamento da 9062 §§7.3.4.2 e 7.3.5.4.

`Asatrito = (0,8 Vd/μ + Hd)/fy`.

μ = 1,4 monolítico; 1,0 junta rugosa preparada segundo §6.3.4; 0,6 junta lisa. A rugosidade não é presumida: exige confirmação.

`ρ = As,ef/(bd)`

`τwd = Vd/(bd)`

`τwu = min[3+0,9ρfy; 0,27(1−fck/250)fcd; 8 MPa]`.

Complemento de El Debs: a área não fica abaixo da obtida pelo equilíbrio com braço 0,9d:

`AsElDebs = [Vd a/(0,9d) + Hd(1+(d′+h_ap)/(0,9d))]/fy`.

É usado o equilíbrio completo, sem aproximar o multiplicador de H para 1,2.

`Asmodelo = max(Asatrito; AsElDebs)`.

**Ductilidade permanece com estado “conferir” no modelo de atrito.** A expressão empírica de resistência, isoladamente, não fornece demonstração completa de que o tirante escoa antes de mecanismos frágeis. O antigo limite ω=0,15 não foi promovido a requisito vigente. Não existe botão que transforme essa pendência em aprovação.

Para concretagem monolítica é possível selecionar explicitamente bielas, usando a extensão de Araújo para muito curtos: limitar tanθ a 1,4 e usar a altura efetiva correspondente. Esse caminho deve ser avaliado pelo projetista; não é usado para juntas de concretagem. Em casos muito altos, não se utiliza a dispensa de costura de §7.3.3.13.

### Viga em balanço — 1 < a/d ≤ 2

Com o modelo resistente **Automático por a/d**, a peça com `1 < a/d ≤ 2` é calculada como viga em balanço (classificação `cantilever`, método `beam`), em paridade com o GN Corbel. A fronteira `a/d = 1` continua no consolo curto e `a/d = 2` pertence à viga em balanço. Bielas e tirantes ou atrito-cisalhamento escolhidos explicitamente com `a/d > 1` são interrompidos com orientação para usar o modo automático; `a/d > 2` está fora do domínio. Unidades do núcleo (mm, N, MPa), sem arredondamento intermediário. `fy` é a tensão do tirante limitada a 435 MPa, como nas demais armaduras.

Esforços: `Vsd = Vd`; `Msd = Vd a + Hd (h_ap + d′)`. O braço de H inclui a altura do apoio, como em `e = d′+h_ap`.

Flexão simples com bloco retangular:

`kmd = Msd/(b d² fcd)`; `radicando = αc²λ² − 2αcλ² kmd`.

Se `radicando < 0` (equivalente a `kmd > αc/2`), a verificação **domínio da flexão** falha e As,flex fica **indeterminada**: o valor é omitido na memória e nas exportações, sem número sentinela, e a armadura necessária do tirante, a costura e a ancoragem que dela dependem também ficam indeterminadas. Caso contrário:

`kx = (αcλ − √radicando)/(αcλ²)`; `kz = 1 − λkx/2`; `As,flex = Msd/(kz d fy)`; `As,h = Hd/fy`; `Asmodelo = As,flex + As,h`.

`As,req = max(Asmodelo; mínimo de flexão; 0,04 fck/fyk · b d)`, sem os termos de El Debs, que são do consolo curto.

Cisalhamento pelo Modelo I, desconsiderando a parcela do concreto (`Vc = 0`) nesta faixa de a/d:

- `VRd2 = 0,27 αv2 fcd b d` e `Vsd ≤ VRd2`. Aumentar estribos não resolve essa verificação; a sugestão de armaduras não a contorna.
- `(asw/s)nec = Vsd/(0,9 d fywd)`, com `fywd = min(fywk/γs; 435)`; `(asw/s)mín = 0,2 (fctm/fywk) b`; adota-se o maior.
- `Atransv,nec = max((asw/s) L; 0,0015 b h)`, comparada com N3 (2 ou 4 ramos efetivos por posição) ao longo do comprimento L do consolo.
- `smáx = min(0,6d; 300 mm)` se `Vsd ≤ 0,67 VRd2`; senão `smáx = min(0,3d; 200 mm)`. Compara-se o passo real de N3, o mesmo calculado pelo detalhamento (`stirrupLayout`); com um único estribo, compara-se L.

Armadura de face, conforme a altura h junto ao suporte:

- `h ≤ 600 mm`: costura por analogia ao consolo curto, `(As/s)cost = max(0,4 As,req/d; 0,0015 b)` e `Acost,nec = (As/s)cost · 2d/3`. Não se usam os termos de área total do consolo curto (0,4 As,ef e literatura) nem a faixa mínima do terço inferior. A oferta são os ramos de N2 cujos eixos desenhados ficam na faixa 2d/3; mantêm-se as regras de disposição da costura.
- `h > 600 mm`: não há costura. A armadura de pele necessária é `As,pele = 0,001 b h` **por face**. Como o programa não tem entrada nem detalhamento de pele, a verificação fica sempre em **conferir**, com a área por face e total; o dimensionamento e o detalhamento da pele são do projetista.

Continuam valendo tirante, taxa mecânica mínima, mínimo de flexão, compressão sob o apoio, ancoragem, geometria e disposições construtivas, cobrimento, alça ou solda, armadura local do suporte, fendilhamento e suspensão. Não são geradas as verificações de bielas e tirantes (biela, inclinação, nó, escoamento prévio), nem os valores desse modelo. Os complementos de El Debs não se aplicam e uma nota da memória registra isso; mantém-se apenas o piso de força de entrada `Hd ≥ 0,20 Vd`, quando ativado, por ser uma regra das ações e não do modelo do consolo curto.

O modelo **não cobre**: `a/d > 2`; bielas e tirantes além de `a/d = 1`; ELS, fissuração e flecha da viga em balanço; fadiga; torção; dimensionamento e detalhamento da armadura de pele além do aviso; consolos duplos; verificações de ductilidade `x/d`, armadura máxima e rotação plástica (tratadas na issue de ductilidade).

Referências **citadas no GN Corbel e ainda não conferidas** nos textos da ABNT: NBR 6118 §14.6.4.3, §17.2, §17.3.5.2.3, §17.4.2.2 e §18.3.3.2; NBR 9062:2017 §7.3.6 e §7.3.7.2. A conferência, assim como as decisões abaixo, cabe ao mantenedor e ao responsável técnico:

- `Vc = 0` para `a/d > 1`; Msd com `h_ap` no braço de Hd (composição conservadora).
- Pele de 0,10 % b h por face acima de 600 mm; costura abaixo de 600 mm com k = 0,4 sobre a armadura necessária do tirante.
- Manutenção do piso `H ≥ 0,20 V` de El Debs nesta faixa.
- `fy` limitado a 435 MPa na flexão; o GN Corbel usa `fyd` sem teto, o que só difere para CA-60.
- Junta de concretagem não monolítica com `a/d > 0,5` em modo automático continua interrompida.

Os casos de referência A, B e C da issue #6 foram reproduzidos executando o motor, com diferença relativa máxima de 4,3×10⁻⁵ (arredondamento dos valores manuais), e estão fixados em `tests/engine.test.ts`.

### Armadura mínima

A área necessária é o maior entre o modelo, o mínimo de flexão e o mínimo mecânico da 9062.

Para a flexão mínima: `Mmin=0,8 W0 fctk,sup`, `W0=bh²/6`; resolver equilíbrio da seção retangular com bloco de tensão αc ηc fcd e altura útil real. Usar ainda o piso absoluto `0,0015bh`.

Mínimo mecânico: `ω=(As,ef/bd) fyk/fck > 0,04`. A desigualdade é estrita e verificada separadamente; não foi substituída por “≥”.

## Compressão sob apoio e fendilhamento

O carregamento vertical é centrado no comprimento informado. A altura da linha de H gera excentricidade local `e_ap=Δa+Hd h_ap/Vd`. Para contato integral, assume-se distribuição linear e verifica-se:

`σmax = Vd/(b_eff c_ap) × (1+6 e_ap/c_ap) ≤ fcd3`.

Se `e_ap > c_ap/6`, o motor **interrompe** a solução: não extrapola a distribuição linear para contato que admite descolamento. Não há aumento da resistência por confinamento de área parcialmente carregada. Rigidez, rotação, cisalhamento, escorregamento e resistência do aparelho de apoio são verificações separadas.

Quando a borda lateral do apoio dista da lateral do consolo mais que o cobrimento, há armadura exclusiva de fendilhamento transversal N5, com base no modelo de bloco parcialmente carregado centrado de El Debs:

`Ffend = 0,30 Vd(1−b_eff/b)`; `AsN5 = Ffend/fywd`.

Esse modelo não resolve excentricidade transversal, fendilhamento no plano horizontal da alça nem ancoragem de pinos. Não se conta N5 novamente como N2 ou N3.

## Armaduras secundárias

Para a costura, define-se Asv pela parcela vertical do modelo conservador. No modelo bielas, o programa conserva ainda o efeito amplificador da excentricidade de H ao subtrair somente Hd de T; isso é conservador em relação à parcela estritamente vertical.

Altura da zona superior: `z_cost=2d/3`.

`r9062 = k Asv/d`, k=0,4 curto e 0,5 muito curto.

`rmin = 0,0015b` em mm²/mm (equivale a 0,15b em cm²/m quando b está em cm).

`Ascost,req = max(r9062 z_cost; rmin z_cost; 0,4As,tir,ef [curto]; kAsv [complemento El Debs])`.

Quantidade mínima: arredondar para cima considerando **dois ramos** por estribo. Além da área, verificar φ ≤ min(b,h)/15, espaçamento ≤ min(100 mm; a_calc) e espaço livre adotado construtivamente para concretagem. O cálculo usa os eixos reais da costura superior: primeira barra abaixo da última camada do tirante, última em d′+2d/3, espaçamento entre eixos (yúltima−yprimeira)/(n−1). O detalhamento e as vistas usam a mesma distribuição. Para uma barra só, o vão tributário adotado é 2d/3. Verifica-se também se a zona comporta a costura. No muito curto, o terço inferior recebe costura mínima adicional.

Para ação direta, N3 ≥ 0,0015bh. Para ação indireta, N6 ≥ Vd/fywd e não se inclui a mesma área em duas famílias. Arranjo e ancoragem dos estribos secundários precisam ser definidos no detalhamento executivo; o desenho esquemático não os certifica.

## Ancoragens e geometria

- Ancoragem do tirante no suporte: fbd = η1 η2 η3 fctd, conforme §§8.3 e 9.3.2. Má aderência usa η2=0,7; boa aderência precisa ser justificada.
- `lb = max(φ fyd/(4fbd); 25φ)`.
- `lb,nec = max(α · lb · razão; 0,3lb; 10φ; 100 mm)`, com `razão = As,req/As,ef`. A opção conservadora **Limitar a razão As,req/As,ef ao mínimo de 1,0** (`anchorRatioFloor`, desligada por padrão) usa `razão = max(1,0; As,req/As,ef)`. A norma não exige esse piso; com a opção desligada o resultado é o anterior. Os pisos `0,3lb`, `10φ` e `100 mm` não mudam.
- Coeficiente α (NBR 6118 §9.4.2.5). "Gancho" significa gancho com cobrimento normal ao plano do gancho ≥ 3φ:

  | Ancoragem no suporte                                         | α   |
  | ------------------------------------------------------------ | --- |
  | Reta, sem barra transversal soldada                          | 1,0 |
  | Gancho com cobrimento normal ≥ 3φ                            | 0,7 |
  | Gancho com cobrimento normal < 3φ, sem barra soldada         | 1,0 |
  | Barra transversal soldada, sem gancho ou com cobrimento < 3φ | 0,7 |
  | Gancho com cobrimento normal ≥ 3φ **e** barra soldada        | 0,5 |

  O valor 0,5 vale somente para gancho + barra soldada; barra soldada sozinha é 0,7.

- A barra transversal soldada (`supportWeldedBar`, desligada por padrão) é uma declaração do usuário (§9.4.2.2). O programa não verifica diâmetro, posição nem execução dessa barra e, quando ela é declarada, gera a pendência **Barra transversal soldada na ancoragem** com estado "conferir". Ela não se confunde com a barra transversal soldada da extremidade frontal (`frontAnchor`).
- A verificação de ancoragem, a memória, o PDF e o cálculo auditável registram α, a razão usada (com ou sem o piso 1,0) e `lb`. Projetos sem os dois campos abrem com ambos desligados, introduzidos no esquema 4 e preservados no esquema 5.
- O percurso real do gancho permanece pendente, pois a geometria integral do suporte não é definida.
- Armadura de confinamento na ancoragem, para as bitolas admitidas no consolo: capacidade ≥25% da força de uma barra (§9.4.2.6.1).
- Armadura local na face do suporte ≥área efetiva do tirante (§7.3.3.14). Não é dimensionamento do pilar.
- CA-25 tracionado não aceita ancoragem exclusivamente reta.
- Alças horizontais: número par de ramos em cada camada; pino mínimo conforme tabela 9.1; espaço físico transversal. Não se desenha gancho vertical frontal como se fosse solução universal.
- A dispensa de armadura contra fendilhamento no plano da alça exige carga direta e `3c ≤ a2 ≤ 3(c+φ)`. Fora dessa condição há pendência específica; os mínimos de pino não são tomados como prova de suficiência.
- Barra transversal única soldada: mesmo φ, limites geométricos de §9.4.7.1, procedimento de solda e resistência informados. Verifica-se a força de projeto por ramo e um piso de 1,15 da força de escoamento nominal do ramo. O requisito de qualificação com resistência medida, as normas de soldagem e os ensaios não são substituídos por esse cálculo. Reduções aplicáveis à resistência devem constar da Rwd informada.
- `a2=L−a−c_ap/2`; verificar afastamento frontal de §7.3.3.4 e h2 ≥ h/2−a2.
- Tirante inteiro no quinto superior de h; φ ≤ min(25; min(b,h)/8) para alça ou /6 para soldada; distância em planta ≤ min(d;15φ) ou min(d;20φ).
- Espaço livre horizontal ≥max(20;φ;1,2dag); critérios de disposição de §18.3.2.2 adotados explicitamente.

### Recorte do concreto excedente

Opção por peça (`excessConcrete`, padrão `keep`), em Configurações > Dimensionamento > Concreto excedente da peça selecionada.

- `keep` preserva a face inferior reta de (0; h) a (L; h₂). Resultados, volume, desenhos e quadro de aço ficam idênticos aos anteriores.
- `remove` só se aplica quando o método resolvido é bielas e tirantes (0,5 < a/d ≤ 1 no automático, ou bielas e tirantes explícito). A linha de recorte é a face inferior da biela do próprio modelo, prolongada: `y(x) = max(h; d + (c2/2)·√(1+tan²θ)) − tanθ·x`, com eixo da biela `y = d − tanθ·x` e `c2` como em "Curto". O intercepto nunca fica acima de h, de modo que a face do suporte, o nó inferior e a interface permanecem íntegros.
- A nova face inferior é `min(face original; max(y(x); h₂))`: segue a face original junto ao suporte, a face inferior da biela no trecho intermediário e a horizontal em h₂ até a ponta. h, h₂, L, a, o tirante, as alças e a ancoragem no suporte não mudam.
- Não há recorte quando a biela não fica abaixo da face original (`tanθ ≤ (h−h₂)/L` ou `y(L) ≥ h₂`), inclusive em consolos retangulares (h₂ = h), nem em atrito-cisalhamento ou viga em balanço. Nesses casos a geometria original é mantida e a memória registra a nota `excessConcrete` com estado `na`.
- Com recorte aplicado, a nota `excessConcrete` tem estado `review` e informa ângulo e largura da biela, os vértices da face inferior e a área removida. As verificações usam as mesmas dimensões; o peso próprio automático e seu centroide passam a usar a seção recortada.
- Estribos verticais, costuras e N4 construtiva seguem a face recortada com o mesmo cobrimento (distância mínima à poligonal da face). Desenhos, modelo 3D, DXF/SVG e quantitativos de volume usam o mesmo perfil.

### Detalhamento “Armado como viga”

Opção de detalhamento por peça (`detailing.barArrangement`, padrão `consolo`), em Configurações > Detalhamento > Armado como viga. Disponível somente com `excessConcrete: keep`.

- Não altera o cálculo: o modelo, as verificações e o resultado são os mesmos do modo `consolo`, inclusive o tipo de ancoragem frontal declarado no cálculo.
- Tirante (negativa): na primeira camada, barra superior de `x = −(P − c − φ/2)` a `x = L − c − φ/2`, com dobras de 90° (mandril da tabela 9.1) descendo no suporte e na ponta. A perna reta de cada extremidade é `max(8φ; lb,nec − trecho reto − arco)`, com `lb,nec = max(α·lb·razão; 0,3lb; 10φ; 100)`, usando `lb` e a razão do motor (inclusive o piso opcional). O α é 0,7 apenas com cobrimento lateral ≥ 3φ; caso contrário, 1,0. Não se aplica desconto pela declaração de barra soldada no cálculo, pois essa barra não é detalhada neste modo (NBR 6118:2026 §9.4.2.5). As pernas de camadas sucessivas são aninhadas, sem eixos coincidentes. No suporte o trecho reto conta a partir da face do pilar; na ponta, a partir da borda interna da placa de apoio (`a − ℓplaca/2`). A perna da ponta termina acima da face inferior com cobrimento, e a do suporte dentro da altura h.
- Positiva: `n` barras inferiores de bitola φp (padrão 2 × 10 mm) a `c + φestribo + φp/2` da face inferior, seguindo a face inclinada, por dentro das pernas do tirante, com dobras subindo nas duas extremidades até abaixo da última camada do tirante. `lb,nec,p = max(α·lb,p; 0,3lb,p; 10φp; 100)`, com `lb,p = lb·φp/φ` e α = 0,7 quando o cobrimento lateral ≥ 3φp (senão 1,0). Não é computada como armadura resistente. É uma família independente P1; N4 permanece obrigatória e interferências entre elas geram pendência impeditiva. A dobra frontal acompanha o ângulo entre o trecho inferior inclinado e a perna vertical, com arco e ponta reta medidos nesse percurso. As pontas ficam abaixo da última camada do tirante; a quantidade deve caber na largura com espaço livre ≥ max(20; φp; 1,2dag).
- Quando a perna necessária não cabe, a perna é limitada ao contorno e o detalhamento registra `beam-top-anchor` (impeditiva) ou `beam-bottom-anchor` (conferir). Em todos os casos registra `beam-review`, porque a NBR 9062 §7.3.3.6–7 prevê alça ou barra transversal soldada na ponta de consolos.

## Durabilidade

Cobrimentos nominais de referência: 25/30/40/50 mm para CAA I/II/III/IV; classes mínimas C20/C25/C30/C40. Verifica-se também cobrimento ≥φ e dag ≤1,2c. Redução de 5 mm só mediante opção explícita de controle de qualidade e processo compatível; não se acumulam automaticamente outras reduções especiais.

Isso não verifica relação água/cimento, execução, tolerâncias, idade de carregamento ou vida útil. O resultado de “cobrimento atende” tem esse alcance específico.

## Domínio interrompido e verificações externas

São interrompidos: a/d>2, bielas e tirantes ou atrito escolhidos explicitamente com a/d>1, força vertical nula ou ascendente, geometria inválida, número não finito, força/excentricidade transversal, fadiga declarada, contato parcial, atrito para curto, junta não monolítica no modelo bielas, aço fora das classes modeladas e H não justificado em apoio impedido. O tipo `unsupported` não contém números de dimensionamento aparentes.

Permanecem externos: ELS e fissuração; dentes Gerber; consolos duplos, contínuos e espaciais; ciclos, impacto e sismo; pilar/painel/viga-suporte completos; projeto do aparelho de apoio; pinos/chumbadores; ensaios e metalurgia das soldas; geometria completa de ancoragem com gancho; detalhamento, comprimentos de corte e interferências das armaduras. Não se devem completar esses itens por simples troca de rótulo ou “aceitar aviso”.

## Arquivos e auditoria

- `.consolo.json`/`.lume.json`, esquema 5: entradas editáveis. Importa esquemas 1–4, com dois ramos N3 e N4 Ø8; conserva os dados semânticos de fendilhamento/suspensão. O porta-estribos antigo é retirado. O esquema 1 mantém a exigência de conferência dos dados novos. Quantidades antigas eram ilustrativas e precisam ser revistas, especialmente a contagem de estribos.
- `.calc.json`: snapshot completo das entradas, unidades, versão, política, todas as combinações, resultados intermediários e verificações. Não é um projeto editável e não é tratado como resultado confiável ao importar `.lume.json`.
- PDF: entradas, hipóteses, referências, envelope, memória de cada combinação e apêndice integral de entradas; usa transliteração dos símbolos para evitar caracteres gregos quebrados no PDF.
- CSV: quantidades e resumo de ELU recalculado. Não é lista de corte.
- DXF/SVG: somente geometria não executiva, mantendo a separação entre modelo de cálculo e detalhamento.

Qualquer alteração de entrada invalida a memória visível. Exportações calculadas usam sempre o estado atual. Um campo numérico inválido que ainda está em edição bloqueia calcular/sugerir/exportar.

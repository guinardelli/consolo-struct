# Histórico de alterações

Este arquivo resume as mudanças documentadas no código-fonte recebido. Não pressupõe que existam tags, releases publicadas ou instaladores para cada versão.

## Não lançado

- Corrige a interferência física N3/N3G do PR #41: grampo em plano longitudinal próprio, com altura recalculada, projeção identificada na seção e quantitativos coerentes. Reutiliza a folga livre de N3; arranjos sem espaço recebem erro impeditivo de interferência, folga ou cobrimento, sem alterar demanda, passo ou quantidade de ramos.

- N3 admite 2 ou 4 ramos efetivos por posição; quatro ramos detalham um estribo fechado externo e um grampo interno da mesma bitola. A área fornecida e a sugestão usam a quantidade de ramos, preservando demanda e espaçamento longitudinal.
- Acrescenta N4 construtiva obrigatória, Ø8 mm inicial editável em Armaduras, com uma barra por vértice inferior de N3. Geometria comum às vistas 2D/3D, detalhamento e exportações; prolongamento no suporte, face inferior inclinada/recortada e dobra frontal com mandril. Interferências geram pendências sem modificar entradas físicas. N4 não contribui para resistência.
- Arquivo de projeto passa ao esquema 5 e migra esquemas 1–4 com dois ramos N3 e N4 Ø8, retirando o porta-estribos opcional. Fendilhamento e suspensão passam a N5/N6, sem alteração dos campos semânticos. A positiva do modo viga permanece separada como P1; colisões com N4 são informadas.
- Mantém a cota d’ visível ao enquadrar seções A–A largas: a escala da seção passa a considerar a largura e a margem das cotas, sem alterar a elevação, os cálculos ou os arquivos. Complemento de revisão da integração #37.

- Corrige os círculos N2 nas duas faces da seção A–A de modelagem, incluindo a costura inferior: bitola e escala definem o raio, e o afastamento considera a geometria e o contorno visível de N3. Preserva níveis, contagens, seleção, cota d’, cálculos e demais vistas (issues #19 e #21).
- Acrescenta o modo de detalhamento “Armado como viga” (`detailing.barArrangement`, padrão `consolo`), em Configurações > Detalhamento. O tirante (negativa) passa a ser detalhado com barras superiores e dobras de 90° no suporte e na ponta; a armadura positiva, com barras inferiores (quantidade e bitola editáveis) e dobras nas duas extremidades, substituindo o porta-estribos. Elevação, corte, planta, formas de dobramento, quadro de aço, DXF/SVG, vista de trabalho e 3D mostram as dobras.
- As dobras do tirante são dimensionadas com lb e razão As,req/As,ef do cálculo, sem desconto por barra soldada não detalhada (contado da face do suporte e da borda interna da placa de apoio); as da positiva, para lb,nec da própria bitola. Pernas de camadas sucessivas aninhadas, positiva abaixo da última camada e verificação de espaço livre da positiva. Pernas limitadas ao contorno com o cobrimento informado; ancoragem que não cabe gera pendência (`beam-top-anchor` impeditiva; `beam-bottom-anchor` para conferência).
- O modo só se aplica com o concreto excedente mantido (`excessConcrete: keep`); com o recorte, a opção fica desabilitada e o detalhamento salvo como viga gera a pendência `beam-unavailable`. O cálculo não muda; a nota `beam-review` registra que a ancoragem frontal por dobra exige conferência (NBR 9062 §7.3.3.6–7) e que a positiva não é armadura resistente. Arquivos antigos abrem no modo atual, sem mudança de esquema.
- Acrescenta a opção por peça de manter ou remover o concreto excedente (`excessConcrete`), em Configurações > Dimensionamento > Concreto excedente da peça selecionada. O padrão `keep` preserva a geometria e os resultados anteriores; arquivos antigos abrem com `keep`, sem mudança de esquema.
- Com `remove` no modelo de bielas e tirantes, a face inferior é recortada abaixo da face inferior da biela, mantendo h na face do suporte e h₂ na ponta. Desenhos, 3D, detalhamento, quadro de aço, DXF/SVG, volume e peso próprio automático usam a seção recortada. A memória registra a nota `excessConcrete` (`review` quando aplicado; `na` quando não há recorte possível ou o método não é bielas e tirantes).
- Ancoragem do tirante no suporte (issue #12): o coeficiente α cobre os quatro casos da NBR 6118 §9.4.2.5. Reta vale 1,0; gancho com cobrimento normal ≥ 3φ vale 0,7; barra transversal soldada vale 0,7; gancho + soldada vale 0,5. Nova caixa **Barra transversal soldada na ancoragem** (`supportWeldedBar`) em Cálculo > Ancoragem no suporte e no Detalhamento. Quando marcada, gera uma pendência "conferir" sobre a geometria da barra, que o programa não verifica.
- Nova opção conservadora **Limitar a razão As,req/As,ef ao mínimo de 1,0** (`anchorRatioFloor`) em Cálculo > Ancoragem no suporte.
- A verificação `anchorage` mantém id e comparação; a fórmula passa a `lb,nec = max(α·lb·razão; 0,3lb; 10φ; 100)`. A memória, o PDF e o cálculo auditável mostram α, a razão usada e `lb`, e expõem os valores `anchorRatio`, `anchorRatioFloor` e `anchorWeldedBar`.
- Os quatro valores de α foram conferidos com a NBR 6118:2014 §9.4.2.5. O texto da edição citada pelo motor não foi conferido nesta contribuição.
- As duas opções vêm desligadas por padrão. Arquivos antigos abrem sem os campos, com resultados idênticos e sem mudança do esquema 4.
- Otimiza Sugerir armaduras: avalia todas as camadas da primeira contagem viável por bitola e poda apenas áreas estritamente maiores que a melhor encontrada, preservando a pontuação e os empates. O contador passa a mostrar candidatos efetivamente avaliados.
- Dimensiona costura superior/inferior, estribos, fendilhamento e suspensão em cada candidato antes de julgá-lo; inclui as respectivas verificações críticas e mantém o tratamento de viga/pele. Nenhuma fórmula ou limite do motor é alterado.
- Explica sugestões sem solução com os rótulos críticos comuns aos candidatos ou as falhas do último arranjo da maior bitola, preservando as entradas. Mantém as mensagens de domínio e as pendências externas; registra a comparação com buscas completas na validação da issue #16.
- Centraliza CA-25/CA-50/CA-60, fyk, η1, fatores de pino e restrições de dobramento em `domain/steel.ts`, preservando resultados e fórmulas. η1 do CA-60 permanece 1,00, pendente de confirmação pelo responsável técnico quanto à superfície do fio/barra, conforme issue #3.
- Substitui o fyk livre do tirante por seletor de classe em Materiais. Números legados, como 420 MPa, abrem como Personalizado, continuam `unsupported` e são preservados até escolha explícita, sem mudança do esquema numérico ou de sua versão.
- Unifica os rótulos de classe no aço transversal, memória, PDF, desenhos e CSV de detalhamento; memória/PDF e propriedades explicitam η1 e a pendência do CA-60. Sem alteração de γc/γs, critérios de biela ou dependências.

- Adiciona à esquerda da seção A–A da modelagem a cota de consulta d’, do topo ao centroide existente de todas as barras do tirante, em cm. Acompanha Mostrar cotas, alterações do arranjo e navegação, sem mudar cálculos ou arquivos. Primeira etapa da issue #19 (sub-issue #20); o posicionamento do grampo N2 fica para a #21.
- Torna γc e γs editáveis por peça em Cálculo e em Configurações > Dimensionamento > Coeficientes dos materiais da peça selecionada. Padrões 1,40/1,15 em arquivos antigos, sem mudança de esquema; histórico e salvamento preservam as escolhas. A troca de produção não muda os valores automaticamente.
- Usa os coeficientes adotados em fcd, fyd, fctd, fywd e armadura mínima de flexão, preservando os tetos de 435 MPa. Registra adotados e referências na memória, PDF, cálculo auditável e notas de detalhamento com valores alterados.
- Acrescenta pendência `review` para cada coeficiente abaixo do par informado na issue #2: pré-moldado/moldado no local 1,40/1,15; pré-fabricado 1,30/1,10. A redução é tratada como permissão da NBR 9062:2017 §8.1, sujeita à decisão do responsável técnico; o produto não certifica o enquadramento do elemento. Referências normativas não conferidas nesta contribuição. γf, γn, combinações e classes de aço permanecem iguais.
- Adiciona o critério selecionável do limite da biela (`strutLimit`): padrão `fcd2` preservado e alternativas `fcd3`, `indirect085` e `direct100`. Opções incompatíveis com a introdução da carga ficam desabilitadas e são rejeitadas pelo motor com `unsupported`.
- Disponibiliza o controle em Configurações > Dimensionamento > Limite da biela da peça selecionada e nas propriedades de Cálculo, usando o mesmo estado da peça, histórico e arquivo de projeto. Não altera critérios das outras peças nem o esquema 4.
- Limites alternativos aplicados à biela geram `review` com a comparação ao padrão; memória, PDF e cálculo auditável mostram o critério e a fórmula escolhidos. Nós, apoio, escoamento prévio, inclinação, complemento de El Debs, atrito e viga em balanço mantêm suas verificações. Referências das alternativas indicadas no repositório, com conferência normativa pendente.
- Adiciona a aba superior Configurações ao ribbon, com grupos Geral / Aparência, Desenho, Modelo 3D, Dimensionamento e Detalhamento, navegação por teclado e rolagem horizontal em janelas estreitas.
- Reutiliza tema, cotas, armaduras, cargas e grade, preservando os acessos anteriores, seus estados e as regras atuais de persistência. O atalho Critérios da peça selecionada continua acessando dados da peça.
- Identifica preferências futuras como Em breve, em itens desabilitados com texto visível. Abrir a central não altera documentos, dados, resultados nem histórico; não há mudanças no motor ou no formato de arquivos.
- Simplifica as cinco abas anteriores do ribbon de 63 para 46 posições, preservando as 39 ações e a nova central Configurações. Início reúne oito atalhos do fluxo frequente; Modelo concentra a edição completa, inclusive Excluir; Documentação concentra documentos e saídas diretas.
- Centraliza rótulos, ícones e ajuda em um catálogo tipado. Padroniza Salvar projeto e Detalhamento e distingue edição de armaduras/ações da visibilidade das vistas. Mantém controles contextuais e exportadores especializados.
- Preserva alturas do ribbon, permite rolagem das abas e melhora a legibilidade dos botões. Expõe estados dos modos locais e retorna o foco ao comando que abriu um diálogo.
- Move Tema de Exibir para a central Configurações integrada, mantendo também o acesso rápido. Nenhuma alteração no motor, formato de projeto, unidades ou conteúdo das exportações.
- Viga em balanço para `1 < a/d ≤ 2` (issue #6): no modo automático, o motor deixa de devolver `unsupported` e calcula flexão simples (bloco retangular), tração horizontal, cisalhamento pelo Modelo I com `Vc = 0`, estribos com mínimo e espaçamento máximo, costura até h = 600 mm e armadura de pele em revisão acima disso, em paridade com o GN Corbel. Novas verificações `beamDomain`, `beamShear`, `beamStirrups`, `beamStirrupSpacing`, `beamStitch` e `beamSkin`; classificação `cantilever` e método `beam`.
- Domínio inválido da flexão deixa a armadura indeterminada, sem número sentinela. Bielas e tirantes e os complementos de El Debs não se aplicam nessa faixa; mantém-se o piso `Hd ≥ 0,20 Vd`.
- `a/d > 2` continua fora do domínio, com nova mensagem; bielas e tirantes ou atrito explícitos com `a/d > 1` orientam para o modo automático.
- O passo dos estribos N3 passa a vir de uma função compartilhada entre motor e detalhamento.
- Memória, PDF e cálculo auditável com rótulo "Viga em balanço" e valores do modelo; sugestão de armaduras considera as novas verificações.
- Nenhum resultado muda para `a/d ≤ 1`. Referências normativas do modelo citadas no GN Corbel, com conferência pendente.

## 0.7.1

- Corrige o rótulo antigo do motor na barra de status: a interface passa a usar a versão real do núcleo de cálculo.
- Mantém integralmente as melhorias da revisão Base Consolo 0.7.0 e o motor 0.4.0.

## 0.7.0

- Motor 0.4.0 / LC-ELU-2026.2: revisão minuciosa do trecho Base Consolo, com matriz de comparação por página e decisão documentada frente às normas.
- Complementos explícitos de El Debs para H, tirante, biela, tensão de referência, costura, estribos e altura da ponta; novos projetos vêm habilitados, projetos antigos preservam sua opção.
- Posição de cálculo da reação independente do aparelho, envelope 3/4 L e deslocamento c_ap/6; verificação conjunta com o efeito de H no contato.
- Memória, PDF e JSON com comparação dos modelos, equações completas, valores intermediários e domínios de aplicação.
- Corrigida a divergência entre espaçamento calculado e desenhado da costura superior; eixos compartilhados entre motor, detalhe e vistas.
- Exemplos novos e testes analíticos de equilíbrio, mínimos, contato, compatibilidade e interface.
- Projetos salvos no esquema 4, com importação de 1–3, para preservar as novas opções de cálculo contra descarte em versões antigas.

## 0.6.0

### Interface e navegação

- Identidade ConsoloStruct, integrante do OpenStruct, com atualização dos ícones e identificação dos documentos.
- Expansão independente dos consolos na árvore do projeto.
- Edição da quantidade de peças pelo indicador ×n e fechamento/reabertura de abas.
- Criação de projeto após confirmação dos dados, preservando o projeto anterior ao cancelar.

### Desempenho

- Pan/zoom do detalhamento agrupados por quadro de tela.
- Preparação de detalhes em worker com alternativa local, cache por peça e desenho das regiões visíveis.
- Preparação gradual das combinações e verificações da memória.

### Compatibilidade e limites

- Novos projetos usam `.consolo.json`; leitura de `.lume.json` e dos esquemas anteriores preservada. O esquema atual continua sendo 3.
- Motor ELU mantido em 0.3.0, política LC-ELU-2026.1, sem ampliação para análise espacial ou global.
- Sem instaladores nativos pré-compilados nesta entrega.

Consulte [Desempenho 0.6](docs/DESEMPENHO-0.6.md) e o [registro de validação da entrega](docs/VALIDACAO.md). Esse registro descreve testes anteriores e suas limitações, não substitui a execução dos testes no checkout atual.

## Recursos anteriores incorporados

O código-fonte inclui detalhamento local 2D com quadro de aço e exportações DXF/SVG/PDF/CSV, vista 3D e motor ELU auditável. Consulte [Detalhamento](docs/DETALHAMENTO.md), [Arquitetura](docs/ARQUITETURA.md) e [Validação do motor](docs/VALIDACAO-MOTOR.md). Não foi reconstruído um histórico detalhado de releases anteriores.

# Visualização 3D — aplicativo 0.4.0

A vista 3D usa as mesmas entradas da Elevação, Seção A–A e motor ELU. Foi acrescentada como uma vista do documento: está na faixa Início/Exibir, nas abas do espaço de trabalho e no navegador do projeto.

## Navegação

| Operação                     | Comando                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| Orbitar                      | Botão esquerdo e arrastar                                   |
| Pan                          | Botão central/direito; Espaço + arrastar; ou ferramenta Pan |
| Zoom no cursor               | Roda do mouse                                               |
| Enquadrar                    | Tecla F ou Ajustar à tela                                   |
| Isométrica                   | Botão do cubo ou seletor de orientação                      |
| Frontal / Superior / Lateral | Seletor no canto superior                                   |
| Editar dimensão              | Clique na cota; valor em cm; Enter confirma, Esc cancela    |
| Ver barras internas          | Ativar Translúcido                                          |
| Camadas                      | Exibir → Cotas, Cargas, Armaduras, Grade                    |

A vista inicial apresenta concreto opaco. A opção Translúcido é independente da camada Armaduras. No modo translúcido, é possível selecionar os grupos N1–N4 clicando nos eixos exibidos. O mouse e o toque controlam a mesma câmera; dois dedos permitem aproximação e pan.

As cotas permanecem orientadas à tela. Quando sua projeção fica reduzida a um ponto em uma vista ortogonal, a anotação é ocultada. Pequenos deslocamentos com linhas de chamada evitam sobreposição entre rótulos próximos. A câmera pode ser livremente deslocada; F reenquadra o conjunto.

## Geometria representada

- Eixos de engenharia: X na projeção do consolo, Y na largura e Z vertical.
- Coordenadas em mm. Rótulos de dimensão em cm e forças em kN.
- O contorno trapézio de pontos (0,0), (L,0), (L,−h₂), (0,−h) é extrudado na largura b. O volume coincide com b L (h+h₂)/2.
- O trecho de suporte usa P na direção X. Sua profundidade ilustrativa é b, pois o esquema do projeto não informa outra dimensão transversal do pilar. Sua altura é apenas um trecho de contexto, sem representar a altura integral do elemento.
- O retângulo do apoio indica a área efetiva de transmissão. A altura da linha de H é usada para a origem das setas; ela não é transformada em uma espessura física desconhecida do aparelho.
- N1 usa as posições dos ramos/camadas e a altura útil do mesmo arranjo considerado pelo motor. São exibidos eixos longitudinais, sem inventar a geometria das ancoragens.
- N2/N2b mantêm sua representação esquemática. N3 usa o estribo externo e, com quatro ramos, o grampo interno da geometria de detalhamento. N4 construtiva usa os mesmos eixos com arcos da forma de fabricação, em duas ou quatro posições. A positiva do modo viga é uma família separada P1. N5/N6 não têm representação completa. A visualização não certifica o arranjo ou libera execução.

## Cargas e interpretação

As setas mostram a combinação Principal **como informada no projeto**. Valores característicos recebem Vk; valores já de cálculo recebem Vd. A força horizontal é identificada como adicional ou total conforme a convenção escolhida nas propriedades. O sinal informado determina o sentido da seta horizontal; a convenção resistente que desconsidera H favorável continua sendo aplicada no motor.

O comprimento das setas foi escolhido para leitura gráfica e não é uma escala de intensidade. A cena não cria esforços, combinações ou resistências espaciais. Para consultar Vd/Hd resultantes dos critérios de majoração e combinações, use a memória de cálculo.

## Renderização e desempenho

Three.js 0.187.0, OrbitControls e câmera ortográfica. A projeção ortográfica foi adotada para leitura técnica sem encurtamento por perspectiva. Recursos, fontes e bibliotecas estão no pacote; nenhum CDN ou serviço é consultado durante o uso.

A biblioteca é carregada quando se abre a aba 3D. A renderização ocorre sob demanda, após navegação, mudança de dados, tema ou tamanho. Não há ciclo de animação contínuo em repouso. Geometrias, materiais, controles, observadores e contexto gráfico são descartados ao sair da vista.

Se WebGL 2 não estiver disponível, a cena usa SVGRenderer. Esse modo conserva câmera, cotas, setas e edição, representando as armaduras por linhas para reduzir o trabalho da CPU. Ao perder o contexto gráfico, a vista informa a interrupção e oferece Reiniciar 3D.

O novo módulo não requer mudança no esquema 2 dos arquivos de projeto. Câmera, orientação e transparência são estados da vista; navegar não altera as entradas estruturais. A edição por cota segue o mesmo histórico de desfazer/refazer e a mesma invalidação de resultados.

## Verificação

Os testes cobrem volume do sólido triangulado, orientação e limites da extrusão, cotas ligadas às entradas, sinais/nível das forças, camadas do tirante, ausência de mutação e geração das cenas normal/compatível. Os testes de interface exercitam órbita, pan, zoom, presets, enquadramento, edição/salvamento/histórico, camadas, temas, fallback e descarte nas trocas de vista.

Para a seção inicial b=300 mm, L=250 mm, h=400 mm e h₂=200 mm, o volume do sólido triangulado é 22.500.000 mm³, ou 0,0225 m³. Essa comparação usa a malha resultante da extrusão, não apenas o mesmo cálculo escalar de volume.

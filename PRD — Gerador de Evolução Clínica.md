# PRD — Gerador de Evolução Clínica

Nov 5, 2026 · @Pedro

## 1. Visão geral

A ferramenta é um site que monta o parágrafo diário de evolução por cliques. O texto sai pronto para colar no prontuário MV.

**Problema.** O parágrafo de evolução é quase igual todos os dias. Hoje ele é digitado ou editado à mão. Isso causa erros de digitação e de concordância.

**Objetivo.** Gerar o parágrafo com cliques em itens, no estilo ALASTAIR: caixas de marcar, botões de alternância e campos que mudam o texto em tempo real.

**Usuário.** Um usuário: médico residente de clínica médica. Uso individual, no computador do hospital, pelo navegador.

**Dentro do escopo**

- Só o parágrafo de estado geral e evolução das últimas 24h.
- 5 cenários: Enfermaria, UTI, Pronto-socorro, Pós-operatório e Cuidados paliativos.
- Concordância por sexo do paciente (M/F).
- Para cada item: frase padrão, frases alternativas prontas, campos numéricos e texto livre.
- Regras automáticas entre itens.
- Edição de itens, frases e regras na tela, válida só na sessão.
- Botão de copiar, com texto compatível com ISO-8859-1.

**Fora do escopo**

- Sinais vitais, exame físico por sistemas, exames laboratoriais, impressão e conduta.
- Qualquer dado de paciente (nome, leito, histórico).
- Login, conta, salvamento de modelos ou de evoluções.
- Atalhos de teclado.
- Aviso de caractere inválido.
- Lista de antibióticos (o usuário digita o nome).
- Integração direta com o MV.

## 2. Plataforma e requisitos técnicos

A ferramenta é um site estático, público e sem servidor. Ela não guarda nada e não envia nada pela rede.

| Requisito | Decisão |
| --- | --- |
| Acesso | Site público, sem login. Abre por URL no navegador do hospital. |
| Instalação | Nenhuma. O computador do hospital só abre sites. |
| Servidor | Nenhum. Só arquivos estáticos (HTML, CSS, JS). |
| Dependências externas | Nenhuma em tempo de execução. Todo código e fonte ficam no próprio site, porque a rede do hospital pode bloquear CDNs. |
| Armazenamento | Zero. Sem localStorage, sessionStorage, IndexedDB ou cookies. O estado fica só na memória da página. |
| Rede | Nenhuma requisição depois do carregamento. Sem analytics. |
| Recarregar a página | Volta tudo ao padrão: itens, edições e regras. |
| Navegadores | Google Chrome e Microsoft Edge, versões atuais. |
| Tela | Computador, a partir de 1366 × 768 px. Sem versão para celular. |
| Codificação da saída | Texto copiado só com caracteres do conjunto ISO-8859-1 (U+0000 a U+00FF). Detalhes na seção 5. |
| Cópia | Clipboard API (exige HTTPS). Se falhar, usar método alternativo de seleção e cópia. |

Sem dados de paciente, a ferramenta não trata dados pessoais. O nome do paciente nunca entra no texto.

## 3. Interface

A tela tem duas colunas: itens à esquerda e texto final à direita. O texto muda em tempo real a cada clique.

**Barra superior**

- Seletor de cenário: Enfermaria (padrão), UTI, PS, Pós-operatório, Paliativo.
- Sexo: botão M / F. Padrão: M.
- Botão "Restaurar padrão": volta todos os itens do cenário para Normal.
- Botão "Editar modelo": abre o modo de edição (seção 8).

**Coluna esquerda (cerca de 60% da largura)**

- Um cartão por item, na ordem do parágrafo.
- Cada cartão mostra o nome do item e o estado atual.
- Estado inicial de todos os itens: Normal (frase padrão).
- Itens com subitens (exemplo: Estado geral) mostram um controle por subitem na mesma linha.
- Item alterado recebe destaque visual (borda ou cor).

**Coluna direita (cerca de 40% da largura, fixa ao rolar)**

- Parágrafo final, atualizado a cada mudança.
- Frases diferentes do padrão aparecem destacadas só na tela. O destaque não vai para a cópia.
- Campo vazio aparece como "\_\_" destacado.
- Botão grande "Copiar". Depois do clique, mostra "Copiado" por 2 s.
- Contador de caracteres abaixo do texto.

**Tipos de controle**

| Controle | Uso | Exemplo |
| --- | --- | --- |
| Botões de opção (segmentados) | Escolher 1 frase entre o padrão e as alternativas | Respiratório: AA / CN / Venturi / MNR / CNAF / VNI |
| Caixa de marcar | Acrescentar um complemento à frase | Dieta: "com náuseas" |
| Campo numérico | Valor dentro da frase, com unidade fixa | O2 a \[2\] L/min |
| Campo de texto curto | Nome dentro da frase | Em uso de \[ceftriaxona\] (D\[3\]) |
| Texto livre | Substitui a frase inteira do item | Intercorrências: texto do usuário |
| Omitir | Remove o item do parágrafo | Ocultar "Deambula no período" |

Trocar de cenário volta os itens do novo cenário para Normal. O sexo escolhido continua o mesmo.

## 4. Modelo de dados

Cada cenário é uma lista de itens e uma lista de regras. Os cenários padrão ficam fixos no código. As edições da sessão ficam só na memória.

| Entidade | Campos |
| --- | --- |
| Cenário | id, nome, itens\[\], regras\[\] |
| Item | id, rótulo, ordem, subitens\[\] ou opções\[\], permite texto livre (sim/não), permite omitir (sim/não), é sintoma (sim/não) |
| Opção | id, rótulo do botão, frase, campos\[\], padrão (sim/não), indica sintoma (sim/não), indica gravidade (sim/não) |
| Campo | id, tipo (número ou texto), unidade, valor inicial (vazio) |
| Regra | condição (item + opção, ou "qualquer sintoma", ou "qualquer gravidade"), ação (ocultar item, ou trocar item para opção X) |

**Marcadores na frase**

- Gênero: `{o|a}` escolhe a terminação pelo sexo. Exemplo: `acordad{o|a}` gera "acordado" ou "acordada".
- Campo: `[nome_do_campo]` recebe o valor digitado. Exemplo: `Em uso de O2 por CN a [o2] L/min.`

```json
{
  "id": "resp",
  "rotulo": "Respiratório",
  "opcoes": [
    { "id": "aa",  "rotulo": "AA", "padrao": true,
      "frase": "Respira confortavelmente em AA, sem necessidade de suporte respiratório." },
    { "id": "cn",  "rotulo": "CN",
      "frase": "Em uso de O2 por CN a [o2] L/min.",
      "campos": [{ "id": "o2", "tipo": "numero", "unidade": "L/min" }] },
    { "id": "vni", "rotulo": "VNI", "gravidade": true,
      "frase": "Em VNI intermitente." }
  ],
  "textoLivre": true,
  "omitir": false
}
```

## 5. Motor de texto

O motor monta o parágrafo em 6 passos, a cada mudança na tela. A saída é sempre um parágrafo único.

1. Aplicar as regras automáticas. As regras ocultam itens ou trocam a opção de itens.
2. Para cada item visível, na ordem: pegar a frase da opção atual, ou o texto livre.
3. Trocar os campos `[x]` pelos valores. Campo vazio vira "\_\_".
4. Trocar os marcadores `{o|a}` pelo sexo escolhido.
5. Juntar as frases com um espaço. Garantir letra maiúscula no início e ponto final em cada frase. Remover espaços duplos e quebras de linha.
6. Converter o texto para o conjunto ISO-8859-1 (tabela abaixo).

**Regra de texto livre.** O texto livre substitui a frase inteira do item. O motor só acrescenta o ponto final, se faltar.

**Regras automáticas padrão**

| # | Se | Então |
| --- | --- | --- |
| R1 | Qualquer opção marcada como sintoma está ativa (exemplo: vômitos, dispneia, insônia, diarreia) | Ocultar "Nega queixas." |
| R2 | Item Queixas tem texto ("Refere ...") | Ocultar "Nega queixas." (a frase é substituída) |
| R3 | Qualquer opção marcada como gravidade está ativa (exemplo: instabilidade hemodinâmica, VNI, CNAF, rebaixamento de consciência) | Ocultar "Sem sinais de gravidade ou instabilidade." |
| R4 | Hemodinâmica diferente de estável | Ocultar "Sem sinais de gravidade ou instabilidade." |
| R5 | Intercorrências tem texto | Ocultar "Sem sinais de gravidade ou instabilidade." |
| R6 | Febre presente | Ocultar "Sem sinais de gravidade ou instabilidade." |

O usuário pode desligar, editar ou criar regras na tela (seção 8).

**Conversão para ISO-8859-1**

| Caractere de entrada | Saída |
| --- | --- |
| Aspas curvas duplas “ ” | " |
| Aspas curvas simples ‘ ’ | ' |
| Travessão — e meia-risca – | - |
| Reticências … | ... |
| Subscrito ₂ (e outros subscritos) | 2 (dígito normal) |
| ≥ e ≤ | >= e <= |
| Seta → | -> |
| Marcador • | - |
| Espaço não separável e tabulação | Espaço comum |
| Quebra de linha | Espaço comum |
| Qualquer outro caractere acima de U+00FF (emoji, etc.) | Removido |

Acentos do português, ç, °, µ e ± fazem parte do ISO-8859-1. Eles ficam no texto. A conversão é silenciosa: não há aviso na tela.

## 6. Cenário Enfermaria (padrão)

O cenário Enfermaria é o seu modelo, com ortografia corrigida e abreviações. Ele tem 12 itens. Texto padrão, sexo masculino:

> Encontro paciente em leito de enfermaria. Acordado, corado, hidratado, acianótico, anictérico, contactuante e colaborativo. Evolui clínica e hemodinamicamente estável. Respira confortavelmente em AA, sem necessidade de suporte respiratório. Boa aceitação de dieta VO, sem episódios de náuseas ou vômitos. Diurese e dejeções ditas presentes e sem alterações. Deambula no período. Afebril, sem uso de ATB. Ciclo sono-vigília preservado. Sem intercorrências nas últimas 24h. Sem sinais de gravidade ou instabilidade. Nega queixas.

Sexo feminino muda a 2ª frase: "Acordada, corada, hidratada, acianótica, anictérica, contactuante e colaborativa."

**Itens.** S = opção marca sintoma (regra R1). G = opção marca gravidade (regra R3). Todos os itens aceitam texto livre.

| # | Item | Padrão | Alternativas prontas |
| --- | --- | --- | --- |
| 1 | Local | Encontro paciente em leito de enfermaria. | ... em poltrona · ... em leito de isolamento |
| 2 | Estado geral (7 subitens) | Acordado, corado, hidratado, acianótico, anictérico, contactuante e colaborativo. | Consciência: sonolento, torporoso (G) · Cor: hipocorado \[+/4+\] · Hidratação: desidratado \[+/4+\] · Cianose: cianótico (G) · Icterícia: ictérico \[+/4+\] · Contato: pouco contactuante, não contactuante · Comportamento: pouco colaborativo, agitado |
| 3 | Hemodinâmica | Evolui clínica e hemodinamicamente estável. | Evolui hemodinamicamente instável, em uso de \[DVA\]. (G) · Evolui com hipotensão, responsiva a volume. (G) · Evolui hipertenso, em ajuste de anti-hipertensivos. |
| 4 | Respiratório | Respira confortavelmente em AA, sem necessidade de suporte respiratório. | Em uso de O2 por CN a \[n\] L/min. · Em uso de máscara de Venturi a \[n\]%. · Em uso de MNR a \[n\] L/min. (G) · Em uso de CNAF, FiO2 \[n\]%, fluxo \[n\] L/min. (G) · Em VNI intermitente. (G) · Taquidispneico em AA. (S, G) |
| 5 | Dieta | Boa aceitação de dieta VO, sem episódios de náuseas ou vômitos. | Aceitação: parcial, baixa · Em dieta zero (\[motivo\]). · Dieta por SNE a \[n\] mL/h. · Caixas: com náuseas (S) · com \[n\] episódio(s) de vômito (S) |
| 6 | Diurese e dejeções | Diurese e dejeções ditas presentes e sem alterações. | Diurese: por SVD, \[n\] mL/24h · oligúria, \[n\] mL/24h · disúria (S). Dejeções: ausentes há \[n\] dias · diarreia, \[n\] episódios/24h (S) · melena (S, G) |
| 7 | Deambulação | Deambula no período. | Deambula com auxílio. · Sai do leito para poltrona. · Restrito ao leito. |
| 8 | Febre e ATB (2 subitens) | Afebril, sem uso de ATB. | Febre: febril no período, pico de \[n\] °C. ATB: em uso de \[nome\] (D\[n\]). |
| 9 | Sono | Ciclo sono-vigília preservado. | Refere insônia. (S) · Sonolência diurna. · Episódio de agitação noturna. |
| 10 | Intercorrências | Sem intercorrências nas últimas 24h. | Texto livre: "Intercorrência nas últimas 24h: \[texto\]." |
| 11 | Gravidade | Sem sinais de gravidade ou instabilidade. | Controlado pelas regras R3 a R6. Pode ser omitido à mão. |
| 12 | Queixas | Nega queixas. | Refere \[texto\]. (regra R2) |

Itens com subitens montam a frase juntando os subitens. Exemplo: Febre = febril + ATB = em uso → "Febril no período, pico de 38,5 °C, em uso de ceftriaxona (D3)."

## 7. Outros cenários (proposta para revisão)

Os 4 cenários abaixo são propostas. Revise o texto padrão e os itens antes da implementação. Todos usam os mesmos controles, marcadores e regras da Enfermaria.

### 7.1 UTI

> Encontro paciente em leito de UTI. Sob sedação contínua com \[fármacos\], RASS \[n\]. Sem DVA. Em VM, modo \[modo\], FiO2 \[n\]%, PEEP \[n\] cmH2O. Dieta enteral por SNE a \[n\] mL/h, com boa tolerância. Glicemias controladas, sem necessidade de insulina. Diurese por SVD, \[n\] mL/24h, BH \[+/-\]\[n\] mL/24h. Dispositivos: \[lista\]. Afebril, sem uso de ATB. Profilaxia de TEV com \[fármaco\] e de úlcera de estresse com \[fármaco\]. CAM-ICU negativo. Sem LPP. Sem intercorrências nas últimas 24h.

| Item | Opções |
| --- | --- |
| Sedação/RASS | Sob sedação contínua com \[fármacos\], RASS \[n\] · Sem sedação, acordado, contactuante · Sedação em desmame |
| Hemodinâmica/DVA | Sem DVA · Em uso de noradrenalina a \[n\] mcg/kg/min · Em uso de \[DVA\] a \[n\] \[unidade\] · DVA em desmame |
| Suporte ventilatório | VM: modo \[modo\], FiO2 \[n\]%, PEEP \[n\] cmH2O · VNI · CNAF · CN a \[n\] L/min · AA |
| Dieta | SNE a \[n\] mL/h · NPT · VO · Zero (\[motivo\]) |
| Glicemia/insulina | Sem insulina · Insulina regular conforme protocolo · Insulina contínua a \[n\] UI/h |
| Diurese e BH | Por SVD, \[n\] mL/24h · BH \[+/-\]\[n\] mL/24h · Em hemodiálise |
| Dispositivos | Caixas: CVC em \[sítio\] (D\[n\]) · PAI em \[sítio\] (D\[n\]) · SVD (D\[n\]) · Dreno \[tipo\], débito \[n\] mL/24h · TOT/TQT |
| Febre e ATB | Igual à Enfermaria |
| Profilaxias | TEV com \[fármaco\] · TEV mecânica · TEV contraindicada · Úlcera de estresse com \[fármaco\] |
| Delirium | CAM-ICU negativo · CAM-ICU positivo · Não aplicável (RASS ≤ -4) |
| Lesão por pressão | Sem LPP · LPP estágio \[n\] em \[local\] |
| Intercorrências | Igual à Enfermaria |

### 7.2 Pronto-socorro

> Encontro paciente em \[sala amarela\] do PS. Acordado, corado, hidratado, acianótico, anictérico, contactuante e colaborativo. Evolui clínica e hemodinamicamente estável. Respira confortavelmente em AA. Em dieta VO liberada. Diurese presente. Refere melhora da queixa inicial. Sem intercorrências desde a admissão. Aguarda \[exames / parecer / vaga em enfermaria\].

Itens novos: Local (sala amarela, sala vermelha, corredor, maca) · Evolução da queixa (melhora, sem mudança, piora) · Situação (aguarda exames, parecer, vaga). Os outros itens são iguais aos da Enfermaria.

### 7.3 Pós-operatório

> Encontro paciente em \[n\]º DPO de \[cirurgia\]. Acordado, corado, hidratado, acianótico, anictérico, contactuante e colaborativo. Evolui clínica e hemodinamicamente estável. Respira confortavelmente em AA. Dor controlada com analgesia prescrita. FO limpa e seca, sem sinais flogísticos. Boa aceitação de dieta VO. Flatos presentes. Diurese presente. Deambula no período. Afebril, sem uso de ATB. Sem intercorrências nas últimas 24h. Nega queixas.

Itens novos: DPO e cirurgia (campos) · Dor (controlada, parcialmente controlada, EVA \[n\]) · FO (limpa e seca; hiperemia; secreção \[aspecto\]; deiscência) · Drenos (débito \[n\] mL/24h, aspecto \[seroso/hemático/purulento\]) · Trânsito intestinal (flatos, evacuação, ausente) · Profilaxia de TEV.

### 7.4 Cuidados paliativos

> Encontro paciente em leito de enfermaria, em cuidados paliativos \[exclusivos\]. Confortável no leito. Dor controlada com \[fármaco\]. Sem dispneia. Sem náuseas. Sem ruídos de vias aéreas superiores. Aceitação de dieta por conforto. Diurese e dejeções ditas presentes. Sem sinais de delirium. Ciclo sono-vigília preservado. Família presente. Sem intercorrências nas últimas 24h.

Itens novos: Conforto · Dor (controlada com \[fármaco\], EVA \[n\]) · Dispneia · Secreção/ruídos de VAS · Delirium/agitação · Família (presente, ausente, ciente do prognóstico). Este cenário não tem o item "Sem sinais de gravidade" nem as regras R3 a R6.

## 8. Modo de edição temporária

O usuário edita o modelo na tela, sem programar. As edições valem até fechar ou recarregar a página.

**O que o usuário pode fazer**

- Editar a frase padrão de um item.
- Criar, editar e apagar alternativas de um item.
- Criar campos em uma frase com `[nome]` e marcadores de gênero com `{o|a}`.
- Marcar uma alternativa como sintoma ou gravidade.
- Mudar a ordem dos itens (botões subir e descer).
- Criar e apagar itens.
- Ligar, desligar, editar e criar regras. A regra é montada com 2 listas de seleção: "Se \[item = opção\]" e "Então \[ocultar item / trocar item para opção\]".

**Comportamento**

- O modo de edição abre como painel sobre a coluna esquerda. O texto final continua visível e atualiza em tempo real.
- Cada cenário guarda suas próprias edições durante a sessão.
- Botão "Descartar edições": volta o cenário atual ao modelo original do código.
- Botão "Restaurar padrão" (barra superior): volta os itens para Normal, mas mantém as edições do modelo.
- Uma linha fixa no painel informa: "Edições são temporárias. Recarregar a página restaura o modelo original."
- Nenhuma edição é gravada no navegador ou enviada pela rede.

## 9. Critérios de aceite

A versão 1 está pronta quando todos os testes abaixo passam. Todos os recursos são obrigatórios na versão 1.

**Funcionais**

- [ ] Ao abrir: cenário Enfermaria, sexo M, todos os itens Normal. O texto final é igual ao texto padrão da seção 6.
- [ ] Trocar para F muda todas as concordâncias, inclusive nas alternativas ativas.
- [ ] Escolher "CN" mostra o campo L/min. Com 2 no campo, o texto mostra "Em uso de O2 por CN a 2 L/min."
- [ ] Campo vazio aparece como "\_\_" destacado no texto.
- [ ] Escrever uma queixa troca "Nega queixas." por "Refere \[texto\]."
- [ ] Marcar vômitos remove "Nega queixas." (R1).
- [ ] Escolher VNI ou hemodinâmica instável remove "Sem sinais de gravidade ou instabilidade." (R3, R4).
- [ ] Texto livre substitui a frase inteira do item.
- [ ] Os 5 cenários abrem e geram texto sem erro.
- [ ] Uma frase editada no modo de edição aparece no texto final. Depois de recarregar, a frase volta ao original.
- [ ] Uma regra criada na tela funciona. Desligar uma regra padrão anula o efeito dela.

**Cópia e MV**

- [ ] "Copiar" coloca na área de transferência um parágrafo único, sem quebras de linha.
- [ ] O texto copiado tem só caracteres de U+0000 a U+00FF. Teste: colar “aspas”, —, O₂ e ≥ no texto livre e conferir a saída.
- [ ] Colar no MV mantém acentos, ç e ° corretos (teste manual no hospital).

**Não funcionais**

- [ ] O texto atualiza em menos de 100 ms depois de cada clique.
- [ ] A página carrega em menos de 2 s.
- [ ] Depois do carregamento, a aba Rede do DevTools não mostra requisições.
- [ ] localStorage, sessionStorage, IndexedDB e cookies ficam vazios.
- [ ] Funciona no Chrome e no Edge atuais, em tela de 1366 × 768 px, sem rolagem horizontal.
- [ ] Todos os controles têm rótulo e contraste legível.

## 10. Premissas e questões abertas

**Premissas assumidas neste PRD**

- Sexo padrão = masculino. A pergunta 40 ficou sem resposta, e o seu modelo original usa o masculino.
- "Estilo ALASTAIR" = interface de marcação com caixas, botões de alternância e campos que mudam o texto. O PRD não copia telas de outra ferramenta.
- A frase "Dejeções ditas presentes" fica igual ao modelo.
- "Afebril sem uso de antibióticos" vira "Afebril, sem uso de ATB.", porque a saída usa abreviações.
- Abreviações usadas: AA, VO, O2, CN, MNR, CNAF, VNI, VM, SNE, NPT, SVD, DVA, ATB, BH, CVC, PAI, TOT, TQT, TEV, LPP, DPO, FO, VAS, PS.
- O MV aceita texto colado com Ctrl+V. O problema relatado vem de caracteres fora do ISO-8859-1.

**Questões abertas**

- [ ] Onde hospedar o site (GitHub Pages, Netlify ou Vercel)? Testar se a rede do hospital bloqueia o domínio.
- [ ] Revisar os textos padrão e os itens de UTI, PS, Pós-operatório e Paliativo (seção 7).
- [ ] Revisar as regras R1 a R6 (seção 5). Exemplo: febre deve mesmo remover "Sem sinais de gravidade"?
- [ ] Confirmar "\_\_" para campo vazio, ou bloquear a cópia até preencher.
- [ ] Nome da ferramenta.

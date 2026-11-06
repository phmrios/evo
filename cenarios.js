/*
 * Cenários padrão (fixos no código). Edições feitas na tela trabalham sobre
 * uma cópia em memória; recarregar a página volta a estes modelos.
 *
 * Marcadores nas frases:
 *   {o|a}   -> concordância pelo sexo (masculino|feminino)
 *   [nome]  -> campo preenchido pelo usuário (vazio aparece como "__")
 *
 * Estrutura:
 *   Cenário  { id, nome, itens[], regras[] }
 *   Item     { id, rotulo, grupos[], textoLivre, omitir, sep, fraseQuandoPadrao, nota }
 *   Grupo    { id, rotulo, opcoes[] (botões, escolhe 1), caixas[] (marcar vários),
 *              vazio (texto quando nenhuma caixa marcada), prefixo, juntar }
 *   Opção    { id, rotulo, frase, padrao, sintoma, gravidade, campos{ nome: {tipo, rotulo, unidade} } }
 *   Regra    { id, ativa, se{tipo, item, grupo, opcao}, entao{tipo, item, grupo, opcao} }
 */
(function (global) {
  'use strict';

  // ---------- auxiliares ----------
  function O(id, rotulo, frase, extra) {
    return Object.assign({ id: id, rotulo: rotulo, frase: frase }, extra || {});
  }
  function mix() {
    return Object.assign.apply(null, [{}].concat([].slice.call(arguments)));
  }
  var P = { padrao: true };
  var S = { sintoma: true };
  var G = { gravidade: true };
  var SG = { sintoma: true, gravidade: true };
  function num(rotulo, unidade) { return { tipo: 'numero', rotulo: rotulo, unidade: unidade || '' }; }
  function txt(rotulo, unidade) { return { tipo: 'texto', rotulo: rotulo, unidade: unidade || '' }; }
  function campos(c) { return { campos: c }; }

  function simples(id, rotulo, opcoes, extra) {
    return Object.assign({
      id: id, rotulo: rotulo, textoLivre: true, omitir: true,
      grupos: [{ id: 'g', rotulo: '', opcoes: opcoes }]
    }, extra || {});
  }
  function composto(id, rotulo, grupos, extra) {
    return Object.assign({ id: id, rotulo: rotulo, textoLivre: true, omitir: true, grupos: grupos }, extra || {});
  }

  // ---------- itens compartilhados ----------
  function estadoGeral() {
    return composto('estado', 'Estado geral', [
      { id: 'consc', rotulo: 'Consciência', opcoes: [
        O('acordado', 'Acordado', 'acordad{o|a}', P),
        O('sonolento', 'Sonolento', 'sonolent{o|a}'),
        O('torporoso', 'Torporoso', 'torporos{o|a}', G)
      ] },
      { id: 'cor', rotulo: 'Cor', opcoes: [
        O('corado', 'Corado', 'corad{o|a}', P),
        O('hipocorado', 'Hipocorado', 'hipocorad{o|a} [cruzes]+/4+', campos({ cruzes: num('Cruzes', '+/4+') }))
      ] },
      { id: 'hidr', rotulo: 'Hidratação', opcoes: [
        O('hidratado', 'Hidratado', 'hidratad{o|a}', P),
        O('desidratado', 'Desidratado', 'desidratad{o|a} [cruzes]+/4+', campos({ cruzes: num('Cruzes', '+/4+') }))
      ] },
      { id: 'cian', rotulo: 'Cianose', opcoes: [
        O('acianotico', 'Acianótico', 'acianótic{o|a}', P),
        O('cianotico', 'Cianótico', 'cianótic{o|a}', G)
      ] },
      { id: 'ict', rotulo: 'Icterícia', opcoes: [
        O('anicterico', 'Anictérico', 'anictéric{o|a}', P),
        O('icterico', 'Ictérico', 'ictéric{o|a} [cruzes]+/4+', campos({ cruzes: num('Cruzes', '+/4+') }))
      ] },
      { id: 'contato', rotulo: 'Contato', opcoes: [
        O('contactuante', 'Contactuante', 'contactuante', P),
        O('pouco', 'Pouco contactuante', 'pouco contactuante'),
        O('nao', 'Não contactuante', 'não contactuante')
      ] },
      { id: 'comport', rotulo: 'Comportamento', opcoes: [
        O('colaborativo', 'Colaborativo', 'colaborativ{o|a}', P),
        O('pouco', 'Pouco colaborativo', 'pouco colaborativ{o|a}'),
        O('agitado', 'Agitado', 'agitad{o|a}')
      ] }
    ], { sep: 'lista' });
  }

  function hemodinamica() {
    return simples('hemo', 'Hemodinâmica', [
      O('estavel', 'Estável', 'Evolui clínica e hemodinamicamente estável.', P),
      O('instavel', 'Instável c/ DVA', 'Evolui hemodinamicamente instável, em uso de [dva].', mix(G, campos({ dva: txt('DVA') }))),
      O('hipotensao', 'Hipotensão', 'Evolui com hipotensão, responsiva a volume.', G),
      O('hipertenso', 'Hipertenso', 'Evolui hipertens{o|a}, em ajuste de anti-hipertensivos.')
    ]);
  }

  function respiratorio(fraseAA) {
    return simples('resp', 'Respiratório', [
      O('aa', 'AA', fraseAA, P),
      O('cn', 'CN', 'Em uso de O2 por CN a [o2] L/min.', campos({ o2: num('O2', 'L/min') })),
      O('venturi', 'Venturi', 'Em uso de máscara de Venturi a [fio2]%.', campos({ fio2: num('FiO2', '%') })),
      O('mnr', 'MNR', 'Em uso de MNR a [o2] L/min.', mix(G, campos({ o2: num('O2', 'L/min') }))),
      O('cnaf', 'CNAF', 'Em uso de CNAF, FiO2 [fio2]%, fluxo [fluxo] L/min.', mix(G, campos({ fio2: num('FiO2', '%'), fluxo: num('Fluxo', 'L/min') }))),
      O('vni', 'VNI', 'Em VNI intermitente.', G),
      O('taqui', 'Taquidispneico', 'Taquidispneic{o|a} em AA.', SG)
    ]);
  }

  function nauseasVomitos(vazio) {
    return {
      id: 'gi', rotulo: 'Náuseas/vômitos', vazio: vazio, caixas: [
        O('nauseas', 'Com náuseas', 'com náuseas', S),
        O('vomitos', 'Com vômitos', 'com [vomitos] episódio(s) de vômito', mix(S, campos({ vomitos: num('Episódios') })))
      ]
    };
  }

  function deambulacao() {
    return simples('deamb', 'Deambulação', [
      O('deambula', 'Deambula', 'Deambula no período.', P),
      O('auxilio', 'Com auxílio', 'Deambula com auxílio.'),
      O('poltrona', 'Leito → poltrona', 'Sai do leito para poltrona.'),
      O('restrito', 'Restrito ao leito', 'Restrit{o|a} ao leito.')
    ]);
  }

  function febreAtb() {
    return composto('febre', 'Febre e ATB', [
      { id: 'febre', rotulo: 'Febre', opcoes: [
        O('afebril', 'Afebril', 'afebril', P),
        O('febril', 'Febril', 'febril no período, pico de [pico] °C', campos({ pico: num('Pico', '°C') }))
      ] },
      { id: 'atb', rotulo: 'ATB', opcoes: [
        O('sem', 'Sem ATB', 'sem uso de ATB', P),
        O('com', 'Em uso', 'em uso de [atb] (D[dia])', campos({ atb: txt('Antibiótico'), dia: num('Dia') }))
      ] }
    ], { sep: ', ' });
  }

  function sono() {
    return simples('sono', 'Sono', [
      O('preservado', 'Preservado', 'Ciclo sono-vigília preservado.', P),
      O('insonia', 'Insônia', 'Refere insônia.', S),
      O('sonolencia', 'Sonolência diurna', 'Sonolência diurna.'),
      O('agitacao', 'Agitação noturna', 'Episódio de agitação noturna.')
    ]);
  }

  function intercorrencias(periodo) {
    return simples('interc', 'Intercorrências', [
      O('sem', 'Sem intercorrências', 'Sem intercorrências ' + periodo + '.', P),
      O('com', 'Com intercorrência', 'Intercorrência ' + periodo + ': [descricao].', campos({ descricao: txt('Descrição') }))
    ]);
  }

  function queixas() {
    return simples('queixas', 'Queixas', [
      O('nega', 'Nega queixas', 'Nega queixas.', P),
      O('refere', 'Refere', 'Refere [queixa].', campos({ queixa: txt('Queixa') }))
    ]);
  }

  function gravidade() {
    return simples('grav', 'Gravidade', [
      O('sem', 'Sem sinais de gravidade', 'Sem sinais de gravidade ou instabilidade.', P)
    ], { nota: 'Controlado pelas regras R3 a R6. Pode ser omitido à mão.' });
  }

  function diureseSimples() {
    return simples('diur', 'Diurese', [
      O('presente', 'Presente', 'Diurese presente.', P),
      O('svd', 'Por SVD', 'Diurese por SVD, [volume] mL/24h.', campos({ volume: num('Volume', 'mL/24h') })),
      O('oliguria', 'Oligúria', 'Oligúria, [volume] mL/24h.', campos({ volume: num('Volume', 'mL/24h') })),
      O('disuria', 'Disúria', 'Diurese presente, com disúria.', S)
    ]);
  }

  // ---------- regras ----------
  function R(id, se, entao) { return { id: id, ativa: true, se: se, entao: entao }; }
  var R1 = function () { return R('R1', { tipo: 'sintoma' }, { tipo: 'ocultarPadrao', item: 'queixas' }); };
  function regrasGravidade() {
    return [
      R('R3', { tipo: 'gravidade' }, { tipo: 'ocultar', item: 'grav' }),
      R('R4', { tipo: 'naoPadrao', item: 'hemo' }, { tipo: 'ocultar', item: 'grav' }),
      R('R5', { tipo: 'naoPadrao', item: 'interc' }, { tipo: 'ocultar', item: 'grav' }),
      R('R6', { tipo: 'opcao', item: 'febre', grupo: 'febre', opcao: 'febril' }, { tipo: 'ocultar', item: 'grav' })
    ];
  }

  // ---------- cenários ----------
  var enfermaria = {
    id: 'enfermaria', nome: 'Enfermaria',
    itens: [
      simples('local', 'Local', [
        O('leito', 'Leito', 'Encontro paciente em leito de enfermaria.', P),
        O('poltrona', 'Poltrona', 'Encontro paciente em poltrona.'),
        O('isolamento', 'Isolamento', 'Encontro paciente em leito de isolamento.')
      ]),
      estadoGeral(),
      hemodinamica(),
      respiratorio('Respira confortavelmente em AA, sem necessidade de suporte respiratório.'),
      composto('dieta', 'Dieta', [
        { id: 'aceit', rotulo: 'Dieta', opcoes: [
          O('boa', 'Boa aceitação VO', 'Boa aceitação de dieta VO', P),
          O('parcial', 'Parcial', 'Aceitação parcial de dieta VO'),
          O('baixa', 'Baixa', 'Baixa aceitação de dieta VO'),
          O('zero', 'Dieta zero', 'Em dieta zero ([motivo])', campos({ motivo: txt('Motivo') })),
          O('sne', 'SNE', 'Dieta por SNE a [vazao] mL/h', campos({ vazao: num('Vazão', 'mL/h') }))
        ] },
        nauseasVomitos('sem episódios de náuseas ou vômitos')
      ], { sep: ', ' }),
      composto('diur', 'Diurese e dejeções', [
        { id: 'diurese', rotulo: 'Diurese', opcoes: [
          O('presente', 'Presente', 'diurese dita presente e sem alterações', P),
          O('svd', 'Por SVD', 'diurese por SVD, [volume] mL/24h', campos({ volume: num('Volume', 'mL/24h') })),
          O('oliguria', 'Oligúria', 'oligúria, [volume] mL/24h', campos({ volume: num('Volume', 'mL/24h') })),
          O('disuria', 'Disúria', 'diurese presente, com disúria', S)
        ] },
        { id: 'dejecoes', rotulo: 'Dejeções', opcoes: [
          O('presentes', 'Presentes', 'dejeções ditas presentes e sem alterações', P),
          O('ausentes', 'Ausentes', 'dejeções ausentes há [dias] dias', campos({ dias: num('Dias') })),
          O('diarreia', 'Diarreia', 'dejeções diarreicas, [episodios] episódios/24h', mix(S, campos({ episodios: num('Episódios', '/24h') }))),
          O('melena', 'Melena', 'dejeções com melena', SG)
        ] }
      ], { sep: '. ', fraseQuandoPadrao: 'Diurese e dejeções ditas presentes e sem alterações.' }),
      deambulacao(),
      febreAtb(),
      sono(),
      intercorrencias('nas últimas 24h'),
      gravidade(),
      queixas()
    ],
    regras: [R1()].concat(regrasGravidade())
  };

  var uti = {
    id: 'uti', nome: 'UTI',
    itens: [
      simples('local', 'Local', [O('uti', 'Leito de UTI', 'Encontro paciente em leito de UTI.', P)]),
      simples('sedacao', 'Sedação/RASS', [
        O('continua', 'Sedação contínua', 'Sob sedação contínua com [farmacos], RASS [rass].', mix(P, campos({ farmacos: txt('Fármacos'), rass: num('RASS') }))),
        O('sem', 'Sem sedação', 'Sem sedação, acordad{o|a} e contactuante.'),
        O('desmame', 'Em desmame', 'Sedação em desmame, RASS [rass].', campos({ rass: num('RASS') }))
      ]),
      simples('hemo', 'Hemodinâmica/DVA', [
        O('semdva', 'Sem DVA', 'Sem DVA.', P),
        O('nora', 'Noradrenalina', 'Em uso de noradrenalina a [dose] mcg/kg/min.', mix(G, campos({ dose: num('Dose', 'mcg/kg/min') }))),
        O('outra', 'Outra DVA', 'Em uso de [dva] a [dose] [unidade].', mix(G, campos({ dva: txt('DVA'), dose: num('Dose'), unidade: txt('Unidade') }))),
        O('desmame', 'DVA em desmame', 'DVA em desmame.')
      ]),
      simples('vent', 'Suporte ventilatório', [
        O('vm', 'VM', 'Em VM, modo [modo], FiO2 [fio2]%, PEEP [peep] cmH2O.', mix(P, campos({ modo: txt('Modo'), fio2: num('FiO2', '%'), peep: num('PEEP', 'cmH2O') }))),
        O('vni', 'VNI', 'Em VNI intermitente.', G),
        O('cnaf', 'CNAF', 'Em uso de CNAF, FiO2 [fio2]%, fluxo [fluxo] L/min.', mix(G, campos({ fio2: num('FiO2', '%'), fluxo: num('Fluxo', 'L/min') }))),
        O('cn', 'CN', 'Em uso de O2 por CN a [o2] L/min.', campos({ o2: num('O2', 'L/min') })),
        O('aa', 'AA', 'Respira confortavelmente em AA.')
      ]),
      simples('dieta', 'Dieta', [
        O('sne', 'SNE', 'Dieta enteral por SNE a [vazao] mL/h, com boa tolerância.', mix(P, campos({ vazao: num('Vazão', 'mL/h') }))),
        O('npt', 'NPT', 'Em NPT.'),
        O('vo', 'VO', 'Em dieta VO, com boa aceitação.'),
        O('zero', 'Zero', 'Em dieta zero ([motivo]).', campos({ motivo: txt('Motivo') }))
      ]),
      simples('glicemia', 'Glicemia/insulina', [
        O('sem', 'Sem insulina', 'Glicemias controladas, sem necessidade de insulina.', P),
        O('protocolo', 'Insulina protocolo', 'Glicemias em controle com insulina regular conforme protocolo.'),
        O('continua', 'Insulina contínua', 'Em insulina contínua a [dose] UI/h.', campos({ dose: num('Dose', 'UI/h') }))
      ]),
      composto('diur', 'Diurese e BH', [
        { id: 'diurese', rotulo: 'Diurese', opcoes: [
          O('svd', 'Por SVD', 'diurese por SVD, [volume] mL/24h', mix(P, campos({ volume: num('Volume', 'mL/24h') }))),
          O('espontanea', 'Espontânea', 'diurese espontânea, [volume] mL/24h', campos({ volume: num('Volume', 'mL/24h') })),
          O('hd', 'Hemodiálise', 'em hemodiálise')
        ] },
        { id: 'bh', rotulo: 'BH', opcoes: [
          O('bh', 'BH', 'BH [bh] mL/24h', mix(P, campos({ bh: txt('BH (+/-)', 'mL/24h') }))),
          O('nao', 'Não citar', '')
        ] }
      ], { sep: ', ' }),
      composto('disp', 'Dispositivos', [
        { id: 'disp', rotulo: 'Dispositivos', prefixo: 'Dispositivos: ', juntar: 'virgula', vazio: 'Sem dispositivos invasivos', caixas: [
          O('cvc', 'CVC', 'CVC em [sitio] (D[dia])', mix(P, campos({ sitio: txt('Sítio CVC'), dia: num('Dia') }))),
          O('pai', 'PAI', 'PAI em [sitio] (D[dia])', campos({ sitio: txt('Sítio PAI'), dia: num('Dia') })),
          O('svd', 'SVD', 'SVD (D[dia])', mix(P, campos({ dia: num('Dia SVD') }))),
          O('dreno', 'Dreno', 'dreno [tipo], débito [debito] mL/24h', campos({ tipo: txt('Tipo de dreno'), debito: num('Débito', 'mL/24h') })),
          O('tot', 'TOT', 'TOT', P),
          O('tqt', 'TQT', 'TQT')
        ] }
      ]),
      febreAtb(),
      composto('profilaxia', 'Profilaxias', [
        { id: 'tev', rotulo: 'TEV', opcoes: [
          O('farmaco', 'Farmacológica', 'profilaxia de TEV com [farmaco]', mix(P, campos({ farmaco: txt('Fármaco TEV') }))),
          O('mecanica', 'Mecânica', 'profilaxia de TEV mecânica'),
          O('contra', 'Contraindicada', 'profilaxia de TEV contraindicada')
        ] },
        { id: 'ue', rotulo: 'Úlcera de estresse', opcoes: [
          O('farmaco', 'Com fármaco', 'de úlcera de estresse com [farmaco]', mix(P, campos({ farmaco: txt('Fármaco UE') }))),
          O('sem', 'Sem', 'sem profilaxia de úlcera de estresse')
        ] }
      ], { sep: ' e ' }),
      simples('delirium', 'Delirium', [
        O('neg', 'CAM-ICU negativo', 'CAM-ICU negativo.', P),
        O('pos', 'CAM-ICU positivo', 'CAM-ICU positivo.', S),
        O('na', 'Não aplicável', 'CAM-ICU não aplicável (RASS ≤ -4).')
      ]),
      simples('lpp', 'Lesão por pressão', [
        O('sem', 'Sem LPP', 'Sem LPP.', P),
        O('com', 'Com LPP', 'LPP estágio [estagio] em [local].', campos({ estagio: num('Estágio'), local: txt('Local') }))
      ]),
      intercorrencias('nas últimas 24h')
    ],
    regras: []
  };

  var ps = {
    id: 'ps', nome: 'Pronto-socorro',
    itens: [
      simples('local', 'Local', [
        O('amarela', 'Sala amarela', 'Encontro paciente em sala amarela do PS.', P),
        O('vermelha', 'Sala vermelha', 'Encontro paciente em sala vermelha do PS.'),
        O('corredor', 'Corredor', 'Encontro paciente em corredor do PS.'),
        O('maca', 'Maca', 'Encontro paciente em maca do PS.')
      ]),
      estadoGeral(),
      hemodinamica(),
      respiratorio('Respira confortavelmente em AA.'),
      composto('dieta', 'Dieta', [
        { id: 'tipo', rotulo: 'Dieta', opcoes: [
          O('vo', 'VO liberada', 'Em dieta VO liberada', P),
          O('zero', 'Dieta zero', 'Em dieta zero ([motivo])', campos({ motivo: txt('Motivo') })),
          O('sne', 'SNE', 'Dieta por SNE a [vazao] mL/h', campos({ vazao: num('Vazão', 'mL/h') }))
        ] },
        nauseasVomitos('')
      ], { sep: ', ' }),
      diureseSimples(),
      simples('evolucao', 'Evolução da queixa', [
        O('melhora', 'Melhora', 'Refere melhora da queixa inicial.', P),
        O('igual', 'Sem mudança', 'Sem mudança da queixa inicial.'),
        O('piora', 'Piora', 'Refere piora da queixa inicial.', S)
      ]),
      intercorrencias('desde a admissão'),
      composto('situacao', 'Situação', [
        { id: 'aguarda', rotulo: 'Aguarda', prefixo: 'Aguarda ', vazio: '', caixas: [
          O('exames', 'Exames', 'resultado de exames'),
          O('parecer', 'Parecer', 'parecer de [especialidade]', campos({ especialidade: txt('Especialidade') })),
          O('vaga', 'Vaga em enfermaria', 'vaga em enfermaria', P),
          O('vagauti', 'Vaga em UTI', 'vaga em UTI')
        ] }
      ])
    ],
    regras: []
  };

  var posop = {
    id: 'posop', nome: 'Pós-operatório',
    itens: [
      simples('dpo', 'DPO e cirurgia', [
        O('dpo', 'DPO', 'Encontro paciente em [dpo]º DPO de [cirurgia].', mix(P, campos({ dpo: num('DPO', 'º'), cirurgia: txt('Cirurgia') })))
      ]),
      estadoGeral(),
      hemodinamica(),
      respiratorio('Respira confortavelmente em AA.'),
      simples('dor', 'Dor', [
        O('controlada', 'Controlada', 'Dor controlada com analgesia prescrita.', P),
        O('parcial', 'Parcial', 'Dor parcialmente controlada com analgesia prescrita.', S),
        O('eva', 'EVA', 'Refere dor, EVA [eva]/10.', mix(S, campos({ eva: num('EVA', '/10') })))
      ]),
      simples('fo', 'Ferida operatória', [
        O('limpa', 'Limpa e seca', 'FO limpa e seca, sem sinais flogísticos.', P),
        O('hiperemia', 'Hiperemia', 'FO com hiperemia perincisional.'),
        O('secrecao', 'Secreção', 'FO com secreção [aspecto].', campos({ aspecto: txt('Aspecto') })),
        O('deiscencia', 'Deiscência', 'FO com deiscência.', G)
      ]),
      simples('drenos', 'Drenos', [
        O('nao', 'Sem dreno / não citar', '', P),
        O('dreno', 'Dreno', 'Dreno com débito de [debito] mL/24h, aspecto [aspecto].', campos({ debito: num('Débito', 'mL/24h'), aspecto: txt('Aspecto (seroso/hemático/purulento)') }))
      ]),
      composto('dieta', 'Dieta', [
        { id: 'aceit', rotulo: 'Dieta', opcoes: [
          O('boa', 'Boa aceitação VO', 'Boa aceitação de dieta VO', P),
          O('parcial', 'Parcial', 'Aceitação parcial de dieta VO'),
          O('baixa', 'Baixa', 'Baixa aceitação de dieta VO'),
          O('zero', 'Dieta zero', 'Em dieta zero ([motivo])', campos({ motivo: txt('Motivo') }))
        ] },
        nauseasVomitos('')
      ], { sep: ', ' }),
      simples('transito', 'Trânsito intestinal', [
        O('flatos', 'Flatos', 'Flatos presentes.', P),
        O('evacuacao', 'Flatos e evacuação', 'Flatos e evacuação presentes.'),
        O('ausente', 'Ausente', 'Trânsito intestinal ausente.')
      ]),
      diureseSimples(),
      deambulacao(),
      febreAtb(),
      simples('tev', 'Profilaxia de TEV', [
        O('nao', 'Não citar', '', P),
        O('farmaco', 'Farmacológica', 'Profilaxia de TEV com [farmaco].', campos({ farmaco: txt('Fármaco') })),
        O('mecanica', 'Mecânica', 'Profilaxia de TEV mecânica.')
      ]),
      intercorrencias('nas últimas 24h'),
      queixas()
    ],
    regras: [R1()]
  };

  var paliativo = {
    id: 'paliativo', nome: 'Cuidados paliativos',
    itens: [
      simples('local', 'Local', [
        O('exclusivos', 'Paliativos exclusivos', 'Encontro paciente em leito de enfermaria, em cuidados paliativos exclusivos.', P),
        O('nexclusivos', 'Paliativos', 'Encontro paciente em leito de enfermaria, em cuidados paliativos.')
      ]),
      simples('conforto', 'Conforto', [
        O('confortavel', 'Confortável', 'Confortável no leito.', P),
        O('desconfortavel', 'Desconfortável', 'Desconfortável no leito.', S),
        O('inquieto', 'Inquieto', 'Inquiet{o|a} no leito.', S)
      ]),
      simples('dor', 'Dor', [
        O('controlada', 'Controlada', 'Dor controlada com [farmaco].', mix(P, campos({ farmaco: txt('Fármaco') }))),
        O('parcial', 'Parcial', 'Dor parcialmente controlada com [farmaco], EVA [eva]/10.', mix(S, campos({ farmaco: txt('Fármaco'), eva: num('EVA', '/10') }))),
        O('nao', 'Não controlada', 'Dor não controlada, EVA [eva]/10.', mix(S, campos({ eva: num('EVA', '/10') })))
      ]),
      simples('dispneia', 'Dispneia', [
        O('sem', 'Sem dispneia', 'Sem dispneia.', P),
        O('com', 'Com dispneia', 'Com dispneia, em uso de [medida].', mix(S, campos({ medida: txt('Medida') })))
      ]),
      simples('nauseas', 'Náuseas', [
        O('sem', 'Sem náuseas', 'Sem náuseas.', P),
        O('com', 'Com náuseas', 'Com náuseas.', S),
        O('vomitos', 'Náuseas e vômitos', 'Com náuseas e vômitos.', S)
      ]),
      simples('vas', 'Secreção/ruídos de VAS', [
        O('sem', 'Sem ruídos', 'Sem ruídos de vias aéreas superiores.', P),
        O('com', 'Com ruídos', 'Com ruídos de vias aéreas superiores, em uso de [medida].', mix(S, campos({ medida: txt('Medida') })))
      ]),
      simples('dieta', 'Dieta', [
        O('conforto', 'Por conforto', 'Aceitação de dieta por conforto.', P),
        O('sem', 'Sem aceitação', 'Sem aceitação de dieta.'),
        O('sne', 'SNE', 'Em dieta por SNE a [vazao] mL/h.', campos({ vazao: num('Vazão', 'mL/h') }))
      ]),
      simples('diur', 'Diurese e dejeções', [
        O('presentes', 'Presentes', 'Diurese e dejeções ditas presentes.', P),
        O('dejausentes', 'Dejeções ausentes', 'Diurese presente, dejeções ausentes há [dias] dias.', campos({ dias: num('Dias') })),
        O('oliguria', 'Oligúria', 'Oligúria.')
      ]),
      simples('delirium', 'Delirium/agitação', [
        O('sem', 'Sem delirium', 'Sem sinais de delirium.', P),
        O('hipoativo', 'Hipoativo', 'Com sinais de delirium hipoativo.', S),
        O('agitacao', 'Agitação', 'Com episódios de agitação.', S)
      ]),
      sono(),
      simples('familia', 'Família', [
        O('presente', 'Presente', 'Família presente.', P),
        O('ausente', 'Ausente', 'Família ausente no período.'),
        O('ciente', 'Ciente do prognóstico', 'Família presente e ciente do prognóstico.')
      ]),
      intercorrencias('nas últimas 24h')
    ],
    regras: []
  };

  global.CENARIOS = [enfermaria, uti, ps, posop, paliativo];
})(typeof window !== 'undefined' ? window : globalThis);

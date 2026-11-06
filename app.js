/*
 * Interface. Todo o estado fica só na memória desta página:
 * nada de localStorage, sessionStorage, IndexedDB, cookies ou rede.
 */
(function () {
  'use strict';

  var M = window.Motor;
  var ORIGINAIS = window.CENARIOS;

  var app = {
    cenario: ORIGINAIS[0].id,
    sexo: 'M',
    estado: {},      // itemId -> estado do item (cenário atual)
    editando: false
  };
  var modelos = {};  // cenárioId -> cópia editável (edições da sessão)
  var seq = 0;

  var el = {
    cenario: document.getElementById('cenario'),
    itens: document.getElementById('itens'),
    editor: document.getElementById('editor'),
    saida: document.getElementById('saida'),
    contador: document.getElementById('contador'),
    copiar: document.getElementById('copiar'),
    restaurar: document.getElementById('restaurar'),
    editar: document.getElementById('editar')
  };

  // ---------- utilidades ----------
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function novoId(p) { seq += 1; return (p || 'n') + seq; }
  function original() { return ORIGINAIS.filter(function (c) { return c.id === app.cenario; })[0]; }
  function modelo() {
    if (!modelos[app.cenario]) modelos[app.cenario] = clone(original());
    return modelos[app.cenario];
  }
  function est(itemId) {
    return app.estado[itemId] || (app.estado[itemId] = M.estadoVazio());
  }
  function idSeguro(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }

  /* Re-renderiza mantendo o foco no mesmo controle (por id). */
  function comFoco(fn) {
    var ativo = document.activeElement;
    var id = ativo && ativo.id;
    var sel = ativo && typeof ativo.selectionStart === 'number' ? [ativo.selectionStart, ativo.selectionEnd] : null;
    fn();
    if (id) {
      var novo = document.getElementById(id);
      if (novo && novo !== ativo) {
        novo.focus();
        if (sel && typeof novo.setSelectionRange === 'function') {
          try { novo.setSelectionRange(sel[0], sel[1]); } catch (e) { /* tipo sem seleção */ }
        }
      }
    }
  }

  // ---------- topo ----------
  el.cenario.innerHTML = ORIGINAIS.map(function (c) {
    return '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>';
  }).join('');

  el.cenario.addEventListener('change', function () {
    app.cenario = el.cenario.value;
    app.estado = {}; // novo cenário começa todo em Normal; sexo é mantido
    renderTudo();
  });

  document.querySelectorAll('[data-sexo]').forEach(function (b) {
    b.addEventListener('click', function () {
      app.sexo = b.getAttribute('data-sexo');
      document.querySelectorAll('[data-sexo]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      atualizar();
    });
  });

  el.restaurar.addEventListener('click', function () {
    app.estado = {};
    renderTudo();
  });

  el.editar.addEventListener('click', function () { abrirEditor(!app.editando); });

  // ---------- saída ----------
  var ultimo = null;

  function atualizar() {
    ultimo = M.gerar(modelo(), app.estado, app.sexo);
    el.saida.innerHTML = ultimo.html || '<span class="saida-vazia">Nenhum item no parágrafo.</span>';
    var n = ultimo.texto.length;
    el.contador.textContent = n + (n === 1 ? ' caractere' : ' caracteres');
    atualizarStatus();
    return ultimo;
  }

  function statusItem(item) {
    var st = ultimo.efetivo[item.id];
    if (ultimo.ocultos[item.id]) return { txt: 'Oculto pela regra ' + ultimo.ocultos[item.id].join(', '), cls: 'oculto' };
    if (st.omitido) return { txt: 'Omitido', cls: 'omitido' };
    if (st.livre !== null) return { txt: 'Texto livre', cls: 'alterado' };
    if (ultimo.trocados[item.id]) return { txt: 'Trocado pela regra ' + ultimo.trocados[item.id].join(', '), cls: 'alterado' };
    if (!M.itemPadrao(item, st)) return { txt: 'Alterado', cls: 'alterado' };
    return { txt: 'Normal', cls: 'normal' };
  }

  function atualizarStatus() {
    if (app.editando || !ultimo) return;
    modelo().itens.forEach(function (item) {
      var card = document.getElementById('card-' + idSeguro(item.id));
      if (!card) return;
      var s = statusItem(item);
      card.classList.remove('normal', 'alterado', 'omitido', 'oculto');
      card.classList.add(s.cls);
      var b = card.querySelector('.estado');
      if (b) b.textContent = s.txt;
    });
  }

  // ---------- cópia ----------
  function copiaAlternativa(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.className = 'fora-da-tela';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  var timerCopia = null;
  el.copiar.addEventListener('click', function () {
    var texto = atualizar().texto; // parágrafo único, só ISO-8859-1
    function feito(ok) {
      el.copiar.textContent = ok ? 'Copiado' : 'Não foi possível copiar';
      el.copiar.classList.toggle('ok', ok);
      clearTimeout(timerCopia);
      timerCopia = setTimeout(function () {
        el.copiar.textContent = 'Copiar';
        el.copiar.classList.remove('ok');
      }, 2000);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { feito(true); },
        function () { feito(copiaAlternativa(texto)); });
    } else {
      feito(copiaAlternativa(texto));
    }
  });

  // ---------- cartões dos itens ----------
  function htmlCampos(item, g, op, st) {
    var nomes = M.camposDaFrase(op.frase);
    return nomes.map(function (nome) {
      var meta = (op.campos && op.campos[nome]) || {};
      var chave = g.id + '.' + op.id + '.' + nome;
      var id = 'c-' + idSeguro(item.id + '-' + chave);
      var numero = meta.tipo === 'numero';
      return '<label class="campo' + (numero ? ' num' : '') + '" for="' + id + '">' +
        '<span class="campo-rot">' + esc(meta.rotulo || nome) + '</span>' +
        '<input id="' + id + '" type="text" autocomplete="off" spellcheck="' + (numero ? 'false' : 'true') + '"' +
        (numero ? ' inputmode="decimal"' : '') +
        ' data-acao="campo" data-item="' + esc(item.id) + '" data-chave="' + esc(chave) + '"' +
        ' value="' + esc(st.campos[chave] || '') + '">' +
        (meta.unidade ? '<span class="campo-un">' + esc(meta.unidade) + '</span>' : '') +
        '</label>';
    }).join('');
  }

  function htmlGrupo(item, g, ef, st) {
    var multi = item.grupos.length > 1;
    var rotulo = g.rotulo || item.rotulo;
    var h = '<div class="grupo">';
    if (multi) h += '<span class="grupo-rot">' + esc(rotulo) + '</span>';
    h += '<div class="grupo-ctrl">';
    var campos = '';

    if ((g.opcoes || []).length) {
      var atual = M.selDe(g, ef);
      var padrao = M.padraoDe(g);
      h += '<div class="seg" role="group" aria-label="' + esc(rotulo) + '">';
      g.opcoes.forEach(function (o) {
        var id = 'b-' + idSeguro(item.id + '-' + g.id + '-' + o.id);
        h += '<button type="button" id="' + id + '" class="' + (o === padrao ? 'padrao' : '') + '"' +
          ' aria-pressed="' + (o === atual) + '" data-acao="opcao" data-item="' + esc(item.id) + '"' +
          ' data-grupo="' + esc(g.id) + '" data-opcao="' + esc(o.id) + '"' +
          ' title="' + esc(M.genero(o.frase, app.sexo) || '(sem frase)') + '">' + esc(o.rotulo) + '</button>';
      });
      h += '</div>';
      campos += htmlCampos(item, g, atual, st);
    }

    if ((g.caixas || []).length) {
      h += '<div class="caixas">';
      g.caixas.forEach(function (cx) {
        var id = 'x-' + idSeguro(item.id + '-' + g.id + '-' + cx.id);
        var on = M.marcado(g, ef, cx);
        h += '<label class="caixa" for="' + id + '"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') +
          ' data-acao="caixa" data-item="' + esc(item.id) + '" data-grupo="' + esc(g.id) + '" data-opcao="' + esc(cx.id) + '">' +
          '<span>' + esc(cx.rotulo) + '</span></label>';
        if (on) campos += htmlCampos(item, g, cx, st);
      });
      h += '</div>';
    }
    if (campos) h += '<div class="campos">' + campos + '</div>';
    return h + '</div></div>';
  }

  function htmlCard(item) {
    var st = est(item.id);
    var ef = ultimo.efetivo[item.id];
    var s = statusItem(item);
    var sid = idSeguro(item.id);
    var h = '<article class="card ' + s.cls + '" id="card-' + sid + '" data-item="' + esc(item.id) + '">' +
      '<header class="card-cab">' +
      '<h3>' + esc(item.rotulo) + '</h3>' +
      '<span class="estado">' + esc(s.txt) + '</span>' +
      '<div class="card-acoes">' +
      '<button type="button" class="mini" id="r-' + sid + '" data-acao="normal" data-item="' + esc(item.id) + '" title="Voltar este item para o padrão">Normal</button>';
    if (item.textoLivre !== false) {
      h += '<button type="button" class="mini" id="l-' + sid + '" data-acao="livre" data-item="' + esc(item.id) + '" aria-pressed="' + (st.livre !== null) + '">Texto livre</button>';
    }
    if (item.omitir !== false) {
      h += '<label class="mini mini-caixa" for="o-' + sid + '"><input type="checkbox" id="o-' + sid + '" data-acao="omitir" data-item="' + esc(item.id) + '"' + (st.omitido ? ' checked' : '') + '> Omitir</label>';
    }
    h += '</div></header>';

    h += '<div class="card-corpo">';
    if (st.livre !== null) {
      h += '<label class="livre" for="t-' + sid + '"><span class="campo-rot">Texto livre (substitui a frase inteira do item)</span>' +
        '<textarea id="t-' + sid + '" rows="2" data-acao="textolivre" data-item="' + esc(item.id) + '">' + esc(st.livre) + '</textarea></label>';
    } else {
      item.grupos.forEach(function (g) { h += htmlGrupo(item, g, ef, st); });
    }
    if (item.nota) h += '<p class="nota">' + esc(item.nota) + '</p>';
    return h + '</div></article>';
  }

  function renderItens() {
    comFoco(function () {
      el.itens.innerHTML = modelo().itens.map(htmlCard).join('');
    });
  }

  function renderTudo() {
    el.cenario.value = app.cenario;
    atualizar();
    if (app.editando) renderEditor(); else renderItens();
  }

  // eventos dos cartões (delegação)
  el.itens.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-acao]');
    if (!b) return;
    var itemId = b.getAttribute('data-item');
    var acao = b.getAttribute('data-acao');
    var st = est(itemId);
    if (acao === 'opcao') {
      st.sel[b.getAttribute('data-grupo')] = b.getAttribute('data-opcao');
      st.livre = null;
    } else if (acao === 'normal') {
      delete app.estado[itemId];
    } else if (acao === 'livre') {
      if (st.livre === null) {
        var item = M.acharItem(modelo(), itemId);
        var atual = M.textoItem(item, st, app.sexo).split(M.MARCA).join('__');
        st.livre = atual;
        atualizar();
        renderItens();
        var ta = document.getElementById('t-' + idSeguro(itemId));
        if (ta) { ta.focus(); ta.select(); }
        return;
      }
      st.livre = null;
    }
    atualizar();
    renderItens();
  });

  el.itens.addEventListener('change', function (ev) {
    var t = ev.target;
    var acao = t.getAttribute('data-acao');
    var itemId = t.getAttribute('data-item');
    if (acao === 'caixa') {
      var st = est(itemId), g = t.getAttribute('data-grupo');
      st.marc[g] = st.marc[g] || {};
      st.marc[g][t.getAttribute('data-opcao')] = t.checked;
    } else if (acao === 'omitir') {
      est(itemId).omitido = t.checked;
    } else {
      return;
    }
    atualizar();
    renderItens();
  });

  el.itens.addEventListener('input', function (ev) {
    var t = ev.target;
    var acao = t.getAttribute('data-acao');
    if (acao === 'campo') {
      est(t.getAttribute('data-item')).campos[t.getAttribute('data-chave')] = t.value;
    } else if (acao === 'textolivre') {
      est(t.getAttribute('data-item')).livre = t.value;
    } else {
      return;
    }
    atualizar(); // sem re-renderizar: mantém foco e cursor
  });

  // ---------- modo de edição ----------
  function abrirEditor(abrir) {
    app.editando = abrir;
    el.editar.setAttribute('aria-pressed', String(abrir));
    el.editar.textContent = abrir ? 'Fechar edição' : 'Editar modelo';
    el.editor.hidden = !abrir;
    el.itens.hidden = abrir;
    renderTudo();
    window.scrollTo(0, 0);
  }

  function rotuloOpcao(item, g, o) {
    var gr = item.grupos.length > 1 ? (g.rotulo || g.id) + ': ' : '';
    return gr + (o.rotulo || o.id);
  }

  function opcoesSe(m) {
    var lst = [
      ['sintoma', 'Qualquer opção de sintoma ativa'],
      ['gravidade', 'Qualquer opção de gravidade ativa']
    ];
    m.itens.forEach(function (it) {
      lst.push(['np|' + it.id, it.rotulo + ' ≠ padrão (qualquer alteração)']);
      it.grupos.forEach(function (g) {
        (g.opcoes || []).concat(g.caixas || []).forEach(function (o) {
          lst.push(['op|' + it.id + '|' + g.id + '|' + o.id, it.rotulo + ' = ' + rotuloOpcao(it, g, o)]);
        });
      });
    });
    return lst;
  }

  function opcoesEntao(m) {
    var lst = [];
    m.itens.forEach(function (it) {
      lst.push(['oc|' + it.id, 'Ocultar item: ' + it.rotulo]);
      lst.push(['op|' + it.id, 'Ocultar item se estiver no padrão: ' + it.rotulo]);
      it.grupos.forEach(function (g) {
        (g.opcoes || []).concat(g.caixas || []).forEach(function (o) {
          lst.push(['tr|' + it.id + '|' + g.id + '|' + o.id, 'Trocar ' + it.rotulo + ' para: ' + rotuloOpcao(it, g, o)]);
        });
      });
    });
    return lst;
  }

  function codSe(se) {
    if (se.tipo === 'sintoma' || se.tipo === 'gravidade') return se.tipo;
    if (se.tipo === 'naoPadrao') return 'np|' + se.item;
    return 'op|' + se.item + '|' + se.grupo + '|' + se.opcao;
  }
  function decSe(v) {
    var p = v.split('|');
    if (p[0] === 'np') return { tipo: 'naoPadrao', item: p[1] };
    if (p[0] === 'op') return { tipo: 'opcao', item: p[1], grupo: p[2], opcao: p[3] };
    return { tipo: p[0] };
  }
  function codEntao(e) {
    if (e.tipo === 'ocultar') return 'oc|' + e.item;
    if (e.tipo === 'ocultarPadrao') return 'op|' + e.item;
    return 'tr|' + e.item + '|' + e.grupo + '|' + e.opcao;
  }
  function decEntao(v) {
    var p = v.split('|');
    if (p[0] === 'oc') return { tipo: 'ocultar', item: p[1] };
    if (p[0] === 'op') return { tipo: 'ocultarPadrao', item: p[1] };
    return { tipo: 'trocar', item: p[1], grupo: p[2], opcao: p[3] };
  }

  function select(id, lst, valor, attrs) {
    var achou = lst.some(function (o) { return o[0] === valor; });
    return '<select id="' + id + '" ' + attrs + '>' +
      (achou ? '' : '<option value="" selected>(referência apagada)</option>') +
      lst.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
  }

  function inp(id, valor, attrs, rotulo, cls) {
    return '<label class="ed-campo ' + (cls || '') + '" for="' + id + '"><span>' + esc(rotulo) + '</span>' +
      '<input type="text" id="' + id + '" value="' + esc(valor) + '" ' + attrs + ' spellcheck="false"></label>';
  }
  function chk(id, on, attrs, rotulo, titulo) {
    return '<label class="ed-chk" for="' + id + '"' + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' +
      '<input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' ' + attrs + '> ' + esc(rotulo) + '</label>';
  }

  function htmlEdOpcao(i, gi, tipo, oi, o, g) {
    var base = 'data-i="' + i + '" data-g="' + gi + '" data-k="' + tipo + '" data-o="' + oi + '"';
    var p = 'e-' + i + '-' + gi + '-' + tipo + '-' + oi;
    var h = '<div class="ed-opcao">';
    if (tipo === 'opcoes') {
      h += '<label class="ed-chk" for="' + p + '-padrao" title="Frase padrão (Normal)"><input type="radio" name="padrao-' + i + '-' + gi + '" id="' + p + '-padrao"' +
        (o === M.padraoDe(g) ? ' checked' : '') + ' ' + base + ' data-prop="padrao"> Padrão</label>';
    } else {
      h += chk(p + '-padrao', !!o.padrao, base + ' data-prop="padrao"', 'Marcada', 'Marcada por padrão');
    }
    h += inp(p + '-rotulo', o.rotulo, base + ' data-prop="rotulo" data-reestrutura="1"', 'Botão', 'curto');
    h += inp(p + '-frase', o.frase, base + ' data-prop="frase"', 'Frase', 'largo');
    h += chk(p + '-s', !!o.sintoma, base + ' data-prop="sintoma"', 'Sintoma', 'Ativa a regra de sintoma (ex.: R1)');
    h += chk(p + '-g', !!o.gravidade, base + ' data-prop="gravidade"', 'Gravidade', 'Ativa a regra de gravidade (ex.: R3)');
    h += '<button type="button" class="mini perigo" data-ed="apagarOpcao" ' + base + ' aria-label="Apagar ' + esc(o.rotulo) + '">Apagar</button>';
    return h + '</div>';
  }

  function htmlEdItem(item, i, total) {
    var di = 'data-i="' + i + '"';
    var h = '<details class="ed-item" id="ed-item-' + i + '"' + (abertos[item.id] ? ' open' : '') + ' data-item="' + esc(item.id) + '">' +
      '<summary><span class="ed-ordem">' + (i + 1) + '</span> ' + esc(item.rotulo) + '</summary>' +
      '<div class="ed-item-corpo">' +
      '<div class="ed-linha">' +
      inp('e-' + i + '-rotulo', item.rotulo, di + ' data-prop="rotulo" data-reestrutura="1"', 'Nome do item', 'medio') +
      chk('e-' + i + '-livre', item.textoLivre !== false, di + ' data-prop="textoLivre"', 'Permite texto livre') +
      chk('e-' + i + '-omitir', item.omitir !== false, di + ' data-prop="omitir"', 'Permite omitir') +
      '<span class="ed-espaco"></span>' +
      '<button type="button" class="mini" data-ed="subir" ' + di + (i === 0 ? ' disabled' : '') + '>↑ Subir</button>' +
      '<button type="button" class="mini" data-ed="descer" ' + di + (i === total - 1 ? ' disabled' : '') + '>↓ Descer</button>' +
      '<button type="button" class="mini perigo" data-ed="apagarItem" ' + di + '>Apagar item</button>' +
      '</div>';
    if (item.fraseQuandoPadrao != null) {
      h += '<div class="ed-linha">' + inp('e-' + i + '-fqp', item.fraseQuandoPadrao, di + ' data-prop="fraseQuandoPadrao"',
        'Frase quando todos os subitens estão no padrão', 'largo') + '</div>';
    }
    item.grupos.forEach(function (g, gi) {
      h += '<div class="ed-grupo">';
      if (item.grupos.length > 1) h += '<h4>Subitem: ' + esc(g.rotulo || g.id) + '</h4>';
      if (g.opcoes && g.opcoes.length) {
        g.opcoes.forEach(function (o, oi) { h += htmlEdOpcao(i, gi, 'opcoes', oi, o, g); });
      }
      if (g.caixas && g.caixas.length) {
        h += '<p class="ed-sub">Complementos (caixas de marcar)</p>';
        g.caixas.forEach(function (o, oi) { h += htmlEdOpcao(i, gi, 'caixas', oi, o, g); });
      }
      var dg = di + ' data-g="' + gi + '"';
      h += '<div class="ed-linha">';
      if (g.opcoes) h += '<button type="button" class="mini" data-ed="novaOpcao" ' + dg + '>+ Alternativa</button>';
      if (g.caixas) h += '<button type="button" class="mini" data-ed="novaCaixa" ' + dg + '>+ Complemento</button>';
      h += '</div></div>';
    });
    return h + '</div></details>';
  }

  var abertos = {};

  function htmlEdRegras(m) {
    var se = opcoesSe(m), en = opcoesEntao(m);
    var h = '<section class="ed-regras"><h3>Regras automáticas</h3>';
    if (!m.regras.length) h += '<p class="ed-sub">Nenhuma regra neste cenário.</p>';
    m.regras.forEach(function (r, ri) {
      var dr = 'data-r="' + ri + '"';
      var valida = M.regraValida(m, r);
      h += '<div class="ed-regra' + (r.ativa === false ? ' desligada' : '') + (valida ? '' : ' invalida') + '">' +
        chk('r-' + ri + '-ativa', r.ativa !== false, dr + ' data-rprop="ativa"', r.id) +
        '<label class="ed-campo" for="r-' + ri + '-se"><span>Se</span>' + select('r-' + ri + '-se', se, codSe(r.se), dr + ' data-rprop="se"') + '</label>' +
        '<label class="ed-campo" for="r-' + ri + '-entao"><span>Então</span>' + select('r-' + ri + '-entao', en, codEntao(r.entao), dr + ' data-rprop="entao"') + '</label>' +
        '<button type="button" class="mini perigo" data-ed="apagarRegra" ' + dr + '>Apagar</button>' +
        (valida ? '' : '<p class="ed-erro">Regra incompleta: escolha o item e a opção.</p>') +
        '</div>';
    });
    h += '<button type="button" class="mini" data-ed="novaRegra">+ Nova regra</button></section>';
    return h;
  }

  function renderEditor() {
    var m = modelo();
    comFoco(function () {
      el.editor.innerHTML =
        '<div class="ed-aviso" role="note">Edições são temporárias. Recarregar a página restaura o modelo original.</div>' +
        '<div class="ed-barra"><h2>Editar modelo: ' + esc(original().nome) + '</h2>' +
        '<button type="button" class="btn" data-ed="descartar">Descartar edições</button>' +
        '<button type="button" class="btn" data-ed="fechar">Fechar</button></div>' +
        '<p class="ed-ajuda">Na frase, use <code>[nome]</code> para criar um campo e <code>{o|a}</code> para concordância (masculino|feminino). ' +
        'Marque <b>Sintoma</b> ou <b>Gravidade</b> para a alternativa disparar as regras.</p>' +
        '<section class="ed-itens"><h3>Itens (na ordem do parágrafo)</h3>' +
        m.itens.map(function (it, i) { return htmlEdItem(it, i, m.itens.length); }).join('') +
        '<button type="button" class="mini" data-ed="novoItem">+ Novo item</button></section>' +
        htmlEdRegras(m);
    });
  }

  function alvoOpcao(t) {
    var item = modelo().itens[+t.getAttribute('data-i')];
    var g = item.grupos[+t.getAttribute('data-g')];
    var k = t.getAttribute('data-k');
    return { item: item, g: g, k: k, lista: g[k], o: g[k][+t.getAttribute('data-o')] };
  }

  function aplicarEdicao(t, final) {
    var m = modelo();
    if (t.hasAttribute('data-rprop')) {
      var r = m.regras[+t.getAttribute('data-r')];
      var p = t.getAttribute('data-rprop');
      if (p === 'ativa') r.ativa = t.checked;
      else if (p === 'se' && t.value) r.se = decSe(t.value);
      else if (p === 'entao' && t.value) r.entao = decEntao(t.value);
      atualizar();
      if (final) renderEditor();
      return;
    }
    var prop = t.getAttribute('data-prop');
    if (!prop) return;
    var valor = t.type === 'checkbox' ? t.checked : t.value;
    if (t.hasAttribute('data-o')) {
      var a = alvoOpcao(t);
      if (prop === 'padrao' && a.k === 'opcoes') {
        a.lista.forEach(function (o) { o.padrao = false; });
        a.o.padrao = true;
      } else {
        a.o[prop] = valor;
      }
    } else {
      m.itens[+t.getAttribute('data-i')][prop] = valor;
    }
    atualizar();
    if (final && (t.type !== 'text' || t.hasAttribute('data-reestrutura'))) renderEditor();
  }

  el.editor.addEventListener('input', function (ev) {
    if (ev.target.type === 'text') aplicarEdicao(ev.target, false);
  });
  el.editor.addEventListener('change', function (ev) { aplicarEdicao(ev.target, true); });
  el.editor.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (d.classList && d.classList.contains('ed-item')) abertos[d.getAttribute('data-item')] = d.open;
  }, true);

  el.editor.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-ed]');
    if (!b) return;
    var m = modelo();
    var acao = b.getAttribute('data-ed');
    var i = +b.getAttribute('data-i');
    var item = m.itens[i];
    if (acao === 'fechar') { abrirEditor(false); return; }
    if (acao === 'descartar') {
      delete modelos[app.cenario];
      abertos = {};
    } else if (acao === 'subir' || acao === 'descer') {
      var j = acao === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= m.itens.length) return;
      m.itens.splice(j, 0, m.itens.splice(i, 1)[0]);
    } else if (acao === 'apagarItem') {
      m.itens.splice(i, 1);
    } else if (acao === 'novoItem') {
      var id = novoId('item');
      m.itens.push({
        id: id, rotulo: 'Novo item', textoLivre: true, omitir: true,
        grupos: [{ id: 'g', rotulo: '', opcoes: [{ id: novoId('o'), rotulo: 'Padrão', frase: 'Nova frase.', padrao: true }] }]
      });
      abertos[id] = true;
    } else if (acao === 'novaOpcao' || acao === 'novaCaixa') {
      var g = item.grupos[+b.getAttribute('data-g')];
      var k = acao === 'novaOpcao' ? 'opcoes' : 'caixas';
      g[k] = g[k] || [];
      g[k].push({ id: novoId('o'), rotulo: k === 'opcoes' ? 'Nova alternativa' : 'Novo complemento', frase: k === 'opcoes' ? 'Nova frase.' : 'novo complemento' });
    } else if (acao === 'apagarOpcao') {
      var a = alvoOpcao(b);
      if (a.k === 'opcoes' && a.lista.length <= 1) return; // item precisa de ao menos 1 frase
      var eraPadrao = a.o.padrao;
      a.lista.splice(+b.getAttribute('data-o'), 1);
      if (eraPadrao && a.k === 'opcoes') a.lista[0].padrao = true;
    } else if (acao === 'novaRegra') {
      var alvo = m.itens[m.itens.length - 1];
      var maior = m.regras.reduce(function (x, r) { var n = parseInt(String(r.id).replace(/\D/g, ''), 10); return n > x ? n : x; }, 6);
      m.regras.push({ id: 'R' + (maior + 1), ativa: true, se: { tipo: 'sintoma' }, entao: { tipo: 'ocultar', item: alvo ? alvo.id : '' } });
    } else if (acao === 'apagarRegra') {
      m.regras.splice(+b.getAttribute('data-r'), 1);
    }
    atualizar();
    renderEditor();
  });

  // ---------- início ----------
  renderTudo();
})();

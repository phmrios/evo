/*
 * Motor de texto: monta o parágrafo a partir do modelo do cenário,
 * do estado dos itens e do sexo. Funções puras, sem DOM.
 */
(function (global) {
  'use strict';

  var MARCA = ''; // campo vazio (vira "__"); fora do ISO-8859-1, nunca sai na cópia

  // ---------- Conversão para ISO-8859-1 ----------
  var MAPA = {
    '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"', '«': '«', '»': '»',
    '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
    '—': '-', '–': '-', '‒': '-', '‐': '-', '‑': '-', '−': '-', '―': '-',
    '…': '...',
    '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~',
    '→': '->', '←': '<-', '↔': '<->', '⇒': '=>',
    '•': '-', '●': '-', '▪': '-', '‣': '-', '⁃': '-',
    ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
    ' ': ' ', ' ': ' ', '\t': ' ', '\n': ' ', '\r': ' ', '\v': ' ', '\f': ' ',
    '­': ''
  };
  // subscritos e sobrescritos fora do Latin-1 -> dígitos normais
  for (var d = 0; d <= 9; d++) {
    MAPA[String.fromCharCode(0x2080 + d)] = String(d);
    if (d !== 1 && d !== 2 && d !== 3) MAPA[String.fromCharCode(0x2070 + d)] = String(d);
  }
  MAPA['₊'] = '+'; MAPA['₋'] = '-'; MAPA['⁺'] = '+'; MAPA['⁻'] = '-';

  function iso(s) {
    s = String(s == null ? '' : s).normalize('NFC');
    var out = '';
    for (var ch of s) {
      if (Object.prototype.hasOwnProperty.call(MAPA, ch)) { out += MAPA[ch]; continue; }
      var c = ch.codePointAt(0);
      if (c > 0xFF) continue;                         // emoji etc.: removido
      if (c < 0x20 || (c >= 0x7F && c < 0xA0)) continue; // controles restantes
      out += ch;
    }
    return out;
  }

  // ---------- Auxiliares de texto ----------
  function limpa(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  function genero(s, sexo) {
    return String(s || '').replace(/\{([^{}|]*)\|([^{}]*)\}/g, function (_, m, f) { return sexo === 'F' ? f : m; });
  }

  function camposDaFrase(frase) {
    var nomes = [], re = /\[([^\[\]]+)\]/g, m;
    while ((m = re.exec(frase || ''))) if (nomes.indexOf(m[1]) < 0) nomes.push(m[1]);
    return nomes;
  }

  function lista(partes) {
    if (partes.length <= 1) return partes.join('');
    return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
  }

  function finaliza(t) {
    t = limpa(t);
    if (!t) return '';
    var primeiro = t.charAt(0);
    t = primeiro.toLocaleUpperCase('pt-BR') + t.slice(1);
    if (!/[.!?]$/.test(t)) t += '.';
    return t;
  }

  function render(frase, st, prefixo, sexo) {
    var base = iso(genero(frase, sexo));
    return base.replace(/\[([^\[\]]+)\]/g, function (_, nome) {
      var v = limpa(iso(st.campos[prefixo + nome] || ''));
      return v || MARCA;
    });
  }

  // ---------- Estado ----------
  function estadoVazio() { return { livre: null, omitido: false, sel: {}, marc: {}, campos: {} }; }

  function copiaEstado(s) {
    s = s || estadoVazio();
    var marc = {};
    for (var g in s.marc) marc[g] = Object.assign({}, s.marc[g]);
    return { livre: s.livre, omitido: s.omitido, sel: Object.assign({}, s.sel), marc: marc, campos: s.campos };
  }

  function padraoDe(g) {
    var ops = g.opcoes || [];
    for (var i = 0; i < ops.length; i++) if (ops[i].padrao) return ops[i];
    return ops[0] || null;
  }

  function selDe(g, st) {
    var ops = g.opcoes || [], id = st.sel[g.id];
    for (var i = 0; i < ops.length; i++) if (ops[i].id === id) return ops[i];
    return padraoDe(g);
  }

  function marcado(g, st, cx) {
    var v = st.marc[g.id] && st.marc[g.id][cx.id];
    return v === undefined ? !!cx.padrao : !!v;
  }

  function gruposPadrao(item, st) {
    return item.grupos.every(function (g) {
      if ((g.opcoes || []).length && selDe(g, st) !== padraoDe(g)) return false;
      return (g.caixas || []).every(function (cx) { return marcado(g, st, cx) === !!cx.padrao; });
    });
  }

  function itemPadrao(item, st) { return st.livre === null && gruposPadrao(item, st); }

  // ---------- Regras ----------
  function acharItem(m, id) {
    for (var i = 0; i < m.itens.length; i++) if (m.itens[i].id === id) return m.itens[i];
    return null;
  }
  function acharGrupo(item, id) {
    if (!item) return null;
    for (var i = 0; i < item.grupos.length; i++) if (item.grupos[i].id === id) return item.grupos[i];
    return null;
  }
  function acharOpcao(g, id) {
    if (!g) return null;
    var todas = (g.opcoes || []).concat(g.caixas || []);
    for (var i = 0; i < todas.length; i++) if (todas[i].id === id) return todas[i];
    return null;
  }

  function regraValida(m, r) {
    if (!r || !r.se || !r.entao) return false;
    var se = r.se, en = r.entao;
    if (se.tipo === 'naoPadrao' && !acharItem(m, se.item)) return false;
    if (se.tipo === 'opcao' && !acharOpcao(acharGrupo(acharItem(m, se.item), se.grupo), se.opcao)) return false;
    if (['sintoma', 'gravidade', 'naoPadrao', 'opcao'].indexOf(se.tipo) < 0) return false;
    if (!acharItem(m, en.item)) return false;
    if (en.tipo === 'trocar') return !!acharOpcao(acharGrupo(acharItem(m, en.item), en.grupo), en.opcao);
    return en.tipo === 'ocultar' || en.tipo === 'ocultarPadrao';
  }

  function itemAtivo(st) { return !st.omitido && st.livre === null; }

  function condicao(m, se, estados) {
    if (se.tipo === 'sintoma' || se.tipo === 'gravidade') {
      var flag = se.tipo;
      return m.itens.some(function (it) {
        var st = estados[it.id];
        if (!itemAtivo(st)) return false;
        return it.grupos.some(function (g) {
          var o = selDe(g, st);
          if (o && o[flag]) return true;
          return (g.caixas || []).some(function (cx) { return cx[flag] && marcado(g, st, cx); });
        });
      });
    }
    var item = acharItem(m, se.item);
    var st = estados[se.item];
    if (!item || !st) return false;
    if (se.tipo === 'naoPadrao') return !st.omitido && !itemPadrao(item, st);
    if (se.tipo === 'opcao') {
      if (!itemAtivo(st)) return false;
      var g = acharGrupo(item, se.grupo);
      if (!g) return false;
      var o = selDe(g, st);
      if (o && o.id === se.opcao) return true;
      return (g.caixas || []).some(function (cx) { return cx.id === se.opcao && marcado(g, st, cx); });
    }
    return false;
  }

  /*
   * Passo 1 do motor: aplica as regras.
   * 1a) trocas (condição avaliada no estado escolhido pelo usuário);
   * 1b) ocultações (condição avaliada no estado já com as trocas).
   */
  function aplicarRegras(m, estadosUsuario) {
    var usuario = {}, efetivo = {};
    m.itens.forEach(function (it) {
      usuario[it.id] = estadosUsuario[it.id] || estadoVazio();
      efetivo[it.id] = copiaEstado(usuario[it.id]);
    });
    var regras = (m.regras || []).filter(function (r) { return r.ativa !== false && regraValida(m, r); });
    var trocados = {}, ocultos = {};

    regras.forEach(function (r) {
      if (r.entao.tipo !== 'trocar' || !condicao(m, r.se, usuario)) return;
      var ef = efetivo[r.entao.item];
      var g = acharGrupo(acharItem(m, r.entao.item), r.entao.grupo);
      ef.livre = null; ef.omitido = false;
      if ((g.caixas || []).some(function (cx) { return cx.id === r.entao.opcao; })) {
        ef.marc[g.id] = ef.marc[g.id] || {};
        ef.marc[g.id][r.entao.opcao] = true;
      } else {
        ef.sel[g.id] = r.entao.opcao;
      }
      (trocados[r.entao.item] = trocados[r.entao.item] || []).push(r.id);
    });

    regras.forEach(function (r) {
      if (r.entao.tipo === 'trocar' || !condicao(m, r.se, efetivo)) return;
      var item = acharItem(m, r.entao.item), ef = efetivo[item.id];
      if (r.entao.tipo === 'ocultar' || itemPadrao(item, ef)) {
        (ocultos[item.id] = ocultos[item.id] || []).push(r.id);
      }
    });
    return { efetivo: efetivo, trocados: trocados, ocultos: ocultos };
  }

  // ---------- Passos 2 a 5: frases ----------
  function textoGrupo(g, st, sexo) {
    var partes = [];
    if ((g.opcoes || []).length) {
      var o = selDe(g, st);
      var t = limpa(render(o.frase, st, g.id + '.' + o.id + '.', sexo));
      if (t) partes.push(t);
    }
    if ((g.caixas || []).length) {
      var marcadas = g.caixas
        .filter(function (cx) { return marcado(g, st, cx); })
        .map(function (cx) { return limpa(render(cx.frase, st, g.id + '.' + cx.id + '.', sexo)); })
        .filter(Boolean);
      if (marcadas.length) {
        partes.push(iso(genero(g.prefixo || '', sexo)) + (g.juntar === 'virgula' ? marcadas.join(', ') : lista(marcadas)));
      } else if (g.vazio) {
        var v = limpa(render(g.vazio, st, g.id + '.vazio.', sexo));
        if (v) partes.push(v);
      }
    }
    return partes.join(', ');
  }

  function textoItem(item, st, sexo) {
    if (st.livre !== null) {
      var livre = limpa(iso(st.livre));
      return finaliza(livre || MARCA);
    }
    if (item.fraseQuandoPadrao && gruposPadrao(item, st)) {
      return finaliza(render(item.fraseQuandoPadrao, st, 'item.', sexo));
    }
    var partes = item.grupos.map(function (g) { return textoGrupo(g, st, sexo); }).filter(Boolean);
    if (!partes.length) return '';
    var sep = item.sep == null ? ', ' : item.sep;
    if (sep === 'lista') return finaliza(lista(partes));
    if (sep.trim() === '.') return partes.map(finaliza).join(' ');
    return finaliza(partes.join(sep));
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /*
   * Gera o parágrafo.
   * Retorna { texto (para copiar), html (para a tela), efetivo, ocultos, trocados, partes }.
   */
  function gerar(modelo, estados, sexo) {
    var r = aplicarRegras(modelo, estados || {});
    var partes = [];
    modelo.itens.forEach(function (it) {
      if (r.ocultos[it.id]) return;
      var st = r.efetivo[it.id];
      if (st.omitido) return;
      var t = textoItem(it, st, sexo);
      if (!t) return;
      partes.push({ item: it.id, texto: t, alterado: !itemPadrao(it, st) });
    });
    var bruto = partes.map(function (p) { return p.texto; }).join(' ');
    // Passo 6: saída final só com ISO-8859-1, parágrafo único
    var texto = limpa(iso(bruto.split(MARCA).join('__')));
    var html = partes.map(function (p) {
      var h = escHtml(p.texto).split(MARCA).join('<span class="vazio">__</span>');
      return p.alterado ? '<mark class="alt">' + h + '</mark>' : '<span>' + h + '</span>';
    }).join(' ');
    return { texto: texto, html: html, efetivo: r.efetivo, ocultos: r.ocultos, trocados: r.trocados, partes: partes };
  }

  global.Motor = {
    MARCA: MARCA,
    iso: iso,
    genero: genero,
    camposDaFrase: camposDaFrase,
    estadoVazio: estadoVazio,
    padraoDe: padraoDe,
    selDe: selDe,
    marcado: marcado,
    itemPadrao: itemPadrao,
    textoItem: textoItem,
    regraValida: regraValida,
    acharItem: acharItem,
    acharGrupo: acharGrupo,
    acharOpcao: acharOpcao,
    gerar: gerar
  };
})(typeof window !== 'undefined' ? window : globalThis);

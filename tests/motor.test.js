// Testes do motor (node tests/motor.test.js)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ctx = { globalThis: {} }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['cenarios.js', 'motor.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const { Motor: M, CENARIOS } = ctx;
const enf = () => JSON.parse(JSON.stringify(CENARIOS[0]));
const st = () => M.estadoVazio();
let ok = 0; const t = (n, fn) => { fn(); ok++; console.log('ok -', n); };

const PADRAO = 'Encontro paciente em leito de enfermaria. Acordado, corado, hidratado, acianótico, anictérico, contactuante e colaborativo. Evolui clínica e hemodinamicamente estável. Respira confortavelmente em AA, sem necessidade de suporte respiratório. Boa aceitação de dieta VO, sem episódios de náuseas ou vômitos. Diurese e dejeções ditas presentes e sem alterações. Deambula no período. Afebril, sem uso de ATB. Ciclo sono-vigília preservado. Sem intercorrências nas últimas 24h. Sem sinais de gravidade ou instabilidade. Nega queixas.';

t('texto padrão igual à seção 6', () => assert.strictEqual(M.gerar(enf(), {}, 'M').texto, PADRAO));
t('sexo F muda concordância', () => {
  const x = M.gerar(enf(), {}, 'F').texto;
  assert(x.includes('Acordada, corada, hidratada, acianótica, anictérica, contactuante e colaborativa.'));
  const e = { deamb: st() }; e.deamb.sel.g = 'restrito';
  assert(M.gerar(enf(), e, 'F').texto.includes('Restrita ao leito.'));
});
t('CN com 2 L/min', () => {
  const e = { resp: st() }; e.resp.sel.g = 'cn'; e.resp.campos['g.cn.o2'] = '2';
  assert(M.gerar(enf(), e, 'M').texto.includes('Em uso de O2 por CN a 2 L/min.'));
});
t('campo vazio = __ destacado', () => {
  const e = { resp: st() }; e.resp.sel.g = 'cn';
  const r = M.gerar(enf(), e, 'M');
  assert(r.texto.includes('CN a __ L/min.')); assert(r.html.includes('<span class="vazio">__</span>'));
});
t('queixa troca Nega queixas', () => {
  const e = { queixas: st() }; e.queixas.sel.g = 'refere'; e.queixas.campos['g.refere.queixa'] = 'cefaleia leve';
  const x = M.gerar(enf(), e, 'M').texto; assert(x.endsWith('Refere cefaleia leve.')); assert(!x.includes('Nega queixas'));
});
t('vômitos remove Nega queixas (R1)', () => {
  const e = { dieta: st() }; e.dieta.marc.gi = { vomitos: true }; e.dieta.campos['gi.vomitos.vomitos'] = '2';
  const x = M.gerar(enf(), e, 'M').texto;
  assert(x.includes('Boa aceitação de dieta VO, com 2 episódio(s) de vômito.')); assert(!x.includes('Nega queixas'));
});
t('VNI e instável removem gravidade (R3, R4)', () => {
  const a = { resp: st() }; a.resp.sel.g = 'vni';
  assert(!M.gerar(enf(), a, 'M').texto.includes('Sem sinais de gravidade'));
  const b = { hemo: st() }; b.hemo.sel.g = 'hipertenso';
  assert(!M.gerar(enf(), b, 'M').texto.includes('Sem sinais de gravidade'));
});
t('R5 e R6', () => {
  const a = { interc: st() }; a.interc.sel.g = 'com';
  assert(!M.gerar(enf(), a, 'M').texto.includes('Sem sinais de gravidade'));
  const b = { febre: st() }; b.febre.sel.febre = 'febril'; b.febre.campos['febre.febril.pico'] = '38,5';
  b.febre.sel.atb = 'com'; b.febre.campos['atb.com.atb'] = 'ceftriaxona'; b.febre.campos['atb.com.dia'] = '3';
  const x = M.gerar(enf(), b, 'M').texto;
  assert(x.includes('Febril no período, pico de 38,5 °C, em uso de ceftriaxona (D3).')); assert(!x.includes('Sem sinais de gravidade'));
});
t('texto livre substitui a frase e põe ponto', () => {
  const e = { deamb: st() }; e.deamb.livre = 'deambula com andador';
  const x = M.gerar(enf(), e, 'M').texto; assert(x.includes('Deambula com andador. Afebril')); assert(!x.includes('Deambula no período'));
});
t('conversão ISO-8859-1', () => {
  const e = { interc: st() }; e.interc.livre = '“aspas” ‘x’ — – O₂ ≥ 90… ≤ → • 😀\tnova\nlinha ç ° µ ±';
  const x = M.gerar(enf(), e, 'M').texto;
  assert(x.includes('"aspas" \'x\' - - O2 >= 90... <= -> - nova linha ç ° µ ±.'), x);
  for (const ch of x) assert(ch.codePointAt(0) <= 0xFF);
  assert(!/[\r\n]/.test(x));
});
t('5 cenários geram sem erro, M e F, só Latin-1', () => {
  assert.strictEqual(CENARIOS.length, 5);
  for (const c of CENARIOS) for (const s of ['M', 'F']) {
    const x = M.gerar(c, {}, s).texto; assert(x.length > 50);
    for (const ch of x) assert(ch.codePointAt(0) <= 0xFF, c.id);
    console.log('   ', c.id, s, '→', x.slice(0, 110) + '…');
  }
});
t('todas as opções de todos os cenários geram texto', () => {
  for (const c of CENARIOS) for (const it of c.itens) for (const g of it.grupos) {
    for (const o of g.opcoes || []) { const e = { [it.id]: st() }; e[it.id].sel[g.id] = o.id; M.gerar(c, e, 'F'); }
    for (const o of g.caixas || []) { const e = { [it.id]: st() }; e[it.id].marc[g.id] = { [o.id]: true }; M.gerar(c, e, 'F'); }
  }
});
t('frase editada aparece; regra desligada e regra criada', () => {
  const m = enf(); m.itens.find(i => i.id === 'deamb').grupos[0].opcoes[0].frase = 'Deambula sem auxílio pelo corredor.';
  assert(M.gerar(m, {}, 'M').texto.includes('Deambula sem auxílio pelo corredor.'));
  const m2 = enf(); m2.regras.find(r => r.id === 'R3').ativa = false;
  const e = { resp: st() }; e.resp.sel.g = 'vni';
  assert(M.gerar(m2, e, 'M').texto.includes('Sem sinais de gravidade'));
  m2.regras.push({ id: 'R7', ativa: true, se: { tipo: 'opcao', item: 'resp', grupo: 'g', opcao: 'vni' }, entao: { tipo: 'trocar', item: 'deamb', grupo: 'g', opcao: 'restrito' } });
  assert(M.gerar(m2, e, 'M').texto.includes('Restrito ao leito.'));
  m2.regras.push({ id: 'R8', ativa: true, se: { tipo: 'opcao', item: 'resp', grupo: 'g', opcao: 'vni' }, entao: { tipo: 'ocultar', item: 'sono' } });
  assert(!M.gerar(m2, e, 'M').texto.includes('Ciclo sono'));
});
t('omitir remove o item', () => {
  const e = { deamb: st() }; e.deamb.omitido = true;
  assert(!M.gerar(enf(), e, 'M').texto.includes('Deambula'));
});
console.log(`\n${ok} testes passaram`);

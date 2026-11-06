# Gerador de Evolução Clínica

Site estático (HTML + CSS + JS, sem dependências) que monta o parágrafo de evolução por cliques. Especificação: `PRD — Gerador de Evolução Clínica.md`.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Página |
| `styles.css` | Estilos (só fontes do sistema) |
| `cenarios.js` | Os 5 cenários padrão: itens, frases e regras. **Para mudar textos de forma permanente, edite aqui.** |
| `motor.js` | Motor de texto: regras, concordância `{o\|a}`, campos `[nome]`, pontuação e conversão para ISO-8859-1 |
| `app.js` | Interface e modo de edição temporária |
| `tests/motor.test.js` | Testes dos critérios de aceite do motor: `node tests/motor.test.js` |

## Usar

- Local: abra `index.html` no Chrome ou no Edge.
- Hospedar: envie a pasta para GitHub Pages, Netlify ou Vercel. Use HTTPS: o botão Copiar usa a Clipboard API e, se ela falhar, usa um método alternativo.

## Garantias

- Nenhuma requisição depois do carregamento. A página tem uma Content-Security-Policy com `connect-src 'none'`.
- Nada gravado no navegador: o estado fica só em memória. Recarregar a página volta tudo ao padrão.
- O texto copiado é um parágrafo único, só com caracteres de U+0000 a U+00FF.

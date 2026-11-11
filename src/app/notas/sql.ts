import { PALAVRAS } from '../ferramentas/lib/sqlfmt';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const RE = /(\{\{\s*[\w.-]+\s*\}\})|(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|((?<!:):[A-Za-z_]\w*)|([A-Za-z_][\w$]*)/g;

// html com spans por tipo de token; {{var}} e :param ficam marcados
export function realcarSql(sql: string) {
  let html = '';
  let pos = 0;
  for (const m of sql.matchAll(RE)) {
    html += esc(sql.slice(pos, m.index));
    pos = m.index! + m[0].length;
    const v = esc(m[0]);
    if (m[1] || m[5]) html += `<mark>${v}</mark>`;
    else if (m[2]) html += `<span class="sq-c">${v}</span>`;
    else if (m[3]) html += `<span class="sq-s">${v}</span>`;
    else if (m[4]) html += `<span class="sq-n">${v}</span>`;
    else html += PALAVRAS.has(m[0].toUpperCase()) ? `<span class="sq-k">${v}</span>` : v;
  }
  return html + esc(sql.slice(pos));
}

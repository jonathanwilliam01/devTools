import { detectarSep, lerCsv } from './csv';

export type FormatoGrade = 'markdown' | 'ascii' | 'alinhado' | 'html';

// aceita TAB/;/, (planilha, grid do banco) e saída do psql com |
export function lerGrade(texto: string): string[][] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() && !/^[\s|+:-]+$/.test(l));
  if (!linhas.length) return [];
  const pipe = linhas[0].split('|').length > 1 && linhas[0].split('\t').length === 1;
  if (pipe)
    return linhas
      .filter((l) => !/^\(\d+ (rows?|linhas?)\)$/.test(l.trim()))
      .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  return lerCsv(linhas.join('\n'), detectarSep(linhas[0])).map((l) => l.map((c) => c.trim()));
}

const numero = (v: string) => /^-?[\d.,]+$/.test(v) && /\d/.test(v);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// separar: linha entre os registros (ASCII e texto alinhado)
export function gerarTabela(linhas: string[][], formato: FormatoGrade, cabecalho: boolean, separar = false) {
  if (!linhas.length) return '';
  const nCols = Math.max(...linhas.map((l) => l.length));
  const t = linhas.map((l) => Array.from({ length: nCols }, (_, i) => l[i] ?? ''));
  const [cab, corpo] = cabecalho ? [t[0], t.slice(1)] : [Array.from({ length: nCols }, (_, i) => `Coluna ${i + 1}`), t];
  const direita = cab.map((_, i) => corpo.length > 0 && corpo.every((l) => !l[i] || numero(l[i])));
  const larg = cab.map((c, i) => Math.max(3, c.length, ...corpo.map((l) => l[i].length)));
  const ajustar = (v: string, i: number) => (direita[i] ? v.padStart(larg[i]) : v.padEnd(larg[i]));

  if (formato === 'html')
    return [
      '<table>',
      `  <thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`,
      '  <tbody>',
      ...corpo.map((l) => `    <tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`),
      '  </tbody>',
      '</table>',
    ].join('\n');

  if (formato === 'markdown') {
    const lin = (l: string[]) => `| ${l.map((c, i) => ajustar(c.replace(/\|/g, '\\|'), i)).join(' | ')} |`;
    const sep = `| ${larg.map((w, i) => (direita[i] ? '-'.repeat(w - 1) + ':' : '-'.repeat(w))).join(' | ')} |`;
    return [lin(cab), sep, ...corpo.map(lin)].join('\n');
  }

  if (formato === 'ascii') {
    const borda = `+${larg.map((w) => '-'.repeat(w + 2)).join('+')}+`;
    const lin = (l: string[]) => `| ${l.map(ajustar).join(' | ')} |`;
    return [borda, lin(cab), borda, ...corpo.flatMap((l, i) => (separar && i ? [borda, lin(l)] : [lin(l)])), borda].join('\n');
  }

  const lin = (l: string[]) => l.map(ajustar).join('  ').trimEnd();
  const sep = larg.map((w) => '-'.repeat(w)).join('  ');
  return [lin(cab), sep, ...corpo.flatMap((l, i) => (separar && i ? [sep, lin(l)] : [lin(l)]))].join('\n');
}

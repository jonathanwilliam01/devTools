// tabela guardada como TSV no conteúdo do bloco: cola direto no Excel
export function lerTsv(s: string): string[][] {
  const linhas = s.replace(/\r/g, '').split('\n').map((l) => l.split('\t'));
  const n = Math.max(...linhas.map((l) => l.length));
  return linhas.map((l) => [...l, ...Array(n - l.length).fill('')]);
}

// descarta linhas e colunas vazias do fim
export function paraTsv(g: string[][]) {
  const linhas = g.map((l) => l.map((c) => c.replace(/[\t\r\n]+/g, ' ')));
  while (linhas.length && linhas.at(-1)!.every((c) => !c.trim())) linhas.pop();
  let n = Math.max(0, ...linhas.map((l) => l.length));
  while (n && linhas.every((l) => !l[n - 1]?.trim())) n--;
  return linhas.map((l) => l.slice(0, n).join('\t')).join('\n');
}

export const gradeVazia = (linhas = 3, colunas = 3) => Array.from({ length: linhas }, () => Array(colunas).fill(''));

// A, B, ..., Z, AA
export function letraColuna(i: number) {
  let s = '';
  for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

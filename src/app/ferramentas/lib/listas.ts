export type SaidaLista = 'linhas' | 'virgula' | 'in';
export type Ordem = 'nao' | 'asc' | 'desc';

// uma por linha; texto de uma linha só (ex.: lista do IN) separa por vírgula, ; ou TAB
export function itens(texto: string): string[] {
  const t = texto.trim().replace(/^\(|\)$/g, '');
  const partes = /\n/.test(t) ? t.split(/\r?\n/) : t.split(/[,;\t]/);
  return partes.map((s) => s.trim().replace(/^(['"])(.*)\1$/, '$2').trim()).filter(Boolean);
}

const chave = (caixa: boolean) => (s: string) => (caixa ? s.toLocaleLowerCase('pt-BR') : s);

export function unicos(l: string[], caixa = false) {
  const k = chave(caixa);
  const vistos = new Set<string>();
  return l.filter((s) => !vistos.has(k(s)) && vistos.add(k(s)));
}

export function comparar(a: string[], b: string[], caixa = false) {
  const k = chave(caixa);
  const ka = new Set(a.map(k));
  const kb = new Set(b.map(k));
  return {
    soA: unicos(a.filter((s) => !kb.has(k(s))), caixa),
    soB: unicos(b.filter((s) => !ka.has(k(s))), caixa),
    ambos: unicos(a.filter((s) => kb.has(k(s))), caixa),
  };
}

const num = (s: string) => /^-?\d+([.,]\d+)?$/.test(s);
const valorNum = (s: string) => +s.replace(',', '.');

export function ordenar(l: string[], ordem: Ordem) {
  if (ordem === 'nao') return l;
  const numeros = l.every(num);
  const r = [...l].sort((x, y) => (numeros ? valorNum(x) - valorNum(y) : x.localeCompare(y, 'pt-BR', { sensitivity: 'base', numeric: true })));
  return ordem === 'desc' ? r.reverse() : r;
}

// mais frequente primeiro
export function contar(l: string[], caixa = false): [string, number][] {
  const k = chave(caixa);
  const m = new Map<string, [string, number]>();
  for (const s of l) {
    const x = m.get(k(s));
    if (x) x[1]++;
    else m.set(k(s), [s, 1]);
  }
  return [...m.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
}

// IN: números sem aspas; texto entre aspas simples com '' de escape
export function formatarLista(l: string[], saida: SaidaLista) {
  if (saida === 'linhas') return l.join('\n');
  if (saida === 'virgula') return l.join(', ');
  if (!l.length) return '';
  const numeros = l.every((s) => /^-?\d+$/.test(s) && !/^-?0\d/.test(s));
  return `(${l.map((s) => (numeros ? s : `'${s.replace(/'/g, "''")}'`)).join(', ')})`;
}

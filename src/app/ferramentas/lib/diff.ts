export interface LinhaDiff {
  tipo: '=' | '-' | '+';
  texto: string;
  a?: number;
  b?: number;
}

export const LIMITE_DIFF = 4_000_000;

// LCS por linha; prefixo e sufixo iguais saem antes da tabela
export function diffLinhas(antes: string, depois: string, o: { espacos: boolean; caixa: boolean }): LinhaDiff[] {
  const A = antes.split(/\r?\n/);
  const B = depois.split(/\r?\n/);
  const norm = (l: string) => {
    let s = o.espacos ? l.trim().replace(/\s+/g, ' ') : l;
    return o.caixa ? s.toLowerCase() : s;
  };
  const a = A.map(norm);
  const b = B.map(norm);

  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fa = a.length;
  let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) fa--, fb--;

  const n = fa - ini;
  const m = fb - ini;
  if (n * m > LIMITE_DIFF) throw new Error('Textos grandes demais para comparar.');

  const t = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i * (m + 1) + j] =
        a[ini + i] === b[ini + j] ? t[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(t[(i + 1) * (m + 1) + j], t[i * (m + 1) + j + 1]);

  const res: LinhaDiff[] = [];
  const igual = (i: number, j: number) => res.push({ tipo: '=', texto: A[i], a: i + 1, b: j + 1 });
  for (let k = 0; k < ini; k++) igual(k, k);
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[ini + i] === b[ini + j]) igual(ini + i++, ini + j++);
    else if (i < n && (j === m || t[(i + 1) * (m + 1) + j] >= t[i * (m + 1) + j + 1])) res.push({ tipo: '-', texto: A[ini + i], a: ini + ++i });
    else res.push({ tipo: '+', texto: B[ini + j], b: ini + ++j });
  }
  for (let k = 0; k < a.length - fa; k++) igual(fa + k, fb + k);
  return res;
}

export interface DifJson {
  caminho: string;
  tipo: '+' | '-' | '~';
  antes?: string;
  depois?: string;
}

// compara por estrutura: chave a chave nos objetos, posição a posição nos arrays
export function diffJson(antes: string, depois: string): DifJson[] {
  const ler = (s: string, lado: string) => {
    try {
      return JSON.parse(s);
    } catch (e) {
      throw new Error(`JSON inválido em ${lado}: ${(e as Error).message}`);
    }
  };
  const tipo = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const fmt = (v: unknown) => JSON.stringify(v);
  const filho = (cam: string, k: string | number) =>
    typeof k === 'number' ? `${cam}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${cam}${cam ? '.' : ''}${k}` : `${cam}[${JSON.stringify(k)}]`;
  const out: DifJson[] = [];

  const andar = (a: any, b: any, cam: string) => {
    const t = tipo(a);
    if (t !== tipo(b) || (t !== 'object' && t !== 'array')) {
      if (fmt(a) !== fmt(b)) out.push({ caminho: cam || '(raiz)', tipo: '~', antes: fmt(a), depois: fmt(b) });
      return;
    }
    const chaves: (string | number)[] =
      t === 'array' ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of chaves) {
      const c = filho(cam, k);
      const temA = t === 'array' ? (k as number) < a.length : Object.hasOwn(a, k);
      const temB = t === 'array' ? (k as number) < b.length : Object.hasOwn(b, k);
      if (!temB) out.push({ caminho: c, tipo: '-', antes: fmt(a[k]) });
      else if (!temA) out.push({ caminho: c, tipo: '+', depois: fmt(b[k]) });
      else andar(a[k], b[k], c);
    }
  };
  andar(ler(antes, 'Antes'), ler(depois, 'Depois'), '');
  return out;
}

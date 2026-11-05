export type Sep = '\t' | ';' | ',';

export function detectarSep(linha: string): Sep {
  const conta = (c: string) => linha.split(c).length;
  return (['\t', ';', ','] as Sep[]).reduce((m, c) => (conta(c) > conta(m) ? c : m), '\t');
}

// aspas duplas com "" de escape; quebra de linha dentro de aspas é mantida
export function lerCsv(texto: string, sep: Sep): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') campo += c, i++;
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && !campo) aspas = true;
    else if (c === sep) linha.push(campo), (campo = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linhas.push([...linha, campo]);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) linhas.push([...linha, campo]);
  return linhas.filter((l) => l.some((c) => c.trim()));
}

export function csvParaObjetos(texto: string, sep: Sep) {
  const [cab, ...linhas] = lerCsv(texto, sep);
  if (!cab) return [];
  const nomes = cab.map((c, i) => c.trim() || `col${i + 1}`);
  return linhas.map((l) => Object.fromEntries(nomes.map((n, i) => [n, l[i] ?? ''])));
}

export function jsonParaObjetos(texto: string): Record<string, unknown>[] {
  const j = JSON.parse(texto);
  const l = Array.isArray(j) ? j : [j];
  if (!l.every((x) => x && typeof x === 'object' && !Array.isArray(x))) throw new Error('JSON precisa ser um objeto ou uma lista de objetos.');
  return l;
}

const colunas = (l: Record<string, unknown>[]) => [...new Set(l.flatMap((o) => Object.keys(o)))];
const texto = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function objetosParaCsv(l: Record<string, unknown>[], sep: Sep) {
  const cols = colunas(l);
  const esc = (v: string) => (v.includes(sep) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [cols, ...l.map((o) => cols.map((c) => texto(o[c])))].map((r) => r.map(esc).join(sep)).join('\n');
}

// número sem zero à esquerda fica sem aspas; vazio e null viram NULL
export function objetosParaInsert(l: Record<string, unknown>[], tabela: string) {
  const cols = colunas(l);
  const val = (v: unknown) => {
    if (v == null || v === '' || (typeof v === 'string' && v.toUpperCase() === 'NULL')) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    const s = texto(v);
    return /^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`;
  };
  return l.map((o) => `INSERT INTO ${tabela || 'TABELA'} (${cols.join(', ')}) VALUES (${cols.map((c) => val(o[c])).join(', ')});`).join('\n');
}

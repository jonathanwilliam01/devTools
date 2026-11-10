import { semAcento } from './caixa';

export type TipoCol = 'boolean' | 'integer' | 'bigint' | 'numeric' | 'date' | 'timestamp' | 'varchar' | 'text';

export interface Coluna {
  original: string;
  nome: string;
  tipo: TipoCol;
  ddl: string;
  nulos: number;
  // números com vírgula decimal (1.234,56)
  br: boolean;
  exemplo: string;
}

export interface OpcoesDdl {
  tabela: string;
  temp: boolean;
  usarText: boolean;
  notNull: boolean;
  insert: boolean;
}

const RESERVADAS = new Set(
  'all and any array as asc case cast check collate column constraint create current_date current_time current_timestamp current_user default desc distinct do else end except false fetch for foreign from grant group having in initially intersect into leading limit not null offset on only or order placing primary references returning select session_user some symmetric table then to trailing true union unique user using variadic when where window with'.split(' '),
);

// valor entre aspas ('123' ou "123") é texto mesmo sendo número
const RE_ASPAS = /^'([\s\S]*)'$|^"([\s\S]*)"$/;
const entreAspas = (v: string) => RE_ASPAS.test(v.trim());
const semAspas = (v: string) => {
  const m = RE_ASPAS.exec(v.trim());
  return m ? (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2].replace(/""/g, '"')) : v.trim();
};
const vazio = (v: string) => !v.trim() || v.trim().toUpperCase() === 'NULL';
const RE_BOOL = /^(true|false|t|f)$/i;
const RE_INT = /^-?(0|[1-9]\d*)$/;
const RE_DEC = /^-?(0|[1-9]\d*)\.\d+$/;
const RE_DEC_BR = /^-?(0|[1-9]\d{0,2}(\.\d{3})+|[1-9]\d*)(,\d+)?$/;
const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})$|^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2}(\.\d+)?)?)([+-]\d{2}(:?\d{2})?|Z)?$/;

export function nomeColuna(s: string, i: number) {
  let n = semAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!n) n = `col${i + 1}`;
  if (/^\d/.test(n)) n = 'c_' + n;
  return n;
}

const ident = (n: string) => (RESERVADAS.has(n) ? `"${n}"` : n);

function dataIso(v: string) {
  const m = RE_DATA.exec(v.slice(0, 10));
  return m ? (m[1] ? `${m[3]}-${m[2]}-${m[1]}` : v.slice(0, 10)) : v;
}

function inferir(brutos: string[], usarText: boolean): Pick<Coluna, 'tipo' | 'ddl' | 'br'> {
  const valores = brutos.map(semAspas);
  const v = valores.filter((x) => !vazio(x));
  const txt = (): Pick<Coluna, 'tipo' | 'ddl' | 'br'> => {
    const max = Math.max(1, ...valores.map((x) => [...x].length));
    return usarText || !v.length ? { tipo: 'text', ddl: 'text', br: false } : { tipo: 'varchar', ddl: `varchar(${max})`, br: false };
  };
  if (!v.length || brutos.some(entreAspas)) return txt();
  if (v.every((x) => RE_BOOL.test(x))) return { tipo: 'boolean', ddl: 'boolean', br: false };
  if (v.every((x) => RE_INT.test(x))) {
    const big = v.some((x) => Math.abs(Number(x)) > 2147483647);
    return { tipo: big ? 'bigint' : 'integer', ddl: big ? 'bigint' : 'integer', br: false };
  }
  const br = v.some((x) => x.includes(','));
  if (v.every((x) => (br ? RE_DEC_BR.test(x) : RE_INT.test(x) || RE_DEC.test(x)))) {
    let int = 1;
    let dec = 0;
    for (const x of v) {
      const [i, d = ''] = (br ? x.replace(/\./g, '').replace(',', '.') : x).replace('-', '').split('.');
      int = Math.max(int, i.length);
      dec = Math.max(dec, d.length);
    }
    return { tipo: 'numeric', ddl: `numeric(${int + dec}, ${dec})`, br };
  }
  if (v.every((x) => RE_DATA.test(x))) return { tipo: 'date', ddl: 'date', br: false };
  if (v.every((x) => RE_DATA.test(x) || RE_HORA.test(x))) return { tipo: 'timestamp', ddl: 'timestamp', br: false };
  return txt();
}

export function analisarColunas(linhas: string[][], usarText: boolean): Coluna[] {
  const [cab = [], ...dados] = linhas;
  const usados = new Map<string, number>();
  return cab.map((original, i) => {
    let nome = nomeColuna(original, i);
    const n = (usados.get(nome) ?? 0) + 1;
    usados.set(nome, n);
    if (n > 1) nome += `_${n}`;
    const valores = dados.map((l) => l[i] ?? '');
    const exemplo = semAspas(valores.find((x) => !vazio(x)) ?? '');
    return { original, nome, nulos: valores.filter(vazio).length, exemplo, ...inferir(valores, usarText) };
  });
}

function valorSql(v: string, c: Coluna) {
  if (vazio(v)) return 'null';
  const s = semAspas(v);
  switch (c.tipo) {
    case 'boolean':
      return /^t/i.test(s) ? 'true' : 'false';
    case 'integer':
    case 'bigint':
      return s;
    case 'numeric':
      return c.br ? s.replace(/\./g, '').replace(',', '.') : s;
    case 'date':
      return `'${dataIso(s)}'`;
    case 'timestamp': {
      const m = RE_HORA.exec(s);
      return `'${m ? dataIso(m[1]) + ' ' + m[2] + (m[5] ?? '') : dataIso(s)}'`;
    }
    default:
      return `'${s.replace(/'/g, "''")}'`;
  }
}

const LOTE = 1000;

export function gerarDdl(linhas: string[][], o: OpcoesDdl): string {
  const cols = analisarColunas(linhas, o.usarText);
  if (!cols.length) return '';
  const tabela = o.tabela.trim() || (o.temp ? 'tmp_importacao' : 'importacao');
  const larg = Math.max(...cols.map((c) => ident(c.nome).length));
  const defs = cols.map((c) => `  ${ident(c.nome).padEnd(larg)} ${c.ddl}${o.notNull && !c.nulos && linhas.length > 1 ? ' not null' : ''}`);
  const partes = [`create ${o.temp ? 'temp ' : ''}table ${tabela} (\n${defs.join(',\n')}\n);`];
  const dados = linhas.slice(1);
  if (o.insert)
    for (let i = 0; i < dados.length; i += LOTE)
      partes.push(
        `insert into ${tabela} (${cols.map((c) => ident(c.nome)).join(', ')}) values\n` +
          dados
            .slice(i, i + LOTE)
            .map((l) => `  (${cols.map((c, j) => valorSql(l[j] ?? '', c)).join(', ')})`)
            .join(',\n') +
          ';',
      );
  return partes.join('\n\n');
}

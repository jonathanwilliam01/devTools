import { inteiroPorExtenso } from './extenso';

export type OrdemEntrada = 'auto' | 'br' | 'us';
export interface DataSimples {
  a: number;
  m: number;
  d: number;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const NOMES = [...MESES, ...MONTHS].map((n) => semAcento(n.toLowerCase()));
const p2 = (n: number) => String(n).padStart(2, '0');
const ano2 = (s: string) => (s.length === 2 ? (+s < 50 ? 2000 : 1900) + +s : +s);

function valida(a: number, m: number, d: number): DataSimples | null {
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCFullYear(a);
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { a, m, d } : null;
}

// numérica (ISO, dd/mm, mm/dd, aaaammdd) ou com nome do mês em português ou inglês
export function lerData(bruto: string, ordem: OrdemEntrada = 'auto'): DataSimples | null {
  const s = bruto.trim();
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (r) return valida(+r[1], +r[2], +r[3]);
  r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T].*)?$/);
  if (r) {
    const [x, y, a] = [+r[1], +r[2], ano2(r[3])];
    const us = ordem === 'us' || (ordem === 'auto' && x <= 12 && y > 12);
    return us ? valida(a, x, y) : valida(a, y, x);
  }
  r = s.match(/^(\d{8})$/);
  if (r) {
    const n = r[1];
    return /^(1[6-9]|2\d)/.test(n) ? valida(+n.slice(0, 4), +n.slice(4, 6), +n.slice(6)) : valida(+n.slice(4), +n.slice(2, 4), +n.slice(0, 2));
  }
  const palavras = semAcento(s.toLowerCase()).match(/[a-z]+|\d+/g) ?? [];
  let m = 0;
  const nums: string[] = [];
  for (const w of palavras) {
    if (/^\d+$/.test(w)) nums.push(w);
    else if (!m && w.length >= 3) {
      const i = NOMES.findIndex((n) => n.startsWith(w));
      if (i >= 0) m = (i % 12) + 1;
    }
  }
  if (!m || nums.length !== 2) return null;
  const ia = nums.findIndex((n) => n.length === 4);
  if (ia < 0) return null;
  return valida(+nums[ia], m, +nums[1 - ia]);
}

const diaSemana = (x: DataSimples) => {
  const t = new Date(Date.UTC(x.a, x.m - 1, x.d));
  t.setUTCFullYear(x.a);
  return t.getUTCDay();
};

function diaDoAno(x: DataSimples) {
  const ms = (a: number, m: number, d: number) => {
    const t = new Date(Date.UTC(a, m, d));
    t.setUTCFullYear(a);
    return t.getTime();
  };
  return Math.round((ms(x.a, x.m - 1, x.d) - ms(x.a, 0, 1)) / 86_400_000) + 1;
}

function semanaIso(x: DataSimples) {
  const t = new Date(Date.UTC(x.a, x.m - 1, x.d));
  t.setUTCFullYear(x.a);
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  ini.setUTCFullYear(t.getUTCFullYear());
  return `${t.getUTCFullYear()}-W${p2(Math.ceil(((t.getTime() - ini.getTime()) / 86_400_000 + 1) / 7))}`;
}

const ordinalEn = (d: number) => d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');

export const FORMATOS_DATA: [id: string, nome: string, f: (x: DataSimples) => string][] = [
  ['br', 'Brasileiro', (x) => `${p2(x.d)}/${p2(x.m)}/${x.a}`],
  ['us', 'Americano', (x) => `${p2(x.m)}/${p2(x.d)}/${x.a}`],
  ['iso', 'ISO 8601', (x) => `${x.a}-${p2(x.m)}-${p2(x.d)}`],
  ['compacto', 'aaaammdd', (x) => `${x.a}${p2(x.m)}${p2(x.d)}`],
  ['brCurto', 'dd/mm/aa', (x) => `${p2(x.d)}/${p2(x.m)}/${p2(x.a % 100)}`],
  ['abrev', 'dd/mmm/aaaa', (x) => `${p2(x.d)}/${MESES[x.m - 1].slice(0, 3)}/${x.a}`],
  ['extenso', 'Extenso', (x) => `${x.d === 1 ? '1º' : x.d} de ${MESES[x.m - 1]} de ${x.a}`],
  ['extensoSemana', 'Extenso com dia da semana', (x) => `${SEMANA[diaSemana(x)]}, ${x.d === 1 ? '1º' : x.d} de ${MESES[x.m - 1]} de ${x.a}`],
  [
    'extensoTotal',
    'Tudo por extenso',
    (x) => `${x.d === 1 ? 'primeiro' : inteiroPorExtenso(BigInt(x.d))} de ${MESES[x.m - 1]} de ${inteiroPorExtenso(BigInt(x.a))}`,
  ],
  ['mesAno', 'Mês/ano', (x) => `${MESES[x.m - 1]}/${x.a}`],
  ['en', 'Inglês', (x) => `${MONTHS[x.m - 1]} ${x.d}, ${x.a}`],
  ['enSemana', 'Inglês com dia da semana', (x) => `${WEEK[diaSemana(x)]}, ${MONTHS[x.m - 1]} ${ordinalEn(x.d)}, ${x.a}`],
  ['enCurto', 'Inglês abreviado', (x) => `${MONTHS[x.m - 1].slice(0, 3)} ${p2(x.d)}, ${x.a}`],
  ['semana', 'Dia da semana', (x) => SEMANA[diaSemana(x)]],
  ['diaAno', 'Dia do ano', (x) => String(diaDoAno(x))],
  ['semanaIso', 'Semana ISO', semanaIso],
];

export function formatarData(x: DataSimples, formato: string) {
  const f = FORMATOS_DATA.find(([id]) => id === formato);
  if (!f) throw new Error(`Formato inválido: ${formato}. Use ${FORMATOS_DATA.map(([id]) => id).join(', ')}.`);
  return f[2](x);
}

export const todosFormatos = (x: DataSimples) => Object.fromEntries(FORMATOS_DATA.map(([id, , f]) => [id, f(x)]));

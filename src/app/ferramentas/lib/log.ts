export type Nivel = 'fatal' | 'erro' | 'aviso' | 'info' | 'debug' | 'outro';

export interface Entrada {
  n: number; // linha onde começa
  data: string; // yyyy-mm-dd hh:mm:ss, vazio se não achou
  nivel: Nivel;
  msg: string;
  corpo: string;
}

const MESES: Record<string, string> = { jan: '01', feb: '02', fev: '02', mar: '03', apr: '04', abr: '04', may: '05', mai: '05', jun: '06', jul: '07', aug: '08', ago: '08', sep: '09', set: '09', oct: '10', out: '10', nov: '11', dec: '12', dez: '12' };

// cada formato devolve [ano, mês, dia, hh:mm:ss]
const DATAS: [RegExp, (m: RegExpMatchArray) => string[]][] = [
  [/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/, (m) => [m[1], m[2], m[3], m[4]]], // ISO, PG, Monolog, Rails, Zend
  [/(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}:\d{2}:\d{2})/, (m) => [m[3], MESES[m[2].toLowerCase()], m[1], m[4]]], // PHP error_log
  [/[A-Za-z]{3} ([A-Za-z]{3}) +(\d{1,2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? (\d{4})/, (m) => [m[4], MESES[m[1].toLowerCase()], m[2].padStart(2, '0'), m[3]]], // Apache error
  [/(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})/, (m) => [m[3], MESES[m[2].toLowerCase()], m[1], m[4]]], // Apache/nginx access
  [/(\d{2})\/(\d{2})\/(\d{4}),? (\d{2}:\d{2}(?::\d{2})?)/, (m) => [m[3], m[2], m[1], m[4]]], // dd/mm/aaaa
];

function data(linha: string) {
  const ini = linha.slice(0, 80);
  for (const [re, fn] of DATAS) {
    const m = ini.match(re);
    if (m && m.index! < 40) {
      const [a, me, d, h] = fn(m);
      if (me) return `${a}-${me}-${d} ${h.length === 5 ? h + ':00' : h}`;
    }
  }
  return '';
}

// ordem importa: o primeiro que bate vence
const NIVEIS: [Nivel, RegExp][] = [
  ['fatal', /\b(FATAL|PANIC|EMERG(ENCY)?|ALERT|CRIT(ICAL)?)\b|PHP (Fatal|Parse) error|:(crit|alert|emerg)\]|^F, \[/],
  ['erro', /\b(ERROR|ERR|SEVERE)\b|PHP (Recoverable fatal )?[Ee]rror|Uncaught |:error\]|^E, \[/],
  ['aviso', /\b(WARNING|WARN)\b|PHP (Warning|Notice|Deprecated|Strict)|:(warn|notice)\]|^W, \[/],
  ['info', /\b(INFO|NOTICE|LOG)\b|:info\]|^I, \[/],
  ['debug', /\b(DEBUG\d?|TRACE)\b|:debug\]|^D, \[/],
];

const nivel = (l: string): Nivel => NIVEIS.find(([, re]) => re.test(l))?.[0] ?? 'outro';

// linhas com data que continuam a anterior (PostgreSQL)
const CONTINUA = /\b(DETAIL|HINT|STATEMENT|CONTEXT|QUERY|LOCATION):\s/;

export function lerLog(texto: string): Entrada[] {
  const linhas = texto.split(/\r?\n/);
  const temData = linhas.some((l) => data(l));
  const r: Entrada[] = [];
  linhas.forEach((l, i) => {
    if (!l.trim()) return;
    const d = data(l);
    // sem data no log todo: cada linha não recuada é uma entrada
    const nova = temData ? d && !CONTINUA.test(l) : !/^(\s|#\d|Stack trace|Next |at |\.\.\.)/.test(l);
    const atual = r[r.length - 1];
    if (nova || !atual) r.push({ n: i + 1, data: d, nivel: nivel(l), msg: l, corpo: '' });
    else atual.corpo += (atual.corpo ? '\n' : '') + l;
  });
  return r;
}

// tira números, ids e textos entre aspas para juntar mensagens iguais
export const assinatura = (msg: string) =>
  msg
    .replace(/^.{0,40}?\d{2}:\d{2}(:\d{2})?(\.\d+)?\S*\]?\s*/, '')
    .replace(/"[^"]*"|'[^']*'/g, '"…"')
    .replace(/0x[0-9a-f]+|\b\d+\b/gi, '#')
    .replace(/\[pid #\]|\[client [^\]]*\]/g, '')
    .trim();

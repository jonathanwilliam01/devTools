interface Campo {
  nome: string;
  min: number;
  max: number;
  nomes?: string[];
}

const MESES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DIAS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const CAMPOS: Campo[] = [
  { nome: 'Minuto', min: 0, max: 59 },
  { nome: 'Hora', min: 0, max: 23 },
  { nome: 'Dia do mês', min: 1, max: 31 },
  { nome: 'Mês', min: 1, max: 12, nomes: MESES },
  { nome: 'Dia da semana', min: 0, max: 7, nomes: DIAS },
];

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface Cron {
  partes: string[];
  valores: Set<number>[];
  segundos: number[];
  campos: string[];
  descricao: string;
}

const SEGUNDO: Campo = { nome: 'Segundo', min: 0, max: 59 };

export function lerCron(expr: string): Cron {
  const e = ALIASES[expr.trim().toLowerCase()] ?? expr.trim();
  const todas = e.split(/\s+/);
  if (todas.length !== 5 && todas.length !== 6) throw new Error('Use 5 campos (minuto hora dia mês dia-semana) ou 6 com segundo no início.');
  const seg = todas.length === 6 ? todas[0] : '0';
  const partes = todas.slice(-5);
  const valores = partes.map((p, i) => valoresCampo(p, CAMPOS[i]));
  if (valores[4].delete(7)) valores[4].add(0);
  const segundos = [...valoresCampo(seg, SEGUNDO)].sort((a, b) => a - b);
  const campos = todas.length === 6 ? [SEGUNDO.nome, ...CAMPOS_CRON] : CAMPOS_CRON;
  let descricao = descrever(partes);
  if (todas.length === 6 && seg !== '0') {
    const resto = descricao.replace(/^A cada minuto(, )?/, '');
    descricao = textoSeg(seg) + (resto ? ', ' + resto[0].toLowerCase() + resto.slice(1) : '');
  }
  return { partes: todas, valores, segundos, campos, descricao };
}

function textoSeg(p: string) {
  const t = textoCampo(p, SEGUNDO, String);
  return t.startsWith('a cada') ? t.replace(/^a cada (\d+)/, 'A cada $1 segundos') : p === '*' ? 'A cada segundo' : 'No segundo ' + t;
}

function numero(s: string, c: Campo) {
  const i = c.nomes?.indexOf(s.toUpperCase()) ?? -1;
  const n = i >= 0 ? i + (c.min === 1 ? 1 : 0) : /^\d+$/.test(s) ? +s : NaN;
  if (isNaN(n) || n < c.min || n > c.max) throw new Error(`${c.nome}: valor "${s}" fora de ${c.min}-${c.max}.`);
  return n;
}

function valoresCampo(p: string, c: Campo) {
  const res = new Set<number>();
  for (const item of p.split(',')) {
    const [faixa, passoTxt] = item.split('/');
    const passo = passoTxt === undefined ? 1 : +passoTxt;
    if (!(passo >= 1)) throw new Error(`${c.nome}: passo "${passoTxt}" inválido.`);
    let [ini, fim] = [c.min, c.max];
    if (faixa !== '*') {
      const [a, b] = faixa.split('-');
      ini = numero(a, c);
      fim = b !== undefined ? numero(b, c) : passoTxt !== undefined ? c.max : ini;
      if (fim < ini) throw new Error(`${c.nome}: faixa "${faixa}" invertida.`);
    }
    for (let v = ini; v <= fim; v += passo) res.add(v);
  }
  return res;
}

// dia do mês e da semana restritos: vale qualquer um dos dois (regra do cron)
export function proximas(c: Cron, qtd: number, de = new Date()): Date[] {
  const [mi, ho, dm, me, ds] = c.valores;
  const [, , dmP, , dsP] = c.partes.slice(-5);
  const dmLivre = dmP === '*';
  const dsLivre = dsP === '*';
  const diaOk = (d: Date) =>
    dmLivre && dsLivre ? true : dmLivre ? ds.has(d.getDay()) : dsLivre ? dm.has(d.getDate()) : dm.has(d.getDate()) || ds.has(d.getDay());

  const d = new Date(de);
  d.setSeconds(0, 0);
  if (!c.segundos.some((s) => d.getTime() + s * 1000 > de.getTime())) d.setMinutes(d.getMinutes() + 1);
  const res: Date[] = [];
  for (let passos = 0; res.length < qtd && passos < 200_000; passos++) {
    if (!me.has(d.getMonth() + 1)) d.setMonth(d.getMonth() + 1, 1), d.setHours(0, 0);
    else if (!diaOk(d)) d.setDate(d.getDate() + 1), d.setHours(0, 0);
    else if (!ho.has(d.getHours())) d.setHours(d.getHours() + 1, 0);
    else if (!mi.has(d.getMinutes())) d.setMinutes(d.getMinutes() + 1);
    else {
      for (const s of c.segundos) {
        const t = new Date(d.getTime() + s * 1000);
        if (t > de && res.length < qtd) res.push(t);
      }
      d.setMinutes(d.getMinutes() + 1);
    }
  }
  return res;
}

const lista = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l.at(-1)}` : l[0]);
const dois = (n: number) => String(n).padStart(2, '0');

function textoCampo(p: string, c: Campo, nome: (n: number) => string) {
  return lista(
    p.split(',').map((item) => {
      const [faixa, passo] = item.split('/');
      const [a, b] = faixa.split('-');
      const base = faixa === '*' ? '' : b !== undefined ? `de ${nome(numero(a, c))} a ${nome(numero(b, c))}` : nome(numero(a, c));
      return passo ? `a cada ${passo}${base ? ` (${base.startsWith('de') ? base : 'a partir de ' + base})` : ''}` : base;
    }),
  );
}

function descrever([mi, ho, dm, me, ds]: string[]) {
  const simples = (p: string) => /^\d+$/.test(p);
  const partes: string[] = [];

  if (simples(mi) && ho.split(',').every(simples)) partes.push('às ' + lista(ho.split(',').map((h) => `${dois(+h)}:${dois(+mi)}`)));
  else {
    const passo = (t: string, u: string, pre: string) => (t.startsWith('a cada') ? t.replace(/^a cada (\d+)/, `a cada $1 ${u}`) : pre + t);
    partes.push(mi === '*' ? 'a cada minuto' : passo(textoCampo(mi, CAMPOS[0], String), 'minutos', 'no minuto '));
    if (ho !== '*') partes.push(passo(textoCampo(ho, CAMPOS[1], (n) => dois(n) + 'h'), 'horas', 'às '));
  }
  if (dm !== '*') partes.push(`no dia ${textoCampo(dm, CAMPOS[2], String)} do mês`);
  if (me !== '*') partes.push(`em ${textoCampo(me, CAMPOS[3], (n) => MESES_PT[n - 1])}`);
  if (ds !== '*') partes.push(`${dm !== '*' ? 'ou ' : ''}${textoCampo(ds, CAMPOS[4], (n) => DIAS_PT[n % 7])}`);
  const t = partes.join(', ');
  return t[0].toUpperCase() + t.slice(1);
}

export const CAMPOS_CRON = CAMPOS.map((c) => c.nome);

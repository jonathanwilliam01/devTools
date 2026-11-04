export const DIA = 86_400_000;
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const deIso = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T00:00:00Z') : NaN);
export const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const hojeIso = () => paraIso(Date.now() - new Date().getTimezoneOffset() * 60_000);
export const extenso = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) + ', ' + SEMANA[new Date(ms).getUTCDay()];

// algoritmo de Meeus/Jones/Butcher
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - Math.floor(b / 4) - g + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return Date.UTC(ano, Math.floor(n / 31) - 1, (n % 31) + 1);
}

const cacheFeriados = new Map<string, Map<number, string>>();

export function feriados(ano: number, facultativos: boolean) {
  const chave = `${ano}${facultativos}`;
  let f = cacheFeriados.get(chave);
  if (f) return f;
  f = new Map<number, string>();
  const fixos: [number, number, string][] = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [12, 25, 'Natal'],
  ];
  if (ano >= 2024) fixos.push([11, 20, 'Consciência Negra']);
  fixos.forEach(([m, d, nome]) => f!.set(Date.UTC(ano, m - 1, d), nome));
  const p = pascoa(ano);
  f.set(p - 2 * DIA, 'Sexta-feira Santa');
  if (facultativos) {
    f.set(p - 48 * DIA, 'Carnaval');
    f.set(p - 47 * DIA, 'Carnaval');
    f.set(p + 60 * DIA, 'Corpus Christi');
  }
  cacheFeriados.set(chave, f);
  return f;
}

export interface OpcoesUteis {
  feriados: boolean;
  facultativos: boolean;
}

export function util(ms: number, o: OpcoesUteis) {
  const d = new Date(ms).getUTCDay();
  if (d === 0 || d === 6) return false;
  return !o.feriados || !feriados(new Date(ms).getUTCFullYear(), o.facultativos).has(ms);
}

// úteis no intervalo (inicio, fim]
export function contarUteis(inicio: number, fim: number, o: OpcoesUteis) {
  const sinal = fim < inicio ? -1 : 1;
  const [a, b] = sinal > 0 ? [inicio, fim] : [fim, inicio];
  let n = 0;
  for (let d = a + DIA; d <= b; d += DIA) if (util(d, o)) n++;
  return n * sinal;
}

export function somarUteis(inicio: number, dias: number, o: OpcoesUteis) {
  const passo = dias < 0 ? -DIA : DIA;
  let d = inicio;
  for (let falta = Math.abs(dias); falta > 0; ) {
    d += passo;
    if (util(d, o)) falta--;
  }
  return d;
}

export function diferencaCalendario(inicio: number, fim: number) {
  const [a, b] = inicio <= fim ? [new Date(inicio), new Date(fim)] : [new Date(fim), new Date(inicio)];
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  if (b.getUTCDate() < a.getUTCDate()) meses--;
  const base = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + meses, a.getUTCDate());
  return { anos: Math.floor(meses / 12), meses: meses % 12, dias: Math.round((b.getTime() - base) / DIA) };
}

export function feriadosNoPeriodo(inicio: number, fim: number, o: OpcoesUteis) {
  const [a, b] = inicio <= fim ? [inicio, fim] : [fim, inicio];
  const lista: [number, string][] = [];
  for (let ano = new Date(a).getUTCFullYear(); ano <= new Date(b).getUTCFullYear(); ano++) {
    feriados(ano, o.facultativos).forEach((nome, ms) => ms > a && ms <= b && lista.push([ms, nome]));
  }
  return lista.sort((x, y) => x[0] - y[0]);
}

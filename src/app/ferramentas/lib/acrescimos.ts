import { lerNumero } from './extenso';
import { deIso, DIA, diferencaCalendario, util } from './datas';

export type ModoMulta = 'fixa' | 'diaria';
// fracao: 1% ao mês ou fração · completo: só meses cheios · dia: pro rata (taxa/30 por dia) · taxa: % acumulada informada
export type ModoJuros = 'fracao' | 'completo' | 'dia' | 'taxa';

export interface OpcoesAcresc {
  valor: string;
  vencimento: string;
  pagamento: string;
  prorrogar: boolean;
  correcao: string;
  multaModo: ModoMulta;
  multa: string;
  multaTeto: string;
  jurosModo: ModoJuros;
  juros: string;
  sobreCorrigido: boolean;
}

export interface LinhaAcresc {
  nome: string;
  regra: string;
  valor: number;
}

export interface ResultadoAcresc {
  dias: number;
  meses: string;
  vencEfetivo: number;
  emAtraso: boolean;
  linhas: LinhaAcresc[];
  total: number;
}

export function num(s: string) {
  const n = lerNumero(s.replace('%', '').trim() || '0');
  return n ? (n.neg ? -1 : 1) * Number(`${n.int}.${n.dec || '0'}`) : NaN;
}

export const r2 = (x: number) => Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100;
const pc = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%';
export const moeda = (x: number) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function calcular(o: OpcoesAcresc): ResultadoAcresc | string {
  const valor = num(o.valor);
  const venc = deIso(o.vencimento);
  const pag = deIso(o.pagamento);
  if (!o.valor.trim()) return '';
  if (isNaN(valor)) return 'Valor inválido';
  if (isNaN(venc) || isNaN(pag)) return 'Informe vencimento e pagamento';
  const taxas = [o.correcao, o.multa, o.multaTeto, o.juros].map(num);
  if (taxas.some(isNaN)) return 'Percentual inválido';
  const [correcao, multa, teto, juros] = taxas;

  let efetivo = venc;
  if (o.prorrogar) while (!util(efetivo, { feriados: true, facultativos: false })) efetivo += DIA;
  const emAtraso = pag > efetivo;
  // atraso conta do vencimento original mesmo prorrogado
  const dias = emAtraso ? Math.round((pag - venc) / DIA) : 0;
  const cal = emAtraso ? diferencaCalendario(venc, pag) : { anos: 0, meses: 0, dias: 0 };
  const mesesCheios = cal.anos * 12 + cal.meses;
  const meses = `${mesesCheios} ${mesesCheios === 1 ? 'mês' : 'meses'} e ${cal.dias} dia${cal.dias === 1 ? '' : 's'}`;

  const vCorr = emAtraso ? r2((valor * correcao) / 100) : 0;
  const base = o.sobreCorrigido ? valor + vCorr : valor;

  let pMulta = 0;
  let regraMulta = 'sem atraso';
  if (emAtraso && o.multaModo === 'fixa') [pMulta, regraMulta] = [multa, pc(multa)];
  else if (emAtraso) {
    pMulta = teto > 0 ? Math.min(dias * multa, teto) : dias * multa;
    regraMulta = `${dias} dia(s) × ${pc(multa)} = ${pc(dias * multa)}` + (teto > 0 && dias * multa > teto ? ` → teto ${pc(teto)}` : '');
  }

  let pJuros = 0;
  let regraJuros = 'sem atraso';
  if (emAtraso) {
    if (o.jurosModo === 'taxa') [pJuros, regraJuros] = [juros, `${pc(juros)} acumulado`];
    else if (o.jurosModo === 'dia') [pJuros, regraJuros] = [(dias * juros) / 30, `${dias} dia(s) × ${pc(juros)} ÷ 30 = ${pc((dias * juros) / 30)}`];
    else {
      const m = mesesCheios + (o.jurosModo === 'fracao' && cal.dias > 0 ? 1 : 0);
      [pJuros, regraJuros] = [m * juros, `${m} mês(es) × ${pc(juros)} = ${pc(m * juros)}`];
    }
  }

  const linhas: LinhaAcresc[] = [
    { nome: 'Valor original', regra: '', valor: r2(valor) },
    { nome: 'Correção', regra: emAtraso ? pc(correcao) + ' sobre o original' : 'sem atraso', valor: vCorr },
    { nome: 'Multa', regra: regraMulta, valor: r2((base * pMulta) / 100) },
    { nome: 'Juros', regra: regraJuros, valor: r2((base * pJuros) / 100) },
  ];
  return { dias, meses, vencEfetivo: efetivo, emAtraso, linhas, total: r2(linhas.reduce((s, l) => s + l.valor, 0)) };
}

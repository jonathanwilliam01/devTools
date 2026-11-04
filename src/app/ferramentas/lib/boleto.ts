export interface Leitura {
  tipo: string;
  barras: string;
  linha: string;
  erros: string[];
  campos: [string, string][];
}

const BASE_FATOR = Date.UTC(1997, 9, 7);
const NOVA_BASE = Date.UTC(2025, 1, 22); // fator volta a 1000 nessa data
const DIA = 86_400_000;

export function mod10(s: string) {
  let soma = 0;
  [...s].reverse().forEach((c, i) => {
    const x = +c * (i % 2 ? 1 : 2);
    soma += x > 9 ? x - 9 : x;
  });
  return (10 - (soma % 10)) % 10;
}

// pesos 2..9 da direita para a esquerda
const soma11 = (s: string) => [...s].reverse().reduce((t, c, i) => t + +c * ((i % 8) + 2), 0);

export const mod11Banco = (s: string) => {
  const dv = 11 - (soma11(s) % 11);
  return dv === 0 || dv > 9 ? 1 : dv;
};

export const mod11Arrec = (s: string) => {
  const r = soma11(s) % 11;
  return r < 2 ? 0 : 11 - r;
};

export function dataDoFator(fator: number) {
  if (!fator) return null;
  const antiga = BASE_FATOR + fator * DIA;
  const nova = NOVA_BASE + (fator - 1000) * DIA;
  const hoje = Date.now();
  return Math.abs(nova - hoje) < Math.abs(antiga - hoje) || antiga >= NOVA_BASE ? nova : antiga;
}

export function fatorDaData(ms: number) {
  return ms < NOVA_BASE ? Math.round((ms - BASE_FATOR) / DIA) : 1000 + Math.round((ms - NOVA_BASE) / DIA);
}

const reais = (centavos: string) => (+centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export function ler(entrada: string): Leitura | string {
  const s = entrada.replace(/\D/g, '');
  if (!s) return '';
  if (s.length === 44) return s[0] === '8' ? arrecadacao(s) : bancario(s);
  if (s.length === 47) return bancarioLinha(s);
  if (s.length === 48) return arrecadacaoLinha(s);
  return `${s.length} dígitos: esperado 44 (código de barras), 47 (linha de boleto) ou 48 (linha de guia/convênio).`;
}

function bancario(b: string, erros: string[] = []): Leitura {
  const livre = b.slice(19);
  const c1 = b.slice(0, 4) + livre.slice(0, 5);
  const c2 = livre.slice(5, 15);
  const c3 = livre.slice(15);
  const dv = mod11Banco(b.slice(0, 4) + b.slice(5));
  if (+b[4] !== dv) erros.push(`DV geral inválido: está ${b[4]}, esperado ${dv}`);
  const linha = `${c1}${mod10(c1)}${c2}${mod10(c2)}${c3}${mod10(c3)}${b[4]}${b.slice(5, 19)}`;
  const fator = +b.slice(5, 9);
  const venc = dataDoFator(fator);
  return {
    tipo: 'Boleto bancário',
    barras: b,
    linha: linha.replace(/^(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d)(\d{14})$/, '$1.$2 $3.$4 $5.$6 $7 $8'),
    erros,
    campos: [
      ['Banco', b.slice(0, 3)],
      ['Moeda', b[3] === '9' ? '9 (Real)' : b[3]],
      ['Fator de vencimento', String(fator)],
      ['Vencimento', venc ? dataBr(venc) : 'Sem vencimento'],
      ['Valor', reais(b.slice(9, 19))],
      ['Campo livre', livre],
    ],
  };
}

function bancarioLinha(l: string) {
  const erros: string[] = [];
  [
    [l.slice(0, 9), l[9]],
    [l.slice(10, 20), l[20]],
    [l.slice(21, 31), l[31]],
  ].forEach(([campo, dv], i) => {
    if (mod10(campo) !== +dv) erros.push(`Campo ${i + 1}: DV ${dv}, esperado ${mod10(campo)}`);
  });
  return bancario(l.slice(0, 4) + l[32] + l.slice(33) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31), erros);
}

function arrecadacao(b: string, erros: string[] = []): Leitura {
  const ref = +b[2];
  const modulo = ref === 6 || ref === 7 ? mod10 : mod11Arrec;
  const dv = modulo(b.slice(0, 3) + b.slice(4));
  if (+b[3] !== dv) erros.push(`DV geral inválido: está ${b[3]}, esperado ${dv}`);
  const blocos = [0, 11, 22, 33].map((i) => b.slice(i, i + 11));
  const segmentos: Record<string, string> = {
    '1': 'Prefeituras',
    '2': 'Saneamento',
    '3': 'Energia elétrica e gás',
    '4': 'Telecomunicações',
    '5': 'Órgãos governamentais',
    '6': 'Carnês e assemelhados',
    '7': 'Multas de trânsito',
    '9': 'Uso exclusivo do banco',
  };
  return {
    tipo: 'Arrecadação (guia / convênio)',
    barras: b,
    linha: blocos.map((x) => `${x}-${modulo(x)}`).join(' '),
    erros,
    campos: [
      ['Segmento', `${b[1]} - ${segmentos[b[1]] ?? '?'}`],
      ['Identificador de valor', `${ref} - ${ref === 6 || ref === 8 ? 'valor efetivo em reais' : 'valor de referência'} (módulo ${modulo === mod10 ? 10 : 11})`],
      ['Valor', ref === 6 || ref === 8 ? reais(b.slice(4, 15)) : b.slice(4, 15)],
      ['Empresa / órgão', b[1] === '6' ? b.slice(15, 23) + ' (CNPJ/MF)' : b.slice(15, 19)],
      ['Campo livre', b.slice(b[1] === '6' ? 23 : 19)],
    ],
  };
}

function arrecadacaoLinha(l: string) {
  const blocos = [0, 12, 24, 36].map((i) => [l.slice(i, i + 11), l[i + 11]]);
  const modulo = l[2] === '6' || l[2] === '7' ? mod10 : mod11Arrec;
  const erros = blocos.flatMap(([bl, dv], i) => (modulo(bl) === +dv ? [] : [`Bloco ${i + 1}: DV ${dv}, esperado ${modulo(bl)}`]));
  return arrecadacao(blocos.map(([bl]) => bl).join(''), erros);
}

const ITF = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010'];

// barras do Interleaved 2 of 5 como [x, largura] (largo = 3x estreito)
export function barrasItf(codigo: string) {
  const larg = (w: string) => (w === '1' ? 3 : 1);
  const seq = ['0', '0', '0', '0'];
  for (let i = 0; i < codigo.length; i += 2) {
    const [a, b] = [ITF[+codigo[i]], ITF[+codigo[i + 1]]];
    for (let j = 0; j < 5; j++) seq.push(a[j], b[j]);
  }
  seq.push('1', '0', '0');
  const barras: [number, number][] = [];
  let x = 0;
  seq.forEach((w, i) => {
    if (i % 2 === 0) barras.push([x, larg(w)]);
    x += larg(w);
  });
  return { barras, largura: x };
}

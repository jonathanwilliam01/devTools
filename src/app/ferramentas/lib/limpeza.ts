export type GrupoLimpeza = 'espaco' | 'invisivel' | 'controle' | 'cr' | 'tab' | 'tipografico' | 'latin1';

interface Estranho {
  nome: string;
  troca: string;
  grupo: GrupoLimpeza;
  // como aparece na prévia
  sinal: string;
}

const e = (nome: string, troca: string, grupo: GrupoLimpeza, sinal: string): Estranho => ({ nome, troca, grupo, sinal });

const TABELA = new Map<number, Estranho>([
  [0x09, e('tabulação', ' ', 'tab', '→')],
  [0x0d, e('retorno de carro (CR)', '', 'cr', '␍')],
  [0xa0, e('espaço não separável (NBSP)', ' ', 'espaco', '⍽')],
  [0x202f, e('espaço estreito não separável', ' ', 'espaco', '⍽')],
  [0x3000, e('espaço ideográfico', ' ', 'espaco', '⍽')],
  [0x200b, e('espaço de largura zero', '', 'invisivel', '∅')],
  [0x200c, e('não juntor de largura zero', '', 'invisivel', '∅')],
  [0x200d, e('juntor de largura zero', '', 'invisivel', '∅')],
  [0x2060, e('juntor de palavra', '', 'invisivel', '∅')],
  [0xfeff, e('BOM / largura zero', '', 'invisivel', '∅')],
  [0xad, e('hífen invisível (soft hyphen)', '', 'invisivel', '∅')],
  [0x200e, e('marca esquerda→direita', '', 'invisivel', '∅')],
  [0x200f, e('marca direita→esquerda', '', 'invisivel', '∅')],
  [0x2028, e('separador de linha', '\n', 'invisivel', '↵')],
  [0x2029, e('separador de parágrafo', '\n', 'invisivel', '↵')],
  [0x201c, e('aspas curvas “', '"', 'tipografico', '“')],
  [0x201d, e('aspas curvas ”', '"', 'tipografico', '”')],
  [0x201e, e('aspas baixas „', '"', 'tipografico', '„')],
  [0x2018, e('aspa simples curva ‘', "'", 'tipografico', '‘')],
  [0x2019, e('aspa simples curva ’', "'", 'tipografico', '’')],
  [0x201a, e('aspa simples baixa ‚', "'", 'tipografico', '‚')],
  [0xb4, e('acento agudo solto ´', "'", 'tipografico', '´')],
  [0x2013, e('meia-risca –', '-', 'tipografico', '–')],
  [0x2014, e('travessão —', '-', 'tipografico', '—')],
  [0x2212, e('sinal de menos −', '-', 'tipografico', '−')],
  [0x2026, e('reticências …', '...', 'tipografico', '…')],
]);
for (let c = 0x2000; c <= 0x200a; c++) TABELA.set(c, e('espaço tipográfico', ' ', 'espaco', '⍽'));
for (let c = 0x202a; c <= 0x202e; c++) TABELA.set(c, e('controle de direção do texto', '', 'invisivel', '∅'));

const hex = (c: number) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0');

function classificar(c: number): Estranho | null {
  const t = TABELA.get(c);
  if (t) return t;
  if (c === 0x0a) return null;
  if (c < 0x20 || c === 0x7f || (c >= 0x80 && c < 0xa0)) return e(`controle ${hex(c)}`, '', 'controle', '¤');
  if (c > 0xff) return e('fora do Latin1', '', 'latin1', '');
  return null;
}

export interface Achado {
  cod: string;
  nome: string;
  grupo: GrupoLimpeza;
  qtd: number;
  linha: number;
}

export function analisar(texto: string): Achado[] {
  const mapa = new Map<number, Achado>();
  let linha = 1;
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    if (c === 0x0a) linha++;
    const x = classificar(c);
    if (!x) continue;
    const a = mapa.get(c);
    if (a) a.qtd++;
    else mapa.set(c, { cod: hex(c), nome: x.grupo === 'latin1' ? `${ch} fora do Latin1` : x.nome, grupo: x.grupo, qtd: 1, linha });
  }
  return [...mapa.values()];
}

export interface Pedaco {
  t: string;
  nome?: string;
}

// texto com os caracteres achados marcados; corta textos grandes
export function previa(texto: string, max = 20000): Pedaco[] {
  const r: Pedaco[] = [];
  let normal = '';
  for (const ch of [...texto].slice(0, max)) {
    const c = ch.codePointAt(0)!;
    const x = classificar(c);
    if (!x) {
      normal += ch;
      continue;
    }
    if (normal) r.push({ t: normal });
    r.push({ t: x.sinal || ch, nome: `${hex(c)} ${x.nome}` });
    normal = x.troca === '\n' ? '\n' : '';
  }
  if (normal) r.push({ t: normal });
  return r;
}

export interface OpcoesLimpeza {
  grupos: GrupoLimpeza[];
  // espaços no fim da linha e repetidos
  aparar: boolean;
}

export function limparTexto(texto: string, o: OpcoesLimpeza) {
  let s = '';
  for (const ch of texto) {
    const x = classificar(ch.codePointAt(0)!);
    s += x && o.grupos.includes(x.grupo) ? x.troca : ch;
  }
  if (o.aparar) s = s.replace(/[ \t]+$/gm, '').replace(/(\S) {2,}/g, '$1 ');
  return s;
}

import type { Passo, Receita } from '../../models';
import { anonimizar, CHAVES } from './anonimizar';
import { converterCasos } from './caixa';
import { identificar, limpar as limparDoc, mascarar } from './docs';
import { corrigir } from './encoding';
import { codificar, decodificar } from './entidades';
import { extrair, PADROES, TipoExtrair } from './extrair';
import { limparTexto } from './limpeza';
import { formatarLista, ordenar, Ordem, unicos } from './listas';
import { inserirLinhas, substituir } from './lote';
import { compactarSql, formatarSql } from './sqlfmt';
import { b64Decode, b64Encode } from './texto';

type Valor = string | boolean;
export interface Campo {
  k: string;
  rotulo: string;
  tipo: 'texto' | 'opcao' | 'chk';
  opcoes?: [string, string][];
  padrao: Valor;
}
export interface DefPasso {
  id: string;
  nome: string;
  campos: Campo[];
  fn: (t: string, p: Record<string, Valor>) => string;
}

const linhas = (t: string) => t.split(/\r?\n/);
const naoVazias = (t: string) => linhas(t).map((l) => l.trim()).filter(Boolean);
const porLinha = (t: string, f: (l: string) => string) => linhas(t).map((l) => (l.trim() ? f(l.trim()) : l)).join('\n');
const txt = (k: string, rotulo: string, padrao = ''): Campo => ({ k, rotulo, tipo: 'texto', padrao });
const chk = (k: string, rotulo: string, padrao = false): Campo => ({ k, rotulo, tipo: 'chk', padrao });
const opc = (k: string, rotulo: string, opcoes: [string, string][]): Campo => ({ k, rotulo, tipo: 'opcao', opcoes, padrao: opcoes[0][0] });
const CASOS = converterCasos('a').map(([n]) => [n, n] as [string, string]);
// "\n" e "\t" digitados viram quebra e tab
const esc = (s: Valor) => String(s).replace(/\\n/g, '\n').replace(/\\t/g, '\t');

export const PASSOS: DefPasso[] = [
  { id: 'limpar', nome: 'Limpar texto colado', campos: [], fn: (t) => limparTexto(t, { grupos: ['espaco', 'invisivel', 'controle', 'cr', 'tipografico'], aparar: true }) },
  { id: 'encoding', nome: 'Corrigir acentuação (Ã§ → ç)', campos: [], fn: (t) => corrigir(t).texto },
  { id: 'aparar', nome: 'Aparar linhas', campos: [chk('vazias', 'Tirar linhas vazias', true)], fn: (t, p) => (p['vazias'] ? naoVazias(t) : linhas(t).map((l) => l.trim())).join('\n') },
  {
    id: 'filtrar',
    nome: 'Filtrar linhas',
    campos: [opc('modo', 'Manter', [['com', 'com o termo'], ['sem', 'sem o termo'], ['regex', 'que casam com regex']]), txt('termo', 'Termo'), chk('caixa', 'Diferenciar maiúsculas')],
    fn: (t, p) => {
      const termo = String(p['termo']);
      if (!termo) return t;
      const re = p['modo'] === 'regex' ? new RegExp(termo, p['caixa'] ? '' : 'i') : null;
      const k = (s: string) => (p['caixa'] ? s : s.toLowerCase());
      return linhas(t)
        .filter((l) => (re ? re.test(l) : k(l).includes(k(termo)) === (p['modo'] === 'com')))
        .join('\n');
    },
  },
  {
    id: 'extrair',
    nome: 'Extrair do texto',
    campos: [
      opc('tipo', 'Tipo', Object.entries(PADROES).map(([k, v]) => [k, v.nome])),
      opc('mascara', 'Máscara', [['manter', 'manter'], ['tirar', 'tirar'], ['por', 'pôr']]),
      chk('validos', 'Só válidos', true),
    ],
    fn: (t, p) => extrair(t, p['tipo'] as TipoExtrair, { validos: !!p['validos'], distintos: false, mascara: p['mascara'] as 'manter' }).join('\n'),
  },
  { id: 'unicos', nome: 'Tirar repetidos', campos: [chk('caixa', 'Ignorar maiúsculas')], fn: (t, p) => unicos(naoVazias(t), !!p['caixa']).join('\n') },
  { id: 'ordenar', nome: 'Ordenar', campos: [opc('ordem', 'Ordem', [['asc', 'crescente'], ['desc', 'decrescente']])], fn: (t, p) => ordenar(naoVazias(t), p['ordem'] as Ordem).join('\n') },
  {
    id: 'lista',
    nome: 'Juntar em lista',
    campos: [
      opc('saida', 'Formato', [['in', 'IN (...)'], ['virgula', 'separado por vírgula'], ['outro', 'outro separador']]),
      opc('aspas', 'Aspas', [['auto', 'aspas: só texto'], ['sim', 'aspas: sempre'], ['nao', 'aspas: nunca']]),
      txt('sep', 'Separador', '; '),
    ],
    fn: (t, p) => {
      const l = naoVazias(t);
      if (!l.length) return '';
      const q = p['aspas'] === 'sim' ? l.map((s) => `'${s.replace(/'/g, "''")}'`) : l;
      if (p['saida'] === 'outro') return q.join(esc(p['sep']));
      return p['aspas'] === 'auto' ? formatarLista(l, p['saida'] as 'in') : p['saida'] === 'in' ? `(${q.join(', ')})` : q.join(', ');
    },
  },
  { id: 'separar', nome: 'Quebrar em linhas', campos: [txt('sep', 'Separador', ',')], fn: (t, p) => t.split(esc(p['sep']) || ',').map((s) => s.trim()).join('\n') },
  { id: 'caixa', nome: 'Caixa e nomes', campos: [opc('caso', 'Para', CASOS)], fn: (t, p) => converterCasos(t).find(([n]) => n === p['caso'])?.[1] ?? t },
  {
    id: 'linhas',
    nome: 'Texto antes/depois de cada linha',
    campos: [txt('antes', 'Antes'), txt('depois', 'Depois'), chk('numerar', 'Numerar')],
    fn: (t, p) => inserirLinhas(t, { antes: esc(p['antes']), depois: esc(p['depois']), numerar: !!p['numerar'], inicio: 1, passo: 1, digitos: 1, separador: '. ', pularVazias: true }),
  },
  {
    id: 'substituir',
    nome: 'Substituir',
    campos: [txt('de', 'De'), txt('para', 'Para'), chk('regex', 'Regex'), chk('caixa', 'Diferenciar maiúsculas')],
    fn: (t, p) =>
      p['regex']
        ? String(p['de'])
          ? t.replace(new RegExp(String(p['de']), p['caixa'] ? 'g' : 'gi'), esc(p['para']))
          : t
        : substituir(t, [{ de: esc(p['de']), para: esc(p['para']) }], { caixa: !!p['caixa'], palavra: false }).texto,
  },
  { id: 'desmascarar', nome: 'Tirar máscara (CPF, CNPJ...)', campos: [], fn: (t) => porLinha(t, (l) => (identificar(l) ? limparDoc(l) : l)) },
  {
    id: 'mascarar',
    nome: 'Pôr máscara (CPF, CNPJ...)',
    campos: [],
    fn: (t) =>
      porLinha(t, (l) => {
        const tipo = identificar(l);
        return tipo ? mascarar(tipo, l) : l;
      }),
  },
  {
    id: 'anonimizar',
    nome: 'Anonimizar (LGPD)',
    campos: [opc('modo', 'Modo', [['parcial', 'parcial'], ['total', 'total'], ['fake', 'dados fake']])],
    fn: (t, p) => anonimizar(t, { tipos: ['campos', 'cpf', 'cnpj', 'email', 'telefone', 'termos'], modo: p['modo'] as 'parcial', chaves: CHAVES, termos: '' }).texto,
  },
  {
    id: 'entidades',
    nome: 'Entidades HTML',
    campos: [opc('modo', 'Modo', [['codificar', 'ã → &atilde;'], ['decodificar', '&atilde; → ã']])],
    fn: (t, p) => (p['modo'] === 'decodificar' ? decodificar(t) : codificar(t, { formato: 'nome', especiais: false })),
  },
  {
    id: 'base64',
    nome: 'Base64',
    campos: [opc('modo', 'Modo', [['encode', 'codificar'], ['decode', 'decodificar']])],
    fn: (t, p) => (p['modo'] === 'decode' ? b64Decode(t.trim(), 'utf-8') : b64Encode(t, 'utf-8')),
  },
  {
    id: 'sql',
    nome: 'Formatar SQL',
    campos: [opc('modo', 'Modo', [['formatar', 'indentar'], ['compactar', 'uma linha']])],
    fn: (t, p) => (p['modo'] === 'compactar' ? compactarSql(t) : formatarSql(t, { caixa: 'maiuscula', indent: 2 })),
  },
];

export const defPasso = (id: string) => PASSOS.find((d) => d.id === id);

export function novoPasso(id: string): Passo {
  const d = defPasso(id)!;
  return { tipo: id, p: Object.fromEntries(d.campos.map((c) => [c.k, c.padrao])) };
}

export interface Etapa {
  nome: string;
  saida: string;
  erro?: string;
}

// para no primeiro erro; saida é a da última etapa que deu certo
export function executar(texto: string, passos: Passo[]): { saida: string; etapas: Etapa[]; erro?: string } {
  const etapas: Etapa[] = [];
  let atual = texto;
  for (const ps of passos) {
    const d = defPasso(ps.tipo);
    if (!d) {
      etapas.push({ nome: ps.tipo, saida: atual, erro: 'Passo desconhecido' });
      return { saida: atual, etapas, erro: `Passo desconhecido: ${ps.tipo}` };
    }
    try {
      const p = Object.fromEntries(d.campos.map((c) => [c.k, ps.p[c.k] ?? c.padrao]));
      atual = d.fn(atual, p);
      etapas.push({ nome: d.nome, saida: atual });
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      etapas.push({ nome: d.nome, saida: atual, erro });
      return { saida: atual, etapas, erro: `${d.nome}: ${erro}` };
    }
  }
  return { saida: atual, etapas };
}

const r = (nome: string, ...passos: [string, Record<string, Valor>?][]): Omit<Receita, 'id'> => ({
  nome,
  passos: passos.map(([id, p]) => ({ ...novoPasso(id), p: { ...novoPasso(id).p, ...p } })),
});

export const MODELOS: Omit<Receita, 'id'>[] = [
  r('CPFs do texto para IN', ['extrair', { tipo: 'cpf', mascara: 'tirar' }], ['unicos'], ['lista', { saida: 'in', aspas: 'sim' }]),
  r('CNPJs do texto para IN', ['extrair', { tipo: 'cnpj', mascara: 'tirar' }], ['unicos'], ['lista', { saida: 'in', aspas: 'sim' }]),
  r('Coluna do Excel para IN', ['limpar'], ['aparar'], ['unicos'], ['lista', { saida: 'in' }]),
  r('Texto do Teams/Word para SQL', ['limpar'], ['encoding']),
  r('E-mails sem repetir', ['extrair', { tipo: 'email' }], ['unicos', { caixa: true }], ['ordenar']),
  r('Nomes para snake_case', ['aparar'], ['caixa', { caso: 'snake_case' }]),
];

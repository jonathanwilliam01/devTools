import { gerarArrecadacao, gerarBancario, ler } from './boleto';
import { lerCron, proximas } from './cron';
import { cnpj, cnpjAlfa, cpf, identificar, limpar, mascarar as _mascarar, rg, valido } from './docs';
import { contarUteis as _contar, deIso, diferencaCalendario, DIA, feriadosNoPeriodo, OpcoesUteis, paraIso, somarUteis as _somar } from './datas';
import { converterCasos, semAcento } from './caixa';
import { csvParaObjetos, detectarSep, jsonParaObjetos, objetosParaInsert } from './csv';
import { corrigir } from './encoding';
import { empresa, pessoa } from './fake';
import { FormatoGrade, gerarTabela, lerGrade } from './grade';
import { hashes } from './hash';
import { formatarData as _formatarData, lerData, OrdemEntrada, todosFormatos } from './formatodata';
import { NOVIDADES } from '../../novidades';
import { anonimizar as _anonimizar, CHAVES, OpcoesAnonimo } from './anonimizar';
import { codificar, decodificar, OpcoesEntidade } from './entidades';
import { extrair as _extrair, OpcoesExtrair, TipoExtrair } from './extrair';
import { GrupoLimpeza, limparTexto as _limpar } from './limpeza';
import { inserirLinhas, OpcoesLinhas, Par, substituir as _substituir } from './lote';
import { aplicar, verificar } from './ortografia';
import { Ajuste, gerar as gerarMd, ler as lerMd } from './paramd';
import { traduzir as _traduzir } from './tradutor';
import { comparar, contar, itens, unicos } from './listas';
import { consultarCnpj } from './cnpj';
import { DadosPix, gerarPix as _gerarPix, lerPix } from './pix';
import { compactarSql, formatarSql as _formatarSql, OpcoesSqlFmt } from './sqlfmt';
import { b64Decode, b64Encode, Charset, decode5t, encode5t, formatarXml, lerJwt, listaSql as _listaSql, OpcoesSql } from './texto';

// Funções expostas ao sistema que embute o devTools (ponte.ts). Nomes e parâmetros são contrato: não renomear.
// Datas entram e saem como aaaa-mm-dd; valores em reais.

type Doc = 'cpf' | 'cnpj' | 'cnpjAlfa' | 'rg';
const GERAR: Record<Doc, () => string> = { cpf, cnpj, cnpjAlfa, rg };
const TIPO = { cpf: 'CPF', cnpj: 'CNPJ', cnpjAlfa: 'CNPJ', rg: 'RG' } as const;

function data(s: string) {
  const ms = deIso(s);
  if (isNaN(ms)) throw new Error(`Data inválida: "${s}" (use aaaa-mm-dd).`);
  return ms;
}
const uteis = (o?: Partial<OpcoesUteis>): OpcoesUteis => ({ feriados: true, facultativos: false, ...o });

export const API = {
  gerar: (tipo: Doc = 'cpf', comMascara = true) => {
    if (!GERAR[tipo]) throw new Error(`Tipo inválido: ${tipo}.`);
    const v = GERAR[tipo]();
    return comMascara ? _mascarar(TIPO[tipo], v) : v;
  },
  validar: (valor: string) => {
    const tipo = identificar(valor);
    return { tipo, valido: !!tipo && valido(tipo, valor), mascarado: tipo ? _mascarar(tipo, valor) : null };
  },
  mascarar: (valor: string) => {
    const tipo = identificar(valor);
    if (!tipo) throw new Error('Documento não reconhecido.');
    return _mascarar(tipo, valor);
  },
  desmascarar: (valor: string) => limpar(valor),
  pessoa: () => pessoa(),
  empresa: () => empresa(),

  lerBoleto: (entrada: string) => {
    const r = ler(entrada);
    if (typeof r === 'string') throw new Error(r);
    return r;
  },
  gerarBoleto: (o: { banco?: string; valor?: number; vencimento?: string | null } = {}) =>
    gerarBancario(o.banco ?? '001', Math.round((o.valor ?? 100) * 100), o.vencimento === null ? null : data(o.vencimento ?? paraIso(Date.now()))),
  gerarGuia: (o: { segmento?: string; ref?: string; valor?: number; empresa?: string } = {}) =>
    gerarArrecadacao(o.segmento ?? '1', o.ref ?? '6', Math.round((o.valor ?? 100) * 100), o.empresa ?? '0001'),
  lerPix: (codigo: string) => lerPix(codigo),
  gerarPix: (d: Partial<DadosPix> & { chave: string }) =>
    _gerarPix({ nome: 'NOME', cidade: 'CIDADE', valor: '', txid: '***', descricao: '', ...d }),

  somarUteis: (inicio: string, dias: number, o?: Partial<OpcoesUteis>) => paraIso(_somar(data(inicio), dias, uteis(o))),
  somarDias: (inicio: string, dias: number) => paraIso(data(inicio) + dias * DIA),
  contarUteis: (inicio: string, fim: string, o?: Partial<OpcoesUteis>) => _contar(data(inicio), data(fim), uteis(o)),
  diferenca: (inicio: string, fim: string) => ({
    ...diferencaCalendario(data(inicio), data(fim)),
    corridos: Math.round((data(fim) - data(inicio)) / DIA),
  }),
  feriados: (inicio: string, fim: string, o?: Partial<OpcoesUteis>) =>
    feriadosNoPeriodo(data(inicio), data(fim), uteis(o)).map(([ms, nome]) => ({ data: paraIso(ms), nome })),
  // sem formato devolve todos; formato: br, us, iso, compacto, extenso, extensoSemana, extensoTotal, en...
  formatarData: (valor: string, formato?: string, ordem: OrdemEntrada = 'auto') => {
    const d = lerData(valor, ordem);
    if (!d) throw new Error(`Data não reconhecida: "${valor}".`);
    return formato ? _formatarData(d, formato) : todosFormatos(d);
  },
  cron: (expr: string, qtd = 5) => {
    const c = lerCron(expr);
    return { descricao: c.descricao, proximas: proximas(c, qtd).map((d) => d.toLocaleString('sv-SE')) };
  },

  formatarSql: (sql: string, o?: Partial<OpcoesSqlFmt>) => _formatarSql(sql, { caixa: 'maiuscula', indent: 2, ...o }),
  compactarSql: (sql: string) => compactarSql(sql),
  listaSql: (texto: string, o?: Partial<OpcoesSql>) => _listaSql(texto, { formato: 'in', aspas: 'auto', distintos: true, ...o }).sql,
  insert: (texto: string, tabela = 'TABELA') => {
    const t = texto.trim();
    const objs = /^[[{]/.test(t) ? jsonParaObjetos(t) : csvParaObjetos(t, detectarSep(t.split(/\r?\n/)[0]));
    return objetosParaInsert(objs, tabela);
  },
  tabela: (texto: string, formato: FormatoGrade = 'markdown', cabecalho = true) => gerarTabela(lerGrade(texto), formato, cabecalho),
  formatarXml: (xml: string, minificar = false) => formatarXml(xml, minificar),

  casos: (texto: string) => Object.fromEntries(converterCasos(texto)),
  semAcento: (texto: string) => semAcento(texto),
  corrigirEncoding: (texto: string) => corrigir(texto).texto,
  base64: (texto: string, modo: 'encode' | 'decode' = 'encode', charset: Charset = 'utf-8') =>
    modo === 'encode' ? b64Encode(texto, charset) : b64Decode(texto, charset),
  base64x5: (texto: string, modo: 'encode' | 'decode' = 'encode', charset: Charset = 'utf-8') =>
    modo === 'encode' ? encode5t(texto, charset) : decode5t(texto, charset),
  lerJwt: (token: string) => lerJwt(token),

  // ajustes: { "1|linha original": { tipo: 'h2', negrito: true, ... } }
  paraMarkdown: (texto: string, ajustes: Record<string, Ajuste> = {}) => gerarMd(lerMd(texto, ajustes)),
  verificarOrtografia: (texto: string, idioma = 'pt-BR') => verificar(texto, idioma),
  // aplica a 1ª sugestão de cada erro
  corrigirOrtografia: async (texto: string, idioma = 'pt-BR') => {
    let r = { texto, erros: await verificar(texto, idioma) };
    const restantes = [];
    while (r.erros.length) {
      const e = r.erros[0];
      if (e.sugestoes.length) r = aplicar(r.texto, r.erros, e, e.sugestoes[0]);
      else restantes.push(e), (r.erros = r.erros.slice(1));
    }
    return { texto: r.texto, semSugestao: restantes };
  },
  // idiomas: pt, en, es, fr, it, de; de = 'auto' detecta
  traduzir: (texto: string, para = 'en', de = 'auto') => _traduzir(texto, de, para),
  limparTexto: (texto: string, grupos: GrupoLimpeza[] = ['espaco', 'invisivel', 'controle', 'cr', 'tipografico'], aparar = true) =>
    _limpar(texto, { grupos, aparar }),
  extrair: (texto: string, tipo: TipoExtrair, o?: Partial<OpcoesExtrair>) => _extrair(texto, tipo, { validos: true, distintos: true, mascara: 'manter', ...o }),
  anonimizar: (texto: string, o?: Partial<OpcoesAnonimo>) =>
    _anonimizar(texto, { tipos: ['campos', 'cpf', 'cnpj', 'email', 'telefone', 'termos'], modo: 'parcial', chaves: CHAVES, termos: '', ...o }).texto,
  entidades: (texto: string, modo: 'codificar' | 'decodificar' = 'codificar', o?: Partial<OpcoesEntidade>) =>
    modo === 'decodificar' ? decodificar(texto) : codificar(texto, { formato: 'nome', especiais: false, ...o }),
  linhas: (texto: string, o?: Partial<OpcoesLinhas>) =>
    inserirLinhas(texto, { antes: '', depois: '', numerar: false, inicio: 1, passo: 1, digitos: 1, separador: '. ', pularVazias: true, ...o }),
  substituir: (texto: string, pares: Par[], o?: { caixa?: boolean; palavra?: boolean }) =>
    _substituir(texto, pares, { caixa: false, palavra: false, ...o }).texto,
  // listas: array ou texto (uma por linha / separada por vírgula)
  compararListas: (a: string | string[], b: string | string[], ignorarCaixa = false) =>
    comparar(typeof a === 'string' ? itens(a) : a, typeof b === 'string' ? itens(b) : b, ignorarCaixa),
  unicos: (l: string | string[], ignorarCaixa = false) => unicos(typeof l === 'string' ? itens(l) : l, ignorarCaixa),
  contarValores: (l: string | string[], ignorarCaixa = false) => contar(typeof l === 'string' ? itens(l) : l, ignorarCaixa),
  consultarCnpj: (cnpj: string) => consultarCnpj(cnpj),
  hash: async (texto: string) => Object.fromEntries(await hashes(new TextEncoder().encode(texto))),

  novidades: () => NOVIDADES,
};

export type NomeApi = keyof typeof API;

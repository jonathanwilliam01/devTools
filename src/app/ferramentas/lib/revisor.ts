import { analisar } from './limpeza';
import { corrigir } from './encoding';

export type Nivel = 'erro' | 'alerta' | 'info';

export interface Achado {
  nivel: Nivel;
  linha: number;
  msg: string;
  trecho?: string;
}

export interface Comando {
  tipo: string;
  linha: number;
  texto: string;
}

export interface Revisao {
  achados: Achado[];
  comandos: Comando[];
  transacao: boolean;
}

// strings e comentários viram espaço (mesmo tamanho, quebras mantidas) para achar palavras-chave sem falso positivo
export function mascarar(sql: string): { codigo: string; aberto: { tipo: string; pos: number } | null } {
  const out = sql.split('');
  const branco = (i: number, f: number) => {
    for (let k = i; k < f; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === '-' && d === '-') {
      const f = sql.indexOf('\n', i);
      const fim = f < 0 ? sql.length : f;
      branco(i, fim);
      i = fim;
    } else if (c === '/' && d === '*') {
      let nivel = 1;
      let k = i + 2;
      while (k < sql.length && nivel) {
        if (sql[k] === '/' && sql[k + 1] === '*') (nivel++, (k += 2));
        else if (sql[k] === '*' && sql[k + 1] === '/') (nivel--, (k += 2));
        else k++;
      }
      if (nivel) return { codigo: out.join(''), aberto: { tipo: 'comentário /*', pos: i } };
      branco(i, k);
      i = k;
    } else if (c === "'") {
      const escape = /[eE]/.test(sql[i - 1] ?? '') && !/[\w$]/.test(sql[i - 2] ?? '');
      let k = i + 1;
      for (;;) {
        if (k >= sql.length) return { codigo: out.join(''), aberto: { tipo: 'aspas simples', pos: i } };
        if (escape && sql[k] === '\\') k += 2;
        else if (sql[k] === "'" && sql[k + 1] === "'") k += 2;
        else if (sql[k] === "'") break;
        else k++;
      }
      branco(i + 1, k);
      i = k + 1;
    } else if (c === '"') {
      let k = i + 1;
      while (k < sql.length && !(sql[k] === '"' && sql[k + 1] !== '"')) k += sql[k] === '"' ? 2 : 1;
      if (k >= sql.length) return { codigo: out.join(''), aberto: { tipo: 'aspas duplas', pos: i } };
      i = k + 1;
    } else if (c === '$' && !/[\w$]/.test(sql[i - 1] ?? '')) {
      const m = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i));
      if (!m) {
        i++;
        continue;
      }
      const f = sql.indexOf(m[0], i + m[0].length);
      if (f < 0) return { codigo: out.join(''), aberto: { tipo: `bloco ${m[0]}`, pos: i } };
      branco(i + m[0].length, f);
      i = f + m[0].length;
    } else i++;
  }
  return { codigo: out.join(''), aberto: null };
}

const linhaDe = (sql: string, pos: number) => sql.slice(0, pos).split('\n').length;
const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;
const NOME = String.raw`${IDENT}(?:\s*\.\s*${IDENT})*`;
const ESCRITA = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'ALTER', 'CREATE', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'DO', 'CALL']);

// palavras fora de parênteses
function topo(codigo: string) {
  const l: { v: string; i: number }[] = [];
  let nivel = 0;
  for (const m of codigo.matchAll(/[()]|[A-Za-z_][\w$]*/g)) {
    if (m[0] === '(') nivel++;
    else if (m[0] === ')') nivel--;
    else if (nivel === 0) l.push({ v: m[0].toUpperCase(), i: m.index! });
  }
  return l;
}

function tipoComando(pal: { v: string }[]) {
  const p = pal[0]?.v ?? '';
  if (p === 'WITH') return pal.find((x) => ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(x.v))?.v ?? 'WITH';
  if (p === 'START' && pal[1]?.v === 'TRANSACTION') return 'BEGIN';
  if (p === 'END') return 'COMMIT';
  return p;
}

export function revisar(sql: string): Revisao {
  const achados: Achado[] = [];
  const comandos: Comando[] = [];
  const add = (nivel: Nivel, pos: number, msg: string, trecho?: string) => achados.push({ nivel, linha: linhaDe(sql, pos), msg, trecho });
  if (!sql.trim()) return { achados, comandos, transacao: false };

  const { codigo, aberto } = mascarar(sql);
  if (aberto) add('erro', aberto.pos, `${aberto.tipo} sem fechar: o resto do script vira parte dela.`);

  // divide nos ; de fora de string/comentário/parênteses
  const partes: { ini: number; fim: number }[] = [];
  let ini = 0;
  let nivel = 0;
  for (let i = 0; i <= codigo.length; i++) {
    const c = codigo[i];
    if (c === '(') nivel++;
    else if (c === ')') nivel--;
    else if (c === ';' || i === codigo.length) {
      if (codigo.slice(ini, i).trim()) partes.push({ ini, fim: i });
      if (nivel !== 0) add('alerta', ini + (codigo.slice(ini).length - codigo.slice(ini).trimStart().length), nivel > 0 ? 'Parêntese aberto sem fechar.' : 'Parêntese fechado sem abrir.');
      nivel = 0;
      ini = i + 1;
    }
  }
  const ultimo = partes.at(-1);
  if (ultimo && ultimo.fim === codigo.length && !aberto) add('info', ultimo.ini + codigo.slice(ultimo.ini).search(/\S/), 'Último comando sem ; no fim.');

  let emTransacao = false;
  let teveTransacao = false;
  let ultimoControle = '';
  let escreve = false;
  let temSetval = false;
  const insertComId: number[] = [];

  for (const { ini, fim } of partes) {
    const cod = codigo.slice(ini, fim);
    const desloc = cod.length - cod.trimStart().length;
    const pos = ini + desloc;
    const c = cod.trim();
    const original = sql.slice(pos, fim).trim();
    const pal = topo(c);
    const tipo = tipoComando(pal);
    const trecho = original.replace(/\s+/g, ' ').slice(0, 90);
    comandos.push({ tipo, linha: linhaDe(sql, pos), texto: original });

    if (tipo === 'BEGIN') {
      if (emTransacao) add('alerta', pos, 'BEGIN dentro de transação já aberta (ignorado pelo PostgreSQL).');
      emTransacao = teveTransacao = true;
      continue;
    }
    if (tipo === 'COMMIT' || tipo === 'ROLLBACK') {
      if (!emTransacao) add('info', pos, `${tipo} sem BEGIN antes.`);
      emTransacao = false;
      ultimoControle = tipo;
      continue;
    }
    if (ESCRITA.has(tipo)) escreve = true;
    if (/\bSETVAL\s*\(/i.test(c)) temSetval = true;

    if (tipo === 'UPDATE' || tipo === 'DELETE') {
      const where = pal.find((p) => p.v === 'WHERE');
      if (!where) add('erro', pos, `${tipo} sem WHERE: ${tipo === 'UPDATE' ? 'altera' : 'apaga'} a tabela inteira.`, trecho);
      else {
        const cond = c.slice(where.i + 5).replace(/\b(RETURNING|ORDER|LIMIT)\b[\s\S]*$/i, '').trim();
        if (/^(1\s*=\s*1|TRUE|'1'\s*=\s*'1')$/i.test(cond)) add('erro', pos, `${tipo} com WHERE sempre verdadeiro.`, trecho);
      }
      const alvo = new RegExp(String.raw`^(?:WITH[\s\S]*?\b)?${tipo === 'UPDATE' ? 'UPDATE' : String.raw`DELETE\s+FROM`}\s+(?:ONLY\s+)?(${NOME})`, 'i').exec(c);
      if (alvo && !alvo[1].includes('.')) add('info', pos, `Tabela "${alvo[1]}" sem schema: depende do search_path.`, trecho);
    }

    if (tipo === 'INSERT') {
      const m = new RegExp(String.raw`INSERT\s+INTO\s+(${NOME})(?:\s+AS\s+${IDENT})?\s*(\(|VALUES\b|SELECT\b|DEFAULT\b)`, 'i').exec(c);
      if (m) {
        if (!m[1].includes('.')) add('info', pos, `Tabela "${m[1]}" sem schema: depende do search_path.`, trecho);
        if (m[2] !== '(') add('alerta', pos, 'INSERT sem lista de colunas: quebra se a tabela ganhar ou mudar a ordem das colunas.', trecho);
        else {
          const cols = c.slice(m.index + m[0].length).split(')')[0];
          if (/(^|,)\s*"?id"?\s*(,|$)/i.test(cols)) insertComId.push(pos);
        }
      }
    }

    if (tipo === 'TRUNCATE') add('alerta', pos, 'TRUNCATE apaga todas as linhas e não dispara triggers de DELETE.', trecho);

    if (tipo === 'DROP') {
      if (/^DROP\s+(TABLE|SCHEMA|DATABASE)\b/i.test(c)) add('alerta', pos, 'DROP apaga a estrutura e os dados.', trecho);
      if (!/\bIF\s+EXISTS\b/i.test(c)) add('info', pos, 'DROP sem IF EXISTS: falha se o objeto não existir.', trecho);
      if (/\bCASCADE\b/i.test(c)) add('alerta', pos, 'CASCADE apaga também o que depende do objeto (views, FKs).', trecho);
    }

    if (tipo === 'ALTER') {
      if (/\bDROP\s+(?!\s|(?:CONSTRAINT|DEFAULT|NOT|IDENTITY|EXPRESSION)\b)/i.test(c) && /^ALTER\s+TABLE/i.test(c))
        add('alerta', pos, 'ALTER TABLE ... DROP COLUMN apaga os dados da coluna.', trecho);
      if (/\bADD\s+(?!\s|(?:CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|IF)\b)(?!COLUMN\s+IF\b)/i.test(c) && /^ALTER\s+TABLE/i.test(c))
        add('info', pos, 'ADD COLUMN sem IF NOT EXISTS: falha se o script rodar de novo.', trecho);
      if (/\bALTER\s+(COLUMN\s+)?\S+\s+(SET\s+DATA\s+)?TYPE\b/i.test(c)) add('info', pos, 'Troca de tipo reescreve a tabela e trava leitura/escrita enquanto roda.', trecho);
    }

    if (tipo === 'CREATE') {
      const obj = /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+|TEMP(?:ORARY)?\s+|UNLOGGED\s+|MATERIALIZED\s+)*(\w+)/i.exec(c)?.[1]?.toUpperCase();
      if (['TABLE', 'INDEX', 'SEQUENCE', 'SCHEMA'].includes(obj ?? '') && !/\bIF\s+NOT\s+EXISTS\b/i.test(c))
        add('info', pos, `CREATE ${obj} sem IF NOT EXISTS: falha se o script rodar de novo.`, trecho);
      if (['FUNCTION', 'PROCEDURE', 'VIEW', 'TRIGGER'].includes(obj ?? '') && !/^CREATE\s+OR\s+REPLACE\b/i.test(c))
        add('info', pos, `CREATE ${obj} sem OR REPLACE: falha se já existir.`, trecho);
      if (obj === 'INDEX') {
        if (/\bCONCURRENTLY\b/i.test(c) && emTransacao) add('erro', pos, 'CREATE INDEX CONCURRENTLY não roda dentro de transação.', trecho);
        if (!/\bCONCURRENTLY\b/i.test(c)) add('info', pos, 'CREATE INDEX trava escrita na tabela enquanto cria; em tabela grande use CONCURRENTLY (fora de BEGIN).', trecho);
      }
    }

    if (/^(VACUUM|REINDEX\s+\w+\s+CONCURRENTLY|CREATE\s+DATABASE|DROP\s+DATABASE)\b/i.test(c) && emTransacao)
      add('erro', pos, `${c.split(/\s+/)[0].toUpperCase()} não roda dentro de transação.`, trecho);

    for (const m of c.matchAll(/(?<![:\w]):([A-Za-z_]\w*)/g)) {
      add('alerta', pos + m.index!, `Parâmetro :${m[1]} não substituído.`, trecho);
      break;
    }
    if (/\bSELECT\s+\*/i.test(c) && tipo === 'INSERT') add('info', pos, 'INSERT ... SELECT *: depende da mesma ordem de colunas nas duas tabelas.', trecho);
  }

  if (escreve && !teveTransacao) add('alerta', 0, 'Script altera dados sem BEGIN/COMMIT: se um comando falhar, os anteriores já ficaram gravados.');
  if (emTransacao) add('alerta', sql.length, 'BEGIN sem COMMIT no fim: a transação fica aberta (e é desfeita ao fechar a conexão).');
  else if (ultimoControle === 'ROLLBACK') add('info', sql.length, 'Termina em ROLLBACK: nada é gravado (ok para teste; troque por COMMIT para valer).');
  if (insertComId.length && !temSetval)
    add('info', insertComId[0], 'INSERT com id informado: ajuste a sequence depois (select setval(...)) para o próximo nextval não repetir.');

  for (const m of sql.matchAll(/\{\{\s*[\w.]+\s*\}\}/g)) {
    add('alerta', m.index!, `Variável ${m[0]} não substituída.`);
    break;
  }

  // caracteres que quebram SQL ou banco LATIN1
  for (const a of analisar(sql)) {
    if (a.grupo === 'cr' || a.grupo === 'tab') continue;
    const nivel: Nivel = a.grupo === 'tipografico' || a.grupo === 'invisivel' || a.grupo === 'controle' ? 'alerta' : 'info';
    add(nivel, posLinha(sql, a.linha), `${a.nome} (${a.cod})${a.qtd > 1 ? ` · ${a.qtd}x` : ''}: troque pelo Corrigir.`);
  }
  for (const [n, l] of sql.split('\n').entries()) {
    if (/[ÃÂ][\u0080-ÿ]/.test(l) && corrigir(l).texto !== l) {
      add('alerta', posLinha(sql, n + 1), 'Acentuação quebrada (UTF-8 lido como Latin1, ex.: Ã§): troque pelo Corrigir.', l.trim().slice(0, 90));
      break;
    }
  }

  const ordem: Record<Nivel, number> = { erro: 0, alerta: 1, info: 2 };
  achados.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || a.linha - b.linha);
  return { achados, comandos, transacao: teveTransacao };
}

const posLinha = (sql: string, linha: number) => sql.split('\n').slice(0, linha - 1).join('\n').length + (linha > 1 ? 1 : 0);

export interface OpcoesCorrigir {
  caracteres: boolean;
  transacao: boolean;
  pontoVirgula: boolean;
}

// limpa caracteres, conserta acentuação e envolve em BEGIN/COMMIT se não tiver
export function corrigirScript(sql: string, o: OpcoesCorrigir, limpar: (s: string) => string) {
  let s = sql;
  if (o.caracteres) s = limpar(corrigirLinhas(s));
  s = s.replace(/\s+$/, '');
  if (o.pontoVirgula && s && !mascarar(s).codigo.trimEnd().endsWith(';')) s += ';';
  if (o.transacao && s && !revisar(s).transacao) s = `BEGIN;\n\n${s}\n\nCOMMIT;`;
  return s;
}

const corrigirLinhas = (s: string) => s.split('\n').map((l) => (/[ÃÂ][\u0080-ÿ]/.test(l) ? corrigir(l).texto : l)).join('\n');

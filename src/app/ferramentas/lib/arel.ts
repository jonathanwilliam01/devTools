// interpreta consultas Arel (Ruby) e monta o SQL do PostgreSQL que elas gerariam.
// Conhece os helpers do BaseQuery (casewhen, coalesce, left_join...) e o matches com UNACCENT do initializer.

interface Tk {
  t: 'str' | 'num' | 'id' | 'const' | 'ivar' | 'sym' | 'label' | 'op' | 'nl';
  v: string;
  esp: boolean;
  partes?: (string | { codigo: string })[];
}

const ABRE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

function lerString(s: string, i: number, fecha: string, interp: boolean) {
  const partes: (string | { codigo: string })[] = [];
  let buf = '';
  let j = i;
  while (j < s.length && s[j] !== fecha) {
    if (s[j] === '\\' && j + 1 < s.length) {
      const e = s[++j];
      if (!interp) buf += e === fecha || e === '\\' ? e : '\\' + e;
      else buf += ({ n: '\n', t: '\t', r: '\r', s: ' ' } as Record<string, string>)[e] ?? e;
    } else if (interp && s[j] === '#' && s[j + 1] === '{') {
      let n = 1;
      let k = j + 2;
      while (k < s.length && n) {
        if (s[k] === '{') n++;
        else if (s[k] === '}') n--;
        k++;
      }
      if (buf) partes.push(buf);
      buf = '';
      partes.push({ codigo: s.slice(j + 2, k - 1) });
      j = k - 1;
    } else buf += s[j];
    j++;
  }
  if (buf || !partes.length) partes.push(buf);
  return { partes, fim: j + 1 };
}

function tokens(fonte: string): Tk[] {
  let s = fonte;
  const out: Tk[] = [];
  let i = 0;
  let esp = true;
  const push = (t: Tk['t'], v: string, extra: Partial<Tk> = {}) => {
    out.push({ t, v, esp, ...extra });
    esp = false;
  };
  while (i < s.length) {
    const c = s[i];
    const r = s.slice(i, i + 200);
    let m: RegExpExecArray | null;
    if (c === '\n') {
      push('nl', '\n');
      esp = true;
      i++;
    } else if (/\s/.test(c)) {
      esp = true;
      i++;
    } else if (c === '\\' && s[i + 1] === '\n') i += 2;
    else if (c === '#') while (i < s.length && s[i] !== '\n') i++;
    else if (r.startsWith('=begin') && (i === 0 || s[i - 1] === '\n')) {
      const f = s.indexOf('\n=end', i);
      i = f < 0 ? s.length : f + 5;
    } else if ((m = /^<<([~-]?)(['"]?)(\w+)\2/.exec(r)) && /[A-Z]/.test(m[3][0])) {
      // heredoc: o corpo começa na próxima linha
      const fimLinha = s.indexOf('\n', i);
      const resto = s.slice(fimLinha + 1);
      const term = new RegExp(`^[ \\t]*${m[3]}[ \\t]*$`, 'm').exec(resto);
      let corpo = term ? resto.slice(0, term.index) : resto;
      if (m[1] === '~') {
        const ind = Math.min(...corpo.split('\n').filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
        corpo = corpo.split('\n').map((l) => l.slice(ind)).join('\n');
      }
      corpo = corpo.replace(/\n$/, '');
      const { partes } = lerString(corpo + '\u0000', 0, '\u0000', m[2] !== "'");
      push('str', '', { partes });
      if (term) s = s.slice(0, fimLinha + 1) + resto.slice(term.index + term[0].length + 1);
      i += m[0].length;
    } else if (c === '"' || c === "'" || c === '`') {
      const { partes, fim } = lerString(s, i + 1, c, c !== "'");
      push('str', '', { partes });
      i = fim;
    } else if ((m = /^%([wiq]?)([[({<])/i.exec(r))) {
      const fecha = ({ '[': ']', '(': ')', '{': '}', '<': '>' } as Record<string, string>)[m[2]];
      let f = i + m[0].length;
      for (let n = 1; f < s.length; f++) {
        if (s[f] === m[2]) n++;
        else if (s[f] === fecha && !--n) break;
      }
      const corpo = s.slice(i + m[0].length, f);
      if (m[1].toLowerCase() === 'w' || m[1].toLowerCase() === 'i') {
        push('op', '[');
        corpo
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .forEach((w, k) => {
            if (k) push('op', ',');
            push(m![1].toLowerCase() === 'i' ? 'sym' : 'str', w, { partes: [w] });
          });
        push('op', ']');
      } else push('str', '', { partes: m[1] === 'q' ? [corpo] : lerString(corpo + '\u0000', 0, '\u0000', true).partes });
      i = f + 1;
    } else if (c === '/' && (out.length === 0 || (out[out.length - 1].t === 'op' && !/^[)\]}]$/.test(out[out.length - 1].v)) || (esp && s[i + 1] !== ' ' && out[out.length - 1].t === 'id'))) {
      // regex literal: /.../
      let j = i + 1;
      while (j < s.length && s[j] !== '/' && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1;
      push('str', '', { partes: [s.slice(i + 1, j)] });
      i = j + 1;
      while (/[imxo]/.test(s[i] ?? '')) i++;
    } else if ((m = /^\d[\d_]*(\.\d+)?/.exec(r))) {
      push('num', m[0].replace(/_/g, ''));
      i += m[0].length;
    } else if (c === ':' && s[i + 1] === '"') {
      const { partes, fim } = lerString(s, i + 2, '"', false);
      push('sym', partes.join(''));
      i = fim;
    } else if (c === ':' && /[A-Za-z_]/.test(s[i + 1] ?? '') && !(out.length && !esp && /[\w)\]]$/.test(out[out.length - 1].v))) {
      m = /^:\w+[?!=]?/.exec(r)!;
      push('sym', m[0].slice(1));
      i += m[0].length;
    } else if ((m = /^@@?\w+/.exec(r))) {
      push('ivar', m[0]);
      i += m[0].length;
    } else if ((m = /^\$\w+/.exec(r))) {
      push('id', m[0]);
      i += m[0].length;
    } else if ((m = /^([A-Za-z_]\w*)(?:[?!](?!=))?/.exec(r))) {
      const nome = m[0];
      i += nome.length;
      if (s[i] === ':' && s[i + 1] !== ':' && (out.length === 0 || out[out.length - 1].v !== '?')) {
        push('label', nome);
        i++;
      } else push(/^[A-Z]/.test(nome) ? 'const' : 'id', nome);
    } else {
      m = /^(\*\*|::|&\.|\.\.\.|\.\.|=>|->|===|==|!=|=~|>=|<=|<=>|&&=|\|\|=|&&|\|\||\+=|-=|\*=|<<|>>)/.exec(r);
      push('op', m ? m[0] : c);
      i += m ? m[0].length : 1;
    }
  }
  // quebra de linha só separa comando fora de parênteses e sem continuação
  const CONT = new Set([',', '.', '&.', '(', '[', '{', '&&', '||', '+', '-', '*', '/', '=', '=>', '?', ':', '||=', '&&=', '+=', '|', '<<', '==', '!=', '>', '<', '>=', '<=', 'and', 'or', '\\']);
  const res: Tk[] = [];
  const pilha: string[] = [];
  for (let k = 0; k < out.length; k++) {
    const x = out[k];
    if (x.t === 'op' && ABRE[x.v]) pilha.push(x.v);
    else if (x.t === 'op' && (x.v === ')' || x.v === ']' || x.v === '}')) pilha.pop();
    if (x.t === 'nl') {
      const ant = res[res.length - 1];
      let k2 = k + 1;
      while (out[k2]?.t === 'nl') k2++;
      const prox = out[k2];
      const dentro = pilha.length && pilha[pilha.length - 1] !== '{';
      if (!ant || ant.t === 'nl' || dentro || (CONT.has(ant.v) && ant.t !== 'str') || (prox && prox.t === 'op' && (prox.v === '.' || prox.v === '&.'))) continue;
    }
    res.push(x);
  }
  return res;
}

// ---------- valores ----------

interface No {
  tipo: string;
  sql(): string;
}

interface SM {
  projs: R[];
  froms: R[];
  joins: { tipo: string; fonte: R; on?: R }[];
  wheres: R[];
  groups: R[];
  havings: R[];
  orders: R[];
  limit?: R;
  offset?: R;
  distinct: boolean;
  lock: boolean;
  usado: boolean;
}

type R =
  | { k: 'nil' }
  | { k: 'bool'; v: boolean }
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'sym'; v: string }
  | { k: 'arr'; v: R[] }
  | { k: 'hash'; v: [R, R][] }
  | { k: 'range'; a: R; b: R }
  | { k: 'desc'; nome: string }
  | { k: 'tab'; nome: string; alias?: string; incerto?: boolean }
  | { k: 'sm'; s: SM }
  | { k: 'alias'; fonte: R; nome: string }
  | { k: 'no'; n: No }
  | { k: 'cls'; nome: string }
  | { k: 'self' }
  | { k: 'lambda'; ini: number; fim: number; params: string[] };

const NIL: R = { k: 'nil' };
const no = (tipo: string, sql: () => string): R => ({ k: 'no', n: { tipo, sql } });
const lit = (sql: string) => no('lit', () => sql);
const desc = (nome: string): R => ({ k: 'desc', nome: nome.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'valor' });
const novoSM = (): SM => ({ projs: [], froms: [], joins: [], wheres: [], groups: [], havings: [], orders: [], distinct: false, lock: false, usado: false });
const quoteStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const ehNo = (r: R, tipo: string) => r.k === 'no' && r.n.tipo === tipo;

// valor dentro do SQL, com aspas em string (Arel build_quoted)
function sql(r: R): string {
  switch (r.k) {
    case 'nil':
      return 'NULL';
    case 'bool':
      return r.v ? 'TRUE' : 'FALSE';
    case 'num':
      return String(r.v);
    case 'str':
    case 'sym':
      return quoteStr(r.v);
    case 'arr':
      return r.v.map(sql).join(', ');
    case 'hash':
      return r.v.map(([, v]) => sql(v)).join(', ');
    case 'range':
      return `${sql(r.a)} AND ${sql(r.b)}`;
    case 'desc':
      return ':' + r.nome;
    case 'tab':
      return r.incerto ? ':' + r.nome : (r.alias ?? r.nome);
    case 'sm':
      return `(${montar(r.s)})`;
    case 'alias':
      return r.nome;
    case 'no':
      return r.n.sql();
    case 'cls':
      return r.nome;
    default:
      return '';
  }
}

// valor como texto Ruby (interpolação, Arel.sql, literal)
function texto(r: R): string {
  switch (r.k) {
    case 'str':
    case 'sym':
      return r.v;
    case 'nil':
      return '';
    case 'arr':
      return r.v.map(texto).join(', ');
    case 'sm':
      return montar(r.s);
    default:
      return sql(r);
  }
}

function fonte(r: R): string {
  if (r.k === 'tab') return r.alias ? `${r.nome} ${r.alias}` : r.nome;
  if (r.k === 'alias') {
    const f = r.fonte;
    if (f.k === 'sm') f.s.usado = true;
    const dentro = f.k === 'sm' ? `(\n${montar(f.s)}\n)` : f.k === 'tab' ? f.nome : sql(f);
    return `${dentro} ${r.nome}`;
  }
  if (r.k === 'sm') r.s.usado = true;
  return r.k === 'str' ? r.v : r.k === 'sm' ? `(\n${montar(r.s)}\n)` : sql(r);
}

function montar(s: SM): string {
  const l = (x: R[]) => x.map(sql).join(', ');
  let q = 'SELECT ' + (s.distinct ? 'DISTINCT ' : '') + (s.projs.length ? l(s.projs) : '*');
  if (s.froms.length) q += '\nFROM ' + s.froms.map(fonte).join(', ');
  for (const j of s.joins) q += j.tipo ? `\n${j.tipo} ${fonte(j.fonte)}${j.on ? ' ON ' + sql(j.on) : ''}` : '\n' + texto(j.fonte);
  if (s.wheres.length) q += '\nWHERE ' + s.wheres.map(sql).join(' AND ');
  if (s.groups.length) q += '\nGROUP BY ' + l(s.groups);
  if (s.havings.length) q += '\nHAVING ' + s.havings.map(sql).join(' AND ');
  if (s.orders.length) q += '\nORDER BY ' + l(s.orders);
  if (s.limit) q += '\nLIMIT ' + sql(s.limit);
  if (s.offset) q += '\nOFFSET ' + sql(s.offset);
  if (s.lock) q += '\nFOR UPDATE';
  return q;
}

const JOIN: Record<string, string> = {
  InnerJoin: 'INNER JOIN',
  OuterJoin: 'LEFT OUTER JOIN',
  RightOuterJoin: 'RIGHT OUTER JOIN',
  FullOuterJoin: 'FULL OUTER JOIN',
  LateralJoin: 'LEFT JOIN LATERAL',
  StringJoin: '',
};

const AGREGA: Record<string, string> = { count: 'COUNT', sum: 'SUM', maximum: 'MAX', minimum: 'MIN', average: 'AVG', Count: 'COUNT', Sum: 'SUM', Max: 'MAX', Min: 'MIN', Avg: 'AVG' };

function grupo(r: R): R {
  if (ehNo(r, 'grupo') || r.k === 'sm') return r;
  return no('grupo', () => `(${sql(r)})`);
}

const bin = (a: R, op: string, b: R) => no('bin', () => `${sql(a)} ${op} ${sql(b)}`);
const fn = (nome: string, args: R[], distinct = false) => no('fn', () => `${nome}(${distinct ? 'DISTINCT ' : ''}${args.map(sql).join(', ')})`);
const e = (lista: R[]) => no('and', () => lista.map(sql).join(' AND '));
const ou = (a: R, b: R) => grupo(no('or', () => `${sql(a)} OR ${sql(b)}`));
const lista = (r: R | undefined): R[] => (!r ? [] : r.k === 'arr' ? r.v : [r]);

function emLista(a: R, b: R, neg: boolean): R {
  const n = neg ? 'NOT ' : '';
  if (b.k === 'range') return no('bin', () => `${sql(a)} ${n}BETWEEN ${sql(b.a)} AND ${sql(b.b)}`);
  if (b.k === 'sm') {
    b.s.usado = true;
    return no('bin', () => `${sql(a)} ${n}IN (${montar(b.s)})`);
  }
  const v = lista(b);
  if (!v.length && b.k === 'arr') return lit(neg ? '1=1' : '1=0');
  return no('bin', () => `${sql(a)} ${n}IN (${v.map(sql).join(', ')})`);
}

function matches(a: R, b: R, caso = false, escape?: R, neg = false): R {
  const op = (neg ? 'NOT ' : '') + (caso ? 'LIKE' : 'ILIKE');
  const esc = escape && escape.k !== 'nil' ? ` ESCAPE ${sql(escape)}` : '';
  // config/initializers/arel.rb: matches usa UNACCENT nos dois lados no PostgreSQL
  if (!neg) return no('bin', () => `UNACCENT(${sql(a)}) ${op} UNACCENT(${sql(b)})${esc}`);
  return no('bin', () => `${sql(a)} ${op} ${sql(b)}${esc}`);
}

function janela(): R & { k: 'no' } {
  const partes: { part: R[]; ordem: R[]; frame?: string } = { part: [], ordem: [] };
  const r = no('janela', () =>
    [partes.part.length ? 'PARTITION BY ' + partes.part.map(sql).join(', ') : '', partes.ordem.length ? 'ORDER BY ' + partes.ordem.map(sql).join(', ') : '', partes.frame ?? '']
      .filter(Boolean)
      .join(' '),
  ) as R & { k: 'no' };
  (r.n as No & { partes: typeof partes }).partes = partes;
  return r;
}

// métodos de predicado/expressão em atributo ou nó
function metodoNo(a: R, m: string, args: R[]): R | undefined {
  const b = args[0] ?? NIL;
  switch (m) {
    case 'eq':
      return b.k === 'nil' ? no('bin', () => `${sql(a)} IS NULL`) : bin(a, '=', b);
    case 'not_eq':
      return b.k === 'nil' ? no('bin', () => `${sql(a)} IS NOT NULL`) : bin(a, '!=', b);
    case 'gt':
      return bin(a, '>', b);
    case 'gteq':
      return bin(a, '>=', b);
    case 'lt':
      return bin(a, '<', b);
    case 'lteq':
      return bin(a, '<=', b);
    case 'is_distinct_from':
      return bin(a, 'IS DISTINCT FROM', b);
    case 'is_not_distinct_from':
      return bin(a, 'IS NOT DISTINCT FROM', b);
    case 'in':
    case 'not_in':
      return emLista(a, b, m === 'not_in');
    case 'between':
      return emLista(a, b.k === 'arr' && b.v.length === 2 ? { k: 'range', a: b.v[0], b: b.v[1] } : b, false);
    case 'matches':
      return matches(a, b, args[2]?.k === 'bool' && args[2].v, args[1]);
    case 'does_not_match':
      return matches(a, b, args[2]?.k === 'bool' && args[2].v, args[1], true);
    case 'and':
      return e([a, ...args]);
    case 'or':
      return ou(a, b);
    case 'not':
      return no('not', () => `NOT (${sql(a)})`);
    case 'as': {
      const nome = texto(b);
      return no('as', () => `${sql(a)} AS ${nome}`);
    }
    case 'desc':
    case 'asc':
      return no('ordem', () => `${sql(a)} ${m.toUpperCase()}`);
    case 'nulls_first':
    case 'nulls_last':
      return no('ordem', () => `${sql(a)} ${m === 'nulls_first' ? 'NULLS FIRST' : 'NULLS LAST'}`);
    case 'count':
      return fn('COUNT', [a], b.k === 'bool' && b.v);
    case 'sum':
    case 'maximum':
    case 'minimum':
    case 'average':
      return fn(AGREGA[m], [a]);
    case 'lower':
    case 'upper':
      return fn(m.toUpperCase(), [a]);
    case 'concat':
      return no('bin', () => `${sql(a)} || ${sql(b)}`);
    case 'over': {
      return no('fn', () => `${sql(a)} OVER (${b.k === 'nil' ? '' : b.k === 'str' || b.k === 'sym' ? b.v : sql(b)})`);
    }
    case 'to_sql':
      return lit(sql(a));
  }
  const qualquer = /^(eq|not_eq|gt|gteq|lt|lteq|matches|does_not_match|in|not_in)_(any|all)$/.exec(m);
  if (qualquer) {
    const v = lista(b).map((x) => metodoNo(a, qualquer[1], [x])!);
    if (!v.length) return lit(qualquer[2] === 'any' ? '1=0' : '1=1');
    return grupo(no('bin', () => v.map(sql).join(qualquer[2] === 'any' ? ' OR ' : ' AND ')));
  }
  return undefined;
}

export interface ResultadoArel {
  sql: string;
  avisos: string[];
}

const PARAMS = /^(params|options|opts|args|filtros?|filters?|attrs|attributes|query_params)$/;
const KEYWORDS = new Set(['if', 'unless', 'while', 'until', 'and', 'or', 'not', 'then', 'do', 'end', 'rescue', 'else', 'elsif', 'when', 'in', 'ensure']);
const PULAR_LINHA = new Set(['add_custom_filter', 'include', 'extend', 'require', 'require_relative', 'private', 'protected', 'public', 'private_class_method', 'attr_accessor', 'attr_reader', 'attr_writer', 'raise', 'validates', 'belongs_to', 'has_many', 'has_one', 'scope', 'puts', 'p', 'pp', 'alias_method']);

export function arelParaSql(codigo: string): ResultadoArel {
  const tk = tokens(codigo);
  let i = 0;
  const avisos = new Set<string>();
  let escopo = new Map<string, R>();
  const tabelas = new Map<string, R>();
  const todos: SM[] = [];
  const saidas: { nome: string; v: R }[] = [];
  const defs = new Map<string, { params: string[]; ini: number; fim: number }>();
  const pilhaDefs: string[] = [];

  const ver = (v: string, k = i) => tk[k]?.t === 'op' && tk[k].v === v;
  const verId = (v: string, k = i) => tk[k]?.t === 'id' && tk[k].v === v;
  const fimCmd = (k = i) => k >= tk.length || tk[k].t === 'nl' || ver(';', k) || ver(')', k) || ver('}', k) || ver(']', k);
  const pegar = (v: string) => {
    if (!ver(v)) throw new Error(`Esperado "${v}" perto de "${tk[i]?.v || 'fim'}"`);
    i++;
  };
  const pularLinha = () => {
    let n = 0;
    while (i < tk.length && !(n === 0 && (tk[i].t === 'nl' || ver(';')))) {
      if (tk[i].t === 'op' && ABRE[tk[i].v]) n++;
      else if (tk[i].t === 'op' && /^[)\]}]$/.test(tk[i].v)) n--;
      i++;
    }
  };
  const pularBalanceado = () => {
    const abre = tk[i].v;
    const fecha = ABRE[abre];
    let n = 0;
    do {
      if (ver(abre)) n++;
      else if (ver(fecha)) n--;
      i++;
    } while (n > 0 && i < tk.length);
  };
  // pula do ... end contando os blocos internos
  const pularDo = () => {
    let n = 0;
    do {
      const x = tk[i];
      const inicioLinha = i === 0 || tk[i - 1].t === 'nl' || ver(';', i - 1) || ver('=', i - 1);
      const aposPonto = ver('.', i - 1) || ver('&.', i - 1);
      if (x.t === 'id' && !aposPonto) {
        if (['do', 'def', 'class', 'module', 'begin', 'case'].includes(x.v) || (inicioLinha && ['if', 'unless', 'while', 'until'].includes(x.v))) n++;
        else if (x.v === 'end') n--;
      }
      i++;
    } while (n > 0 && i < tk.length);
  };

  const novaSM = (from?: R): SM => {
    const s = novoSM();
    if (from) s.froms.push(from);
    todos.push(s);
    return s;
  };

  const chamarLambda = (l: R, arg?: R): R => {
    if (l.k !== 'lambda') return l;
    const salvo = [i, escopo] as const;
    escopo = new Map(escopo);
    if (l.params[0]) escopo.set(l.params[0], arg ?? NIL);
    i = l.ini;
    let v: R = NIL;
    while (i < l.fim) {
      if (tk[i].t === 'nl' || ver(';')) {
        i++;
        continue;
      }
      v = comando();
    }
    [i, escopo] = salvo;
    return v;
  };

  // lê um bloco { |x| ... } ou do |x| ... end sem executar
  const lerBloco = (): R | undefined => {
    let fechaDo = false;
    if (ver('{')) i++;
    else if (verId('do')) {
      i++;
      fechaDo = true;
    } else return undefined;
    const params: string[] = [];
    if (ver('|')) {
      i++;
      while (!ver('|') && i < tk.length) {
        if (tk[i].t === 'id') params.push(tk[i].v);
        i++;
      }
      i++;
    }
    const ini = i;
    if (fechaDo) {
      i--;
      tk[i] = { ...tk[i], t: 'id', v: 'do' };
      pularDo();
      return { k: 'lambda', ini, fim: i - 1, params };
    }
    let n = 1;
    while (i < tk.length && n) {
      if (ver('{')) n++;
      else if (ver('}')) n--;
      i++;
    }
    return { k: 'lambda', ini, fim: i - 1, params };
  };

  // ---------- métodos ----------

  const metodoSM = (s: SM, m: string, a: R[]): R | undefined => {
    const ret: R = { k: 'sm', s };
    const cond = /^(.+)_condition$/.exec(m);
    if (cond) {
      // method_missing do initializer: x_condition(flag, args) aplica x se flag (aqui sempre aplica)
      const resto = a.slice(1).map((x) => (x.k === 'lambda' ? chamarLambda(x, ret) : x));
      if (resto.some((x) => x.k === 'nil')) return ret;
      return metodo(ret, cond[1], resto);
    }
    switch (m) {
      case 'project':
        s.projs.push(...a.flatMap(lista));
        return ret;
      case 'from':
        s.froms = [a[0]];
        if (a[0]?.k === 'sm') a[0].s.usado = true;
        return ret;
      case 'join':
      case 'outer_join': {
        const cls = a[1]?.k === 'cls' ? a[1].nome.split('::').pop()! : m === 'outer_join' ? 'OuterJoin' : 'InnerJoin';
        const f = a[0] ?? NIL;
        const string = f.k === 'str' || ehNo(f, 'lit');
        s.joins.push({ tipo: string ? '' : (JOIN[cls] ?? 'INNER JOIN'), fonte: f });
        return ret;
      }
      case 'join_procedure': {
        const [rel, ...resto] = a;
        const nome = rel?.k === 'tab' ? rel.nome : texto(rel ?? NIL);
        const alias = rel?.k === 'tab' ? rel.alias : undefined;
        s.joins.push({ tipo: 'LEFT OUTER JOIN', fonte: no('fn', () => `${nome}(${resto.map(sql).join(', ')})${alias ? ' ' + alias : ''}`), on: lit('1 = 1') });
        return ret;
      }
      case 'on': {
        const j = s.joins[s.joins.length - 1];
        if (j && !j.on) j.on = a.length > 1 ? e(a) : a[0];
        return ret;
      }
      case 'where':
        s.wheres.push(...a.filter((x) => x.k !== 'nil').map((x) => (x.k === 'str' ? lit(x.v) : x)));
        return ret;
      case 'having':
        s.havings.push(...a.map((x) => (x.k === 'str' ? lit(x.v) : x)));
        return ret;
      case 'group':
        s.groups.push(...a.flatMap(lista).map((x) => (x.k === 'str' || x.k === 'sym' ? lit(x.v) : x)));
        return ret;
      case 'order':
        s.orders.push(...a.flatMap(lista).map((x) => (x.k === 'str' || x.k === 'sym' ? lit(x.v) : x)));
        return ret;
      case 'reorder':
        s.orders = a.flatMap(lista);
        return ret;
      case 'take':
      case 'limit':
        s.limit = a[0]?.k === 'nil' ? undefined : a[0];
        return ret;
      case 'skip':
      case 'offset':
        s.offset = a[0]?.k === 'nil' ? undefined : a[0];
        return ret;
      case 'distinct':
        s.distinct = !(a[0]?.k === 'bool' && !a[0].v);
        return ret;
      case 'lock':
        s.lock = true;
        return ret;
      case 'as':
        return { k: 'alias', fonte: ret, nome: texto(a[0] ?? NIL) };
      case 'exists':
        return no('exists', () => {
          s.usado = true;
          return `EXISTS (${montar(s)})`;
        });
      case 'union':
      case 'union_all':
      case 'except':
      case 'intersect': {
        const todos = a[0]?.k === 'sym' && a[0].v === 'all';
        const outro = a[todos ? 1 : 0] ?? NIL;
        return uniao(ret, outro, m === 'union_all' || todos ? 'UNION ALL' : m.toUpperCase());
      }
      case 'to_sql':
      case 'ast':
      case 'arel':
        return m === 'to_sql' ? lit(montar(s)) : ret;
      case 'ignore_parentheses':
        return ret;
    }
    return undefined;
  };

  const uniao = (a: R, b: R, tipo: string): R => {
    for (const x of [a, b]) if (x.k === 'sm') x.s.usado = true;
    const parte = (x: R) => (x.k === 'sm' ? montar(x.s) : ehNo(x, 'uniao') ? (x as { k: 'no'; n: No & { dentro: () => string } }).n.dentro() : sql(x));
    const r = no('uniao', () => `(\n${parte(a)}\n${tipo}\n${parte(b)}\n)`) as R & { k: 'no' };
    (r.n as No & { dentro: () => string }).dentro = () => `${parte(a)}\n${tipo}\n${parte(b)}`;
    return r;
  };

  const caso = (base?: R): R => {
    const c: { whens: [R, R?][]; senao?: R } = { whens: [] };
    const r = no('case', () => {
      let q = 'CASE' + (base && base.k !== 'nil' ? ' ' + sql(base) : '');
      for (const [w, t] of c.whens) q += ` WHEN ${sql(w)} THEN ${sql(t ?? NIL)}`;
      if (c.senao) q += ` ELSE ${sql(c.senao)}`;
      return q + ' END';
    }) as R & { k: 'no' };
    (r.n as No & { caso: typeof c }).caso = c;
    return r;
  };

  const metodo = (alvo: R, m: string, a: R[], bloco?: R): R => {
    if (alvo.k === 'self') return chamar(m, a, bloco);
    if ((m === 'send' || m === 'public_send') && a[0]) return metodo(alvo, texto(a[0]), a.slice(1), bloco);
    if (alvo.k === 'tab' && m !== 'as' && m !== 'alias') {
      if (m === 'table_name' || m === 'name') return { k: 'str', v: alvo.nome };
      if (m === 'table_alias') return alvo.alias ? { k: 'str', v: alvo.alias } : NIL;
      if (m === 'arel_table') return alvo;
      const s = novaSM(alvo);
      const r = metodoSM(s, m, a);
      if (r) return r;
      todos.pop();
      if (alvo.incerto) return desc(alvo.nome);
    }
    if (alvo.k === 'tab' && (m === 'alias' || m === 'as')) return { k: 'tab', nome: alvo.nome, alias: a[0] ? texto(a[0]) : `${alvo.nome}_2` };
    if (alvo.k === 'sm') {
      const r = metodoSM(alvo.s, m, a);
      if (r) return r;
    }
    if (alvo.k === 'no') {
      const n = alvo.n as No & { caso?: { whens: [R, R?][]; senao?: R }; partes?: { part: R[]; ordem: R[] } };
      if (n.caso) {
        if (m === 'when') return n.caso.whens.push([a[0] ?? NIL, a[1]]), alvo;
        if (m === 'then') {
          const w = n.caso.whens[n.caso.whens.length - 1];
          if (w) w[1] = a[0];
          return alvo;
        }
        if (m === 'else') return (n.caso.senao = a[0] ?? NIL), alvo;
      }
      if (n.partes) {
        if (m === 'partition') return n.partes.part.push(...a.flatMap(lista)), alvo;
        if (m === 'order') return n.partes.ordem.push(...a.flatMap(lista)), alvo;
        return alvo;
      }
    }
    if (alvo.k === 'alias' && m === 'as') return alvo;
    if (alvo.k === 'no' || alvo.k === 'alias' || alvo.k === 'sm' || alvo.k === 'tab') {
      const r = metodoNo(alvo.k === 'sm' ? alvo : alvo, m, a);
      if (r) return r;
    }
    if (alvo.k === 'arr') {
      if ((m === 'map' || m === 'collect' || m === 'flat_map') && bloco) {
        const v = alvo.v.map((x) => chamarLambda(bloco, x));
        return { k: 'arr', v: m === 'flat_map' ? v.flatMap(lista) : v };
      }
      if (m === 'each' && bloco) return alvo.v.forEach((x) => chamarLambda(bloco, x)), alvo;
      if (m === 'join') return { k: 'str', v: alvo.v.map(texto).join(a[0] ? texto(a[0]) : '') };
      if (m === 'first') return alvo.v[0] ?? NIL;
      if (m === 'last') return alvo.v[alvo.v.length - 1] ?? NIL;
      if (m === 'compact') return { k: 'arr', v: alvo.v.filter((x) => x.k !== 'nil') };
      if (m === 'flatten') return { k: 'arr', v: alvo.v.flatMap(lista) };
      if (m === 'push' || m === 'append') return alvo.v.push(...a), alvo;
      if (m === 'reduce' || m === 'inject') {
        const op = a.find((x) => x.k === 'sym');
        if (op && op.k === 'sym' && alvo.v.length) return alvo.v.slice(1).reduce((acc, x) => metodo(acc, op.v, [x]), alvo.v[0]);
      }
      return alvo;
    }
    if (alvo.k === 'hash') {
      if (m === 'fetch' || m === 'dig') return alvo.v.find(([k]) => texto(k) === texto(a[0] ?? NIL))?.[1] ?? desc(texto(a[0] ?? NIL));
      return alvo;
    }
    if (alvo.k === 'str') {
      if (/^(to_s|strip|to_str|freeze|squish)$/.test(m)) return alvo;
      if (m === 'upcase' || m === 'downcase') return { k: 'str', v: m === 'upcase' ? alvo.v.toUpperCase() : alvo.v.toLowerCase() };
      if (m === 'to_sym') return { k: 'sym', v: alvo.v };
      if (m === 'to_i') return { k: 'num', v: parseInt(alvo.v, 10) || 0 };
    }
    if (alvo.k === 'sym' && m === 'to_s') return { k: 'str', v: alvo.v };
    if (alvo.k === 'num') return m === 'to_s' ? { k: 'str', v: String(alvo.v) } : /^(to_i|to_f|abs|round|ceil|floor)$/.test(m) ? alvo : desc(m);
    if (alvo.k === 'lambda' && m === 'call') return chamarLambda(alvo, a[0]);
    if (alvo.k === 'desc') return alvo;
    if (alvo.k === 'cls') return construir(alvo.nome, m, a);
    if (alvo.k === 'nil') return NIL;
    if (/[?]$/.test(m)) return { k: 'bool', v: true };
    avisos.add(`Método ignorado: .${m}`);
    return alvo;
  };

  // Arel::Nodes::X.new(...), Arel::Table.new(...), Arel.sql(...)
  const construir = (cls: string, m: string, a: R[]): R => {
    const nome = cls.replace(/^::/, '');
    if (nome === 'Arel') {
      if (m === 'sql') return lit(texto(a[0] ?? NIL));
      if (m === 'star') return lit('*');
      return lit(texto(a[0] ?? NIL));
    }
    if (m === 'arel_table') return { k: 'tab', nome: snake(nome.split('::').pop()!) };
    if (nome === 'Arel::SelectManager' && m === 'new') return { k: 'sm', s: novaSM(a[0]?.k === 'tab' ? a[0] : undefined) };
    // métodos de classe desconhecidos (sanitize, helpers de data): repassa o primeiro argumento
    if (m !== 'new' && m !== 'build_quoted') return a[0] && (a[0].k === 'desc' || a[0].k === 'str') ? a[0] : desc(m);
    const c = nome.replace(/^Arel::(Nodes::)?/, '');
    const [x, y, z] = a;
    if (m === 'build_quoted' || c === 'Quoted' || c === 'Casted') return no('lit', () => sql(x ?? NIL));
    switch (c) {
      case 'Table': {
        const as = a.find((v) => v.k === 'hash');
        const alias = as && as.k === 'hash' ? as.v.find(([k]) => texto(k) === 'as')?.[1] : undefined;
        const n = texto(x ?? NIL);
        const al = alias ? texto(alias) : undefined;
        return { k: 'tab', nome: n, alias: al && al !== n ? al : undefined };
      }
      case 'SqlLiteral':
        return lit(texto(x ?? NIL));
      case 'NamedFunction': {
        const f = fn(texto(x ?? NIL), lista(y));
        return z && z.k !== 'nil' ? metodoNo(f, 'as', [z])! : f;
      }
      case 'Count':
      case 'Sum':
      case 'Max':
      case 'Min':
      case 'Avg': {
        const f = fn(AGREGA[c], lista(x), y?.k === 'bool' && y.v);
        return z && z.k !== 'nil' ? metodoNo(f, 'as', [z])! : f;
      }
      case 'Grouping':
        return grupo(x ?? NIL);
      case 'And':
        return e(lista(x));
      case 'Or':
        return no('or', () => `${sql(x ?? NIL)} OR ${sql(y ?? NIL)}`);
      case 'Not':
        return metodoNo(x ?? NIL, 'not', [])!;
      case 'Case':
        return caso(x);
      case 'As':
        return no('as', () => `${sql(x ?? NIL)} AS ${texto(y ?? NIL)}`);
      case 'Between':
        return no('bin', () => `${sql(x ?? NIL)} BETWEEN ${sql(y ?? NIL)}`);
      case 'Equality':
        return metodoNo(x ?? NIL, 'eq', [y ?? NIL])!;
      case 'NotEqual':
        return metodoNo(x ?? NIL, 'not_eq', [y ?? NIL])!;
      case 'In':
        return emLista(x ?? NIL, y ?? NIL, false);
      case 'Addition':
        return bin(x ?? NIL, '+', y ?? NIL);
      case 'Subtraction':
        return bin(x ?? NIL, '-', y ?? NIL);
      case 'Multiplication':
        return bin(x ?? NIL, '*', y ?? NIL);
      case 'Division':
        return bin(x ?? NIL, '/', y ?? NIL);
      case 'InfixOperation':
        return bin(y ?? NIL, texto(x ?? NIL), z ?? NIL);
      case 'Exists':
        return x?.k === 'sm' ? metodoSM(x.s, 'exists', [])! : no('exists', () => `EXISTS (${sql(x ?? NIL)})`);
      case 'Union':
      case 'UnionAll':
        return uniao(x ?? NIL, y ?? NIL, c === 'Union' ? 'UNION' : 'UNION ALL');
      case 'TableAlias':
        return { k: 'alias', fonte: x ?? NIL, nome: texto(y ?? NIL) };
      case 'Window':
        return janela();
      case 'Preceding':
      case 'Following':
        return lit(`${x ? sql(x) : 'UNBOUNDED'} ${c.toUpperCase()}`);
      case 'CurrentRow':
        return lit('CURRENT ROW');
      case 'Rows':
        return lit(`ROWS ${x ? texto(x) : ''}`.trim());
      case 'Matches':
        return matches(x ?? NIL, y ?? NIL, a[3]?.k === 'bool' && a[3].v, z);
    }
    if (!nome.startsWith('Arel')) return desc(nome.split('::').pop()!);
    avisos.add(`Nó não suportado: ${nome}`);
    return fn(c, a);
  };

  // helpers do BaseQuery e chamadas sem receptor
  const chamar = (nome: string, a: R[], bloco?: R): R => {
    const [x, y, z] = a;
    const n = (v?: R) => v ?? NIL;
    switch (nome) {
      case 'left_join':
        return { k: 'cls', nome: 'OuterJoin' };
      case 'inner_join':
        return { k: 'cls', nome: 'InnerJoin' };
      case 'lateral_join':
        return { k: 'cls', nome: 'LateralJoin' };
      case 'function':
        return construir('NamedFunction', 'new', a);
      case 'rounddec':
        return fn('udf_rounddec', [n(x), n(y)]);
      case 'coalesce':
        return fn('coalesce', a);
      case 'list': {
        const sep = !y ? lit("', '") : texto(y) === '\\n' ? lit('udf_chr(13)') : lit(quoteStr(texto(y)));
        const col = z?.k === 'bool' && z.v ? lit('distinct ' + sql(n(x))) : n(x);
        return fn('array_to_string', [fn('array_agg', [col]), sep]);
      }
      case 'sum':
        return fn('sum', [n(x)]);
      case 'count':
        return construir('Count', 'new', [{ k: 'arr', v: [n(x)] }, n(y), n(z)]);
      case 'maximum':
      case 'minimum':
      case 'average':
        return fn(AGREGA[nome], a);
      case 'addition':
      case 'subtraction':
      case 'multiplication':
      case 'division': {
        const op = { addition: '+', subtraction: '-', multiplication: '*', division: '/' }[nome];
        return a.slice(1).reduce((acc, v) => bin(acc, op, v), n(x));
      }
      case 'cast': {
        const tipo = texto(n(y)) === 'double' ? 'double precision' : texto(n(y));
        return no('fn', () => `cast(${sql(n(x))} AS ${tipo})`);
      }
      case 'cast_value': {
        const tipo = texto(n(y)) === 'double' ? 'double precision' : texto(n(y));
        return no('fn', () => `cast(${texto(n(x))} as ${tipo})`);
      }
      case 'casewhen':
        return metodo(caso(), 'when', [n(x), n(y)]);
      case 'quote':
        return lit(sql(n(x)));
      case 'between':
        return no('bin', () => `${sql(n(x))} BETWEEN ${sql(n(y))} AND ${sql(n(z))}`);
      case 'literal':
        return lit(y?.k === 'bool' && y.v ? sql(n(x)) : texto(n(x)));
      case 'today':
        return no('fn', () => `cast('TODAY' AS date)`);
      case 'digits':
        return lit(`regexp_replace(${sql(n(x))}, '[^0-9]*', '', 'g')`);
      case 'binary_to_text':
        return lit(`convert_from(${sql(n(x))}, 'WIN1252')`);
      case 'grouping':
        return grupo(n(x));
      case 'union':
      case 'union_all': {
        const u = (l: R[]): R => (l.length < 2 ? n(l[0]) : uniao(l[0], u(l.slice(1)), nome === 'union' ? 'UNION' : 'UNION ALL'));
        return u(a);
      }
      case 'abs':
      case 'trim':
      case 'nullif':
        return fn(nome, a);
      case 'concat':
      case 'lpad':
        return fn(nome, a.flatMap(lista));
      case 'boolean':
        return n(x);
      case 'position':
        return lit(`position(${texto(n(x))} in ${texto(n(y))})`);
      case 'calc_interval':
        return lit(`${texto(n(x))} ${z?.k === 'bool' && !z.v ? '-' : '+'} cast(${sql(n(y))} as interval)`);
      case 'column_to_s':
        return { k: 'str', v: sql(n(x)) };
      case 'date_part':
      case 'date_trunc':
        return fn(nome, [n(y), n(x)]);
      case 'pg_format':
        return fn('format', a);
      case 'json_build_object':
        return fn('json_build_object', x?.k === 'hash' ? x.v.flatMap(([k, v]) => [lit(quoteStr(texto(k))), v]) : a);
      case 'infix_operation':
        return bin(n(x), texto(n(y)), n(z));
      case 'not_node':
        return metodoNo(n(x), 'not', [])!;
      case 'window': {
        const h = x?.k === 'hash' ? x.v : [];
        const opc = (k: string) => h.find(([c]) => texto(c) === k)?.[1];
        const w = janela();
        const p = (w.n as No & { partes: { part: R[]; ordem: R[] } }).partes;
        p.part.push(...lista(opc('partition')));
        p.ordem.push(...lista(opc('order')));
        return metodoNo(fn(texto(opc('function_name') ?? NIL), lista(opc('columns'))), 'over', [w])!;
      }
      case 'lambda':
      case 'proc':
        return bloco ?? NIL;
      case 'nil?':
        return { k: 'bool', v: false };
    }
    if (escopo.has(nome)) return escopo.get(nome)!;
    if (tabelas.has(nome)) return tabelas.get(nome)!;
    const d = chamarDef(nome, a);
    if (d) return d;
    if (a.length || bloco) return desc(nome);
    return { k: 'tab', nome, incerto: true };
  };

  // ---------- expressões ----------

  const comecaArg = (k = i) => {
    const x = tk[k];
    if (!x || !x.esp || x.t === 'nl') return false;
    if (x.t === 'id') return !KEYWORDS.has(x.v);
    if (['str', 'num', 'sym', 'label', 'ivar', 'const'].includes(x.t)) return true;
    return x.t === 'op' && (x.v === '[' || x.v === '->' || x.v === '*' || x.v === '!') && !tk[k + 1]?.esp;
  };

  const argumentos = (fecha: string | null): R[] => {
    const a: R[] = [];
    const hash: [R, R][] = [];
    const fim = () => (fecha ? ver(fecha) : fimCmd() || (tk[i].t === 'id' && KEYWORDS.has(tk[i].v)));
    while (!fim()) {
      if (i >= tk.length) throw new Error(`Faltou "${fecha}"`);
      if (tk[i].t === 'nl') {
        i++;
        continue;
      }
      if (tk[i].t === 'label') {
        const k: R = { k: 'sym', v: tk[i++].v };
        hash.push([k, expr()]);
      } else if (ver('*') || ver('**')) {
        i++;
        a.push(...lista(expr()));
      } else if (ver('&')) {
        i++;
        expr();
      } else {
        const v = expr();
        if (ver('=>')) {
          i++;
          hash.push([v, expr()]);
        } else a.push(v);
      }
      if (!fim()) pegar(',');
    }
    if (fecha) i++;
    if (hash.length) a.push({ k: 'hash', v: hash });
    return a;
  };

  const colecao = (fecha: string): R => {
    const itens: R[] = [];
    const hash: [R, R][] = [];
    while (!ver(fecha)) {
      if (i >= tk.length) throw new Error(`Faltou "${fecha}"`);
      if (tk[i].t === 'nl') {
        i++;
        continue;
      }
      if (tk[i].t === 'label') {
        const k: R = { k: 'sym', v: tk[i++].v };
        hash.push([k, expr()]);
      } else if (ver('*')) {
        i++;
        itens.push(...lista(expr()));
      } else {
        const v = expr();
        if (ver('=>')) {
          i++;
          hash.push([v, expr()]);
        } else itens.push(v);
      }
      while (tk[i]?.t === 'nl') i++;
      if (!ver(fecha)) pegar(',');
    }
    i++;
    return fecha === '}' ? { k: 'hash', v: hash } : { k: 'arr', v: itens };
  };

  const strDe = (x: Tk): { k: 'str'; v: string } => {
    const v = (x.partes ?? []).map((p) => (typeof p === 'string' ? p : texto(avaliarTrecho(p.codigo)))).join('');
    return { k: 'str', v };
  };

  const avaliarTrecho = (codigo: string): R => {
    try {
      const r = arelInterno(codigo);
      return r;
    } catch {
      return desc(codigo);
    }
  };

  // avalia #{...} com o mesmo escopo
  const arelInterno = (codigo: string): R => {
    const sub = tokens(codigo);
    const salvo = { i, tk: tk.splice(0, tk.length, ...sub) };
    i = 0;
    try {
      return expr();
    } finally {
      tk.splice(0, tk.length, ...salvo.tk);
      i = salvo.i;
    }
  };

  const primario = (): R => {
    const x = tk[i++];
    if (!x) throw new Error('Fim inesperado');
    switch (x.t) {
      case 'str': {
        let r = strDe(x);
        // "a" "b" concatena
        while (tk[i]?.t === 'str') r = { k: 'str', v: r.v + strDe(tk[i++]).v };
        return r;
      }
      case 'num':
        return { k: 'num', v: Number(x.v) };
      case 'sym':
        return { k: 'sym', v: x.v };
      case 'ivar':
        return escopo.get(x.v) ?? desc(x.v.replace(/^@+/, ''));
      case 'label':
        // hash sem chaves num argumento: foo a: 1
        i--;
        return { k: 'hash', v: argumentos(null).flatMap((h) => (h.k === 'hash' ? h.v : [])) };
      case 'const': {
        let nome = x.v;
        while (ver('::') && tk[i + 1]?.t === 'const') {
          nome += '::' + tk[i + 1].v;
          i += 2;
        }
        if (ver('[')) {
          i++;
          const k = expr();
          pegar(']');
          return desc(`${nome.split('::').pop()}_${texto(k)}`);
        }
        return { k: 'cls', nome };
      }
      case 'op':
        if (x.v === '(') {
          let v: R = NIL;
          while (!ver(')')) {
            if (i >= tk.length) throw new Error('Faltou ")"');
            if (tk[i].t === 'nl' || ver(';')) i++;
            else v = expr();
          }
          i++;
          return v;
        }
        if (x.v === '[') return colecao(']');
        if (x.v === '{') return colecao('}');
        if (x.v === '-' && tk[i]?.t === 'num') return { k: 'num', v: -Number(tk[i++].v) };
        if (x.v === '!' || x.v === '-') return unario(), desc('valor');
        if (x.v === '->') {
          const params: string[] = [];
          if (ver('(')) {
            i++;
            while (!ver(')')) {
              if (tk[i].t === 'id') params.push(tk[i].v);
              i++;
            }
            i++;
          }
          const b = lerBloco();
          return b && b.k === 'lambda' ? { ...b, params: params.length ? params : b.params } : NIL;
        }
        if (x.v === '::') return primario();
        throw new Error(`Inesperado "${x.v}"`);
      case 'id': {
        const nome = x.v;
        if (nome === 'nil') return NIL;
        if (nome === 'true' || nome === 'false') return { k: 'bool', v: nome === 'true' };
        if (nome === 'self') return { k: 'self' };
        if (nome === 'not') return unario(), desc('valor');
        if (nome === 'defined?') return argumentos(ver('(') ? (i++, ')') : null), { k: 'bool', v: true };
        if (ver('(') && !tk[i].esp) {
          i++;
          const a = argumentos(')');
          return chamar(nome, a, lerBloco());
        }
        if (!escopo.has(nome) && !tabelas.has(nome) && comecaArg()) return chamar(nome, argumentos(null), lerBloco());
        if (!escopo.has(nome) && (ver('{') || verId('do'))) return chamar(nome, [], lerBloco());
        return chamar(nome, []);
      }
    }
    throw new Error(`Inesperado "${x.v}"`);
  };

  const indice = (v: R, k: R): R => {
    if (v.k === 'tab' && v.incerto && PARAMS.test(v.nome)) return desc(texto(k));
    if (v.k === 'tab' || v.k === 'alias') {
      const ref = v.k === 'tab' ? (v.alias ?? v.nome) : v.nome;
      const col = ehNo(k, 'lit') ? sql(k) : texto(k);
      return no('attr', () => `${ref}.${col}`);
    }
    if (v.k === 'hash') return v.v.find(([c]) => texto(c) === texto(k))?.[1] ?? desc(texto(k));
    if (v.k === 'arr' && k.k === 'num') return v.v[k.v < 0 ? v.v.length + k.v : k.v] ?? NIL;
    if (v.k === 'desc') return desc(k.k === 'num' ? v.nome : texto(k));
    return desc(texto(k));
  };

  const posfixo = (): R => {
    let v = primario();
    for (;;) {
      if (ver('.') || ver('&.')) {
        i++;
        while (tk[i]?.t === 'nl') i++;
        const m = tk[i++]?.v ?? '';
        let a: R[] = [];
        if (ver('(')) {
          i++;
          a = argumentos(')');
        } else if (comecaArg() && !ver('[')) a = argumentos(null);
        const b = lerBloco();
        v = v.k === 'cls' ? construir(v.nome, m, a) : metodo(v, m, a, b);
      } else if (ver('::') && tk[i + 1]?.t === 'id') {
        i++;
        const m = tk[i++].v;
        const a = ver('(') ? (i++, argumentos(')')) : [];
        v = v.k === 'cls' ? construir(v.nome, m, a) : metodo(v, m, a);
      } else if (ver('[') && !tk[i].esp) {
        i++;
        const k = expr();
        pegar(']');
        v = indice(v, k);
      } else if (ver('{') || verId('do')) {
        // bloco solto depois de um valor: ignora
        lerBloco();
      } else return v;
    }
  };

  const unario = (): R => {
    if (ver('!') || verId('not')) {
      i++;
      unario();
      return { k: 'bool', v: false };
    }
    return posfixo();
  };

  const OPS: [string[], number][] = [
    [['||', 'or'], 1],
    [['&&', 'and'], 2],
    [['==', '!=', '===', '=~', '<=>'], 3],
    [['<', '>', '<=', '>='], 4],
    [['..', '...'], 5],
    [['<<', '|', '&'], 6],
    [['+', '-'], 7],
    [['*', '/', '%'], 8],
  ];
  const prec = (x?: Tk) => {
    if (!x || (x.t !== 'op' && x.t !== 'id')) return 0;
    if (x.t === 'id' && x.v !== 'or' && x.v !== 'and') return 0;
    return OPS.find(([l]) => l.includes(x.v))?.[1] ?? 0;
  };

  const binario = (min = 1): R => {
    let a = unario();
    for (;;) {
      const op = tk[i];
      const p = prec(op);
      if (!p || p < min) return a;
      // "foo -1" já foi tratado como argumento; aqui é operador
      i++;
      while (tk[i]?.t === 'nl') i++;
      const b = binario(p + 1);
      a = operar(a, op.v, b);
    }
  };

  const operar = (a: R, op: string, b: R): R => {
    const arel = (r: R) => r.k === 'no' || (r.k === 'tab' && !r.incerto) || r.k === 'alias';
    switch (op) {
      case '||':
      case 'or':
        return a.k === 'nil' || (a.k === 'bool' && !a.v) || a.k === 'desc' ? (a.k === 'desc' && b.k === 'nil' ? a : b) : a;
      case '&&':
      case 'and':
        return a.k === 'nil' || (a.k === 'bool' && !a.v) ? a : b;
      case '..':
      case '...':
        return { k: 'range', a, b };
      case '<<':
        if (a.k === 'arr') return a.v.push(b), a;
        if (a.k === 'str') return { k: 'str', v: a.v + texto(b) };
        return a;
      case '+':
        if (a.k === 'num' && b.k === 'num') return { k: 'num', v: a.v + b.v };
        if (a.k === 'str' && (b.k === 'str' || b.k === 'sym')) return { k: 'str', v: a.v + b.v };
        if (a.k === 'arr' && b.k === 'arr') return { k: 'arr', v: [...a.v, ...b.v] };
        if (arel(a)) return grupo(bin(a, '+', b));
        return desc(a.k === 'desc' ? a.nome : 'valor');
      case '-':
      case '*':
      case '/':
        if (a.k === 'num' && b.k === 'num') return { k: 'num', v: op === '-' ? a.v - b.v : op === '*' ? a.v * b.v : Math.trunc(a.v / b.v) };
        if (arel(a)) return op === '-' ? grupo(bin(a, op, b)) : bin(a, op, b);
        return desc(a.k === 'desc' ? a.nome : 'valor');
    }
    return { k: 'bool', v: true };
  };

  const expr = (): R => {
    const x = tk[i];
    // atribuição
    if (x && (x.t === 'id' || x.t === 'ivar') && tk[i + 1]?.t === 'op' && ['=', '||=', '+=', '-=', '<<=', '&&='].includes(tk[i + 1].v)) {
      const op = tk[i + 1].v;
      i += 2;
      while (tk[i]?.t === 'nl') i++;
      const v = expr();
      const ant = escopo.get(x.v);
      if (op === '=') escopo.set(x.v, v);
      else if (op === '||=') {
        if (!ant || ant.k === 'nil') escopo.set(x.v, v);
      } else if (op === '+=') escopo.set(x.v, ant ? operar(ant, '+', v) : v);
      return escopo.get(x.v)!;
    }
    // a, b = ...
    if (x?.t === 'id' && ver(',', i + 1) && tk[i + 2]?.t === 'id' && ver('=', i + 3)) {
      i += 4;
      return expr();
    }
    const v = binario();
    if (ver('=') || ver('||=') || ver('+=')) {
      // self.x = ..., h[:a] = ...
      i++;
      return expr();
    }
    if (ver('?')) {
      i++;
      const a = expr();
      while (tk[i]?.t === 'nl') i++;
      if (tk[i]?.t === 'label') {
        // a ? b:c tokenizado como label
        i++;
      } else pegar(':');
      const b = expr();
      return v.k === 'bool' && !v.v ? b : a;
    }
    return v;
  };

  // ---------- comandos ----------

  const comando = (): R => {
    const x = tk[i];
    if (x.t === 'id' && x.v === 'return') {
      i++;
      return fimCmd() ? NIL : expr();
    }
    if (x.t === 'id' && x.v === 'tables' && !ver('=', i + 1)) {
      i++;
      const a = ver('(') ? (i++, argumentos(')')) : argumentos(null);
      for (const t of a) {
        if (t.k === 'hash') for (const [k, v] of t.v) tabelas.set(texto(v), { k: 'tab', nome: texto(k), alias: texto(k) === texto(v) ? undefined : texto(v) });
        else tabelas.set(texto(t), { k: 'tab', nome: texto(t) });
      }
      return NIL;
    }
    if (x.t === 'id' && PULAR_LINHA.has(x.v) && !ver('=', i + 1) && !ver('.', i + 1)) {
      pularLinha();
      return NIL;
    }
    if (x.t === 'const' && ver('=', i + 1)) {
      pularLinha();
      return NIL;
    }
    const v = expr();
    // modificador: x if cond (assume verdadeiro)
    if (tk[i]?.t === 'id' && ['if', 'unless', 'while', 'until', 'rescue'].includes(tk[i].v)) pularLinha();
    return v;
  };

  // pula até o "end" do bloco atual (sem consumir)
  const pularAteEnd = () => {
    let n = 0;
    while (i < tk.length) {
      const x = tk[i];
      const inicio = i === 0 || tk[i - 1].t === 'nl' || ver(';', i - 1) || ver('=', i - 1);
      if (x.t === 'id' && !ver('.', i - 1) && !ver('&.', i - 1)) {
        if (['do', 'def', 'class', 'module', 'begin', 'case'].includes(x.v) || (inicio && ['if', 'unless', 'while', 'until'].includes(x.v))) n++;
        else if (x.v === 'end' && !n--) return;
      }
      i++;
    }
  };

  // executa comandos de ini até fim; condições contam como verdadeiras (só o primeiro ramo roda)
  const executar = (fim: number): R => {
    const pilha: { tipo: string; ramo: boolean }[] = [];
    let ultimo: R = NIL;
    while (i < fim) {
      const x = tk[i];
      if (x.t === 'nl' || ver(';')) {
        i++;
        continue;
      }
      if (x.t === 'id') {
        if (x.v === 'def') {
          const ini = i;
          i++;
          let nome = '';
          while (i < tk.length && tk[i].t !== 'nl' && !ver('(') && !ver(';')) nome += tk[i++].v;
          nome = nome.replace(/^self\./, '');
          const params: string[] = [];
          const lerParam = () => {
            if (tk[i].t === 'id' || tk[i].t === 'label') params.push(tk[i].v);
            while (i < tk.length && !ver(',') && !ver(')') && tk[i].t !== 'nl') ver('(') ? pularBalanceado() : i++;
            if (ver(',')) i++;
          };
          if (ver('(')) {
            i++;
            while (i < tk.length && !ver(')')) {
              if (ver('*') || ver('**') || ver('&')) i++;
              lerParam();
            }
            i++;
          } else while (i < tk.length && tk[i].t !== 'nl') lerParam();
          const corpo = i;
          i = ini;
          pularDo();
          defs.set(nome, { params, ini: corpo, fim: i - 1 });
          continue;
        }
        if (['class', 'module', 'begin', 'if', 'unless', 'while', 'until', 'case', 'for'].includes(x.v)) {
          i++;
          pularLinha();
          pilha.push({ tipo: x.v, ramo: false });
          continue;
        }
        if (['elsif', 'else', 'when', 'in', 'rescue', 'ensure'].includes(x.v)) {
          const topo = pilha[pilha.length - 1];
          // case: o primeiro when roda; if: o else/elsif não
          if (topo && topo.tipo === 'case' && !topo.ramo && x.v === 'when') {
            topo.ramo = true;
            pularLinha();
          } else if (topo && topo.tipo !== 'class' && topo.tipo !== 'module') pularAteEnd();
          else pularLinha();
          continue;
        }
        if (x.v === 'then' || x.v === 'do') {
          i++;
          continue;
        }
        if (x.v === 'end') {
          i++;
          pilha.pop();
          continue;
        }
      }
      const ini = i;
      ultimo = comando();
      if (i === ini) i++;
    }
    return ultimo;
  };

  const chamarDef = (nome: string, a: R[]): R | undefined => {
    const d = defs.get(nome);
    if (!d || pilhaDefs.includes(nome) || pilhaDefs.length > 20) return undefined;
    const salvo = [i, escopo] as const;
    escopo = new Map();
    d.params.forEach((p, k) => escopo.set(p, a[k] ?? { k: 'tab', nome: p, incerto: true }));
    pilhaDefs.push(nome);
    i = d.ini;
    try {
      return executar(d.fim);
    } finally {
      pilhaDefs.pop();
      [i, escopo] = salvo;
    }
  };

  executar(tk.length);
  for (const nome of defs.keys()) {
    const v = chamarDef(nome, []);
    if (v) saidas.push({ nome, v });
  }

  const consulta = (v: R) => v.k === 'sm' || v.k === 'alias' || ehNo(v, 'uniao');
  const render = (v: R): string => {
    if (v.k === 'sm') return montar(v.s);
    if (v.k === 'alias' && v.fonte.k === 'sm') return montar(v.fonte.s);
    if (ehNo(v, 'uniao')) return (v as { k: 'no'; n: No & { dentro: () => string } }).n.dentro();
    return sql(v);
  };
  const boas = saidas.filter((s) => consulta(s.v));
  let partes: string[];
  if (boas.length) partes = boas.map((s) => (boas.length > 1 ? `-- ${s.nome}\n` : '') + render(s.v));
  else {
    // sem def: pega as consultas que não foram usadas dentro de outra
    const sqls = todos.map((s) => [s, montar(s)] as const);
    partes = sqls.filter(([s]) => !s.usado && (s.projs.length || s.froms.length)).map(([, q]) => q);
  }
  if (!partes.length) throw new Error('Nenhuma consulta encontrada. Cole o trecho com tabela.project(...)...');
  return { sql: partes.join(';\n\n'), avisos: [...avisos] };
}

const snake = (s: string) =>
  s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/y$/, 'ie')
    .replace(/([^s])$/, '$1s');

// interpreta encadeamentos do Zend_Db_Select (ZF1) e monta o SQL que ele geraria

interface Tk {
  t: 'str' | 'num' | 'var' | 'id' | 'op';
  v: string;
  // string com aspas duplas/heredoc: interpola $variáveis
  interp?: boolean;
}

function tokens(s: string): Tk[] {
  const out: Tk[] = [];
  let i = 0;
  const resto = () => s.slice(i);
  while (i < s.length) {
    const c = s[i];
    let m: RegExpExecArray | null;
    if (/\s/.test(c)) i++;
    else if ((m = /^<\?(php)?|^\?>/.exec(resto()))) i += m[0].length;
    else if ((c === '/' && s[i + 1] === '/') || c === '#') while (i < s.length && s[i] !== '\n') i++;
    else if (c === '/' && s[i + 1] === '*') {
      const f = s.indexOf('*/', i + 2);
      i = f < 0 ? s.length : f + 2;
    } else if ((m = /^<<<\s*(['"]?)(\w+)\1\r?\n([\s\S]*?)\r?\n\s*\2\b/.exec(resto()))) {
      out.push({ t: 'str', v: m[3], interp: m[1] !== "'" });
      i += m[0].length;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      let v = '';
      while (j < s.length && s[j] !== c) {
        if (s[j] === '\\' && j + 1 < s.length) {
          const e = s[++j];
          if (c === "'") v += e === "'" || e === '\\' ? e : '\\' + e;
          else v += ({ n: '\n', t: '\t', r: '\r' } as Record<string, string>)[e] ?? (e === '$' ? '\\$' : e);
        } else v += s[j];
        j++;
      }
      out.push({ t: 'str', v, interp: c === '"' });
      i = j + 1;
    } else if ((m = /^\d+(\.\d+)?/.exec(resto()))) {
      out.push({ t: 'num', v: m[0] });
      i += m[0].length;
    } else if ((m = /^\$\w+/.exec(resto()))) {
      out.push({ t: 'var', v: m[0].slice(1) });
      i += m[0].length;
    } else if ((m = /^\\?[A-Za-z_][\w\\]*/.exec(resto()))) {
      out.push({ t: 'id', v: m[0].replace(/^\\/, '') });
      i += m[0].length;
    } else {
      m = /^(->|::|=>|\.=|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\+\+|--)/.exec(resto());
      out.push({ t: 'op', v: m ? m[0] : c });
      i += m ? m[0].length : 1;
    }
  }
  return out;
}

type V =
  | { k: 'txt'; v: string }
  | { k: 'num'; v: number }
  | { k: 'nulo' }
  | { k: 'bool'; v: boolean }
  | { k: 'arr'; itens: [V | null, V][] }
  | { k: 'expr'; sql: string }
  | { k: 'sel'; s: Sel }
  | { k: 'desc'; nome: string };

interface Tabela {
  tipo: string;
  nome: V;
  corr: string;
  cond?: string;
  schema?: string;
}

interface Sel {
  distinct: boolean;
  cols: { corr: string; col: V; alias?: string }[];
  from: Tabela[];
  where: string[];
  group: string[];
  having: string[];
  order: string[];
  limit?: [string, string];
  union?: { tipo: string; partes: V[] };
  forUpdate: boolean;
  usado: boolean;
}

const novoSel = (): Sel => ({ distinct: false, cols: [], from: [], where: [], group: [], having: [], order: [], forUpdate: false, usado: false });
const desc = (nome: string): V => ({ k: 'desc', nome: nome.replace(/\W+/g, '_') || 'valor' });
const NULO: V = { k: 'nulo' };

// ZF1 Zend_Db_Select::assemble, sem aspas nos identificadores
function montarSql(s: Sel): string {
  if (s.union) return s.union.partes.map(sqlDe).join(`\n${s.union.tipo}\n`) + ordemLimite(s);
  let sql = 'SELECT ' + (s.distinct ? 'DISTINCT ' : '');
  sql += s.cols.length ? s.cols.map(coluna).join(', ') : '*';
  s.from.forEach((t, i) => {
    const nome = t.nome.k === 'sel' ? `(\n${sqlDe(t.nome)}\n)` : (t.schema ? t.schema + '.' : '') + sqlDe(t.nome);
    const fonte = nome === t.corr ? nome : `${nome} AS ${t.corr}`;
    sql += i === 0 ? `\nFROM ${fonte}` : t.tipo === 'FROM' ? `, ${fonte}` : `\n${t.tipo} ${fonte}${t.cond ? ' ON ' + t.cond : ''}`;
  });
  if (s.where.length) sql += '\nWHERE ' + s.where.join(' ');
  if (s.group.length) sql += '\nGROUP BY ' + s.group.join(', ');
  if (s.having.length) sql += '\nHAVING ' + s.having.join(' ');
  return sql + ordemLimite(s) + (s.forUpdate ? '\nFOR UPDATE' : '');
}

function ordemLimite(s: Sel) {
  let sql = s.order.length ? '\nORDER BY ' + s.order.join(', ') : '';
  if (s.limit) sql += `\nLIMIT ${s.limit[0]}` + (s.limit[1] && s.limit[1] !== '0' ? ` OFFSET ${s.limit[1]}` : '');
  return sql;
}

function coluna(c: Sel['cols'][number]) {
  let sql: string;
  if (c.col.k === 'txt' && !/\(.*\)/s.test(c.col.v)) {
    sql = c.corr && !c.col.v.includes('.') ? `${c.corr}.${c.col.v}` : c.col.v;
  } else sql = c.col.k === 'sel' ? `(${sqlDe(c.col)})` : sqlDe(c.col);
  return c.alias ? `${sql} AS ${c.alias}` : sql;
}

// texto do valor dentro do SQL (sem aspas)
function sqlDe(v: V): string {
  switch (v.k) {
    case 'txt':
      return v.v;
    case 'num':
      return String(v.v);
    case 'nulo':
      return 'NULL';
    case 'bool':
      return v.v ? '1' : '0';
    case 'expr':
      return v.sql;
    case 'sel':
      v.s.usado = true;
      return montarSql(v.s);
    case 'arr':
      return v.itens.map(([, x]) => sqlDe(x)).join(', ');
    case 'desc':
      return ':' + v.nome;
  }
}

// $db->quote()
function quote(v: V, tipo?: V): string {
  if (tipo && tipo.k === 'desc' && /INT/.test(tipo.nome) && v.k === 'txt') return String(parseInt(v.v, 10) || 0);
  if (v.k === 'txt') return `'${v.v.replace(/'/g, "''")}'`;
  if (v.k === 'arr') return v.itens.map(([, x]) => quote(x, tipo)).join(', ');
  if (v.k === 'bool') return v.v ? '1' : '0';
  return sqlDe(v);
}

const quoteInto = (texto: string, v: V, tipo?: V) => texto.split('?').join(quote(v, tipo));

function separar(nome: V): { nome: V; corr: string } {
  if (nome.k === 'arr' && nome.itens.length) {
    const [k, v] = nome.itens[0];
    const corr = k && k.k === 'txt' ? k.v : '';
    return { nome: v, corr: corr || separar(v).corr };
  }
  if (nome.k === 'txt') {
    const m = /^(.+?)\s+AS\s+(.+)$/i.exec(nome.v.trim());
    if (m) return { nome: { k: 'txt', v: m[1] }, corr: m[2] };
    return { nome, corr: nome.v.split('.').pop()! };
  }
  return { nome, corr: 't' };
}

function corrUnica(s: Sel, base: string) {
  let c = base;
  for (let n = 2; s.from.some((t) => t.corr === c); n++) c = `${base}_${n}`;
  return c;
}

function addCols(s: Sel, cols: V | undefined, corr: string) {
  if (!cols) cols = { k: 'txt', v: '*' };
  const lista: [V | null, V][] = cols.k === 'arr' ? cols.itens : [[null, cols]];
  for (const [k, col] of lista) {
    let alias = k && k.k === 'txt' ? k.v : undefined;
    let c = corr;
    let v = col;
    if (col.k === 'txt' && !/\(.*\)/s.test(col.v)) {
      let t = col.v.trim();
      const m = /^(.+?)\s+AS\s+(.+)$/i.exec(t);
      if (m) {
        t = m[1];
        alias = m[2];
      }
      const p = /^(.+)\.(.+)$/.exec(t);
      if (p) {
        c = p[1];
        t = p[2];
      }
      v = { k: 'txt', v: t };
    } else if (col.k !== 'txt') c = '';
    s.cols.push({ corr: c, col: v, alias });
  }
}

const JOINS: Record<string, string> = {
  join: 'INNER JOIN',
  joininner: 'INNER JOIN',
  joinleft: 'LEFT JOIN',
  joinright: 'RIGHT JOIN',
  joinfull: 'FULL JOIN',
  joincross: 'CROSS JOIN',
  joinnatural: 'NATURAL JOIN',
};

const METODOS_SEL = new Set(['from', 'columns', 'where', 'orwhere', 'having', 'orhaving', 'group', 'order', 'distinct', 'limit', 'limitpage', 'union', 'forupdate', 'reset', 'assemble', '__tostring', ...Object.keys(JOINS)]);

function metodoSel(s: Sel, m: string, a: V[], avisos: Set<string>): V {
  const txt = (v: V | undefined) => (v ? sqlDe(v) : '');
  const nm = m.toLowerCase();
  const ret: V = { k: 'sel', s };
  const condicao = (lista: string[], ou: boolean) => {
    let c = a[0] ? (a[0].k === 'sel' ? montarSql(a[0].s) : txt(a[0])) : '';
    if (a.length > 1 && a[1].k !== 'nulo') c = quoteInto(c, a[1], a[2]);
    lista.push((lista.length ? (ou ? 'OR ' : 'AND ') : '') + `(${c})`);
  };
  if (nm === 'from' || nm in JOINS) {
    const temCond = nm !== 'from' && nm !== 'joincross' && nm !== 'joinnatural';
    const { nome, corr } = separar(a[0] ?? NULO);
    if (nome.k === 'sel') nome.s.usado = true;
    const c = corrUnica(s, corr || 't');
    const cols = temCond ? a[2] : a[1];
    const schema = temCond ? a[3] : a[2];
    const t: Tabela = { tipo: JOINS[nm] ?? 'FROM', nome, corr: c, cond: temCond ? txt(a[1]) : undefined, schema: schema && schema.k === 'txt' ? schema.v : undefined };
    // ZF1 põe o FROM antes dos JOINs mesmo chamado depois
    if (nm === 'from') s.from.splice(s.from.filter((x) => x.tipo === 'FROM').length, 0, t);
    else s.from.push(t);
    addCols(s, cols, c);
  } else if (nm === 'columns') addCols(s, a[0], a[1] ? txt(a[1]) : (s.from[0]?.corr ?? ''));
  else if (nm === 'where') condicao(s.where, false);
  else if (nm === 'orwhere') condicao(s.where, true);
  else if (nm === 'having') condicao(s.having, false);
  else if (nm === 'orhaving') condicao(s.having, true);
  else if (nm === 'group' || nm === 'order') {
    const lista = nm === 'group' ? s.group : s.order;
    const v = a[0] ?? NULO;
    const itens = v.k === 'arr' ? v.itens.map(([, x]) => x) : v.k === 'txt' && !/\(/.test(v.v) ? v.v.split(',').map((x): V => ({ k: 'txt', v: x.trim() })) : [v];
    lista.push(...itens.map(txt).filter(Boolean));
  } else if (nm === 'distinct') s.distinct = !a[0] || !(a[0].k === 'bool' && !a[0].v);
  else if (nm === 'limit') s.limit = [txt(a[0]) || '0', txt(a[1]) || '0'];
  else if (nm === 'limitpage') {
    const pag = a[0]?.k === 'num' ? a[0].v : NaN;
    const qtd = a[1]?.k === 'num' ? a[1].v : NaN;
    s.limit = [txt(a[1]), isNaN(pag * qtd) ? `(${txt(a[0])} - 1) * ${txt(a[1])}` : String((Math.max(pag, 1) - 1) * qtd)];
  } else if (nm === 'union') {
    const partes = a[0]?.k === 'arr' ? a[0].itens.map(([, x]) => x) : [];
    partes.forEach((p) => p.k === 'sel' && (p.s.usado = true));
    const tipo = a[1] && a[1].k === 'desc' && /ALL/.test(a[1].nome) ? 'UNION ALL' : a[1]?.k === 'txt' ? a[1].v : 'UNION';
    s.union = { tipo, partes };
  } else if (nm === 'forupdate') s.forUpdate = !a[0] || !(a[0].k === 'bool' && !a[0].v);
  else if (nm === 'reset') {
    const p = a[0] ? (a[0].k === 'txt' ? a[0].v : a[0].k === 'desc' ? a[0].nome : '') : '';
    const n = p.toLowerCase();
    if (!p) Object.assign(s, { ...novoSel(), usado: s.usado });
    else if (n === 'columns') s.cols = [];
    else if (n === 'where' || n === 'having' || n === 'order' || n === 'group') s[n] = [];
    else if (n === 'from') s.from = [];
    else if (n.startsWith('limit')) s.limit = undefined;
    else if (n === 'distinct') s.distinct = false;
  } else if (nm === 'assemble' || nm === '__tostring') return { k: 'txt', v: montarSql(s) };
  else avisos.add(`Método ignorado: ${m}()`);
  return ret;
}

function clonar(s: Sel): Sel {
  return { ...s, cols: [...s.cols], from: [...s.from], where: [...s.where], group: [...s.group], having: [...s.having], order: [...s.order], usado: false };
}

export interface ResultadoBuilder {
  sql: string;
  avisos: string[];
}

export function zendParaSql(codigo: string): ResultadoBuilder {
  const tk = tokens(codigo);
  let i = 0;
  const vars = new Map<string, V>();
  const sels: Sel[] = [];
  const avisos = new Set<string>();
  const ver = (v: string) => tk[i]?.t === 'op' && tk[i].v === v;
  const verId = (v: string) => tk[i]?.t === 'id' && tk[i].v.toLowerCase() === v;
  const pegar = (v: string) => {
    if (!ver(v)) throw new Error(`Esperado "${v}" perto de "${tk[i]?.v ?? 'fim'}"`);
    i++;
  };
  // pula (...), [...] ou {...} balanceado
  const pularBloco = () => {
    const abre = tk[i].v;
    const fecha = ({ '(': ')', '[': ']', '{': '}' } as Record<string, string>)[abre];
    let n = 0;
    do {
      if (ver(abre)) n++;
      else if (ver(fecha)) n--;
      i++;
    } while (n > 0 && i < tk.length);
  };

  const interp = (s: string): V => {
    if (!/\$\w|\{\$/.test(s)) return { k: 'txt', v: s.replace(/\\\$/g, '$') };
    const v = s
      .replace(/\{\$(\w+)[^}]*\}|\$(\w+)(?:->(\w+))?/g, (_, a, b, c) => {
        const x = vars.get(a ?? b);
        if (x && x.k !== 'desc' && !c) return x.k === 'sel' ? montarSql(x.s) : sqlDe(x);
        return ':' + (c ?? a ?? b);
      })
      .replace(/\\\$/g, '$');
    return { k: 'txt', v };
  };

  const args = (): V[] => {
    pegar('(');
    const a: V[] = [];
    while (!ver(')')) {
      if (i >= tk.length) throw new Error('Faltou ")"');
      a.push(expr());
      if (!ver(')')) pegar(',');
    }
    i++;
    return a;
  };

  const arr = (fecha: string): V => {
    const itens: [V | null, V][] = [];
    while (!ver(fecha)) {
      if (i >= tk.length) throw new Error(`Faltou "${fecha}"`);
      let k: V | null = null;
      let v = expr();
      if (ver('=>')) {
        i++;
        k = v;
        v = expr();
      }
      itens.push([k, v]);
      if (!ver(fecha)) pegar(',');
    }
    i++;
    return { k: 'arr', itens };
  };

  const nomeDe = (base: V, metodo?: string, a: V[] = []): string => {
    if (metodo && /^get[A-Z_]/.test(metodo)) return metodo.slice(3, 4).toLowerCase() + metodo.slice(4);
    const b = base.k === 'desc' && base.nome !== 'this' ? base.nome : (metodo ?? 'valor');
    return a[0]?.k === 'txt' || a[0]?.k === 'num' ? `${b}_${sqlDe(a[0])}` : b;
  };

  // chamada de método em algo que não é select: adapter, $this, objetos de negócio
  const metodoOutro = (base: V, m: string, a: V[]): V => {
    const nm = m.toLowerCase();
    if (nm === 'select') {
      const s = novoSel();
      sels.push(s);
      return { k: 'sel', s };
    }
    if (nm === 'quote') return { k: 'expr', sql: quote(a[0] ?? NULO, a[1]) };
    if (nm === 'quoteinto') return { k: 'txt', v: quoteInto(a[0] ? sqlDe(a[0]) : '', a[1] ?? NULO, a[2]) };
    if (nm === 'quoteidentifier' || nm === 'quotetableas' || nm === 'quotecolumnas') return { k: 'txt', v: a[0] ? sqlDe(a[0]) : '' };
    if (/^(fetch\w*|query)$/.test(nm) && a[0]?.k === 'sel') return a[0];
    if (/adapter$/.test(nm) || nm === 'getdb') return { k: 'desc', nome: 'db' };
    return desc(nomeDe(base, m, a));
  };

  const primario = (): V => {
    const x = tk[i++];
    if (!x) throw new Error('Fim inesperado');
    if (x.t === 'str') return x.interp ? interp(x.v) : { k: 'txt', v: x.v };
    if (x.t === 'num') return { k: 'num', v: Number(x.v) };
    if (x.t === 'var') {
      if (x.v === 'this') return { k: 'desc', nome: 'this' };
      return vars.get(x.v) ?? desc(x.v);
    }
    if (x.t === 'op') {
      if (x.v === '[') return arr(']');
      if (x.v === '(') {
        // cast: (int) $x
        if (tk[i]?.t === 'id' && tk[i + 1]?.v === ')' && /^(int|integer|string|float|bool|array|object)$/i.test(tk[i].v)) {
          i += 2;
          return unario();
        }
        const v = expr();
        pegar(')');
        return v;
      }
      if (x.v === '-' || x.v === '+') {
        const v = unario();
        return x.v === '-' && v.k === 'num' ? { k: 'num', v: -v.v } : v;
      }
      if (x.v === '!' || x.v === '@' || x.v === '&') return unario();
      throw new Error(`Inesperado "${x.v}"`);
    }
    const n = x.v.toLowerCase();
    if (n === 'array' && ver('(')) return i++, arr(')');
    if (n === 'true' || n === 'false') return { k: 'bool', v: n === 'true' };
    if (n === 'null') return NULO;
    if (n === 'clone') {
      const v = unario();
      if (v.k !== 'sel') return v;
      const s = clonar(v.s);
      sels.push(s);
      return { k: 'sel', s };
    }
    if (n === 'new') {
      const cls = tk[i++]?.v ?? '';
      const a = ver('(') ? args() : [];
      if (/Db_Expr$|Db\\Sql\\Expression$/i.test(cls)) return { k: 'expr', sql: a[0] ? sqlDe(a[0]) : '' };
      if (/Db_Select$/i.test(cls)) {
        const s = novoSel();
        sels.push(s);
        return { k: 'sel', s };
      }
      return desc(cls.split(/[\\_]/).pop()!);
    }
    if (n === 'function' || n === 'fn') {
      while (i < tk.length && !ver('{') && !ver('=>')) i++;
      if (ver('{')) pularBloco();
      else i++, expr();
      return desc('funcao');
    }
    if (ver('::')) {
      i++;
      const nome = tk[i++]?.v ?? '';
      if (ver('(')) return metodoOutro(desc(x.v), nome, args());
      return desc(nome);
    }
    if (ver('(')) {
      const a = args();
      return desc(a[0] && a[0].k === 'desc' ? a[0].nome : x.v);
    }
    return desc(x.v);
  };

  const posfixo = (): V => {
    let v = primario();
    for (;;) {
      if (ver('->') || (ver('?') && tk[i + 1]?.v === '->')) {
        if (ver('?')) i++;
        i++;
        const m = tk[i++]?.v ?? '';
        if (ver('(')) {
          const a = args();
          if (v.k === 'sel' && (METODOS_SEL.has(m.toLowerCase()) || /^join/i.test(m))) v = metodoSel(v.s, m, a, avisos);
          else v = metodoOutro(v, m, a);
        } else v = v.k === 'desc' && v.nome === 'this' ? desc(m) : desc(nomeDe(v, m));
      } else if (ver('::')) {
        i++;
        const m = tk[i++]?.v ?? '';
        v = ver('(') ? metodoOutro(v, m, args()) : desc(m);
      } else if (ver('[')) {
        i++;
        if (ver(']')) {
          i++;
          continue;
        }
        const k = expr();
        pegar(']');
        if (v.k === 'arr') v = v.itens.find(([c]) => c && sqlDe(c) === sqlDe(k))?.[1] ?? desc(sqlDe(k));
        else v = desc(k.k === 'txt' ? k.v : nomeDe(v));
      } else if (ver('++') || ver('--')) i++;
      else return v;
    }
  };

  const unario = (): V => posfixo();

  // . concatena; aritmética e lógica só avaliam (os lados podem mexer no select)
  const BINARIOS = new Set(['.', '+', '-', '*', '/', '%', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '??', 'and', 'or', 'instanceof']);
  const binario = (): V => {
    let v = unario();
    for (;;) {
      const op = tk[i];
      if (!op || !((op.t === 'op' || op.t === 'id') && BINARIOS.has(op.v.toLowerCase()))) return v;
      i++;
      const d = unario();
      if (op.v === '.') v = { k: 'txt', v: (v.k === 'txt' ? v.v : v.k === 'sel' ? montarSql(v.s) : sqlDe(v)) + (d.k === 'txt' ? d.v : d.k === 'sel' ? montarSql(d.s) : sqlDe(d)) };
      else if (op.v === '??') v = v.k === 'desc' || v.k === 'nulo' ? d : v;
      else if (v.k === 'num' && d.k === 'num' && '+-*'.includes(op.v)) v = { k: 'num', v: op.v === '+' ? v.v + d.v : op.v === '-' ? v.v - d.v : v.v * d.v };
      else v = desc(v.k === 'desc' ? v.nome : 'valor');
    }
  };

  const expr = (): V => {
    if (tk[i]?.t === 'var' && tk[i + 1]?.t === 'op' && (tk[i + 1].v === '=' || tk[i + 1].v === '.=')) {
      const nome = tk[i].v;
      const op = tk[i + 1].v;
      i += 2;
      const v = expr();
      const ant = vars.get(nome);
      vars.set(nome, op === '=' ? v : { k: 'txt', v: (ant ? sqlDe(ant) : '') + sqlDe(v) });
      return v;
    }
    const v = binario();
    if (ver('=') || ver('.=') || ver('+=')) {
      // $a['x'] = ..., $obj->p = ...
      i++;
      return expr();
    }
    if (ver('?')) {
      i++;
      const a = ver(':') ? v : expr();
      pegar(':');
      expr();
      return a;
    }
    return v;
  };

  const CONTROLE = new Set(['if', 'elseif', 'while', 'foreach', 'for', 'switch', 'catch']);
  const PULAR = new Set(['else', 'try', 'finally', 'do', 'echo', 'print', 'return', 'throw', 'public', 'private', 'protected', 'static', 'final', 'abstract']);
  while (i < tk.length) {
    const x = tk[i];
    if (x.t === 'op' && (x.v === ';' || x.v === '{' || x.v === '}' || x.v === ':')) i++;
    else if (x.t === 'id' && CONTROLE.has(x.v.toLowerCase())) {
      i++;
      if (ver('(')) pularBloco();
    } else if (x.t === 'id' && PULAR.has(x.v.toLowerCase())) i++;
    else if (x.t === 'id' && /^(case|default)$/i.test(x.v)) {
      while (i < tk.length && !ver(':')) i++;
      i++;
    } else if (x.t === 'id' && /^(function|class|interface|trait|namespace|use)$/i.test(x.v) && !(x.v === 'function' && tk[i + 1]?.v === '(')) {
      while (i < tk.length && !ver('{') && !ver(';')) {
        if (ver('(')) pularBloco();
        else i++;
      }
      i++;
    } else {
      const ini = i;
      expr();
      if (i === ini) i++;
    }
  }

  const finais = sels.filter((s) => !s.usado && (s.from.length || s.cols.length || s.union));
  if (!finais.length) throw new Error('Nenhum select encontrado. Cole o trecho com ->select()->from(...).');
  return { sql: finais.map(montarSql).join(';\n\n'), avisos: [...avisos] };
}

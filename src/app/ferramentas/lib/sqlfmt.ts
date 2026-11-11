type Tipo = 'pal' | 'str' | 'num' | 'cmt' | 'cmtl' | 'op' | '(' | ')' | ',' | ';' | '.';
interface Tok {
  t: Tipo;
  v: string;
  colado: boolean; // sem espaço antes no original
}

export const PALAVRAS = new Set(
  `ADD ALL ALTER AND ANY AS ASC BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONSTRAINT CREATE CROSS CURRENT_DATE
  CURRENT_TIMESTAMP DATABASE DEFAULT DELETE DESC DISTINCT DO DROP ELSE END ESCAPE EXCEPT EXISTS FALSE FETCH FIRST FOR FOREIGN FROM FULL
  FUNCTION GRANT GROUP HAVING IF ILIKE IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY LATERAL LEFT LIKE LIMIT NATURAL NEXT NOT NULL
  NULLS OF OFFSET ON ONLY OR ORDER OUTER OVER PARTITION PRIMARY PROCEDURE REFERENCES RETURNING RETURNS RIGHT ROLLBACK ROW ROWS SELECT
  SET SIMILAR SKIP TABLE THEN TO TOP TRIGGER TRUE TRUNCATE UNION UNIQUE UPDATE USING VALUES VIEW WHEN WHERE WINDOW WITH
  COUNT SUM AVG MIN MAX COALESCE NULLIF EXTRACT SUBSTRING TRIM UPPER LOWER ROUND ROW_NUMBER RANK DENSE_RANK`.split(/\s+/),
);

// cláusulas que abrem linha própria com o conteúdo indentado abaixo
const CLAUSULAS = [
  'SELECT DISTINCT', 'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'EXCEPT',
  'INTERSECT', 'VALUES', 'SET', 'UPDATE', 'INSERT INTO', 'DELETE FROM', 'RETURNING', 'WITH', 'WINDOW',
];
const JUNCOES = [
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'INNER JOIN', 'CROSS JOIN',
  'NATURAL JOIN', 'JOIN',
];
const ESPACO_ANTES_PAREN = new Set(['IN', 'VALUES', 'AS', 'ON', 'AND', 'OR', 'NOT', 'EXISTS', 'FROM', 'JOIN', 'USING', 'INTO', 'WHERE', 'SELECT', 'THEN', 'ELSE', 'WHEN']);

function tokens(sql: string): Tok[] {
  const re =
    /(\s+)|(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?|`[^`]*`?|\[[^\]]*\]?)|(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|(::|[:@$]\w+|\?)|([A-Za-z_À-ɏ][\w$À-ɏ]*)|(<>|!=|<=|>=|\|\||[-+*/%=<>!|&^~])|([(),;.])/gy;
  const l: Tok[] = [];
  let colado = true;
  let pos = 0;
  while (pos < sql.length) {
    re.lastIndex = pos;
    const m = re.exec(sql);
    if (!m) {
      l.push({ t: 'op', v: sql[pos++], colado });
      colado = true;
      continue;
    }
    pos = re.lastIndex;
    const v = m[0];
    if (m[1]) {
      colado = false;
      continue;
    }
    const t: Tipo = m[2] ? 'cmtl' : m[3] ? 'cmt' : m[4] || m[5] ? 'str' : m[6] ? 'num' : m[7] ? (v === '::' ? 'op' : 'str') : m[8] ? 'pal' : m[9] ? 'op' : (v as Tipo);
    l.push({ t, v, colado });
    colado = true;
  }
  return l;
}

export interface OpcoesSqlFmt {
  caixa: 'maiuscula' | 'minuscula' | 'manter';
  indent: number;
}

export function formatarSql(sql: string, o: OpcoesSqlFmt) {
  const tk = tokens(sql);
  const caixa = (v: string) => (o.caixa === 'maiuscula' ? v.toUpperCase() : o.caixa === 'minuscula' ? v.toLowerCase() : v);
  const ind = (n: number) => ' '.repeat(n * o.indent);
  const ehPal = (i: number) => tk[i]?.t === 'pal' && PALAVRAS.has(tk[i].v.toUpperCase());
  // tenta casar uma expressão de várias palavras a partir de i
  const casar = (i: number, lista: string[]) => {
    for (const exp of lista) {
      const p = exp.split(' ');
      if (p.every((w, k) => tk[i + k]?.t === 'pal' && tk[i + k].v.toUpperCase() === w)) return p.length;
    }
    return 0;
  };

  let out = '';
  let nivel = 0; // indentação das cláusulas
  let entre = false; // dentro de BETWEEN, o próximo AND é do BETWEEN
  const pilha: { tipo: 'sub' | 'fn' | 'case'; nivel: number }[] = [];
  const emFuncao = () => pilha.at(-1)?.tipo === 'fn';
  const casos = () => pilha.filter((p) => p.tipo === 'case').length;
  const novaLinha = (n: number) => {
    out = out.replace(/[ \t]+$/, '');
    out += (out && !out.endsWith('\n') ? '\n' : '') + ind(n);
  };
  let colar = false; // sinal unário: próximo token sem espaço
  const escrever = (v: string, espaco: boolean) => {
    if (espaco && !colar && out && !/[\s(]$/.test(out)) out += ' ';
    colar = false;
    out += v;
  };

  for (let i = 0; i < tk.length; i++) {
    const k = tk[i];
    const anterior = tk[i - 1];

    if (k.t === 'pal') {
      const sup = k.v.toUpperCase();
      const nc = casar(i, CLAUSULAS);
      const nj = nc ? 0 : casar(i, JUNCOES);
      if ((nc || nj) && !emFuncao()) {
        const n = nc || nj;
        const texto = tk.slice(i, i + n).map((x) => caixa(x.v)).join(' ');
        if (nc) {
          novaLinha(nivel);
          out += texto;
          if (!['UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT'].includes(texto.toUpperCase())) novaLinha(nivel + 1);
          else novaLinha(nivel);
        } else {
          novaLinha(nivel + 1);
          out += texto;
        }
        i += n - 1;
        continue;
      }
      if ((sup === 'AND' || sup === 'OR') && !emFuncao() && !entre) {
        novaLinha(nivel + 1 + casos());
        out += caixa(k.v);
        continue;
      }
      if (sup === 'AND') entre = false;
      if (sup === 'BETWEEN') entre = true;
      if (sup === 'CASE') {
        escrever(caixa(k.v), true);
        pilha.push({ tipo: 'case', nivel });
        continue;
      }
      if ((sup === 'WHEN' || sup === 'ELSE') && casos()) {
        novaLinha(nivel + 1 + casos());
        out += caixa(k.v);
        continue;
      }
      if (sup === 'END' && pilha.at(-1)?.tipo === 'case') {
        pilha.pop();
        novaLinha(nivel + 1 + casos());
        out += caixa(k.v);
        continue;
      }
      escrever(ehPal(i) ? caixa(k.v) : k.v, !(anterior?.t === '.' || anterior?.v === '::'));
      continue;
    }

    switch (k.t) {
      case '(': {
        const sub = casar(i + 1, ['SELECT', 'WITH']) > 0;
        const fn = !sub && anterior?.t === 'pal' && k.colado && !ESPACO_ANTES_PAREN.has(anterior.v.toUpperCase());
        escrever('(', !fn);
        pilha.push({ tipo: sub ? 'sub' : 'fn', nivel });
        if (sub) nivel += 2;
        break;
      }
      case ')': {
        while (pilha.at(-1)?.tipo === 'case') pilha.pop();
        const p = pilha.pop();
        if (p?.tipo === 'sub') {
          nivel = p.nivel;
          novaLinha(nivel + 1);
        } else out = out.replace(/[ \t]+$/, '');
        out += ')';
        break;
      }
      case ',':
        out = out.replace(/[ \t]+$/, '') + ',';
        if (!emFuncao() && !casos()) novaLinha(nivel + 1);
        else out += ' ';
        break;
      case ';':
        out = out.replace(/\s+$/, '') + ';\n';
        nivel = 0;
        pilha.length = 0;
        out += '\n';
        break;
      case '.':
        out = out.replace(/[ \t]+$/, '') + '.';
        break;
      case 'cmtl':
        escrever(k.v, true);
        out += '\n' + ind(nivel + 1);
        break;
      case 'op':
        if (k.v === '::') out = out.replace(/[ \t]+$/, '') + '::';
        else {
          escrever(k.v, anterior?.t !== '.');
          colar = (k.v === '-' || k.v === '+') && (!anterior || ['op', '(', ','].includes(anterior.t) || ehPal(i - 1));
        }
        break;
      default:
        escrever(k.v, !(anterior?.t === '.' || anterior?.v === '::'));
    }
  }
  return out
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function compactarSql(sql: string) {
  let out = '';
  for (const k of tokens(sql)) {
    if (k.t === 'cmtl') continue;
    const v = k.t === 'cmt' ? '' : k.v;
    if (!v) continue;
    const semEspaco = k.colado || /[(.,]$/.test(out) || [')', ',', '.', ';'].includes(k.t);
    out += (out && !semEspaco ? ' ' : '') + v;
  }
  return out;
}

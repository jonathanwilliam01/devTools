export interface No {
  id: number;
  rotulo: string;
  nivel: number;
  custo: number;
  linhasEst: number;
  tempo?: number;
  linhasReais?: number;
  loops?: number;
  nuncaExec: boolean;
  paralelo: boolean;
  detalhes: string[];
  filhos: No[];
  total: number;
  proprio: number;
  pct: number;
  fator: number;
  // 'sub' = vieram mais linhas que o estimado
  erro: '' | 'sub' | 'super';
}

export interface Alerta {
  no: No | null;
  msg: string;
  alto: boolean;
}

export interface Plano {
  nos: No[];
  analyze: boolean;
  planejamento?: number;
  execucao?: number;
  alertas: Alerta[];
}

const num = (s: string | undefined) => (s === undefined ? undefined : parseFloat(s));
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

function novo(id: number, rotulo: string, nivel: number): No {
  return { id, rotulo, nivel, custo: 0, linhasEst: 0, nuncaExec: false, paralelo: false, detalhes: [], filhos: [], total: 0, proprio: 0, pct: 0, fator: 1, erro: '' };
}

function lerTexto(txt: string): Omit<Plano, 'alertas'> {
  const linhas = txt
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*"(.*)"\s*$/, '$1').replace(/\s*\+$/, ''))
    .filter((l) => l.trim() && !/^\s*QUERY PLAN\s*$/i.test(l) && !/^[\s\-+]+$/.test(l) && !/^\s*\(\d+ (rows?|linhas?|registros?)\)\s*$/i.test(l));
  const nos: No[] = [];
  const pilha: { col: number; no: No }[] = [];
  let prefixo = '';
  let rodape = false;
  let planejamento: number | undefined;
  let execucao: number | undefined;
  let colRaiz = 0;
  for (const l of linhas) {
    const pl = /^\s*Planning [Tt]ime:\s*([\d.]+)/.exec(l);
    const ex = /^\s*(?:Execution [Tt]ime|Total runtime):\s*([\d.]+)/.exec(l);
    if (pl) planejamento = +pl[1];
    if (ex) execucao = +ex[1];
    if (pl || ex) {
      rodape = true;
      continue;
    }
    const col = l.search(/\S/);
    const cab = /^(\s*)(->\s+)?(.+?)\s+\((?:cost=|actual |never executed)/.exec(l);
    if (cab && (cab[2] || !nos.length)) {
      rodape = false;
      const c = col;
      if (!nos.length) colRaiz = col;
      while (pilha.length && pilha.at(-1)!.col >= c) pilha.pop();
      const pai = pilha.at(-1)?.no;
      const n = novo(nos.length, (prefixo ? prefixo + ' → ' : '') + cab[3].trim(), pai ? pai.nivel + 1 : 0);
      prefixo = '';
      const cost = /\(cost=([\d.]+)\.\.([\d.]+) rows=([\d.]+)/.exec(l);
      if (cost) {
        n.custo = +cost[2];
        n.linhasEst = +cost[3];
      }
      const at = /\(actual(?: time=([\d.]+)\.\.([\d.]+))? rows=([\d.]+) loops=(\d+)\)/.exec(l);
      if (at) {
        n.tempo = num(at[2]);
        n.linhasReais = +at[3];
        n.loops = +at[4];
      }
      n.nuncaExec = /\(never executed\)/.test(l);
      pai?.filhos.push(n);
      nos.push(n);
      pilha.push({ col: c, no: n });
      continue;
    }
    if (rodape || (col <= colRaiz && nos.length)) {
      rodape = true;
      continue;
    }
    const sub = /^\s*((?:SubPlan|InitPlan|CTE)\b.*)$/.exec(l);
    if (sub) {
      while (pilha.length && pilha.at(-1)!.col >= col) pilha.pop();
      prefixo = sub[1].trim();
      continue;
    }
    nos.at(-1)?.detalhes.push(l.trim());
  }
  return { nos, analyze: nos.some((n) => n.tempo !== undefined || n.nuncaExec), planejamento, execucao };
}

const ESTRUTURA = new Set([
  'Node Type', 'Plans', 'Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width', 'Actual Startup Time', 'Actual Total Time',
  'Actual Rows', 'Actual Loops', 'Relation Name', 'Alias', 'Index Name', 'Schema', 'Parent Relationship', 'Subplan Name',
  'Join Type', 'Parallel Aware', 'Async Capable', 'Inner Unique', 'Workers',
]);

function lerJson(j: unknown): Omit<Plano, 'alertas'> {
  const raiz = (Array.isArray(j) ? j[0] : j) as Record<string, unknown>;
  const nos: No[] = [];
  const visitar = (p: Record<string, unknown>, nivel: number): No => {
    const tipo = String(p['Node Type'] ?? '?');
    const junta = p['Join Type'] && p['Join Type'] !== 'Inner' ? ` (${p['Join Type']})` : '';
    const idx = p['Index Name'] ? ` using ${p['Index Name']}` : '';
    const rel = p['Relation Name'] ? ` on ${p['Relation Name']}${p['Alias'] && p['Alias'] !== p['Relation Name'] ? ' ' + p['Alias'] : ''}` : '';
    const pre = p['Subplan Name'] ? `${p['Subplan Name']} → ` : '';
    const n = novo(nos.length, pre + (p['Parallel Aware'] ? 'Parallel ' : '') + tipo + junta + idx + rel, nivel);
    nos.push(n);
    n.custo = Number(p['Total Cost'] ?? 0);
    n.linhasEst = Number(p['Plan Rows'] ?? 0);
    if (p['Actual Loops'] !== undefined) {
      n.loops = Number(p['Actual Loops']);
      n.nuncaExec = n.loops === 0;
      if (p['Actual Total Time'] !== undefined) n.tempo = Number(p['Actual Total Time']);
      n.linhasReais = Number(p['Actual Rows'] ?? 0);
    }
    for (const [k, v] of Object.entries(p))
      if (!ESTRUTURA.has(k) && v !== null && typeof v !== 'object') n.detalhes.push(`${k}: ${v}`);
      else if (!ESTRUTURA.has(k) && Array.isArray(v) && v.every((x) => typeof x !== 'object')) n.detalhes.push(`${k}: ${v.join(', ')}`);
    n.filhos = ((p['Plans'] as Record<string, unknown>[]) ?? []).map((f) => visitar(f, nivel + 1));
    return n;
  };
  visitar(raiz['Plan'] as Record<string, unknown>, 0);
  return {
    nos,
    analyze: nos.some((n) => n.loops !== undefined),
    planejamento: num(raiz['Planning Time'] as string),
    execucao: num(raiz['Execution Time'] as string),
  };
}

function detalhe(n: No, re: RegExp) {
  for (const d of n.detalhes) {
    const m = re.exec(d);
    if (m) return m;
  }
  return null;
}

function calcular(p: Omit<Plano, 'alertas'>): Plano {
  const marcar = (n: No, par: boolean) => {
    n.paralelo = par;
    const g = /^(Parallel )?Gather/.test(n.rotulo.replace(/^.*→ /, ''));
    n.filhos.forEach((f) => marcar(f, par || g));
  };
  const raizes = p.nos.filter((n) => n.nivel === 0);
  raizes.forEach((r) => marcar(r, false));
  // tempo do EXPLAIN é por loop; em worker paralelo o loop conta cada worker, então fica a média
  for (const n of p.nos) n.total = p.analyze ? (n.tempo ?? 0) * (n.paralelo ? 1 : (n.loops ?? 1)) : n.custo;
  for (const n of p.nos) n.proprio = Math.max(0, n.total - n.filhos.reduce((s, f) => s + f.total, 0));
  const base = (p.analyze && p.execucao) || raizes.reduce((s, r) => s + r.total, 0) || 1;
  for (const n of p.nos) n.pct = (n.proprio / base) * 100;

  const alertas: Alerta[] = [];
  const rel = (n: No) => n.rotulo.replace(/^.*→ /, '');
  // percorre de baixo para cima: erro de estimativa só no nó onde nasce, não nos pais que herdam
  for (const n of [...p.nos].reverse()) {
    const quente = n.pct >= 20;
    if (p.analyze && !n.nuncaExec && n.linhasReais !== undefined) {
      const r = n.linhasReais;
      const e = n.linhasEst;
      n.fator = Math.max(r, 1) / Math.max(e, 1);
      if (n.fator < 1) n.fator = 1 / n.fator;
      if (n.fator >= 10 && Math.abs(r - e) >= 100) {
        n.erro = r > e ? 'sub' : 'super';
        if (!n.filhos.some((f) => f.erro === n.erro)) alertas.push({
          no: n,
          alto: n.fator >= 100 && quente,
          msg: `Estimou ${fmt(e)} linhas e vieram ${fmt(r)} (${fmt(n.fator)}x). Estatísticas desatualizadas: rode ANALYZE na tabela; se persistir, colunas correlacionadas (CREATE STATISTICS).`,
        });
      }
    }
    const tipo = rel(n);
    const removidas = Number(detalhe(n, /^Rows Removed by Filter:\s*([\d.]+)/)?.[1] ?? 0);
    if (/Seq Scan/.test(tipo) && removidas >= 1000 && removidas > (n.linhasReais ?? 0) * 10)
      alertas.push({ no: n, alto: quente, msg: `Lê a tabela toda e descarta ${fmt(removidas)} linhas pelo filtro para devolver ${fmt(n.linhasReais ?? 0)}. Índice nas colunas do Filter tende a resolver.` });
    else if (/Seq Scan/.test(tipo) && !p.analyze && n.linhasEst >= 10000)
      alertas.push({ no: n, alto: false, msg: `Seq Scan estimando ${fmt(n.linhasEst)} linhas. Confira se há filtro sem índice.` });
    if (/Seq Scan/.test(tipo) && (n.loops ?? 1) >= 10 && !n.paralelo)
      alertas.push({ no: n, alto: (n.loops ?? 0) >= 100, msg: `Seq Scan repetido ${fmt(n.loops!)} vezes (lado interno de Nested Loop). Índice na coluna de junção evita reler a tabela.` });
    else if ((n.loops ?? 1) >= 10000)
      alertas.push({ no: n, alto: quente, msg: `Executado ${fmt(n.loops!)} vezes. Nested Loop com muitas linhas por fora: estimativa errada costuma ser a causa.` });
    const disco = detalhe(n, /^Sort Method:\s*external.*?(?:Disk:\s*(\d+)\s*kB)?$/) ?? detalhe(n, /^Sort Space Type:\s*Disk/);
    if (disco) alertas.push({ no: n, alto: quente, msg: `Ordenação em disco${disco[1] ? ` (${fmt(+disco[1])} kB)` : ''}: work_mem pequeno para esse sort, ou reduza as linhas antes do ORDER BY.` });
    const lotes = Number(detalhe(n, /(?:^|\s)Batches:\s*(\d+)/)?.[1] ?? 1);
    if (lotes > 1) alertas.push({ no: n, alto: quente, msg: `Hash dividido em ${lotes} lotes (gravou em disco): work_mem pequeno para esse hash.` });
    const heap = Number(detalhe(n, /^Heap Fetches:\s*(\d+)/)?.[1] ?? 0);
    if (/Index Only Scan/.test(tipo) && heap >= 1000)
      alertas.push({ no: n, alto: false, msg: `Index Only Scan buscou ${fmt(heap)} linhas na tabela (Heap Fetches): rode VACUUM para atualizar o visibility map.` });
    const recheck = Number(detalhe(n, /^Rows Removed by Index Recheck:\s*(\d+)/)?.[1] ?? 0);
    if (recheck >= 10000) alertas.push({ no: n, alto: false, msg: `Bitmap perdeu precisão e rechecou ${fmt(recheck)} linhas: work_mem pequeno para o bitmap.` });
  }
  alertas.sort((a, b) => +b.alto - +a.alto || (b.no?.pct ?? 0) - (a.no?.pct ?? 0));
  if (!p.analyze) alertas.push({ no: null, alto: false, msg: 'Sem ANALYZE: só o custo estimado. Rode EXPLAIN (ANALYZE, BUFFERS) para ver tempo e linhas reais.' });
  return { ...p, alertas };
}

export function lerExplain(txt: string): Plano {
  const t = txt.replace(/^\s*QUERY PLAN\s*$|^[-\s]+$/gim, '').trim();
  let base: Omit<Plano, 'alertas'>;
  if (/^[[{]/.test(t)) {
    let j: unknown;
    try {
      j = JSON.parse(t);
    } catch {
      // psql com quebra "+" no fim de cada linha
      j = JSON.parse(t.replace(/\s*\+\s*$/gm, '').replace(/^\s*\(\d+ (rows?|linhas?|registros?)\)\s*$/gim, ''));
    }
    base = lerJson(j);
  } else base = lerTexto(t);
  if (!base.nos.length) throw new Error('Nenhum nó de plano encontrado. Cole a saída do EXPLAIN em texto ou JSON.');
  return calcular(base);
}

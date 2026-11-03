// Servidor local de consultas: só leitura, só bancos de homologação, só SQL fixo deste arquivo.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const PORTA = 4300;
const XML = process.env.CLIENTES_XML ?? resolve(import.meta.dirname, '../../siapegov/files2docker/clientes.xml');
const ORIGENS = ['https://dev-tools-cards.vercel.app', 'http://localhost:4200'];
// homologação; qualquer outro host/porta é produção
const HOSTS = ['172.16.80.62', '172.16.80.68'];
const PORTAS = [5432, 5434];
const LIMITE_MAX = 500;
const TIMEOUT = '30s';

const ARQ_TOKEN = resolve(import.meta.dirname, '../.sql-token');
const TOKEN = existsSync(ARQ_TOKEN) ? readFileSync(ARQ_TOKEN, 'utf8').trim() : randomBytes(24).toString('hex');
if (!existsSync(ARQ_TOKEN)) writeFileSync(ARQ_TOKEN, TOKEN, { mode: 0o600 });

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const texto = (s) => s?.trim().replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e]);
// mesmo decode5t do siapegov: 5x (inverte + base64)
const decode5t = (s) => Array.from({ length: 5 }).reduce((t) => Buffer.from([...t].reverse().join(''), 'base64').toString('latin1'), s);
const tag = (xml, nome) => texto(xml.match(new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`))?.[1]);

function lerClientes() {
  const raiz = readFileSync(XML, 'utf8').replace(/<!--[\s\S]*?-->/g, '').match(/<zend-config[^>]*>([\s\S]*)<\/zend-config>/)[1];
  return [...raiz.matchAll(/<([\w-]+)>([\s\S]*?)<\/\1>/g)].map(([, id, corpo]) => {
    const params = tag(corpo, 'params') ?? '';
    const [host, porta] = (tag(params, 'host') ?? '').split(/[/:]/);
    const c = {
      id,
      sufixo: tag(corpo, 'sufixo') ?? id,
      nome: tag(corpo, 'nome') ?? id,
      host,
      porta: Number(porta || 5432),
      dbname: tag(params, 'dbname'),
      scheme: tag(params, 'scheme') ?? null,
      usuario: tag(params, 'username'),
      senha: decode5t(tag(params, 'password') ?? ''),
    };
    c.motivo = !host || !c.dbname ? 'sem banco' : !HOSTS.includes(host) || !PORTAS.includes(c.porta) ? 'produção' : '';
    return c;
  });
}

const publico = ({ id, sufixo, nome, host, porta, dbname, scheme, motivo }) => ({ id, sufixo, nome, host, porta, dbname, scheme, motivo });

const pools = new Map();
function pool(c) {
  const chave = `${c.host}:${c.porta}/${c.dbname}/${c.usuario}`;
  if (!pools.has(chave))
    pools.set(
      chave,
      new pg.Pool({
        host: c.host,
        port: c.porta,
        database: c.dbname,
        user: c.usuario,
        password: c.senha,
        max: 2,
        idleTimeoutMillis: 60_000,
        connectionTimeoutMillis: 8_000,
        application_name: 'devtools-sql',
        options: '-c default_transaction_read_only=on',
      }),
    );
  return pools.get(chave);
}

const STATUS_CARNE = Array.from({ length: 13 }, (_, i) => i);
const SITUACAO_DIVIDA = {
  sem_acordo: 'd.d029 in (0, 2)',
  acordo: 'd.d029 = 1',
  ajuizada: "coalesce(d.d016, 'N') <> 'N'",
  quitada: 'd.d029 = 3',
  cancelada: 'd.d029 = 4',
  anistiada: 'd.d029 = 5',
  suspensa: 'd.d029 = 6',
};

const CAD = {
  IPTU: { tabela: 'ctec_imoveis', inscricao: 'i000', pessoa: 'i001', carnes: 'iptu_carnes', parcelas: 'iptu_parcelas', anuais: 'iptu_dados_anuais', ref: 'referencial_imoveis' },
  ISSW: { tabela: 'ctec_mobiliario', inscricao: 'm000', pessoa: 'm001', carnes: 'issw_carnes', parcelas: 'issw_parcelas', anuais: 'issw_dados_anuais', ref: 'referencial_mobiliario' },
};
const ATIVA = {
  IPTU: { S: "a.i012 = 'S'", N: "coalesce(a.i012, 'N') <> 'S'" },
  ISSW: { S: "upper(a.m005) = 'S' and a.m043 is null", N: "(coalesce(upper(a.m005), 'N') <> 'S' or a.m043 is not null)" },
};

const ano = (v) => (/^\d{4}$/.test(v ?? '') ? v : falha('Ano inválido'));
const modulo = (v) => (CAD[v] ? v : falha('Módulo inválido'));

// cada consulta devolve { de, onde, params, colunas, somas, ordem } montados só com trechos fixos
const CONSULTAS = {
  inscricoes(f) {
    const m = CAD[modulo(f.modulo)];
    const sit = ATIVA[f.modulo][f.situacao] ?? falha('Situação inválida');
    return {
      de: `${m.tabela} a left join sis_pessoa p on p.id_pessoa = a.${m.pessoa}`,
      onde: `${sit} and trim(a.${m.inscricao}) <> ''`,
      params: [],
      colunas: `trim(a.${m.inscricao}) as inscricao, p.nome_razao as contribuinte`,
      somas: '',
      ordem: `a.${m.inscricao}`,
    };
  },
  carnes(f) {
    const m = CAD[modulo(f.modulo)];
    const status = (Array.isArray(f.status) ? f.status : []).map(Number).filter((s) => STATUS_CARNE.includes(s));
    if (!status.length) falha('Escolha ao menos um status');
    return {
      de: `${m.carnes} c join ${m.anuais} b on b.referencial = c.referencial_dados
        join ${m.tabela} a on a.referencial = b.${m.ref}
        left join sis_pessoa p on p.id_pessoa = a.${m.pessoa}
        left join lateral (select sum(x.valor) as valor, min(x.vencimento) as vencimento
          from ${m.parcelas} x where x.referencial_carne = c.referencial and x.parcela > 0) v on true`,
      // total/vencimento do carnê costumam vir nulos: valor real está nas parcelas (parcela 0 = cota única)
      onde: `c.competencia >= $1 and c.competencia < $2 and c.status = any($3::int[])`,
      params: [ano(f.ano), String(Number(f.ano) + 1), status],
      colunas: `trim(a.${m.inscricao}) as inscricao, p.nome_razao as contribuinte, c.competencia, c.status,
        c.tipo_carne, to_char(v.vencimento, 'DD/MM/YYYY') as vencimento, round(v.valor::numeric, 2) as valor, c.referencial as carne`,
      somas: 'round(sum(v.valor)::numeric, 2) as valor',
      ordem: 'c.referencial desc',
    };
  },
  dividas(f) {
    const onde = [SITUACAO_DIVIDA[f.situacao] ?? falha('Situação inválida')];
    const params = [];
    const filtro = (sql, valor) => onde.push(sql.replace('?', `$${params.push(valor)}`));
    if (f.modulo) filtro('d.d001 = ?', modulo(f.modulo));
    if (f.ano) filtro('d.d004::text = ?', ano(f.ano));
    return {
      de: 'geda_ldivida d left join sis_pessoa p on p.id_pessoa = d.d011',
      onde: onde.join(' and '),
      params,
      colunas: `d.d000 as id, d.d001 as origem, trim(d.d019) as inscricao, p.nome_razao as contribuinte, d.d004 as exercicio,
        d.d009 as valor_original, d.d010 as valor_atualizado, d.d029 as status, d.d016 as ajuizada, d.d012 as acordo`,
      somas: 'round(sum(d.d009)::numeric, 2) as valor_original, round(sum(d.d010)::numeric, 2) as valor_atualizado',
      ordem: 'd.d000 desc',
    };
  },
};

function falha(msg) {
  throw Object.assign(new Error(msg), { status: 400 });
}

async function consultar({ cliente, consulta, filtros = {}, limite }) {
  const c = lerClientes().find((x) => x.id === cliente) ?? falha('Cliente não encontrado');
  if (c.motivo) throw Object.assign(new Error(`Bloqueado: ${c.motivo}`), { status: 403 });
  const q = (CONSULTAS[consulta] ?? falha('Consulta inválida'))(filtros);
  const lim = Math.min(Math.max(Number(limite) || 50, 1), LIMITE_MAX);
  const con = await pool(c).connect();
  const inicio = Date.now();
  try {
    await con.query('begin read only');
    await con.query(`set local statement_timeout = '${TIMEOUT}'`);
    const caminho = c.scheme ? `${pg.escapeIdentifier(c.scheme)}, public` : 'public';
    await con.query(`set local search_path to ${caminho}`);
    const tot = await con.query(`select count(*)::int as total${q.somas ? ', ' + q.somas : ''} from ${q.de} where ${q.onde}`, q.params);
    const lin = await con.query(`select ${q.colunas} from ${q.de} where ${q.onde} order by ${q.ordem} limit ${lim}`, q.params);
    const { total, ...somas } = tot.rows[0];
    return { total, somas, colunas: lin.fields.map((f) => f.name), linhas: lin.rows.map((r) => Object.values(r)), ms: Date.now() - inicio };
  } finally {
    await con.query('rollback').catch(() => {});
    con.release();
  }
}

function responder(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

createServer(async (req, res) => {
  const origem = req.headers.origin;
  if (origem && !ORIGENS.includes(origem)) return responder(res, 403, { erro: 'Origem não permitida' });
  if (origem) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }
  if (req.headers['x-token'] !== TOKEN) return responder(res, 401, { erro: 'Token inválido' });
  try {
    if (req.method === 'GET' && req.url === '/clientes') return responder(res, 200, lerClientes().map(publico));
    if (req.method === 'POST' && req.url === '/consulta') {
      let corpo = '';
      for await (const p of req) if ((corpo += p).length > 10_000) falha('Requisição grande demais');
      let dados;
      try {
        dados = JSON.parse(corpo);
      } catch {
        falha('JSON inválido');
      }
      return responder(res, 200, await consultar(dados));
    }
    responder(res, 404, { erro: 'Não encontrado' });
  } catch (e) {
    responder(res, e.status ?? 500, { erro: e.message });
  }
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`devTools SQL em http://127.0.0.1:${PORTA}`);
  console.log(`clientes: ${XML}`);
  console.log(`token: ${TOKEN}`);
});

import { dvCnpj, dvCpf, mascarar, valido } from './docs';
import { PADROES } from './extrair';

export type TipoAnonimo = 'campos' | 'cpf' | 'cnpj' | 'email' | 'telefone' | 'cep' | 'ip' | 'termos';
export type ModoAnonimo = 'parcial' | 'total' | 'fake';

export interface OpcoesAnonimo {
  tipos: TipoAnonimo[];
  modo: ModoAnonimo;
  // nomes de campo cujo valor some (nome, senha...)
  chaves: string;
  // um por linha, trocados por ***
  termos: string;
}

export const CHAVES = 'nome razao senha password passwd pwd token secret email telefone celular endereco logradouro';

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// dígitos derivados do original: o falso não muda a cada tecla
function digitos(v: string, n: number) {
  let h = 2166136261;
  for (const c of v) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let r = '';
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    r += h % 10;
  }
  return r;
}
const cpfDe = (v: string) => {
  const b = digitos(v.replace(/\W/g, ''), 9);
  return b + dvCpf(b);
};
const cnpjDe = (v: string) => {
  const b = digitos(v.replace(/\W/g, ''), 8) + '0001';
  return b + dvCnpj(b);
};
// troca dígitos/letras por *, mantém pontuação
const estrelas = (v: string) => v.replace(/[0-9A-Za-z]/g, '*');

// CPF ***.456.789-**; CNPJ 12.345.***/****-**
function parcialDoc(tipo: 'CPF' | 'CNPJ', v: string) {
  const m = mascarar(tipo, v);
  return tipo === 'CPF' ? '***' + m.slice(3, 11) + '-**' : m.slice(0, 7) + '***/****-**';
}

function parcialEmail(v: string) {
  const [u, d] = v.split('@');
  return `${u[0]}${'*'.repeat(Math.max(u.length - 1, 2))}@${d}`;
}

const parcialFim = (v: string, manter: number) => {
  let n = 0;
  return [...v].reverse().map((c) => (/\d/.test(c) && n++ >= manter ? '*' : c)).reverse().join('');
};

const SEGREDO = /senha|pass|pwd|token|secret|chave|key/i;

// jonathan → j*******; e-mail mantém o domínio
const parcialValor = (v: string) =>
  /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v) ? parcialEmail(v) : v.replace(/\S+/g, (p) => p[0] + '*'.repeat(p.length - 1));

export function anonimizar(texto: string, o: OpcoesAnonimo) {
  const qtd: Partial<Record<TipoAnonimo, number>> = {};
  // mesmo original → mesmo falso, para não quebrar relação entre linhas
  const fakes = new Map<string, string>();
  const fake = (v: string, gerar: () => string) => fakes.get(v) ?? (fakes.set(v, gerar()), fakes.get(v)!);
  const conta = (t: TipoAnonimo) => (qtd[t] = (qtd[t] ?? 0) + 1);
  const ativo = (t: TipoAnonimo) => o.tipos.includes(t);
  let s = texto;

  const termos = o.termos.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (ativo('termos') && termos.length)
    s = s.replace(new RegExp(termos.map(escapar).join('|'), 'gi'), () => (conta('termos'), '***'));

  const chaves = o.chaves.split(/[,\s]+/).filter(Boolean).map(escapar);
  if (ativo('campos') && chaves.length) {
    // chave=valor, chave: valor, "chave": "valor", 'chave' => 'valor', [chave] => valor
    const re = new RegExp(
      String.raw`((?<![\w])["'\[]?[\w.]*(?:${chaves.join('|')})[\w.]*["'\]]?\s*(?:=>|:=|=|:)\s*)(?:"([^"\n]*)"|'([^'\n]*)'|([^,;&\n"'<>)}\]]+))`,
      'gi',
    );
    s = s.replace(re, (_m, pre: string, dupla?: string, simples?: string, solto?: string) => {
      const v = dupla ?? simples ?? solto ?? '';
      if (!v.trim() || v.trim() === '***') return _m;
      conta('campos');
      // segredo nunca fica parcial
      const novo = o.modo === 'parcial' && !SEGREDO.test(pre) ? parcialValor(v.trim()) : '***';
      if (dupla !== undefined) return `${pre}"${novo}"`;
      if (simples !== undefined) return `${pre}'${novo}'`;
      return pre + novo + (solto!.match(/\s*$/)?.[0] ?? '');
    });
  }

  const troca = (t: TipoAnonimo, re: RegExp, fn: (v: string) => string | null) => {
    if (!ativo(t)) return;
    s = s.replace(re, (v) => {
      const r = fn(v);
      if (r === null) return v;
      conta(t);
      return r;
    });
  };

  troca('cnpj', PADROES.cnpj.re, (v) => {
    if (!valido('CNPJ', v)) return null;
    if (o.modo === 'fake') return fake(v, () => (/\D/.test(v) ? mascarar('CNPJ', cnpjDe(v)) : cnpjDe(v)));
    return o.modo === 'parcial' ? parcialDoc('CNPJ', v) : estrelas(v);
  });
  troca('cpf', PADROES.cpf.re, (v) => {
    if (!valido('CPF', v)) return null;
    if (o.modo === 'fake') return fake(v, () => (/\D/.test(v) ? mascarar('CPF', cpfDe(v)) : cpfDe(v)));
    return o.modo === 'parcial' ? parcialDoc('CPF', v) : estrelas(v);
  });
  let nEmail = 0;
  troca('email', PADROES.email.re, (v) => {
    if (o.modo === 'fake') return fake(v.toLowerCase(), () => `usuario${++nEmail}@exemplo.com`);
    return o.modo === 'parcial' ? parcialEmail(v) : '***@***';
  });
  troca('telefone', PADROES.telefone.re, (v) =>
    o.modo === 'fake' ? fake(v, () => v.replace(/\d{4}$/, digitos(v, 4))) : o.modo === 'parcial' ? parcialFim(v, 4) : estrelas(v),
  );
  troca('cep', PADROES.cep.re, (v) => (o.modo === 'fake' ? fake(v, () => v.replace(/\d{3}$/, digitos(v, 3))) : estrelas(v)));
  troca('ip', PADROES.ip.re, (v) => (o.modo === 'parcial' ? v.replace(/\d+\.\d+$/, '*.*') : o.modo === 'fake' ? fake(v, () => `10.0.0.${fakes.size + 1}`) : '*.*.*.*'));

  return { texto: s, qtd };
}

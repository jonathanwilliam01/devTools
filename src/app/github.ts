import { Injectable, inject, signal } from '@angular/core';
import { ISSUE_URL, chaveNome } from './models';
import { Ui } from './ui';

const CHAVE = 'devtools:gh-token';
const API = ISSUE_URL.replace('https://github.com/', 'https://api.github.com/repos/');

export interface Issue {
  titulo: string;
  descricao: string;
  labels: string[];
  descLabels: Record<string, string>;
  // campos do GitHub Projects e linhas "Campo: valor" do corpo
  campos: [string, string][];
}

const CAMPOS_PROJETO = `query($o: String!, $r: String!, $n: Int!) {
  repository(owner: $o, name: $r) { issue(number: $n) { projectItems(first: 10) { nodes { fieldValues(first: 30) { nodes {
    ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
  } } } } } }
}`;

const STATUS_PROJETO = (nums: number[]) => `query($o: String!, $r: String!) { repository(owner: $o, name: $r) {
  ${nums.map((n) => `i${n}: issue(number: ${n}) { projectItems(first: 10) { nodes { fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue { name updatedAt } } } } }`).join('\n')}
} }`;

// títulos que abrem o "o que foi feito" no comentário de entrega
const SECOES = ['DESCRICAO DA ALTERACAO', 'TRABALHO EXECUTADO'];

// token fica só neste navegador: fora do backup e dos cookies
@Injectable({ providedIn: 'root' })
export class Github {
  private readonly ui = inject(Ui);
  readonly token = signal(ler());
  private login = '';

  async issue(n: number): Promise<Issue | null> {
    const r = await this.chamar(API + n);
    if (r?.ok) {
      const j = await r.json();
      const corpo: string = j.body ?? '';
      const doCorpo = [...corpo.matchAll(/^[\s*_#>-]*([\p{L} ]{3,25}?)[*_]*\s*:\s*[*_]*(.+?)[*_]*\s*$/gmu)].map(
        (m) => [m[1].trim(), m[2].trim()] as [string, string],
      );
      return {
        titulo: j.title,
        descricao: corpo.trim(),
        labels: (j.labels ?? []).map((l: any) => l.name ?? l),
        descLabels: Object.fromEntries((j.labels ?? []).filter((l: any) => l.description).map((l: any) => [l.name, l.description])),
        campos: [...(await this.camposProjeto(n)), ...doCorpo],
      };
    }
    this.ui.avisar(this.erro(r, `Issue #${n} não encontrada`));
    return null;
  }

  // projeto pode não existir ou o token não ter permissão de Projects: ignora
  private async camposProjeto(n: number): Promise<[string, string][]> {
    const t = this.token();
    if (!t) return [];
    const [o, r] = ISSUE_URL.split('/').slice(3, 5);
    const resp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: JSON.stringify({ query: CAMPOS_PROJETO, variables: { o, r, n } }),
    }).catch(() => null);
    if (!resp?.ok) return [];
    const j = await resp.json().catch(() => null);
    return (j?.data?.repository?.issue?.projectItems?.nodes ?? [])
      .flatMap((i: any) => i?.fieldValues?.nodes ?? [])
      .filter((v: any) => v?.field?.name && (v.name ?? v.text))
      .map((v: any) => [v.field.name, v.name ?? v.text]);
  }

  // Status do quadro por issue, com a data em que mudou; vazio se o token não lê Projects
  async statusProjeto(nums: number[]): Promise<Map<number, { status: string; data: string }>> {
    const res = new Map<number, { status: string; data: string }>();
    if (!nums.length || !this.token()) return res;
    const [o, r] = ISSUE_URL.split('/').slice(3, 5);
    const resp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token()}` },
      body: JSON.stringify({ query: STATUS_PROJETO(nums), variables: { o, r } }),
    }).catch(() => null);
    const j = resp?.ok ? await resp.json().catch(() => null) : null;
    for (const n of nums) {
      const v = (j?.data?.repository?.[`i${n}`]?.projectItems?.nodes ?? []).map((x: any) => x?.fieldValueByName).find((x: any) => x?.name);
      if (v) res.set(n, { status: v.name, data: new Date(v.updatedAt).toLocaleDateString('sv-SE') });
    }
    return res;
  }

  // "o que foi feito" do comentário de entrega mais recente (ou do corpo); null se não deu para consultar
  async trabalhoExecutado(n: number, corpo: string): Promise<string | null> {
    const c = await this.chamar(`${API}${n}/comments?per_page=100`);
    if (!c?.ok) return null;
    const textos = [corpo, ...((await c.json()) as any[]).map((x) => x.body ?? '')];
    return textos.map(secaoTrabalho).filter(Boolean).pop() ?? '';
  }

  // issues abertas atribuídas ao dono do token, sem PRs; null se não deu para consultar
  async atribuidas(): Promise<{ numero: number; titulo: string; descricao: string }[] | null> {
    if (!this.token()) return null;
    if (!this.login) {
      const u = await this.chamar('https://api.github.com/user');
      if (!u?.ok) return null;
      this.login = (await u.json()).login ?? '';
    }
    const r = await this.chamar(`${API.replace(/\/$/, '')}?assignee=${this.login}&state=open&per_page=100`);
    if (!r?.ok) return null;
    const l: any[] = await r.json();
    return l.filter((i) => !i.pull_request).map((i) => ({ numero: i.number, titulo: i.title, descricao: (i.body ?? '').trim() }));
  }

  // valida o token lendo o repositório
  async testar() {
    const r = await this.chamar(API.replace(/issues\/$/, ''));
    return r?.ok ? 'Token OK: acesso ao repositório confirmado' : this.erro(r, 'Sem acesso ao repositório');
  }

  salvar(t: string) {
    this.token.set(t.trim());
    this.login = '';
    try {
      if (t.trim()) localStorage.setItem(CHAVE, t.trim());
      else localStorage.removeItem(CHAVE);
    } catch {}
  }

  private chamar(url: string) {
    const t = this.token();
    return fetch(url, { headers: t ? { Authorization: `Bearer ${t}` } : {} }).catch(() => null);
  }

  // repo privado responde 404 sem token
  private erro(r: Response | null, padrao: string) {
    if (!r) return 'Falha de rede ao acessar o GitHub';
    if (r.status === 401) return 'Token do GitHub inválido ou vencido (Dados)';
    if (!this.token() && (r.status === 403 || r.status === 404)) return 'Configure o token do GitHub em Dados';
    return padrao;
  }
}

function ler() {
  try {
    return localStorage.getItem(CHAVE) ?? '';
  } catch {
    return '';
  }
}

// linhas entre o título da seção e o próximo título, item numerado ou "---"
function secaoTrabalho(texto: string) {
  const titulo = (l: string) => chaveNome(l.replace(/^[\s#*_\d.)-]*|[\s*_:]*$/g, '').replace(/[^\p{L} ]/gu, ''));
  const fim = (l: string) => /^\s*(#|\d+\s*-\s|\*\*[^*]+\*\*:?\s*$)/.test(l);
  const linhas = texto.split(/\r?\n/);
  const ini = linhas.findIndex((l) => SECOES.some((s) => titulo(l.split(':')[0]) === s));
  if (ini < 0) return '';
  const resto = linhas[ini].includes(':') ? linhas[ini].slice(linhas[ini].indexOf(':') + 1) : '';
  const corpo: string[] = [];
  for (const l of [resto, ...linhas.slice(ini + 1)]) {
    if (fim(l) || (/^\s*---/.test(l) && corpo.some((x) => x.trim()))) break;
    corpo.push(l);
  }
  return corpo.map((l) => l.replace(/^\s*([-*•]|---)\s*/, '').trim()).filter(Boolean).join('\n');
}

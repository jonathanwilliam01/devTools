import { Injectable, inject, signal } from '@angular/core';
import { ISSUE_URL } from './models';
import { Ui } from './ui';

const CHAVE = 'devtools:gh-token';
const API = ISSUE_URL.replace('https://github.com/', 'https://api.github.com/repos/');

export interface Issue {
  titulo: string;
  descricao: string;
  labels: string[];
  // campos do GitHub Projects e linhas "Campo: valor" do corpo
  campos: [string, string][];
}

const CAMPOS_PROJETO = `query($o: String!, $r: String!, $n: Int!) {
  repository(owner: $o, name: $r) { issue(number: $n) { projectItems(first: 10) { nodes { fieldValues(first: 30) { nodes {
    ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
  } } } } } }
}`;

// token fica só neste navegador: fora do backup e dos cookies
@Injectable({ providedIn: 'root' })
export class Github {
  private readonly ui = inject(Ui);
  readonly token = signal(ler());

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

  // valida o token lendo o repositório
  async testar() {
    const r = await this.chamar(API.replace(/issues\/$/, ''));
    return r?.ok ? 'Token OK: acesso ao repositório confirmado' : this.erro(r, 'Sem acesso ao repositório');
  }

  salvar(t: string) {
    this.token.set(t.trim());
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

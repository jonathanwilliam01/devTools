// Patch notes: cada versão nova entra no topo; a janela abre uma vez por versão
export type TipoNovidade = 'novidade' | 'melhoria' | 'correcao';

export interface Versao {
  versao: string;
  data: string; // yyyy-mm-dd
  itens: { tipo: TipoNovidade; texto: string }[];
}

export const NOVIDADES: Versao[] = [
  {
    versao: '1.0.22',
    data: '2026-11-09',
    itens: [
      { tipo: 'novidade', texto: 'Notas com tabela: linhas e colunas como planilha, clique na célula para copiar.' },
      { tipo: 'novidade', texto: 'Colar do Excel na tabela preenche várias células; "⧉ tabela" copia tudo pronto para colar no Excel.' },
      { tipo: 'novidade', texto: 'Ferramenta Entidades HTML: converte acentos e símbolos em entidades (ã → &atilde;) e volta para texto.' },
      { tipo: 'novidade', texto: 'Novidades de cada versão nesta janela. Clique no número da versão no topo para rever.' },
    ],
  },
];

const CHAVE = 'devtools:novidades';
const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

// versões ainda não vistas até a atual; sem registro mostra só a atual
export function pendentes(atual: string): Versao[] {
  let visto: string | null = null;
  try {
    visto = localStorage.getItem(CHAVE);
  } catch {}
  if (visto === atual) return [];
  return NOVIDADES.filter((v) => cmp(v.versao, atual) <= 0 && (visto ? cmp(v.versao, visto) > 0 : v.versao === atual));
}

export function marcarVisto(atual: string) {
  try {
    localStorage.setItem(CHAVE, atual);
  } catch {}
}

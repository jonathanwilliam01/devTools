// Patch notes: cada versão nova entra no topo; a janela abre uma vez por versão
export type TipoNovidade = 'novidade' | 'melhoria' | 'correcao';

export interface Versao {
  versao: string;
  data: string; // yyyy-mm-dd
  itens: { tipo: TipoNovidade; texto: string }[];
}

export const NOVIDADES: Versao[] = [
  {
    versao: '1.0.25',
    data: '2026-11-11',
    itens: [
      { tipo: 'novidade', texto: 'Notas, Histórico e Kanban com troca de visualização: mural/tabela/quadro, lista com prévia embaixo ou lista com prévia ao lado. A escolha fica salva.' },
      { tipo: 'novidade', texto: 'Notas em Markdown formatado (títulos, listas, checklist, código, links) com o botão M↓; Aa volta ao texto normal. Clicar no bloco continua copiando o texto cru.' },
      { tipo: 'novidade', texto: 'Histórico em lista: um mês por vez com ‹ › para trocar (pula meses vazios e vira o ano), cards separados por semana. Teclado: ←/→ troca o mês, ↑/↓ o card.' },
      { tipo: 'melhoria', texto: 'Kanban em lista: tarefas agrupadas por status com prazo e prioridade; na prévia, troca de status por botões, sem arrastar.' },
      { tipo: 'melhoria', texto: 'As novidades do devTools aparecem também no "O que há de novo" do git-calm.' },
    ],
  },
  {
    versao: '1.0.24',
    data: '2026-11-10',
    itens: [
      { tipo: 'novidade', texto: 'Notificação do navegador quando uma issue entra no kanban ou um card é registrado no histórico; clique abre a tela. Liga/desliga em Dados.' },
      { tipo: 'melhoria', texto: 'Dentro do git-calm as notificações são exibidas por ele.' },
      { tipo: 'correcao', texto: 'Texto de imagem: prévia da foto agora aparece no celular.' },
    ],
  },
  {
    versao: '1.0.23',
    data: '2026-11-10',
    itens: [
      { tipo: 'novidade', texto: 'Limpar texto colado: mostra e tira caracteres invisíveis, aspas curvas e travessões que quebram SQL e PHP.' },
      { tipo: 'novidade', texto: 'Extrair do texto: CPF, CNPJ, e-mail, URL, telefone, CEP, data, IP e números de qualquer texto.' },
      { tipo: 'novidade', texto: 'Anonimizar (LGPD): mascara documentos, e-mails, senhas e nomes antes de colar log ou SQL na issue.' },
      { tipo: 'novidade', texto: 'Leitor de log: filtra log do PHP, Apache e PostgreSQL por nível, texto e período e agrupa erros repetidos.' },
      { tipo: 'novidade', texto: 'Juros, multa e correção: calcula os acréscimos de um débito em atraso com multa fixa ou diária e juros por mês, fração ou dia.' },
      { tipo: 'novidade', texto: 'SELECT → UPDATE/DELETE: gera o comando com o mesmo filtro dentro de BEGIN/ROLLBACK, com contagem e backup.' },
      { tipo: 'novidade', texto: 'Gerador de DDL: cria o CREATE TABLE e o INSERT a partir de planilha ou grid colado, com os tipos inferidos.' },
      { tipo: 'novidade', texto: 'Diagnóstico PG: consultas prontas para sessões, bloqueios, queries lentas, tamanho, vacuum e sequences.' },
    ],
  },
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

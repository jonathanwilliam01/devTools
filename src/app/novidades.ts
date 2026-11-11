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
      { tipo: 'novidade', texto: 'Ctrl+K em qualquer tela: busca um bloco de qualquer nota pelo título, rótulo ou conteúdo e copia (Shift+Enter abre a nota).' },
      { tipo: 'novidade', texto: 'Notas com tags: filtro por tag no topo e sugestão das tags já usadas.' },
      { tipo: 'novidade', texto: 'Bloco SQL nas notas: destaque de sintaxe, :parametro e {{variavel}} marcados, e botão para formatar.' },
      { tipo: 'novidade', texto: 'Lixeira de notas: nota excluída fica 7 dias para restaurar.' },
      { tipo: 'novidade', texto: 'Duplicar nota e bloco.' },
      { tipo: 'novidade', texto: 'Kanban: campos do Tiflux (cliente, técnico, banco, versão, inscrição, link) em destaque na tarefa e link direto para o ticket.' },
      { tipo: 'novidade', texto: 'Kanban: ao concluir um card, pede o "trabalho executado", que vira o obs ao registrar no Histórico.' },
      { tipo: 'novidade', texto: 'Kanban: checklist na tarefa, com progresso no quadro e marcação direto na prévia.' },
      { tipo: 'novidade', texto: 'Kanban: tempo em "Fazendo" contado sozinho ao mover a tarefa.' },
      { tipo: 'novidade', texto: 'Kanban: tarefa de ajuda com a pessoa ajudada e contagem de ajudas no mês.' },
      { tipo: 'melhoria', texto: 'Notas: título passa a ser obrigatório para salvar.' },
      { tipo: 'melhoria', texto: 'Labels de área (Arrecadação, Finanças, Suprimentos, Administração/RH) já vêm mapeadas para o campo Área.' },
      { tipo: 'novidade', texto: 'Kanban: tipo Tarefa, para o que não é card, ajuda nem verificação.' },
      { tipo: 'melhoria', texto: 'Novidades: só a versão mais recente vem aberta; as anteriores ficam recolhidas, clique para expandir.' },
      { tipo: 'correcao', texto: 'Notificações do navegador: pedido de permissão repete até ser respondido, permissão liberada no cadeado vale sem recarregar e botão Testar em Dados.' },
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

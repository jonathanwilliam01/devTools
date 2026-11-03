import { Component, computed, inject, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Ui } from '../ui';

const SERVIDOR = 'http://127.0.0.1:4300';
const CHAVE_TOKEN = 'devtools:sql-token';
const CHAVE_CLIENTE = 'devtools:sql-cliente';

interface Cliente {
  id: string;
  sufixo: string;
  nome: string;
  host: string;
  porta: number;
  dbname: string;
  scheme: string | null;
  motivo: string;
}

interface Resultado {
  total: number;
  somas: Record<string, string | number | null>;
  colunas: string[];
  linhas: unknown[][];
  ms: number;
}

type Consulta = 'inscricoes' | 'carnes' | 'dividas';
type Estado = 'sem-token' | 'fora' | 'ok';

const STATUS_CARNE = [
  'Sem Cálculo', 'Calculado', 'Impresso', 'Entregue', 'Com Pagamento', 'Pgto Cancelado', 'Cancelado',
  'Substituído', 'Em Dívida Ativa', 'Em Anistia', 'Quitado', 'Em Execução Fiscal', 'Suspenso',
];
const STATUS_DIVIDA = ['Em Aberto', 'Em Acordo', 'Em Execução', 'Quitado', 'Cancelado', 'Anistiada', 'Suspenso'];
const TIPO_CARNE = ['', 'Inicial', 'Substitutivo', 'Complementar', 'Vigência Quebrada', 'Avulso', 'Honorários'];
const AJUIZADA: Record<string, string> = { N: 'Não', P: 'Em ajuizamento', S: 'Sim' };

const ROTULOS: Record<string, string> = {
  id: 'ID',
  inscricao: 'Inscrição',
  contribuinte: 'Contribuinte',
  competencia: 'Competência',
  status: 'Status',
  tipo_carne: 'Tipo',
  vencimento: 'Vencimento',
  valor: 'Valor',
  carne: 'Carnê',
  origem: 'Origem',
  exercicio: 'Exercício',
  valor_original: 'Valor original',
  valor_atualizado: 'Valor atualizado',
  ajuizada: 'Ajuizada',
  acordo: 'Acordo',
};
const MOEDA = new Set(['valor', 'valor_original', 'valor_atualizado']);

@Component({
  selector: 'app-sql',
  imports: [FormsModule, KeyValuePipe],
  templateUrl: './sql.html',
  styleUrl: './sql.css',
})
export class Sql {
  protected readonly ui = inject(Ui);
  protected readonly SERVIDOR = SERVIDOR;
  protected readonly STATUS_CARNE = STATUS_CARNE;
  protected readonly ROTULOS = ROTULOS;
  protected readonly CONSULTAS: { valor: Consulta; label: string }[] = [
    { valor: 'inscricoes', label: 'Inscrições' },
    { valor: 'carnes', label: 'Carnês' },
    { valor: 'dividas', label: 'Dívida ativa' },
  ];
  protected readonly SITUACOES_DIVIDA = [
    { valor: 'sem_acordo', label: 'Sem acordo' },
    { valor: 'acordo', label: 'Com acordo' },
    { valor: 'ajuizada', label: 'Ajuizada' },
    { valor: 'quitada', label: 'Quitada' },
    { valor: 'cancelada', label: 'Cancelada' },
    { valor: 'anistiada', label: 'Anistiada' },
    { valor: 'suspensa', label: 'Suspensa' },
  ];

  protected readonly token = signal(ler(CHAVE_TOKEN) ?? '');
  protected readonly estado = signal<Estado>(this.token() ? 'ok' : 'sem-token');
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly clienteId = signal(ler(CHAVE_CLIENTE) ?? '');
  protected readonly cliente = computed(() => this.clientes().find((c) => c.id === this.clienteId()));
  protected readonly permitidos = computed(() => this.clientes().filter((c) => !c.motivo));
  protected readonly bloqueados = computed(() => this.clientes().filter((c) => c.motivo));

  protected readonly consulta = signal<Consulta>('inscricoes');
  protected readonly filtros = {
    modulo: 'IPTU',
    moduloDivida: '',
    situacao: 'S',
    situacaoDivida: 'sem_acordo',
    ano: String(new Date().getFullYear()),
    anoDivida: '',
    status: new Set([4]),
    limite: 50,
  };
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly resultado = signal<Resultado | null>(null);
  private consultaDoResultado: Consulta = 'inscricoes';

  constructor() {
    if (this.token()) this.carregarClientes();
  }

  salvarToken(t: string) {
    this.token.set(t.trim());
    grava(CHAVE_TOKEN, this.token());
    this.carregarClientes();
  }

  escolherCliente(id: string) {
    this.clienteId.set(id);
    grava(CHAVE_CLIENTE, id);
    this.resultado.set(null);
    this.erro.set('');
  }

  alternarStatus(s: number) {
    const st = this.filtros.status;
    st.has(s) ? st.delete(s) : st.add(s);
  }

  async carregarClientes() {
    const r = await this.chamar('/clientes');
    if (r) this.clientes.set(r);
  }

  async executar() {
    const c = this.cliente();
    if (!c || c.motivo) return;
    const f = this.filtros;
    const consulta = this.consulta();
    const filtros = {
      inscricoes: { modulo: f.modulo, situacao: f.situacao },
      carnes: { modulo: f.modulo, ano: f.ano, status: [...f.status] },
      dividas: { modulo: f.moduloDivida, situacao: f.situacaoDivida, ano: f.anoDivida },
    }[consulta];
    this.carregando.set(true);
    this.erro.set('');
    const r = await this.chamar('/consulta', { cliente: c.id, consulta, filtros, limite: f.limite });
    this.carregando.set(false);
    this.consultaDoResultado = consulta;
    this.resultado.set(r);
  }

  private async chamar(caminho: string, corpo?: unknown) {
    try {
      const r = await fetch(SERVIDOR + caminho, {
        method: corpo ? 'POST' : 'GET',
        headers: { 'X-Token': this.token(), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (r.status === 401) {
        this.estado.set('sem-token');
        return null;
      }
      this.estado.set('ok');
      const j = await r.json();
      if (!r.ok) this.erro.set(j.erro ?? `Erro ${r.status}`);
      return r.ok ? j : null;
    } catch {
      this.estado.set('fora');
      return null;
    }
  }

  formatar(coluna: string, v: unknown): string {
    if (v === null || v === undefined) return '';
    if (MOEDA.has(coluna)) return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (coluna === 'status') {
      const n = Number(v);
      return `${n} · ${(this.consultaDoResultado === 'dividas' ? STATUS_DIVIDA : STATUS_CARNE)[n] ?? '?'}`;
    }
    if (coluna === 'tipo_carne') return TIPO_CARNE[Number(v)] || String(v);
    if (coluna === 'ajuizada') return AJUIZADA[String(v)] ?? String(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    return String(v).trim();
  }

  copiar(coluna: string, v: unknown) {
    const txt = coluna === 'status' || coluna === 'tipo_carne' ? String(v ?? '') : this.formatar(coluna, v);
    if (txt) this.ui.copiar(txt, `${ROTULOS[coluna] ?? coluna}: ${txt}`);
  }
}

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function grava(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {}
}

import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { cnpjsDoTexto, cnpjValido, consultarCnpj, DadosCnpj } from '../lib/cnpj';
import { mascarar } from '../lib/docs';
import { lembrado } from '../lib/estado';

interface Linha {
  cnpj: string;
  dados?: DadosCnpj;
  erro?: string;
}

const COLUNAS: [string, (d: DadosCnpj) => string][] = [
  ['razao_social', (d) => d.razaoSocial],
  ['nome_fantasia', (d) => d.nomeFantasia ?? ''],
  ['situacao', (d) => d.situacaoCadastral],
  ['email', (d) => d.email ?? ''],
  ['telefone', (d) => d.telefone ?? ''],
  ['municipio', (d) => d.municipio],
  ['uf', (d) => d.uf],
  ['cnae', (d) => d.cnaes[0]?.cnae ?? ''],
  ['simples', (d) => d.opcaoSimples],
  ['mei', (d) => d.opcaoMei],
];

@Component({
  selector: 'ft-cnpj',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          CNPJ(s)
          @if (cnpjs().length > 1) {
            <span class="ft-selo">{{ cnpjs().length }}</span>
          }
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="4" spellcheck="false" placeholder="Um ou vários CNPJs, com ou sem máscara, em qualquer texto" (keydown.control.enter)="consultar()"></textarea>
      </div>
      <div class="ft-linha">
        @if (rodando()) {
          <button class="btn" (click)="parar()">Parar</button>
          <span class="ft-dica">{{ linhas().length }} de {{ cnpjs().length }}...</span>
        } @else {
          <button class="btn primario" (click)="consultar()" [disabled]="!cnpjs().length">Consultar</button>
        }
        @if (linhas().length > 1) {
          <span class="ft-selo ok">{{ ok() }} ok</span>
          @if (linhas().length - ok(); as e) {
            <span class="ft-selo erro">{{ e }} erro(s)</span>
          }
          <button class="btn mini fim" (click)="ui.copiar(csv())">Copiar CSV</button>
        }
      </div>

      @if (linhas().length === 1 && !rodando()) {
        @if (linhas()[0]; as l) {
          @if (l.erro) {
            <p class="ft-aviso">{{ l.erro }}</p>
          } @else if (l.dados; as d) {
            <dl class="ft-kv">
              @for (c of campos(d); track c[0]) {
                <dt>{{ c[0] }}</dt>
                <dd class="ft-copia" (click)="ui.copiar(c[1])">{{ c[1] || '—' }}</dd>
              }
            </dl>
            @if (d.cnaes.length) {
              <div class="ft-painel">
                <h4 class="ft-titulo">CNAEs <span class="ft-selo">1º = principal</span></h4>
                <table class="ft-tabela">
                  <tbody>
                    @for (c of d.cnaes; track c.cnae) {
                      <tr><td class="ft-mono ft-copia" (click)="ui.copiar(c.cnae)">{{ c.cnae }}</td><td>{{ c.descricao }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (d.socios.length) {
              <div class="ft-painel">
                <h4 class="ft-titulo">Sócios</h4>
                <table class="ft-tabela">
                  <thead><tr><th>Nome</th><th>Qualificação</th><th>CPF/CNPJ</th><th>Entrada</th></tr></thead>
                  <tbody>
                    @for (s of d.socios; track $index) {
                      <tr><td>{{ s.nomeSocio }}</td><td>{{ s.descricao }}</td><td class="ft-mono">{{ s.cnpjCpfSocio }}</td><td>{{ s.dataEntradaSociedade }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        }
      } @else if (linhas().length) {
        <div class="ft-painel cnpj-lote">
          <table class="ft-tabela">
            <thead><tr><th>CNPJ</th><th>Razão social</th><th>Situação</th><th>E-mail</th><th>Município</th><th>Simples</th></tr></thead>
            <tbody>
              @for (l of linhas(); track l.cnpj) {
                <tr>
                  <td class="ft-mono ft-copia" (click)="ui.copiar(l.cnpj)">{{ l.cnpj }}</td>
                  @if (l.dados; as d) {
                    <td>{{ d.razaoSocial }}</td>
                    <td [class.erro]="d.situacaoCadastral !== 'Ativa'">{{ d.situacaoCadastral }}</td>
                    <td class="ft-copia" (click)="ui.copiar(d.email ?? '')">{{ d.email?.toLowerCase() || '—' }}</td>
                    <td>{{ d.municipio }}/{{ d.uf }}</td>
                    <td>{{ d.opcaoMei === 'S' ? 'MEI' : d.opcaoSimples === 'S' ? 'Sim' : 'Não' }}</td>
                  } @else {
                    <td colspan="5" class="erro">{{ l.erro }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">Consulta na kitana (opencnpj), dados da Receita; precisa de internet. Vários CNPJs: uma consulta a cada 0,25 s. Ctrl+Enter consulta.</p>
    </div>
  `,
  styles: `
    .cnpj-lote {
      overflow-x: auto;
    }
    .cnpj-lote .erro {
      color: var(--perigo);
    }
  `,
})
export class CnpjTool implements OnDestroy {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('cnpj.texto', '');
  protected readonly cnpjs = computed(() => cnpjsDoTexto(this.texto()));
  protected readonly linhas = signal<Linha[]>([]);
  protected readonly rodando = signal(false);
  protected readonly ok = computed(() => this.linhas().filter((l) => l.dados).length);
  private parado = false;

  ngOnDestroy() {
    this.parado = true;
  }

  campos(d: DadosCnpj): [string, string][] {
    const end = [d.logradouro, d.numero, d.complemento, d.bairro].filter(Boolean).join(', ');
    return [
      ['CNPJ', mascarar('CNPJ', d.cnpj)],
      ['Razão social', d.razaoSocial],
      ['Nome fantasia', d.nomeFantasia ?? ''],
      ['Situação', `${d.situacaoCadastral} desde ${d.dataSituacaoCadastral}${d.motivoSituacaoCadastral && d.motivoSituacaoCadastral !== 'SEM MOTIVO' ? ` (${d.motivoSituacaoCadastral})` : ''}`],
      ['Situação especial', d.situacaoEspecial ?? ''],
      ['Abertura', d.dataInicioAtividades],
      ['Matriz', d.matriz],
      ['Natureza jurídica', d.naturezaJuridica],
      ['Capital social', d.capitalSocial?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? ''],
      ['Simples / MEI', `${d.opcaoSimples === 'S' ? 'Sim' : 'Não'} / ${d.opcaoMei === 'S' ? 'Sim' : 'Não'}`],
      ['E-mail', d.email?.toLowerCase() ?? ''],
      ['Telefone', d.telefone ?? ''],
      ['Endereço', end],
      ['Município', `${d.municipio}/${d.uf}`],
      ['CEP', d.cep],
    ];
  }

  async consultar() {
    const lista = this.cnpjs();
    if (!lista.length || this.rodando()) return;
    this.parado = false;
    this.rodando.set(true);
    this.linhas.set([]);
    for (const [i, c] of lista.entries()) {
      if (this.parado) break;
      if (i) await new Promise((r) => setTimeout(r, 250));
      let l: Linha;
      if (!cnpjValido(c)) l = { cnpj: c, erro: 'CNPJ inválido.' };
      else
        try {
          l = { cnpj: c, dados: await consultarCnpj(c) };
        } catch (e) {
          l = { cnpj: c, erro: (e as Error).message };
        }
      this.linhas.update((x) => [...x, l]);
    }
    this.rodando.set(false);
  }

  parar() {
    this.parado = true;
  }

  protected readonly csv = computed(() => {
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return [
      ['cnpj', ...COLUNAS.map((c) => c[0]), 'erro'].join(';'),
      ...this.linhas().map((l) => [l.cnpj, ...COLUNAS.map((c) => (l.dados ? c[1](l.dados) : '')), l.erro ?? ''].map(esc).join(';')),
    ].join('\n');
  });
}

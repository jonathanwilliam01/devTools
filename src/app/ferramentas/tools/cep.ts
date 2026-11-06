import { Component, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';

interface Endereco {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  ddd: string;
}

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

@Component({
  selector: 'ft-cep',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Por CEP</h4>
          <div class="ft-linha">
            <input class="ft-mono" [(ngModel)]="cep" placeholder="00000-000" (keydown.enter)="porCep()" style="flex: 1" />
            <button class="btn primario" (click)="porCep()" [disabled]="carregando()">Buscar</button>
          </div>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Por endereço</h4>
          <div class="ft-linha">
            <select [(ngModel)]="uf">
              @for (u of UFS; track u) {
                <option>{{ u }}</option>
              }
            </select>
            <input [(ngModel)]="cidade" placeholder="Cidade" style="flex: 1" />
          </div>
          <div class="ft-linha">
            <input [(ngModel)]="rua" placeholder="Logradouro (mín. 3 letras)" (keydown.enter)="porEndereco()" style="flex: 1" />
            <button class="btn primario" (click)="porEndereco()" [disabled]="carregando()">Buscar</button>
          </div>
        </div>
      </div>

      @if (erro()) {
        <p class="ft-aviso">{{ erro() }}</p>
      }
      @if (lista().length === 1) {
        <dl class="ft-kv">
          @for (c of campos(lista()[0]); track c[0]) {
            <dt>{{ c[0] }}</dt>
            <dd class="ft-copia" (click)="ui.copiar(c[1])">{{ c[1] || '—' }}</dd>
          }
        </dl>
      } @else if (lista().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">{{ lista().length }} resultado(s)</h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>CEP</th><th>Logradouro</th><th>Complemento</th><th>Bairro</th><th>Cidade</th><th>IBGE</th></tr>
            </thead>
            <tbody>
              @for (e of lista(); track $index) {
                <tr>
                  <td class="ft-mono ft-copia" (click)="ui.copiar(e.cep)">{{ e.cep }}</td>
                  <td>{{ e.logradouro }}</td>
                  <td>{{ e.complemento }}</td>
                  <td>{{ e.bairro }}</td>
                  <td>{{ e.localidade }}/{{ e.uf }}</td>
                  <td class="ft-mono ft-copia" (click)="ui.copiar(e.ibge)">{{ e.ibge }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">Consulta no ViaCEP (precisa de internet). Clique no valor para copiar.</p>
    </div>
  `,
})
export class Cep {
  protected readonly ui = inject(Ui);
  protected readonly UFS = UFS;
  protected readonly cep = lembrado('cep.cep', '');
  protected readonly uf = lembrado('cep.uf', 'SP');
  protected readonly cidade = lembrado('cep.cidade', '');
  protected readonly rua = lembrado('cep.rua', '');
  protected readonly lista = signal<Endereco[]>([]);
  protected readonly erro = signal('');
  protected readonly carregando = signal(false);

  constructor() {
    if (this.cep().replace(/\D/g, '').length === 8) this.porCep();
  }

  campos(e: Endereco): [string, string][] {
    return [
      ['CEP', e.cep],
      ['Logradouro', e.logradouro],
      ['Complemento', e.complemento],
      ['Bairro', e.bairro],
      ['Cidade', e.localidade],
      ['UF', e.uf],
      ['Código IBGE', e.ibge],
      ['DDD', e.ddd],
    ];
  }

  porCep() {
    const c = this.cep().replace(/\D/g, '');
    if (c.length !== 8) return this.erro.set('CEP precisa ter 8 dígitos.');
    this.buscar(`${c}/json/`);
  }

  porEndereco() {
    const [cidade, rua] = [this.cidade().trim(), this.rua().trim()];
    if (cidade.length < 3 || rua.length < 3) return this.erro.set('Cidade e logradouro precisam de ao menos 3 letras.');
    this.buscar(`${this.uf()}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`);
  }

  private async buscar(caminho: string) {
    this.erro.set('');
    this.lista.set([]);
    this.carregando.set(true);
    try {
      const r = await fetch('https://viacep.com.br/ws/' + caminho);
      if (!r.ok) throw new Error(`ViaCEP respondeu ${r.status}.`);
      const j = await r.json();
      const l: Endereco[] = Array.isArray(j) ? j : j.erro ? [] : [j];
      if (!l.length) this.erro.set('Nada encontrado.');
      this.lista.set(l);
    } catch (e) {
      this.erro.set(e instanceof TypeError ? 'Sem conexão com o ViaCEP.' : (e as Error).message);
    } finally {
      this.carregando.set(false);
    }
  }
}

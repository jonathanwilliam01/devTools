import { Component, computed, inject } from '@angular/core';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { lerCron, proximas } from '../lib/cron';

type Unidade = 'seg' | 'min' | 'hora' | 'dia' | 'semana' | 'mes';
const UNIDADES: [Unidade, string][] = [
  ['seg', 'segundos'],
  ['min', 'minutos'],
  ['hora', 'horas'],
  ['dia', 'dias'],
  ['semana', 'semana'],
  ['mes', 'meses'],
];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const EXEMPLOS = ['*/5 * * * *', '0 9 * * 1-5', '30 2 * * *', '0 0 1 * *', '0 8-18/2 * * MON-FRI'];

@Component({
  selector: 'ft-cron',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-seg">
        <button [class.on]="modo() === 'expr'" (click)="modo.set('expr')">Expressão</button>
        <button [class.on]="modo() === 'montar'" (click)="modo.set('montar')">Montar intervalo</button>
      </div>
      @if (modo() === 'expr') {
        <div class="ft-painel">
          <h4 class="ft-titulo">Expressão</h4>
          <input class="ft-mono" style="font-size: 18px" [(ngModel)]="expr" placeholder="* * * * *" spellcheck="false" />
          <div class="ft-linha">
            @for (e of EXEMPLOS; track e) {
              <button class="btn mini ghost ft-mono" (click)="expr.set(e)">{{ e }}</button>
            }
          </div>
        </div>
      } @else {
        <div class="ft-painel">
          <h4 class="ft-titulo">Executar</h4>
          <div class="ft-linha">
            <span>{{ unidade() === 'semana' ? 'Toda' : 'A cada' }}</span>
            @if (unidade() !== 'semana') {
              <input type="number" min="1" [(ngModel)]="n" style="width: 80px" />
            }
            <select [(ngModel)]="unidade">
              @for (u of UNIDADES; track u[0]) {
                <option [value]="u[0]">{{ u[1] }}</option>
              }
            </select>
            @if (unidade() === 'semana') {
              <select [(ngModel)]="diaSemana">
                @for (d of SEMANA; track $index) {
                  <option [ngValue]="$index">{{ d }}</option>
                }
              </select>
            }
            @if (unidade() === 'mes') {
              <label class="ft-rotulo">no dia <input type="number" min="1" max="31" [(ngModel)]="diaMes" style="width: 70px" /></label>
            }
            @if (unidade() === 'hora') {
              <label class="ft-rotulo">no minuto <input type="number" min="0" max="59" [(ngModel)]="minuto" style="width: 70px" /></label>
            }
            @if (unidade() === 'dia' || unidade() === 'semana' || unidade() === 'mes') {
              <label class="ft-rotulo">às <input type="time" [(ngModel)]="hora" /></label>
            }
          </div>
          @if (podeUteis()) {
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="uteis" /> Só de segunda a sexta</label>
          }
          <button class="ft-valor ft-mono" style="font-size: 18px" (click)="ui.copiar(gerado())">{{ gerado() }}</button>
          <div class="ft-linha">
            <button class="btn mini ghost" (click)="editar()">Editar como expressão</button>
          </div>
        </div>
      }
      @if (resultado(); as r) {
        @if (r.erro) {
          <p class="ft-aviso">{{ r.erro }}</p>
        } @else {
          <p class="ft-aviso ok" style="font-size: 16px">{{ r.descricao }}</p>
          <div class="ft-duas">
            <dl class="ft-kv">
              @for (c of r.campos; track c; let i = $index) {
                <dt>{{ c }}</dt>
                <dd>{{ r.partes[i] }}</dd>
              }
            </dl>
            <div class="ft-painel">
              <h4 class="ft-titulo">Próximas execuções</h4>
              <table class="ft-tabela">
                <tbody>
                  @for (d of r.proximas; track $index) {
                    <tr><td class="ft-mono">{{ data(d) }}</td></tr>
                  } @empty {
                    <tr><td>Nenhuma data encontrada.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
      <p class="ft-dica">Aceita 5 campos ou 6 com segundo no início, *, listas (1,15), faixas (1-5), passos (*/10), nomes (JAN, MON) e atalhos como &#64;daily. Horário deste navegador.</p>
    </div>
  `,
})
export class CronTool {
  protected readonly ui = inject(Ui);
  protected readonly EXEMPLOS = EXEMPLOS;
  protected readonly UNIDADES = UNIDADES;
  protected readonly SEMANA = SEMANA;
  protected readonly expr = lembrado('cron.expr', '0 9 * * 1-5');
  protected readonly modo = lembrado<'expr' | 'montar'>('cron.modo', 'expr');
  protected readonly unidade = lembrado<Unidade>('cron.unidade', 'min');
  protected readonly n = lembrado<number | null>('cron.n', 15);
  protected readonly hora = lembrado('cron.hora', '08:00');
  protected readonly minuto = lembrado<number | null>('cron.minuto', 0);
  protected readonly diaSemana = lembrado('cron.diaSemana', 1);
  protected readonly diaMes = lembrado<number | null>('cron.diaMes', 1);
  protected readonly uteis = lembrado('cron.uteis', false);

  // dia do mês e da semana juntos viram "ou" no cron
  protected readonly podeUteis = computed(() => ['seg', 'min', 'hora'].includes(this.unidade()) || (this.unidade() === 'dia' && (this.n() ?? 1) <= 1));

  protected readonly gerado = computed(() => {
    const n = Math.max(1, Math.trunc(this.n() ?? 1));
    const passo = n === 1 ? '*' : `*/${n}`;
    const [h, m] = (this.hora() || '00:00').split(':').map(Number);
    const ds = this.uteis() && this.podeUteis() ? '1-5' : '*';
    switch (this.unidade()) {
      case 'seg': return `${passo} * * * * ${ds}`;
      case 'min': return `${passo} * * * ${ds}`;
      case 'hora': return `${this.minuto() ?? 0} ${passo} * * ${ds}`;
      case 'dia': return `${m} ${h} ${passo} * ${ds}`;
      case 'semana': return `${m} ${h} * * ${this.diaSemana()}`;
      case 'mes': return `${m} ${h} ${this.diaMes() ?? 1} ${passo} *`;
    }
  });

  editar() {
    this.expr.set(this.gerado());
    this.modo.set('expr');
  }

  data(d: Date) {
    const seg = this.modo() === 'montar' ? this.unidade() === 'seg' : this.expr().trim().split(/\s+/).length === 6;
    return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', ...(seg && { second: '2-digit' }) });
  }

  protected readonly resultado = computed(() => {
    const expr = this.modo() === 'montar' ? this.gerado() : this.expr();
    if (!expr.trim()) return null;
    try {
      const c = lerCron(expr);
      return { erro: '', partes: c.partes, campos: c.campos, descricao: c.descricao, proximas: proximas(c, 8) };
    } catch (e) {
      return { erro: (e as Error).message, partes: [], campos: [], descricao: '', proximas: [] };
    }
  });
}

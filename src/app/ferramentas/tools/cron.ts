import { Component, computed } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { CAMPOS_CRON, lerCron, proximas } from '../lib/cron';

const EXEMPLOS = ['*/5 * * * *', '0 9 * * 1-5', '30 2 * * *', '0 0 1 * *', '0 8-18/2 * * MON-FRI'];

@Component({
  selector: 'ft-cron',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">Expressão</h4>
        <input class="ft-mono" style="font-size: 18px" [(ngModel)]="expr" placeholder="* * * * *" spellcheck="false" />
        <div class="ft-linha">
          @for (e of EXEMPLOS; track e) {
            <button class="btn mini ghost ft-mono" (click)="expr.set(e)">{{ e }}</button>
          }
        </div>
      </div>
      @if (resultado(); as r) {
        @if (r.erro) {
          <p class="ft-aviso">{{ r.erro }}</p>
        } @else {
          <p class="ft-aviso ok" style="font-size: 16px">{{ r.descricao }}</p>
          <div class="ft-duas">
            <dl class="ft-kv">
              @for (c of CAMPOS; track c; let i = $index) {
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
      <p class="ft-dica">Aceita *, listas (1,15), faixas (1-5), passos (*/10), nomes (JAN, MON) e atalhos como &#64;daily. Horário deste navegador.</p>
    </div>
  `,
})
export class CronTool {
  protected readonly EXEMPLOS = EXEMPLOS;
  protected readonly CAMPOS = CAMPOS_CRON;
  protected readonly expr = lembrado('cron.expr', '0 9 * * 1-5');

  data(d: Date) {
    return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected readonly resultado = computed(() => {
    if (!this.expr().trim()) return null;
    try {
      const c = lerCron(this.expr());
      return { erro: '', partes: c.partes, descricao: c.descricao, proximas: proximas(c, 8) };
    } catch (e) {
      return { erro: (e as Error).message, partes: [], descricao: '', proximas: [] };
    }
  });
}

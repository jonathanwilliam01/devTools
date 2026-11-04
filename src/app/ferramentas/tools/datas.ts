import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { contarUteis, deIso, DIA, diferencaCalendario, extenso, feriadosNoPeriodo, hojeIso, paraIso, somarUteis } from '../lib/datas';

@Component({
  selector: 'ft-datas',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="usarFeriados" /> Considerar feriados nacionais</label>
        <label class="ft-chk" [style.opacity]="usarFeriados() ? 1 : 0.4">
          <input type="checkbox" [(ngModel)]="facultativos" [disabled]="!usarFeriados()" /> Incluir Carnaval e Corpus Christi
        </label>
      </div>

      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Diferença entre datas</h4>
          <div class="ft-linha">
            <label class="ft-rotulo">Início <input type="date" [(ngModel)]="inicio" /></label>
            <span>→</span>
            <label class="ft-rotulo">Fim <input type="date" [(ngModel)]="fim" /></label>
            <button class="btn mini ghost" (click)="inverter()" title="Trocar">⇄</button>
          </div>
          @if (diferenca(); as d) {
            <div class="ft-numeros">
              <button class="ft-numero ft-copia" (click)="ui.copiar(d.corridos + '')">
                <span class="ft-grande">{{ d.corridos }}</span> dias corridos
              </button>
              <button class="ft-numero ft-copia" (click)="ui.copiar(d.uteis + '')">
                <span class="ft-grande">{{ d.uteis }}</span> dias úteis
              </button>
            </div>
            <dl class="ft-kv">
              <dt>Calendário</dt>
              <dd>{{ d.cal }}</dd>
              <dt>Semanas</dt>
              <dd>{{ d.semanas }}</dd>
              @if (d.feriados.length) {
                <dt>Feriados no período</dt>
                <dd>
                  @for (f of d.feriados; track f[0]) {
                    <div>{{ f[1] }}</div>
                  }
                </dd>
              }
            </dl>
            <p class="ft-dica">Dias úteis contados após o início até o fim (inclui o último dia).</p>
          }
        </div>

        <div class="ft-painel">
          <h4 class="ft-titulo">Somar ou subtrair dias</h4>
          <div class="ft-linha">
            <label class="ft-rotulo">Data <input type="date" [(ngModel)]="base" /></label>
            <label class="ft-rotulo">Dias <input type="number" [(ngModel)]="dias" style="width: 100px" /></label>
          </div>
          <div class="ft-seg">
            <button [class.on]="!somarUteis()" (click)="somarUteis.set(false)">Corridos</button>
            <button [class.on]="somarUteis()" (click)="somarUteis.set(true)">Úteis</button>
          </div>
          @if (soma(); as s) {
            <button class="ft-valor" (click)="ui.copiar(s.br)">{{ s.extenso }}</button>
          }
          <p class="ft-dica">Use número negativo para voltar no tempo.</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .ft-numeros {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .ft-numero {
      all: unset;
      display: grid;
      gap: 4px;
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--bg-2);
      color: var(--texto-2);
      font-size: 13px;
    }
    .ft-numero .ft-grande {
      color: var(--texto);
    }
  `,
})
export class Datas {
  protected readonly ui = inject(Ui);
  protected readonly usarFeriados = signal(true);
  protected readonly facultativos = signal(false);
  protected readonly inicio = signal(hojeIso());
  protected readonly fim = signal(paraIso(deIso(hojeIso()) + 30 * DIA));
  protected readonly base = signal(hojeIso());
  protected readonly dias = signal<number | null>(30);
  protected readonly somarUteis = signal(false);

  private readonly opcoes = computed(() => ({ feriados: this.usarFeriados(), facultativos: this.facultativos() }));

  protected readonly diferenca = computed(() => {
    const [a, b] = [deIso(this.inicio()), deIso(this.fim())];
    if (isNaN(a) || isNaN(b)) return null;
    const corridos = Math.round((b - a) / DIA);
    const c = diferencaCalendario(a, b);
    const partes = [
      c.anos && `${c.anos} ano${c.anos > 1 ? 's' : ''}`,
      c.meses && `${c.meses} ${c.meses > 1 ? 'meses' : 'mês'}`,
      `${c.dias} dia${c.dias === 1 ? '' : 's'}`,
    ].filter(Boolean);
    return {
      corridos,
      uteis: contarUteis(a, b, this.opcoes()),
      cal: (corridos < 0 ? '− ' : '') + partes.join(', '),
      semanas: `${Math.trunc(corridos / 7)} semana(s) e ${Math.abs(corridos % 7)} dia(s)`,
      feriados: this.usarFeriados() ? feriadosNoPeriodo(a, b, this.opcoes()).map(([ms, nome]) => [ms, `${extenso(ms)} · ${nome}`]) : [],
    };
  });

  protected readonly soma = computed(() => {
    const base = deIso(this.base());
    const n = this.dias() ?? 0;
    if (isNaN(base)) return null;
    const ms = this.somarUteis() ? somarUteis(base, n, this.opcoes()) : base + n * DIA;
    return { extenso: extenso(ms), br: new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) };
  });

  inverter() {
    const i = this.inicio();
    this.inicio.set(this.fim());
    this.fim.set(i);
  }
}

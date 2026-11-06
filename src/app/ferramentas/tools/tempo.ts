import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';

const DELPHI_ZERO = Date.UTC(1899, 11, 30);
const DIA = 86_400_000;
const offset = (ms: number) => new Date(ms).getTimezoneOffset() * 60_000;

function interpretar(v: string): [number, string] | null {
  const s = v.trim();
  if (!s) return null;
  if (/^-?\d{1,6}([.,]\d+)?$/.test(s)) {
    const local = DELPHI_ZERO + parseFloat(s.replace(',', '.')) * DIA;
    return [local + offset(local), 'TDateTime (Delphi)'];
  }
  if (/^-?\d{7,11}$/.test(s)) return [+s * 1000, 'Unix em segundos'];
  if (/^-?\d{12,}$/.test(s)) return [+s, 'Unix em milissegundos'];
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, d, m, a, h = '0', mi = '0', se = '0'] = br;
    return [new Date(+a, +m - 1, +d, +h, +mi, +se).getTime(), 'Data (dd/mm/aaaa)'];
  }
  const ms = Date.parse(s);
  return isNaN(ms) ? null : [ms, 'Data / ISO 8601'];
}

function relativo(ms: number) {
  const seg = Math.round((ms - Date.now()) / 1000);
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const [u, t] = unidades.find(([, t]) => Math.abs(seg) >= t) ?? ['second', 1];
  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(Math.round(seg / t), u);
}

@Component({
  selector: 'ft-tempo',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Agora
          <button class="btn mini fim" (click)="entrada.set(agoraS() + '')">Usar</button>
        </h4>
        <button class="ft-valor" (click)="ui.copiar(agoraS() + '')">{{ agoraS() }}</button>
      </div>

      <div class="ft-painel">
        <h4 class="ft-titulo">
          Converter
          @if (lido(); as l) {
            <span class="fim ft-selo ok">{{ l[1] }}</span>
          }
        </h4>
        <input class="ft-mono" [(ngModel)]="entrada" placeholder="1730000000 · 1730000000000 · 2026-11-04T10:00 · 04/11/2026 10:00 · 46330,5" />
        @if (entrada().trim() && !lido()) {
          <p class="ft-aviso">Valor não reconhecido.</p>
        }
        @if (linhas(); as ls) {
          <dl class="ft-kv">
            @for (l of ls; track l[0]) {
              <dt>{{ l[0] }}</dt>
              <dd class="ft-copia" (click)="ui.copiar(l[1])">{{ l[1] }}</dd>
            }
          </dl>
        }
        <p class="ft-dica">Até 6 dígitos (com decimais opcionais) é tratado como TDateTime do Delphi; 7 a 11 dígitos, Unix em segundos; 12 ou mais, milissegundos.</p>
      </div>
    </div>
  `,
})
export class Tempo {
  protected readonly ui = inject(Ui);
  protected readonly entrada = lembrado('tempo.entrada', '');
  private readonly agora = signal(Date.now());
  protected readonly agoraS = computed(() => Math.floor(this.agora() / 1000));

  protected readonly lido = computed(() => interpretar(this.entrada()));

  protected readonly linhas = computed(() => {
    const l = this.lido();
    if (!l) return null;
    const ms = l[0];
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    const delphi = (ms - offset(ms) - DELPHI_ZERO) / DIA;
    return [
      ['Unix (s)', String(Math.floor(ms / 1000))],
      ['Unix (ms)', String(ms)],
      ['Local', d.toLocaleString('pt-BR')],
      ['ISO 8601 (UTC)', d.toISOString()],
      ['ISO local', new Date(ms - offset(ms)).toISOString().slice(0, 19)],
      ['TDateTime (Delphi)', delphi.toFixed(8).replace(/\.?0+$/, '')],
      ['Relativo', relativo(ms)],
    ];
  });

  constructor() {
    const t = setInterval(() => this.agora.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }
}

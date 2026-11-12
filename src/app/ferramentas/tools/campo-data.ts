import { Component, linkedSignal, model } from '@angular/core';
import { deIso, hojeIso, paraIso } from '../lib/datas';

const paraBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');

// data digitável dd/mm/aaaa ligada a um valor ISO, com calendário e Hoje
@Component({
  selector: 'ft-data',
  template: `
    <span class="cd">
      <input
        class="ft-mono"
        inputmode="numeric"
        placeholder="dd/mm/aaaa"
        maxlength="10"
        spellcheck="false"
        [value]="texto()"
        (input)="digitar($any($event.target))"
        (blur)="texto.set(br())"
      />
      <button type="button" class="btn mini ghost" title="Calendário" (click)="abrir(cal)">▦</button>
      <input #cal type="date" tabindex="-1" class="cd-cal" [value]="valor()" (change)="valor.set(cal.value)" />
      <button type="button" class="btn mini ghost" title="Data de hoje" (click)="valor.set(hoje())">Hoje</button>
    </span>
  `,
  styles: `
    .cd {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .cd input:first-child {
      width: 120px;
    }
    .cd input.ft-erro {
      border-color: var(--perigo);
    }
    .cd-cal {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `,
})
export class CampoData {
  readonly valor = model('');
  protected readonly br = () => paraBr(this.valor());
  protected readonly texto = linkedSignal(() => paraBr(this.valor()));
  protected readonly hoje = hojeIso;

  digitar(el: HTMLInputElement) {
    const v = el.value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return this.aceitar(v, el);
    const d = v.replace(/\D/g, '').slice(0, 8);
    const t = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
    el.value = t;
    this.texto.set(t);
    if (d.length === 8) this.aceitar(`${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`, el);
  }

  private aceitar(iso: string, el: HTMLInputElement) {
    const ms = deIso(iso);
    const ok = !isNaN(ms) && paraIso(ms) === iso;
    el.classList.toggle('ft-erro', !ok);
    if (ok) this.valor.set(iso);
  }

  abrir(cal: HTMLInputElement) {
    try {
      cal.showPicker();
    } catch {
      cal.focus();
    }
  }
}

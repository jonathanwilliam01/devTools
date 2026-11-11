import { Component, input, model } from '@angular/core';

export interface OpcaoVista<T> {
  v: T;
  i: string;
  t: string;
}

export type Texto = 'texto' | 'md';
export type VistaLista = 'baixo' | 'lado';

export const LISTAS = [
  { v: 'baixo', i: '☰', t: 'Lista com prévia embaixo' },
  { v: 'lado', i: '◫', t: 'Lista com prévia ao lado' },
] as const;

// seletor de visualização + texto normal/markdown
@Component({
  selector: 'app-vistas',
  host: { class: 'vistas' },
  template: `
    <div class="seg">
      @for (o of opcoes(); track o.v) {
        <button type="button" class="btn mini ghost" [class.on]="vista() === o.v" (click)="vista.set(o.v)" [title]="o.t">{{ o.i }}</button>
      }
    </div>
    @if (comTexto()) {
    <div class="seg">
      <button type="button" class="btn mini ghost" [class.on]="texto() === 'texto'" (click)="texto.set('texto')" title="Texto normal">Aa</button>
      <button type="button" class="btn mini ghost" [class.on]="texto() === 'md'" (click)="texto.set('md')" title="Markdown formatado">M↓</button>
    </div>
    }
  `,
})
export class Vistas<T extends string> {
  readonly opcoes = input.required<readonly OpcaoVista<T>[]>();
  readonly vista = model.required<T>();
  readonly texto = model<Texto>('texto');
  readonly comTexto = input(true);
}

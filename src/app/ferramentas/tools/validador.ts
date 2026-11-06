import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { identificar, limpar, mascarar, valido } from '../lib/docs';

@Component({
  selector: 'ft-validador',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Documentos
          @if (resumo(); as r) {
            <span class="fim ft-selo ok">{{ r.ok }} válido(s)</span>
            @if (r.erro) {
              <span class="ft-selo erro">{{ r.erro }} inválido(s)</span>
            }
          }
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="5" placeholder="529.982.247-25&#10;11222333000181&#10;12.ABC.345/01DE-35"></textarea>
      </div>
      @if (linhas().length) {
        <div class="ft-painel">
          <table class="ft-tabela">
            <thead>
              <tr><th>Informado</th><th>Tipo</th><th>Situação</th><th>Com máscara</th><th>Sem máscara</th></tr>
            </thead>
            <tbody>
              @for (l of linhas(); track $index) {
                <tr>
                  <td class="ft-mono">{{ l.entrada }}</td>
                  <td>{{ l.tipo ?? '—' }}</td>
                  <td>
                    @if (!l.tipo) {
                      <span class="ft-selo erro">Formato desconhecido</span>
                    } @else if (l.ok) {
                      <span class="ft-selo ok">✓ Válido</span>
                    } @else {
                      <span class="ft-selo erro">✕ Inválido</span>
                    }
                  </td>
                  <td class="ft-mono ft-copia" (click)="l.tipo && ui.copiar(l.com)">{{ l.tipo ? l.com : '' }}</td>
                  <td class="ft-mono ft-copia" (click)="l.tipo && ui.copiar(l.sem)">{{ l.tipo ? l.sem : '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="ft-dica">RG validado pela regra de SP (8 dígitos + DV). 8 dígitos sem DV são tratados como CEP.</p>
      }
    </div>
  `,
})
export class Validador {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('validador.texto', '');

  protected readonly linhas = computed(() =>
    this.texto()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((entrada) => {
        const tipo = identificar(entrada);
        return {
          entrada,
          tipo: tipo === 'CEP' ? null : tipo,
          ok: !!tipo && tipo !== 'CEP' && valido(tipo, entrada),
          com: tipo ? mascarar(tipo, entrada) : '',
          sem: limpar(entrada),
        };
      }),
  );

  protected readonly resumo = computed(() => {
    const l = this.linhas();
    if (!l.length) return null;
    const ok = l.filter((x) => x.ok).length;
    return { ok, erro: l.length - ok };
  });
}

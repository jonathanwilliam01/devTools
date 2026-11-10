import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { contar, extrair, PADROES, TipoExtrair } from '../lib/extrair';

const TIPOS = Object.entries(PADROES).map(([id, p]) => ({ id: id as TipoExtrair, nome: p.nome, doc: !!p.doc }));

@Component({
  selector: 'ft-extrair',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg" style="flex-wrap: wrap">
          @for (t of TIPOS; track t.id) {
            <button [class.on]="tipo() === t.id" (click)="tipo.set(t.id)">{{ t.nome }} <small>{{ contagem()[t.id] }}</small></button>
          }
        </div>
      </div>
      <div class="ft-linha">
        @if (temDoc()) {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="validos" /> Só válidos</label>
          <div class="ft-seg">
            <button [class.on]="mascara() === 'manter'" (click)="mascara.set('manter')">Como está</button>
            <button [class.on]="mascara() === 'tirar'" (click)="mascara.set('tirar')">Sem máscara</button>
            <button [class.on]="mascara() === 'por'" (click)="mascara.set('por')">Com máscara</button>
          </div>
        }
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="distintos" /> Sem repetidos</label>
        <div class="ft-seg">
          <button [class.on]="saidaFmt() === 'linha'" (click)="saidaFmt.set('linha')">Um por linha</button>
          <button [class.on]="saidaFmt() === 'virgula'" (click)="saidaFmt.set('virgula')">Vírgula</button>
          <button [class.on]="saidaFmt() === 'sql'" (click)="saidaFmt.set('sql')" title="'a', 'b' para usar em IN">Aspas SQL</button>
        </div>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="12" spellcheck="false" placeholder="Log, e-mail, planilha, resultado de consulta..."></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Encontrados
            <span class="ft-selo" [class.ok]="itens().length">{{ itens().length }}</span>
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="12" [value]="saida()"></textarea>
        </div>
      </div>
      <p class="ft-dica">CPF e CNPJ pegam com ou sem máscara (CNPJ alfanumérico só com máscara); "Só válidos" confere o dígito. Telefone e CEP só no formato com traço, para não confundir com outros números.</p>
    </div>
  `,
})
export class Extrair {
  protected readonly ui = inject(Ui);
  protected readonly TIPOS = TIPOS;
  protected readonly texto = lembrado('extrair.texto', '');
  protected readonly tipo = lembrado<TipoExtrair>('extrair.tipo', 'cpf');
  protected readonly validos = lembrado('extrair.validos', true);
  protected readonly distintos = lembrado('extrair.distintos', true);
  protected readonly mascara = lembrado<'manter' | 'tirar' | 'por'>('extrair.mascara', 'manter');
  protected readonly saidaFmt = lembrado<'linha' | 'virgula' | 'sql'>('extrair.saida', 'linha');

  protected readonly temDoc = computed(() => !!PADROES[this.tipo()].doc);
  protected readonly contagem = computed(() => contar(this.texto()));
  protected readonly itens = computed(() =>
    extrair(this.texto(), this.tipo(), { validos: this.validos(), distintos: this.distintos(), mascara: this.mascara() }),
  );
  protected readonly saida = computed(() => {
    const l = this.itens();
    const f = this.saidaFmt();
    if (f === 'linha') return l.join('\n');
    if (f === 'virgula') return l.join(', ');
    return l.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  });
}

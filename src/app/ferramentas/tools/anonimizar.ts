import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { anonimizar, CHAVES, ModoAnonimo, TipoAnonimo } from '../lib/anonimizar';
import { lembrado } from '../lib/estado';

const TIPOS: [TipoAnonimo, string][] = [
  ['campos', 'Campos pelo nome'],
  ['cpf', 'CPF'],
  ['cnpj', 'CNPJ'],
  ['email', 'E-mail'],
  ['telefone', 'Telefone'],
  ['cep', 'CEP'],
  ['ip', 'IP'],
  ['termos', 'Outros termos'],
];

@Component({
  selector: 'ft-anonimizar',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        @for (t of TIPOS; track t[0]) {
          <label class="ft-chk"><input type="checkbox" [checked]="tipos().includes(t[0])" (change)="alternar(t[0])" /> {{ t[1] }}</label>
        }
      </div>
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'parcial'" (click)="modo.set('parcial')" title="***.456.789-**, j***@dominio.com">Parcial</button>
          <button [class.on]="modo() === 'total'" (click)="modo.set('total')" title="***.***.***-**">Total</button>
          <button [class.on]="modo() === 'fake'" (click)="modo.set('fake')" title="Troca por documento válido e e-mail fictício; o mesmo original vira sempre o mesmo falso">Fictício</button>
        </div>
      </div>
      @if (tipos().includes('campos')) {
        <label class="ft-rotulo">Campos sensíveis (parte do nome do campo; o valor vira ***)
          <input class="ft-mono" [(ngModel)]="chaves" spellcheck="false" />
        </label>
      }
      @if (tipos().includes('termos')) {
        <label class="ft-rotulo">Outros termos (um por linha: nomes, inscrições...)
          <textarea class="ft-texto" [(ngModel)]="termos" rows="3" spellcheck="false"></textarea>
        </label>
      }
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Original</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="12" spellcheck="false" placeholder="Log, SQL, JSON, print_r..."></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Anonimizado
            @for (r of resumo(); track r[0]) {
              <span class="ft-selo ok">{{ r[0] }} {{ r[1] }}</span>
            }
            <button class="btn mini fim" [disabled]="!texto()" (click)="ui.copiar(resultado().texto)">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="12" [value]="resultado().texto"></textarea>
        </div>
      </div>
      <p class="ft-dica">Tudo roda no navegador, nada é enviado. CPF e CNPJ só são trocados quando o dígito confere. Campos pelo nome pegam chave=valor, chave: valor, "chave": "valor", 'chave' =&gt; 'valor' e [chave] =&gt; valor. Revise antes de colar na issue.</p>
    </div>
  `,
})
export class Anonimizar {
  protected readonly ui = inject(Ui);
  protected readonly TIPOS = TIPOS;
  protected readonly texto = lembrado('anonimizar.texto', '');
  protected readonly tipos = lembrado<TipoAnonimo[]>('anonimizar.tipos', ['campos', 'cpf', 'cnpj', 'email', 'telefone', 'termos']);
  protected readonly modo = lembrado<ModoAnonimo>('anonimizar.modo', 'parcial');
  protected readonly chaves = lembrado('anonimizar.chaves', CHAVES);
  protected readonly termos = lembrado('anonimizar.termos', '');

  protected readonly resultado = computed(() =>
    anonimizar(this.texto(), { tipos: this.tipos(), modo: this.modo(), chaves: this.chaves(), termos: this.termos() }),
  );
  protected readonly resumo = computed(() =>
    TIPOS.filter(([t]) => this.resultado().qtd[t]).map(([t, nome]) => [nome, this.resultado().qtd[t]!] as const),
  );

  alternar(t: TipoAnonimo) {
    this.tipos.update((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  }
}

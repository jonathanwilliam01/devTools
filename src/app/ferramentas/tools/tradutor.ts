import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { IDIOMAS, traduzir } from '../lib/tradutor';

@Component({
  selector: 'ft-tradutor',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <select [(ngModel)]="de">
          <option value="auto">Detectar idioma</option>
          @for (i of IDIOMAS; track i[0]) {
            <option [value]="i[0]">{{ i[1] }}</option>
          }
        </select>
        <button class="btn mini ghost" title="Inverter" [disabled]="de() === 'auto'" (click)="inverter()">⇄</button>
        <select [(ngModel)]="para">
          @for (i of IDIOMAS; track i[0]) {
            <option [value]="i[0]">{{ i[1] }}</option>
          }
        </select>
        <button class="btn" [disabled]="!texto().trim() || carregando()" (click)="executar()">{{ carregando() ? 'Traduzindo…' : 'Traduzir' }}</button>
        @if (motor()) {
          <span class="ft-selo fim">{{ motor() }}</span>
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" (keydown.control.enter)="executar()" rows="12" placeholder="Cole o texto (Ctrl+Enter traduz)"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Tradução
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="12" [value]="saida()"></textarea>
        </div>
      </div>
      @if (falha()) {
        <p class="ft-aviso">{{ falha() }}</p>
      }
      <p class="ft-dica">
        No Chrome com tradutor embutido a tradução é feita no próprio navegador. Sem ele, o texto vai para a MyMemory (grátis, cerca de 5.000 caracteres por
        dia). Com dados pessoais, passe antes no Anonimizar.
      </p>
    </div>
  `,
})
export class Tradutor {
  protected readonly ui = inject(Ui);
  protected readonly IDIOMAS = IDIOMAS;
  protected readonly texto = lembrado('tradutor.texto', '');
  protected readonly de = lembrado('tradutor.de', 'auto');
  protected readonly para = lembrado('tradutor.para', 'en');
  protected readonly saida = lembrado('tradutor.saida', '');
  protected readonly motor = signal('');
  protected readonly carregando = signal(false);
  protected readonly falha = signal('');

  async executar() {
    if (!this.texto().trim() || this.carregando()) return;
    this.carregando.set(true);
    this.falha.set('');
    try {
      const r = await traduzir(this.texto(), this.de(), this.para());
      this.saida.set(r.texto);
      this.motor.set(r.motor);
    } catch (e) {
      this.falha.set(e instanceof TypeError ? 'Sem conexão com o serviço de tradução.' : (e as Error).message);
    } finally {
      this.carregando.set(false);
    }
  }

  inverter() {
    const d = this.de();
    this.de.set(this.para());
    this.para.set(d);
    if (this.saida()) {
      this.texto.set(this.saida());
      this.saida.set('');
    }
  }
}

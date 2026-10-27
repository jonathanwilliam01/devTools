import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cofre } from '../cofre';
import { Ui } from '../ui';

@Component({
  selector: 'app-painel-cofre',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="fechar.emit()">
      <form class="dialogo" (click)="$event.stopPropagation()" (ngSubmit)="enviar()">
        <h2>Senha mestra</h2>
        @if (!cofre.ativo() || trocando()) {
          <p>
            Cifra os blocos marcados como <b>secreto</b> (AES-256). Sem a senha não há como recuperar o conteúdo, nem pelo
            backup.
          </p>
          <label class="campo">
            {{ trocando() ? 'Nova senha' : 'Senha' }}
            <input type="password" name="s1" [(ngModel)]="senha" autofocus autocomplete="new-password" />
          </label>
          <label class="campo">
            Confirmar
            <input type="password" name="s2" [(ngModel)]="confirma" autocomplete="new-password" />
          </label>
        } @else if (cofre.bloqueado()) {
          <p>Cofre bloqueado. Digite a senha para ver e copiar os blocos secretos.</p>
          <label class="campo">
            Senha
            <input type="password" name="s1" [(ngModel)]="senha" autofocus autocomplete="current-password" />
          </label>
        } @else {
          <p>Cofre aberto. Bloqueia sozinho após 30 minutos sem uso ou ao recarregar a página.</p>
        }
        @if (erro()) {
          <small class="erro">{{ erro() }}</small>
        }
        <div class="rodape">
          @if (cofre.ativo() && !cofre.bloqueado() && !trocando()) {
            <button type="button" class="btn ghost perigo" style="margin-right: auto" (click)="remover()">Remover senha</button>
            <button type="button" class="btn" (click)="trocando.set(true)">Trocar senha</button>
            <button type="button" class="btn primario" (click)="cofre.bloquear(); fechar.emit()">Bloquear</button>
          } @else {
            <button type="button" class="btn" (click)="fechar.emit()">Cancelar</button>
            <button type="submit" class="btn primario" [disabled]="ocupado()">
              {{ cofre.bloqueado() && !trocando() ? 'Desbloquear' : 'Salvar' }}
            </button>
          }
        </div>
      </form>
    </div>
  `,
  styles: `
    p {
      margin: 0;
    }
    .erro {
      color: var(--perigo);
      font-weight: 600;
    }
  `,
})
export class PainelCofre {
  protected readonly cofre = inject(Cofre);
  private readonly ui = inject(Ui);
  readonly fechar = output();
  protected senha = '';
  protected confirma = '';
  protected readonly erro = signal('');
  protected readonly trocando = signal(false);
  protected readonly ocupado = signal(false);

  async enviar() {
    this.erro.set('');
    this.ocupado.set(true);
    try {
      if (this.cofre.bloqueado() && !this.trocando()) {
        if (!(await this.cofre.desbloquear(this.senha))) return this.erro.set('Senha incorreta');
        this.ui.avisar('Cofre aberto');
      } else {
        if (this.senha.length < 6) return this.erro.set('Mínimo de 6 caracteres');
        if (this.senha !== this.confirma) return this.erro.set('As senhas não conferem');
        if (this.trocando()) await this.cofre.trocar(this.senha);
        else await this.cofre.criar(this.senha);
        this.ui.avisar('Senha mestra definida');
      }
      this.fechar.emit();
    } finally {
      this.ocupado.set(false);
    }
  }

  async remover() {
    if (!confirm('Remover a senha mestra? Os blocos secretos voltam a ficar em texto puro.')) return;
    await this.cofre.removerSenha();
    this.ui.avisar('Senha removida');
    this.fechar.emit();
  }
}

import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Backup } from '../backup';
import { Github } from '../github';
import { ISSUE_URL, hoje } from '../models';

@Component({
  selector: 'app-painel-dados',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="fechar.emit()">
      <div class="dialogo" (click)="$event.stopPropagation()">
        <h2>Dados e backup</h2>

        <section>
          <h3>Backup automático</h3>
          @switch (backup.estado()) {
            @case ('ativo') {
              <p>
                Ativo na pasta <b>{{ backup.nomePasta() }}</b>: um arquivo por dia, atualizado a cada alteração. Mantém os
                últimos 30 dias.
              </p>
              <div class="linha">
                <button class="btn" (click)="backup.gravar(); ui.avisar('Backup gravado')">Gravar agora</button>
                <button class="btn" (click)="backup.escolherPasta()">Trocar pasta</button>
                <button class="btn ghost perigo" (click)="backup.desligar()">Desligar</button>
              </div>
            }
            @case ('reativar') {
              <p>Pasta <b>{{ backup.nomePasta() }}</b> configurada, mas o navegador pede confirmação de acesso.</p>
              <div class="linha">
                <button class="btn primario" (click)="backup.reativar()">Reativar</button>
                <button class="btn ghost perigo" (click)="backup.desligar()">Desligar</button>
              </div>
            }
            @case ('desligado') {
              <p>Escolha uma pasta (ex.: dentro do Google Drive/OneDrive sincronizado) e o backup é gravado sozinho.</p>
              <button class="btn primario" (click)="backup.escolherPasta()">Escolher pasta</button>
            }
            @default {
              <p>Este navegador não permite gravar em pasta. Use Chrome, Edge ou Vivaldi, ou exporte manualmente toda semana.</p>
            }
          }
        </section>

        <section>
          <h3>Manual</h3>
          <p class="sub">
            Último backup: {{ backup.ultimo() ?? 'nunca' }}
            @if (backup.dias() !== null) {
              ({{ backup.dias() === 0 ? 'hoje' : 'há ' + backup.dias() + ' dias' }})
            }
          </p>
          <div class="linha">
            <button class="btn" (click)="exportar()">Exportar JSON</button>
            <label class="btn">
              Importar JSON
              <input type="file" accept="application/json,.json" hidden (change)="importar($event)" />
            </label>
          </div>
        </section>

        <section>
          <h3>GitHub</h3>
          <p>Com o token, informar o nº do card preenche os dados da issue: título, descrição, labels e campos do quadro (Cards e Kanban).</p>
          <div class="linha">
            <input type="password" name="token" [(ngModel)]="token" placeholder="github_pat_..." autocomplete="off" />
            <button class="btn primario" (click)="salvarToken()">Salvar</button>
            <button class="btn" (click)="testarToken()" [disabled]="!github.token()">Testar</button>
          </div>
          <p class="sub">{{ github.token() ? 'Token configurado neste navegador.' : 'Nenhum token configurado.' }} Fica só aqui: não vai para backup nem cookies.</p>
          <details>
            <summary>Como gerar o token</summary>
            <ol>
              <li>No GitHub: foto do perfil → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
              <li>Nome e validade à escolha. <b>Resource owner</b>: {{ dono }}.</li>
              <li><b>Repository access</b>: <i>Only select repositories</i> → {{ repo }}.</li>
              <li><b>Permissions</b> → <b>Repository permissions</b> → <b>Issues</b>: <i>Read-only</i> (Metadata entra sozinho).</li>
              <li>Para ler os campos do quadro (Sistema, Área, Time, Linguagem): <b>Organization permissions</b> → <b>Projects</b>: <i>Read-only</i>.</li>
              <li><b>Generate token</b>, copiar e colar acima. Se a organização exigir aprovação, aguardar um admin aprovar.</li>
              <li>Alternativa se o fine-grained for bloqueado: <i>Tokens (classic)</i> com os escopos <b>repo</b> e <b>read:project</b>.</li>
            </ol>
          </details>
        </section>

        <section>
          <h3>Onde os dados ficam</h3>
          <ul>
            <li><b>localStorage</b>: tudo ({{ kbLocal() }} KB).</li>
            <li>
              <b>Cookies</b>:
              @if (store.statusCookie(); as c) {
                @if (c.ativo) {
                  {{ (c.bytes / 1024).toFixed(1) }} KB com notas, tarefas, sistemas e {{ c.cards }} de {{ c.totalCards }}
                  cards (mais recentes). Limite seguro de 10 KB por causa do limite de cabeçalho da Vercel.
                } @else {
                  {{ c.motivo }}
                }
              } @else {
                aguardando primeira gravação.
              }
            </li>
            <li>
              <b>Armazenamento persistente</b>:
              @if (persistente()) {
                concedido (o navegador não apaga sozinho).
              } @else {
                não concedido. <button class="btn mini" (click)="pedirPersistente()">Solicitar</button>
              }
            </li>
          </ul>
          <p class="sub">Limpar dados do site apaga localStorage e cookies juntos; só o backup em arquivo sobrevive.</p>
        </section>

        <div class="rodape">
          <button class="btn" (click)="fechar.emit()">Fechar</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    section {
      display: grid;
      gap: 6px;
    }
    section > .btn {
      justify-self: start;
    }
    h3 {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--texto-2);
    }
    p,
    ul,
    ol {
      margin: 0;
    }
    ul,
    ol {
      padding-left: 18px;
      display: grid;
      gap: 4px;
    }
    .sub {
      color: var(--texto-2);
      font-size: 12px;
    }
    .linha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .linha input {
      flex: 1;
      min-width: 200px;
      width: auto;
    }
    summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--acento);
    }
    details ol {
      margin-top: 6px;
      font-size: 12px;
    }
  `,
})
export class PainelDados {
  protected readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  protected readonly backup = inject(Backup);
  protected readonly github = inject(Github);
  protected token = this.github.token();
  protected readonly dono = ISSUE_URL.split('/')[3];
  protected readonly repo = ISSUE_URL.split('/')[4];
  readonly fechar = output();
  protected readonly persistente = signal(false);
  protected readonly kbLocal = computed(() => (JSON.stringify(this.store.snapshot()).length / 1024).toFixed(1));

  constructor() {
    navigator.storage?.persisted?.().then((p) => this.persistente.set(p));
  }

  async pedirPersistente() {
    const ok = (await navigator.storage?.persist?.()) ?? false;
    this.persistente.set(ok);
    this.ui.avisar(ok ? 'Concedido' : 'O navegador recusou; ele concede com o uso frequente do site ou ao instalar como app');
  }

  salvarToken() {
    this.github.salvar(this.token);
    this.ui.avisar(this.token.trim() ? 'Token salvo' : 'Token removido');
  }

  async testarToken() {
    this.ui.avisar(await this.github.testar());
  }

  exportar() {
    this.ui.baixar(`devtools-${hoje()}.json`, JSON.stringify(this.store.snapshot(), null, 2));
    this.backup.marcar();
  }

  async importar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const arq = input.files?.[0];
    input.value = '';
    if (!arq) return;
    try {
      const dados = JSON.parse(await arq.text());
      const substituir = confirm('OK = substituir todos os dados atuais\nCancelar = mesclar com os dados atuais');
      const aviso = this.store.importar(dados, substituir);
      if (aviso) alert(aviso);
      this.ui.avisar('Importado');
    } catch {
      this.ui.avisar('JSON inválido');
    }
  }
}

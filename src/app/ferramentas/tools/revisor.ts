import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { limparTexto } from '../lib/limpeza';
import { corrigirScript, Nivel, revisar } from '../lib/revisor';

const ROTULO: Record<Nivel, string> = { erro: 'Erro', alerta: 'Atenção', info: 'Dica' };

@Component({
  selector: 'ft-revisor',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Script
            @if (r().comandos.length) {
              <span class="ft-selo">{{ r().comandos.length }} comando(s)</span>
            }
          </h4>
          <textarea class="ft-texto" [(ngModel)]="sql" rows="16" spellcheck="false"
            placeholder="Cole o script de entrega (UPDATE, INSERT, ALTER...)"></textarea>
          @if (resumo()) {
            <p class="ft-dica">{{ resumo() }}</p>
          }
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Revisão
            @for (n of NIVEIS; track n) {
              @if (conta()[n]) {
                <span class="ft-selo" [class.erro]="n === 'erro'">{{ conta()[n] }} {{ ROTULO[n].toLowerCase() }}</span>
              }
            }
          </h4>
          @if (!sql().trim()) {
            <p class="ft-dica">Aponta UPDATE/DELETE sem WHERE, falta de BEGIN/COMMIT, DROP/TRUNCATE, INSERT sem colunas, parâmetro esquecido, aspas curvas, caractere invisível e acentuação quebrada.</p>
          } @else if (!r().achados.length) {
            <p class="ft-aviso ok">Nada encontrado.</p>
          } @else {
            <ul class="rev-lista">
              @for (a of r().achados; track $index) {
                <li [class]="a.nivel">
                  <span class="rev-nivel">{{ ROTULO[a.nivel] }}</span>
                  <span class="rev-linha" title="Linha">L{{ a.linha }}</span>
                  <span class="rev-msg">{{ a.msg }}</span>
                  @if (a.trecho) {
                    <code class="rev-trecho">{{ a.trecho }}</code>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>
      @if (sql().trim()) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Corrigido
            <span class="ft-selo" [class.ok]="corrigido() !== sql()">{{ corrigido() === sql() ? 'sem mudança' : 'alterado' }}</span>
            <button class="btn mini fim" (click)="usar()" [disabled]="corrigido() === sql()" title="Troca o script pelo corrigido e revisa de novo">Usar no script</button>
            <button class="btn mini" (click)="ui.copiar(corrigido())">Copiar</button>
          </h4>
          <div class="ft-linha">
            <label class="ft-chk" title="Aspas curvas, travessões, NBSP, invisíveis e Ã§ → ç"><input type="checkbox" [(ngModel)]="caracteres" /> Caracteres e acentuação</label>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="transacao" /> Envolver em BEGIN/COMMIT se não tiver</label>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="pontoVirgula" /> ; no fim</label>
          </div>
          <textarea class="ft-texto" readonly rows="8" spellcheck="false" [value]="corrigido()"></textarea>
        </div>
      }
      <p class="ft-dica">PostgreSQL. A revisão é por texto, sem conectar no banco: confirme sempre com count antes e RETURNING.</p>
    </div>
  `,
  styles: `
    .rev-lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      max-height: 460px;
      overflow: auto;
    }
    .rev-lista li {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 2px 8px;
      align-items: baseline;
      padding: 6px 8px;
      border-radius: 8px;
      border-left: 3px solid var(--borda);
      background: var(--bg-2);
      font-size: 13px;
    }
    .rev-lista li.erro {
      border-left-color: #d64545;
    }
    .rev-lista li.alerta {
      border-left-color: #d49a1f;
    }
    .rev-lista li.info {
      border-left-color: var(--acento);
    }
    .rev-nivel {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }
    .rev-linha {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--texto-2);
    }
    .rev-trecho {
      grid-column: 1 / -1;
      font-family: var(--mono);
      font-size: 11.5px;
      color: var(--texto-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class Revisor {
  protected readonly ui = inject(Ui);
  protected readonly ROTULO = ROTULO;
  protected readonly NIVEIS: Nivel[] = ['erro', 'alerta', 'info'];
  protected readonly sql = lembrado('revisor.sql', '');
  protected readonly caracteres = lembrado('revisor.caracteres', true);
  protected readonly transacao = lembrado('revisor.transacao', true);
  protected readonly pontoVirgula = lembrado('revisor.pontoVirgula', true);

  protected readonly r = computed(() => revisar(this.sql()));
  protected readonly conta = computed(() => {
    const c: Record<Nivel, number> = { erro: 0, alerta: 0, info: 0 };
    this.r().achados.forEach((a) => c[a.nivel]++);
    return c;
  });
  protected readonly resumo = computed(() => {
    const m = new Map<string, number>();
    this.r().comandos.forEach((c) => m.set(c.tipo, (m.get(c.tipo) ?? 0) + 1));
    return [...m].map(([t, n]) => `${n} ${t}`).join(' · ');
  });
  protected readonly corrigido = computed(() =>
    corrigirScript(
      this.sql(),
      { caracteres: this.caracteres(), transacao: this.transacao(), pontoVirgula: this.pontoVirgula() },
      (s) => limparTexto(s, { grupos: ['espaco', 'invisivel', 'controle', 'tipografico'], aparar: false }),
    ),
  );

  usar() {
    this.sql.set(this.corrigido());
  }
}

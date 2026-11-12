import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { aplicar, Erro, verificar } from '../lib/ortografia';

@Component({
  selector: 'ft-ortografia',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Texto
          <span class="ft-linha fim">
            <select [(ngModel)]="idioma" (ngModelChange)="erros.set(null)">
              <option value="pt-BR">Português (BR)</option>
              <option value="en-US">Inglês (EUA)</option>
              <option value="es">Espanhol</option>
            </select>
            <button class="btn mini" [disabled]="!texto().trim() || carregando()" (click)="checar()">{{ carregando() ? 'Verificando…' : 'Verificar' }}</button>
            <button class="btn mini ghost" [disabled]="!texto()" (click)="ui.copiar(texto())">Copiar</button>
          </span>
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" (ngModelChange)="erros.set(null)" (keydown.control.enter)="checar()" rows="10" spellcheck="false" placeholder="Cole o texto e clique em Verificar (Ctrl+Enter)"></textarea>
      </div>

      @if (falha()) {
        <p class="ft-aviso">{{ falha() }}</p>
      }
      @if (erros(); as lista) {
        @if (!lista.length) {
          <p class="ft-aviso ok">Nenhum erro encontrado.</p>
        } @else {
          <div class="ft-duas">
            <div class="ft-painel">
              <h4 class="ft-titulo">Marcado</h4>
              <div class="or-texto">
                @for (s of segmentos(); track $index) {
                  @if (s.erro; as e) {
                    <mark [class]="e.tipo" [class.foco]="e === foco()" [title]="e.msg" (click)="foco.set(e)">{{ s.t }}</mark>
                  } @else {
                    {{ s.t }}
                  }
                }
              </div>
            </div>
            <div class="ft-painel">
              <h4 class="ft-titulo">
                Correções <span class="ft-selo erro">{{ lista.length }}</span>
                <button class="btn mini fim" (click)="todas()">Aplicar 1ª sugestão em todas</button>
              </h4>
              <ul class="or-lista">
                @for (e of lista; track e.inicio + ':' + e.trecho) {
                  <li [class]="e.tipo" [class.foco]="e === foco()" (click)="foco.set(e)">
                    <div><s class="ft-mono">{{ e.trecho }}</s> <small>{{ e.msg }}</small></div>
                    <div class="ft-linha">
                      @for (s of e.sugestoes; track s) {
                        <button class="btn mini" (click)="trocar(e, s); $event.stopPropagation()">{{ s || '(remover)' }}</button>
                      }
                      <button class="btn mini ghost" (click)="ignorar(e); $event.stopPropagation()">Ignorar</button>
                    </div>
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      }
      <p class="ft-dica">
        Usa a API pública do LanguageTool: o texto é enviado para languagetool.org (limite de 20 KB e 20 verificações por minuto). Com dados pessoais, passe antes no
        Anonimizar. Vermelho = ortografia, amarelo = gramática, azul = estilo.
      </p>
    </div>
  `,
  styles: `
    .or-texto { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.7; max-height: 480px; overflow: auto; }
    mark { background: none; color: inherit; cursor: pointer; border-bottom: 2px solid var(--perigo); }
    mark.gramatica { border-bottom-color: #e5a50a; }
    mark.estilo { border-bottom-color: #3584e4; }
    mark.foco { background: var(--acento-bg); }
    .or-lista { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; max-height: 480px; overflow: auto; }
    .or-lista li { display: grid; gap: 6px; padding: 8px 12px; border-radius: 8px; border-left: 3px solid var(--perigo); background: var(--bg-2); font-size: 13px; cursor: pointer; }
    .or-lista li.gramatica { border-left-color: #e5a50a; }
    .or-lista li.estilo { border-left-color: #3584e4; }
    .or-lista li.foco { outline: 1px solid var(--acento); }
    .or-lista small { color: var(--texto-2); }
  `,
})
export class Ortografia {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('ortografia.texto', '');
  protected readonly idioma = lembrado('ortografia.idioma', 'pt-BR');
  protected readonly erros = signal<Erro[] | null>(null);
  protected readonly foco = signal<Erro | null>(null);
  protected readonly carregando = signal(false);
  protected readonly falha = signal('');

  protected readonly segmentos = computed(() => {
    const t = this.texto();
    const res: { t: string; erro?: Erro }[] = [];
    let pos = 0;
    for (const e of [...(this.erros() ?? [])].sort((a, b) => a.inicio - b.inicio)) {
      if (e.inicio < pos) continue;
      res.push({ t: t.slice(pos, e.inicio) }, { t: t.slice(e.inicio, e.fim), erro: e });
      pos = e.fim;
    }
    res.push({ t: t.slice(pos) });
    return res;
  });

  async checar() {
    if (!this.texto().trim() || this.carregando()) return;
    this.carregando.set(true);
    this.falha.set('');
    try {
      this.erros.set(await verificar(this.texto(), this.idioma()));
    } catch (e) {
      this.erros.set(null);
      this.falha.set(e instanceof TypeError ? 'Sem conexão com o LanguageTool.' : (e as Error).message);
    } finally {
      this.carregando.set(false);
    }
  }

  trocar(e: Erro, s: string) {
    const r = aplicar(this.texto(), this.erros() ?? [], e, s);
    this.texto.set(r.texto);
    this.erros.set(r.erros);
  }

  ignorar(e: Erro) {
    this.erros.update((l) => l!.filter((x) => x !== e));
  }

  todas() {
    // do fim para o começo: os offsets anteriores não mudam
    let t = this.texto();
    const resto: Erro[] = [];
    for (const e of [...this.erros()!].sort((a, b) => b.inicio - a.inicio)) {
      if (e.sugestoes.length) t = t.slice(0, e.inicio) + e.sugestoes[0] + t.slice(e.fim);
      else resto.push(e);
    }
    this.texto.set(t);
    this.erros.set(resto.length ? null : []);
    if (resto.length) this.checar();
  }
}

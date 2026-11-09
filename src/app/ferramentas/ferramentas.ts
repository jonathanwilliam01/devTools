import { Component, computed, effect, HostListener, inject, signal, untracked, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Store } from '../store';
import { Ui } from '../ui';
import { lembrado, limpar } from './lib/estado';
import { imagemDe, lerImagem } from './lib/leitor';
import { Gerador } from './tools/gerador';
import { Validador } from './tools/validador';
import { Mascara } from './tools/mascara';
import { Boleto } from './tools/boleto';
import { Datas } from './tools/datas';
import { Tempo } from './tools/tempo';
import { Sql } from './tools/sql';
import { Formatador } from './tools/formatador';
import { Base64 } from './tools/base64';
import { JwtTool } from './tools/jwt';
import { Hash } from './tools/hash';
import { Diff } from './tools/diff';
import { Conversor } from './tools/conversor';
import { Regex } from './tools/regex';
import { CronTool } from './tools/cron';
import { Pix } from './tools/pix';
import { Cep } from './tools/cep';
import { Fake } from './tools/fake';
import { SqlFmt } from './tools/sqlfmt';
import { Grade } from './tools/grade';
import { Caixa } from './tools/caixa';
import { Encoding } from './tools/encoding';
import { Contador } from './tools/contador';
import { Senha } from './tools/senha';
import { Lote } from './tools/lote';
import { Ocr } from './tools/ocr';
import { PgBusca } from './tools/pgbusca';
import { ArrayJson } from './tools/arrayjson';
import { Builder } from './tools/builder';
import { SqlStr } from './tools/sqlstr';
import { Explain } from './tools/explain';
import { Extenso } from './tools/extenso';
import { ehNova, FERRAMENTAS, Ferramenta, prepararColado } from './lista';

const CHAVE = 'devtools:ferramenta';
// favoritas iam só no localStorage antes de entrar no backup
const CHAVE_FAV_ANTIGA = 'devtools:favoritas';

@Component({
  selector: 'app-ferramentas',
  imports: [FormsModule, RouterLink, Gerador, Validador, Mascara, Boleto, Datas, Tempo, Sql, Formatador, Base64, JwtTool, Hash, Diff, Conversor, Regex, CronTool, Pix, Cep, Fake, SqlFmt, Grade, Caixa, Encoding, Contador, Senha, Lote, Ocr, PgBusca, ArrayJson, Builder, SqlStr, Explain, Extenso],
  templateUrl: './ferramentas.html',
  styleUrl: './ferramentas.css',
  encapsulation: ViewEncapsulation.None,
})
export class Ferramentas {
  private readonly router = inject(Router);
  protected readonly busca = signal('');
  private readonly store = inject(Store);
  private readonly ui = inject(Ui);
  // muda para recriar a ferramenta (limpar ou receber colagem)
  protected readonly versao = signal(0);
  protected readonly favoritas = computed(() => (this.store.config().favoritas ?? []).filter((id) => FERRAMENTAS.some((f) => f.id === id)));
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id'))));

  protected readonly atual = computed(() => FERRAMENTAS.find((f) => f.id === this.id()) ?? FERRAMENTAS[0]);
  private readonly vistas = computed(() => this.store.config().vistas ?? []);
  protected readonly fechados = lembrado<string[]>('menu.fechados', []);

  protected readonly grupos = computed(() => {
    const t = this.busca().toLowerCase().trim();
    const fav = this.favoritas();
    const achou = (f: Ferramenta) => !t || (f.nome + f.grupo + f.desc).toLowerCase().includes(t);
    const grupos = new Map<string, Ferramenta[]>();
    const favs = fav.map((id) => FERRAMENTAS.find((f) => f.id === id)!).filter(achou);
    if (favs.length) grupos.set('Favoritos', favs);
    FERRAMENTAS.filter((f) => achou(f) && !fav.includes(f.id)).forEach((f) =>
      grupos.set(f.grupo, [...(grupos.get(f.grupo) ?? []), f]),
    );
    return [...grupos].map(([nome, itens]) => ({
      nome,
      itens,
      // na busca tudo aparece aberto
      fechado: !t && this.fechados().includes(nome),
      novas: itens.filter((f) => this.nova(f)).length,
    }));
  });

  constructor() {
    // abrir tira o selo "novo"
    effect(() => {
      const f = this.atual();
      if (untracked(() => this.nova(f))) this.store.config.update((c) => ({ ...c, vistas: [...(c.vistas ?? []), f.id] }));
    });
    try {
      const antiga = localStorage.getItem(CHAVE_FAV_ANTIGA);
      if (antiga) {
        if (!this.store.config().favoritas) this.store.config.update((c) => ({ ...c, favoritas: JSON.parse(antiga) }));
        localStorage.removeItem(CHAVE_FAV_ANTIGA);
      }
    } catch {}
    const id = this.id();
    if (!FERRAMENTAS.some((f) => f.id === id)) {
      let ultima: string | null = null;
      try {
        ultima = localStorage.getItem(CHAVE);
      } catch {}
      this.router.navigate(['/ferramentas', FERRAMENTAS.find((f) => f.id === ultima)?.id ?? 'gerador'], { replaceUrl: true });
    } else {
      try {
        localStorage.setItem(CHAVE, id!);
      } catch {}
    }
  }

  protected nova(f: Ferramenta) {
    return ehNova(f, this.vistas());
  }

  alternarGrupo(nome: string) {
    this.fechados.update((l) => (l.includes(nome) ? l.filter((x) => x !== nome) : [...l, nome]));
  }

  lembrar(id: string) {
    try {
      localStorage.setItem(CHAVE, id);
    } catch {}
  }

  favoritar(id: string) {
    const l = this.favoritas();
    this.store.config.update((c) => ({ ...c, favoritas: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] }));
  }

  resetar() {
    limpar(this.atual().id);
    this.versao.update((v) => v + 1);
  }

  private abrir(texto: string) {
    const f = prepararColado(texto);
    if (!f) return this.ui.avisar('Conteúdo não reconhecido');
    this.lembrar(f.id);
    this.versao.update((v) => v + 1);
    if (f.id !== this.atual().id) this.router.navigate(['/ferramentas', f.id]);
    this.ui.avisar(`Aberto em ${f.nome}`);
  }

  private async abrirImagem(img: Blob) {
    this.ui.avisar('Lendo imagem...');
    try {
      const [texto] = await lerImagem(img);
      if (texto) this.abrir(texto);
      else this.ui.avisar('Nenhum código encontrado na imagem');
    } catch {
      this.ui.avisar('Falha ao ler a imagem');
    }
  }

  private emCampo(e: Event) {
    // na ferramenta de OCR a imagem colada/solta é dela
    if (this.atual().id === 'ocr') return true;
    const el = e.target as HTMLElement;
    return el.closest('input, textarea, select, [contenteditable]') || el.closest('[data-imagem]');
  }

  // colar fora dos campos: reconhece o conteúdo (texto ou imagem com QR/código de barras) e abre a ferramenta certa
  @HostListener('document:paste', ['$event'])
  colar(e: ClipboardEvent) {
    if (this.emCampo(e)) return;
    const img = imagemDe(e.clipboardData);
    const texto = e.clipboardData?.getData('text') ?? '';
    if (!img && !texto.trim()) return;
    e.preventDefault();
    if (img) this.abrirImagem(img);
    else this.abrir(texto);
  }

  @HostListener('dragover', ['$event'])
  arrastando(e: DragEvent) {
    if (!this.emCampo(e) && e.dataTransfer?.types.includes('Files')) e.preventDefault();
  }

  @HostListener('drop', ['$event'])
  soltar(e: DragEvent) {
    if (this.emCampo(e)) return;
    const img = imagemDe(e.dataTransfer);
    if (!img) return;
    e.preventDefault();
    this.abrirImagem(img);
  }

  abrirPrimeira() {
    const f = this.grupos()[0]?.itens[0];
    if (!f) return;
    this.busca.set('');
    this.lembrar(f.id);
    this.router.navigate(['/ferramentas', f.id]);
  }
}

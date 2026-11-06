import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../store';
import { COLUNAS, MESES, PRIORIDADES, Tarefa, hoje, prazoTarefa } from '../models';
import { FERRAMENTAS } from '../ferramentas/lista';

const ORDEM_PRIO = PRIORIDADES.map((p) => p.valor);

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  protected readonly store = inject(Store);
  protected readonly prazo = prazoTarefa;

  protected visivel(id: string) {
    return this.store.menusVisiveis().some((m) => m.id === id);
  }

  protected readonly numeros = computed(() => {
    const h = hoje();
    const d = new Date(h + 'T00:00');
    const segunda = new Date(d);
    segunda.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const anterior = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const [semana, mes, mesAnt, ano] = [
      segunda.toLocaleDateString('sv-SE'),
      h.slice(0, 7),
      anterior.toLocaleDateString('sv-SE').slice(0, 7),
      h.slice(0, 4),
    ];
    const datas = this.store.cards().map((c) => c.data);
    const qtd = (f: (x: string) => boolean) => datas.filter(f).length;
    return {
      hoje: qtd((x) => x === h),
      semana: qtd((x) => x >= semana && x <= h),
      mes: qtd((x) => x.startsWith(mes)),
      mesAnterior: qtd((x) => x.startsWith(mesAnt)),
      nomeMes: MESES[d.getMonth()],
      nomeMesAnterior: MESES[anterior.getMonth()],
      ano: qtd((x) => x.startsWith(ano)),
      anoNum: ano,
    };
  });

  protected readonly colunas = computed(() =>
    COLUNAS.filter((c) => c.status !== 'done').map((c) => ({
      ...c,
      qtd: this.store.tarefas().filter((t) => t.status === c.status).length,
    })),
  );

  // atrasadas primeiro, depois prioridade e prazo
  protected readonly abertas = computed(() => {
    const h = hoje();
    const chave = (t: Tarefa) => [t.prazo && t.prazo < h ? 0 : 1, ORDEM_PRIO.indexOf(t.prioridade), t.prazo || '9999'] as const;
    return this.store
      .tarefas()
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const [x, y] = [chave(a), chave(b)];
        return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]);
      });
  });

  protected readonly favoritas = computed(() =>
    (this.store.config().favoritas ?? []).map((id) => FERRAMENTAS.find((f) => f.id === id)).filter((f) => !!f),
  );

  protected readonly notas = computed(() =>
    this.store
      .notas()
      .filter((n) => n.fixada)
      .sort((a, b) => b.atualizado.localeCompare(a.atualizado)),
  );

  protected label(valor: string) {
    return PRIORIDADES.find((p) => p.valor === valor)?.label ?? valor;
  }
}

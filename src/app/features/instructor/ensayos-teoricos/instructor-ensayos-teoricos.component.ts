import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TagModule } from 'primeng/tag';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-ensayos-teoricos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagModule, SectionHeroComponent, IconComponent],
  template: `
    <div class="px-6 py-6 pb-20 max-w-6xl mx-auto space-y-6">
      <!-- HERO -->
      <section class="bento-hero surface-hero rounded-xl" #heroRef>
        <app-section-hero
          title="Ensayos Teóricos"
          subtitle="Supervisa a los alumnos rindiendo ensayos en sala"
          [actions]="heroActions"
          (actionClick)="onHeroAction($event)"
        />
      </section>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card p-5">
          <h3 class="kpi-label mb-2">Total Programados (Hoy)</h3>
          <p class="kpi-value">{{ list().length }}</p>
        </div>
        <div class="card p-5">
          <h3 class="kpi-label mb-2">Presentes en Sala</h3>
          <p class="kpi-value">{{ presentCount() }}</p>
        </div>
        <div class="card card-accent p-5">
          <h3 class="kpi-label mb-2">Aprobados</h3>
          <p class="kpi-value" style="color: var(--state-success)">{{ approvedCount() }}</p>
        </div>
      </div>

      <!-- Table -->
      <div class="card p-0 overflow-hidden">
        <div
          class="px-6 py-4 border-b border-divider bg-surface-hover flex items-center justify-between"
        >
          <h3 class="text-lg font-bold text-text-primary">Lista de Asistencia — Ensayos</h3>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr
                class="border-b border-divider text-xs text-text-muted uppercase tracking-wider"
                style="background: var(--bg-subtle)"
              >
                <th class="p-4 font-semibold">Alumno</th>
                <th class="p-4 font-semibold">Hora Agendada</th>
                <th class="p-4 font-semibold">Asistencia</th>
                <th class="p-4 font-semibold">Puntaje</th>
                <th class="p-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-divider align-top text-sm">
              @if (list().length === 0) {
                <tr>
                  <td colspan="5" class="p-8 text-center text-text-muted italic">
                    <div class="flex flex-col items-center gap-2">
                      <app-icon name="monitor-off" [size]="32" class="opacity-50" />
                      No hay alumnos programados para rendir ensayos teóricos hoy.
                    </div>
                  </td>
                </tr>
              } @else {
                @for (item of list(); track item.studentRut) {
                  <tr class="hover:bg-surface-hover/50 transition-colors">
                    <td class="p-4">
                      <span class="font-medium text-text-primary block">{{
                        item.studentName
                      }}</span>
                      <span class="text-xs text-text-muted truncate mt-0.5">{{
                        item.studentRut
                      }}</span>
                    </td>
                    <td class="p-4 text-text-primary font-medium">10:00 - 11:00</td>
                    <td class="p-4">
                      @if (item.attendance) {
                        <p-tag value="Presente" severity="success" />
                      } @else {
                        <p-tag value="Pendiente" severity="warn" />
                      }
                    </td>
                    <td class="p-4">
                      @if (item.score !== null) {
                        <span
                          class="font-bold flex items-center gap-1"
                          [style.color]="
                            item.score >= 33 ? 'var(--state-success)' : 'var(--state-error)'
                          "
                        >
                          {{ item.score }} / 38
                          <app-icon
                            [name]="item.score >= 33 ? 'check-circle' : 'x-circle'"
                            [size]="14"
                          />
                        </span>
                      } @else {
                        <span class="text-text-muted italic">-</span>
                      }
                    </td>
                    <td class="p-4 text-right">
                      @if (!item.attendance) {
                        <button
                          class="btn btn-outline btn-sm"
                          (click)="toggleAttendance(item)"
                          data-llm-action="mark-attendance"
                        >
                          Marcar Presente
                        </button>
                      } @else if (item.score === null) {
                        <button class="btn btn-primary btn-sm" (click)="toggleAttendance(item)">
                          En progreso...
                        </button>
                      } @else {
                        <button class="btn btn-outline btn-sm">Resultados</button>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class InstructorEnsayosTeoricosComponent implements OnInit, AfterViewInit {
  public facade = inject(InstructorAlumnosFacade);
  private gsap = inject(GsapAnimationsService);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  private theoryList = signal<any[]>([]);

  readonly heroActions: SectionHeroAction[] = [
    { id: 'refresh', label: 'Actualizar Tablero', icon: 'refresh-cw', primary: false },
  ];

  list = computed(() => this.theoryList());
  presentCount = computed(() => this.theoryList().filter((i) => i.attendance).length);
  approvedCount = computed(
    () => this.theoryList().filter((i) => i.score !== null && i.score >= 33).length,
  );

  async ngOnInit() {
    await this.facade.initialize();
    await this.loadData();
  }

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
  }

  async loadData() {
    try {
      const data = await this.facade.fetchTheoryAttendance();
      this.theoryList.set([...data]);
    } catch (e) {
      console.error(e);
    }
  }

  onHeroAction(id: string) {
    if (id === 'refresh') this.loadData();
  }

  toggleAttendance(item: any) {
    this.theoryList.update((list) =>
      list.map((i) => (i === item ? { ...i, attendance: !i.attendance } : i)),
    );
  }
}

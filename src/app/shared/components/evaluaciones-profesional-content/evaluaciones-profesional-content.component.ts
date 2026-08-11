import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { GRADE_PASS, MODULE_COUNT } from '@core/utils/professional-modules';
import { computeGradebookStats, countModulosCompletos } from '@core/utils/gradebook-stats';
import type {
  CursoEstado,
  FilaEvaluacion,
  GrillaEvaluacion,
  PromocionConCursos,
} from '@core/models/ui/evaluaciones-profesional.model';
import type { SectionHeroChip } from '@core/models/ui/section-hero.model';

/**
 * Contenido compartido de la matriz de notas de Clase Profesional (Admin + Secretaria).
 * Extraído para garantizar paridad visual/funcional entre ambos roles por construcción
 * (spec 0008-m) — antes eran 2 archivos casi-clon que divergían silenciosamente.
 */
@Component({
  selector: 'app-evaluaciones-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PaginatorModule,
    SectionHeroComponent,
    SkeletonBlockComponent,
    IconComponent,
    BadgeComponent,
    StatBoxComponent,
    BentoGridLayoutDirective,
  ],
  styles: [
    `
      .bento-grid {
        /* Permite que cada fila mida según su contenido real (ej. el banner
           "Volver al panorama") en vez de imponer un piso de 120px por fila. */
        --bento-row-min: auto;
      }

      /* ── Gradebook ────────────────────────────────────────────────
         Scroll bidireccional: header sticky (scroll vertical) + columna de
         alumno sticky (scroll horizontal), con crosshair de columna en hover
         (puro CSS vía ::after extendido). Frágil de romper si se toca sin
         entender el z-index apilado (esquina alumno+header debe ganar a ambos) —
         ver spec 0008-m antes de tocar.
         flex:1 1 auto (no max-height fijo): en desktop (lg+, dentro de
         .bento-fill) llena todo el alto restante del shell — único scroll
         real de la página. Bajo lg no tiene ancestro de alto acotado, así
         que mide su contenido natural y el scroll lo hereda la página
         (mismo fallback que el resto del patrón app-like). */
      .gradebook-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }

      .gradebook-table {
        border-collapse: separate;
        border-spacing: 0;
      }

      /* Header sticky (scroll vertical) */
      .gradebook-table thead th {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--bg-elevated);
      }

      /* Columna de alumno sticky (scroll horizontal) */
      .col-alumno {
        position: sticky;
        left: 0;
        z-index: 10;
        background: var(--bg-surface);
      }
      .gradebook-table tbody tr:hover .col-alumno {
        background: var(--bg-subtle);
      }
      /* Esquina: alumno + header → debe ganar a ambos */
      .gradebook-table thead .col-alumno {
        z-index: 30;
        background: var(--bg-elevated);
      }

      /* Crosshair: resalta la columna del módulo en hover de su celda */
      .grade-cell {
        position: relative;
      }
      .grade-cell > * {
        position: relative;
        z-index: 1;
      }
      .grade-cell:hover::after {
        content: '';
        position: absolute;
        top: -1000px;
        bottom: -1000px;
        left: 0;
        right: 0;
        background: var(--bg-subtle);
        pointer-events: none;
        z-index: 0;
      }
    `,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Hero adaptativo ───────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        [title]="heroTitle()"
        [subtitle]="heroSubtitle()"
        [contextLine]="heroContextLine()"
        [chips]="heroChips()"
        icon="graduation-cap"
        [actions]="[]"
        [backClickable]="selectedCursoId() !== null"
        backLabel="Panorama"
        (backClicked)="voltearAterrizaje()"
      />

      <!-- ── Celda protagonista: aterrizaje O grilla, nunca ambos ──────
           Único wrapper .bento-fill para los dos modos (spec 0008-m):
           en desktop llena el resto del viewport y scrollea internamente
           (aterrizaje: la pila de tarjetas de promoción; grilla: el
           gradebook, vía .gradebook-scroll flex-1 más abajo). Bajo lg
           mide su contenido natural y el scroll lo hereda la página. -->
      <div class="bento-banner bento-fill flex flex-col min-h-0 overflow-y-auto gap-4">
        <!-- ═══ ATERRIZAJE — sin grilla activa, y no estamos cargando una grilla ═══
             El chequeo de isLoading evita que el aterrizaje viejo conviva con el skeleton de la
             grilla mientras se carga un curso recién clickeado (grilla sigue null hasta que
             resuelve la fetch) — bug real encontrado en QA visual (spec 0008-m). -->
        @if (!grilla() && !isLoading()) {
          <!-- 0 promociones activas → estado vacío real -->
          @if (landingLoaded() && landing().length === 0) {
            <div class="bento-banner py-14 flex flex-col items-center gap-4 text-center shrink-0">
              <div class="w-16 h-16 rounded-2xl bg-subtle flex items-center justify-center">
                <app-icon name="graduation-cap" [size]="28" color="var(--text-muted)" />
              </div>
              <div class="space-y-1">
                <p class="font-semibold text-text-primary">Sin promociones activas</p>
                <p class="text-sm text-text-muted max-w-xs">
                  No hay promociones en curso o planificadas. Crea una para comenzar el registro de
                  notas.
                </p>
              </div>
              <button class="btn-primary" data-llm-action="create-promotion">
                <app-icon name="plus" [size]="14" />
                Crear promoción
              </button>
            </div>
          }

          <!-- Grupos de promoción con tarjetas de curso — UNA sola card contenedora (spec
               0008-m, ronda 5): antes cada promoción era su propia card con el paginador
               flotando aparte abajo; ahora las promociones (divide-y) y el paginador viven
               dentro del mismo bloque visual, sin quedar desconectados.
               shrink-0 obligatorio en el contenedor: dentro de .bento-fill (flex column), sin
               esto el flexbox comprime la card por debajo de su alto natural y overflow-hidden
               recorta contenido en silencio (bug real encontrado en QA visual, ronda 3). -->
          <div
            class="bento-banner rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border shrink-0"
          >
            @for (promo of visibleLanding(); track promo.id) {
              <div>
                <!-- Cabecera del grupo — 2 filas: identidad + resumen (cursos/alumnos totales).
                     La 2ª fila (spec 0008-m, ronda 6/7) resuelve el hueco vacío que dejaba la
                     paginación de 2 promociones a la vez en pantallas altas. -->
                <div
                  class="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-elevated"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <app-icon name="graduation-cap" [size]="18" color="var(--ds-brand)" />
                    <div class="min-w-0">
                      <h2 class="item-title truncate">{{ promo.name }}</h2>
                      <p class="text-xs text-text-muted">{{ promo.code }}</p>
                    </div>
                  </div>
                  <app-badge [variant]="promoStatusVariant(promo.status)">
                    {{ promoStatusLabel(promo.status) }}
                  </app-badge>
                </div>

                <!-- Resumen: cursos y alumnos totales de la promoción -->
                <div
                  class="flex items-center gap-6 px-5 py-3 border-b border-border bg-elevated/60"
                >
                  <span class="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
                    <app-icon name="book-open" [size]="13" />
                    {{ promo.cursos.length }}
                    {{ promo.cursos.length === 1 ? 'curso' : 'cursos' }}
                  </span>
                  <span class="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
                    <app-icon name="users" [size]="13" />
                    {{ promo.totalAlumnos }}
                    {{ promo.totalAlumnos === 1 ? 'alumno' : 'alumnos' }}
                  </span>
                </div>

                <!-- Grid de tarjetas de curso -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
                  @for (curso of promo.cursos; track curso.promotionCourseId) {
                    @let pct =
                      curso.totalAlumnos > 0
                        ? (curso.alumnosConNotas / curso.totalAlumnos) * 100
                        : 0;
                    <button
                      type="button"
                      class="group flex flex-col gap-3 p-5 bg-surface text-left transition-colors hover:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand cursor-pointer"
                      (click)="onCursoSelect(curso.promotionCourseId)"
                      [attr.data-llm-action]="'open-gradebook-' + curso.promotionCourseId"
                      [attr.aria-label]="'Abrir gradebook ' + curso.courseName"
                    >
                      <!-- Código + estado -->
                      <div class="flex items-start justify-between gap-2">
                        <span class="kpi-value leading-none">{{ curso.courseCode }}</span>
                        <app-badge [variant]="estadoBadgeVariant(curso.estado)">
                          <span class="inline-flex items-center gap-1">
                            <app-icon [name]="estadoBadgeIcon(curso.estado)" [size]="11" />
                            {{ estadoBadgeLabel(curso.estado) }}
                          </span>
                        </app-badge>
                      </div>

                      <!-- Nombre del curso -->
                      <p class="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {{ curso.courseName }}
                      </p>

                      <!-- Barra de progreso -->
                      <div class="space-y-1 w-full">
                        <div class="h-1.5 w-full rounded-full bg-border overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all duration-500"
                            [class.bg-brand]="curso.estado !== 'confirmada'"
                            [class.bg-success]="curso.estado === 'confirmada'"
                            [style.width.%]="pct"
                          ></div>
                        </div>
                        <div class="flex items-center justify-between text-2xs text-text-muted">
                          <span>{{ curso.alumnosConNotas }}/{{ curso.totalAlumnos }} alumnos</span>
                          @if (curso.promedio !== null) {
                            <span
                              class="font-semibold"
                              [class.text-success]="curso.promedio >= gradePass"
                              [class.text-error]="curso.promedio < gradePass"
                            >
                              {{ curso.promedio }}
                            </span>
                          } @else {
                            <span>Sin notas</span>
                          }
                        </div>
                      </div>

                      <!-- Chevron de acción -->
                      <div
                        class="flex items-center justify-end text-text-muted group-hover:text-brand transition-colors"
                      >
                        <app-icon name="chevron-right" [size]="14" />
                      </div>
                    </button>
                  }

                  @if (promo.cursos.length === 0) {
                    <div
                      class="col-span-full p-8 flex flex-col items-center gap-2 text-center text-text-muted"
                    >
                      <app-icon name="book-open" [size]="24" color="var(--text-muted)" />
                      <p class="text-sm">Esta promoción no tiene cursos asignados.</p>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Paginador — solo en layout desktop (evita cortar una tarjeta a la mitad contra
                 el borde del scroll). Con drawer abierto (layout compacto) no se pagina: se
                 mantiene el scroll libre de todas las promociones, decisión del owner.
                 Vive DENTRO de la misma card (divide-y arriba lo separa como una sección más),
                 no flotando aparte. -->
            @if (isDesktopLayout() && landing().length > promoPageSize) {
              <div class="px-2 py-1">
                <p-paginator
                  [rows]="promoPageSize"
                  [totalRecords]="landing().length"
                  [first]="safePromoPage() * promoPageSize"
                  [showCurrentPageReport]="true"
                  currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} promociones"
                  (onPageChange)="onPromoPageChange($event)"
                />
              </div>
            }
          </div>
        }

        <!-- Volver al panorama se resuelve desde el hero (backClickable), no con un botón
             propio acá — mismo patrón que Detalle de Alumno y otras vistas de la app. -->

        <!-- ═══ Skeleton — aterrizaje (primera carga o sin curso seleccionado) ═══
             Composición fiel a la forma real (cabecera de grupo + 4 tarjetas de curso), no
             barras genéricas — hallazgo de QA visual (spec 0008-m): un skeleton que no se
             parece al contenido final rompe la continuidad percibida de carga. -->
        @if (isLoading() && selectedCursoId() === null) {
          <div
            class="bento-banner rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border shrink-0"
          >
            @for (i of skeletonPromoGroups(); track $index) {
              <div>
                <div
                  class="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-elevated"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <app-skeleton-block variant="circle" width="28px" height="28px" />
                    <div class="flex flex-col gap-1.5">
                      <app-skeleton-block variant="text" width="140px" height="12px" />
                      <app-skeleton-block variant="text" width="60px" height="10px" />
                    </div>
                  </div>
                  <app-skeleton-block
                    variant="rect"
                    width="88px"
                    height="22px"
                    borderRadius="999px"
                  />
                </div>
                <div
                  class="flex items-center gap-6 px-5 py-3 border-b border-border bg-elevated/60"
                >
                  <app-skeleton-block variant="text" width="60px" height="10px" />
                  <app-skeleton-block variant="text" width="70px" height="10px" />
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
                  @for (j of skeletonCourseCards; track $index) {
                    <div class="flex flex-col gap-3 p-5 bg-surface">
                      <!-- Código + badge de estado -->
                      <div class="flex items-start justify-between gap-2">
                        <app-skeleton-block variant="text" width="32px" height="20px" />
                        <app-skeleton-block
                          variant="rect"
                          width="76px"
                          height="20px"
                          borderRadius="999px"
                        />
                      </div>
                      <!-- Nombre del curso (2 líneas, como line-clamp-2 real) -->
                      <div class="flex flex-col gap-1">
                        <app-skeleton-block variant="text" width="95%" height="10px" />
                        <app-skeleton-block variant="text" width="65%" height="10px" />
                      </div>
                      <!-- Barra de progreso + alumnos/promedio -->
                      <div class="flex flex-col gap-1.5 w-full">
                        <app-skeleton-block
                          variant="rect"
                          width="100%"
                          height="6px"
                          borderRadius="999px"
                        />
                        <div class="flex items-center justify-between">
                          <app-skeleton-block variant="text" width="60px" height="9px" />
                          <app-skeleton-block variant="text" width="28px" height="9px" />
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (isDesktopLayout()) {
              <div class="px-2 py-1">
                <app-skeleton-block variant="rect" width="100%" height="40px" borderRadius="8px" />
              </div>
            }
          </div>
        }

        <!-- ═══ Skeleton — grilla (se seleccionó un curso, aún cargando) ═══ -->
        @if (isLoading() && selectedCursoId() !== null) {
          <div class="bento-banner grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            @for (i of skeletonKpis; track $index) {
              <div class="card-tinted p-4 flex flex-col gap-2">
                <app-skeleton-block variant="text" width="70%" height="10px" />
                <app-skeleton-block variant="text" width="45%" height="22px" />
              </div>
            }
          </div>
          <div
            class="bento-banner rounded-xl border border-border bg-surface flex flex-col gap-3 p-4 flex-1 min-h-0"
          >
            @for (i of skeletonGradeRows; track $index) {
              <div class="flex items-center gap-3">
                <app-skeleton-block variant="circle" width="32px" height="32px" />
                <app-skeleton-block variant="text" width="160px" height="12px" />
                <div class="flex gap-2 ml-auto">
                  @for (j of skeletonGradeCols; track $index) {
                    <app-skeleton-block variant="rect" width="48px" height="28px" />
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- ═══ KPI strip ═══ -->
        @if (grilla() && !isLoading()) {
          @let s = stats();
          <div class="bento-banner grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <app-stat-box
              label="Alumnos completos"
              [value]="s.alumnosCompletos + ' / ' + s.totalAlumnos"
              icon="users"
              [variant]="
                s.alumnosCompletos === s.totalAlumnos && s.totalAlumnos > 0 ? 'success' : 'default'
              "
            />
            <app-stat-box
              label="Promedio del curso"
              [value]="s.promedioCurso ?? '—'"
              icon="trending-up"
              [variant]="promedioVariant()"
            />
            <app-stat-box
              label="En riesgo"
              [value]="s.enRiesgo"
              icon="alert-triangle"
              [variant]="s.enRiesgo > 0 ? 'error' : 'default'"
            />
            <app-stat-box
              label="Módulos cargados"
              [value]="s.modulosCargados + ' / ' + moduleCount"
              icon="list-checks"
              variant="default"
            />
          </div>
        }

        <!-- ═══ Grilla de notas ═══ -->
        @if (grilla() && !isLoading()) {
          @let g = grilla()!;
          <div
            class="bento-banner rounded-xl border border-border bg-surface flex flex-col overflow-hidden flex-1 min-h-0"
          >
            <!-- ── Desktop: tabla gradebook ── -->
            <div class="gradebook-scroll hidden md:block">
              <table class="gradebook-table w-full text-sm">
                <thead>
                  <tr>
                    <th
                      class="col-alumno px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                      style="min-width:220px"
                    >
                      Alumno
                    </th>
                    @for (name of g.moduleNames; track $index) {
                      <th
                        class="px-2 py-2 text-center border-b border-border align-bottom"
                        style="min-width:96px"
                        [title]="name"
                      >
                        <span
                          class="block text-2xs font-bold uppercase tracking-wider text-text-secondary"
                          >Mod {{ $index + 1 }}</span
                        >
                        <span
                          class="block text-2xs font-medium text-text-muted truncate max-w-24 mx-auto mt-0.5 normal-case"
                          >{{ name }}</span
                        >
                      </th>
                    }
                    <th
                      class="px-3 py-3 text-center text-2xs font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                      style="min-width:80px"
                    >
                      Progreso
                    </th>
                    <th
                      class="px-4 py-3 text-right text-2xs font-bold uppercase tracking-wider text-text-secondary border-b border-border"
                      style="min-width:90px"
                    >
                      Promedio
                    </th>
                  </tr>
                </thead>

                <tbody>
                  @for (fila of g.filas; track fila.enrollmentId; let r = $index) {
                    <tr class="border-b border-border/50 transition-colors list-item-hover">
                      <td class="col-alumno px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-brand/10 text-text-primary"
                          >
                            {{ fila.initials }}
                          </div>
                          <div class="min-w-0">
                            <p class="font-bold text-text-primary text-xs truncate">
                              {{ fila.nombre }}
                            </p>
                            <p class="text-2xs text-text-muted">{{ fila.rut }}</p>
                          </div>
                        </div>
                      </td>

                      @for (nota of fila.notas; track $index; let m = $index) {
                        <td class="grade-cell px-2 py-2 text-center">
                          @if (g.confirmed) {
                            <span
                              class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-bold min-w-14 border"
                              [class]="getReadonlyClasses(nota.passed)"
                            >
                              {{ nota.grade !== null ? nota.grade : '—' }}
                            </span>
                          } @else {
                            <input
                              [id]="'eval-d-' + r + '-' + m"
                              type="number"
                              [ngModel]="nota.grade"
                              (ngModelChange)="onGradeChange(fila.enrollmentId, m, $event)"
                              max="100"
                              min="10"
                              (keydown)="onGradeKeyDown($event, r, m, 'd')"
                              (blur)="onGradeBlur(fila.enrollmentId, m)"
                              placeholder="—"
                              class="w-16 text-center font-bold text-xs px-2 py-1.5 rounded-md border appearance-none outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                              [class]="getInputClasses(nota.grade)"
                              [attr.aria-label]="
                                'Nota módulo ' +
                                (m + 1) +
                                ' (' +
                                g.moduleNames[m] +
                                ') de ' +
                                fila.nombre
                              "
                              data-llm-description="module grade input scale 10 to 100"
                            />
                          }
                        </td>
                      }

                      <!-- Progreso -->
                      <td class="px-3 py-2 text-center">
                        <span
                          class="text-2xs font-semibold"
                          [class.text-success]="modulosCompletos(fila) === moduleCount"
                          [class.text-text-muted]="modulosCompletos(fila) !== moduleCount"
                          >{{ modulosCompletos(fila) }}/{{ moduleCount }}</span
                        >
                      </td>

                      <!-- Promedio -->
                      <td class="px-4 py-2 text-right">
                        @if (fila.promedio !== null) {
                          <app-badge [variant]="promedioBadgeVariant(fila.promedioAprobado)">
                            {{ fila.promedio }}
                          </app-badge>
                        } @else {
                          <span class="text-text-muted inline-block w-full text-center">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- ── Móvil: tarjetas por alumno ── -->
            <div class="md:hidden divide-y divide-border">
              @for (fila of g.filas; track fila.enrollmentId; let r = $index) {
                <div class="p-4 space-y-3">
                  <!-- Cabecera alumno -->
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-brand/10 text-text-primary"
                      >
                        {{ fila.initials }}
                      </div>
                      <div class="min-w-0">
                        <p class="item-title truncate">{{ fila.nombre }}</p>
                        <p class="text-2xs text-text-muted">{{ fila.rut }}</p>
                      </div>
                    </div>
                    @if (fila.promedio !== null) {
                      <app-badge
                        [variant]="promedioBadgeVariant(fila.promedioAprobado)"
                        class="shrink-0"
                      >
                        {{ fila.promedio }}
                      </app-badge>
                    } @else {
                      <span class="text-text-muted text-xs shrink-0">Sin promedio</span>
                    }
                  </div>

                  <!-- Progreso -->
                  <div class="flex items-center gap-2 text-2xs text-text-muted">
                    <app-icon name="list-checks" [size]="13" />
                    <span
                      [class.text-success]="modulosCompletos(fila) === moduleCount"
                      [class.font-semibold]="modulosCompletos(fila) === moduleCount"
                      >{{ modulosCompletos(fila) }} de {{ moduleCount }} módulos</span
                    >
                  </div>

                  <!-- Notas por módulo -->
                  <div class="grid grid-cols-2 gap-2">
                    @for (nota of fila.notas; track $index; let m = $index) {
                      <div
                        class="flex items-center justify-between gap-2 rounded-lg border border-border bg-elevated px-3 py-2"
                      >
                        <div class="min-w-0">
                          <p class="text-2xs font-bold text-text-secondary">Mod {{ m + 1 }}</p>
                          <p class="text-2xs text-text-muted truncate">{{ g.moduleNames[m] }}</p>
                        </div>
                        @if (g.confirmed) {
                          <span
                            class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-bold min-w-12 border shrink-0"
                            [class]="getReadonlyClasses(nota.passed)"
                          >
                            {{ nota.grade !== null ? nota.grade : '—' }}
                          </span>
                        } @else {
                          <input
                            [id]="'eval-m-' + r + '-' + m"
                            type="number"
                            [ngModel]="nota.grade"
                            (ngModelChange)="onGradeChange(fila.enrollmentId, m, $event)"
                            max="100"
                            min="10"
                            (keydown)="onGradeKeyDown($event, r, m, 'm')"
                            (blur)="onGradeBlur(fila.enrollmentId, m)"
                            placeholder="—"
                            class="w-14 text-center font-bold text-xs px-2 py-1.5 rounded-md border appearance-none outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors shrink-0"
                            [class]="getInputClasses(nota.grade)"
                            [attr.aria-label]="
                              'Nota módulo ' +
                              (m + 1) +
                              ' (' +
                              g.moduleNames[m] +
                              ') de ' +
                              fila.nombre
                            "
                            data-llm-description="module grade input scale 10 to 100"
                          />
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- ── Leyenda (separada de acciones) ── -->
            <div
              class="px-4 py-3 bg-elevated border-t border-border flex items-center gap-4 text-xs font-medium text-text-secondary flex-wrap shrink-0"
            >
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-success"></span> Aprobado (≥{{ gradePass }})
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-error"></span> Reprobado (&lt;{{ gradePass }})
              </span>
              @if (!g.confirmed) {
                <span class="flex items-center gap-1.5 text-text-muted">
                  <app-icon name="keyboard" [size]="14" /> Enter baja · Tab avanza
                </span>
              }
            </div>

            <!-- ── Barra de acciones ── -->
            @if (!g.confirmed) {
              <div
                class="px-4 py-3 border-t border-border flex items-center justify-end gap-3 flex-wrap shrink-0"
              >
                <button
                  class="btn-secondary"
                  [disabled]="isSaving() || !hayDirty()"
                  [title]="!hayDirty() ? 'No hay cambios para guardar' : 'Guardar borrador'"
                  (click)="guardarBorrador()"
                  data-llm-action="save-draft-grades"
                >
                  <app-icon name="save" [size]="14" />
                  Guardar
                </button>
                <button
                  class="btn-primary"
                  [disabled]="isSaving() || !todasConNota()"
                  [title]="
                    !todasConNota()
                      ? 'Completa todas las notas antes de confirmar'
                      : 'Confirmar notas (irreversible)'
                  "
                  (click)="confirmarNotas()"
                  data-llm-action="confirm-grades"
                >
                  <app-icon name="lock" [size]="14" />
                  Confirmar Final
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class EvaluacionesProfesionalContentComponent implements OnChanges {
  private readonly confirmModalService = inject(ConfirmModalService);
  private readonly gsap = inject(GsapAnimationsService);

  // ── Inputs (signals expuestos por EvaluacionesProfesionalFacade) ─────────────
  readonly landing = input.required<PromocionConCursos[]>();
  readonly landingLoaded = input.required<boolean>();
  readonly grilla = input.required<GrillaEvaluacion | null>();
  /** Distingue si `isLoading()` corresponde a cargar el aterrizaje o una grilla específica —
   * necesario para no mostrar el aterrizaje viejo y el skeleton a la vez al hacer clic en un
   * curso (bug real encontrado en QA visual, spec 0008-m). */
  readonly selectedCursoId = input.required<number | null>();
  readonly isLoading = input.required<boolean>();
  readonly isSaving = input.required<boolean>();
  readonly hayDirty = input.required<boolean>();
  /** Por CONTENEDOR (`LayoutService.tier()`), no por viewport — con un drawer abierto
   * angostando `<main>`, debe pasar a `false` igual que si fuera mobile real (specs 0030/0031).
   * true → aterrizaje paginado (2 promociones a la vez, sin scroll). false → lista completa con
   * scroll interno (mismo comportamiento que antes de paginar; decisión explícita del owner). */
  readonly isDesktopLayout = input.required<boolean>();

  // ── Outputs (acciones — el Smart wrapper las traduce a llamadas al Facade) ───
  readonly cursoSelected = output<number>();
  readonly volverAterrizaje = output<void>();
  readonly gradeChanged = output<{
    enrollmentId: number;
    moduleIndex: number;
    value: number | null;
  }>();
  readonly gradeBlurred = output<{ enrollmentId: number; moduleIndex: number }>();
  readonly guardarBorradorRequested = output<void>();
  readonly confirmarNotasRequested = output<void>();

  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  protected readonly gradePass = GRADE_PASS;
  protected readonly moduleCount = MODULE_COUNT;
  /** Replica la cantidad real de grupos de promoción visibles:
   * - Layout desktop (paginado): siempre `promoPageSize` (o menos si hay menos cacheadas) —
   *   nunca se ven más de 2 a la vez, el skeleton tampoco debería.
   * - Layout compacto (drawer abierto, sin paginar): la cantidad total cacheada, con fallback
   *   de 3 en la primera carga real de la sesión (aún no hay nada que replicar). */
  protected readonly skeletonPromoGroups = computed(() => {
    const cached = this.landing().length;
    if (this.isDesktopLayout()) {
      return Array.from({
        length: cached > 0 ? Math.min(cached, this.promoPageSize) : this.promoPageSize,
      });
    }
    return Array.from({ length: cached > 0 ? cached : 3 });
  });
  protected readonly skeletonCourseCards = Array.from({ length: 4 });
  protected readonly skeletonKpis = Array.from({ length: 4 });
  protected readonly skeletonGradeRows = Array.from({ length: 5 });
  protected readonly skeletonGradeCols = Array.from({ length: 3 });

  // ── Paginación del aterrizaje (solo en layout desktop — ver isDesktopLayout) ────────────────
  /** Cada tarjeta de promoción es alta (cabecera + 4 cursos) — mostrar más de 2 a la vez en
   * modo ancho terminaba cortando una tarjeta a la mitad contra el borde del scroll interno.
   * Con drawer abierto (layout compacto) se preserva el scroll libre sin paginar — decisión
   * explícita del owner tras QA visual (spec 0008-m, ronda 4). */
  protected readonly promoPageSize = 2;
  protected readonly currentPromoPage = signal(0);

  protected readonly totalPromoPages = computed(() =>
    Math.max(1, Math.ceil(this.landing().length / this.promoPageSize)),
  );

  protected readonly safePromoPage = computed(() =>
    Math.min(this.currentPromoPage(), this.totalPromoPages() - 1),
  );

  protected readonly visibleLanding = computed(() => {
    if (!this.isDesktopLayout()) return this.landing();
    const start = this.safePromoPage() * this.promoPageSize;
    return this.landing().slice(start, start + this.promoPageSize);
  });

  protected onPromoPageChange(event: { page?: number }): void {
    this.currentPromoPage.set(event.page ?? 0);
  }

  // ── Computed: KPIs (Functional Core) ──────────────────────────────────────
  protected readonly stats = computed(() => computeGradebookStats(this.grilla()));

  protected readonly promedioVariant = computed<'success' | 'error' | 'default'>(() => {
    const prom = this.stats().promedioCurso;
    if (prom === null) return 'default';
    return prom >= GRADE_PASS ? 'success' : 'error';
  });

  // ── Computed: hero adaptativo ─────────────────────────────────────────────
  protected readonly heroTitle = computed(() => {
    const g = this.grilla();
    return g ? g.courseName : 'Evaluaciones';
  });

  protected readonly heroSubtitle = computed(() => {
    const g = this.grilla();
    if (!g) return 'Registro de notas por módulo · Escala 10–100 · Mínimo aprobación: 75';
    const plural = g.totalAlumnos === 1 ? 'alumno' : 'alumnos';
    return `Escala 10–100 · aprobación ${GRADE_PASS} · ${g.totalAlumnos} ${plural}`;
  });

  protected readonly heroContextLine = computed(() => {
    const g = this.grilla();
    return g ? g.promotionName : '';
  });

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    const g = this.grilla();
    if (!g) return [];
    const chips: SectionHeroChip[] = [];
    if (g.confirmed) {
      chips.push({ label: 'Confirmadas', icon: 'lock', style: 'success' });
    } else {
      chips.push({ label: 'En edición', icon: 'edit-3', style: 'warning' });
      if (this.hayDirty()) {
        chips.push({ label: 'Cambios sin guardar', icon: 'circle', style: 'warning' });
      }
    }
    return chips;
  });

  // ── Reveal SWR-aware ──────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isLoading']) return;
    const ready = !this.isLoading();
    const grid = this.bentoGrid()?.nativeElement;
    if (ready && grid) {
      Promise.resolve().then(() => this.gsap.animateBentoGrid(grid));
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onCursoSelect(promotionCourseId: number): void {
    this.cursoSelected.emit(promotionCourseId);
  }

  protected voltearAterrizaje(): void {
    this.volverAterrizaje.emit();
  }

  protected onGradeChange(
    enrollmentId: number,
    moduleIndex: number,
    value: number | string | null,
  ): void {
    // `<input type="number">` con ngModel usa NumberValueAccessor → emite number|null,
    // NO string. Normalizar ambos casos (number directo o string desde otros paths).
    let numValue: number | null;
    if (value === null || value === '') {
      numValue = null;
    } else {
      const n = typeof value === 'number' ? value : Number(value);
      numValue = Number.isNaN(n) ? null : n;
    }
    this.gradeChanged.emit({ enrollmentId, moduleIndex, value: numValue });
  }

  protected modulosCompletos(fila: FilaEvaluacion): number {
    return countModulosCompletos(fila);
  }

  // ── Helpers de estilo — landing ───────────────────────────────────────────
  protected estadoBadgeVariant(estado: CursoEstado): 'success' | 'warning' | 'neutral' {
    switch (estado) {
      case 'confirmada':
        return 'success';
      case 'en_edicion':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected estadoBadgeIcon(estado: CursoEstado): string {
    switch (estado) {
      case 'confirmada':
        return 'check-circle';
      case 'en_edicion':
        return 'edit-3';
      default:
        return 'clock';
    }
  }

  protected estadoBadgeLabel(estado: CursoEstado): string {
    switch (estado) {
      case 'confirmada':
        return 'Confirmada';
      case 'en_edicion':
        return 'En edición';
      default:
        return 'Sin iniciar';
    }
  }

  protected promoStatusVariant(status: string): 'brand' | 'neutral' {
    return status === 'in_progress' ? 'brand' : 'neutral';
  }

  protected promoStatusLabel(status: string): string {
    return status === 'in_progress' ? 'En curso' : 'Planificada';
  }

  // ── Helpers de estilo — gradebook ─────────────────────────────────────────
  protected getInputClasses(grade: number | null): string {
    if (grade === null) return 'bg-surface border-border text-text-primary';
    return grade >= this.gradePass
      ? 'bg-success/10 text-success border-success/30'
      : 'bg-error/10 text-error border-error/30';
  }

  protected getReadonlyClasses(passed: boolean | null): string {
    if (passed === true) return 'bg-success/15 text-success border-success/20';
    if (passed === false) return 'bg-error/15 text-error border-error/20';
    return 'bg-surface border-border text-text-muted';
  }

  protected promedioBadgeVariant(passed: boolean | null): 'success' | 'error' | 'neutral' {
    if (passed === true) return 'success';
    if (passed === false) return 'error';
    return 'neutral';
  }

  protected todasConNota(): boolean {
    const g = this.grilla();
    if (!g) return false;
    return g.filas.every((f) => f.notas.every((n) => n.grade !== null));
  }

  protected onGradeBlur(enrollmentId: number, moduleIndex: number): void {
    this.gradeBlurred.emit({ enrollmentId, moduleIndex });
  }

  protected onGradeKeyDown(
    event: KeyboardEvent,
    rowIndex: number,
    moduleIndex: number,
    surface: 'd' | 'm',
  ): void {
    const input = event.target as HTMLInputElement;

    // Enter → baja a la misma columna en la fila siguiente (flujo de entrada masiva).
    if (event.key === 'Enter') {
      event.preventDefault();
      this.focusCell(rowIndex + 1, moduleIndex, surface);
      return;
    }

    const allowed = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;

    // Prevent non-numeric entries
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const preview = input.value.slice(0, start) + event.key + input.value.slice(end);

    if (preview.length > 3) event.preventDefault(); // Max 100
  }

  /** Mueve el foco a la celda (fila, módulo) de la superficie dada, si existe. */
  private focusCell(rowIndex: number, moduleIndex: number, surface: 'd' | 'm'): void {
    const next = document.getElementById(`eval-${surface}-${rowIndex}-${moduleIndex}`);
    if (next instanceof HTMLInputElement) {
      next.focus();
      next.select();
    }
  }

  protected guardarBorrador(): void {
    this.guardarBorradorRequested.emit();
  }

  protected async confirmarNotas(): Promise<void> {
    const confirmed = await this.confirmModalService.confirm({
      title: 'Confirmar notas',
      message:
        '¿Estás seguro de confirmar las notas? Esta acción es irreversible: las notas quedarán bloqueadas y no podrán editarse.',
      confirmLabel: 'Sí, confirmar notas',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });

    if (confirmed) {
      this.confirmarNotasRequested.emit();
    }
  }
}

import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { Button } from 'primeng/button';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminEditarPerfilDrawerComponent } from './editar-perfil-drawer/admin-editar-perfil-drawer.component';
import { AdminHistorialPagosComponent } from './components/historial-pagos/admin-historial-pagos.component';
import { AdminReagendarClasesDrawerComponent } from './reagendar-clases-drawer/admin-reagendar-clases-drawer.component';
import { AdminInasistenciasDrawerComponent } from './inasistencias-drawer/admin-inasistencias-drawer.component';
import { AdminFichaTecnicaDrawerComponent } from './ficha-tecnica-drawer/admin-ficha-tecnica-drawer.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroMenuItem,
} from '@core/models/ui/section-hero.model';
import { buildCarnetMenu } from '@core/utils/carnet-menu.util';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

@Component({
  selector: 'app-admin-alumno-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    RouterLink,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    Button,
    AdminHistorialPagosComponent,
    BentoGridLayoutDirective,
    EliminarAlumnoModalComponent,
    CardHoverDirective,
    TabsComponent,
  ],
  template: `
    <div
      class="bento-grid"
      appBentoReveal
      appBentoGridLayout
      [class.force-compact]="layoutDrawer.isOpen()"
    >
      <!-- ── Header (restaurado): navegación + contexto a la izquierda,
           solo Editar Perfil / Eliminar Alumno a la derecha — el resto de
           acciones vive ahora en la tarjeta de Perfil (ver headerActions()). ── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        [title]="facade.alumno()?.nombre ?? 'Cargando...'"
        [contextLine]="
          facade.alumno()
            ? facade.alumno()!.curso + ' · Matrícula ' + facade.alumno()!.matricula
            : 'Obteniendo información...'
        "
        icon="user"
        backRoute="/app/admin/alumnos"
        backLabel="Listado de Alumnos"
        [actions]="headerActions()"
        [chips]="heroChips()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Estado de Carga ── -->
      @if (facade.isLoading()) {
        <!-- Info Personal -->
        <div class="bento-card bento-tall flex flex-col h-full w-full">
          <div class="flex flex-col gap-5 p-5 md:p-6 h-full">
            <div class="flex items-center gap-4">
              <app-skeleton-block variant="circle" width="56px" height="56px" />
              <div class="flex flex-col gap-2 flex-1 min-w-0">
                <app-skeleton-block variant="text" width="70%" height="16px" />
                <app-skeleton-block variant="text" width="40%" height="12px" />
                <app-skeleton-block variant="text" width="30%" height="10px" />
              </div>
            </div>
            <div class="h-px bg-border-subtle w-full"></div>
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="40px" height="10px" />
                <app-skeleton-block variant="text" width="80%" height="14px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="60px" height="10px" />
                <app-skeleton-block variant="text" width="50%" height="14px" />
              </div>
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="100px" height="10px" />
                <app-skeleton-block variant="text" width="60%" height="14px" />
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Tarjetas de Progreso (x2) -->
        @for (_ of [1, 2]; track $index) {
          <div class="bento-card bento-wide">
            <div class="bento-card__body bento-card__body--spread">
              <div class="flex items-start justify-between w-full">
                <div class="flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="140px" height="20px" />
                  <app-skeleton-block variant="text" width="90px" height="12px" />
                </div>
                <div class="flex flex-col items-end gap-2">
                  <app-skeleton-block variant="text" width="60px" height="32px" />
                  <app-skeleton-block variant="text" width="50px" height="10px" />
                </div>
              </div>
              <div class="w-full mt-4">
                <app-skeleton-block
                  variant="rect"
                  width="100%"
                  height="16px"
                  borderRadius="9999px"
                />
                <div class="flex items-center justify-between mt-2">
                  <app-skeleton-block variant="text" width="40px" height="12px" />
                  <app-skeleton-block variant="text" width="80px" height="12px" />
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Estado Financiero (Historial de Pagos) -->
        <div class="bento-card bento-tall p-0! flex flex-col h-full w-full overflow-hidden">
          <div
            class="flex items-center justify-between p-5 border-b border-border-subtle bg-elevated/30"
          >
            <div class="flex flex-col gap-1">
              <app-skeleton-block variant="text" width="130px" height="16px" />
              <app-skeleton-block variant="text" width="100px" height="10px" />
            </div>
            <app-skeleton-block variant="circle" width="32px" height="32px" />
          </div>
          <div class="flex flex-col gap-5 p-5 flex-1 min-h-0">
            <div class="grid grid-cols-1 gap-4">
              <app-skeleton-block variant="rect" width="100%" height="70px" borderRadius="12px" />
              <app-skeleton-block variant="rect" width="100%" height="70px" borderRadius="12px" />
            </div>
            <div class="h-px bg-border-subtle w-full my-1"></div>
            <div class="flex flex-col gap-3">
              <app-skeleton-block variant="rect" width="100%" height="48px" borderRadius="12px" />
              <app-skeleton-block variant="rect" width="100%" height="48px" borderRadius="12px" />
            </div>
          </div>
        </div>

        <!-- ── Estado de Error ── -->
      } @else if (facade.error()) {
        <div class="bento-banner">
          <div class="flex flex-col gap-4">
            <div class="bento-card border-l-4 border-l-error p-5 flex flex-row items-center gap-4">
              <app-icon name="circle-alert" [size]="24" class="text-error shrink-0" />
              <div class="flex flex-col gap-1">
                <p class="font-bold text-lg text-text-primary">Error al cargar la ficha</p>
                <p class="text-sm text-text-secondary">{{ facade.error() }}</p>
              </div>
            </div>
            <p-button
              label="Volver al Listado"
              icon="pi pi-arrow-left"
              [text]="true"
              routerLink="/app/admin/alumnos"
            />
          </div>
        </div>

        <!-- ── Vista Principal ── -->
      } @else if (facade.alumno(); as alumno) {
        <!-- Selector de matrícula (solo visible cuando hay más de una) -->
        @if (facade.enrollmentSummaries().length > 1) {
          <div class="col-span-full flex w-full">
            <div class="p-1.5 w-full md:w-auto">
              <app-tabs
                [tabs]="enrollmentTabs()"
                [activeId]="activeEnrollmentStr()"
                variant="pill"
                (activeIdChange)="facade.selectEnrollment(+$event)"
              />
            </div>
          </div>
        }

        <!-- Bento Item 1: Info Personal (común) -->
        <div class="bento-card bento-tall" appCardHover>
          <div class="flex flex-col gap-5">
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-full bg-elevated border border-border-default flex items-center justify-center text-text-muted shrink-0"
                aria-hidden="true"
              >
                <app-icon name="user" [size]="24" />
              </div>
              <div class="flex flex-col min-w-0">
                <span
                  class="font-bold text-text-primary truncate"
                  [pTooltip]="alumno.nombre"
                  tooltipPosition="top"
                  >{{ alumno.nombre }}</span
                >
                <span class="text-xs text-text-secondary">{{ alumno.rut }}</span>
                <span class="text-sm font-bold text-text-primary mt-0.5" data-llm-info="matricula"
                  >Matrícula #{{ alumno.matricula }}</span
                >
                <span class="text-2xs font-bold text-brand uppercase tracking-wider mt-0.5"
                  >ESTADO: {{ alumno.estado }}</span
                >
              </div>
            </div>

            <div class="h-px bg-border-subtle w-full"></div>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1" data-llm-info="email">
                <span class="kpi-label">EMAIL</span>
                <span class="text-sm font-medium text-text-primary break-all">{{
                  alumno.email
                }}</span>
              </div>
              <div class="flex flex-col gap-1" data-llm-info="phone">
                <span class="kpi-label">TELÉFONO</span>
                <span class="text-sm font-medium text-text-primary">{{ alumno.telefono }}</span>
              </div>
              <div class="flex flex-col gap-1" data-llm-info="ingreso">
                <span class="kpi-label">FECHA DE INGRESO</span>
                <span class="text-sm font-medium text-text-primary">{{ alumno.fechaIngreso }}</span>
              </div>
            </div>

            <div class="h-px bg-border-subtle w-full"></div>

            <!-- ── Acciones operativas (Editar/Eliminar viven en el header) ── -->
            <div class="flex flex-col gap-2">
              <div class="grid grid-cols-2 gap-2">
                @for (action of secondaryActions(); track action.id) {
                  <div class="relative">
                    <button
                      type="button"
                      class="btn-secondary w-full justify-center gap-1.5"
                      [disabled]="action.disabled ?? false"
                      [attr.data-llm-action]="action.id"
                      [attr.aria-haspopup]="action.menu ? 'menu' : null"
                      [attr.aria-expanded]="action.menu ? openCardMenuId() === action.id : null"
                      (click)="
                        action.menu
                          ? toggleCardMenu(action.id, $event)
                          : handleHeroAction(action.id)
                      "
                    >
                      @if (action.icon) {
                        <app-icon
                          [name]="action.icon"
                          [size]="14"
                          [class.animate-spin]="action.loading"
                        />
                      }
                      <span class="truncate">{{ action.label }}</span>
                      @if (action.menu) {
                        <app-icon
                          name="chevron-down"
                          [size]="12"
                          class="shrink-0 card-menu-chevron"
                          [class.card-menu-chevron--open]="openCardMenuId() === action.id"
                        />
                      }
                    </button>

                    @if (action.menu && openCardMenuId() === action.id) {
                      <div class="card-action-menu" role="menu" (click)="$event.stopPropagation()">
                        @for (item of action.menu; track item.id) {
                          @if (item.header) {
                            <div class="card-action-menu__header">{{ item.label }}</div>
                          } @else {
                            <button
                              type="button"
                              role="menuitem"
                              class="card-action-menu__item"
                              [class.card-action-menu__item--disabled]="item.disabled"
                              [disabled]="item.disabled ?? false"
                              [attr.data-llm-action]="item.id"
                              (click)="onCardMenuItemClick(item)"
                            >
                              @if (item.icon) {
                                <app-icon
                                  [name]="item.icon"
                                  [size]="13"
                                  class="card-action-menu__item-icon"
                                />
                              }
                              <span class="card-action-menu__item-body">
                                <span class="card-action-menu__item-label">{{ item.label }}</span>
                                @if (item.hint) {
                                  <span class="card-action-menu__item-hint">{{ item.hint }}</span>
                                }
                              </span>
                            </button>
                          }
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Nuevos (Fase 1 — solo UI, sin lógica todavía) -->
                <button
                  type="button"
                  class="btn-secondary w-full justify-center gap-1.5"
                  data-llm-action="ver-inasistencias"
                  (click)="openInasistenciasPanel()"
                >
                  <app-icon name="alert-triangle" [size]="14" />
                  <span class="truncate">Inasistencias</span>
                </button>
                <button
                  type="button"
                  class="btn-secondary w-full justify-center gap-1.5"
                  data-llm-action="ver-ficha-tecnica"
                  (click)="openFichaTecnicaPanel()"
                >
                  <app-icon name="file-text" [size]="14" />
                  <span class="truncate">Ficha Técnica</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── PROGRESO: CLASE B ── -->
        @if (alumno.licenseGroup === 'class_b') {
          <!-- Clases Prácticas (ocupa 2 filas: progreso + grilla completa de las 12 clases) -->
          <div
            class="bento-card bento-wide flex flex-col gap-4"
            data-row-span-md="2"
            data-row-span="2"
            appCardHover
          >
            <!-- Cabecera + KPI -->
            <div class="flex items-start justify-between w-full">
              <div class="flex flex-col">
                <span class="text-lg font-bold text-text-primary">Clases Prácticas</span>
                <span class="text-xs text-brand font-medium">
                  {{ facade.progresoPractico().completadas }} de
                  {{ facade.progresoPractico().requeridas }} clases
                </span>
              </div>
              <div class="flex flex-col items-end">
                <span class="kpi-value text-brand text-3xl"
                  >{{ facade.porcentajePracticas() }}%</span
                >
                <span class="kpi-label">Completado</span>
              </div>
            </div>

            <!-- Barra de progreso -->
            <div class="w-full">
              <div
                class="progress-track"
                role="progressbar"
                [attr.aria-valuenow]="facade.porcentajePracticas()"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress-fill-brand transition-all duration-700"
                  [style.width.%]="facade.porcentajePracticas()"
                >
                  @if (facade.porcentajePracticas() > 15) {
                    <span class="progress-label-inline">
                      {{ facade.progresoPractico().completadas }} /
                      {{ facade.progresoPractico().requeridas }}
                    </span>
                  }
                </div>
              </div>
              <div class="flex items-center justify-between mt-2 kpi-label">
                <span class="text-brand">{{ facade.progresoPractico().completadas }} OK</span>
                <span class="text-text-muted">{{ restantesPracticas() }} Pendientes</span>
              </div>
            </div>

            <!-- Grilla completa: las 12 clases en 2 columnas -->
            <div class="h-px bg-border-subtle w-full"></div>
            <span class="kpi-label">Detalle de clases</span>
            <div class="grid grid-cols-2 gap-3 flex-1 content-start">
              @for (clase of facade.clasesPracticas(); track clase.numero) {
                <div
                  class="flex items-center gap-3 px-3 py-3 rounded-xl border min-w-0"
                  [class.bg-success/5]="clase.completada"
                  [class.border-success/20]="clase.completada"
                  [class.bg-error/5]="!clase.completada && clase.ausente"
                  [class.border-error/20]="!clase.completada && clase.ausente"
                  [class.bg-warning/5]="!clase.completada && !clase.ausente && clase.cancelada"
                  [class.border-warning/20]="!clase.completada && !clase.ausente && clase.cancelada"
                  [class.bg-brand/5]="
                    !clase.completada && !clase.ausente && !clase.cancelada && !!clase.fecha
                  "
                  [class.border-brand/20]="
                    !clase.completada && !clase.ausente && !clase.cancelada && !!clase.fecha
                  "
                  [class.bg-subtle]="
                    !clase.completada && !clase.ausente && !clase.cancelada && !clase.fecha
                  "
                  [class.border-border-subtle]="
                    !clase.completada && !clase.ausente && !clase.cancelada && !clase.fecha
                  "
                >
                  @if (clase.completada) {
                    <span
                      class="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center shrink-0"
                    >
                      <app-icon name="check" [size]="13" class="text-success" />
                    </span>
                  } @else if (clase.ausente) {
                    <span
                      class="w-7 h-7 rounded-full bg-error/15 flex items-center justify-center shrink-0"
                    >
                      <app-icon name="x" [size]="13" class="text-error" />
                    </span>
                  } @else if (clase.cancelada) {
                    <span
                      class="w-7 h-7 rounded-full bg-warning/15 flex items-center justify-center shrink-0"
                    >
                      <app-icon name="ban" [size]="13" class="text-warning" />
                    </span>
                  } @else if (clase.fecha) {
                    <span
                      class="w-7 h-7 rounded-full bg-brand/15 flex items-center justify-center shrink-0"
                    >
                      <app-icon name="calendar-clock" [size]="13" class="text-brand" />
                    </span>
                  } @else {
                    <span
                      class="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center shrink-0"
                    >
                      <app-icon name="clock" [size]="13" class="text-text-muted" />
                    </span>
                  }
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="text-xs font-bold shrink-0"
                        [class.text-success]="clase.completada"
                        [class.text-error]="!clase.completada && clase.ausente"
                        [class.text-warning]="
                          !clase.completada && !clase.ausente && clase.cancelada
                        "
                        [class.text-brand]="
                          !clase.completada && !clase.ausente && !clase.cancelada && !!clase.fecha
                        "
                        [class.text-text-muted]="
                          !clase.completada && !clase.ausente && !clase.cancelada && !clase.fecha
                        "
                        >Clase #{{ clase.numero }}</span
                      >
                      @if (clase.fecha) {
                        <span class="text-xs text-text-secondary shrink-0">{{ clase.fecha }}</span>
                        @if (clase.hora) {
                          <span class="text-xs text-text-muted shrink-0">{{
                            clase.hora.split('-')[0]
                          }}</span>
                        }
                      }
                    </div>
                    @if (clase.ausente) {
                      <span class="text-[11px] text-error font-semibold">
                        {{ clase.justificada ? 'Inasistencia — Justificada' : 'Inasistencia' }}
                      </span>
                    } @else if (clase.cancelada) {
                      <span class="text-[11px] text-warning font-semibold"
                        >Cancelada — pendiente reagendar</span
                      >
                    } @else if (clase.instructor) {
                      <span class="text-[11px] text-text-muted truncate">{{
                        clase.instructor
                      }}</span>
                    } @else {
                      <span class="text-2xs text-text-muted italic">Sin agendar</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── PROGRESO: CLASE PROFESIONAL ── -->
        @if (alumno.licenseGroup === 'professional') {
          <!-- Asistencia Teórica Prof -->
          <div class="bento-card bento-wide" appCardHover>
            <div class="bento-card__body bento-card__body--spread">
              <div class="flex items-start justify-between w-full">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-text-primary">Asistencia Teórica</span>
                  <span class="text-xs text-brand font-medium">
                    {{ facade.progresoTeoriaProf().asistidas }} de
                    {{ facade.progresoTeoriaProf().totales }} sesiones
                  </span>
                </div>
                <div class="flex flex-col items-end">
                  <span
                    class="kpi-value text-3xl"
                    [class.text-success]="facade.elegibilidadProf().teoria"
                    [class.text-error]="
                      !facade.elegibilidadProf().teoria && facade.progresoTeoriaProf().totales > 0
                    "
                    [class.text-text-muted]="facade.progresoTeoriaProf().totales === 0"
                  >
                    {{
                      facade.progresoTeoriaProf().pct !== null
                        ? facade.progresoTeoriaProf().pct + '%'
                        : '—'
                    }}
                  </span>
                  <span class="kpi-label">Mín. 75%</span>
                </div>
              </div>
              <div class="w-full mt-4">
                <div
                  class="progress-track"
                  role="progressbar"
                  [attr.aria-valuenow]="facade.progresoTeoriaProf().pct ?? 0"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="transition-all duration-700"
                    [class.progress-fill-success]="facade.elegibilidadProf().teoria"
                    [class.progress-fill-warning]="!facade.elegibilidadProf().teoria"
                    [style.width.%]="facade.progresoTeoriaProf().pct ?? 0"
                  >
                    @if ((facade.progresoTeoriaProf().pct ?? 0) > 15) {
                      <span class="progress-label-inline">
                        {{ facade.progresoTeoriaProf().asistidas }} /
                        {{ facade.progresoTeoriaProf().totales }}
                      </span>
                    }
                  </div>
                </div>
                <div class="flex items-center justify-between mt-2 kpi-label">
                  <span
                    [class.text-success]="facade.elegibilidadProf().teoria"
                    [class.text-error]="
                      !facade.elegibilidadProf().teoria && facade.progresoTeoriaProf().totales > 0
                    "
                    [class.text-text-muted]="facade.progresoTeoriaProf().totales === 0"
                  >
                    {{ facade.progresoTeoriaProf().asistidas }} asistidas
                  </span>
                  <span class="text-text-muted"
                    >{{
                      facade.progresoTeoriaProf().totales - facade.progresoTeoriaProf().asistidas
                    }}
                    inasistencias</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Asistencia Práctica Prof -->
          <div class="bento-card bento-wide" appCardHover>
            <div class="bento-card__body bento-card__body--spread">
              <div class="flex items-start justify-between w-full">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-text-primary">Asistencia Práctica</span>
                  <span class="text-xs text-text-secondary font-medium">
                    {{ facade.progresoPracticaProf().asistidas }} de
                    {{ facade.progresoPracticaProf().totales }} sesiones
                  </span>
                </div>
                <div class="flex flex-col items-end">
                  <span
                    class="kpi-value text-3xl"
                    [class.text-success]="facade.elegibilidadProf().practica"
                    [class.text-warning]="
                      !facade.elegibilidadProf().practica &&
                      facade.progresoPracticaProf().totales > 0
                    "
                    [class.text-text-muted]="facade.progresoPracticaProf().totales === 0"
                  >
                    {{
                      facade.progresoPracticaProf().pct !== null
                        ? facade.progresoPracticaProf().pct + '%'
                        : '—'
                    }}
                  </span>
                  <span class="kpi-label">Req. 100%</span>
                </div>
              </div>
              <div class="w-full mt-4">
                <div
                  class="progress-track"
                  role="progressbar"
                  [attr.aria-valuenow]="facade.progresoPracticaProf().pct ?? 0"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="transition-all duration-700"
                    [class.progress-fill-success]="facade.elegibilidadProf().practica"
                    [class.progress-fill-warning]="!facade.elegibilidadProf().practica"
                    [style.width.%]="facade.progresoPracticaProf().pct ?? 0"
                  >
                    @if ((facade.progresoPracticaProf().pct ?? 0) > 15) {
                      <span class="progress-label-inline">
                        {{ facade.progresoPracticaProf().asistidas }} /
                        {{ facade.progresoPracticaProf().totales }}
                      </span>
                    }
                  </div>
                </div>
                <div class="flex items-center justify-between mt-2 kpi-label">
                  <span
                    [class.text-success]="facade.elegibilidadProf().practica"
                    [class.text-warning]="
                      !facade.elegibilidadProf().practica &&
                      facade.progresoPracticaProf().totales > 0
                    "
                    [class.text-text-muted]="facade.progresoPracticaProf().totales === 0"
                  >
                    {{ facade.progresoPracticaProf().asistidas }} asistidas
                  </span>
                  <span class="text-text-muted"
                    >{{
                      facade.progresoPracticaProf().totales -
                        facade.progresoPracticaProf().asistidas
                    }}
                    inasistencias</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Nota promedio + Elegibilidad Prof -->
          <div class="bento-card bento-wide" appCardHover>
            <div class="bento-card__body bento-card__body--spread">
              <div class="flex items-start justify-between w-full">
                <div class="flex flex-col">
                  <span class="text-lg font-bold text-text-primary">Nota Promedio</span>
                  <span class="text-xs text-text-muted font-medium">Módulos del curso</span>
                </div>
                <div class="flex flex-col items-end">
                  <span
                    class="kpi-value text-3xl"
                    [class.text-success]="facade.elegibilidadProf().nota"
                    [class.text-error]="
                      !facade.elegibilidadProf().nota && facade.notaPromedioProf() !== null
                    "
                    [class.text-text-muted]="facade.notaPromedioProf() === null"
                  >
                    {{ facade.notaPromedioProf() !== null ? facade.notaPromedioProf() : '—' }}
                  </span>
                  <span class="kpi-label">Mín. 75 de 100</span>
                </div>
              </div>

              <div class="flex gap-2 mt-4 flex-wrap">
                <span
                  class="elig-badge"
                  [attr.data-met]="facade.elegibilidadProf().teoria"
                  data-llm-description="criterio elegibilidad: asistencia teórica mínima 75%"
                >
                  <app-icon
                    [name]="facade.elegibilidadProf().teoria ? 'circle-check' : 'circle-x'"
                    [size]="12"
                    [ariaHidden]="true"
                  />
                  Teoría ≥75%
                </span>
                <span
                  class="elig-badge"
                  [attr.data-met]="facade.elegibilidadProf().nota"
                  data-llm-description="criterio elegibilidad: nota promedio mínima 75"
                >
                  <app-icon
                    [name]="facade.elegibilidadProf().nota ? 'circle-check' : 'circle-x'"
                    [size]="12"
                    [ariaHidden]="true"
                  />
                  Nota ≥75
                </span>
                <span
                  class="elig-badge"
                  [attr.data-met]="facade.elegibilidadProf().pago"
                  data-llm-description="criterio elegibilidad: pago completo sin saldo pendiente"
                >
                  <app-icon
                    [name]="facade.elegibilidadProf().pago ? 'circle-check' : 'circle-x'"
                    [size]="12"
                    [ariaHidden]="true"
                  />
                  Pago completo
                </span>
                <span
                  class="elig-badge"
                  [attr.data-met]="facade.elegibilidadProf().practica"
                  data-llm-description="criterio elegibilidad: asistencia práctica 100% (flexible)"
                >
                  <app-icon
                    [name]="facade.elegibilidadProf().practica ? 'circle-check' : 'circle-x'"
                    [size]="12"
                    [ariaHidden]="true"
                  />
                  Práctica 100%
                </span>
              </div>
            </div>
          </div>
        }

        <!-- Bento Item 3: Historial de Pagos (común) — colocado aquí (no al final del DOM)
             para que en modo force-compact (flex-column) aparezca junto a Info Personal /
             Clases Prácticas, igual que ya lo posiciona grid-auto-flow:dense en modo grid. -->
        <app-admin-historial-pagos
          class="bento-tall w-full h-full block"
          [pagos]="facade.historialPagos()"
          [totalPagado]="alumno.totalPagado"
          [saldoPendiente]="alumno.saldoPendiente"
        />
      }
    </div>

    <!-- Modal de confirmación para archivar alumno -->
    <app-eliminar-alumno-modal
      [visible]="deleteModalVisible()"
      [alumnoNombre]="facade.alumno()?.nombre ?? ''"
      [hasHistory]="deleteHasHistory()"
      [isDeleting]="alumnosFacade.isArchiving()"
      (confirmado)="onConfirmArchivar()"
      (cancelado)="onCancelArchivar()"
    />

    <!-- Input oculto para subir contrato firmado (flujo online) -->
    <input
      #signedContractInput
      type="file"
      accept="application/pdf"
      class="hidden"
      aria-hidden="true"
      (change)="onSignedContractSelected($event)"
    />
  `,
  styles: `
    .kpi-label {
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .progress-track {
      width: 100%;
      height: 20px;
      background: var(--bg-subtle);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    .progress-fill-brand {
      height: 100%;
      background: var(--ds-brand);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      min-width: 40px;
    }
    .progress-fill-success {
      height: 100%;
      background: var(--state-success);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      min-width: 40px;
    }
    .progress-fill-warning {
      height: 100%;
      background: var(--state-warning);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      min-width: 40px;
    }
    .progress-label-inline {
      font-size: 11px;
      font-weight: var(--font-semibold);
      color: #fff;
      white-space: nowrap;
    }

    .elig-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }
    .elig-badge[data-met='true'] {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }
    .elig-badge[data-met='false'] {
      color: var(--state-error);
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
    }

    /* Force Compact overrides (Drawer Open) — mismo patrón que
       cuadratura-content.component.ts: colapsa el bento-grid a una sola
       columna en vez de repartir columnas angostas entre celdas con
       contenido de ancho fijo (RUT, email, montos). */
    .force-compact.bento-grid {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: var(--space-5) !important;
    }

    .force-compact.bento-grid > * {
      width: 100% !important;
    }

    /* ── Dropdown de acciones dentro de la tarjeta de Perfil (Carnet/Contrato) ──
       Mismo lenguaje visual que hero-menu-panel de SectionHeroComponent, pero
       posicionado relativo al botón (no fixed) — no necesita cálculo de posición
       por JS porque vive dentro del flujo estático de la card. */
    .card-menu-chevron {
      opacity: 0.7;
      transition: transform var(--duration-fast) var(--ease-standard);
    }
    .card-menu-chevron--open {
      transform: rotate(180deg);
    }

    .card-action-menu {
      position: absolute;
      z-index: 30;
      top: calc(100% + 4px);
      left: 0;
      min-width: 220px;
      padding: 6px;
      background: var(--bg-glass-surface, var(--bg-surface));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
    }

    .card-action-menu__header {
      padding: 8px 10px 4px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .card-action-menu__header:not(:first-child) {
      margin-top: 4px;
      border-top: 1px solid var(--border-subtle);
      padding-top: 10px;
    }

    .card-action-menu__item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      font-family: var(--font-body);
      text-align: left;
      cursor: pointer;
      transition: var(--transition-color);
    }
    .card-action-menu__item:not(:disabled):hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }
    .card-action-menu__item-icon {
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .card-action-menu__item-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }
    .card-action-menu__item-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-action-menu__item-hint {
      font-size: 10px;
      font-weight: var(--font-normal);
      color: var(--text-muted);
      white-space: normal;
      line-height: 1.3;
    }
    .card-action-menu__item--disabled,
    .card-action-menu__item--disabled:hover {
      background: transparent;
      color: var(--text-muted);
      cursor: not-allowed;
    }
  `,
})
export class AdminAlumnoDetalleComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  protected readonly alumnosFacade = inject(AdminAlumnosFacade);
  private readonly certFacade = inject(CertificacionClaseBFacade);
  private readonly certProfFacade = inject(CertificacionProfesionalFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly authFacade = inject(AuthFacade);

  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  private readonly signedContractInputRef = viewChild<ElementRef>('signedContractInput');

  constructor() {
    // Reveal SWR-aware: el grid de detalle carga async (fetch por :id). Las celdas
    // skeleton se reemplazan por las reales al resolver la data, así que disparamos
    // el reveal cuando el CONTENIDO está presente (!isLoading), no sobre el skeleton.
    // Mismo patrón que DashboardComponent.
    effect(() => {
      const ready = !this.facade.isLoading();
      const grid = this.bentoGrid()?.nativeElement;
      if (ready && grid) {
        Promise.resolve().then(() => this.gsap.animateBentoGrid(grid));
      }
    });
  }

  // ── Estado del modal de borrado ──────────────────────────────────────────────
  protected readonly deleteModalVisible = signal(false);
  protected readonly deleteHasHistory = signal(false);

  // ── Estado de carga al abrir el certificado ya generado (hero action) ───────
  protected readonly isViewingCertificado = signal(false);

  // ── Computed: derivados del facade ──────────────────────────────────────────
  protected readonly restantesPracticas = computed(
    () => this.facade.progresoPractico().requeridas - this.facade.progresoPractico().completadas,
  );

  /** Cuántas de las primeras 6 clases prácticas están completadas (firmadas). */
  private readonly primeras6Completadas = computed(
    () => this.facade.clasesPracticas().filter((c) => c.numero <= 6 && c.completada).length,
  );

  readonly enrollmentTabs = computed(() => {
    return this.facade.enrollmentSummaries().map((enr) => ({
      id: String(enr.id),
      label: enr.courseName + (enr.number ? ` · #${enr.number}` : ''),
      icon: 'car',
    }));
  });

  readonly activeEnrollmentStr = computed(() => String(this.facade.alumno()?.enrollmentId));

  // ── Secciones fijas: configuración de Hero ───────────────────────────────────
  protected readonly heroActions = computed<SectionHeroAction[]>(() => {
    const alumno = this.facade.alumno();
    if (!alumno) return [];

    const certPath = this.facade.certPdfPath();
    let certAction: SectionHeroAction;

    if (alumno.licenseGroup === 'professional') {
      const isGeneratingCert = this.certProfFacade.generatingId() === alumno.enrollmentId;
      const isViewingCert = this.isViewingCertificado();

      if (certPath) {
        certAction = {
          id: 'generar-certificado',
          label: isViewingCert ? 'Cargando...' : 'Ver Certificado',
          icon: isViewingCert ? 'loader-2' : 'file-check',
          primary: false,
          loading: isViewingCert,
          disabled: isViewingCert,
        };
      } else if (this.facade.elegibleProf()) {
        certAction = {
          id: 'generar-certificado',
          label: isGeneratingCert ? 'Generando...' : 'Generar Certificado',
          icon: isGeneratingCert ? 'loader-2' : 'file-plus',
          primary: false,
          loading: isGeneratingCert,
          disabled: isGeneratingCert,
        };
      } else {
        const e = this.facade.elegibilidadProf();
        const metCount = [e.teoria, e.pago, e.nota].filter(Boolean).length;
        certAction = {
          id: 'generar-certificado',
          label: `Certificado (${metCount}/3 criterios)`,
          icon: 'file-text',
          primary: false,
          disabled: true,
        };
      }
    } else {
      // Clase B
      const progreso = this.facade.progresoPractico();
      const canEmitCert = progreso.completadas >= progreso.requeridas;
      const isGeneratingCert = this.certFacade.generatingId() === alumno.enrollmentId;
      const isViewingCert = this.isViewingCertificado();

      if (certPath) {
        certAction = {
          id: 'generar-certificado',
          label: isViewingCert ? 'Cargando...' : 'Ver Certificado',
          icon: isViewingCert ? 'loader-2' : 'file-check',
          primary: false,
          loading: isViewingCert,
          disabled: isViewingCert,
        };
      } else if (canEmitCert) {
        certAction = {
          id: 'generar-certificado',
          label: isGeneratingCert ? 'Generando...' : 'Generar Certificado',
          icon: isGeneratingCert ? 'loader-2' : 'file-plus',
          primary: false,
          loading: isGeneratingCert,
          disabled: isGeneratingCert,
        };
      } else if (this.isAdmin()) {
        // Bypass admin: habilitado aunque falten prácticas — pide confirmación al generar.
        certAction = {
          id: 'generar-certificado',
          label: isGeneratingCert
            ? 'Generando...'
            : `Generar Certificado (${progreso.completadas}/${progreso.requeridas})`,
          icon: isGeneratingCert ? 'loader-2' : 'file-plus',
          primary: false,
          loading: isGeneratingCert,
          disabled: isGeneratingCert,
        };
      } else {
        certAction = {
          id: 'generar-certificado',
          label: `Certificado (${progreso.completadas}/${progreso.requeridas})`,
          icon: 'file-text',
          primary: false,
          disabled: true,
        };
      }
    }

    const isGenerating = this.facade.isGeneratingLicense();
    const isViewingCarnet = this.facade.isViewingCarnet();
    const isCarnetBusy = isGenerating || isViewingCarnet;
    const carnetActions: SectionHeroAction[] = [];

    if (alumno.licenseGroup === 'class_b') {
      carnetActions.push({
        id: 'carnet-menu',
        label: isGenerating ? 'Generando...' : isViewingCarnet ? 'Cargando...' : 'Carnet',
        icon: isCarnetBusy ? 'loader-2' : 'id-card',
        primary: false,
        disabled: isCarnetBusy,
        loading: isCarnetBusy,
        menu: buildCarnetMenu({
          initialPath: this.facade.licenseInitialPath(),
          fullPath: this.facade.licenseFullPath(),
          primeras6Completadas: this.primeras6Completadas(),
        }),
      });
    } else {
      carnetActions.push({
        id: 'generar-carnet',
        label: 'Generar Carnet',
        icon: 'id-card',
        primary: false,
        disabled: true,
      });
    }

    // ── Acciones de Contrato ───────────────────────────────────────────────────
    const channel = this.facade.registrationChannel();
    const contractGenerated = this.facade.contractGeneratedPath();
    const contractSigned = this.facade.contractSignedPath();
    const contractActions: SectionHeroAction[] = [];
    const isViewingContrato = this.facade.isViewingContrato();

    if (channel === 'presential' && contractGenerated) {
      // En flujo presencial, file_url ES el contrato firmado que se subió en Step 5
      contractActions.push({
        id: 'ver-contrato',
        label: isViewingContrato ? 'Cargando...' : 'Ver Contrato',
        icon: isViewingContrato ? 'loader-2' : 'file-signature',
        primary: false,
        disabled: isViewingContrato,
        loading: isViewingContrato,
      });
    } else if (channel === 'online') {
      if (contractSigned) {
        // Ya subieron el contrato firmado → solo "Ver Contrato"
        contractActions.push({
          id: 'ver-contrato',
          label: isViewingContrato ? 'Cargando...' : 'Ver Contrato',
          icon: isViewingContrato ? 'loader-2' : 'file-signature',
          primary: false,
          disabled: isViewingContrato,
          loading: isViewingContrato,
        });
      } else if (contractGenerated) {
        // Contrato generado pero no firmado → dropdown con Descargar + Subir Firmado
        const isBusy = this.facade.isDownloadingContract() || this.facade.isUploadingContract();
        contractActions.push({
          id: 'contrato-menu',
          label: isBusy ? 'Procesando...' : 'Contrato',
          icon: isBusy ? 'loader-2' : 'file-signature',
          primary: false,
          disabled: isBusy,
          loading: isBusy,
          menu: [
            {
              id: 'descargar-contrato',
              label: 'Descargar Contrato',
              icon: 'download',
              hint: 'Descarga el PDF para imprimir y firmar',
            },
            {
              id: 'subir-contrato-firmado',
              label: 'Subir Firmado',
              icon: 'upload',
              hint: 'Sube el PDF con la firma del alumno',
            },
          ],
        });
      }
    }

    // ── RF-053: Reagendar Clases (solo si hay agenda cancelada por penalización) ──
    const reagendarActions: SectionHeroAction[] = [];
    if (alumno.licenseGroup === 'class_b' && this.facade.puedeReagendarPenalizacion()) {
      reagendarActions.push({
        id: 'reagendar-clases',
        label: `Reagendar Clases (${this.facade.clasesPendientesReagendarCount()})`,
        icon: 'calendar-plus',
        primary: false,
      });
    }

    return [
      ...reagendarActions,
      ...contractActions,
      ...carnetActions,
      certAction,
      { id: 'editar-alumno', label: 'Editar Perfil', icon: 'user-pen', primary: true },
      {
        id: 'eliminar-alumno',
        label: 'Eliminar Alumno',
        icon: 'trash-2',
        primary: false,
        danger: true,
      },
    ];
  });

  // ── Acciones: Editar/Eliminar quedan en el header restaurado; el resto vive
  // en la tarjeta de Perfil. Ambos derivan del mismo heroActions() — cero
  // cambios a su lógica dinámica de labels/loading/disabled/menu. ───────────
  protected readonly headerActions = computed<SectionHeroAction[]>(() =>
    this.heroActions().filter((a) => a.primary || a.danger),
  );
  protected readonly secondaryActions = computed(() =>
    this.heroActions().filter((a) => !a.primary && !a.danger),
  );

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    const alumno = this.facade.alumno();
    if (!alumno) return [];
    return [
      {
        label: alumno.estado,
        style: alumno.estado?.toLowerCase() === 'activo' ? 'success' : 'warning',
        icon: 'circle-check',
      },
    ];
  });

  /** Id de la acción secundaria cuyo dropdown (Carnet/Contrato) está abierto. */
  protected readonly openCardMenuId = signal<string | null>(null);

  protected toggleCardMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openCardMenuId.update((current) => (current === id ? null : id));
  }

  /** Cierra cualquier dropdown abierto al hacer click fuera (mismo patrón que SectionHeroComponent). */
  @HostListener('document:click')
  protected closeCardMenu(): void {
    this.openCardMenuId.set(null);
  }

  protected onCardMenuItemClick(item: SectionHeroMenuItem): void {
    if (item.disabled || item.header) return;
    this.closeCardMenu();
    this.handleHeroAction(item.id);
  }

  // ── Drawers de Inasistencias / Ficha Técnica (Fase 2 app-like) ───────────────
  // Mismo sistema de drawer que Editar Perfil / Reagendar Clases: backdrop,
  // header con título + X, y scroll lock del fondo ya los da LayoutDrawerComponent.
  protected openInasistenciasPanel(): void {
    this.layoutDrawer.open(
      AdminInasistenciasDrawerComponent,
      'Inasistencias Registradas',
      'alert-triangle',
    );
  }

  protected openFichaTecnicaPanel(): void {
    this.layoutDrawer.open(AdminFichaTecnicaDrawerComponent, 'Ficha Técnica', 'clipboard-check');
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(Number(id))) {
      void this.facade.initialize(Number(id));
    }
  }

  // ── Handlers de Hero ────────────────────────────────────────────────────────
  protected handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'editar-alumno':
        this.openEditDrawer();
        break;
      case 'reagendar-clases':
        this.openReagendarClasesDrawer();
        break;
      case 'generar-carnet-6':
        void this.facade.generarCarnet(this.facade.alumno()!.enrollmentId!, 'initial');
        break;
      case 'ver-carnet-6':
        void this.handleVerCarnet('initial');
        break;
      case 'generar-carnet-12':
        void this.facade.generarCarnet(this.facade.alumno()!.enrollmentId!, 'full');
        break;
      case 'ver-carnet-12':
        void this.handleVerCarnet('full');
        break;
      case 'generar-certificado':
        void this.handleCertificado();
        break;
      case 'eliminar-alumno':
        void this.requestArchivar();
        break;
      case 'ver-contrato':
        void this.handleVerContrato();
        break;
      case 'descargar-contrato':
        void this.handleDescargarContrato();
        break;
      case 'subir-contrato-firmado':
        this.signedContractInputRef()?.nativeElement.click();
        break;
    }
  }

  private handleVerContrato(): Promise<void> {
    const channel = this.facade.registrationChannel();
    const path =
      channel === 'online' ? this.facade.contractSignedPath() : this.facade.contractGeneratedPath();
    if (!path) return Promise.resolve();
    return this.facade.verContrato(path);
  }

  private handleDescargarContrato(): Promise<void> {
    const path = this.facade.contractGeneratedPath();
    if (!path) return Promise.resolve();
    return this.facade.descargarContrato(path);
  }

  protected async onSignedContractSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const enrollmentId = this.facade.alumno()?.enrollmentId;
    if (!enrollmentId) return;
    await this.facade.subirContratoFirmado(enrollmentId, file);
    (event.target as HTMLInputElement).value = '';
  }

  private async handleCertificado(): Promise<void> {
    const alumno = this.facade.alumno();
    if (!alumno?.enrollmentId) return;

    const certPath = this.facade.certPdfPath();

    if (alumno.licenseGroup === 'professional') {
      if (certPath) {
        this.isViewingCertificado.set(true);
        try {
          await this.certProfFacade.verCertificado(certPath, alumno.nombre);
        } finally {
          this.isViewingCertificado.set(false);
        }
        return;
      }
      // Práctica incompleta: advertencia (criterio flexible, no bloquea)
      if (!this.facade.elegibilidadProf().practica) {
        const pct = this.facade.progresoPracticaProf().pct ?? 0;
        const confirmed = await this.confirmModal.confirm({
          title: 'Asistencia práctica incompleta',
          message: `${alumno.nombre} registra ${pct}% de asistencia práctica. ¿Deseas generar el certificado de todas formas?`,
          severity: 'warn',
          confirmLabel: 'Generar',
          cancelLabel: 'Cancelar',
        });
        if (!confirmed) return;
      }
      await this.certProfFacade.generarCertificado(alumno.enrollmentId);
      await this.facade.refresh();
    } else {
      // Clase B
      if (certPath) {
        this.isViewingCertificado.set(true);
        try {
          await this.certFacade.verCertificado(certPath, alumno.nombre);
        } finally {
          this.isViewingCertificado.set(false);
        }
        return;
      }

      const progreso = this.facade.progresoPractico();
      if (progreso.completadas < progreso.requeridas) {
        // Solo el admin ve el botón habilitado en este caso — la secretaria
        // nunca llega aquí (acción deshabilitada en heroActions).
        if (!this.isAdmin()) return;
        const confirmed = await this.confirmModal.confirm({
          title: 'Prácticas incompletas',
          message: `${alumno.nombre} lleva ${progreso.completadas}/${progreso.requeridas} clases prácticas completadas. ¿Deseas generar el certificado de todas formas?`,
          severity: 'warn',
          confirmLabel: 'Generar',
          cancelLabel: 'Cancelar',
        });
        if (!confirmed) return;
      }

      await this.certFacade.generarCertificado(alumno.enrollmentId);
      await this.facade.refresh();
    }
  }

  /** Abre el carnet ya generado de la variante indicada. */
  private async handleVerCarnet(variant: 'initial' | 'full'): Promise<void> {
    const alumno = this.facade.alumno();
    if (!alumno || alumno.licenseGroup !== 'class_b') return;
    const path =
      variant === 'full' ? this.facade.licenseFullPath() : this.facade.licenseInitialPath();
    if (!path) return;
    await this.facade.verCarnet(path);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected openEditDrawer(): void {
    this.layoutDrawer.open(
      AdminEditarPerfilDrawerComponent,
      'Editar Perfil del Alumno',
      'user-pen',
    );
  }

  /** RF-053: abre el agendador reutilizado del wizard para reponer clases penalizadas. */
  protected openReagendarClasesDrawer(): void {
    if (!this.facade.puedeReagendarPenalizacion()) return;
    this.layoutDrawer.open(
      AdminReagendarClasesDrawerComponent,
      'Reagendar Clases',
      'calendar-plus',
    );
  }

  // ── Flujo de archivado ───────────────────────────────────────────────────────
  private get studentId(): number | null {
    const id = this.route.snapshot.paramMap.get('id');
    return id && !isNaN(Number(id)) ? Number(id) : null;
  }

  protected async requestArchivar(): Promise<void> {
    const id = this.studentId;
    if (id === null) return;
    const { hasHistory } = await this.alumnosFacade.checkHistorial(id);
    this.deleteHasHistory.set(hasHistory);
    this.deleteModalVisible.set(true);
  }

  protected async onConfirmArchivar(): Promise<void> {
    const id = this.studentId;
    if (id === null) return;
    try {
      await this.alumnosFacade.archivarAlumno(id);
      void this.router.navigate(['/app/admin/alumnos']);
    } finally {
      this.deleteModalVisible.set(false);
      this.deleteHasHistory.set(false);
    }
  }

  protected onCancelArchivar(): void {
    this.deleteModalVisible.set(false);
    this.deleteHasHistory.set(false);
  }
}

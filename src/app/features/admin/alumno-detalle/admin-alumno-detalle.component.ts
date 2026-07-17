import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { FichaTecnicaPrintService } from '@core/services/ui/ficha-tecnica-print.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { Button } from 'primeng/button';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminInasistenciaDrawerComponent } from './inasistencia-drawer/admin-inasistencia-drawer.component';
import { AdminEditarPerfilDrawerComponent } from './editar-perfil-drawer/admin-editar-perfil-drawer.component';
import { AdminFichaTecnicaComponent } from './components/ficha-tecnica/admin-ficha-tecnica.component';
import { AdminHistorialPagosComponent } from './components/historial-pagos/admin-historial-pagos.component';
import { AdminReprogramarClaseDrawerComponent } from './reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component';
import { AdminReagendarClasesDrawerComponent } from './reagendar-clases-drawer/admin-reagendar-clases-drawer.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import type { ClasePracticaUI } from '@core/models/ui/alumno-detalle.model';
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
    AdminFichaTecnicaComponent,
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
      <!-- ── Hero Principal (Siempre visible) ── -->
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
        [actions]="heroActions()"
        [chips]="heroChips()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Estado de Carga ── -->
      @if (facade.isLoading()) {
        <!-- 1. Skeleton: Selector de Matrícula -->
        <div class="col-span-full flex w-full">
          <div
            class="flex items-center bg-surface border border-border-subtle p-1.5 rounded-2xl shadow-sm gap-2 w-full md:w-auto overflow-hidden"
          >
            <app-skeleton-block variant="rect" width="120px" height="40px" borderRadius="12px" />
            <app-skeleton-block variant="rect" width="140px" height="40px" borderRadius="12px" />
          </div>
        </div>

        <!-- 2. Info Personal -->
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

        <!-- 4. Ficha Técnica (bento-hero) -->
        <div class="bento-card bento-hero p-0! flex flex-col h-full w-full overflow-hidden">
          <div
            class="flex items-center justify-between gap-4 p-5 border-b border-border-subtle bg-elevated/30"
          >
            <div class="flex items-center gap-3">
              <app-skeleton-block variant="rect" width="32px" height="32px" borderRadius="8px" />
              <div class="flex flex-col gap-1">
                <app-skeleton-block variant="text" width="120px" height="16px" />
                <app-skeleton-block variant="text" width="180px" height="12px" />
              </div>
            </div>
          </div>
          <div class="p-5 flex flex-col gap-4">
            <app-skeleton-block variant="rect" width="100%" height="40px" />
            <app-skeleton-block variant="rect" width="100%" height="40px" />
            <app-skeleton-block variant="rect" width="100%" height="40px" />
          </div>
        </div>

        <!-- 5. Estado Financiero (bento-tall) -->
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

        <!-- Bento Item 4: Inasistencias (Banner, común) -->
        <div class="bento-card bento-banner bg-warning-subtle border-warning">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-xl bg-surface border border-warning-border flex items-center justify-center text-warning shadow-sm"
              >
                <app-icon name="alert-triangle" [size]="20" />
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-text-primary">Inasistencias Registradas</span>
                <span class="text-xs text-text-secondary">
                  @if (alumno.licenseGroup === 'class_b') {
                    @if (facade.inasistenciasClaseB().length > 0) {
                      Se han detectado {{ facade.inasistenciasClaseB().length }} inasistencias en
                      clases prácticas.
                    } @else {
                      No hay inasistencias registradas hasta la fecha.
                    }
                  } @else {
                    @if (facade.inasistencias().length > 0) {
                      Se han detectado {{ facade.inasistencias().length }} registros que requieren
                      seguimiento.
                    } @else {
                      No hay inasistencias registradas hasta la fecha.
                    }
                  }
                </span>
              </div>
            </div>
            @if (alumno.licenseGroup !== 'class_b') {
              <p-button
                label="Registrar Nueva"
                icon="pi pi-plus"
                size="small"
                severity="warn"
                (onClick)="openInasistenciaDrawer()"
              />
            }
          </div>

          @if (alumno.licenseGroup === 'class_b') {
            @if (facade.inasistenciasClaseB().length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                @for (item of facade.inasistenciasClaseB(); track item.id) {
                  <div
                    class="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle shadow-sm transition-all hover:shadow-md"
                  >
                    <div class="inas-date-pill border-none! bg-elevated!">
                      <span class="text-[10px] font-bold text-text-secondary">{{
                        item.fecha
                      }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-bold text-text-primary truncate m-0 font-display uppercase tracking-tight"
                      >
                        Clase #{{ item.claseNumero ?? '—' }}
                      </p>
                      <p class="text-[10px] text-text-muted truncate m-0 italic">
                        {{ item.instructor ?? 'Sin instructor' }}
                      </p>
                    </div>
                    <div class="flex flex-col items-end gap-0.5 shrink-0">
                      <div class="flex items-center gap-1">
                        @if (item.reagendada) {
                          <span
                            class="inas-status-badge"
                            data-status="reagendada"
                            [pTooltip]="'Esta inasistencia ya fue reagendada'"
                            tooltipPosition="top"
                            data-llm-description="indica que la clase asociada a esta inasistencia ya fue reagendada"
                            >Reagendada</span
                          >
                        }
                        @if (item.justificada) {
                          <span class="inas-status-badge" data-status="approved">Justificado</span>
                        }
                      </div>
                      @if (item.justificada) {
                        @if (item.justificacion) {
                          <span
                            class="text-[10px] text-text-muted italic truncate max-w-32 cursor-help"
                            [pTooltip]="'Motivo: ' + item.justificacion"
                            tooltipPosition="top"
                            data-llm-description="motivo de la justificación de la inasistencia"
                          >
                            Motivo: {{ item.justificacion }}
                          </span>
                        }
                      } @else {
                        <button
                          type="button"
                          class="text-xs font-semibold text-brand hover:underline shrink-0"
                          data-llm-action="justificar-inasistencia-clase-b"
                          (click)="openJustificarClaseB(item.id)"
                        >
                          Justificar
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            @if (facade.inasistencias().length > 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                @for (item of facade.inasistencias().slice(0, 3); track item.id) {
                  <div
                    class="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle shadow-sm transition-all hover:shadow-md"
                  >
                    <div class="inas-date-pill border-none! bg-elevated!">
                      <span class="text-[10px] font-bold text-text-secondary">{{
                        item.fecha
                      }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-xs font-bold text-text-primary truncate m-0 font-display uppercase tracking-tight"
                      >
                        {{ item.documentType }}
                      </p>
                      <p class="text-[10px] text-text-muted truncate m-0 italic">
                        {{ item.description || 'Sin descripción' }}
                      </p>
                    </div>
                    <span class="inas-status-badge" [attr.data-status]="item.status">
                      {{ statusLabel(item.status) }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        </div>

        <!-- Bento Item 5: Ficha Técnica (solo Clase B) -->
        @if (alumno.licenseGroup === 'class_b') {
          <app-admin-ficha-tecnica
            class="bento-hero w-full h-full block"
            [clases]="facade.clasesPracticas()"
            (imprimirFicha)="imprimirFicha()"
            (reprogramarRequested)="openReprogramarDrawer($event)"
          />
        }
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

    <!-- Modal de justificación de inasistencia Clase B (RF-053) -->
    <!-- Fuera de .bento-grid a propósito: ese contenedor recibe transform CSS de
         GsapAnimationsService.animateBentoGrid(), lo que crea un containing
         block para position: fixed y rompe el overlay centrado en viewport. -->
    @if (justificarClaseBOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        (click)="closeJustificarClaseB()"
      >
        <div
          class="surface-glass rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-label="Justificar inasistencia"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-text-primary">Justificar Inasistencia</h3>
            <button
              class="p-1 rounded-md text-text-muted hover:text-text-primary"
              aria-label="Cerrar"
              (click)="closeJustificarClaseB()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <p class="text-sm text-text-secondary">
            Ingresa el motivo de la justificación para registrar en el historial del alumno.
          </p>
          <textarea
            class="w-full rounded-lg border p-3 text-sm text-text-primary bg-surface resize-none focus:outline-none"
            style="border-color: var(--border-subtle)"
            rows="3"
            placeholder="Ej: Certificado médico presentado..."
            data-llm-description="textarea for absence justification reason"
            [value]="justificarClaseBReason()"
            (input)="justificarClaseBReason.set($any($event.target).value)"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary text-sm px-4 py-2" (click)="closeJustificarClaseB()">
              Cancelar
            </button>
            <button
              class="btn-primary text-sm px-4 py-2"
              [disabled]="!justificarClaseBReason().trim()"
              data-llm-action="submit-justificacion-clase-b"
              (click)="submitJustificarClaseB()"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }

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

    .inas-status-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }
    .inas-status-badge[data-status='pending'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
    .inas-status-badge[data-status='approved'],
    .inas-status-badge[data-status='revisado'] {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }
    .inas-status-badge[data-status='rejected'] {
      color: var(--state-error);
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
    }
    .inas-status-badge[data-status='reagendada'] {
      color: var(--state-info);
      background: var(--state-info-bg);
      border-color: var(--state-info-border);
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
  private readonly fichaTecnicaPrint = inject(FichaTecnicaPrintService);
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

  // ── Estado del modal de justificación (Inasistencias Clase B, RF-053) ───────
  protected readonly justificarClaseBOpen = signal(false);
  protected readonly justificarClaseBId = signal<number | null>(null);
  protected readonly justificarClaseBReason = signal('');

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

    if (channel === 'presential' && contractGenerated) {
      // En flujo presencial, file_url ES el contrato firmado que se subió en Step 5
      contractActions.push({
        id: 'ver-contrato',
        label: 'Ver Contrato',
        icon: 'file-signature',
        primary: false,
      });
    } else if (channel === 'online') {
      if (contractSigned) {
        // Ya subieron el contrato firmado → solo "Ver Contrato"
        contractActions.push({
          id: 'ver-contrato',
          label: 'Ver Contrato',
          icon: 'file-signature',
          primary: false,
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

  // ── Helpers de template ─────────────────────────────────────────────────────
  protected imprimirFicha(): void {
    const alumno = this.facade.alumno();
    this.fichaTecnicaPrint.printFichaTecnica(this.facade.clasesPracticas(), {
      studentName: alumno?.nombre,
      matricula: alumno?.matricula,
    });
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      revisado: 'Revisado',
      rejected: 'Rechazado',
    };
    return map[status?.toLowerCase()] ?? status ?? 'Pendiente';
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected openInasistenciaDrawer(): void {
    this.layoutDrawer.open(
      AdminInasistenciaDrawerComponent,
      'Registrar Inasistencia',
      'alert-triangle',
    );
  }

  // ── Justificación de inasistencias Clase B (RF-053) ─────────────────────────
  protected openJustificarClaseB(attendanceId: number): void {
    this.justificarClaseBId.set(attendanceId);
    this.justificarClaseBReason.set('');
    this.justificarClaseBOpen.set(true);
  }

  protected closeJustificarClaseB(): void {
    this.justificarClaseBOpen.set(false);
    this.justificarClaseBId.set(null);
    this.justificarClaseBReason.set('');
  }

  protected submitJustificarClaseB(): void {
    const id = this.justificarClaseBId();
    const reason = this.justificarClaseBReason().trim();
    if (id === null || !reason) return;
    void this.facade.justificarInasistenciaClaseB(id, reason);
    this.closeJustificarClaseB();
  }

  protected openEditDrawer(): void {
    this.layoutDrawer.open(
      AdminEditarPerfilDrawerComponent,
      'Editar Perfil del Alumno',
      'user-pen',
    );
  }

  protected openReprogramarDrawer(clase: ClasePracticaUI): void {
    const enrollmentId = this.facade.alumno()?.enrollmentId;
    if (enrollmentId == null) return;
    this.facade.setReprogramarTarget(clase.sessionId, clase.numero, enrollmentId);
    this.layoutDrawer.open(
      AdminReprogramarClaseDrawerComponent,
      'Reprogramar Clase',
      'calendar-clock',
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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AdminInasistenciaDrawerComponent } from './inasistencia-drawer/admin-inasistencia-drawer.component';
import { AdminEditarPerfilDrawerComponent } from './editar-perfil-drawer/admin-editar-perfil-drawer.component';

@Component({
  selector: 'app-admin-alumno-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonBlockComponent,
    AdminInasistenciaDrawerComponent,
    AdminEditarPerfilDrawerComponent,
  ],
  template: `
    <div class="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <!-- ── Estado de Carga ── -->
      @if (facade.isLoading()) {
        <div class="flex flex-col gap-4">
          <app-skeleton-block variant="text" width="220px" height="14px" />
          <app-skeleton-block variant="text" width="340px" height="36px" />
          <app-skeleton-block variant="text" width="260px" height="16px" />
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <app-skeleton-block variant="rect" width="100%" height="260px" />
            <app-skeleton-block variant="rect" width="100%" height="260px" />
            <app-skeleton-block variant="rect" width="100%" height="260px" />
          </div>
        </div>

        <!-- ── Estado de Error ── -->
      } @else if (facade.error()) {
        <div
          class="card p-5 flex items-start gap-3"
          style="border-left: 3px solid var(--state-error)"
        >
          <app-icon
            name="circle-alert"
            [size]="18"
            style="color: var(--state-error); flex-shrink: 0; margin-top: 2px"
          />
          <div class="flex flex-col gap-1">
            <p class="font-semibold text-sm" style="color: var(--text-primary)">
              Error al cargar la ficha
            </p>
            <p class="text-sm" style="color: var(--text-secondary)">{{ facade.error() }}</p>
          </div>
        </div>
        <a
          routerLink="/app/admin/alumnos"
          class="breadcrumb-link inline-flex items-center gap-2 text-sm font-medium"
        >
          <app-icon name="arrow-left" [size]="15" />
          Volver al Listado
        </a>

        <!-- ── Vista Principal ── -->
      } @else if (facade.alumno(); as alumno) {
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <a routerLink="/app/admin/dashboard" class="breadcrumb-link" data-llm-nav="inicio"
            >Inicio</a
          >
          <span style="color: var(--text-muted)">/</span>
          <a routerLink="/app/admin/alumnos" class="breadcrumb-link" data-llm-nav="alumnos"
            >Alumnos</a
          >
          <span style="color: var(--text-muted)">/</span>
          <span style="color: var(--text-secondary)">Ficha de {{ alumno.nombre }}</span>
        </nav>

        <!-- Header -->
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex flex-col gap-1">
            <h1 class="text-3xl font-bold" style="color: var(--text-primary)">
              {{ alumno.nombre }}
            </h1>
            <p class="text-sm font-medium" style="color: var(--ds-brand)">
              {{ alumno.curso }} · Matrícula {{ alumno.matricula }}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              class="btn-outline flex items-center gap-2"
              data-llm-action="generar-carnet"
              aria-label="Generar carnet del alumno"
            >
              <app-icon name="credit-card" [size]="15" />
              Generar Carnet
            </button>
            <button
              class="btn-outline flex items-center gap-2"
              disabled
              data-llm-action="generar-certificado"
              aria-label="Generar certificado (requiere completar clases)"
              style="opacity: 0.5; cursor: not-allowed"
            >
              <app-icon name="clock" [size]="15" />
              Generar Certificado ({{ facade.progresoPractico().completadas }}/{{
                facade.progresoPractico().requeridas
              }})
            </button>
            <button
              class="btn-outline flex items-center gap-2"
              (click)="editDrawerOpen.set(true)"
              data-llm-action="editar-alumno"
              aria-label="Editar datos del alumno"
            >
              <app-icon name="edit-3" [size]="15" />
              Editar
            </button>
          </div>
        </div>

        <!-- 3-column Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Card 1: Info Personal -->
          <div class="card p-5 flex flex-col gap-4">
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center rounded-full shrink-0"
                style="width:52px;height:52px;background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-muted)"
                aria-hidden="true"
              >
                <app-icon name="user" [size]="24" />
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="font-semibold text-sm" style="color: var(--text-primary)">{{
                  alumno.nombre
                }}</span>
                <span class="text-sm" style="color: var(--text-secondary)">{{ alumno.rut }}</span>
                <span class="text-xs" style="color: var(--ds-brand)"
                  >Matrícula {{ alumno.matricula }}</span
                >
              </div>
            </div>

            <hr style="border-color: var(--border-subtle)" />

            <div class="flex flex-col gap-3">
              <p class="info-label">INFORMACIÓN PERSONAL</p>
              <div class="flex flex-col gap-0.5">
                <span class="info-field-label">EMAIL</span>
                <span class="info-field-value">{{ alumno.email }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="info-field-label">TELÉFONO</span>
                <span class="info-field-value">{{ alumno.telefono }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="info-field-label">FECHA DE INGRESO</span>
                <span class="info-field-value">{{ alumno.fechaIngreso }}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="info-field-label">ESTADO</span>
                <span class="badge-activo">{{ alumno.estado }}</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Clases Prácticas -->
          <div class="card p-5 flex flex-col gap-4">
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="text-base font-semibold" style="color: var(--text-primary)"
                  >Clases Prácticas</span
                >
                <span class="text-xs" style="color: var(--ds-brand)">
                  De {{ facade.progresoPractico().requeridas }} clases requeridas
                </span>
              </div>
              <span
                class="kpi-value"
                style="color: var(--ds-brand); font-size: 2rem"
                [attr.aria-label]="facade.porcentajePracticas() + '% completado'"
              >
                {{ facade.porcentajePracticas() }}%
              </span>
            </div>
            <div
              class="progress-track"
              role="progressbar"
              [attr.aria-valuenow]="facade.progresoPractico().completadas"
              [attr.aria-valuemax]="facade.progresoPractico().requeridas"
              aria-label="Progreso clases prácticas"
            >
              <div class="progress-fill-brand" [style.width.%]="facade.porcentajePracticas()">
                <span class="progress-label-inline">
                  {{ facade.progresoPractico().completadas }}/{{
                    facade.progresoPractico().requeridas
                  }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span style="color: var(--ds-brand)"
                >{{ facade.progresoPractico().completadas }} completadas</span
              >
              <span style="color: var(--text-muted)">{{ restantesPracticas() }} restantes</span>
            </div>
          </div>

          <!-- Card 3: Clases Teóricas -->
          <div class="card p-5 flex flex-col gap-4">
            <div class="flex items-start justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="text-base font-semibold" style="color: var(--text-primary)"
                  >Clases Teóricas</span
                >
                <span class="text-xs" style="color: var(--state-success)">
                  De {{ facade.progresoTeorico().requeridas }} clases requeridas
                </span>
              </div>
              <span
                class="kpi-value"
                style="color: var(--state-success); font-size: 2rem"
                [attr.aria-label]="facade.porcentajeTeoricas() + '% completado'"
              >
                {{ facade.porcentajeTeoricas() }}%
              </span>
            </div>
            <div
              class="progress-track"
              role="progressbar"
              [attr.aria-valuenow]="facade.progresoTeorico().completadas"
              [attr.aria-valuemax]="facade.progresoTeorico().requeridas"
              aria-label="Progreso clases teóricas"
            >
              <div class="progress-fill-success" [style.width.%]="facade.porcentajeTeoricas()">
                <span class="progress-label-inline">
                  {{ facade.progresoTeorico().completadas }}/{{
                    facade.progresoTeorico().requeridas
                  }}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span style="color: var(--state-success)"
                >{{ facade.progresoTeorico().completadas }} asistidas</span
              >
              <span style="color: var(--text-muted)">{{ restantesTeoricas() }} restantes</span>
            </div>
          </div>
        </div>

        <!-- Sección Inasistencias -->
        <div class="inasistencias-container p-4 flex flex-col gap-3 rounded-xl">
          <!-- Header -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="flex items-center justify-center rounded-lg shrink-0"
                style="width:36px;height:36px;background:var(--state-warning-bg);border:1px solid var(--state-warning-border);color:var(--state-warning)"
                aria-hidden="true"
              >
                <app-icon name="alert-triangle" [size]="18" />
              </div>
              <span class="font-semibold text-sm" style="color: var(--text-primary)">
                Inasistencias Registradas
                @if (facade.inasistencias().length > 0) {
                  <span
                    class="ml-1.5 text-xs font-normal px-1.5 py-0.5 rounded-full"
                    style="background: var(--state-warning-bg); color: var(--state-warning); border: 1px solid var(--state-warning-border)"
                    >{{ facade.inasistencias().length }}</span
                  >
                }
              </span>
            </div>
            <button
              class="inas-btn-add"
              (click)="drawerOpen.set(true)"
              data-llm-action="registrar-inasistencia"
              aria-label="Registrar nueva inasistencia"
            >
              <app-icon name="plus" [size]="12" />
              Registrar
            </button>
          </div>

          <!-- Lista de evidencias -->
          @if (facade.inasistencias().length > 0) {
            <div class="flex flex-col gap-1.5" role="list" aria-label="Listado de inasistencias">
              @for (item of facade.inasistencias(); track item.id) {
                <div class="inas-row" role="listitem">
                  <!-- Fecha -->
                  <div class="inas-date-pill">
                    <span class="inas-date-text">{{ item.fecha }}</span>
                  </div>

                  <!-- Tipo + Descripción -->
                  <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span class="text-sm font-semibold" style="color: var(--text-primary)">
                      {{ item.documentType }}
                    </span>
                    @if (item.description) {
                      <span
                        class="text-xs truncate"
                        style="color: var(--text-muted)"
                        [title]="item.description"
                        >{{ item.description }}</span
                      >
                    }
                  </div>

                  <!-- Status badge -->
                  <span
                    class="inas-badge"
                    [class.inas-badge--pending]="item.status === 'pending'"
                    [class.inas-badge--approved]="
                      item.status === 'approved' || item.status === 'revisado'
                    "
                    [class.inas-badge--rejected]="item.status === 'rejected'"
                  >
                    {{ statusLabel(item.status) }}
                  </span>

                  <!-- Documento adjunto -->
                  @if (item.fileUrl) {
                    <a
                      [href]="item.fileUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inas-file-btn"
                      aria-label="Ver documento adjunto"
                      data-llm-action="ver-documento-inasistencia"
                    >
                      <app-icon name="file-text" [size]="15" />
                    </a>
                  } @else {
                    <span
                      class="inas-file-btn inas-file-btn--disabled"
                      aria-label="Sin documento adjunto"
                    >
                      <app-icon name="file-text" [size]="15" />
                    </span>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="text-sm text-center py-1" style="color: var(--text-muted)">
              Sin inasistencias registradas
            </p>
          }
        </div>

        <!-- ── Ficha Técnica — Clases Prácticas ── -->
        <div id="ficha-tecnica-container" class="card overflow-hidden">
          <!-- Encabezado solo visible al imprimir -->
          <div class="only-print print-header">
            <p class="print-title">FICHA TÉCNICA DE CLASES PRÁCTICAS</p>
            <p class="print-subtitle">{{ facade.alumno()?.nombre }}</p>
            <p class="print-meta">
              RUT: {{ facade.alumno()?.rut }} &nbsp;·&nbsp; Matrícula:
              {{ facade.alumno()?.matricula }}
            </p>
          </div>

          <div class="flex items-start justify-between gap-4 p-5 pb-4">
            <div class="flex flex-col gap-0.5">
              <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                Ficha Técnica - Clases Prácticas
              </h2>
              <p class="text-xs" style="color: var(--ds-brand)">
                Registro detallado de las {{ facade.progresoPractico().requeridas }} clases
                prácticas
              </p>
            </div>
            <button
              class="btn-outline flex items-center gap-2 shrink-0 no-print"
              data-llm-action="imprimir-ficha"
              aria-label="Imprimir ficha técnica"
              (click)="imprimirFicha()"
            >
              <app-icon name="printer" [size]="14" />
              Imprimir Ficha
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-ficha w-full" aria-label="Registro de clases prácticas">
              <thead>
                <tr>
                  <th scope="col">N°</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Instructor</th>
                  <th scope="col" class="text-right">Km Inicio</th>
                  <th scope="col" class="text-right">Km Fin</th>
                  <th scope="col">Observaciones</th>
                  <th scope="col" class="text-center">Firmas</th>
                </tr>
              </thead>
              <tbody>
                @for (clase of facade.clasesPracticas(); track clase.numero) {
                  <tr [class.fila-pendiente]="!clase.completada">
                    <td class="font-semibold" style="color: var(--text-primary)">
                      Clase {{ clase.numero }}
                    </td>
                    <td>
                      @if (clase.fecha) {
                        {{ clase.fecha }}
                      } @else {
                        <span class="dato-vacio">-</span>
                      }
                    </td>
                    <td>
                      @if (clase.hora) {
                        {{ clase.hora }}
                      } @else {
                        <span class="dato-vacio">-</span>
                      }
                    </td>
                    <td>
                      @if (clase.instructor) {
                        <span style="color: var(--ds-brand)">{{ clase.instructor }}</span>
                      } @else {
                        <span class="dato-vacio">-</span>
                      }
                    </td>
                    <td class="text-right">
                      @if (clase.kmInicio !== null) {
                        {{ clase.kmInicio.toLocaleString('es-CL') }}
                      } @else {
                        <span class="dato-vacio">-</span>
                      }
                    </td>
                    <td class="text-right">
                      @if (clase.kmFin !== null) {
                        {{ clase.kmFin.toLocaleString('es-CL') }}
                      } @else {
                        <span class="dato-vacio">-</span>
                      }
                    </td>
                    <td>
                      @if (clase.observaciones) {
                        <span style="color: var(--text-secondary)">{{ clase.observaciones }}</span>
                      } @else {
                        <span class="dato-vacio">Pendiente</span>
                      }
                    </td>
                    <td>
                      <div class="flex items-center justify-center gap-1.5">
                        <span
                          class="firma-dot"
                          [class.firma-alumno]="clase.alumnoFirmo"
                          [class.firma-pendiente]="!clase.alumnoFirmo"
                          [attr.aria-label]="
                            clase.alumnoFirmo ? 'Alumno firmó' : 'Firma alumno pendiente'
                          "
                        >
                          @if (clase.alumnoFirmo) {
                            <app-icon name="check" [size]="10" color="#fff" />
                          }
                        </span>
                        <span
                          class="firma-dot"
                          [class.firma-instructor]="clase.instructorFirmo"
                          [class.firma-pendiente]="!clase.instructorFirmo"
                          [attr.aria-label]="
                            clase.instructorFirmo
                              ? 'Instructor firmó'
                              : 'Firma instructor pendiente'
                          "
                        >
                          @if (clase.instructorFirmo) {
                            <app-icon name="check" [size]="10" color="#fff" />
                          }
                        </span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div
            class="flex items-center gap-4 px-5 py-3 flex-wrap"
            style="border-top: 1px solid var(--border-subtle)"
          >
            <span class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
              <span
                class="firma-dot firma-alumno"
                style="width:12px;height:12px"
                aria-hidden="true"
              ></span>
              Alumno
            </span>
            <span class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
              <span
                class="firma-dot firma-instructor"
                style="width:12px;height:12px"
                aria-hidden="true"
              ></span>
              Instructor
            </span>
            <span class="text-xs" style="color: var(--text-muted)"
              >· Las firmas se registran al finalizar cada clase</span
            >
          </div>
        </div>

        <!-- ── Historial de Pagos ── -->
        <div class="card overflow-hidden">
          <div class="flex items-start justify-between gap-4 p-5 pb-4">
            <div class="flex flex-col gap-0.5">
              <h2 class="text-base font-semibold" style="color: var(--text-primary)">
                Historial de Pagos
              </h2>
              <p class="text-xs" style="color: var(--ds-brand)">
                Registro de cuotas y pagos del alumno
              </p>
            </div>
            <div class="flex items-center gap-6 shrink-0">
              <div class="flex flex-col items-end gap-0.5">
                <span class="text-xs font-medium" style="color: var(--text-muted)"
                  >Total pagado</span
                >
                <span class="text-lg font-bold" style="color: var(--state-success)">
                  \${{ alumno.totalPagado.toLocaleString('es-CL') }}
                </span>
              </div>
              <div class="flex flex-col items-end gap-0.5">
                <span class="text-xs font-medium" style="color: var(--text-muted)"
                  >Saldo pendiente</span
                >
                <span class="text-lg font-bold" style="color: var(--state-warning)">
                  \${{ alumno.saldoPendiente.toLocaleString('es-CL') }}
                </span>
              </div>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-ficha w-full" aria-label="Historial de pagos del alumno">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Concepto</th>
                  <th scope="col" class="text-right">Monto</th>
                  <th scope="col">Método</th>
                  <th scope="col" class="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (pago of facade.historialPagos(); track pago.id) {
                  <tr>
                    <td style="color: var(--text-secondary)">{{ pago.fecha }}</td>
                    <td class="font-semibold" style="color: var(--text-primary)">
                      {{ pago.concepto }}
                    </td>
                    <td class="text-right font-medium" style="color: var(--text-primary)">
                      \${{ pago.monto.toLocaleString('es-CL') }}
                    </td>
                    <td style="color: var(--text-secondary)">
                      @if (pago.metodo) {
                        {{ pago.metodo }}
                      } @else {
                        <span class="dato-vacio">—</span>
                      }
                    </td>
                    <td class="text-right">
                      <span
                        class="text-xs font-medium px-3 py-1 rounded-full"
                        [class.badge-pagado]="pago.estado === 'Pagado'"
                        [class.badge-pendiente-pago]="pago.estado === 'Pendiente'"
                      >
                        {{ pago.estado }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-center py-6" style="color: var(--text-muted)">
                      Sin pagos registrados
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div
            class="flex items-center justify-between gap-4 px-5 py-3 flex-wrap"
            style="border-top: 1px solid var(--border-subtle)"
          >
            <span class="text-xs" style="color: var(--text-secondary)">
              {{ facade.historialPagos().length }} pago(s) registrado(s)
            </span>
            <a
              routerLink="/app/admin/pagos"
              class="breadcrumb-link text-xs font-medium"
              data-llm-nav="modulo-pagos"
            >
              Ver en módulo de pagos →
            </a>
          </div>
        </div>

        <!-- Volver al Listado -->
        <div class="pb-2">
          <a
            routerLink="/app/admin/alumnos"
            class="breadcrumb-link inline-flex items-center gap-2 text-sm font-medium"
            data-llm-nav="volver-listado"
            aria-label="Volver al listado de alumnos"
          >
            <app-icon name="arrow-left" [size]="15" />
            Volver al Listado
          </a>
        </div>
      }
      <!-- fin @else if alumno -->

      <!-- ── Drawer: Registrar Inasistencia ── -->
      <app-admin-inasistencia-drawer
        [isOpen]="drawerOpen()"
        (closed)="drawerOpen.set(false)"
        (saved)="onInasistenciaGuardada()"
      />

      <!-- ── Drawer: Editar Perfil ── -->
      <app-admin-editar-perfil-drawer
        [isOpen]="editDrawerOpen()"
        (closed)="editDrawerOpen.set(false)"
        (saved)="onPerfilActualizado()"
      />
    </div>
  `,
  styles: `
    .breadcrumb-link {
      color: var(--ds-brand);
      text-decoration: none;
      transition: opacity var(--duration-fast);
    }
    .breadcrumb-link:hover {
      opacity: 0.75;
    }

    .info-label {
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      color: var(--text-primary);
    }
    .info-field-label {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      letter-spacing: 0.06em;
      color: var(--ds-brand);
    }
    .info-field-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
    }

    .badge-activo {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--state-success);
      background: var(--state-success-bg);
      border: 1px solid var(--state-success-border);
      width: fit-content;
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
      transition: width var(--duration-slow) var(--ease-out);
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
      transition: width var(--duration-slow) var(--ease-out);
    }
    .progress-label-inline {
      font-size: 11px;
      font-weight: var(--font-semibold);
      color: #fff;
      white-space: nowrap;
    }

    .inasistencias-container {
      background: var(--state-warning-bg);
      border: 1px solid var(--state-warning-border);
    }

    /* ── Inasistencias: nuevo diseño ── */
    .inas-btn-add {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border-radius: var(--radius-full);
      border: 1px solid var(--state-warning-border);
      background: var(--bg-surface);
      color: var(--state-warning);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .inas-btn-add:hover {
      background: var(--bg-elevated);
    }

    .inas-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
    }

    .inas-date-pill {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
    }
    .inas-date-text {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .inas-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--text-muted);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
    }
    .inas-badge--pending {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
    .inas-badge--approved {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }
    .inas-badge--rejected {
      color: var(--state-error);
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
    }

    .inas-file-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-md);
      color: var(--ds-brand);
      text-decoration: none;
      transition: background var(--duration-fast);
    }
    .inas-file-btn:hover {
      background: var(--bg-elevated);
    }
    .inas-file-btn--disabled {
      color: var(--text-muted);
      opacity: 0.4;
      cursor: default;
    }

    .btn-outline {
      padding: 6px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-strong);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .btn-outline:hover {
      background: var(--bg-elevated);
    }

    .tabla-ficha {
      border-collapse: collapse;
      font-size: var(--text-sm);
    }
    .tabla-ficha th {
      padding: 10px 16px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-default);
      white-space: nowrap;
    }
    .tabla-ficha td {
      padding: 12px 16px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      white-space: nowrap;
    }
    .tabla-ficha tbody tr:last-child td {
      border-bottom: none;
    }
    .tabla-ficha tbody tr:hover td {
      background: var(--bg-elevated);
    }
    .fila-pendiente td {
      color: var(--text-muted);
    }
    .dato-vacio {
      color: var(--text-muted);
    }

    .firma-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
    }
    .firma-alumno {
      background: var(--state-success);
    }
    .firma-instructor {
      background: var(--ds-brand);
    }
    .firma-pendiente {
      background: var(--bg-subtle);
    }

    /* ── Print-only helpers ── */
    .only-print {
      display: none;
    }
    .no-print {
      /* visible por defecto */
    }

    /* ── @media print ── */
    @media print {
      /* Ocultar todo el cuerpo excepto el contenedor de la ficha */
      :host {
        visibility: hidden;
      }
      #ficha-tecnica-container,
      #ficha-tecnica-container * {
        visibility: visible;
      }
      #ficha-tecnica-container {
        position: fixed;
        inset: 0;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
      }

      /* Mostrar encabezado de impresión */
      .only-print {
        display: block !important;
      }

      /* Ocultar botón imprimir dentro del contenedor */
      .no-print {
        display: none !important;
      }

      /* Forzar colores reales en impresión */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }

    @page {
      size: auto;
      margin: 10mm;
    }

    /* ── Encabezado de impresión ── */
    .print-header {
      text-align: center;
      padding: 16px 0 12px;
      border-bottom: 2px solid #1a1a2e;
      margin-bottom: 12px;
    }
    .print-title {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #1a1a2e;
      margin: 0;
    }
    .print-subtitle {
      font-size: 12pt;
      font-weight: 600;
      color: #1a1a2e;
      margin: 4px 0 0;
    }
    .print-meta {
      font-size: 9pt;
      color: #555;
      margin: 4px 0 0;
    }

    .badge-pagado {
      color: var(--state-success);
      background: var(--state-success-bg);
      border: 1px solid var(--state-success-border);
    }
    .badge-pendiente-pago {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border: 1px solid var(--state-warning-border);
    }
  `,
})
export class AdminAlumnoDetalleComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  private readonly route = inject(ActivatedRoute);

  // ── Estado de Drawers ────────────────────────────────────────────────────────
  protected readonly drawerOpen = signal(false);
  protected readonly editDrawerOpen = signal(false);

  // ── Computed: derivados del facade ──────────────────────────────────────────
  protected readonly restantesPracticas = computed(
    () => this.facade.progresoPractico().requeridas - this.facade.progresoPractico().completadas,
  );

  protected readonly restantesTeoricas = computed(
    () => this.facade.progresoTeorico().requeridas - this.facade.progresoTeorico().completadas,
  );

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(Number(id))) {
      void this.facade.initialize(Number(id));
    }
  }

  // ── Helpers de template ─────────────────────────────────────────────────────
  protected imprimirFicha(): void {
    window.print();
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
  protected onInasistenciaGuardada(): void {
    // In SWR pattern, refresh happens automatically if we call initialize with same ID
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(Number(id))) {
      void this.facade.initialize(Number(id));
    }
  }

  protected onPerfilActualizado(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(Number(id))) {
      void this.facade.initialize(Number(id));
    }
  }
}

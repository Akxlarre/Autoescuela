import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import type {
  DmsTab,
  StudentWithDocsRow,
  DmsStudentDocRow,
  InstructorWithDocsRow,
  SchoolDocRow,
  TemplateCard,
  TemplateCategoryFilter,
} from '@core/models/ui/dms.model';

/**
 * DmsListContentComponent — Organismo Dumb para el Repositorio de Documentos.
 * Reutilizable entre Portal Admin y Portal Secretaria.
 * isAdmin controla visibilidad de botones eliminar y "Nueva plantilla".
 */
@Component({
  selector: 'app-dms-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    TooltipModule,
    SlicePipe,
    TableModule,
    TagModule,
    FormsModule,
    SectionHeroComponent,
    EmptyStateComponent,
    AlertCardComponent,
    IconComponent,
    SkeletonBlockComponent,
    CardHoverDirective,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--rows-fit" appBentoGridLayout #bentoGrid>
      <!-- ── SKELETON ─────────────────────────────────────────────────── -->
      @if (isLoading()) {
        <div class="bento-banner flex flex-col gap-6 p-6">
          <app-skeleton-block variant="rect" width="100%" height="120px" />
          <div class="flex gap-3">
            <app-skeleton-block variant="rect" width="120px" height="36px" />
            <app-skeleton-block variant="rect" width="120px" height="36px" />
            <app-skeleton-block variant="rect" width="120px" height="36px" />
            <app-skeleton-block variant="rect" width="120px" height="36px" />
          </div>
          <app-skeleton-block variant="rect" width="100%" height="300px" />
          <app-skeleton-block variant="rect" width="100%" height="200px" />
        </div>
      } @else {
        <!-- ── HERO ──────────────────────────────────────────────────────── -->
        <app-section-hero
          density="slim"
          [animateOnInit]="false"
          title="Repositorio de Documentos"
          subtitle="Documentos legales de alumnos y de la escuela, centralizados"
          contextLine="DMS"
          [actions]="heroActions()"
          (actionClick)="onHeroAction($event)"
        />

        <!-- ── TABS ──────────────────────────────────────────────────────── -->
        <div class="bento-banner px-2">
          <nav class="flex gap-4 border-b border-border-subtle" aria-label="Secciones DMS">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="px-2 py-3 text-sm font-semibold transition-all duration-150 border-b-2 relative -mb-px cursor-pointer"
                [class.text-brand]="activeTab() === tab.id"
                [class.border-brand]="activeTab() === tab.id"
                [class.text-text-secondary]="activeTab() !== tab.id"
                [class.border-transparent]="activeTab() !== tab.id"
                [class.hover:text-text-primary]="activeTab() !== tab.id"
                data-llm-nav="dms-tab"
                (click)="setActiveTab(tab.id)"
              >
                <span class="flex items-center gap-2">
                  <app-icon [name]="tab.icon" [size]="16" />
                  {{ tab.label }}
                </span>
              </button>
            }
          </nav>
        </div>

        <!-- ── PANEL CONTENIDO ────────────────────────────────────────────── -->
        @switch (activeTab()) {
          <!-- ══ TAB: DOCUMENTOS DEL ALUMNO ══════════════════════════════ -->
          @case ('students') {
            <!-- Columna Principal: Tabla de Alumnos -->
            <div
              class="bento-card p-0 overflow-hidden col-span-full lg:col-span-8 flex flex-col h-125"
              appCardHover
            >
              <div
                class="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface"
              >
                <div>
                  <h2 class="text-text-primary font-semibold m-0">Alumnos con documentos</h2>
                  <p class="text-xs text-text-secondary m-0 mt-1">
                    Contratos firmados, fotos de licencias, cédulas y más
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-primary py-2 px-3 text-xs"
                  data-llm-action="upload-student-document"
                  (click)="uploadStudentDoc.emit()"
                >
                  <app-icon name="upload" [size]="14" />
                  Subir documento
                </button>
              </div>

              <!-- Barra de búsqueda de alumnos -->
              <div
                class="px-5 py-3 border-b flex items-center gap-3 bg-surface border-border-subtle shrink-0"
              >
                <div class="relative flex-1">
                  <app-icon
                    name="search"
                    [size]="14"
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    [ngModel]="studentSearch()"
                    (ngModelChange)="studentSearch.set($event)"
                    placeholder="Buscar alumno por nombre o RUT..."
                    class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-all duration-200 bg-subtle border-border-subtle text-text-primary outline-none focus:border-brand"
                    data-llm-description="input for searching students by name or RUT"
                  />
                  @if (studentSearch()) {
                    <button
                      type="button"
                      class="absolute border-0 bg-transparent right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-text-muted hover:text-text-primary"
                      aria-label="Limpiar búsqueda"
                      (click)="studentSearch.set('')"
                    >
                      <app-icon name="x" [size]="14" />
                    </button>
                  }
                </div>
              </div>

              @if (filteredStudentsWithDocs().length === 0) {
                <div class="p-6 flex-1 flex items-center justify-center">
                  <app-empty-state
                    [message]="
                      studentSearch() ? 'No se encontraron resultados' : 'Sin documentos aún'
                    "
                    [subtitle]="
                      studentSearch()
                        ? 'Prueba con otro nombre o RUT.'
                        : 'Los alumnos con documentos subidos aparecerán aquí.'
                    "
                    [icon]="studentSearch() ? 'search-x' : 'folder'"
                  />
                </div>
              } @else {
                <div class="overflow-y-auto flex-1">
                  <p-table
                    [value]="filteredStudentsWithDocs()"
                    [paginator]="filteredStudentsWithDocs().length > 10"
                    [rows]="10"
                    styleClass="p-datatable-sm"
                  >
                    <ng-template pTemplate="header">
                      <tr>
                        <th class="text-text-secondary font-semibold text-xs tracking-wider">
                          Alumno
                        </th>
                        <th class="text-text-secondary font-semibold text-xs tracking-wider">
                          N° Mat.
                        </th>
                        @if (showSedeColumn()) {
                          <th class="text-text-secondary font-semibold text-xs tracking-wider">
                            Sede
                          </th>
                        }
                        <th
                          class="text-center text-text-secondary font-semibold text-xs tracking-wider"
                        >
                          Documentos
                        </th>
                        <th
                          class="text-right text-text-secondary font-semibold text-xs tracking-wider"
                        >
                          Acciones
                        </th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                      <tr>
                        <td>
                          <span class="font-medium text-text-primary">{{ row.name }}</span>
                          <p class="text-xs text-text-secondary m-0 mt-0.5">{{ row.rut }}</p>
                        </td>
                        <td class="text-text-secondary text-sm">{{ row.matriculaNumber }}</td>
                        @if (showSedeColumn()) {
                          <td class="text-text-secondary text-sm">{{ row.branchName ?? '—' }}</td>
                        }
                        <td class="text-center">
                          <app-badge variant="brand">
                            {{ row.docCount }} doc{{ row.docCount !== 1 ? 's' : '' }}
                          </app-badge>
                        </td>
                        <td class="text-right">
                          <button
                            type="button"
                            class="text-sm font-medium cursor-pointer bg-transparent border-0 transition-colors duration-150 text-brand hover:text-brand-hover"
                            data-llm-action="view-student-documents"
                            (click)="viewStudentDocs.emit(row.studentId)"
                          >
                            Ver →
                          </button>
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                </div>
              }
            </div>

            <!-- Columna Secundaria: Últimos documentos subidos -->
            <div
              class="bento-card p-0 overflow-hidden col-span-full lg:col-span-4 flex flex-col h-125"
              appCardHover
            >
              <div class="px-5 py-4 border-b border-border-subtle shrink-0 bg-surface">
                <h2 class="text-text-primary font-semibold m-0">Últimos subidos</h2>
              </div>
              @if (recentDocs().length === 0) {
                <div class="p-6 flex-1 flex items-center justify-center">
                  <app-empty-state message="Sin documentos recientes" icon="file-text" />
                </div>
              } @else {
                <ul class="divide-y m-0 p-0 list-none border-border-subtle overflow-y-auto flex-1">
                  @for (doc of recentDocs(); track doc.id) {
                    <li class="flex items-center justify-between px-5 py-3 gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-subtle"
                        >
                          <app-icon name="file-text" [size]="18" />
                        </div>
                        <div class="min-w-0">
                          <p
                            class="font-medium text-sm truncate m-0 text-text-primary"
                            [pTooltip]="doc.fileName"
                            tooltipPosition="top"
                          >
                            {{ doc.fileName }}
                          </p>
                          <p class="text-xs m-0 text-text-secondary">
                            {{ doc.studentName }} · {{ doc.typeLabel }} ·
                            {{ doc.documentAt | slice: 0 : 10 }}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        @if (doc.fileUrl) {
                          <button
                            type="button"
                            class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border text-text-primary border-border-subtle bg-transparent"
                            data-llm-action="view-document"
                            (click)="
                              viewDocument.emit({ url: doc.fileUrl!, fileName: doc.fileName })
                            "
                          >
                            Ver
                          </button>
                        }
                        @if (isAdmin()) {
                          <button
                            type="button"
                            class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors duration-150 text-error"
                            data-llm-action="delete-student-document"
                            (click)="deleteStudentDoc.emit({ id: doc.id, source: doc.source })"
                          >
                            Eliminar
                          </button>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          <!-- ══ TAB: DOCUMENTOS DEL INSTRUCTOR ═══════════════════════════ -->
          @case ('instructors') {
            <div
              class="bento-card p-0 overflow-hidden col-span-full flex flex-col h-125"
              appCardHover
            >
              <div
                class="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface"
              >
                <div>
                  <h2 class="text-text-primary font-semibold m-0">Instructores con documentos</h2>
                  <p class="text-xs text-text-secondary m-0 mt-1">
                    Antecedentes, hoja de vida, credencial SEMEP, licencia y más
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-primary"
                  data-llm-action="upload-instructor-document"
                  (click)="uploadInstructorDoc.emit()"
                >
                  <app-icon name="upload" [size]="14" />
                  Subir documento
                </button>
              </div>

              @if (instructorsWithDocs().length === 0) {
                <div class="p-6 flex-1 flex items-center justify-center">
                  <app-empty-state
                    message="Sin instructores"
                    subtitle="Los instructores de esta sede aparecerán aquí."
                    icon="shield-check"
                  />
                </div>
              } @else {
                <div class="overflow-y-auto flex-1">
                  <p-table
                    [value]="instructorsWithDocs()"
                    [paginator]="instructorsWithDocs().length > 10"
                    [rows]="10"
                    styleClass="p-datatable-sm"
                  >
                    <ng-template pTemplate="header">
                      <tr>
                        <th class="text-text-secondary font-semibold text-xs tracking-wider">
                          Instructor
                        </th>
                        <th class="text-text-secondary font-semibold text-xs tracking-wider">
                          N° Licencia
                        </th>
                        @if (showSedeColumn()) {
                          <th class="text-text-secondary font-semibold text-xs tracking-wider">
                            Sede
                          </th>
                        }
                        <th
                          class="text-center text-text-secondary font-semibold text-xs tracking-wider"
                        >
                          Documentos
                        </th>
                        <th
                          class="text-right text-text-secondary font-semibold text-xs tracking-wider"
                        >
                          Acciones
                        </th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-row>
                      <tr>
                        <td>
                          <span class="font-medium text-text-primary">{{ row.name }}</span>
                        </td>
                        <td class="text-text-secondary text-sm">{{ row.licenseNumber }}</td>
                        @if (showSedeColumn()) {
                          <td class="text-text-secondary text-sm">{{ row.branchName ?? '—' }}</td>
                        }
                        <td class="text-center">
                          <app-badge variant="brand">
                            {{ row.docCount }} doc{{ row.docCount !== 1 ? 's' : '' }}
                          </app-badge>
                        </td>
                        <td class="text-right">
                          <button
                            type="button"
                            class="text-sm font-medium cursor-pointer bg-transparent border-0 transition-colors duration-150 text-brand hover:text-brand-hover"
                            data-llm-action="view-instructor-documents"
                            (click)="viewInstructorDocs.emit(row.instructorId)"
                          >
                            Ver →
                          </button>
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                </div>
              }
            </div>
          }

          <!-- ══ TAB: DOCUMENTOS DE LA ESCUELA ═══════════════════════════ -->
          @case ('school') {
            <div class="bento-card p-0 overflow-hidden col-span-full flex flex-col" appCardHover>
              <div
                class="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface"
              >
                <div>
                  <h2 class="text-text-primary font-semibold m-0">Documentos institucionales</h2>
                  <p class="text-xs text-text-secondary m-0 mt-1">
                    Facturas de folios, resoluciones MTT, decretos y más
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-primary py-2 px-3 text-xs"
                  data-llm-action="upload-school-document"
                  (click)="uploadSchoolDoc.emit()"
                >
                  <app-icon name="upload" [size]="14" />
                  Subir documento
                </button>
              </div>
              @if (schoolDocs().length === 0) {
                <div class="p-6">
                  <app-empty-state
                    message="Sin documentos institucionales"
                    subtitle="Sube las facturas, resoluciones y decretos de la escuela."
                    icon="building-2"
                  />
                </div>
              } @else {
                <ul class="divide-y m-0 p-0 list-none border-border-subtle">
                  @for (doc of schoolDocs(); track doc.id) {
                    <li class="flex items-center justify-between px-5 py-4 gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          class="bg-error-subtle text-error"
                        >
                          <app-icon name="file-text" [size]="18" />
                        </div>
                        <div class="min-w-0">
                          <p
                            class="font-medium text-sm truncate m-0 text-text-primary"
                            [pTooltip]="doc.fileName"
                            tooltipPosition="top"
                          >
                            {{ doc.fileName }}
                          </p>
                          <p class="text-xs m-0 text-text-secondary">
                            {{ doc.typeLabel }}{{ doc.description ? ' · ' + doc.description : '' }}
                          </p>
                          <p class="text-xs mt-0.5 m-0 text-text-muted">
                            Subido el {{ doc.createdAt | slice: 0 : 10 }} por
                            {{ doc.uploaderName }}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border text-text-primary border-border-subtle bg-transparent"
                          data-llm-action="view-document"
                          (click)="
                            viewDocument.emit({ url: doc.storageUrl, fileName: doc.fileName })
                          "
                        >
                          Ver
                        </button>
                        @if (isAdmin()) {
                          <button
                            type="button"
                            class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border-0 bg-transparent text-error"
                            data-llm-action="delete-school-document"
                            (click)="deleteSchoolDoc.emit(doc.id)"
                          >
                            Eliminar
                          </button>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          <!-- ══ TAB: PLANTILLAS ══════════════════════════════════════════ -->
          @case ('templates') {
            <div class="col-span-full flex flex-col gap-6">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold m-0 text-text-primary">Plantillas</h2>
                  <p class="text-sm m-0 text-text-secondary mt-1">
                    Formularios y contratos estándar listos para descargar y completar
                  </p>
                </div>
                @if (isAdmin()) {
                  <button
                    type="button"
                    class="btn-primary py-2 px-3 text-xs"
                    data-llm-action="upload-template"
                    (click)="uploadTemplate.emit()"
                  >
                    <app-icon name="upload" [size]="14" />
                    Nueva plantilla
                  </button>
                }
              </div>

              <!-- Filtro de categorías -->
              <div class="flex flex-wrap gap-2">
                @for (cat of categoryFilters; track cat.id) {
                  <button
                    type="button"
                    class="px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-150 cursor-pointer border-0"
                    [class.bg-text-primary]="categoryFilter() === cat.id"
                    [class.text-surface]="categoryFilter() === cat.id"
                    [class.bg-subtle]="categoryFilter() !== cat.id"
                    [class.text-text-secondary]="categoryFilter() !== cat.id"
                    [class.hover:bg-border-subtle]="categoryFilter() !== cat.id"
                    data-llm-action="filter-templates-by-category"
                    (click)="setCategoryFilter(cat.id)"
                  >
                    {{ cat.label }}
                  </button>
                }
              </div>

              <!-- Grid de cards -->
              @if (filteredTemplates().length === 0) {
                <app-empty-state
                  message="Sin plantillas"
                  subtitle="No hay plantillas en esta categoría."
                  icon="folder"
                />
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  @for (tpl of filteredTemplates(); track tpl.id) {
                    <div
                      class="bento-card flex flex-col gap-4 p-5 min-h-0 h-auto cursor-default"
                      appCardHover
                    >
                      <!-- Header: badge formato + nombre + categoría -->
                      <div class="flex items-start gap-3">
                        <div
                          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                          [style]="tpl.formatColor"
                        >
                          {{ tpl.format.toUpperCase() }}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="item-title leading-snug m-0">
                            {{ tpl.name }}
                          </p>
                          <app-badge variant="neutral" class="mt-1">{{
                            tpl.categoryLabel
                          }}</app-badge>
                        </div>
                      </div>

                      <!-- Descripción -->
                      @if (tpl.description) {
                        <p class="text-xs leading-relaxed flex-1 m-0 text-text-secondary">
                          {{ tpl.description }}
                        </p>
                      }

                      <!-- Footer: versión + descargas + acciones -->
                      <div
                        class="flex items-center justify-between pt-3 border-t border-border-subtle"
                      >
                        <div class="text-xs text-text-muted">
                          <span>{{ tpl.version }}</span>
                          <span class="mx-1">·</span>
                          <span>{{ tpl.downloadCount }} descargas</span>
                        </div>
                        <div class="flex items-center gap-2">
                          @if (isAdmin()) {
                            <button
                              type="button"
                              class="text-xs font-medium cursor-pointer border-0 bg-transparent text-error"
                              data-llm-action="delete-template"
                              (click)="deleteTemplate.emit(tpl.id)"
                            >
                              Eliminar
                            </button>
                          }
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer border-0 bg-transparent transition-colors duration-150 text-brand"
                            data-llm-action="download-template"
                            (click)="downloadTemplate.emit(tpl)"
                          >
                            <app-icon name="download" [size]="13" />
                            Descargar
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Nota informativa -->
              <app-alert-card title="Cómo usar las plantillas" severity="warning">
                Descarga el documento, complétalo con los datos del alumno e imprímelo. Una vez
                firmado, súbelo al expediente del alumno desde la pestaña
                <strong>Documentos del Alumno</strong>.
              </app-alert-card>
            </div>
          }
        }

        <!-- Permisos DMS (Columna completa al fondo) -->
        <div class="col-span-full">
          <app-alert-card title="Permisos DMS" severity="info">
            <strong>Admin:</strong> Subir, visualizar y eliminar documentos.
            <strong>Secretaria:</strong> Solo subir y visualizar (no puede eliminar).
          </app-alert-card>
        </div>
      }
      <!-- end @else -->
    </div>
  `,
})
export class DmsListContentComponent {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  constructor() {
    // SWR-aware: el grid vive en @else, se anima cuando loading → false.
    effect(() => {
      const ready = !this.isLoading();
      const grid = this.bentoGrid()?.nativeElement;
      if (ready && grid) {
        Promise.resolve().then(() => {
          this.gsap.animateBentoGrid(grid);
        });
      }
    });
  }

  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly basePath = input.required<string>();
  readonly studentsWithDocs = input<StudentWithDocsRow[]>([]);
  readonly recentDocs = input<DmsStudentDocRow[]>([]);
  readonly instructorsWithDocs = input<InstructorWithDocsRow[]>([]);
  readonly schoolDocs = input<SchoolDocRow[]>([]);
  readonly templates = input<TemplateCard[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly isAdmin = input<boolean>(false);
  /** Admin con selector de sede en "Todas las sedes" → muestra la columna Sede en Alumnos. */
  readonly showSedeColumn = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly uploadStudentDoc = output<void>();
  readonly uploadInstructorDoc = output<void>();
  readonly uploadSchoolDoc = output<void>();
  readonly uploadTemplate = output<void>();
  readonly viewStudentDocs = output<number>();
  readonly viewInstructorDocs = output<number>();
  readonly viewDocument = output<{ url: string; fileName: string }>();
  readonly deleteStudentDoc = output<{ id: string; source: string }>();
  readonly deleteSchoolDoc = output<number>();
  readonly deleteTemplate = output<number>();
  readonly downloadTemplate = output<TemplateCard>();

  readonly activeTab = signal<DmsTab>('students');
  readonly categoryFilter = signal<TemplateCategoryFilter>('all');
  readonly studentSearch = signal('');

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId as DmsTab);
  }

  setCategoryFilter(catId: string): void {
    this.categoryFilter.set(catId as TemplateCategoryFilter);
  }

  // ── Config estática ───────────────────────────────────────────────────────
  readonly tabs = [
    { id: 'students', label: 'Documentos del Alumno', icon: 'user' },
    { id: 'instructors', label: 'Documentos de Instructores', icon: 'shield-check' },
    { id: 'school', label: 'Documentos de la Escuela', icon: 'building-2' },
    { id: 'templates', label: 'Plantillas', icon: 'folder' },
  ];

  readonly categoryFilters = [
    { id: 'all', label: 'Todas' },
    { id: 'clase_b', label: 'Clase B' },
    { id: 'clase_profesional', label: 'Clase Profesional' },
    { id: 'administrativo', label: 'Administrativo' },
    { id: 'general', label: 'General' },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly filteredTemplates = computed(() => {
    const cat = this.categoryFilter();
    if (cat === 'all') return this.templates();
    return this.templates().filter((t) => t.category === cat);
  });

  readonly filteredStudentsWithDocs = computed(() => {
    const search = this.studentSearch().toLowerCase().trim();
    if (!search) return this.studentsWithDocs();
    return this.studentsWithDocs().filter(
      (s) => s.name.toLowerCase().includes(search) || s.rut.toLowerCase().includes(search),
    );
  });

  readonly heroActions = () => {
    const tab = this.activeTab();
    if (tab === 'students') {
      return [{ id: 'upload-student', label: 'Subir documento', icon: 'upload', primary: true }];
    }
    if (tab === 'instructors') {
      return [{ id: 'upload-instructor', label: 'Subir documento', icon: 'upload', primary: true }];
    }
    if (tab === 'school') {
      return [{ id: 'upload-school', label: 'Subir documento', icon: 'upload', primary: true }];
    }
    // Templates
    if (this.isAdmin()) {
      return [{ id: 'upload-template', label: 'Nueva plantilla', icon: 'upload', primary: true }];
    }
    return [];
  };

  onHeroAction(actionId: string): void {
    if (actionId === 'upload-student') this.uploadStudentDoc.emit();
    else if (actionId === 'upload-instructor') this.uploadInstructorDoc.emit();
    else if (actionId === 'upload-school') this.uploadSchoolDoc.emit();
    else if (actionId === 'upload-template') this.uploadTemplate.emit();
  }
}

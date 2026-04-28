import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  AfterViewInit,
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
import type {
  DmsTab,
  StudentWithDocsRow,
  DmsStudentDocRow,
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
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── SKELETON ─────────────────────────────────────────────────── -->
      @if (isLoading()) {
        <div class="bento-banner flex flex-col gap-6 p-6">
          <app-skeleton-block variant="rect" width="100%" height="120px" />
          <div class="flex gap-3">
            <app-skeleton-block variant="rect" width="120px" height="36px" />
            <app-skeleton-block variant="rect" width="120px" height="36px" />
            <app-skeleton-block variant="rect" width="120px" height="36px" />
          </div>
          <app-skeleton-block variant="rect" width="100%" height="300px" />
          <app-skeleton-block variant="rect" width="100%" height="200px" />
        </div>
      } @else {
        <!-- ── HERO ──────────────────────────────────────────────────────── -->
        <div class="bento-banner" #heroRef>
          <app-section-hero
            title="Repositorio de Documentos"
            subtitle="Documentos legales de alumnos y de la escuela, centralizados"
            contextLine="DMS"
            [actions]="heroActions()"
            (actionClick)="onHeroAction($event)"
          />
        </div>

        <!-- ── TABS ──────────────────────────────────────────────────────── -->
        <div class="bento-banner px-6 pt-5 pb-0">
          <nav
            class="flex gap-1 border-b"
            style="border-color: var(--border-subtle);"
            aria-label="Secciones DMS"
          >
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 relative -mb-px cursor-pointer"
                [style]="
                  activeTab() === tab.id
                    ? 'color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-tint);'
                    : 'color: var(--text-secondary); border-color: transparent; background: transparent;'
                "
                (click)="setActiveTab(tab.id)"
              >
                <span class="flex items-center gap-2">
                  <app-icon [name]="tab.icon" [size]="15" />
                  {{ tab.label }}
                </span>
              </button>
            }
          </nav>
        </div>

        <!-- ── PANEL CONTENIDO ────────────────────────────────────────────── -->
        <div class="bento-banner p-6 flex flex-col gap-6">
          @switch (activeTab()) {

        <!-- ══ TAB: DOCUMENTOS DEL ALUMNO ══════════════════════════════ -->
        @case ('students') {
          <!-- Subtítulo + acción -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-sm" style="color: var(--text-secondary);">
              Contratos firmados, fotos de licencias, hojas de vida, cédulas y más
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 border-0"
              style="background: var(--color-primary); color: var(--color-primary-text);"
              (click)="uploadStudentDoc.emit()"
            >
              <app-icon name="upload" [size]="15" />
              Subir documento
            </button>
          </div>

          <!-- Tabla: Alumnos con documentos -->
          <div class="bento-card p-0 overflow-hidden">
            <div class="px-5 py-4 border-b" style="border-color: var(--border-subtle);">
              <h2 class="text-base font-semibold m-0" style="color: var(--text-primary);">Alumnos con documentos</h2>
            </div>

            <!-- Barra de búsqueda de alumnos -->
            <div class="px-5 py-3 border-b flex items-center gap-3" style="background: var(--bg-surface); border-color: var(--border-subtle);">
              <div class="relative flex-1 max-w-md">
                <app-icon name="search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted);" />
                <input
                  type="text"
                  [ngModel]="studentSearch()"
                  (ngModelChange)="studentSearch.set($event)"
                  placeholder="Buscar alumno por nombre o RUT..."
                  class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-all duration-200"
                  style="background: var(--bg-subtle); border-color: var(--border-subtle); color: var(--text-primary); outline: none;"
                  (focus)="$any($event.target).style.borderColor = 'var(--color-primary)'"
                  (blur)="$any($event.target).style.borderColor = 'var(--border-subtle)'"
                />
                @if (studentSearch()) {
                  <button
                    type="button"
                    class="absolute border-0 bg-transparent right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                    style="color: var(--text-muted);"
                    (click)="studentSearch.set('')"
                  >
                    <app-icon name="x" [size]="14" />
                  </button>
                }
              </div>
            </div>

            @if (filteredStudentsWithDocs().length === 0) {
              <div class="p-6">
                <app-empty-state
                  [message]="studentSearch() ? 'No se encontraron resultados' : 'Sin documentos aún'"
                  [subtitle]="studentSearch() ? 'Prueba con otro nombre o RUT.' : 'Los alumnos con documentos subidos aparecerán aquí.'"
                  [icon]="studentSearch() ? 'search-x' : 'folder'"
                />
              </div>
            } @else {
              <p-table
                [value]="filteredStudentsWithDocs()"
                [paginator]="filteredStudentsWithDocs().length > 10"
                [rows]="10"
                styleClass="p-datatable-sm"
              >
                <ng-template pTemplate="header">
                  <tr>
                    <th style="color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Alumno</th>
                    <th style="color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">RUT</th>
                    <th class="text-center" style="color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Documentos</th>
                    <th class="text-right" style="color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-row>
                  <tr>
                    <td>
                      <span class="font-medium" style="color: var(--text-primary);">{{ row.name }}</span>
                    </td>
                    <td style="color: var(--text-secondary);">{{ row.rut }}</td>
                    <td class="text-center">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style="background: var(--color-primary-tint); color: var(--color-primary);"
                      >
                        {{ row.docCount }} doc{{ row.docCount !== 1 ? 's' : '' }}
                      </span>
                    </td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="text-sm font-medium cursor-pointer bg-transparent border-0 transition-colors duration-150"
                        style="color: var(--color-primary);"
                        (click)="viewStudentDocs.emit(row.studentId)"
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            }
          </div>

          <!-- Card: Últimos documentos subidos -->
          <div class="bento-card p-0 overflow-hidden">
            <div class="px-5 py-4 border-b" style="border-color: var(--border-subtle);">
              <h2 class="text-base font-semibold m-0" style="color: var(--text-primary);">Últimos documentos subidos</h2>
            </div>
            @if (recentDocs().length === 0) {
              <div class="p-6">
                <app-empty-state
                  message="Sin documentos recientes"
                  icon="file-text"
                />
              </div>
            } @else {
              <ul class="divide-y m-0 p-0 list-none" style="border-color: var(--border-subtle);">
                @for (doc of recentDocs(); track doc.id) {
                  <li class="flex items-center justify-between px-5 py-3 gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style="background: var(--bg-subtle);"
                      >
                        <app-icon name="file-text" [size]="18" />
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium text-sm truncate m-0" style="color: var(--text-primary);">{{ doc.fileName }}</p>
                        <p class="text-xs m-0" style="color: var(--text-secondary);">
                          {{ doc.studentName }} · {{ doc.typeLabel }} · {{ doc.documentAt | slice:0:10 }}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      @if (doc.fileUrl) {
                        <button
                          type="button"
                          class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border"
                          style="color: var(--text-primary); border-color: var(--border-subtle); background: transparent;"
                          (click)="viewDocument.emit({ url: doc.fileUrl!, fileName: doc.fileName })"
                        >Ver</button>
                      }
                      @if (isAdmin()) {
                        <button
                          type="button"
                          class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors duration-150"
                          style="color: var(--state-error);"
                          (click)="deleteStudentDoc.emit({ id: doc.id, source: doc.source })"
                        >Eliminar</button>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        }

        <!-- ══ TAB: DOCUMENTOS DE LA ESCUELA ═══════════════════════════ -->
        @case ('school') {
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-sm m-0" style="color: var(--text-secondary);">
              Facturas de folios, resoluciones MTT, decretos y más
            </p>
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 border-0"
              style="background: var(--color-primary); color: var(--color-primary-text);"
              (click)="uploadSchoolDoc.emit()"
            >
              <app-icon name="upload" [size]="15" />
              Subir documento
            </button>
          </div>

          <div class="bento-card p-0 overflow-hidden">
            <div class="px-5 py-4 border-b" style="border-color: var(--border-subtle);">
              <h2 class="text-base font-semibold m-0" style="color: var(--text-primary);">Documentos institucionales</h2>
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
              <ul class="divide-y m-0 p-0 list-none" style="border-color: var(--border-subtle);">
                @for (doc of schoolDocs(); track doc.id) {
                  <li class="flex items-center justify-between px-5 py-4 gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style="background: var(--state-error-bg, #FEF2F2); color: var(--state-error, #DC2626);"
                      >
                        <app-icon name="file-text" [size]="18" />
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium text-sm truncate m-0" style="color: var(--text-primary);">{{ doc.fileName }}</p>
                        <p class="text-xs m-0" style="color: var(--text-secondary);">
                          {{ doc.typeLabel }}{{ doc.description ? ' · ' + doc.description : '' }}
                        </p>
                        <p class="text-xs mt-0.5 m-0" style="color: var(--text-muted);">
                          Subido el {{ doc.createdAt | slice:0:10 }} por {{ doc.uploaderName }}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border"
                        style="color: var(--text-primary); border-color: var(--border-subtle); background: transparent;"
                        (click)="viewDocument.emit({ url: doc.storageUrl, fileName: doc.fileName })"
                      >Ver</button>
                      @if (isAdmin()) {
                        <button
                          type="button"
                          class="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border-0 bg-transparent"
                          style="color: var(--state-error);"
                          (click)="deleteSchoolDoc.emit(doc.id)"
                        >Eliminar</button>
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
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-sm m-0" style="color: var(--text-secondary);">
              Formularios y contratos estándar listos para descargar y completar
            </p>
            @if (isAdmin()) {
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 border-0"
                style="background: var(--color-primary); color: var(--color-primary-text);"
                (click)="uploadTemplate.emit()"
              >
                <app-icon name="upload" [size]="15" />
                Nueva plantilla
              </button>
            }
          </div>

          <!-- Filtro de categorías -->
          <div class="flex flex-wrap gap-2">
            @for (cat of categoryFilters; track cat.id) {
              <button
                type="button"
                class="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer border-0"
                [style]="categoryFilter() === cat.id
                  ? 'background: var(--text-primary); color: var(--bg-surface);'
                  : 'background: var(--bg-subtle); color: var(--text-secondary);'"
                (click)="setCategoryFilter(cat.id)"
              >{{ cat.label }}</button>
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
                      <p class="font-semibold text-sm leading-snug m-0" style="color: var(--text-primary);">{{ tpl.name }}</p>
                      <span
                        class="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                        style="background: var(--bg-subtle); color: var(--text-secondary);"
                      >{{ tpl.categoryLabel }}</span>
                    </div>
                  </div>

                  <!-- Descripción -->
                  @if (tpl.description) {
                    <p class="text-xs leading-relaxed flex-1 m-0" style="color: var(--text-secondary);">{{ tpl.description }}</p>
                  }

                  <!-- Footer: versión + descargas + acciones -->
                  <div class="flex items-center justify-between pt-3 border-t" style="border-color: var(--border-subtle);">
                    <div class="text-xs" style="color: var(--text-muted);">
                      <span>{{ tpl.version }}</span>
                      <span class="mx-1">·</span>
                      <span>{{ tpl.downloadCount }} descargas</span>
                    </div>
                    <div class="flex items-center gap-2">
                      @if (isAdmin()) {
                        <button
                          type="button"
                          class="text-xs font-medium cursor-pointer border-0 bg-transparent"
                          style="color: var(--state-error);"
                          (click)="deleteTemplate.emit(tpl.id)"
                        >Eliminar</button>
                      }
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer border-0 bg-transparent transition-colors duration-150"
                        style="color: var(--color-primary);"
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
            Descarga el documento, complétalo con los datos del alumno e imprímelo.
            Una vez firmado, súbelo al expediente del alumno desde la pestaña
            <strong>Documentos del Alumno</strong>.
          </app-alert-card>
        }
      }

      <!-- Permisos DMS -->
      <app-alert-card title="Permisos DMS" severity="info">
        <strong>Admin:</strong> Subir, visualizar y eliminar documentos.
        <strong>Secretaria:</strong> Solo subir y visualizar (no puede eliminar).
      </app-alert-card>

    </div>
    } <!-- end @else -->
    </div>
  `,
})
export class DmsListContentComponent implements AfterViewInit {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  private readonly heroRef = viewChild<ElementRef>('heroRef');

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();
    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
  
  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly basePath = input.required<string>();
  readonly studentsWithDocs = input<StudentWithDocsRow[]>([]);
  readonly recentDocs = input<DmsStudentDocRow[]>([]);
  readonly schoolDocs = input<SchoolDocRow[]>([]);
  readonly templates = input<TemplateCard[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly isAdmin = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly uploadStudentDoc = output<void>();
  readonly uploadSchoolDoc = output<void>();
  readonly uploadTemplate = output<void>();
  readonly viewStudentDocs = output<number>();
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
    { id: 'school',   label: 'Documentos de la Escuela', icon: 'building-2' },
    { id: 'templates', label: 'Plantillas', icon: 'folder' },
  ];

  readonly categoryFilters = [
    { id: 'all',              label: 'Todas' },
    { id: 'clase_b',          label: 'Clase B' },
    { id: 'clase_profesional', label: 'Clase Profesional' },
    { id: 'administrativo',   label: 'Administrativo' },
    { id: 'general',          label: 'General' },
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
    else if (actionId === 'upload-school') this.uploadSchoolDoc.emit();
    else if (actionId === 'upload-template') this.uploadTemplate.emit();
  }
}

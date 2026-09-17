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
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { HelpHintComponent } from '@shared/components/help-hint/help-hint.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { TabsComponent, type TabOption } from '@shared/components/tabs/tabs.component';
import { DocumentClauseFieldComponent } from '@shared/components/document-clause-field/document-clause-field.component';
import type {
  DmsTab,
  StudentWithDocsRow,
  DmsStudentDocRow,
  InstructorWithDocsRow,
  SchoolDocRow,
} from '@core/models/ui/dms.model';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentTemplateForm,
  type DocumentType,
} from '@core/models/ui/document-content-template.model';
import type { BranchOption } from '@core/models/ui/branch.model';

interface DocumentTypeOption {
  label: string;
  value: DocumentType;
}

const ALL_DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { label: DOCUMENT_TYPE_LABELS.contract_b, value: 'contract_b' },
  { label: DOCUMENT_TYPE_LABELS.certificate_b, value: 'certificate_b' },
  { label: DOCUMENT_TYPE_LABELS.contract_professional, value: 'contract_professional' },
  { label: DOCUMENT_TYPE_LABELS.certificate_professional, value: 'certificate_professional' },
];

/**
 * DmsListContentComponent — Dumb para el Repositorio de Documentos.
 * Reutilizable entre Portal Admin y Portal Secretaria.
 * isAdmin controla visibilidad de botones eliminar y del editor de plantillas (spec 0016-m).
 * El editor de plantillas (tab "templates") no inyecta ningún Facade acá — recibe su estado
 * (`templateForm`, etc.) por input() y emite eventos que el Smart Component resuelve contra
 * `DocumentContentTemplatesFacade`, igual que el resto de las tabs resuelven contra `DmsFacade`.
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
    SelectModule,
    FormsModule,
    SectionHeroComponent,
    EmptyStateComponent,
    HelpHintComponent,
    IconComponent,
    SkeletonBlockComponent,
    CardHoverDirective,
    BentoGridLayoutDirective,
    TabsComponent,
    DocumentClauseFieldComponent,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen-kpi bento-grid--rows-fit"
      appBentoGridLayout
      #bentoGrid
    >
      <!-- ── HERO ──────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Repositorio de Documentos"
        subtitle="Documentos legales de alumnos y de la escuela, centralizados"
        contextLine="DMS"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── TABS (siempre presentes, config estática, no depende de isLoading) ── -->
      <app-tabs
        class="bento-banner"
        [tabs]="tabs()"
        [activeId]="activeTab()"
        variant="segmented"
        [wrap]="true"
        (activeIdChange)="setActiveTab($event)"
      />

      <!-- ── PANEL CONTENIDO (celda única .bento-fill, sin importar la tab activa) ── -->
      <div class="dms-panel-container bento-banner bento-fill flex flex-col h-full min-h-0 gap-4">
        @if (isLoading()) {
          <div class="flex flex-col gap-4 p-2">
            <app-skeleton-block variant="rect" width="100%" height="300px" />
            <app-skeleton-block variant="rect" width="100%" height="200px" />
          </div>
        } @else {
          <div class="flex-1 min-h-0 flex flex-col">
            @switch (activeTab()) {
              <!-- ══ TAB: DOCUMENTOS DEL ALUMNO ══════════════════════════════ -->
              @case ('students') {
                <div class="dms-students-split flex gap-4 h-full min-h-0">
                  <!-- Columna Principal: Tabla de Alumnos -->
                  <div
                    class="dms-col-main bento-card p-0 overflow-hidden flex flex-col h-full min-h-0"
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
                      <div class="flex-1 min-h-0">
                        <p-table
                          [value]="filteredStudentsWithDocs()"
                          [paginator]="filteredStudentsWithDocs().length > 10"
                          [rows]="10"
                          [scrollable]="true"
                          scrollHeight="flex"
                          styleClass="p-datatable-sm h-full flex flex-col"
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
                                <th
                                  class="text-text-secondary font-semibold text-xs tracking-wider"
                                >
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
                                <td class="text-text-secondary text-sm">
                                  {{ row.branchName ?? '—' }}
                                </td>
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
                                  (click)="
                                    viewStudentDocs.emit({
                                      studentId: row.studentId,
                                      enrollmentId: row.enrollmentId,
                                    })
                                  "
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
                    class="dms-col-side bento-card p-0 overflow-hidden flex flex-col h-full min-h-0"
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
                      <ul
                        class="divide-y divide-border-subtle m-0 p-0 list-none overflow-y-auto flex-1 min-h-0"
                      >
                        @for (doc of recentDocs(); track doc.id) {
                          <li
                            class="list-item-hover transition-colors flex items-center justify-between px-5 py-3 gap-3"
                          >
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
                                  (click)="
                                    deleteStudentDoc.emit({ id: doc.id, source: doc.source })
                                  "
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
                </div>
              }

              <!-- ══ TAB: DOCUMENTOS DEL INSTRUCTOR ═══════════════════════════ -->
              @case ('instructors') {
                <div
                  class="bento-card p-0 overflow-hidden flex flex-col h-full min-h-0"
                  appCardHover
                >
                  <div
                    class="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface"
                  >
                    <div>
                      <h2 class="text-text-primary font-semibold m-0">
                        Instructores con documentos
                      </h2>
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
                    <div class="flex-1 min-h-0">
                      <p-table
                        [value]="instructorsWithDocs()"
                        [paginator]="instructorsWithDocs().length > 10"
                        [rows]="10"
                        [scrollable]="true"
                        scrollHeight="flex"
                        styleClass="p-datatable-sm h-full flex flex-col"
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
                              <td class="text-text-secondary text-sm">
                                {{ row.branchName ?? '—' }}
                              </td>
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
                <div
                  class="bento-card p-0 overflow-hidden flex flex-col h-full min-h-0"
                  appCardHover
                >
                  <div
                    class="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface"
                  >
                    <div>
                      <h2 class="text-text-primary font-semibold m-0">
                        Documentos institucionales
                      </h2>
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
                    <div class="p-6 flex-1 flex items-center justify-center">
                      <app-empty-state
                        message="Sin documentos institucionales"
                        subtitle="Sube las facturas, resoluciones y decretos de la escuela."
                        icon="building-2"
                      />
                    </div>
                  } @else {
                    <ul
                      class="divide-y divide-border-subtle m-0 p-0 list-none overflow-y-auto flex-1 min-h-0"
                    >
                      @for (doc of schoolDocs(); track doc.id) {
                        <li
                          class="list-item-hover transition-colors flex items-center justify-between px-5 py-4 gap-3"
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <div
                              class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-error-subtle text-error"
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
                                {{ doc.typeLabel
                                }}{{ doc.description ? ' · ' + doc.description : '' }}
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

              <!-- ══ TAB: PLANTILLAS (editor de contenido, spec 0016-m) ══════════ -->
              @case ('templates') {
                <div
                  class="bento-card p-0 overflow-hidden flex flex-col h-full min-h-0"
                  appCardHover
                >
                  <div
                    class="px-5 py-4 border-b border-border-subtle flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-surface"
                  >
                    <div>
                      <h2 class="text-text-primary font-semibold m-0 flex items-center gap-1.5">
                        Plantillas
                        <app-help-hint
                          text="Edita el texto de los contratos y certificados que se generan automáticamente. Los cambios se publican de inmediato."
                        />
                      </h2>
                      <p class="text-xs text-text-secondary m-0 mt-1">
                        Editor de contenido de contratos y certificados por sede
                      </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <p-select
                        [options]="templateBranches()"
                        [ngModel]="selectedTemplateBranchId()"
                        (ngModelChange)="onTemplateBranchChange($event)"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Sede"
                        appendTo="body"
                        [style]="{ 'min-width': '180px', height: '36px' }"
                        data-llm-action="select-document-template-branch"
                      />
                      <p-select
                        [options]="templateDocumentTypeOptions()"
                        [ngModel]="selectedTemplateDocumentType()"
                        (ngModelChange)="onTemplateDocumentTypeChange($event)"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Tipo de documento"
                        appendTo="body"
                        [style]="{ 'min-width': '200px', height: '36px' }"
                        data-llm-action="select-document-template-type"
                      />
                    </div>
                  </div>

                  <!-- Acciones -->
                  <div
                    class="px-5 py-3 border-b border-border-subtle flex flex-wrap items-center gap-2 bg-surface shrink-0"
                  >
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      data-llm-action="view-published-document-template"
                      [disabled]="
                        templateIsGeneratingPreview() || selectedTemplateBranchId() === null
                      "
                      (click)="onTemplateViewPublished()"
                    >
                      <app-icon
                        [name]="isTemplateActionPending('view') ? 'loader-circle' : 'eye'"
                        [size]="14"
                        [class.animate-spin]="isTemplateActionPending('view')"
                      />
                      Ver documento actual
                    </button>
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      data-llm-action="preview-document-template"
                      [disabled]="templateIsGeneratingPreview() || !templateForm()"
                      (click)="onTemplatePreview()"
                    >
                      <app-icon
                        [name]="
                          isTemplateActionPending('preview') ? 'loader-circle' : 'file-search'
                        "
                        [size]="14"
                        [class.animate-spin]="isTemplateActionPending('preview')"
                      />
                      Vista previa
                    </button>
                    <button
                      type="button"
                      class="btn-primary btn-sm"
                      data-llm-action="publish-document-template"
                      [disabled]="templateIsPublishing() || !templateForm()"
                      (click)="templatePublishRequested.emit()"
                    >
                      <app-icon
                        [name]="templateIsPublishing() ? 'loader-circle' : 'upload'"
                        [size]="14"
                        [class.animate-spin]="templateIsPublishing()"
                      />
                      Publicar
                    </button>
                  </div>

                  <!-- Secciones editables (scroll interno) -->
                  <div class="flex-1 min-h-0 overflow-y-auto p-5">
                    @if (templateIsLoading()) {
                      <div class="flex flex-col gap-3">
                        <app-skeleton-block variant="rect" width="100%" height="90px" />
                        <app-skeleton-block variant="rect" width="100%" height="90px" />
                        <app-skeleton-block variant="rect" width="100%" height="90px" />
                      </div>
                    } @else if (templateForm(); as form) {
                      <div class="flex flex-col gap-4">
                        @for (section of form.sections; track section.id) {
                          <app-document-clause-field
                            [sectionId]="section.id"
                            [label]="section.label"
                            [body]="section.body"
                            [maxLength]="section.maxLength"
                            [availableTokens]="section.availableTokens"
                            (bodyChange)="
                              templateSectionChanged.emit({ sectionId: section.id, body: $event })
                            "
                          />
                        }
                      </div>
                    } @else {
                      <div class="flex-1 flex items-center justify-center">
                        <app-empty-state
                          message="Selecciona una sede"
                          subtitle="Elige una sede y un tipo de documento para empezar a editar."
                          icon="folder"
                        />
                      </div>
                    }
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Contenedor local del panel: los splits internos (tabla+lista de "students", grid de
         "templates") deben reaccionar al ancho REAL del panel, no al viewport — con un drawer
         abierto (ej. "Subir documento") <main> se angosta sin que cambie el ancho de ventana,
         y \`lg:\` de Tailwind (viewport) seguiría forzando 2 columnas donde ya no caben. */
      .dms-panel-container {
        container-type: inline-size;
        container-name: dmsPanel;
      }

      .dms-students-split {
        flex-direction: column;
      }
      .dms-col-main,
      .dms-col-side {
        flex-basis: auto;
      }
      @container dmsPanel (min-width: 900px) {
        .dms-students-split {
          flex-direction: row;
        }
        .dms-col-main {
          flex-basis: 66.6667%;
        }
        .dms-col-side {
          flex-basis: 33.3333%;
        }
      }

      .dms-templates-grid {
        grid-template-columns: 1fr;
      }
      @container dmsPanel (min-width: 640px) {
        .dms-templates-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @container dmsPanel (min-width: 960px) {
        .dms-templates-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    `,
  ],
})
export class DmsListContentComponent {
  // ── Internal ────────────────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly basePath = input.required<string>();
  readonly studentsWithDocs = input<StudentWithDocsRow[]>([]);
  readonly recentDocs = input<DmsStudentDocRow[]>([]);
  readonly instructorsWithDocs = input<InstructorWithDocsRow[]>([]);
  readonly schoolDocs = input<SchoolDocRow[]>([]);
  readonly isLoading = input<boolean>(false);
  readonly isAdmin = input<boolean>(false);
  /** Admin con selector de sede en "Todas las sedes" → muestra la columna Sede en Alumnos. */
  readonly showSedeColumn = input<boolean>(false);

  // ── Inputs — editor de plantillas (spec 0016-m) ─────────────────────────────
  readonly templateBranches = input<BranchOption[]>([]);
  readonly templateForm = input<DocumentTemplateForm | null>(null);
  readonly templateIsLoading = input<boolean>(false);
  readonly templateIsPublishing = input<boolean>(false);
  readonly templateIsGeneratingPreview = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly uploadStudentDoc = output<void>();
  readonly uploadInstructorDoc = output<void>();
  readonly uploadSchoolDoc = output<void>();
  readonly viewStudentDocs = output<{ studentId: number; enrollmentId: number }>();
  readonly viewInstructorDocs = output<number>();
  readonly viewDocument = output<{ url: string; fileName: string }>();
  readonly deleteStudentDoc = output<{ id: string; source: string }>();
  readonly deleteSchoolDoc = output<number>();

  // ── Outputs — editor de plantillas (spec 0016-m) ────────────────────────────
  readonly templateLoadRequested = output<{ branchId: number; documentType: DocumentType }>();
  readonly templateSectionChanged = output<{ sectionId: string; body: string }>();
  readonly templatePreviewRequested = output<void>();
  readonly templateViewPublishedRequested = output<{
    branchId: number;
    documentType: DocumentType;
  }>();
  readonly templatePublishRequested = output<void>();

  readonly activeTab = signal<DmsTab>('students');
  readonly studentSearch = signal('');

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId as DmsTab);
  }

  // ── Config estática ───────────────────────────────────────────────────────
  private readonly allTabs: TabOption[] = [
    { id: 'students', label: 'Documentos del Alumno', icon: 'user' },
    { id: 'instructors', label: 'Documentos de Instructores', icon: 'shield-check' },
    { id: 'school', label: 'Documentos de la Escuela', icon: 'building-2' },
    { id: 'templates', label: 'Plantillas', icon: 'folder' },
  ];

  /** "Plantillas" queda oculta para no-admin (AC4) — su RLS ahora es admin-only, no tiene
   * sentido mostrar una tab que no puede traer datos. */
  readonly tabs = computed<TabOption[]>(() =>
    this.isAdmin() ? this.allTabs : this.allTabs.filter((t) => t.id !== 'templates'),
  );

  // ── Computed ──────────────────────────────────────────────────────────────
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
    return [];
  };

  onHeroAction(actionId: string): void {
    if (actionId === 'upload-student') this.uploadStudentDoc.emit();
    else if (actionId === 'upload-instructor') this.uploadInstructorDoc.emit();
    else if (actionId === 'upload-school') this.uploadSchoolDoc.emit();
  }

  // ── Editor de plantillas (spec 0016-m) ──────────────────────────────────────

  readonly selectedTemplateBranchId = signal<number | null>(null);
  readonly selectedTemplateDocumentType = signal<DocumentType>('contract_b');

  /** Cuál de los 2 botones que comparten `templateIsGeneratingPreview()` disparó la carga en
   * curso — así solo ese botón muestra el spinner, no ambos a la vez. */
  private readonly pendingTemplateAction = signal<'view' | 'preview' | null>(null);

  isTemplateActionPending(action: 'view' | 'preview'): boolean {
    return this.templateIsGeneratingPreview() && this.pendingTemplateAction() === action;
  }

  /** Filtra Profesional si la sede seleccionada no dicta cursos profesionales (AC8). */
  readonly templateDocumentTypeOptions = computed<DocumentTypeOption[]>(() => {
    const branch = this.templateBranches().find((b) => b.id === this.selectedTemplateBranchId());
    if (branch?.hasProfessional) return ALL_DOCUMENT_TYPE_OPTIONS;
    return ALL_DOCUMENT_TYPE_OPTIONS.filter((o) => !o.value.includes('professional'));
  });

  constructor() {
    // Selecciona la primera sede disponible apenas llega la lista.
    effect(() => {
      const branches = this.templateBranches();
      if (branches.length > 0 && this.selectedTemplateBranchId() === null) {
        this.selectedTemplateBranchId.set(branches[0].id);
      }
    });

    // Pide la carga al Smart Component cada vez que cambia sede o tipo de documento.
    effect(() => {
      const branchId = this.selectedTemplateBranchId();
      const documentType = this.selectedTemplateDocumentType();
      if (branchId === null) return;
      this.templateLoadRequested.emit({ branchId, documentType });
    });

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

  onTemplateBranchChange(branchId: number): void {
    this.selectedTemplateBranchId.set(branchId);
    // Si la sede nueva no ofrece Profesional y el tipo elegido lo era, cae a contract_b (AC8).
    if (
      !this.templateDocumentTypeOptions().some(
        (o) => o.value === this.selectedTemplateDocumentType(),
      )
    ) {
      this.selectedTemplateDocumentType.set('contract_b');
    }
  }

  onTemplateDocumentTypeChange(documentType: DocumentType): void {
    this.selectedTemplateDocumentType.set(documentType);
  }

  onTemplateViewPublished(): void {
    const branchId = this.selectedTemplateBranchId();
    if (branchId === null) return;
    this.pendingTemplateAction.set('view');
    this.templateViewPublishedRequested.emit({
      branchId,
      documentType: this.selectedTemplateDocumentType(),
    });
  }

  onTemplatePreview(): void {
    this.pendingTemplateAction.set('preview');
    this.templatePreviewRequested.emit();
  }
}

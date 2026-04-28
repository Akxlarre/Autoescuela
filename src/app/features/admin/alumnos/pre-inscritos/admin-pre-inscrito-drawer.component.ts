import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { AdminPreInscritosFacade } from '@core/facades/admin-pre-inscritos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { PAYMENT_METHODS, type PaymentMethod } from '@core/models/ui/enrollment-payment.model';
import { EPQ_QUESTIONS } from '@core/utils/epq-questions.const';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type {
  EvaluarTestPayload,
  CompletarMatriculaPayload,
  PromocionOption,
} from '@core/models/ui/pre-inscrito-table.model';

type DrawerTab = 'datos' | 'test' | 'matricula';

@Component({
  selector: 'app-admin-pre-inscrito-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TagModule, TooltipModule, IconComponent, SlicePipe, SelectModule, SkeletonBlockComponent, DrawerContentLoaderComponent],
  template: `
    @if (facade.selected(); as p) {
      <!-- ── Header info ────────────────────────────────────────────── -->
      <div class="mb-6 pb-4" style="border-bottom: 1px solid var(--border-subtle)">
        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="text-sm text-secondary font-mono">{{ p.rut }}</p>
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style="background: var(--ds-brand)"
            >
              {{ p.licencia }}
            </span>
            <p-tag [value]="p.statusLabel" [severity]="p.statusSeverity" [rounded]="true" />
          </div>
        </div>
        <p class="text-xs text-secondary">{{ p.sucursal }} · {{ p.canal }}</p>
      </div>

      <!-- ── Tabs ────────────────────────────────────────────────────── -->
      <div class="flex gap-0 mb-6" style="border-bottom: 1px solid var(--border-subtle)">
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer focus-visible:outline-none"
          [class.text-secondary]="activeTab() !== 'datos'"
          [class.text-primary]="activeTab() === 'datos'"
          [style.border-bottom-color]="activeTab() === 'datos' ? 'var(--ds-brand)' : 'transparent'"
          data-llm-nav="tab-datos-personales"
          (click)="activeTab.set('datos')"
        >
          <app-icon name="user" [size]="13" class="inline mr-1" />
          Datos
        </button>

        <button
          type="button"
          class="relative px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer focus-visible:outline-none"
          [class.text-secondary]="activeTab() !== 'test'"
          [class.text-primary]="activeTab() === 'test'"
          [style.border-bottom-color]="activeTab() === 'test' ? 'var(--ds-brand)' : 'transparent'"
          data-llm-nav="tab-test-psicologico"
          (click)="activeTab.set('test')"
        >
          <app-icon name="brain" [size]="13" class="inline mr-1" />
          Test Psicológico
          @if (p.psychResult === null) {
            <span
              class="absolute top-2 right-1 w-2 h-2 rounded-full"
              style="background: var(--color-warning)"
            ></span>
          }
        </button>

        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none"
          [class.text-secondary]="
            activeTab() !== 'matricula' ||
            (p.status !== 'approved' && p.status !== 'pending_contract')
          "
          [class.text-primary]="activeTab() === 'matricula'"
          [class.opacity-40]="p.status !== 'approved' && p.status !== 'pending_contract'"
          [class.cursor-not-allowed]="p.status !== 'approved' && p.status !== 'pending_contract'"
          [class.cursor-pointer]="p.status === 'approved' || p.status === 'pending_contract'"
          [style.border-bottom-color]="
            activeTab() === 'matricula' ? 'var(--ds-brand)' : 'transparent'
          "
          [pTooltip]="
            p.status !== 'approved' && p.status !== 'pending_contract'
              ? 'Disponible cuando el test es Apto'
              : ''
          "
          tooltipPosition="bottom"
          data-llm-nav="tab-completar-matricula"
          (click)="
            (p.status === 'approved' || p.status === 'pending_contract') &&
              selectMatriculaTab(p.licencia)
          "
        >
          <app-icon name="file-check" [size]="13" class="inline mr-1" />
          Completar Matrícula
        </button>
      </div>

      <app-drawer-content-loader class="flex-col h-full flex pb-0">
        <ng-template #skeletons>
        <div class="flex flex-col gap-4">
          <app-skeleton-block variant="text" width="100%" height="80px" />
          <app-skeleton-block variant="text" width="100%" height="120px" />
          <app-skeleton-block variant="text" width="100%" height="60px" />
        </div>
        </ng-template>
        <ng-template #content>
        <div class="flex flex-col h-full w-full">
        <!-- ─── TAB: DATOS PERSONALES ──────────────────────────────────── -->
      @if (activeTab() === 'datos') {
        <div class="space-y-4" #tabContent>
          <div class="grid grid-cols-2 gap-3">
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Nombre</span>
              <p class="text-sm font-medium text-primary mt-1">{{ p.nombreCompleto }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">RUT</span>
              <p class="text-sm font-mono text-primary mt-1">{{ p.rut }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Correo</span>
              <p class="text-sm text-primary mt-1 break-all">{{ p.email }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Teléfono</span>
              <p class="text-sm text-primary mt-1">{{ p.telefono || '—' }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Sede solicitada</span>
              <p class="text-sm text-primary mt-1">{{ p.sucursal }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Clase</span>
              <p class="text-sm font-semibold text-primary mt-1">
                {{ p.licencia }}
                @if (p.convalida) {
                  <span class="text-xs text-secondary ml-1">(convalidación simultánea)</span>
                }
              </p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Fecha nacimiento</span>
              <p class="text-sm text-primary mt-1">{{ p.birthDate ?? '—' }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Género</span>
              <p class="text-sm text-primary mt-1">
                {{ p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Femenino' : '—' }}
              </p>
            </div>
            @if (p.address) {
              <div class="card col-span-2">
                <span class="text-xs text-secondary uppercase tracking-wide">Dirección</span>
                <p class="text-sm text-primary mt-1">{{ p.address }}</p>
              </div>
            }
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Pre-inscrito el</span>
              <p class="text-sm text-primary mt-1">{{ p.fechaPreInscripcion }}</p>
            </div>
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Vence</span>
              <p
                class="text-sm mt-1"
                [class.text-danger]="p.isVencido"
                [class.text-secondary]="!p.isVencido"
              >
                {{ p.fechaVencimiento }}{{ p.isVencido ? ' (vencido)' : '' }}
              </p>
            </div>
          </div>

          @if (p.notes) {
            <div class="card">
              <span class="text-xs text-secondary uppercase tracking-wide">Observaciones</span>
              <p class="text-sm text-primary mt-1">{{ p.notes }}</p>
            </div>
          }

          @if (p.isVencido) {
            <div
              class="flex items-start gap-3 rounded-lg p-3"
              style="background: color-mix(in srgb, var(--color-danger) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)"
            >
              <app-icon name="alert-triangle" [size]="15" color="var(--color-danger)" />
              <p class="text-sm text-danger">Pre-inscripción vencida. No puede completarse.</p>
            </div>
          }
        </div>
      }

      <!-- ─── TAB: TEST PSICOLÓGICO ──────────────────────────────────── -->
      @if (activeTab() === 'test') {
        <div class="space-y-4" #tabContent>
          <!-- Resultado actual -->
          @if (p.psychResult !== null && !showReEvaluate()) {
            <div
              class="flex items-center justify-between rounded-xl p-4"
              [style.background]="
                p.psychResult === 'fit'
                  ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                  : 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
              "
              [style.border]="
                p.psychResult === 'fit'
                  ? '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)'
                  : '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)'
              "
            >
              <div class="flex items-center gap-3">
                <app-icon
                  [name]="p.psychResult === 'fit' ? 'check-circle' : 'x-circle'"
                  [size]="18"
                  [color]="p.psychResult === 'fit' ? 'var(--color-success)' : 'var(--color-danger)'"
                />
                <div>
                  <p class="text-sm font-semibold text-primary">
                    {{
                      p.psychResult === 'fit' ? 'Apto psicológicamente' : 'No apto psicológicamente'
                    }}
                  </p>
                  @if (p.psychEvaluatedByName) {
                    <p class="text-xs text-secondary">
                      {{ p.psychEvaluatedByName }}
                      @if (p.psychEvaluatedAt) {
                        · {{ p.psychEvaluatedAt | slice: 0 : 10 }}
                      }
                    </p>
                  }
                </div>
              </div>
              <button
                type="button"
                class="text-xs text-secondary hover:text-primary underline cursor-pointer"
                (click)="showReEvaluate.set(true)"
              >
                Re-evaluar
              </button>
            </div>

            @if (p.psychResult === 'unfit' && p.psychRejectionReason) {
              <div class="card">
                <span class="text-xs text-secondary uppercase tracking-wide"
                  >Motivo de rechazo</span
                >
                <p class="text-sm text-primary mt-1">{{ p.psychRejectionReason }}</p>
              </div>
            }
          }

          <!-- Formulario de evaluación -->
          @if (p.psychResult === null || showReEvaluate()) {
            <div class="card card-accent space-y-4">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="clipboard-check" [size]="15" />
                {{ p.psychResult !== null ? 'Re-evaluar test' : 'Evaluar test psicológico' }}
              </h3>

              <div class="flex gap-3">
                <button
                  type="button"
                  class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer"
                  [class.text-white]="evalResult() === 'fit'"
                  [class.text-secondary]="evalResult() !== 'fit'"
                  [style.border-color]="evalResult() === 'fit' ? 'var(--color-success)' : undefined"
                  [style.background]="evalResult() === 'fit' ? 'var(--color-success)' : undefined"
                  data-llm-action="mark-psych-fit"
                  (click)="evalResult.set('fit')"
                >
                  <app-icon
                    name="check-circle"
                    [size]="15"
                    [color]="evalResult() === 'fit' ? 'white' : 'var(--color-success)'"
                  />
                  Apto
                </button>
                <button
                  type="button"
                  class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer"
                  [class.text-white]="evalResult() === 'unfit'"
                  [class.text-secondary]="evalResult() !== 'unfit'"
                  [style.border-color]="
                    evalResult() === 'unfit' ? 'var(--color-danger)' : undefined
                  "
                  [style.background]="evalResult() === 'unfit' ? 'var(--color-danger)' : undefined"
                  data-llm-action="mark-psych-unfit"
                  (click)="evalResult.set('unfit')"
                >
                  <app-icon
                    name="x-circle"
                    [size]="15"
                    [color]="evalResult() === 'unfit' ? 'white' : 'var(--color-danger)'"
                  />
                  No Apto
                </button>
              </div>

              @if (evalResult() === 'unfit') {
                <textarea
                  class="w-full rounded-lg border border-border bg-surface text-sm text-primary px-3 py-2 resize-none focus:outline-none"
                  rows="3"
                  placeholder="Describe el motivo del rechazo…"
                  data-llm-description="rejection reason for unfit psych test"
                  [value]="evalReason()"
                  (input)="evalReason.set($any($event.target).value)"
                ></textarea>
              }

              <button
                type="button"
                class="btn-primary w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="
                  !evalResult() ||
                  facade.isSaving() ||
                  (evalResult() === 'unfit' && !evalReason().trim())
                "
                data-llm-action="save-psych-evaluation"
                (click)="submitEvaluation(p.id)"
              >
                @if (facade.isSaving()) {
                  <app-icon name="loader-circle" [size]="15" color="white" class="animate-spin" />
                  Guardando…
                } @else {
                  <app-icon name="save" [size]="15" color="white" />
                  Guardar evaluación
                }
              </button>
            </div>
          }

          <!-- Respuestas EPQ -->
          @if (p.psychAnswers && p.psychAnswers.length > 0) {
            <div class="card space-y-3">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="list" [size]="15" />
                Respuestas ({{ p.psychAnswers.length }} preguntas)
              </h3>
              <div class="space-y-1.5">
                @for (q of questions; track $index) {
                  <div class="flex items-start gap-2 p-2 rounded-lg bg-surface">
                    <span class="text-xs text-secondary font-mono w-5 shrink-0 pt-0.5 text-right">
                      {{ $index + 1 }}.
                    </span>
                    <p class="text-xs text-primary flex-1 leading-relaxed">{{ q }}</p>
                    <span
                      class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                      [class.text-white]="p.psychAnswers![$index] === true"
                      [class.text-secondary]="p.psychAnswers![$index] !== true"
                      [style.background]="
                        p.psychAnswers![$index] === true
                          ? 'var(--ds-brand)'
                          : 'var(--color-surface-elevated)'
                      "
                    >
                      {{ p.psychAnswers![$index] ? 'Sí' : 'No' }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ─── TAB: COMPLETAR MATRÍCULA ───────────────────────────────── -->
      @if (activeTab() === 'matricula') {
        <div class="space-y-4" #tabContent>
          @if (p.status !== 'approved' && p.status !== 'pending_contract') {
            <div class="flex flex-col items-center justify-center py-10 gap-3">
              <app-icon name="lock" [size]="32" color="var(--color-text-muted)" />
              <p class="text-sm text-secondary text-center">
                Requiere evaluación psicológica <strong>Apto</strong>.
              </p>
            </div>
          } @else if (postEnrollment(); as enroll) {
            <!-- ─── FASE POST-CREACIÓN: Contrato ──────────────────────────── -->
            <!-- Banner matrícula creada -->
            <div
              class="flex items-center gap-3 rounded-xl p-3"
              style="background: color-mix(in srgb, var(--color-success) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent)"
            >
              <app-icon name="check-circle" [size]="16" color="var(--color-success)" />
              <div>
                <p class="text-sm font-semibold text-primary">Matrícula creada correctamente</p>
                <p class="text-xs text-secondary font-mono">N° {{ enroll.number }}</p>
              </div>
            </div>

            <!-- Card contrato -->
            <div class="card space-y-4">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="file-signature" [size]="15" />
                Contrato de matrícula
              </h3>

              <!-- Generar / Descargar PDF -->
              <div
                class="flex items-center justify-between gap-3 rounded-lg p-3"
                style="background: var(--color-surface-elevated); border: 1px solid var(--border-subtle)"
              >
                <div class="flex items-center gap-3">
                  <app-icon
                    [name]="contractPdfUrl() ? 'file-check' : 'file-text'"
                    [size]="18"
                    [color]="contractPdfUrl() ? 'var(--color-success)' : 'var(--color-text-muted)'"
                  />
                  <div>
                    <p class="text-sm font-medium text-primary">Contrato PDF</p>
                    <p class="text-xs text-secondary">
                      @if (isGeneratingContract()) {
                        Generando…
                      } @else if (contractPdfUrl()) {
                        Generado — descárgalo e imprímelo para firmar
                      } @else {
                        Genera el PDF con los datos de la matrícula
                      }
                    </p>
                  </div>
                </div>
                @if (contractPdfUrl()) {
                  <a
                    [href]="contractPdfUrl()"
                    target="_blank"
                    rel="noopener"
                    class="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                    style="background: color-mix(in srgb, var(--color-success) 12%, transparent); color: var(--color-success); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent)"
                    data-llm-action="download-contract-pdf"
                  >
                    <app-icon name="download" [size]="13" />
                    Descargar
                  </a>
                } @else {
                  <button
                    type="button"
                    class="btn-primary text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    [disabled]="isGeneratingContract()"
                    data-llm-action="generate-contract-pdf"
                    (click)="generateContract()"
                  >
                    @if (isGeneratingContract()) {
                      <app-icon
                        name="loader-circle"
                        [size]="13"
                        color="white"
                        class="animate-spin"
                      />
                      Generando…
                    } @else {
                      <app-icon name="file-text" [size]="13" color="white" />
                      Generar PDF
                    }
                  </button>
                }
              </div>

              <!-- Instrucciones (solo cuando ya hay PDF) -->
              @if (contractPdfUrl()) {
                <div
                  class="flex gap-2 rounded-lg p-3 text-xs"
                  style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 15%, transparent)"
                >
                  <app-icon
                    name="printer"
                    [size]="13"
                    color="var(--ds-brand)"
                    class="shrink-0 mt-0.5"
                  />
                  <ol class="space-y-1 text-secondary list-decimal pl-3">
                    <li>Descarga e imprime el contrato (2 copias).</li>
                    <li>El alumno firma ambas copias con nombre y RUT.</li>
                    <li>Escanea o fotografía la copia firmada.</li>
                    <li>Súbela abajo para completar el proceso.</li>
                  </ol>
                </div>

                <!-- Upload contrato firmado -->
                <div class="space-y-2">
                  <label class="text-xs font-medium text-secondary uppercase tracking-wide">
                    Subir contrato firmado
                  </label>
                  @if (!signedContractFile()) {
                    <label
                      class="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors"
                      style="border-color: var(--border-default)"
                      data-llm-description="upload area for physically signed contract scan"
                    >
                      <input
                        type="file"
                        class="hidden"
                        accept=".pdf,.jpg,.png"
                        (change)="onDocFileChange($event, 'contract')"
                        data-llm-action="upload-signed-contract"
                      />
                      <app-icon name="upload-cloud" [size]="24" color="var(--color-text-muted)" />
                      <span class="text-xs text-secondary">Seleccionar archivo</span>
                      <span class="text-xs text-secondary opacity-60">PDF, JPG o PNG</span>
                    </label>
                  } @else {
                    <div
                      class="flex items-center justify-between rounded-xl p-3"
                      style="background: color-mix(in srgb, var(--color-success) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent)"
                    >
                      <div class="flex items-center gap-2">
                        <app-icon name="file-check" [size]="16" color="var(--color-success)" />
                        <p class="text-sm text-primary truncate">
                          {{ signedContractFile()!.name }}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="text-xs text-secondary hover:text-primary cursor-pointer"
                        (click)="signedContractFile.set(null)"
                      >
                        <app-icon name="x" [size]="14" />
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Botones: Subir contrato y Cerrar -->
            <div class="flex gap-3">
              @if (signedContractFile()) {
                <button
                  type="button"
                  class="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  [disabled]="facade.isSaving()"
                  data-llm-action="upload-and-close-enrollment"
                  (click)="uploadSignedContract()"
                >
                  @if (facade.isSaving()) {
                    <app-icon name="loader-circle" [size]="15" color="white" class="animate-spin" />
                    Subiendo…
                  } @else {
                    <app-icon name="upload" [size]="15" color="white" />
                    Guardar contrato y cerrar
                  }
                </button>
              }
              <button
                type="button"
                class="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer border transition-colors"
                style="border-color: var(--border-default); color: var(--color-text-secondary)"
                data-llm-action="close-post-enrollment-drawer"
                (click)="layoutDrawer.close()"
              >
                <app-icon name="check" [size]="15" />
                Cerrar
              </button>
            </div>
          } @else {
            <!-- ─── FASE PRE-CREACIÓN: formulario ──────────────────────────── -->
            <!-- Banner aprobado -->
            <div
              class="flex items-center gap-3 rounded-xl p-3"
              style="background: color-mix(in srgb, var(--ds-brand) 8%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent)"
            >
              <app-icon name="check-circle" [size]="16" color="var(--ds-brand)" />
              <p class="text-sm text-primary">
                <strong>{{ p.nombreCompleto }}</strong> — Clase <strong>{{ p.licencia }}</strong>
              </p>
            </div>

            <!-- Promoción -->
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-secondary uppercase tracking-wide">
                Promoción <span class="text-danger">*</span>
              </label>
              @if (facade.promocionesCargando()) {
                <p class="text-sm text-secondary flex items-center gap-2">
                  <app-icon name="loader-circle" [size]="13" class="animate-spin" />
                  Cargando promociones…
                </p>
              } @else if (facade.promociones().length === 0) {
                <p class="text-sm text-secondary">
                  No hay promociones activas para clase {{ facade.selected()?.licencia }}.
                </p>
              } @else {
                <p-select
                  [ngModel]="selectedPromoId() || null"
                  (ngModelChange)="onPromoChange($event)"
                  [options]="promoSelectOptions()"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="— Seleccionar promoción —"
                  styleClass="w-full"
                  data-llm-description="select promotion for professional enrollment"
                />
              }
            </div>

            <!-- Cursos dentro de la promoción -->
            @if (selectedCourses().length > 0) {
              <div class="space-y-2">
                <label class="text-xs font-medium text-secondary uppercase tracking-wide">
                  Curso <span class="text-danger">*</span>
                </label>
                @for (course of selectedCourses(); track course.promotionCourseId) {
                  <div
                    class="flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors"
                    [style.border-color]="
                      selectedPromoCourseId() === course.promotionCourseId
                        ? 'var(--ds-brand)'
                        : undefined
                    "
                    [style.background]="
                      selectedPromoCourseId() === course.promotionCourseId
                        ? 'color-mix(in srgb, var(--ds-brand) 6%, transparent)'
                        : undefined
                    "
                    (click)="
                      selectedPromoCourseId.set(course.promotionCourseId);
                      selectedCourseId.set(course.courseId)
                    "
                  >
                    <div>
                      <p class="text-sm font-medium text-primary">{{ course.courseName }}</p>
                      <p class="text-xs text-secondary">
                        {{ course.enrolledStudents }}/{{ course.maxStudents }}
                      </p>
                    </div>
                    <span
                      class="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-elevated"
                      [class.text-success]="course.available > 5"
                      [class.text-warning]="course.available > 0 && course.available <= 5"
                      [class.text-danger]="course.available === 0"
                    >
                      {{ course.available }} cupos
                    </span>
                  </div>
                }
              </div>
            }

            <!-- Datos complementarios -->
            <div class="card space-y-3">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="user-check" [size]="15" />
                Datos complementarios
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="text-xs text-secondary uppercase tracking-wide"
                    >Licencia previa</label
                  >
                  <p-select
                    [ngModel]="formCurrentLicense() || null"
                    (ngModelChange)="formCurrentLicense.set($event ?? '')"
                    [options]="licenciaOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="— Sin licencia —"
                    styleClass="w-full"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs text-secondary uppercase tracking-wide"
                    >Fecha obtención</label
                  >
                  <input
                    type="date"
                    class="w-full border border-border rounded-lg px-3 py-2 text-sm text-primary bg-surface focus:outline-none"
                    [value]="formLicenseDate()"
                    (change)="formLicenseDate.set($any($event.target).value)"
                  />
                </div>
              </div>
            </div>

            <!-- Documentos -->
            <div class="card space-y-3">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="folder-open" [size]="15" />
                Documentos
              </h3>

              <!-- Fila de documento -->
              @for (doc of docRows; track doc.key) {
                <div
                  class="flex items-center justify-between gap-3 py-2"
                  [style.border-bottom]="'1px solid var(--border-subtle)'"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <app-icon
                      [name]="docFileSignal(doc.key)() ? 'file-check' : 'file'"
                      [size]="14"
                      [color]="
                        docFileSignal(doc.key)()
                          ? 'var(--color-success)'
                          : 'var(--color-text-muted)'
                      "
                    />
                    <div class="min-w-0">
                      <p class="text-xs font-medium text-primary truncate">
                        {{ doc.label }}
                        @if (doc.required) {
                          <span class="text-danger">*</span>
                        }
                      </p>
                      @if (docFileSignal(doc.key)(); as file) {
                        <p class="text-xs text-secondary truncate">{{ file.name }}</p>
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <!-- Fecha emisión HVC -->
                    @if (doc.key === 'hvc' && docHvcFile()) {
                      <input
                        type="date"
                        class="border border-border rounded px-2 py-1 text-xs text-primary bg-surface focus:outline-none w-32"
                        [value]="docHvcIssueDate()"
                        (change)="docHvcIssueDate.set($any($event.target).value)"
                        data-llm-description="HVC issue date"
                      />
                    }
                    <input
                      type="file"
                      [id]="'doc-' + doc.key"
                      class="hidden"
                      [accept]="doc.accept"
                      (change)="onDocFileChange($event, doc.key)"
                    />
                    <label
                      [for]="'doc-' + doc.key"
                      class="text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
                      [class.border-border]="!docFileSignal(doc.key)()"
                      [class.text-secondary]="!docFileSignal(doc.key)()"
                      [class.hover:bg-surface-elevated]="!docFileSignal(doc.key)()"
                      [class.border-success-muted]="!!docFileSignal(doc.key)()"
                      [class.text-success]="!!docFileSignal(doc.key)()"
                      [style.border-color]="
                        docFileSignal(doc.key)()
                          ? 'color-mix(in srgb, var(--color-success) 40%, transparent)'
                          : undefined
                      "
                      [style.color]="docFileSignal(doc.key)() ? 'var(--color-success)' : undefined"
                      data-llm-action="select-document-file"
                    >
                      {{ docFileSignal(doc.key)() ? 'Cambiar' : 'Seleccionar' }}
                    </label>
                  </div>
                </div>
              }

              <p class="text-xs text-secondary">
                <app-icon name="info" [size]="12" class="inline mr-1" />
                Los documentos se subirán al crear la matrícula. El contrato se genera en el
                siguiente paso.
              </p>
            </div>

            <!-- Pago -->
            <div class="card space-y-4">
              <h3 class="text-sm font-semibold text-primary flex items-center gap-2">
                <app-icon name="credit-card" [size]="15" />
                Pago
              </h3>

              <!-- Resumen financiero (tarjeta oscura) -->
              <div class="rounded-xl p-4 space-y-2" style="background: var(--color-text-primary)">
                <div class="flex justify-between text-sm" style="color: rgba(255,255,255,0.6)">
                  <span>Valor base del curso</span>
                  <span class="text-white font-medium">{{ formBasePriceStr() }}</span>
                </div>
                @if (formDiscountAmount() > 0) {
                  <div class="flex justify-between text-sm" style="color: var(--color-success)">
                    <span>{{ formDiscountReason() || 'Descuento' }}</span>
                    <span class="font-semibold">- {{ formDiscountAmountStr() }}</span>
                  </div>
                }
                <div
                  class="flex justify-between items-end pt-2"
                  style="border-top: 1px solid rgba(255,255,255,0.1)"
                >
                  <span
                    class="text-xs font-bold uppercase tracking-wide"
                    style="color: var(--ds-brand)"
                    >Total a pagar</span
                  >
                  <span class="text-2xl font-black text-white">{{ formTotalToPayStr() }}</span>
                </div>
              </div>

              <!-- Descuento -->
              @if (formDiscountAmount() > 0) {
                <div
                  class="flex items-center justify-between rounded-lg px-3 py-2"
                  style="background: color-mix(in srgb, var(--color-success) 10%, transparent); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent)"
                >
                  <div class="flex items-center gap-2">
                    <app-icon name="tag" [size]="13" color="var(--color-success)" />
                    <span class="text-xs text-primary">{{
                      formDiscountReason() || 'Descuento'
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold" style="color: var(--color-success)">
                      - {{ formDiscountAmountStr() }}
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer"
                      style="color: var(--color-danger)"
                      (click)="formDiscountAmount.set(0); formDiscountReason.set('')"
                    >
                      <app-icon name="x" [size]="13" />
                    </button>
                  </div>
                </div>
              } @else {
                <div class="space-y-2">
                  <span class="text-xs text-secondary uppercase tracking-wide">Descuento</span>
                  <div class="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      class="border border-border rounded-lg px-3 py-2 text-sm text-primary bg-surface focus:outline-none"
                      placeholder="Monto $"
                      data-llm-description="manual discount amount in CLP"
                      [value]="formDiscountInput()"
                      (input)="formDiscountInput.set(+$any($event.target).value)"
                    />
                    <input
                      type="text"
                      class="border border-border rounded-lg px-3 py-2 text-sm text-primary bg-surface focus:outline-none"
                      placeholder="Motivo del descuento"
                      data-llm-description="reason for manual discount"
                      [value]="formDiscountReason()"
                      (input)="formDiscountReason.set($any($event.target).value)"
                    />
                    <button
                      type="button"
                      class="col-span-2 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style="border-color: var(--border-default); color: var(--color-text-secondary)"
                      [disabled]="!formDiscountInput() || !formDiscountReason()"
                      data-llm-action="apply-discount"
                      (click)="applyDiscount()"
                    >
                      <app-icon name="tag" [size]="13" />
                      Aplicar descuento
                    </button>
                  </div>
                </div>
              }

              <!-- Métodos de pago (4 opciones igual que wizard) -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                @for (opt of paymentMethodOptions; track opt.value) {
                  <button
                    type="button"
                    class="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer"
                    [style.border-color]="
                      formPaymentMethod() === opt.value ? 'var(--ds-brand)' : undefined
                    "
                    [style.background]="
                      formPaymentMethod() === opt.value
                        ? 'color-mix(in srgb, var(--ds-brand) 8%, transparent)'
                        : undefined
                    "
                    data-llm-action="select-payment-method"
                    (click)="formPaymentMethod.set(opt.value)"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      [style.background]="
                        formPaymentMethod() === opt.value
                          ? 'var(--ds-brand)'
                          : 'var(--color-surface-elevated)'
                      "
                    >
                      <app-icon
                        [name]="opt.icon"
                        [size]="15"
                        [color]="
                          formPaymentMethod() === opt.value ? 'white' : 'var(--color-text-muted)'
                        "
                      />
                    </div>
                    <div class="min-w-0">
                      <p
                        class="text-xs font-semibold truncate"
                        [style.color]="
                          formPaymentMethod() === opt.value
                            ? 'var(--ds-brand)'
                            : 'var(--color-text-primary)'
                        "
                      >
                        {{ opt.label }}
                      </p>
                      <p class="text-xs truncate" style="color: var(--color-text-muted)">
                        {{ opt.description }}
                      </p>
                    </div>
                  </button>
                }
              </div>
            </div>

            <!-- Finalizar -->
            <button
              type="button"
              class="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="!canSubmitMatricula() || facade.isSaving()"
              data-llm-action="finalize-professional-enrollment"
              (click)="submitMatricula(p.id)"
            >
              @if (facade.isSaving()) {
                <app-icon name="loader-circle" [size]="15" color="white" class="animate-spin" />
                Generando matrícula…
              } @else {
                <app-icon name="check-circle" [size]="15" color="white" />
                Finalizar Matrícula
              }
            </button>
          }
        </div>
      }
        </div>
        </ng-template>
      </app-drawer-content-loader>
    }
  `,
})
export class AdminPreInscritoDrawerComponent {
  protected readonly facade = inject(AdminPreInscritosFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly tabContent = viewChild<ElementRef>('tabContent');

  readonly contentVisible = signal(false);

  constructor() {
    // Animación escalonada al cambiar de tab
    effect(() => {
      const tab = this.activeTab();
      setTimeout(() => {
        const el = this.tabContent()?.nativeElement;
        if (el) {
          this.gsap.animateBentoGrid(el);
        }
      }, 50);
    });

    // Auto-poblar precio base cuando se selecciona un curso
    effect(() => {
      const courseId = this.selectedPromoCourseId();
      if (!courseId) return;
      const course = this.selectedCourses().find((c) => c.promotionCourseId === courseId);
      if (course && course.basePrice > 0) {
        this.formBasePrice.set(course.basePrice);
      }
    });

    // Al cambiar el pre-inscrito seleccionado: limpiar estado de contrato
    // y auto-navegar al tab de matrícula si hay contrato pendiente.
    effect(() => {
      const p = this.facade.selected();
      this.contractPdfUrl.set(null);
      this.signedContractFile.set(null);
      if (p?.status === 'pending_contract') {
        this.activeTab.set('matricula');
      }
    });
  }

  // ── Tab state ────────────────────────────────────────────────────────────
  readonly activeTab = signal<DrawerTab>('datos');
  readonly showReEvaluate = signal(false);

  // ── Evaluación test ──────────────────────────────────────────────────────
  readonly evalResult = signal<'fit' | 'unfit' | null>(null);
  readonly evalReason = signal('');

  // ── Form matrícula ───────────────────────────────────────────────────────
  readonly selectedPromoId = signal<number | ''>('');

  readonly promoSelectOptions = computed(() =>
    this.facade.promociones().map((p) => ({
      label: `${p.name} (${p.code}) · ${p.startDate.slice(0, 10)}`,
      value: p.id,
    })),
  );

  readonly licenciaOptions = [
    { label: 'Clase B', value: 'B' },
    { label: 'A2', value: 'A2' },
    { label: 'A3', value: 'A3' },
    { label: 'A4', value: 'A4' },
  ];
  readonly selectedPromoCourseId = signal<number | null>(null);
  readonly selectedCourseId = signal<number | null>(null);
  readonly formCurrentLicense = signal('');
  readonly formLicenseDate = signal('');
  readonly formBasePrice = signal(0);
  readonly formPaymentMethod = signal<PaymentMethod>('efectivo');
  readonly formDiscountAmount = signal(0);
  readonly formDiscountReason = signal('');
  readonly formDiscountInput = signal(0);
  readonly paymentMethodOptions = PAYMENT_METHODS;

  // ── Documentos (pre-creación) ─────────────────────────────────────────────
  readonly docCarnetFile = signal<File | null>(null);
  readonly docHvcFile = signal<File | null>(null);
  readonly docHvcIssueDate = signal('');
  readonly docCedulaFile = signal<File | null>(null);
  readonly docLicenciaFile = signal<File | null>(null);

  // ── Estado post-creación de matrícula ─────────────────────────────────────
  /** Derivado del pre-inscrito seleccionado: disponible cuando status = 'pending_contract'. */
  readonly postEnrollment = computed<{ id: number; number: string } | null>(() => {
    const p = this.facade.selected();
    if (p?.status === 'pending_contract' && p.convertedEnrollmentId != null && p.enrollmentNumber) {
      return { id: p.convertedEnrollmentId, number: p.enrollmentNumber };
    }
    return null;
  });
  readonly contractPdfUrl = signal<string | null>(null);
  readonly isGeneratingContract = signal(false);
  readonly signedContractFile = signal<File | null>(null);

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly questions = EPQ_QUESTIONS;

  readonly selectedCourses = computed(() => {
    const promoId = this.selectedPromoId();
    if (!promoId) return [];
    return this.facade.promociones().find((p) => p.id === promoId)?.courses ?? [];
  });

  readonly formTotalToPay = computed(() =>
    Math.max(0, this.formBasePrice() - this.formDiscountAmount()),
  );

  /** Monto que efectivamente se registra como pagado en BD */
  readonly formTotalPaid = computed(() =>
    this.formPaymentMethod() === 'pendiente' ? 0 : this.formTotalToPay(),
  );

  private readonly clpFormat = (n: number) =>
    n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  readonly formBasePriceStr = computed(() => this.clpFormat(this.formBasePrice()));
  readonly formDiscountAmountStr = computed(() => this.clpFormat(this.formDiscountAmount()));
  readonly formTotalToPayStr = computed(() =>
    this.clpFormat(this.formPaymentMethod() === 'pendiente' ? 0 : this.formTotalToPay()),
  );

  readonly canSubmitMatricula = computed(
    () =>
      !!this.selectedPromoCourseId() &&
      !!this.selectedCourseId() &&
      this.formBasePrice() > 0 &&
      !!this.formPaymentMethod() &&
      !!this.docCarnetFile() &&
      !!this.docHvcFile(),
  );

  // ── Documento helpers ────────────────────────────────────────────────────

  readonly docRows: {
    key: 'carnet' | 'hvc' | 'cedula' | 'licencia';
    label: string;
    required: boolean;
    accept: string;
  }[] = [
    { key: 'carnet', label: 'Foto carnet', required: true, accept: 'image/*' },
    { key: 'hvc', label: 'Hoja de vida del conductor', required: true, accept: '.pdf,.jpg,.png' },
    { key: 'cedula', label: 'Cédula de identidad', required: false, accept: '.pdf,.jpg,.png' },
    { key: 'licencia', label: 'Licencia de conducir', required: false, accept: '.pdf,.jpg,.png' },
  ];

  docFileSignal(key: 'carnet' | 'hvc' | 'cedula' | 'licencia') {
    switch (key) {
      case 'carnet':
        return this.docCarnetFile;
      case 'hvc':
        return this.docHvcFile;
      case 'cedula':
        return this.docCedulaFile;
      case 'licencia':
        return this.docLicenciaFile;
    }
  }

  onDocFileChange(event: Event, key: string): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    switch (key) {
      case 'carnet':
        this.docCarnetFile.set(file);
        break;
      case 'hvc':
        this.docHvcFile.set(file);
        break;
      case 'cedula':
        this.docCedulaFile.set(file);
        break;
      case 'licencia':
        this.docLicenciaFile.set(file);
        break;
      case 'contract':
        this.signedContractFile.set(file);
        break;
    }
    (event.target as HTMLInputElement).value = '';
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  selectMatriculaTab(licencia: string): void {
    this.activeTab.set('matricula');
    // No cargar promociones si ya hay una matrícula pendiente de contrato
    const p = this.facade.selected();
    if (p?.status !== 'pending_contract' && this.facade.promociones().length === 0) {
      void this.facade.cargarPromocionesParaLicencia(licencia);
    }
  }

  onPromoChange(value: number): void {
    this.selectedPromoId.set(value);
    this.selectedPromoCourseId.set(null);
    this.selectedCourseId.set(null);
  }

  async submitEvaluation(preInscritoId: number): Promise<void> {
    const result = this.evalResult();
    if (!result) return;
    const ok = await this.facade.evaluarTest({
      preInscritoId,
      result,
      rejectionReason: result === 'unfit' ? this.evalReason() : undefined,
    });
    if (ok) {
      this.showReEvaluate.set(false);
      this.evalResult.set(null);
      this.evalReason.set('');
    }
  }

  applyDiscount(): void {
    const amount = this.formDiscountInput();
    if (amount <= 0) return;
    this.formDiscountAmount.set(amount);
    this.formDiscountInput.set(0);
  }

  async submitMatricula(preInscritoId: number): Promise<void> {
    if (!this.canSubmitMatricula()) return;
    const result = await this.facade.completarMatricula({
      preInscritoId,
      promotionCourseId: this.selectedPromoCourseId()!,
      courseId: this.selectedCourseId()!,
      basePrice: this.formBasePrice(),
      discountAmount: this.formDiscountAmount(),
      discountReason: this.formDiscountReason(),
      totalPaid: this.formPaymentMethod() === 'pendiente' ? 0 : this.formTotalPaid(),
      paymentMethod: this.formPaymentMethod(),
      currentLicenseClass: this.formCurrentLicense() || null,
      licenseObtainedDate: this.formLicenseDate() || null,
      carnetPhotoFile: this.docCarnetFile(),
      hvcFile: this.docHvcFile(),
      hvcIssueDate: this.docHvcIssueDate() || null,
      cedulaFile: this.docCedulaFile(),
      licenciaFile: this.docLicenciaFile(),
      contractFile: null,
    });
    // postEnrollment se actualiza automáticamente vía computed cuando
    // el facade refresca _selected con status 'pending_contract'
    void result;
  }

  async generateContract(): Promise<void> {
    const enrollment = this.postEnrollment();
    if (!enrollment) return;
    this.isGeneratingContract.set(true);
    const url = await this.facade.generateContract(enrollment.id);
    this.isGeneratingContract.set(false);
    if (url) this.contractPdfUrl.set(url);
  }

  async uploadSignedContract(): Promise<void> {
    const enrollment = this.postEnrollment();
    const file = this.signedContractFile();
    if (!enrollment || !file) return;
    const ok = await this.facade.uploadSignedContract(enrollment.id, file);
    if (ok) this.layoutDrawer.close();
  }
}

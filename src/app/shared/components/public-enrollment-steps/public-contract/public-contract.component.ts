import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { EnrollmentContractData } from '@core/models/ui/enrollment-contract.model';

@Component({
  selector: 'app-public-contract',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Contrato de matrícula
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Lee el contrato y súbelo firmado para continuar al pago.
        </p>
      </div>

      <!-- Contract generation -->
      <div
        class="rounded-xl p-5 space-y-4"
        style="background: var(--bg-surface); border: 1px solid var(--border-default);"
      >
        @if (data().contractGeneration.status === 'pending') {
          <div class="flex items-start gap-3 mb-1">
            <app-icon
              name="file-text"
              [size]="20"
              color="var(--ds-brand)"
              class="shrink-0 mt-0.5"
            />
            <div>
              <p class="text-sm font-semibold mb-2" style="color: var(--text-primary);">
                Tu contrato incluirá:
              </p>
              <ul class="space-y-1.5 text-xs" style="color: var(--text-secondary);">
                <li class="flex items-center gap-2">
                  <app-icon name="check" [size]="12" color="var(--state-success)" />
                  Datos del alumno (nombre, RUT, dirección)
                </li>
                <li class="flex items-center gap-2">
                  <app-icon name="check" [size]="12" color="var(--state-success)" />
                  Curso contratado, sede y valor total
                </li>
                <li class="flex items-center gap-2">
                  <app-icon name="check" [size]="12" color="var(--state-success)" />
                  Horario de clases prácticas agendadas
                </li>
                <li class="flex items-center gap-2">
                  <app-icon name="check" [size]="12" color="var(--state-success)" />
                  Condiciones del servicio y política de reembolso
                </li>
              </ul>
            </div>
          </div>
          <button
            type="button"
            class="btn-secondary w-full rounded-xl py-2.5 text-sm font-semibold"
            data-llm-action="generate-enrollment-contract"
            (click)="generateContract.emit()"
          >
            Generar contrato
          </button>
        } @else if (data().contractGeneration.status === 'generating') {
          <div class="flex items-center gap-3">
            <app-icon
              name="loader-circle"
              [size]="18"
              color="var(--ds-brand)"
              class="animate-spin shrink-0"
            />
            <p class="text-sm" style="color: var(--text-secondary);">Generando contrato…</p>
          </div>
        } @else if (
          data().contractGeneration.status === 'generated' && data().contractGeneration.pdfUrl
        ) {
          <div class="flex items-center gap-3">
            <app-icon name="file-check" [size]="20" color="var(--state-success)" class="shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-semibold" style="color: var(--state-success);">
                Contrato generado
              </p>
              <a
                [href]="data().contractGeneration.pdfUrl!"
                target="_blank"
                rel="noopener"
                class="text-xs font-medium"
                style="color: var(--ds-brand);"
                data-llm-nav="view-enrollment-contract-pdf"
              >
                Ver PDF →
              </a>
            </div>
          </div>
        } @else if (data().contractGeneration.status === 'error') {
          <div class="flex items-center gap-3">
            <app-icon name="circle-alert" [size]="18" color="var(--state-error)" class="shrink-0" />
            <p class="text-sm" style="color: var(--state-error);">
              Error al generar. Inténtalo de nuevo.
            </p>
          </div>
          <button
            type="button"
            class="btn-secondary w-full rounded-xl py-2.5 text-sm font-semibold"
            (click)="generateContract.emit()"
          >
            Reintentar
          </button>
        }
      </div>

      <!-- Signed contract upload -->
      @if (data().contractGeneration.status === 'generated') {
        <div class="space-y-2">
          <p class="text-xs font-semibold" style="color: var(--text-secondary);">
            Sube el contrato firmado (PDF o imagen)
          </p>
          @if (data().signedContract) {
            <div
              class="flex items-center gap-3 rounded-xl p-3"
              style="
                background: color-mix(in srgb, var(--state-success) 8%, var(--bg-surface));
                border: 1.5px solid color-mix(in srgb, var(--state-success) 30%, transparent);
              "
            >
              <app-icon
                name="file-check"
                [size]="18"
                color="var(--state-success)"
                class="shrink-0"
              />
              <span class="flex-1 text-sm" style="color: var(--state-success);">
                {{ data().signedContract!.fileName }}
              </span>
            </div>
          }
          <label
            class="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer text-sm"
            style="
              background: var(--bg-surface);
              border: 2px dashed var(--border-default);
            "
            for="pub-contract-upload"
            data-llm-description="Upload signed enrollment contract PDF or image"
          >
            <app-icon name="upload" [size]="16" color="var(--ds-brand)" />
            <span style="color: var(--text-secondary);">
              {{ data().signedContract ? 'Cambiar archivo' : 'Subir contrato firmado' }}
            </span>
            <input
              id="pub-contract-upload"
              type="file"
              accept=".pdf,image/*"
              class="sr-only"
              (change)="onFileChange($event)"
            />
          </label>
        </div>
      }

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!data().canAdvance"
          data-llm-action="confirm-enrollment-contract"
          (click)="data().canAdvance && next.emit()"
        >
          Continuar al pago
        </button>
      </div>
    </div>
  `,
})
export class PublicContractComponent {
  readonly data = input.required<EnrollmentContractData>();
  readonly loading = input<boolean>(false);
  readonly dataChange = output<EnrollmentContractData>();
  readonly generateContract = output<void>();
  readonly next = output<void>();
  readonly back = output<void>();

  protected onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.dataChange.emit({
        ...this.data(),
        signedContract: {
          status: 'uploaded',
          file,
          fileName: file.name,
          fileSize: file.size,
          errorMessage: null,
        },
        canAdvance: true,
      });
    }
  }
}

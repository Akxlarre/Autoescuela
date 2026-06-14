import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

export type PublicConfirmationType = 'class_b' | 'pre-inscription';

@Component({
  selector: 'app-public-confirmation',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center space-y-6 py-4">
      <!-- Success icon (premium gradient) -->
      <div
        class="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style="
          background: var(--gradient-primary);
          box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--ds-brand) 50%, transparent);
        "
      >
        <app-icon name="check" [size]="38" color="white" />
      </div>

      @if (type() === 'class_b') {
        <div class="space-y-2">
          <h2
            class="font-bold"
            style="font-family: var(--font-display); font-size: 1.5rem; color: var(--text-primary);"
          >
            ¡Matrícula completada!
          </h2>

          <!-- Folio number (prominent) -->
          @if (enrollmentNumber()) {
            <div
              class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style="
                background: var(--color-primary-muted);
                border: 1px solid color-mix(in srgb, var(--ds-brand) 30%, transparent);
                color: var(--color-primary);
              "
            >
              <app-icon name="hash" [size]="14" color="var(--color-primary)" />
              Folio {{ enrollmentNumber() }}
            </div>
          }

          <p class="text-sm max-w-sm mx-auto" style="color: var(--text-secondary);">
            Recibirás un correo de confirmación con los detalles de tus clases prácticas y los
            próximos pasos.
          </p>
        </div>

        <!-- Next steps card -->
        <div
          class="rounded-xl p-5 text-left max-w-md mx-auto space-y-3"
          style="background: var(--bg-surface); border: 1px solid var(--border-default);"
        >
          <h3
            class="flex items-center gap-2 text-sm font-semibold"
            style="color: var(--text-primary);"
          >
            <app-icon name="list-checks" [size]="16" color="var(--ds-brand)" />
            Próximos pasos
          </h3>
          <ol class="space-y-3">
            @for (step of classBSteps; track step.n) {
              <li class="flex items-start gap-3 text-sm" style="color: var(--text-secondary);">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-xs font-bold"
                  style="background: var(--color-primary-muted); color: var(--color-primary);"
                >
                  {{ step.n }}
                </span>
                {{ step.text }}
              </li>
            }
          </ol>
        </div>
      } @else {
        <div class="space-y-2">
          <h2
            class="font-bold"
            style="font-family: var(--font-display); font-size: 1.5rem; color: var(--text-primary);"
          >
            Pre-inscripción recibida
          </h2>
          <p class="text-sm max-w-sm mx-auto" style="color: var(--text-secondary);">
            Hemos recibido tu solicitud para Clase Profesional. Un ejecutivo se pondrá en contacto
            contigo para completar el proceso presencialmente.
          </p>
        </div>

        <!-- Professional next steps card (AC-E4) -->
        <div
          class="rounded-xl p-5 text-left max-w-md mx-auto space-y-3"
          style="background: var(--bg-surface); border: 1px solid var(--border-default);"
        >
          <h3
            class="flex items-center gap-2 text-sm font-semibold"
            style="color: var(--text-primary);"
          >
            <app-icon name="list-checks" [size]="16" color="var(--ds-brand)" />
            Próximos pasos
          </h3>
          <ol class="space-y-3">
            @for (step of professionalSteps; track step.n) {
              <li class="flex items-start gap-3 text-sm" style="color: var(--text-secondary);">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-xs font-bold"
                  style="background: var(--color-primary-muted); color: var(--color-primary);"
                >
                  {{ step.n }}
                </span>
                {{ step.text }}
              </li>
            }
          </ol>
        </div>
      }

      @if (message()) {
        <p class="text-xs" style="color: var(--text-muted);">{{ message() }}</p>
      }

      <!-- CTA Volver al inicio -->
      <div class="pt-6 flex justify-center">
        <a
          href="javascript:void(0)"
          (click)="onRestart()"
          class="btn-secondary rounded-xl px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition-transform hover:scale-105"
        >
          <app-icon name="rotate-ccw" [size]="16" color="var(--text-primary)" />
          Volver al inicio
        </a>
      </div>
    </div>
  `,
})
export class PublicConfirmationComponent {
  readonly type = input.required<PublicConfirmationType>();
  readonly enrollmentNumber = input<string | null>(null);
  readonly message = input<string | null>(null);

  onRestart(): void {
    window.location.reload();
  }

  protected readonly classBSteps = [
    { n: 1, text: 'Revisa tu correo para confirmar la matrícula y ver tu folio.' },
    { n: 2, text: 'Asiste a tu primera clase teórica según el horario indicado.' },
    { n: 3, text: 'Tus clases prácticas comienzan según la agenda seleccionada.' },
  ];

  protected readonly professionalSteps = [
    { n: 1, text: 'Te contactaremos por teléfono o WhatsApp para agendar tu visita a la sede.' },
    { n: 2, text: 'Presenta tu documentación original: licencia vigente, cédula y examen médico.' },
    { n: 3, text: 'Se completará tu matrícula y se asignará tu promoción de curso profesional.' },
  ];
}

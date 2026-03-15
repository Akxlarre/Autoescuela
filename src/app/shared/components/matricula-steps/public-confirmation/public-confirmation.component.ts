import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

export type PublicConfirmationType = 'class_b' | 'pre-inscription';

@Component({
  selector: 'app-public-confirmation',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-center space-y-6 py-4">
      <!-- Success icon -->
      <div
        class="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
        style="background: color-mix(in srgb, var(--ds-brand) 15%, transparent)"
      >
        <app-icon name="check-circle" [size]="36" color="var(--ds-brand)" />
      </div>

      @if (type() === 'class_b') {
        <div>
          <h2 class="text-xl font-bold text-primary mb-2">Matrícula enviada</h2>
          @if (enrollmentNumber()) {
            <p class="text-sm text-secondary mb-4">
              Tu número de matrícula es
              <span class="font-bold text-primary">{{ enrollmentNumber() }}</span>
            </p>
          }
          <p class="text-sm text-secondary max-w-md mx-auto">
            Hemos recibido tu solicitud de matrícula. Recibirás un correo de confirmación con los
            detalles de tus clases prácticas agendadas y los próximos pasos.
          </p>
        </div>

        <div class="card p-5 text-left max-w-md mx-auto">
          <h3 class="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <app-icon name="list-checks" [size]="16" />
            Próximos pasos
          </h3>
          <ol class="space-y-2.5 text-sm text-secondary">
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >1</span
              >
              Revisa tu correo para confirmar la matrícula.
            </li>
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >2</span
              >
              Asiste a tu primera clase teórica según el horario indicado.
            </li>
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >3</span
              >
              Tus clases prácticas comienzan según la agenda seleccionada.
            </li>
          </ol>
        </div>
      } @else {
        <div>
          <h2 class="text-xl font-bold text-primary mb-2">Pre-inscripción recibida</h2>
          <p class="text-sm text-secondary max-w-md mx-auto">
            Hemos recibido tu solicitud de pre-inscripción para Clase Profesional. Un ejecutivo se
            pondrá en contacto contigo para completar el proceso de matrícula presencialmente.
          </p>
        </div>

        <div class="card p-5 text-left max-w-md mx-auto">
          <h3 class="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <app-icon name="list-checks" [size]="16" />
            Próximos pasos
          </h3>
          <ol class="space-y-2.5 text-sm text-secondary">
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >1</span
              >
              Te contactaremos por teléfono o WhatsApp para agendar tu visita.
            </li>
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >2</span
              >
              Deberás presentar tu documentación original en la sede.
            </li>
            <li class="flex items-start gap-2">
              <span
                class="w-5 h-5 rounded-full bg-brand-muted text-xs font-bold flex items-center justify-center shrink-0"
                style="color: var(--ds-brand)"
                >3</span
              >
              Se completará tu matrícula y se asignará tu promoción de curso.
            </li>
          </ol>
        </div>
      }

      @if (message()) {
        <p class="text-xs text-muted">{{ message() }}</p>
      }
    </div>
  `,
})
export class PublicConfirmationComponent {
  type = input.required<PublicConfirmationType>();
  enrollmentNumber = input<string | null>(null);
  message = input<string | null>(null);
}

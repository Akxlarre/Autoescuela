import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { getPrivacyPolicy } from '@core/models/ui/privacy-policy.model';

/** Qué momento del flujo se está informando. Cambia el texto y el plazo declarado. */
export type PrivacyNoticeContext = 'enrollment' | 'pre-enrollment';

/**
 * PrivacyNoticeComponent — Aviso del deber de información (Ley 21.719 Art. 14 ter).
 *
 * Va **antes** de que el titular entregue sus datos, no después: el deber de información
 * existe para que decida con información, y un aviso al final no cumple esa función.
 *
 * Dumb puro: recibe el `branchSlug` y resuelve el texto de la constante. No inyecta nada.
 * Se compone sobre `app-alert-card` en vez de diseñar una superficie nueva.
 *
 * ⚠️ El texto es **contenido legal** transcrito de los anexos de consentimiento de
 * `.compliance/docs/` (uno por sociedad).
 * Si hay que cambiarlo, se cambia allá primero, se sincroniza
 * `core/models/ui/privacy-policy.model.ts` y se sube `PRIVACY_POLICY_VERSION`.
 *
 * @example
 * <app-privacy-notice [branchSlug]="branchSlug()" context="enrollment" />
 */
@Component({
  selector: 'app-privacy-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertCardComponent],
  template: `
    @if (policy(); as p) {
      <app-alert-card severity="info" title="Cómo tratamos tus datos personales">
        <p class="m-0" data-llm-description="Article 14 ter privacy notice at data capture point">
          {{ noticeText() }}
        </p>
        <p class="m-0 mt-2">
          Puedes ejercer tus derechos escribiendo a
          <a
            [href]="'mailto:' + p.rightsEmail"
            class="underline text-brand"
            data-llm-nav="canal-derechos"
            >{{ p.rightsEmail }}</a
          >.
          <a
            [href]="policyUrl()"
            target="_blank"
            rel="noopener"
            class="underline text-brand"
            data-llm-nav="politica-privacidad"
            >Ver Política de Privacidad</a
          >
        </p>
      </app-alert-card>
    }
  `,
})
export class PrivacyNoticeComponent {
  /** `branches.slug` de la sede en que el titular entrega sus datos. */
  readonly branchSlug = input.required<string>();

  /** Momento del flujo. `enrollment` por defecto (conservación 5 años). */
  readonly context = input<PrivacyNoticeContext>('enrollment');

  /**
   * Política de la sede. `null` si el slug no resuelve — en ese caso **no se renderiza
   * nada** en vez de mostrar un aviso genérico: un aviso que no identifica al responsable
   * no cumple el Art. 14 ter, y uno vacío es menos engañoso que uno incorrecto.
   */
  protected readonly policy = computed(() => getPrivacyPolicy(this.branchSlug()));

  protected readonly noticeText = computed(() => {
    const p = this.policy();
    if (!p) return '';
    return this.context() === 'pre-enrollment' ? p.preEnrollmentNotice : p.enrollmentNotice;
  });

  protected readonly policyUrl = computed(() => `/politica-privacidad/${this.branchSlug()}`);
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-promo-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div [formGroup]="promoGroup()" class="flex flex-col gap-6 animate-fade-in">
      <div class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle">
        <h3 class="text-base font-bold text-text-primary">Campaña y Banner Promocional Global</h3>
        <label
          class="flex items-center gap-2.5 cursor-pointer bg-surface py-2 px-4 rounded-xl border border-solid border-border-default shadow-sm hover:border-brand/50 transition-colors"
        >
          <input
            type="checkbox"
            formControlName="active"
            class="accent-[var(--color-primary)] w-4 h-4"
          />
          <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
            >Activar Banner Promo</span
          >
        </label>
      </div>

      @if (promoGroup().get('active')?.value) {
        <div class="p-5 rounded-xl border border-solid border-success bg-success/4">
          <div class="bento-grid bento-grid--forms">
            <div class="flex flex-col gap-1.5" data-col-span-md="6" data-col-span="8">
              <label class="field-label">Título de la Oferta / Promoción *</label>
              <input
                type="text"
                formControlName="title"
                class="field-input"
                placeholder="Ej: 15% Descuento Matriculándote en Parejas"
              />
            </div>
            <div class="flex flex-col gap-1.5" data-col-span-md="2" data-col-span="4">
              <label class="field-label">Etiqueta Oferta (Badge) *</label>
              <input
                type="text"
                formControlName="badge"
                class="field-input"
                placeholder="Ej: 🔥 Oferta Otoño"
              />
            </div>
            <div class="flex flex-col gap-1.5" data-col-span-md="8" data-col-span="12">
              <label class="field-label">Detalle / Subtexto de la Oferta *</label>
              <textarea
                formControlName="description"
                rows="3"
                class="field-input resize-none"
                placeholder="Detalla los términos o limitaciones de la oferta."
              ></textarea>
            </div>
          </div>
        </div>
      } @else {
        <div
          class="p-8 text-center border rounded-xl border-dashed animate-fade-in border-border-subtle bg-elevated"
        >
          <app-icon name="ban" [size]="32" class="text-text-muted mx-auto mb-2" />
          <h4 class="text-sm font-bold text-text-secondary">El Banner Promocional está Apagado</h4>
          <p class="text-xs text-text-muted max-w-md mx-auto mt-1">
            Ninguna promoción o cinta superior de urgencia será renderizada en la landing page.
            Enciende el interruptor arriba para crear una campaña.
          </p>
        </div>
      }
    </div>
  `,
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: border-color var(--duration-fast, 150ms) ease;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
  `,
})
export class PromoTabComponent {
  promoGroup = input.required<FormGroup>();
}

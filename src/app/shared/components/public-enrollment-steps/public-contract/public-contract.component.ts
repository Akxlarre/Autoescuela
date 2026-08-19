import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type {
  EnrollmentContractData,
  PublicContractSignedPayload,
} from '@core/models/ui/enrollment-contract.model';

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
          Lee los términos de tu matrícula y firma digitalmente para continuar.
        </p>
      </div>

      <!-- Contract Terms Scrollable Box -->
      @if (data().isMinor) {
        <div
          class="rounded-xl p-4 text-sm"
          style="background: var(--bg-surface); border: 1px solid var(--border-default);"
        >
          <div class="flex items-start gap-3 mb-2">
            <app-icon name="info" [size]="20" color="var(--ds-brand)" class="shrink-0 mt-0.5" />
            <h3 class="font-bold" style="color: var(--text-primary);">
              Autorización para Menores de Edad
            </h3>
          </div>
          <p class="mb-2" style="color: var(--text-secondary);">
            Dado que tienes 17 años, no puedes firmar este contrato de forma digital por ti mismo.
          </p>
          <p class="mb-2" style="color: var(--text-secondary);">
            Deberás acudir a la escuela junto a tu apoderado para que él/ella firme el contrato y
            entregue una autorización notarial.
          </p>
          <p style="color: var(--text-secondary);">
            Puedes continuar al pago para asegurar tu matrícula. Tu cupo quedará reservado hasta que
            entregues los documentos en sucursal.
          </p>
        </div>
      } @else {
        <div
          class="rounded-xl p-4 text-sm"
          style="
            background: var(--bg-surface);
            border: 1px solid var(--border-default);
            max-height: 240px;
            overflow-y: auto;
            color: var(--text-secondary);
          "
        >
          <h3 class="font-bold mb-2" style="color: var(--text-primary);">
            Términos y Condiciones Generales
          </h3>
          <p class="mb-2">
            <strong>1. Objeto:</strong> La Escuela se compromete a impartir al alumno/a
            <strong>{{ data().studentSummary.fullName }}</strong> el curso
            <strong>{{ data().studentSummary.courseLabel }}</strong
            >, conforme a los programas del Ministerio de Transportes y Telecomunicaciones.
          </p>
          <p class="mb-2">
            <strong>2. Asistencia:</strong> Las clases no asistidas sin aviso previo de 24 horas se
            considerarán realizadas. La escuela podrá reprogramar clases por fuerza mayor.
          </p>
          <p class="mb-2">
            <strong>3. Pagos y Devolución:</strong> El/la alumno/a se obliga a pagar el valor del
            curso. En caso de desistimiento, se reembolsará el valor proporcional a las clases no
            realizadas, descontando un 10% por gastos administrativos, solicitándolo con 7 días
            hábiles de anticipación.
          </p>
          <p>
            <strong>4. Datos y Vigencia:</strong> Tus datos se tratarán conforme a la
            <strong>Ley Nº 21.719</strong> sobre protección de datos personales, para impartir el
            curso, certificar tu egreso y cumplir las obligaciones que la normativa impone. Se
            conservan 5 años desde tu egreso o baja; el detalle está en la Política de Privacidad.
            El contrato rige desde su firma hasta la finalización del curso.
          </p>
        </div>
      }

      @if (!data().isMinor) {
        <!--
          DOS casillas separadas y ninguna premarcada (Ley 21.719 Art. 12, spec 0009-m AC3).
          Antes había una sola —"He leído y acepto los términos"— que mezclaba el contrato de
          matrícula con el tratamiento de datos personales. La ley exige que el consentimiento
          sea ESPECÍFICO: aceptar un contrato no es autorizar un tratamiento de datos.
        -->
        <div class="space-y-3">
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              class="mt-0.5"
              [checked]="termsAccepted()"
              (change)="toggleTerms($event)"
              style="accent-color: var(--ds-brand); width: 1.1rem; height: 1.1rem;"
              data-llm-action="aceptar-terminos-contrato-publico"
            />
            <span class="text-sm font-medium" style="color: var(--text-primary);">
              He leído y acepto los términos y condiciones de mi matrícula.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              class="mt-0.5"
              [checked]="privacyAccepted()"
              (change)="togglePrivacy($event)"
              style="accent-color: var(--ds-brand); width: 1.1rem; height: 1.1rem;"
              data-llm-action="aceptar-politica-privacidad-publico"
            />
            <span class="text-sm font-medium" style="color: var(--text-primary);">
              {{ data().privacyPolicyLabel }}
              <a
                [href]="data().privacyPolicyUrl"
                target="_blank"
                rel="noopener"
                class="underline"
                style="color: var(--ds-brand);"
                data-llm-nav="politica-privacidad"
                (click)="$event.stopPropagation()"
                >Ver Política de Privacidad</a
              >
            </span>
          </label>
        </div>

        <!-- Signature Canvas -->
        <div
          class="space-y-2"
          [class.opacity-50]="!consentsComplete()"
          [class.pointer-events-none]="!consentsComplete()"
        >
          <div class="flex justify-between items-center">
            <p class="text-sm font-semibold" style="color: var(--text-primary);">Dibuja tu firma</p>
            <button
              type="button"
              class="text-xs font-medium hover:underline"
              style="color: var(--ds-brand);"
              (click)="clearSignature()"
              data-llm-action="limpiar-firma-contrato-publico"
            >
              Limpiar firma
            </button>
          </div>
          <div
            class="rounded-xl overflow-hidden relative"
            style="border: 2px dashed var(--border-default); background: var(--bg-body); touch-action: none;"
          >
            <canvas
              #signatureCanvas
              width="300"
              height="150"
              class="w-full h-37.5 cursor-crosshair block"
              (pointerdown)="startDrawing($event)"
              (pointermove)="draw($event)"
              (pointerup)="stopDrawing()"
              (pointercancel)="stopDrawing()"
              (pointerout)="stopDrawing()"
            ></canvas>
          </div>
          @if (signatureError()) {
            <p class="text-xs mt-1" style="color: var(--state-error);">
              Por favor dibuja tu firma para continuar.
            </p>
          }
        </div>
      }

      <!-- Actions -->
      <div class="pt-4 flex flex-col gap-3">
        <button
          type="button"
          class="btn-primary w-full rounded-xl py-3.5"
          [disabled]="!data().isMinor && !consentsComplete()"
          (click)="handleConfirm()"
          data-llm-action="confirmar-contrato-publico"
        >
          {{ data().isMinor ? 'Continuar' : 'Firmar y Continuar' }}
        </button>
        <button
          type="button"
          class="btn-secondary w-full rounded-xl py-3"
          (click)="goBack.emit()"
          data-llm-action="volver-paso-anterior-contrato-publico"
        >
          Volver atrás
        </button>
      </div>
    </div>
  `,
})
export class PublicContractComponent {
  readonly data = input.required<EnrollmentContractData>();

  /**
   * Firma en base64 + el estado de las dos casillas (AC3/AC5).
   *
   * El consentimiento viaja CON la firma y no por un output aparte para que sea imposible
   * persistir una matrícula sin su registro de consentimiento: son el mismo evento.
   */
  readonly contractSigned = output<PublicContractSignedPayload>();
  readonly goBack = output<void>();

  readonly termsAccepted = signal(false);

  /**
   * Declaración de haber leído la Política de Privacidad (Art. 12, AC3).
   *
   * Separada de `termsAccepted` a propósito: son dos consentimientos distintos y la ley
   * exige que cada uno sea específico. No premarcada — el consentimiento requiere un
   * **acto afirmativo** del titular.
   */
  readonly privacyAccepted = signal(false);

  /** Ambas casillas son obligatorias para avanzar (AC3). */
  readonly consentsComplete = computed(() => this.termsAccepted() && this.privacyAccepted());

  readonly signatureError = signal(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('signatureCanvas');
  private isDrawing = false;
  private hasSignature = false;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    afterNextRender(() => {
      this.initCanvas();
    });
  }

  toggleTerms(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.termsAccepted.set(el.checked);
    if (!el.checked) {
      this.clearSignature();
    }
  }

  togglePrivacy(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.privacyAccepted.set(el.checked);
    if (!el.checked) {
      this.clearSignature();
    }
  }

  private initCanvas(): void {
    const el = this.canvas().nativeElement;
    // Adjust resolution
    const rect = el.getBoundingClientRect();
    el.width = rect.width * window.devicePixelRatio;
    el.height = rect.height * window.devicePixelRatio;

    this.ctx = el.getContext('2d', { willReadFrequently: true });
    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#000000';
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.hasSignature) {
      this.initCanvas();
    }
  }

  startDrawing(e: PointerEvent): void {
    if (!this.consentsComplete() || !this.ctx) return;
    this.isDrawing = true;
    this.signatureError.set(false);
    this.hasSignature = true;

    const el = this.canvas().nativeElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    // Draw dot for single tap
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  draw(e: PointerEvent): void {
    if (!this.isDrawing || !this.ctx) return;
    // Stop scrolling
    e.preventDefault();

    const el = this.canvas().nativeElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  stopDrawing(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
  }

  clearSignature(): void {
    const el = this.canvas().nativeElement;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, el.width, el.height);
    }
    this.hasSignature = false;
    this.signatureError.set(false);
  }

  handleConfirm(): void {
    if (this.data().isMinor) {
      // Rama inalcanzable en el flujo público: `canAdvanceFn` bloquea a los menores en el
      // paso 1 (`getAgeStatus() === 'requires-authorization'`), así que nadie con isMinor
      // llega a este componente. Se conserva por seguridad; su limpieza excede la spec 0009-m.
      this.contractSigned.emit({ signatureBase64: '', termsAccepted: false, privacyAccepted: false });
      return;
    }

    if (!this.consentsComplete()) return;
    if (!this.hasSignature) {
      this.signatureError.set(true);
      return;
    }

    const el = this.canvas().nativeElement;

    // Create a temporary canvas to save with white background instead of transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = el.width;
    tempCanvas.height = el.height;
    const tCtx = tempCanvas.getContext('2d');
    if (tCtx) {
      tCtx.fillStyle = '#FFFFFF';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tCtx.drawImage(el, 0, 0);
    }

    const base64 = tempCanvas.toDataURL('image/png');
    this.contractSigned.emit({
      signatureBase64: base64,
      termsAccepted: this.termsAccepted(),
      privacyAccepted: this.privacyAccepted(),
    });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
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
          Lee los términos de tu matrícula y firma digitalmente para continuar.
        </p>
      </div>

      <!-- Contract Terms Scrollable Box -->
      @if (data().isMinor) {
        <div class="rounded-xl p-4 text-sm" style="background: var(--bg-surface); border: 1px solid var(--border-default);">
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
            Deberás acudir a la escuela junto a tu apoderado para que él/ella firme el contrato y entregue una autorización notarial.
          </p>
          <p style="color: var(--text-secondary);">
            Puedes continuar al pago para asegurar tu matrícula. Tu cupo quedará reservado hasta que entregues los documentos en sucursal.
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
            <strong>{{ data().studentSummary.courseLabel }}</strong>, conforme a los
            programas del Ministerio de Transportes y Telecomunicaciones.
          </p>
          <p class="mb-2">
            <strong>2. Asistencia:</strong> Las clases no asistidas sin aviso previo de 24 horas se
            considerarán realizadas. La escuela podrá reprogramar clases por fuerza mayor.
          </p>
          <p class="mb-2">
            <strong>3. Pagos y Devolución:</strong> El/la alumno/a se obliga a pagar el valor del curso. 
            En caso de desistimiento, se reembolsará el valor proporcional a las clases no realizadas, 
            descontando un 10% por gastos administrativos, solicitándolo con 7 días hábiles de anticipación.
          </p>
          <p>
            <strong>4. Datos y Vigencia:</strong> Los datos se tratarán según Ley Nº 19.628. El
            contrato rige desde su firma hasta la finalización del curso.
          </p>
        </div>
      }

      @if (!data().isMinor) {
        <!-- Consent Checkbox -->
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            class="mt-0.5"
            [checked]="termsAccepted()"
            (change)="toggleTerms($event)"
            style="accent-color: var(--ds-brand); width: 1.1rem; height: 1.1rem;"
          />
          <span class="text-sm font-medium" style="color: var(--text-primary);">
            He leído y acepto los términos y condiciones de mi matrícula.
          </span>
        </label>

        <!-- Signature Canvas -->
        <div class="space-y-2" [class.opacity-50]="!termsAccepted()" [class.pointer-events-none]="!termsAccepted()">
          <div class="flex justify-between items-center">
            <p class="text-sm font-semibold" style="color: var(--text-primary);">
              Dibuja tu firma
            </p>
            <button
              type="button"
              class="text-xs font-medium hover:underline"
              style="color: var(--ds-brand);"
              (click)="clearSignature()"
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
              class="w-full h-[150px] cursor-crosshair block"
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
          class="btn-primary w-full rounded-xl py-3.5 text-[15px] font-semibold"
          [disabled]="!data().isMinor && !termsAccepted()"
          (click)="handleConfirm()"
        >
          {{ data().isMinor ? 'Continuar' : 'Firmar y Continuar' }}
        </button>
        <button
          type="button"
          class="btn-secondary w-full rounded-xl py-3 text-[15px] font-semibold"
          (click)="goBack.emit()"
        >
          Volver atrás
        </button>
      </div>
    </div>
  `,
})
export class PublicContractComponent {
  readonly data = input.required<EnrollmentContractData>();
  
  // Emit base64 string
  readonly contractSigned = output<string>();
  readonly goBack = output<void>();

  readonly termsAccepted = signal(false);
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
    if (!this.termsAccepted() || !this.ctx) return;
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
      // If minor, skip signature and emit a placeholder to allow advancing
      this.contractSigned.emit('');
      return;
    }

    if (!this.termsAccepted()) return;
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
    this.contractSigned.emit(base64);
  }
}


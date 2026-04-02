import { 
  Component, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy,
  HostListener,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 w-full">
      <div class="flex justify-between items-end mb-1">
        <label class="text-xs sm:text-sm font-bold text-primary uppercase tracking-widest">{{ label }}</label>
        @if (!isEmpty) {
          <button 
            type="button" 
            (click)="clear()" 
            class="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-elevated border border-border-default text-text-secondary hover:text-error hover:border-error/30 hover:bg-error/5 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
          >
            <app-icon name="eraser" [size]="14"></app-icon> Limpiar
          </button>
        }
      </div>
      
      <div 
        class="relative bg-surface focus-within:ring-4 focus-within:ring-brand/10 focus-within:border-brand/40 border-2 border-border-default rounded-2xl overflow-hidden w-full transition-all group shadow-inner"
        [style.height.px]="height"
      >
        <!-- Sign Line & Placeholder -->
        @if (isEmpty) {
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40 group-focus-within:opacity-20 transition-opacity">
            <app-icon name="pen-tool" [size]="32" class="text-muted mb-2"></app-icon>
            <span class="text-sm font-medium text-muted">Firma digitalmente aquí</span>
          </div>
        }
        
        <!-- Baseline for signing -->
        <div class="absolute bottom-[20%] left-8 right-8 border-b-2 border-dashed border-border-default/40 pointer-events-none"></div>

        <canvas
          #canvas
          class="w-full h-full cursor-crosshair touch-none relative z-10"
          (mousedown)="startDrawing($event)"
          (mousemove)="draw($event)"
          (mouseup)="stopDrawing()"
          (mouseleave)="stopDrawing()"
          (touchstart)="startDrawingTouch($event)"
          (touchmove)="drawTouch($event)"
          (touchend)="stopDrawing()"
        ></canvas>
      </div>
    </div>
  `,
  styles: [`
    /* Inversión de tinta puramente visual. Mantiene el toDataURL original en negro! */
    :host-context([data-mode="dark"]) canvas {
      filter: invert(1) hue-rotate(180deg);
    }
  `]
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  @Input() label: string = 'Firma';
  @Input() height: number = 200;
  
  @Output() signatureChange = new EventEmitter<string | null>();

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  isEmpty = true;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    
    // Set actual size in memory (scaled to account for CSS sizing and retina displays)
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
       this.resizeCanvas(rect.width, rect.height);
    }
    
    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#09090b'; // Tinta por defecto
    this.ctx.fillStyle = this.ctx.strokeStyle;
  }

  @HostListener('window:resize')
  onResize() {
    // Basic resize handling
  }

  private resizeCanvas(width: number, height: number) {
    const canvas = this.canvasRef.nativeElement;
    // Handle high DPI
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.scale(ratio, ratio);
        this.ctx = ctx;
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#09090b';
        this.ctx.fillStyle = this.ctx.strokeStyle;
    }
  }

  startDrawing(event: MouseEvent) {
    this.isDrawing = true;
    this.lastX = event.offsetX;
    this.lastY = event.offsetY;
    
    // Dibujar un punto inicial para "taps" o clics sueltos
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.ctx.lineWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(event.offsetX, event.offsetY);
    this.ctx.stroke();
    
    this.lastX = event.offsetX;
    this.lastY = event.offsetY;

    if (this.isEmpty) {
      this.isEmpty = false;
      this.cdr.markForCheck();
    }
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.emitSignature();
    }
  }

  startDrawingTouch(event: TouchEvent) {
    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.lastX = touch.clientX - rect.left;
    this.lastY = touch.clientY - rect.top;
    
    this.isDrawing = true;
    this.ctx.beginPath();
    this.ctx.arc(this.lastX, this.lastY, this.ctx.lineWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawTouch(event: TouchEvent) {
    if (!this.isDrawing) return;
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    
    this.lastX = x;
    this.lastY = y;

    if (this.isEmpty) {
      this.isEmpty = false;
      this.cdr.markForCheck();
    }
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    // Instead of using scale issues, just clear rect based on physical width
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.isEmpty = true;
    this.cdr.markForCheck();
    this.signatureChange.emit(null);
  }

  private emitSignature() {
    if (this.isEmpty) {
      this.signatureChange.emit(null);
    } else {
      const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
      this.signatureChange.emit(dataUrl);
    }
  }
}

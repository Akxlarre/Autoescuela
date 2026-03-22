import { 
  Component, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 w-full">
      <div class="flex justify-between items-end mb-1">
        <label class="text-sm font-medium text-text-primary">{{ label }}</label>
        <button type="button" (click)="clear()" class="text-xs text-brand-primary hover:underline flex items-center gap-1">
          <lucide-icon name="eraser" [size]="12"></lucide-icon> Limpiar
        </button>
      </div>
      <div 
        class="bg-surface border-2 border-dashed border-divider rounded-lg overflow-hidden w-full"
        [style.height.px]="height"
      >
        <canvas
          #canvas
          class="w-full h-full cursor-crosshair touch-none"
          (mousedown)="startDrawing($event)"
          (mousemove)="draw($event)"
          (mouseup)="stopDrawing()"
          (mouseleave)="stopDrawing()"
          (touchstart)="startDrawingTouch($event)"
          (touchmove)="drawTouch($event)"
          (touchend)="stopDrawing()"
        ></canvas>
      </div>
      <p class="text-xs text-text-muted mt-1 text-center font-medium opacity-70">
        Firma digitalmente en el recuadro
      </p>
    </div>
  `
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  @Input() label: string = 'Firma';
  @Input() height: number = 200;
  
  @Output() signatureChange = new EventEmitter<string | null>();

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private isEmpty = true;

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
    this.ctx.strokeStyle = '#000000'; // Black ink
  }

  @HostListener('window:resize')
  onResize() {
    // Basic resize handling, clears canvas unfortunately in standard implementation
    // unless we save the image data and restore it, but for a simple pad we can leave it.
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      // this.resizeCanvas(rect.width, rect.height);
    }
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
        this.ctx.strokeStyle = '#000000';
    }
  }

  startDrawing(event: MouseEvent) {
    this.isDrawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(event.offsetX, event.offsetY);
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing) return;
    this.ctx.lineTo(event.offsetX, event.offsetY);
    this.ctx.stroke();
    this.isEmpty = false;
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
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    this.isDrawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  drawTouch(event: TouchEvent) {
    if (!this.isDrawing) return;
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.isEmpty = false;
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    // Instead of using scale issues, just clear rect based on physical width
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.isEmpty = true;
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

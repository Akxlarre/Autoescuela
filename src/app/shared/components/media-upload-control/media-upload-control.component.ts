import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-media-upload-control',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ButtonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MediaUploadControlComponent),
      multi: true,
    },
  ],
  template: `
    <div class="flex flex-col gap-2">
      <!-- Image/Video Preview -->
      @if (value() && value() !== '') {
        <div class="mb-1 rounded-lg overflow-hidden border" style="border-color: var(--border-subtle); max-height: 120px; background: var(--bg-subtle);">
          @if (previewType() === 'video') {
            <video [src]="value()" class="w-full h-full object-cover opacity-80" autoplay muted loop playsinline></video>
          } @else {
            <img [src]="value()" class="w-full h-full object-cover opacity-80" alt="Media Preview" />
          }
        </div>
      }

      <div class="flex gap-2">
        <p-button
          styleClass="w-full"
          class="flex-1"
          [disabled]="disabled() || isUploading()"
          (onClick)="fileInput.click()"
        >
          <div class="flex items-center justify-center gap-1.5 w-full">
            <app-icon [name]="buttonIcon()" [size]="13" />
            <span class="text-xs font-semibold uppercase tracking-wider">{{ buttonLabel() }}</span>
          </div>
        </p-button>

        <input
          #fileInput
          type="file"
          [accept]="accept()"
          class="hidden"
          (change)="onFileChange($event)"
        />

        <p-button
          severity="secondary"
          variant="outlined"
          (onClick)="clearValue()"
          [disabled]="disabled() || isUploading()"
          styleClass="w-10 px-0 flex items-center justify-center"
        >
          <app-icon name="rotate-ccw" [size]="13" />
        </p-button>
      </div>

      <!-- URL Manual Input -->
      <div class="flex gap-2 items-end mt-1">
        <div class="flex-1 flex flex-col gap-1">
          <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">{{ label() }}</label>
          <div class="relative">
            <input
              type="text"
              class="field-input py-2 pl-3 pr-8 text-xs font-mono w-full"
              placeholder="/assets/image.jpg"
              [value]="value()"
              [disabled]="disabled()"
              (input)="onTextInput($event)"
              (blur)="onBlur()"
            />
            <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" title="URL manual">
              <app-icon name="link" [size]="14" />
            </span>
          </div>
        </div>
      </div>
      
      @if (isUploading()) {
        <div
          class="absolute inset-0 bg-surface/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20"
          style="background: var(--bg-surface);"
        >
          <app-icon name="loader-2" [size]="20" class="animate-spin text-brand" />
          <span class="text-[10px] font-bold text-brand uppercase tracking-wider">Subiendo...</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
    }
  `],
})
export class MediaUploadControlComponent implements ControlValueAccessor {
  label = input<string>('Ruta o URL del Recurso');
  buttonLabel = input<string>('Adjuntar Archivo');
  buttonIcon = input<string>('upload');
  accept = input<string>('image/*');
  isUploading = input<boolean>(false);
  previewType = input<'image' | 'video'>('image');

  fileSelected = output<File>();

  value = signal<string>('');
  disabled = signal<boolean>(false);

  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string): void {
    this.value.set(val || '');
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onTextInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.value.set(inputEl.value);
    this.onChange(inputEl.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  onFileChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = inputEl.files;
    if (files && files.length > 0) {
      this.fileSelected.emit(files[0]);
    }
    inputEl.value = '';
  }

  clearValue(): void {
    this.value.set('');
    this.onChange('');
    this.onTouched();
  }
}

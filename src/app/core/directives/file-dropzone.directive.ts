import { Directive, HostBinding, HostListener, output, input } from '@angular/core';

/**
 * Agrega soporte de drag & drop a una caja de subida de archivo existente.
 * Emite `filesDropped` con el/los `File` soltados — la lógica de validación
 * y subida sigue viviendo en el mismo handler que ya procesa `<input type="file">`.
 *
 * @example
 * <label appFileDropzone (filesDropped)="onFilesDropped($event)">
 *   <input type="file" (change)="onFileSelected($event)" />
 * </label>
 */
@Directive({
  selector: '[appFileDropzone]',
  standalone: true,
})
export class FileDropzoneDirective {
  /** Desactiva el drop (ej. mientras ya hay un archivo subido o está deshabilitado). */
  readonly dropzoneEnabled = input<boolean>(true);

  /** Emite los archivos soltados sobre el host. */
  readonly filesDropped = output<FileList>();

  @HostBinding('class.is-dragover') isDragover = false;

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (!this.dropzoneEnabled()) return;
    event.preventDefault();
    this.isDragover = true;
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (!this.dropzoneEnabled()) return;
    event.preventDefault();
    this.isDragover = false;
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (!this.dropzoneEnabled()) return;
    event.preventDefault();
    this.isDragover = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.filesDropped.emit(files);
    }
  }
}

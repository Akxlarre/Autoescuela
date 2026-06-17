import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { ToastService } from '../services/ui/toast.service';
import { ErrorSanitizerService } from '../services/infrastructure/error-sanitizer.service';

/**
 * GlobalErrorHandler — Atrapa excepciones no manejadas en el frontend.
 * 
 * Evita que la aplicación se "congele" o rompa silenciosamente cuando
 * ocurre un error de JavaScript (ej: TypeError en un componente).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly zone = inject(NgZone);

  handleError(error: any): void {
    // 1. Logear a consola siempre para debugging de los desarrolladores
    console.error('🔥 [GlobalErrorHandler] Unhandled Exception:', error);

    // 2. Sanitizar el error para obtener un mensaje amigable
    const sanitized = this.sanitizer.sanitize(error);

    // 3. Mostrar el Toast (asegurándonos de entrar en la zona de Angular)
    this.zone.run(() => {
      this.toast.error('Error', sanitized.message);
    });
  }
}

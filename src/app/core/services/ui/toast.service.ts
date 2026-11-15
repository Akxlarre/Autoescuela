import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * ToastService — Capa 1 del sistema de notificaciones.
 *
 * Wrapper delgado sobre PrimeNG MessageService para toasts efímeros.
 * Centraliza la configuración de severidad, duración y key.
 *
 * PrimeNG MessageService ya está provisto en app.config.ts y
 * p-toast está montado en app.component.ts con animaciones GSAP.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly msg = inject(MessageService);

  success(summary: string, detail?: string): void {
    this.msg.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(summary: string, detail?: string): void {
    this.msg.add({ severity: 'error', summary, detail, life: 6000 });
  }

  /** `life` en ms: subirlo cuando el aviso trae más de una frase que hay que alcanzar a leer. */
  warning(summary: string, detail?: string, life = 4000): void {
    this.msg.add({ severity: 'warn', summary, detail, life });
  }

  info(summary: string, detail?: string): void {
    this.msg.add({ severity: 'info', summary, detail, life: 3000 });
  }

  infoWith(
    summary: string,
    options: { life?: number; detail?: string; styleClass?: string },
  ): void {
    this.msg.add({
      severity: 'info',
      summary,
      detail: options.detail ?? '',
      life: options.life ?? 3000,
      styleClass: options.styleClass,
    });
  }
}

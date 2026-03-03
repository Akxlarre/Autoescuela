import { Injectable, signal, computed } from '@angular/core';

export type ConfirmSeverity = 'danger' | 'warn' | 'success' | 'info' | 'secondary';

export interface ConfirmConfig {
  title: string;
  message: string;
  severity?: ConfirmSeverity;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private readonly _config = signal<ConfirmConfig | null>(null);

  /** Configuración actual del modal (null = cerrado). */
  readonly config = this._config.asReadonly();

  /** Si el modal está visible. */
  readonly isOpen = computed(() => this._config() !== null);

  private resolvePromise: ((value: boolean) => void) | null = null;

  /**
   * Muestra el modal de confirmación y devuelve una promesa que se resuelve
   * con true si el usuario confirma, false si cancela.
   */
  confirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
      this._config.set({
        title: config.title,
        message: config.message,
        severity: config.severity ?? 'secondary',
        confirmLabel: config.confirmLabel ?? 'Aceptar',
        cancelLabel: config.cancelLabel ?? 'Cancelar',
      });
    });
  }

  /** Resuelve con true (confirmado). */
  accept(): void {
    this.resolvePromise?.(true);
    this.resolvePromise = null;
    this._config.set(null);
  }

  /** Resuelve con false (cancelado). */
  cancel(): void {
    this.resolvePromise?.(false);
    this.resolvePromise = null;
    this._config.set(null);
  }
}

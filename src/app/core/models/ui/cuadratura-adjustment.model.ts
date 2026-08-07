/** Fila de ajuste ya registrado, para la sección de ajustes de un cierre en el modal de detalle. */
export interface CuadraturaAdjustmentRow {
  id: number;
  tipo: 'gasto_olvidado' | 'correccion_manual';
  /** Etiqueta legible del tipo — 'Gasto olvidado' | 'Corrección manual'. */
  tipoLabel: string;
  /** Con signo: negativo reduce el total vigente, positivo lo aumenta. */
  monto: number;
  motivo: string;
  /** Nombre completo de quien registró el ajuste (join a `users`). */
  autorNombre: string;
  /** `created_at` formateado dd/MM/yyyy HH:mm. */
  fecha: string;
}

/** Payload del formulario de `RegistrarAjusteCuadraturaDrawerComponent`. */
export interface AjusteFormData {
  tipo: 'gasto_olvidado' | 'correccion_manual';
  monto: number;
  motivo: string;
  /** Solo relevante si `tipo === 'gasto_olvidado'`. */
  categoria?: string;
  /** Vehículo asociado al gasto olvidado (ej. combustible). Opcional. */
  vehiculoId?: number | null;
}

import type { AbstractControl, ValidationErrors } from '@angular/forms';
import type { ServicioEspecial } from '@core/models/ui/servicios-especiales.model';

/** Forma de comparar nombres del catálogo: sin mayúsculas ni espacios de más (fix-436-m). */
function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CL');
}

/**
 * Servicio del catálogo con el mismo nombre (fix-436-m, decisión D05: no se permiten dos
 * servicios con el mismo nombre). `excludeId` deja fuera al servicio que se está editando.
 */
export function buscarServicioDuplicado(
  catalogo: readonly ServicioEspecial[],
  nombre: string,
  excludeId?: number,
): ServicioEspecial | null {
  const buscado = normalizarNombre(nombre);
  return catalogo.find((s) => s.id !== excludeId && normalizarNombre(s.nombre) === buscado) ?? null;
}

/** Mensaje para el usuario; si el duplicado está inactivo, sugiere reactivarlo. */
export function mensajeServicioDuplicado(duplicado: ServicioEspecial): string {
  return duplicado.activo
    ? `Ya existe un servicio llamado "${duplicado.nombre}".`
    : `Ya existe el servicio "${duplicado.nombre}", inactivo. Reactívalo desde "Mostrar inactivos" en vez de crear otro.`;
}

/**
 * Validador: un texto de solo espacios no cuenta como completado (fix-436-m). El vacío lo
 * resuelve `Validators.required`.
 */
export function noSoloEspacios(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value.length === 0) return null;
  return value.trim().length === 0 ? { soloEspacios: true } : null;
}

/**
 * Validador: el monto es un entero (hotfix-158-m). Las columnas de precio son INTEGER: con
 * decimales la BD rechazaba la venta con un error genérico. El vacío lo resuelve Validators.required.
 */
export function montoEntero(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number.isInteger(Number(value)) ? null : { montoEntero: true };
}

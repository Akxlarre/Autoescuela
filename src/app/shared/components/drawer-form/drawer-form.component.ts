import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * DrawerFormComponent — Shell canónico para el cuerpo de un drawer de formulario.
 *
 * Encapsula la estructura definida en la skill `form-ux §6` para que ningún
 * drawer vuelva a improvisar fondo, ancho, scroll o footer:
 *  - Superficie `bg-surface` tipo card (resuelve el contraste incómodo de inputs
 *    grises sobre fondo gris del host del LayoutDrawer).
 *  - Cuerpo scrolleable con columna centrada `max-w-xl` (resuelve los campos
 *    "flotando sueltos").
 *  - Footer fijo al fondo (no dentro del scroll) vía slot `[drawer-form-footer]`.
 *
 * El contenido del formulario (secciones + campos con `.field-*`/`.section-title`)
 * se proyecta en el slot por defecto. Los botones de acción se proyectan en el
 * footer usando `ngProjectAs="[drawer-form-footer]"`.
 *
 * @example
 * ```html
 * <app-drawer-form>
 *   <h3 class="section-title">Datos</h3>
 *   <div class="flex flex-col gap-4">…campos…</div>
 *
 *   <ng-container ngProjectAs="[drawer-form-footer]">
 *     <button class="btn-secondary" (click)="cancel()">Cancelar</button>
 *     <button class="btn-primary" (click)="save()">Guardar</button>
 *   </ng-container>
 * </app-drawer-form>
 * ```
 */
@Component({
  selector: 'app-drawer-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full',
  },
  template: `
    <div
      class="flex flex-col flex-1 min-h-0 bg-surface rounded-xl border border-border-subtle overflow-hidden"
    >
      <!-- Cuerpo scrolleable -->
      <div class="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div class="flex flex-col w-full mx-auto" [style.max-width.rem]="maxWidthRem()">
          <ng-content />
        </div>
      </div>

      <!-- Footer fijo -->
      @if (hasFooter()) {
        <div
          class="shrink-0 px-6 py-4 border-t border-border-subtle bg-surface flex items-center justify-end gap-3"
        >
          <ng-content select="[drawer-form-footer]" />
        </div>
      }
    </div>
  `,
})
export class DrawerFormComponent {
  /** Muestra el footer fijo. Desactivar solo en drawers sin acciones. */
  readonly hasFooter = input(true, { transform: booleanAttribute });

  /**
   * Ancho máximo de la columna de campos, en rem. Por defecto `null` = llena el
   * ancho de la card (con el padding `px-6` como margen). Pasar un número para
   * acotar la columna en drawers puntuales que lo requieran.
   */
  readonly maxWidthRem = input<number | null>(null);
}

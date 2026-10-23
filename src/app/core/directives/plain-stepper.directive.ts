import { Directive } from '@angular/core';

/**
 * Quita la semántica de pestañas que PrimeNG pone en `p-stepper` / `p-step-panel` cuando el
 * stepper se usa **sin** `p-step-list` (fix-068-i).
 *
 * Sin lista de pasos, `p-stepper` igual declara `role="tablist"` y cada `p-step-panel`
 * `role="tabpanel"` + `aria-controls` hacia un paso que no existe: axe marca
 * `aria-required-children` y `aria-valid-attr-value` (críticos) y un lector de pantalla anuncia
 * una lista de pestañas vacía. En ese uso el stepper solo muestra un panel a la vez; la estructura
 * la dan los títulos de cada paso.
 *
 * Funciona porque los `host` bindings de una directiva se aplican después de los del componente
 * del mismo elemento, y los de PrimeNG son constantes (no se vuelven a escribir).
 *
 * No usar en un stepper que sí tiene `p-step-list`: ahí las pestañas existen y el ARIA es correcto.
 *
 * @example
 * <p-stepper appPlainStepper [value]="paso()">
 *   <p-step-panels>
 *     <p-step-panel appPlainStepper [value]="0">…</p-step-panel>
 *   </p-step-panels>
 * </p-stepper>
 */
@Directive({
  selector: '[appPlainStepper]',
  standalone: true,
  host: {
    '[attr.role]': 'null',
    '[attr.aria-controls]': 'null',
  },
})
export class PlainStepperDirective {}

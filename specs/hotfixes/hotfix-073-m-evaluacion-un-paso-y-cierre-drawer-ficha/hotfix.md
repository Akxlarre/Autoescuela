# Hotfix: Evaluación práctica a un solo paso + cierre de drawer al ir a Ficha Técnica
> id: hotfix-073-m-evaluacion-un-paso-y-cierre-drawer-ficha
> refs: —
> status: done
> closed: 2026-08-13
> created: 2026-08-13

## Problema
1. En `StudentDrawerDetailComponent`, el botón "Ver Ficha Técnica Completa" navega vía `routerLink` a la ficha técnica del alumno pero el drawer no se cierra, quedando abierto encima de la nueva vista.
2. `InstructorEvaluacionComponent` usa un wizard de 3 pasos (Checklist y Nota / Observaciones / Firmas) que el dueño pidió colapsar en un solo paso continuo, con Observaciones y Firmas (ambas ya opcionales) debajo de la Nota Global. Además el textarea de Observaciones se ve mal y debe reemplazarse por el estilo ya usado en `instructor-clase-detail.component.ts`.

## Cambios
- **Archivo:** `src/app/features/instructor/alumnos/components/student-drawer-detail.component.ts` — agregar `(click)="facade.closeDrawer()"` al botón "Ver Ficha Técnica Completa".
- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts` —
  1. Quitar el step indicator y renderizar Checklist + Nota Global + Observaciones + Firmas en un único bloque continuo.
  2. Eliminar `steps`, `currentStep`, `nextStep()`, `prevStep()`, `canAdvance()` (ya no aplican sin wizard).
  3. Footer con un solo botón: "Finalizar Evaluación" (submit) o "Volver" en modo lectura — sin "Siguiente"/"Atrás".
  4. Reemplazar el textarea de Observaciones (`class="form-control resize-y"`) por el estilo de `instructor-clase-detail.component.ts` (`form-control w-full resize-none rounded-2xl p-5 bg-subtle border-border-default/60 focus:bg-surface focus:border-brand/40 focus:ring-4 focus:ring-brand/10 transition-all text-sm sm:text-base shadow-inner placeholder:text-text-muted/60 hover:border-border-strong cursor-text`, `rows="4"`).

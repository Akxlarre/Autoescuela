# Fix: `App` (root component) sin `ChangeDetectionStrategy.OnPush`
> id: fix-112-b-onpush-app-root
> refs: indices/DS-AUDIT-2026-08-03.md (H10)
> status: done
> closed: 2026-08-03
> created: 2026-08-03

## Root Cause

`.claude/rules/architecture.md` exige `ChangeDetectionStrategy.OnPush` en TODOS los componentes.
De 261 componentes bajo `src/app`, `src/app/app.ts` (`App`, selector `app-root`, el componente
raíz) es el único sin el flag — quedó fuera por ser el shell mínimo generado por el CLI, nunca se
tocó al adoptar OnPush en el resto de la app.

## ACs Afectados

Ninguno — fix autónomo de disciplina arquitectónica, sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/app.ts`
- **Qué cambia:** agrega `changeDetection: ChangeDetectionStrategy.OnPush` al decorador
  `@Component`, e importa `ChangeDetectionStrategy` de `@angular/core`. Sin riesgo de regresión:
  el componente no tiene inputs, no muta estado propio fuera de la inyección de `ThemeService`
  (que ya gestiona su propio side-effect fuera del ciclo de detección de cambios de `App`), y su
  único contenido (`<router-outlet>` + `<p-toast>`) ya vive dentro de subárboles OnPush.

## Test de Regresión

Resultado (2026-08-03):

- `npx ng build` — compiló sin errores (43s, único warning es el budget de bundle pre-existente,
  no relacionado) ✓
- `npm run lint:arch` — 0 errores, 169 advertencias (idéntico al estado post fix-111-b, sin
  ningún hallazgo nuevo sobre `app.ts`) ✓

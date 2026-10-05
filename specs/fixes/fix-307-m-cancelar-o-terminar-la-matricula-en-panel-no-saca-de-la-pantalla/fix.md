# Fix: Cancelar o terminar la matrícula en panel no saca de la pantalla
> id: fix-307-m-cancelar-o-terminar-la-matricula-en-panel-no-saca-de-la-pantalla
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`SecretariaMatriculaComponent.finishWizard()` cierra el panel y navega siempre al Inicio
(`router.navigate([dashboard])`). Esa navegación viene de cuando el wizard solo existía como página
propia (`/app/<rol>/matricula`). Hoy se abre además como panel sobre otra pantalla desde la Base de
Alumnos, el Inicio de secretaria y los cuatro Ex-Alumnos, y tanto "Cancelar" del Paso 1 como
"Finalizar" del Paso 6 pasan por esa función: el usuario pierde la pantalla en la que estaba. Es B46
de `fix-264-m` (`024a` O03), comprobado en navegador con "Cancelar" desde la Base de Alumnos B.

Además, la Base de Alumnos no se entera de que el panel se cerró: su tiempo real no llega (B10,
`ASG-i-056`), así que aunque el usuario se quedara en la lista, el alumno recién matriculado no
aparecería sin recargar.

**Decisión del owner (Matías, 2026-10-04):** al cancelar o terminar una matrícula abierta como
panel, el usuario se queda en la pantalla desde la que la abrió.

## ACs Afectados
- AC-1: con el wizard abierto como panel, "Cancelar" y "Finalizar" cierran el panel y no navegan.
- AC-2: con el wizard como página propia, ambos siguen llevando al Inicio (sin cambios).
- AC-3 (`024a` O03): al cerrarse el panel de "Nueva Matrícula" abierto desde la Base de Alumnos, la
  lista se vuelve a pedir en silencio, sin skeleton.

## Cambio
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` —
  `finishWizard()` solo navega al Inicio cuando el wizard no está dentro del panel.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  al cerrarse el panel de matrícula que la lista abrió, emite `refreshRequested`.

## Test de Regresión
- `secretaria-matricula.component.spec.ts > finishWizard (fix-307-m)` (2 tests) ✓
- `alumnos-list-content.component.spec.ts > refresco al cerrar el panel de matrícula (fix-307-m)`
  (2 tests) ✓
- `e2e/alumnos-b-lista.spec.ts > O03 (parcial) · fix-307-m` ✓ — antes del arreglo la URL terminaba
  en `/dashboard` (llevaba `knownBug` B46); ahora se queda en la lista.

## Verificación
2026-10-04: los 4 unitarios y el test de navegador pasan; también W01 · W02 y W05 (re-matrícula
desde Ex-Alumnos B). "Cancelar" se comprobó en navegador; "Finalizar" usa la misma función.

# Fix: La secretaria multi-sede recarga Ex-Alumnos B al cambiar de sede
> id: fix-288-m-secretaria-multi-sede-recarga-ex-alumnos-b-al-cambiar-de-sede
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
`SecretariaExAlumnosComponent` carga los egresados una sola vez en `ngOnInit()`, con el supuesto de
que "la Secretaria está anclada a su propia sede". Una secretaria con permiso para las dos sedes sí
tiene selector de sede, y al cambiarlo la lista no se vuelve a pedir: sigue mostrando los egresados
de la sede anterior. Es el mismo problema que `fix-269-m` corrigió en la Base de Alumnos (B7); acá
es B33 de la 2ª pasada de `fix-264-m` (`024b` Y04).

## ACs Afectados
- `024b` Y04: la secretaria multi-sede cambia de sede en Ex-Alumnos B y la lista muestra los
  egresados de la sede elegida.
- Sin cambio para la secretaria de una sola sede: carga su sede una vez al entrar.

## Cambio
- **Archivo:** `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` — la
  carga pasa de `ngOnInit()` a un `effect()` que sigue `BranchFacade.selectedBranchId()`, igual
  que `AdminExAlumnosComponent` y que `SecretariaAlumnosComponent`.

## Test de Regresión
- `e2e/alumnos-b-ficha.spec.ts > Y04 (fix-288-m)` sin la marca `knownBug` ✓
- Sin cambio en `T01 · T10 (secretaria)` y `W01 · W02` ✓

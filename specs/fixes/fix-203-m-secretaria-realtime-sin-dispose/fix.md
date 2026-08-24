# Fix: Cuatro páginas de secretaria suscriben Realtime sin hacer dispose
> id: fix-203-m-secretaria-realtime-sin-dispose
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
Las páginas de secretaria se crearon copiando las de admin y, al simplificar el ciclo de vida
(quitar el `effect` de `BranchFacade` que secretaria no necesita), se perdió también la línea
que cierra el canal de Realtime. Admin conserva
`destroyRef.onDestroy(() => facade.destroyRealtime())`; secretaria no lo llama en:

- `secretaria/pagos` (`PagosFacade`)
- `secretaria/contabilidad-cuadratura` (`CuadraturaFacade`)
- `secretaria/contabilidad-liquidaciones` (`LiquidacionesFacade`)
- `secretaria/alumnos` (`AdminAlumnosFacade`)

El canal queda vivo al salir de la página. Viola la prohibición explícita de
`.claude/rules/swr-pattern.md`: "NUNCA suscribir Realtime sin su correspondiente `dispose()`
en el ciclo de vida".

Evidencia de que es copy-paste degradado y no una decisión de rol: `secretaria-pagos` todavía
inyecta `DestroyRef` y nunca lo usa — quedó el inject y se borró el uso.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivos:**
  - `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
  - `src/app/features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts`
  - `src/app/features/secretaria/contabilidad-liquidaciones/secretaria-contabilidad-liquidaciones.component.ts`
  - `src/app/features/secretaria/alumnos/secretaria-alumnos.component.ts`

  **Qué cambia:** cada uno registra `this.destroyRef.onDestroy(() => this.facade.destroyRealtime())`
  (inyectando `DestroyRef` donde falte), igual que su par de admin.

## Test de Regresión
- `npm run test:ci` verde.
- `npm run lint:arch` sin errores nuevos.
- Verificación: los 4 componentes de secretaria llaman `destroyRealtime()` en el ciclo de vida,
  al igual que sus pares de admin (grep de paridad).

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**

# Fix: Caja Diaria — las acciones de ingreso y egreso divergen entre admin y secretaria
> id: fix-204-m-caja-diaria-paridad-ingreso-egreso
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
Dos migraciones anteriores de Caja Diaria se aplicaron **cada una a un solo rol**, dejando las
dos acciones de la página desalineadas:

1. **Egreso — la migración modal → drawer quedó a medias.** `indices/COMPONENTS.md:119` ya
   declara `app-egreso-modal` como **DEPRECADO**, "reemplazado por
   `RegistrarEgresoDrawerComponent` vía LayoutDrawer". Admin migró; el dashboard de secretaria
   también usa el drawer. La única pantalla que sigue con el modal deprecado es la Caja Diaria
   de secretaria, que es además su **único consumidor** en todo el código.

2. **Ingreso — fix-080-m se aplicó solo a secretaria.** Ese fix agregó
   `pagosFacade.initialize()` antes de abrir el drawer porque, sin él, `alumnosConDeuda()`
   está vacío y el drawer muestra "No hay alumnos con saldo pendiente" aunque sí haya
   (el drawer en modo global itera ese signal para poblar el `<select>` de alumno).
   Admin nunca lo recibió: hoy su botón de ingreso abre un drawer con el select vacío, salvo
   que el usuario haya pasado antes por Pagos en la misma sesión y el SWR del facade lo tenga
   cacheado — por eso pasó desapercibido.

Además las etiquetas divergieron: admin abre "Registrar Ingreso" (`trending-up`) y secretaria
"Registrar Pago" (`plus`) para la misma acción.

## Decisión del dueño (2026-08-24)
- Siempre drawer, nunca modal → **admin es el canon en el egreso**.
- Para el ingreso: se conserva la **etiqueta e icono de admin** ("Registrar Ingreso" /
  `trending-up`) y la **lógica de secretaria** (`initialize()` antes de abrir), porque registrar
  un ingreso es lo mismo que registrar un pago y el drawer depende de esos datos.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts`
  **Qué cambia:** reemplaza `<app-egreso-modal>` + `egresoModalOpen` por
  `layoutDrawer.open(RegistrarEgresoDrawerComponent, 'Registrar Egreso', 'trending-down')`,
  igual que admin. Unifica el ingreso a 'Registrar Ingreso' / `trending-up`.
- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts`
  **Qué cambia:** agrega `void this.pagosFacade.initialize()` antes de abrir el drawer de
  ingreso (backport de fix-080-m).
- **Archivo:** `src/app/shared/components/egreso-modal/egreso-modal.component.ts`
  **Qué cambia:** se **elimina**. Era deprecado y queda sin consumidores tras el cambio.
- **Archivos:** `indices/COMPONENTS.md`, `indices/USAGE-MAP.md`
  **Qué cambia:** se quita `app-egreso-modal` y se actualiza la fila de la Caja Diaria de
  secretaria.

## Test de Regresión
- `npx ng build` sin errores (garantiza que no quedan referencias al componente eliminado).
- `npm run lint:arch` sin errores nuevos.
- Verificación manual: en **ambos** roles, Caja Diaria → "Registrar Egreso" abre un drawer
  (no un modal), y "Registrar Ingreso" abre el drawer con el select de alumnos poblado.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**

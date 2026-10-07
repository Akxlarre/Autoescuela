# Fix: Una promoción creada por error solo se puede "cancelar", y queda ocupando su lunes y su número
> id: fix-348-m-eliminar-promocion-en-vez-de-cancelar
> refs: ASG-i-025 · fix-319-m (L12, D20) · fix-325-m · fix-323-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
La única salida para una promoción creada por error (lunes equivocado, número mal puesto) es pasarla
a "Cancelada" desde "Editar promoción". Una cancelada no desaparece: sigue en la lista, **ocupa su
lunes** (`UNIQUE (branch_id, start_date)`) **y su número** (`code` único) para siempre, y si su
fecha es de la cadencia corre a la automática. En el testing la promoción de prueba dejó bloqueado
el 30-11-2026 y gastado el 9002.

Cancelar tampoco tiene otro uso real (Matías, 2026-10-06): con alumnos está bloqueado desde
`fix-325-m`, y sin alumnos la promoción simplemente queda vacía.

Decisión **D20** (Matías, 2026-10-06): **"Cancelada" se reemplaza por "Eliminar"**. Solo admin, solo
promociones sin alumnos que no hayan partido; se borra de verdad, con confirmación, y libera el
lunes y el número. Desaparecen la opción "Cancelada" del selector, el KPI "Canceladas" y el filtro
"Cancelada". Una cancelada histórica sigue existiendo, pero no se pueden crear más. A la secretaria
se le avisa que, si la promoción se creó por error, pida al administrador que la elimine.

## ACs Afectados
Ninguno propio. Deja sin uso en la app la transición a `cancelled` (`fix-325-m` sigue como defensa
en BD).

## Cambio
- **Migración nueva** — función `delete_promotion_without_students(p_promotion_id)`: borra en una
  sola transacción la promoción con sus cursos, sesiones, relatores y libros. Solo admin; solo si
  está planificada o cancelada y no tiene matrículas (los borradores del wizard que apuntaban a
  ella quedan sin promoción elegida). No hay `ON DELETE CASCADE` en esas tablas, por eso es una
  función y no un `DELETE` desde la app. **La aplica Matías.**
- `supabase/tests/promotions/fix-348-delete-promotion.sql` — test para el SQL Editor (aborta
  siempre a propósito).
- `src/app/core/utils/promotion-code.utils.ts` — mensajes para los rechazos de la función.
- `src/app/core/facades/promociones.facade.ts` — `eliminarPromocion()`; se quita el KPI de
  canceladas.
- `…/admin-promocion-editar-drawer.component.ts` — sin "Cancelada" como destino; bloque "Eliminar
  promoción" (admin, planificada o cancelada, sin alumnos) con confirmación; aviso a la secretaria
  en una planificada sin alumnos.
- `…/admin-profesional-promociones.component.ts` — sin KPI "Canceladas" ni filtro "Cancelada".
- `indices/DATABASE.md`.

Las canceladas históricas siguen apareciendo en la lista con su etiqueta, y el admin puede
eliminarlas si no tienen alumnos.

D5 se mantiene (Matías lo reconfirmó el 2026-10-06): la secretaria no crea promociones — se crean
solas con el cron — así que el aviso va solo en "Editar promoción", no en el formulario de crear.

## Test de Regresión
- `promotion-code.utils.spec.ts`: mensajes de los rechazos.
- `promociones.facade.spec.ts`: `eliminarPromocion()` llama a la función; un rechazo muestra su
  mensaje y devuelve `false`.
- `admin-promocion-editar-drawer.component.spec.ts`: "Cancelada" ya no es destino; quién ve
  "Eliminar"; confirmar elimina y cancelar la confirmación no; aviso de la secretaria.
- Test SQL: admin elimina una planificada sin alumnos y quedan libres lunes y número; con
  matrícula, en curso o sin ser admin, se rechaza.

## Progreso
- [x] Migración `20261006170000_fix348_delete_promotion_without_students.sql` y test
  `supabase/tests/promotions/fix-348-delete-promotion.sql` (5 casos). Ninguno ejecutado todavía.
- [x] Utilidad + facade + drawer + página, con tests. Vitest: 94/94 en los 5 archivos de
  Promociones (24 utilidad, 30 facade, 26 editar, 7 crear, 7 página). `tsc` sin errores;
  `lint:arch` 0 errores y las mismas 182 advertencias de antes.
- [x] Los tests de `fix-325-m` del drawer ("Cancelada" deshabilitada con alumnos) se reemplazaron
  por los de este fix: esa opción ya no existe. El trigger de `fix-325-m` sigue en la BD.
- [x] Revisión en navegador de lo que no necesita la migración (2026-10-06):
  - Admin: KPIs "Total 6 · En curso 3 · Planificadas 2" (sin Canceladas); filtro con Todos /
    Planificada / En curso. Selector de estado: 280 → En curso, Finalizada; 282 y 281 → solo
    Planificada; 9002 → solo Cancelada. Bloque "Eliminar promoción" visible en la 9002 (cancelada)
    y la 282 (planificada, 0 alumnos); ausente en la 280 (en curso) y la 281 (1 alumno).
  - secretariaB: nunca ve "Eliminar"; en la 282 ve "¿Esta promoción se creó por error? Pídele al
    administrador que la elimine."; en la 281 y la 280 no hay aviso.
- [x] Matías aplicó la migración y corrió el test SQL (2026-10-06). Resultado:
  `RESULTADO fix-348: TODO OK` — caso 1: promoción con 60 sesiones eliminada, 0 filas restantes, y
  el mismo lunes y número se pudieron volver a usar; caso 2 `promotion_not_deletable` (en curso);
  caso 3 `promotion_not_found`; caso 4 `promotion_has_enrollments` (1 matrícula); caso 5 "Solo un
  administrador puede eliminar una promoción" (secretaria).
- [x] Borrado real en navegador (admin, 2026-10-06), con la promoción de prueba 9002:
  - el modal dice `Se eliminará "Promoción 9002 (30 de Noviembre 2026)" con sus cursos y sesiones…`;
    "Cancelar" no llama a la función y deja el panel abierto;
  - "Eliminar" → una llamada a `delete_promotion_without_students` (204), toast "Promoción
    eliminada", el panel se cierra y la lista queda en 5 (Total 5 · En curso 3 · Planificadas 2);
  - en "Programar Promoción" el lunes 30-11 vuelve a estar libre y el número sugerido vuelve a 283.
- [x] Ajuste pedido por Matías: el bloque "Eliminar promoción" quedaba pegado al aviso amarillo.
  Ahora tiene la misma separación que hay entre el selector y el aviso (12 px en ambos, medido con
  la animación de entrada terminada).

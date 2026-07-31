# Fix: Mover Historial de Reagendamientos a un Drawer (eliminar scroll vertical de la ficha)
> id: fix-009-i-historial-reagendamientos-drawer
> refs: fix-008-i (continuación — ajuste de UX post-implementación)
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause
La sección "Reagendamientos" agregada en fix-008-i quedó incrustada inline al final de la columna izquierda de la ficha del alumno (`admin-alumno-detalle.component.ts`), generando scroll vertical adicional y rompiendo el diseño compacto sin desbordes que ya tenían "Inasistencias" y "Ficha Técnica" (ambas movidas a drawers en una iteración previa, según `indices/COMPONENTS.md`).

## ACs Afectados
Ninguno — fix autónomo (pedido directo del usuario, continuación de fix-008-i).

## Cambio
- Quitar el bloque inline `<app-admin-historial-reagendamientos>` de `admin-alumno-detalle.component.ts`.
- Agregar un nuevo botón "Reagendamientos" en la tarjeta de perfil, debajo de "Inasistencias"/"Ficha Técnica", mismo estilo (`min-w-0`, grid de botones).
- Crear `AdminHistorialReagendamientosDrawerComponent` (wrapper delgado, mismo patrón que `AdminInasistenciasDrawerComponent`/`AdminFichaTecnicaDrawerComponent`) que envuelve `AdminHistorialReagendamientosComponent` y se abre vía `LayoutDrawerFacadeService.open()`.
- El botón nuevo abre el drawer con el historial completo del alumno.

## Bug encontrado en verificación visual: reagendamientos no aparecían en el drawer
Tras el primer QA del usuario ("hice varios reagendamientos pero no me aparece ninguno"), se encontró la causa: `historialReagendamientos()` solo se cargaba una vez en `ngOnInit()` de `admin-alumno-detalle.component.ts`, **antes** de que el usuario reagendara nada. `reagendarClasesPenalizadas()` insertaba en `class_b_reschedule_history` correctamente, pero nunca refrescaba esa signal — el drawer seguía mostrando el snapshot vacío original.
- **Fix:** `reagendarClasesPenalizadas()` ahora llama `await this.loadHistorialReagendamientos(payload.enrollmentId)` justo después de insertar el batch en el historial, así la próxima vez que se abre el drawer ya tiene los datos frescos.

## Bug 2 encontrado en verificación visual: filas indistinguibles en el drawer
Con el refresh ya funcionando, el usuario reportó que varias filas con la misma razón ("Otro" + mismo texto libre) y fechas parecidas eran indistinguibles — no había forma de saber qué clase (`class_number`) correspondía a cada reagendamiento.
- **Fix:** `loadHistorialReagendamientos()` ahora hace join a `class_b_sessions(class_number)` vía `class_session_id`, y `ReagendamientoHistorialUI` expone `claseNumero`. El componente antepone `"Clase #N — "` a la razón cuando el número está disponible.

## Test de Regresión
- No aplica test nuevo para el movimiento a drawer en sí (`.claude/rules/testing-tdd.md`: puro `layoutDrawer.open()`, sin `computed()`/decisión).
- **Test 1** (`admin-alumno-detalle.facade.spec.ts`): "refresca historialReagendamientos tras insertar (fix-009-i...)" — verifica que tras `reagendarClasesPenalizadas()` la signal `historialReagendamientos()` queda poblada con la fila recién insertada. El mock de `class_b_reschedule_history` se extendió para soportar también `select().eq().order()` (antes solo `insert`).
- **Test 2** (nuevo, mismo archivo): "mapea claseNumero desde el join a class_b_sessions..." — dos filas con la misma razón/reason_other pero distinto `class_b_sessions.class_number` (5 y 7) quedan correctamente diferenciadas en `historialReagendamientos()`.
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run` sobre facade + alumno-detalle + drawer de reagendar → **53/53 verde** (37 + 4 + 12).
- Verificación visual: confirmada por el usuario que el refresh funciona; pendiente reconfirmar que ahora cada fila del drawer muestra "Clase #N" y se pueden diferenciar entre sí.

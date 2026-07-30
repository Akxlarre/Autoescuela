# fix-028-m — Clase B: sesión fantasma #13, funciones de penalización no versionadas y ficha técnica inconsistente

## Contexto

Investigación solicitada por el dueño tras detectar una fila `class_b_sessions`
con `class_number = 13` para un alumno (matrícula de 12 clases, RF-046/RF-053).
Encontrado en `d:\Autoescuela` el 2026-07-09.

## Hallazgos

1. **Origen del #13:** `AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()`
   trataba las sesiones `cancelled` (evidencia de penalización RF-053) de forma
   distinta a las `no_show`: en vez de reciclar la fila, insertaba una fila
   nueva con `class_number = MAX(class_number existente) + 1`, sin tope. Nada en
   la BD lo impedía: `class_b_sessions.class_number` es un comentario
   ("1..12 (secuencia obligatoria)"), no un constraint.
2. **Gobernanza de migraciones perdida (recurrente):** `indices/DATABASE.md`
   documentaba `mark_end_of_day_class_b_absences()` y
   `apply_class_b_absence_penalty()` como redefinidas en
   `20260707000000_fix_class_b_absence_penalty_race_and_isolation.sql` — ese
   archivo **nunca existió en git** (aplicado solo vía SQL Editor de Supabase).
   El dueño confirmó el código real vigente en producción.
3. **Bug latente en `mark_end_of_day_class_b_absences()`:** el `UPDATE ...
   SET status = 'no_show' WHERE id = v_row.session_id` no valida
   `AND status = 'scheduled'`. El cursor del loop es un snapshot tomado al
   inicio; si una fila posterior del mismo batch ya fue cancelada por
   `apply_class_b_absence_penalty()` invocada en una iteración anterior, el
   loop la sobreescribe de vuelta a `no_show` cuando le toca su turno.
4. **`apply_class_b_absence_penalty()` sin tope de rango:** cancela todas las
   filas `status='scheduled'` de la matrícula sin acotar `class_number`, por lo
   que cualquier fila fuera de 1-12 (como el #13) también quedaría expuesta a
   cancelación automática, propagando la corrupción en vez de contenerla.
5. **`AdminFichaTecnicaComponent` ignora estado real:** `ClasePracticaUI` ya
   expone `ausente`/`cancelada`/`justificada`/`justificacion` (usados
   correctamente por la grilla de progreso superior en
   `admin-alumno-detalle.component.ts`), pero la tabla "Ficha Técnica" solo
   usa `completada`/`observaciones`, mostrando "Pendiente de sesión" genérico
   para clases canceladas o inasistidas.

## Decisión de negocio (confirmada con el dueño)

Al reagendar una clase `cancelled` (penalización RF-053), se **recicla la
misma fila** — mismo patrón que ya se usa para `no_show` — en vez de insertar
una fila nueva. La matrícula Clase B siempre tiene exactamente `class_number`
1..12 (alineado con `fix-017-clase-b-siempre-12-clases`). El `cancelled_at` ya
grabado en la fila antes de reciclarla es el registro de auditoría de esa
penalización puntual.

## Alcance

1. Recuperar en git las funciones SQL reales (aportadas por el dueño) en una
   migración nueva, corrigiendo los bugs #3 y #4 de los hallazgos.
2. Agregar `CHECK (class_number BETWEEN 1 AND 12)` y
   `UNIQUE (enrollment_id, class_number)` a `class_b_sessions`, con migración
   de datos previa para dejar el histórico consistente (incluye reasignar/
   limpiar la fila #13 existente).
3. Reescribir `reagendarClasesPenalizadas()` para reciclar ambos orígenes
   (`no_show` y `cancelled`) in-place, eliminando el insert de filas nuevas.
4. Corregir `AdminFichaTecnicaComponent` para reflejar `ausente`/`cancelada`/
   `justificada` con la misma semántica visual que la grilla superior.
5. Sincronizar `indices/DATABASE.md`.

## Acceptance Criteria

- [x] AC0: Reagendar una clase `cancelled` o `no_show` desde el drawer nunca
  crea una fila nueva en `class_b_sessions`; siempre recicla la fila existente
  y el `class_number` de la matrícula se mantiene en el rango 1-12.
  (`admin-alumno-detalle.facade.ts` — verificado con `.spec.ts`.)
- [x] AC1: `class_b_sessions` tiene `CHECK (class_number BETWEEN 1 AND 12)` y
  `UNIQUE (enrollment_id, class_number)` aplicados sin error sobre los datos
  existentes. **Aplicada por el dueño el 2026-07-09** contra la BD real
  (`20260709120100`); confirmó que quedó todo bien, incluyendo la reparación
  de la fila #13 de Erling (reciclada dentro de una `cancelled` existente).
- [x] AC2: `mark_end_of_day_class_b_absences()` no revierte a `no_show` una
  fila que ya fue cancelada por `apply_class_b_absence_penalty()` en la misma
  corrida. **Migración `20260709120000` aplicada por el dueño el 2026-07-09.**
- [x] AC3: `apply_class_b_absence_penalty()` nunca cancela filas con
  `class_number` fuera de 1-12. **Cubierto por la misma migración aplicada.**
- [x] AC4: La migración recuperada queda versionada en
  `supabase/migrations/20260709120000_recover_class_b_absence_penalty_functions.sql`
  y referenciada en `indices/DATABASE.md`.
- [x] AC5: La tabla "Ficha Técnica" del detalle de alumno muestra visualmente
  si una clase está cancelada / inasistida (justificada o no), consistente
  con la grilla de progreso de la misma página.

## Cierre

Migraciones aplicadas por el dueño el 2026-07-09 (sin Docker/Supabase local
disponible en la máquina donde se implementó el fix, el dueño las corrió
directamente contra su entorno). Confirmó que no hubo problemas. Fix cerrado.

## Test de regresión

`src/app/core/facades/admin-alumno-detalle.facade.spec.ts` (reagendar recicla
ambos orígenes, nunca inserta), tests de `AdminFichaTecnicaComponent` si se
crean.

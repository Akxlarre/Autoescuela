# Fix: Código de autorización del libro de clases — editable + auditoría de cambios
> id: fix-098-m-codigo-autorizacion-libro-editable
> refs: ASG-b-051
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
[Heredado de ASG-b-051, a confirmar]: Anotación de la reunión con el cliente (2026-07-28):
"Código autorización libro de clases: dar opción de poder cambiar."

**Confirmado al reclamar esta asignación:** `class_book.sence_code` (label en UI "Código
Autorizado por SENCE") **ya es editable** — input + botón "Guardar" en
`libro-de-clases.component.ts` conectado a `LibroDeClasesFacade.saveClassBookFields()`. No hace
falta construir el campo editable, ya existe.

Confirmado con el owner (2026-08-01) los 2 puntos que la Asignación dejó abiertos:
1. ¿Se puede seguir editando si el libro ya está cerrado? → **Sí, sin restricción** — no se
   agrega bloqueo por `closed_by`.
2. ¿Debe quedar registro de quién lo cambió y cuándo? → **Sí** — es un código de autorización
   oficial verificable en fiscalizaciones MTT (RF-103); un cambio sin rastro es el tipo de cosa
   que después nadie puede explicar.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-b-051-codigo-autorizacion-libro-editable.md`.

## Alcance
- **No se toca** el campo editable en sí (ya funciona).
- Agregar `sence_code_updated_by` / `sence_code_updated_at` a `class_book` y poblarlos desde
  `saveClassBookFields()` cuando el código efectivamente cambia.
- Mostrar en la UI quién hizo el último cambio y cuándo, para que sea información visible en
  una fiscalización, no solo un dato enterrado en la BD.

## Cambio
- **`supabase/migrations/20260801130000_class_book_sence_code_audit.sql`**: agrega
  `sence_code_updated_by INT REFERENCES users(id)` y `sence_code_updated_at TIMESTAMPTZ` a
  `class_book`.
- **`src/app/core/models/ui/libro-de-clases.model.ts`**: `LibroCabecera` agrega
  `senceCodeUpdatedByName: string | null` y `senceCodeUpdatedAt: string | null`.
- **`src/app/core/facades/libro-de-clases.facade.ts`**:
  - `loadCabecera()` trae `sence_code_updated_at` y el nombre del usuario vía
    `sence_code_updater:users!class_book_sence_code_updated_by_fkey(first_names,
    paternal_last_name)`.
  - `saveClassBookFields()` solo actualiza `sence_code_updated_by`/`sence_code_updated_at`
    (a `auth.currentUser()?.dbId` / `now()`) cuando `senceCode` cambió respecto al valor
    previo — no se toca el rastro si solo cambió `horario`.
- **`src/app/features/libro-de-clases/libro-de-clases.component.ts`**: bajo el input de
  Código SENCE, muestra "Última modificación: {nombre} · {fecha}" cuando hay dato.
- **`indices/DATABASE.md`**: agrega las 2 columnas nuevas a la tabla `class_book`.

## Test de Regresión
- `src/app/core/facades/libro-de-clases.facade.spec.ts`: `saveClassBookFields` registra
  `sence_code_updated_by`/`sence_code_updated_at` cuando el código cambia, y NO los toca cuando
  solo cambia `horario`.

## Notas
- Mismo patrón de alias FK ya usado en el proyecto (ej. `evaluator:users!psych_evaluated_by(...)`
  en `admin-pre-inscritos.facade.ts`).
- Fuera de alcance (decisión explícita del owner 2026-08-01): bloquear edición cuando el libro
  está cerrado. Queda abierto para si en el futuro se retoma junto con ASG-b-037/ASG-b-050
  (misma familia de preguntas sobre modificar registros cerrados).
- Archivos involucrados: `src/app/core/facades/libro-de-clases.facade.ts`, feature de libro de
  clases.

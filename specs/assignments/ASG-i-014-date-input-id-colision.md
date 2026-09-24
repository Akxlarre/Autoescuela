# Asignación ASG-i-014 — DateInputComponent: colisión de ID rompe formularios con 2+ fechas

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-24
> **resulting_track:** fix-038-i-date-input-id-colision

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). `DateInputComponent`
(`src/app/shared/components/date-input/date-input.component.ts:50`) declara
`id = input<string>('date')` — el mismo id por defecto para toda instancia que no reciba
`[id]` explícito. Cuando una vista renderiza 2+ `<app-date-input>` sin id propio, el DOM
termina con `id="date"` duplicado (HTML inválido).

Repro confirmado en vivo: wizard de matrícula Profesional, campos "Fecha de nacimiento" +
"Fecha de obtención de licencia previa" — el segundo campo no retiene el valor seleccionado,
bloqueando el submit. También se confirmó colisión de accesibilidad (labels cruzados) en el
drawer "Registrar Pago" sobre el filtro de fecha de la lista de fondo en `admin/pagos`.

**Importante — alcance a re-verificar antes de implementar:** el track ya tiene un diagnóstico
completo en `specs/fixes/fix-038-i-date-input-id-colision/fix.md`, pero durante el mismo QA se
probó `admin-pagos.component.ts` (uno de los archivos listados como afectado) y **el síntoma
de pérdida de valor NO se reprodujo ahí** — ambos campos de fecha retuvieron su valor
correctamente. Antes de tocar los 5-6 archivos del alcance original, confirmar cuáles
realmente muestran el síntoma (no asumir que todos los `@for`/grep-match están rotos).

## Alcance sugerido

Ver `specs/fixes/fix-038-i-date-input-id-colision/fix.md` (Root Cause, Cambio, Test de
Regresión, Evidencia de Verificación) — el track ya está redactado, solo falta activarlo e
implementarlo.

## Archivos involucrados

- `src/app/shared/components/date-input/date-input.component.ts`
- `src/app/features/secretaria/matricula/steps/personal-data.component.html` (confirmado
  afectado)
- `admin-pagos.component.ts`, `secretaria-pagos.component.ts`,
  `reportes-contables-content.component.ts`, `admin-auditoria.component.ts`,
  `admin-pre-inscrito-drawer.component.ts` (alcance a confirmar, ver nota arriba)

## Notas para quien la reclame

El track `fix-038-i-date-input-id-colision` ya existe en estado `draft` con el diagnóstico
completo — no hace falta generarlo de nuevo con `/assign-claim`. Lee el archivo, corre
`/spec-activate fix-038-i-date-input-id-colision`, confirma el alcance real (ver nota de
re-verificación arriba) y continúa el flujo SDD normal desde ahí.

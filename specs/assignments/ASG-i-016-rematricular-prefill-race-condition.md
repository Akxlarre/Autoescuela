# Asignación ASG-i-016 — "Re-matricular" desde Ex-Alumnos no precarga datos (race condition)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). El flujo "Re-matricular"
de Ex-Alumnos promete precargar los datos personales del egresado en el wizard de nueva
matrícula, pero el wizard abre completamente vacío (Paso 1 con placeholders, sin RUT/nombre/
email/teléfono).

Causa raíz: `reEnroll()` (duplicado en 4 componentes) llama `router.navigate()` con `void`
(fire-and-forget, sin `await`) para agregar el query param `?rut=...` a la URL, y en la
siguiente línea abre el drawer del wizard inmediatamente. `SecretariaMatriculaComponent` lee
el RUT desde `route.snapshot.queryParamMap` en ese momento — como la navegación todavía no
resolvió, el snapshot no tiene el param y `prefillStep1()` nunca se dispara.

Repro confirmado en vivo: `admin/ex-alumnos`, alumno "Apellido61 Materno61 Alumno61" (RUT
25000061-8) — clic en "Re-matricular" muestra el diálogo de confirmación correcto, pero el
wizard abre vacío.

## Alcance sugerido

Ver `specs/fixes/fix-040-i-rematricular-prefill-race-condition/fix.md` (Root Cause, Cambio —
`await` en `router.navigate()` antes de abrir el drawer, Test de Regresión) — el track ya está
redactado.

## Archivos involucrados

- `admin-ex-alumnos.component.ts` (confirmado afectado — repro directo)
- `secretaria-ex-alumnos.component.ts`, `admin-ex-alumnos-profesional.component.ts`,
  `secretaria-ex-alumnos-profesional.component.ts` (mismo patrón duplicado, sin repro directo
  pero mismo código)

## Notas para quien la reclame

El track `fix-040-i-rematricular-prefill-race-condition` ya existe en estado `draft` con el
diagnóstico completo — no hace falta generarlo de nuevo. Lee el archivo, corre
`/spec-activate fix-040-i-rematricular-prefill-race-condition` y continúa el flujo SDD normal.
Es un fix mecánico de bajo riesgo (agregar `await`), buen candidato para quien quiera algo
rápido con impacto real.

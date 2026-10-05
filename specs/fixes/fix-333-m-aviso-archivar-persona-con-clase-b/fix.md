# Fix: Archivar desde la Base Profesional saca a la persona de Clase B sin avisar
> id: fix-333-m-aviso-archivar-persona-con-clase-b
> refs: fix-319-m-testing-clase-profesional-piloto (S15, G04, D8) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
Archivar desde la Base Profesional cambia `students.status` (la persona completa,
`admin-alumnos-profesional.facade.ts:202-218`), así que un alumno con Clase B también desaparece de
la Base B. La confirmación no lo menciona. Además, si falla, la excepción se relanza sin `catch`
(`admin-alumnos-profesional.component.ts:99-108,119-121`).

Decisión D8 (Matías, 2026-10-05): **se archiva la persona completa** (como hoy), pero la
confirmación avisa que también tiene Clase B y saldrá de esa base.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/core/facades/admin-alumnos-profesional.facade.ts`** — exponer si la persona tiene
  matrícula de Clase B vigente; capturar el error del archivado y exponerlo.
- **`src/app/features/admin/alumnos-profesional/admin-alumnos-profesional.component.ts`** (y el de
  secretaria) — texto de confirmación con el aviso de Clase B; toast de error en vez de excepción.
- Revisar la regla de `fix-277-m` (no archivar con clases futuras) también para este camino.

## Test de Regresión
- Spec del componente: alumno B + Profesional → la confirmación menciona Clase B; error del facade
  → toast, sin excepción sin capturar.

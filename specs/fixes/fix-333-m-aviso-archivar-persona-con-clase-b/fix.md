# Fix: Archivar desde la Base Profesional saca a la persona de Clase B sin avisar
> id: fix-333-m-aviso-archivar-persona-con-clase-b
> refs: fix-319-m-testing-clase-profesional-piloto (S15, G04, D8) · ASG-i-025
> status: done
> closed: 2026-10-05
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

**Verificado el 2026-10-05:**
- `admin-alumnos-profesional.facade.spec.ts` (5 casos nuevos: detecta Clase B vigente; Clase B
  completada no cuenta; `prepararArchivado` bloquea con clases B futuras usando el mismo mensaje de
  `fix-277-m`; deja archivar e informa `hasClaseB`; `archivarAlumno` con error → `false` + toast, sin
  lanzar) y `admin-alumnos-profesional.component.spec.ts` (nuevo, 4 casos). Corrida amplia (facade,
  utils, modal compartido, Base B admin/secretaria): 1098/1098. `tsc` y `lint:arch` sin errores.
- La regla de `fix-277-m` (no archivar con clases futuras) **no se aplicaba en este camino**: ahora
  `AdminAlumnosProfesionalFacade.prepararArchivado()` la aplica (cuenta `class_b_sessions`
  `scheduled` a futuro de todas las matrículas de la persona). Ruta cubierta por unit test; en pantalla
  no se probó (E2E-ProfConB no tiene clases B agendadas).
- `EliminarAlumnoModalComponent` (compartido con la Base B) ganó un input opcional `extraWarning`;
  sin él se ve igual que antes. Texto en `CLASE_B_ARCHIVE_WARNING`
  (`core/utils/archive-confirmation.utils.ts`).
- Visual (`secretaria2@test.com`): archivar `E2E-ProfConB` abre "Archivar alumno" con el aviso
  amarillo de Clase B; se canceló (la fila sigue en la lista).

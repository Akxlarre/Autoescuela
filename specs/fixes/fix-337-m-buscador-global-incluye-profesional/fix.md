# Fix: El buscador global encuentra a los alumnos de Clase Profesional
> id: fix-337-m-buscador-global-incluye-profesional
> refs: ASG-i-025 · fix-319-m (I10)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

`GlobalSearchFacade.alumnoResults` (admin/secretaria) busca solo en `AdminAlumnosFacade.alumnos()`
— la Base B. Un alumno que solo tiene matrícula Profesional no está ahí, así que el buscador
(Ctrl+K) no lo encuentra (I10, verificado el 2026-10-06 con E2E-ProfA2). Los que tienen las dos
(E2E-ProfConB) sí aparecen, por su fila de la Base B.

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **I10:** buscar un alumno que solo es Profesional (nombre o RUT) lo muestra en "Alumnos
  encontrados"; "Ver Ficha" abre su ficha Profesional. Sus acciones rápidas no ofrecen "Agendar
  Clase" (la agenda es de Clase B).
- Un alumno con Clase B y Profesional sale **una sola vez** (el resultado de la Base B, como hoy);
  un alumno con 2 matrículas Profesional también sale una vez.

## Cambio

- **`core/facades/admin-alumnos-profesional.facade.ts`**: `loadForSearch()` — carga la lista
  **sin** suscribir Realtime (el buscador no tiene ciclo de vida para cerrarlo,
  `swr-pattern.md`); no hace nada si ya hay datos de la sede vigente.
- **`core/facades/global-search.facade.ts`**:
  - `loadBusinessData()` también llama `loadForSearch()` (admin/secretaria).
  - `alumnoResults` suma las filas Profesional cuyo alumno no está en la Base B, una por persona;
    las ignora si la Base Profesional está en la Papelera (serían archivados).
  - `buildAlumnoQuickActions(..., { professional: true })` omite "Agendar Clase".

## Test de Regresión

- `global-search.facade.spec.ts > alumnos de Clase Profesional (fix-337-m)` ✓
- `admin-alumnos-profesional.facade.spec.ts > loadForSearch (fix-337-m)` ✓
- Navegador: Ctrl+K "E2E-ProfA2" → aparece → Ver Ficha → Profesional A2 #0092 ✓

### Verificación (2026-10-06)

- Tests: 7 nuevos en rojo antes del cambio, en verde después (84/84 en los 2 specs). Suite
  completa 3326 ✓. `tsc` sin errores. `lint:arch` 0 errores; **una advertencia nueva aceptada**:
  ARCH-10 "Demasiadas llamadas a inject() (6), recomendado 5" en `global-search.facade.ts` — la
  sexta es justamente la fuente que faltaba.
- Navegador, admin (Ctrl+K desde el dashboard): "E2E-ProfA2" → 1 resultado "· Activo", acciones
  Ver Ficha / Registrar Pago / Nueva Matrícula (sin Agendar Clase) → Ver Ficha →
  `/app/admin/alumnos/7333`, "PROFESIONAL A2". Por RUT "99776111" → el mismo. "E2E-ProfDoble"
  (2 matrículas Prof.) → 1 resultado. "E2E-ProfConB" (B + Prof.) → 1 resultado (el de la Base B,
  "Pendiente Pago"). "E2E-Prof" → los 3.
- secretariaB (sede 2): "E2E-ProfA2" → aparece → `/app/secretaria/alumnos/7333`.

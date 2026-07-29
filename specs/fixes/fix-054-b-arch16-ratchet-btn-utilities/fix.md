# Fix: Limpiar regresiones ARCH-16 (ratchet de disciplina DS sobre clases btn-*)
> id: fix-054-b-arch16-ratchet-btn-utilities
> refs: indices/FLOWS-QA-AUDIT.md (Fase 5.1, hueco detectado post-cierre del audit)
> status: done
> closed: 2026-07-22
> created: 2026-07-22

## Root Cause
El linter arquitectónico (`npm run lint:arch`) nunca se corrió durante la Auditoría QA de
Flujos de Usuario (100% behavioral/browser). Al correrlo por primera vez post-cierre se
encontraron 6 archivos donde PRs recientes agregaron utilities de tamaño/radio de Tailwind
(`text-sm`, `px-4`, `py-2`, `rounded-xl`, `rounded-full`, etc.) directamente sobre clases
`btn-*` del Design System — regla ARCH-16, que exige no mutar padding/font-size/radius de
una utilidad `btn-*` (solo layout: `w-`, `flex`, `gap-` está permitido).

## ACs Afectados
Ninguno — fix autónomo (no corrige un AC de spec, corrige deuda técnica detectada por lint:arch).

## Cambio
- **Archivos corregidos (3 de 6 declarados originalmente):**
  - `src/app/features/admin/alumno-detalle/inasistencias-drawer/admin-inasistencias-drawer.component.ts` — `btn-secondary text-sm px-4 py-2 cursor-pointer` → `btn-secondary` (baseline 0, violación aislada).
  - `src/app/shared/components/drawer/drawer.component.ts` — quitado solo `rounded-full` del botón de cerrar (`btn-ghost w-8 h-8 rounded-full` → `btn-ghost w-8 h-8`); `w-8 h-8` es layout, permitido.
  - `src/app/shared/components/registrar-gasto-fijo-drawer/registrar-gasto-fijo-drawer.component.ts` — quitado `rounded-xl text-sm` (los únicos tokens que el linter señaló con la flecha `→`), conservando `font-bold` y el resto de layout.
- **Archivos DEFERIDOS, fuera de este fix (3 de 6):** `asistencia-clase-b-content.component.ts`, `certificacion-clase-b-content.component.ts`, `certificacion-profesional-content.component.ts`. Al investigar se descubrió que el patrón `btn-primary/btn-secondary text-xs px-2.5 py-1` (o variantes) está replicado en **muchos más archivos** de los que este fix declaró (mismo patrón exacto encontrado también en partes NO tocadas de esos mismos 3 archivos, con cuota baseline ya alta: 6/10/10). `docs/BACKLOG-DEUDA-TECNICA.md` (línea 86-88) ya documenta esto como pendiente: falta un modificador componible `btn-sm` en el Design System (~120 instancias totales, decisión de diseño explícitamente diferida). Achicar estos botones a mano rompería el layout compacto (filas de alertas, matriz semanal) sin esa pieza del DS. Se decidió NO improvisar una solución ad-hoc y devolver la decisión al owner — ver `indices/FLOWS-QA-AUDIT.md` Fase 5.1 para el detalle.

## Test de Regresión
- `npm run lint:arch` → ARCH-16 ya no reporta los 3 archivos corregidos (confirmado). Los 3 deferidos siguen en warning (esperado, fuera de scope).
- `npm run test:ci` → 100% verde, sin regresiones (solo cambios de clases CSS, sin lógica tocada).

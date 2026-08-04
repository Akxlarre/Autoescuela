# Fix: resolver conflictos de merge de origin/main en PR #87
> id: fix-085-b-merge-conflictos-main
> refs: PR #87
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

PR #87 (rama `claude/tareas-pendientes-sfh2vp`, 7 commits de la tanda de auditoría del DS)
quedó en `mergeable: CONFLICTING` porque `main` avanzó 9 commits (trabajo de Ignacio y
Matías: precio Profesional A2, gate de certificación, 3 fixes cosméticos incluyendo H-018)
después de que esta rama se creó. Se resuelve mergeando `origin/main` hacia la rama de
feature (no rebase, para no reescribir el historial de un PR ya abierto).

## ACs Afectados

Ninguno — resolución mecánica de conflictos de merge, no nueva lógica de negocio.

## Archivos involucrados

- `specs/ASSIGNMENTS.md` — conflicto de tabla auto-generada (ambos lados tenían filas
  nuevas legítimas a partir del mismo punto). Resuelto conservando ambas tandas y
  re-generando con `npm run assignments:sync`.
- `src/app/features/alumno/dashboard/alumno-dashboard.component.ts` — conflicto real de
  contenido: mi lado traía `text-2xs` (token DS de fix-082-b), `main` traía el fix real de
  Ignacio (fix-010-i, H-018: "T"/"P" de una letra se confundía con el ícono de estado
  check/x). Resuelto combinando ambos — preserva el fix funcional de Ignacio, aplica el
  token DS encima (9px es uno de los tamaños ilegibles que fix-082-b eliminó).

## Cambio

- `specs/ASSIGNMENTS.md`: los dos conflictos eran el patrón que la propia doc del archivo
  advierte ("Multi-rama... puede quedar desactualizado"). En "Pendientes", ambos lados
  tenían filas de ítems que YA estaban completados desde el otro lado (mi rama había
  cerrado ASG-b-034/024; main había cerrado ASG-b-014/016/028) — se eliminaron las 5 filas
  de Pendientes en vez de elegir un lado. En "Completadas" (tabla auto-generada), ambos
  lados agregaban filas nuevas al mismo punto sin contradecirse — se concatenaron ambas
  tandas y se regeneró con `npm run assignments:sync` para que quedara canónico en vez de
  editado a mano.
- `alumno-dashboard.component.ts`: conflicto de contenido real, no solo de formato. Mi
  lado traía únicamente el token `text-2xs` (de fix-082-b, reemplazando `text-[9px]`
  arbitrario). `main` traía el fix real de Ignacio (`fix-010-i`, H-018): el label de una
  sola letra "T"/"P" se confundía visualmente con el ícono de estado check/x de al lado —
  cambiado a "Teoría"/"Práctica" completo. Se combinaron ambos: se conservó el texto
  completo de Ignacio (el fix funcional, no descartable) y se le aplicó el token `text-2xs`
  encima (9px es exactamente uno de los tamaños que fix-082-b declaró ilegible — no había
  razón para reintroducirlo).

## Test de Regresión

- `npm run lint:arch` → **exit 0**, 0 errores.
- `npx tsc --noEmit` → sin errores.
- `npm run test:ci` → **1671 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (137/138 archivos, 201s). Sube de 1651→1671 respecto al baseline previo al merge —
  los 20 tests nuevos vienen del trabajo de Ignacio/Matías incorporado desde `main`
  (fix-011-i, fix-013-i, fix-010-i). Sin regresiones.

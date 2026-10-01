# Fix: Buscar por RUT solo funciona si se escribe igual que está guardado
> id: fix-267-m-busqueda-rut-sin-importar-formato
> refs: fix-264-m (bug B2), fix-039-i
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`matchesSearchTokens()` (`core/utils/search-filter.utils.ts`) compara cada token contra los
campos como texto plano. El RUT se guarda con su puntuación (`12.345.678-9`), así que una
búsqueda sin puntos o sin guion no es substring de ningún campo y no encuentra nada.

Confirmado en navegador por `fix-264-m` (B2, caso E06 de `024a`): con el RUT `99.333.262-3`
guardado, fallan `99333262-3`, `993332623` y `99333262`.

Agravante: los datos no son uniformes. Los 200 alumnos del seed de `0008-i` están guardados sin
puntos (`25000200-9`) y los matriculados por la app, con puntos. Hoy cada grupo solo se encuentra
escribiendo el RUT en "su" formato.

## ACs Afectados

- `fix-039-i` (buscador tokenizado): se mantiene todo su comportamiento; se agrega:
- AC-1: un token formado solo por dígitos, puntos, guiones y `k` encuentra un campo aunque la
  puntuación no coincida: con puntos, sin puntos, sin guion o parcial, sin importar cómo esté
  guardado el RUT.
- AC-2: los tokens de texto (nombres, apellidos) se comparan igual que antes.

Aplica a todas las listas que usan `matchesSearchTokens`: Alumnos B, Ex-Alumnos B, Alumnos
Profesional, Ex-Alumnos Profesional y Relatores.

## Cambio

- **Archivo:** `src/app/core/utils/search-filter.utils.ts`
- **Qué cambia:** `matchesSearchTokens()` compara los tokens numéricos también contra los campos
  sin puntos ni guiones.

## Test de Regresión

- `src/app/core/utils/search-filter.utils.spec.ts > matchesSearchTokens > RUT — fix-267-m` ✓
  (15 tests)
- `e2e/alumnos-b-lista.spec.ts > E06` ✓ — sin marca `knownBug`: encuentra el RUT con puntos, sin
  puntos, sin guion y parcial.
- `e2e/alumnos-b-ficha.spec.ts > U03 · U04` ✓ — Ex-Alumnos encuentra el RUT sin puntos ni guion.

Verificado el 2026-10-01: `npx vitest run` 2826 tests en verde, `npm run lint:arch` 0 errores,
los dos specs E2E de Alumnos B con 49/49 esperados. Alumnos Profesional, Ex-Alumnos Profesional
y Relatores usan la misma función, pero no se probaron en navegador.

## Fuera de alcance

- La exportación de la lista (`export-students`) tiene su propio buscador en la edge function y
  sigue sin ignorar el formato: es parte del bug B1 de `fix-264-m`.
- Unificar el formato de los RUT guardados (el seed sin puntos, la app con puntos): con este fix
  deja de afectar a la búsqueda. `fix-042-i` sigue abierto para la precarga de re-matrícula.

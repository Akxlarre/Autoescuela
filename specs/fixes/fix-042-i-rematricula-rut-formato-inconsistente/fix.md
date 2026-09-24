# Fix: Prefill de re-matrícula no encuentra al alumno por diferencia de formato de RUT

> id: fix-042-i-rematricula-rut-formato-inconsistente
> refs: fix-040-i-rematricular-prefill-race-condition, fix-020-m-rematricula-ex-alumnos
> status: done
> created: 2026-09-23
> closed: 2026-09-23

## Root Cause

Encontrado mientras se verificaba `fix-040-i-rematricular-prefill-race-condition` (que
arregló la condición de carrera del botón "Re-matricular", confirmada en vivo: la URL ya
lleva el RUT antes de abrir el wizard). Con esa condición de carrera resuelta, el wizard
seguía abriendo con Paso 1 vacío — causa raíz distinta, ya fuera del alcance declarado de
`fix-040` ("no se toca la lógica de `prefillStep1()`").

`EnrollmentFacade.findUserByRut()` (`core/facades/enrollment.facade.ts:447-453`) busca así:

```ts
const { data: user, error } = await this.supabase.client
  .from('users')
  .select(...)
  .eq('rut', normalizeRutForStorage(rut))
  .maybeSingle();
```

`normalizeRutForStorage()` siempre devuelve el RUT **con puntos** (ej. `25.000.061-8`). Pero
al inspeccionar la respuesta real de la API para el alumno de prueba usado en el repro
(`admin/ex-alumnos`, "Apellido61 Materno61 Alumno61"), el RUT guardado en `users.rut` es
`25000061-8` — **sin puntos**. La comparación `.eq()` es un match exacto de string, así que
`25.000.061-8 !== 25000061-8` y la query devuelve `[]` (confirmado inspeccionando la
respuesta de red: `GET .../users?...&rut=eq.25.000.061-8` → `[]`), aunque el usuario sí
existe (confirmado vía la query de Ex-Alumnos, que sí trae `"rut": "25000061-8"` para ese
mismo `student_id`).

Repro: tanto por el botón "Re-matricular" (URL con `?rut=...`) como tecleando el mismo RUT a
mano en el Paso 1 y perdiendo el foco (mismo código, `onStep1RutBlur` → `prefillStep1` →
`findUserByRut`) — el resultado es igual en ambos casos, confirmando que el bug está en la
búsqueda, no en cómo llega el RUT.

Causa de fondo: no hay garantía de que `users.rut` esté siempre almacenado con el mismo
formato (con puntos) en toda la base — datos de seed/importados pueden quedar sin puntos —
así que una comparación de string exacta contra un único formato normalizado es frágil.

## ACs Afectados

Ninguno — fix autónomo, hallazgo de QA posterior a `fix-040`.

- AC-1: buscar por RUT (vía "Re-matricular" en Ex-Alumnos, o tecleándolo a mano en el Paso 1)
  encuentra al alumno sin importar si `users.rut` está guardado con o sin puntos.
- AC-2: el comportamiento existente para RUTs guardados con puntos (la mayoría de la base,
  generada por el propio flujo de matrícula que sí normaliza al guardar) no tiene regresión.

## Cambio

- **`core/facades/enrollment.facade.ts`** — `findUserByRut()`: en vez de comparar contra un
  único formato exacto (`.eq('rut', normalizeRutForStorage(rut))`), aceptar ambas variantes
  del mismo RUT (con puntos y sin puntos, mismo cuerpo+DV) usando `.or()` con las dos formas.
- Fuera de alcance: no se normaliza retroactivamente `users.rut` en la base de datos (eso
  sería una migración de datos, no un fix de código) ni se toca `findUserByEmail` (usa
  `ilike`, no tiene este problema).

## Test de Regresión

- `core/facades/enrollment.facade.spec.ts` — `findUserByRut`/`prefillFromStudent`: caso con
  RUT almacenado con puntos (ya cubierto) + caso nuevo con RUT almacenado sin puntos, ambos
  deben encontrar al usuario.
- `npm run test:ci` completo debe quedar verde.
- Manual: `/verify` — "Re-matricular" desde `admin/ex-alumnos` sobre un alumno seed (RUT sin
  puntos en BD) y confirmar que el Paso 1 llega precargado.

## Evidencia de Verificación

- **Cambio aplicado**: `findUserByRut()` ahora busca con `.or('rut.eq.<con-puntos>,rut.eq.<sin-puntos>')`
  en vez de `.eq()` contra un único formato normalizado.
- **`npx tsc --noEmit`**: sin errores.
- **Test nuevo** (`enrollment.facade.spec.ts`): "fix-042: encuentra al usuario aunque
  users.rut esté guardado sin puntos (datos de seed)" — verifica que se llama a `.or()` con
  ambas variantes del RUT y que el resultado se resuelve correctamente. ✅
- **`npm run test:ci`**: 200 archivos / 2618 tests en verde (+1 respecto a la corrida
  anterior, el test nuevo), 5 skipped pre-existentes, 0 regresiones.
- **Verificación manual en navegador** (admin, `admin/ex-alumnos`, alumno "Apellido61
  Materno61 Alumno61" RUT `25000061-8` sin puntos en BD — mismo repro original de
  `fix-040`): clic en "Re-matricular" → "Continuar" → el wizard abrió con **Paso 1
  completamente precargado**: RUT, Nombres ("Alumno61"), Apellido Paterno ("Apellido61"),
  Apellido Materno ("Materno61"), Fecha de nacimiento (18/08/1987), Email
  (alumno.seed61@test-data.local), Teléfono, Dirección — y el botón "Guardar y Continuar"
  quedó habilitado. Sin errores de consola. Cerrado sin guardar para no alterar datos de
  prueba. **AC-1/AC-2 de `fix-042` y AC-1/AC-2 de `fix-040` (ahora sí de punta a punta)
  confirmados.**

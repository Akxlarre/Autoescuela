# Acceptance 0009-i — Edge functions: exigir usuario real con rol de staff

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-10-01
> **Verifier:** verificación en vivo (scripts de solo lectura + Playwright) · validado por Ignacio (i)

---

## Resumen

- AC totales: 8 (AC1–AC5, AC-E1–AC-E3)
- AC cumplidos: 8
- AC parciales: 0
- AC fallidos: 0
- AC con evidencia: 8

**Veredicto final:** ✅ PASA

---

## Cómo se verificó

- 11 funciones desplegadas al proyecto de pruebas `skvekggejikzxhzsjmkz` el 2026-10-01
  (`supabase functions deploy`, tanda 1 = 3, tanda 2 = 8).
- Mismo script de solo lectura antes y después de cada despliegue, con 7 identidades: admin,
  secretaria, alumno, instructor, sin header, anon key como Bearer y token inválido.
- Las funciones que escriben datos (carnet y certificado B en modo real) solo se llamaron con
  identidades que deben ser rechazadas (el rechazo ocurre antes de cualquier escritura).
- UI con Playwright sobre `ng serve` (secretaria en la tanda 1, admin en la tanda 2).

## Evidencia — Tanda 1

| Quién llama | `generate-enrollment-sheet` antes → después | `export-students` antes → después | `generate-payroll-report` antes → después |
|---|---|---|---|
| admin | 200 (3416 B) → **200 (3416 B)** | 200 (205 filas) → **200 (205)** | 200 (34 filas) → **200 (34)** |
| secretaria | 200 (3416 B) → **200 (3416 B)** | 200 (205) → **200 (205)** | 200 (34) → **200 (34)** |
| alumno | 200 → **403** | 200 → **403** | 200 → **403** |
| instructor | 200 → **403** | 200 → **403** | 200 → **403** |
| sin header | **200** (ficha completa) → **401** | 401 → 401 | 401 → 401 |
| anon key | **200** → **401** | 401 → 401 | 401 → 401 |
| token inválido | **200** → **401** | 401 → 401 | 401 → 401 |

UI (secretaria): Excel de Base de Alumnos, Ficha PDF y Nómina Excel descargan; funciones 200; consola
sin errores (sin problemas de CORS).

## Evidencia — Tanda 2

| Quién llama | certificates-zip | audit-report | cash-closing | cash-history | payment-report | financial-report | license-pdf | certificate-b |
|---|---|---|---|---|---|---|---|---|
| admin | 200 (210186 B) = antes | **200 (443 filas)** = antes | 200 (25) = antes | 200 (2924 B) = antes | 200 (14015 B) = antes | 200 (48) = antes | **200** (matrícula de prueba) | preview/sample/real **200** |
| secretaria | 200 (210186 B) = antes | 200 → **403** | 200 (25) = antes | 200 (2928 B) = antes | 200 (14019 B) = antes | 200 (48) = antes | **200** (matrícula de prueba) | preview/sample/real **200** |
| alumno | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | **403** | **403** |
| instructor | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | 200 → **403** | **403** | **403** |
| sin header / anon / token inválido | 401 | 401 | 401 | 401 | 401 | 401 | **401** | **401** |

UI (admin): exportar Auditoría (`Auditoria_20261002.xlsx`) y Reportes Contables
(`ReporteContable_20261001_20261031.xlsx`) descargan, funciones 200, consola sin errores. Historial
de cuadraturas: la pantalla corta antes de llamar a la función ("No hay datos para exportar", según
los cierres cargados; el Excel es client-side) — sin relación con este cambio; la función quedó
verificada por API con el mismo PDF que antes. Archivos de prueba borrados.

---

## Verificación por AC

### AC1 — Admin y secretaria obtienen los documentos igual que hoy

- **Estado:** ✅ cumplido
- **Evidencia:** 9 de 11 funciones con resultados idénticos antes/después para admin y secretaria
  (salvo auditoría para secretaria, que es AC4). Certificado B verificado en modo `preview`/`sample`
  (200). UI: 5 exportaciones verificadas desde la app.
- **Carnet y certificado B en modo real** (autorizado por Ignacio el 2026-10-01, con datos de prueba
  que ya tenían su documento, para dejar la menor huella): `generate-student-license-pdf` sobre la
  matrícula 2869 (Alumno199 Apellido199, carnet de 6 clases ya existente) y `generate-certificate-b-pdf`
  `mode: 'real'` sobre la 2802 (Alumno132 Apellido132, certificado folio 2 ya existente), cada una con
  `secretaria2@test.com` y `admin@test.com`, sin `force`: **200** con `pdfUrl` en los 4 casos. Huella:
  certificados `class_b` 2 → 2 (sin folio nuevo); `certificate_issuance_log` del certificado 17: 1 → 3;
  el carnet se regeneró sobre el mismo archivo.

### AC2 — Sin sesión → 401

- **Estado:** ✅ cumplido
- **Evidencia:** las 11 funciones responden 401 sin header y con la anon key como Bearer.

### AC3 — Alumno o instructor → 403

- **Estado:** ✅ cumplido
- **Evidencia:** las 11 funciones responden 403 a `alumno@test.com` e `instructor@test.com` (antes:
  200 con todos los datos en las 9 de solo lectura).

### AC4 — Secretaria en `generate-audit-report` → 403; admin funciona

- **Estado:** ✅ cumplido
- **Evidencia:** secretaria 200 → 403; admin 200 (443 filas) igual que antes; UI admin descarga.

### AC5 — `generate-enrollment-sheet` con anon key → 401

- **Estado:** ✅ cumplido
- **Evidencia:** 200 (ficha completa, incluso sin header) → 401.

### AC-E1 — Usuario sin fila en `users` o rol desconocido → 403

- **Estado:** ✅ cumplido
- **Evidencia:** `staff-auth.test.ts` (usuario sin fila, rol desconocido, `secretaria` ≠ `secretary`).

### AC-E2 — Token vencido o inválido → 401

- **Estado:** ✅ cumplido
- **Evidencia:** token inválido → 401 en las 11 funciones; test del helper (sin usuario de Auth → 401).

### AC-E3 — El rol nunca viene del body

- **Estado:** ✅ cumplido
- **Evidencia:** `requireStaff(req, allowed)` solo lee el header `Authorization`; el rol sale de
  `users`/`roles` (ver `_shared/staff-auth.ts`).

---

## Out-of-scope respetado

- ❌ Validación de sede en el servidor — confirmado: no entró (una secretaria sigue pudiendo pedir otra sede).
- ❌ RLS y Storage por sede (`ASG-i-045`, `ASG-i-046`) — no entró.
- ❌ `export-special-services` y el resto de `ASG-i-041` — no entró (mismo helper, listo para reutilizar).

---

## Deuda técnica detectada

- En la tanda 2 el chequeo se agregó sin quitar el bloque `getUser()` existente: una llamada extra a
  Auth por petición en 7 funciones. Se puede limpiar más adelante (usar `access.userId`).
- `users.active` no se revisa (usuario desactivado pasa como staff) → `ASG-i-044`.
- `npm test` / Deno: los tests de `_shared/` no corren en CI; se ejecutan a mano con
  `npx deno test --no-lock --node-modules-dir=none ...`.

---

## Cambios en índices

- `indices/DATABASE.md` — tabla de Edge Functions: fila del helper `_shared/staff-auth.ts` con las 11
  funciones que lo usan y la regla de cada una.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests del helper pasando (11/11)
- [ ] `lint:arch` limpio (no aplica: sin cambios en `src/app`)
- [x] Sin deuda crítica abierta

**Cerrado por:** Ignacio (i)
**Fecha:** 2026-10-01

# Spec 0009-i — Edge functions: exigir usuario real con rol de staff

> **Status:** approved
> **Created:** 2026-10-01
> **Owner:** Ignacio (i)
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-042` (specs/assignments/ASG-i-042-edge-functions-sin-validar-rol-sede.md),
salida de la tanda de testing del piloto (`specs/testing-piloto/000-resumen.md`), con confirmación en
vivo de solo lectura el 2026-09-30 contra la BD del piloto.

**Persona afectada:** Admin y Secretaria (quienes generan los reportes y exportes); indirectamente
los alumnos, cuyos datos personales (RUT, teléfono, dirección) viajan en esos documentos.

**Problema que resuelve:**
[Heredado de ASG-i-042, confirmado en vivo]: varias edge functions usan la clave de servicio (se
saltan la RLS) y no verifican quién las llama más allá de que "haya un token". Se comprobó que:

- `generate-enrollment-sheet` **no llama a `auth.getUser()`**: entrega la ficha real de una matrícula
  incluso usando solo la llave pública del sitio (anon key), sin ningún usuario.
- `export-students`, `export-certificates-zip`, `generate-audit-report` y los reportes de nómina, cierre
  de caja, historial de caja, pagos y financiero solo verifican que exista un usuario autenticado:
  cualquier cuenta (incluido un alumno o un instructor) obtiene la lista completa de alumnos, el
  reporte de nómina o el log de auditoría. Con `branch_id` ajeno o `null` entregan también las otras sedes.
- **Confirmado en vivo el 2026-10-01** con sesiones de `alumno@test.com` e `instructor@test.com`: ambas
  obtienen `export-students` (205 alumnos de todas las sedes), `generate-audit-report` (267 filas),
  `generate-payroll-report`, `generate-financial-report` y el ZIP de `export-certificates-zip`.
  Con solo la llave pública esas funciones sí responden 401: únicamente `generate-enrollment-sheet` y
  `export-special-services` responden sin ningún usuario.
- Sin autenticación también responde `export-special-services` (ASG-i-041), y quedan por revisar
  `generate-student-license-pdf` y `generate-certificate-b-pdf` (escriben en BD/Storage; sin confirmar).

Si no se corrige, cualquier persona con la URL del proyecto puede descargar documentos con datos
personales de alumnos, y cualquier cuenta no-staff puede leer información contable de la escuela.

**Hipótesis de valor:**
Ninguna de estas funciones responde a una petición que no venga de un usuario con rol admin o
secretaria autenticado.

---

## 2. User Stories

- **US1**: Como admin o secretaria, quiero seguir exportando fichas, listas y reportes como hoy,
  para no perder mi trabajo diario.
- **US2**: Como responsable de la escuela, quiero que ninguna persona sin usuario, ni una cuenta de
  alumno o instructor, pueda descargar datos de alumnos ni información contable, para proteger los
  datos personales.
- **US3**: Como admin, quiero que el log de auditoría solo lo pueda descargar un admin, para que
  quede reservado igual que su pantalla.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

Aplican a las **11 funciones**: `export-students`, `generate-enrollment-sheet`,
`export-certificates-zip`, `generate-audit-report`, `generate-payroll-report`,
`generate-cash-closing-report`, `generate-cash-history-report`, `generate-payment-report`,
`generate-financial-report`, `generate-student-license-pdf`, `generate-certificate-b-pdf`.

- **AC1**: Given un admin o una secretaria con sesión, When usa cualquiera de las 11 funciones desde su
  pantalla, Then obtiene el documento igual que hoy.
- **AC2**: Given una petición sin sesión (sin header `Authorization`, o con la anon key como token),
  When llama a cualquiera de las 11 funciones, Then recibe **401** y no se entrega ningún dato.
- **AC3**: Given una sesión de alumno o de instructor, When llama a cualquiera de las 11 funciones,
  Then recibe **403** y no se entrega ningún dato.
- **AC4**: Given una sesión de secretaria, When llama a `generate-audit-report`, Then recibe **403**;
  con sesión de admin sigue funcionando.
- **AC5**: Given `generate-enrollment-sheet` (hoy responde 200 con la ficha usando solo la anon key),
  When se llama con la anon key sola, Then **401**. (`export-special-services`, el otro caso sin
  usuario, es de `ASG-i-041` y queda fuera de esta spec.)

### Edge cases obligatorios

- **AC-E1**: Given un usuario con sesión válida pero sin fila en `users` o con un rol desconocido,
  When llama a una función, Then **403** (no un 500).
- **AC-E2**: Given un token vencido o inválido, When llama a una función, Then **401**.
- **AC-E3**: Given que el rol se resuelve desde la BD a partir del token, When el body trae un campo de
  rol o de usuario, Then se ignora: el rol nunca viene del navegador.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ **Validar la sede en el servidor** (decisión del 2026-10-01, Ignacio): una secretaria que use
  herramientas del navegador podría pedir datos de otra sede, y se acepta. La sede se mantiene
  como indicador de interfaz; el selector de sede en gris para secretaria sin permiso multi-sede va
  en una asignación aparte, de interfaz.
- ❌ Políticas RLS y de Storage por sede (`ASG-i-045`, `ASG-i-046`).
- ❌ Funciones que no están en la tabla de `ASG-i-042` (las de módulos bloqueados por el piloto salvo
  que sigan accesibles) — se revisan en el inventario de `specs/testing-piloto/037-transversal-multisede-shell.md`.
- ❌ Funciones accesibles sin sesión que NO son de esta lista (`ASG-i-041`) — coordinar, mismo helper.

---

## 5. Dependencias

### Specs previas
- ninguna

### Capacidades del proyecto que se asumen existentes
- Patrón repetido a mano en `update-secretary`, `create-instructor`, `send-announcement`, etc.
  (`callerRole` leído de `users` + `roles(name)`) que el helper unifica.
- Las 9 funciones confirmadas se llaman solo desde pantallas de staff vía `supabase.client.functions.invoke`
  (el token del usuario viaja solo); ningún cron las llama, así que exigir usuario real es seguro.

### Capacidades nuevas requeridas
- Helper compartido en `supabase/functions/_shared/` que, a partir del token, resuelva el usuario real
  (`auth.getUser()`) y su rol, y rechace con 401/403 lo que no sea admin o secretaria.
- La llave pública (anon key) pasa `verify_jwt`: no basta "JWT válido", hay que verificar un usuario real.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno.
- RLS requerida: ninguna en esta spec (ver `ASG-i-045`).

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): ninguna a nivel visual. Las pantallas que exportan (Base de Alumnos,
  Contabilidad, Auditoría, Certificación) deben seguir funcionando igual para admin y secretaria;
  solo cambia que las funciones rechazan a quien no corresponde.
- Flujo principal (happy path): admin o secretaria exporta/genera un documento → funciona como hoy.
- Estados especiales: sin sesión o con la llave pública → 401; cuenta no-staff (alumno, instructor) → 403;
  `generate-audit-report` con secretaria → 403 (solo admin).

---

## 8. Métricas de éxito post-launch

- Repetir la confirmación en vivo del 2026-09-30 (`ASG-i-042`): ninguna de las funciones responde con
  datos a la llave pública ni a una cuenta no-staff.

---

## 9. Notas / decisiones abiertas

**Decisiones tomadas (2026-10-01, Ignacio):**
- Alcance **sin bloqueo por sede en el servidor**: solo usuario real con rol admin o secretaria.
- `generate-audit-report`: **solo admin**, igual que su pantalla (`/app/admin/auditoria`).

- `export-certificates-zip`: la llaman con `fetch` directo las dos pantallas de certificación
  (`certificacion-clase-b.facade.ts:358`, `certificacion-profesional.facade.ts:346`). Misma regla que el
  resto: admin y secretaria.
- `generate-student-license-pdf` y `generate-certificate-b-pdf` entran en la spec; sus llamadores son
  solo pantallas de staff (`admin-alumno-detalle.facade.ts:932`, `certificacion-clase-b.facade.ts`,
  `document-content-templates.facade.ts` para la vista previa de plantillas).
- **Orden:** tanda 1 = helper + `generate-enrollment-sheet`, `export-students`, `generate-payroll-report`;
  tanda 2 = las 8 restantes.
- Las funciones corren en Supabase: el cambio surte efecto al desplegarlas (`supabase functions deploy`).
- US y AC aprobados por Ignacio el 2026-10-01.

- Originado de Asignación ASG-i-042 (specs/assignments/ASG-i-042-edge-functions-sin-validar-rol-sede.md)

---

## Changelog

- 2026-10-01 — draft inicial por Ignacio (i), contexto cargado desde `ASG-i-042`

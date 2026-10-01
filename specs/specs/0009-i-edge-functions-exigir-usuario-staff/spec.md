# Spec 0009-i — Edge functions: exigir usuario real con rol de staff

> **Status:** draft
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
- Sin autenticación también responde `export-special-services` (ASG-i-041), y quedan por revisar
  `generate-student-license-pdf` y `generate-certificate-b-pdf` (escriben en BD/Storage; sin confirmar).

Si no se corrige, cualquier persona con la URL del proyecto puede descargar documentos con datos
personales de alumnos, y cualquier cuenta no-staff puede leer información contable de la escuela.

**Hipótesis de valor:**
Ninguna de estas funciones responde a una petición que no venga de un usuario con rol admin o
secretaria autenticado.

---

## 2. User Stories

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

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

**Pendientes:**
- [ ] Reglas de `export-certificates-zip` (no aparece llamada desde `src/`: confirmar cómo se invoca).
- [ ] ¿`generate-student-license-pdf` y `generate-certificate-b-pdf` entran en la primera tanda? Escriben en
      BD/Storage y su fallo sigue sin confirmar en vivo.
- [ ] Redactar US y AC (esta plantilla los deja vacíos a propósito).

- Originado de Asignación ASG-i-042 (specs/assignments/ASG-i-042-edge-functions-sin-validar-rol-sede.md)

---

## Changelog

- 2026-10-01 — draft inicial por Ignacio (i), contexto cargado desde `ASG-i-042`

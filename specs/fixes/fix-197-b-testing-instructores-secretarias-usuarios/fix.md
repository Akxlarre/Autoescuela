# Fix: Testing — Gestión de instructores, secretarias y usuarios
> id: fix-197-b-testing-instructores-secretarias-usuarios
> refs: ASG-i-034
> status: in_progress
> created: 2026-10-07

## Root Cause
[Heredado de ASG-i-034, a confirmar]: Alta y edición de personal (instructores, secretarias) y
usuarios en general: cuentas de Auth + tabla pública, invitación/activación, asignación de sede y
grants multi-sede. Un error acá deja personas sin acceso, con acceso de más, o con Auth y BD
desincronizados.

Track de **testing**: se ejecuta el checklist `specs/testing-piloto/034-instructores-secretarias-usuarios.md`
(sospechas S1–S22 + casos A–V). Regla de la tanda: **cada bug encontrado va a su propio
fix/hotfix**; acá solo se registra el resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-034). Criterios propios:

- **T1:** las sospechas S1–S22 quedan confirmadas (con su track), descartadas o como decisión.
- **T2:** ninguna prueba deja cambios en cuentas reales: lo que escribe se hace en transacciones
  revertidas, con valores idénticos (no-op) o sobre cuentas de prueba creadas y retiradas.
- **T3:** los casos marcados para Playwright quedan en `e2e/`.

## Cambio
- `e2e/*.spec.ts`, `supabase/tests/` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- Los tests nuevos de este track, contra el build de producción en `localhost:4200`.

## Sospechas — estado (2026-10-07)

| # | Resultado | Evidencia / track |
|---|---|---|
| S1 | ✅ Descartada | La cerró `fix-179-b` (`authorizeInstructorEdit`: `userId` = dueño del instructor, rol instructor, sede). Su test de BD sigue pasando en producción |
| S2 | ✅ Descartada | La cerró `fix-179-b` (RLS de `users` para secretaria + columnas protegidas `can_access_both_branches`/`supabase_uid`). Test `fix-179-b-users-secretaria.sql` verde en producción |
| S4 | ❌ Confirmada → **corregida en `fix-198-b`** (PR #214, desplegado) | `create-instructor` usaba el `branchId` del body; `activate-instructor-account` reenviaba de cualquier sede. En vivo, secretaria sede 1: crear en sede 2 → 403, reenviar de sede 2 → 403 |
| S5 | ❌ Confirmada → **corregida en `fix-199-b`** (PR #215, desplegado) | Los 3 `update-*` cambiaban Auth antes que `users` sin revertir. En vivo: correo de otro usuario → 409 y nada cambia (ni `users` ni Auth) |
| S6 (servidor) | ❌ Confirmada → **`fix-199-b`** | `includes('already registered')` no calzaba con "…already been registered": 409 → 500. Ahora `isEmailTakenError` |
| S6 (front) | ❌ Confirmada → **corregida en `fix-200-b`** (PR #217) | Crear instructor, crear/editar secretaria y reenviar invitación mostraban un texto genérico (DG-085); ahora un 4xx muestra el motivo real |
| S11 | ✅ Descartada | La cerró `fix-182-b` (secretaria sin clave inicial = RUT) |
| S3 | ❌ Confirmada → **corregida en `fix-201-b`** (PR #219) | El alta tomaba la sede solo del topbar y el campo lo veía solo el admin: la secretaria no podía crear, o usaba la sede guardada por otro usuario. E2E: sin el fix manda `branchId: 2`, con el fix `1` |
| S7 | ❌ Confirmada → **corregida en `fix-202-b`** (PR #220) | `license_status` congelado hasta editar. Estado calculado con la fecha; Agenda marca "· licencia vencida" y avisa (opción B del owner: se sigue ofreciendo) |
| S8 | ❌ Confirmada → **corregida en `hotfix-065-b`** (PR #221) | Práctico sin vehículo no tiene turnos en la Agenda; el alta ahora lo avisa |
| S9 | ❌ Confirmada → **corregida en `fix-205-b`** (PR #225) | Decisión del owner: avisar, no bloquear. Al marcar Inactivo: N clases futuras + vehículo asignado. E2E sin guardar |
| S10 | ❌ Confirmada → **corregida en `hotfix-067-b`** (PR #228) | Reenviar invitación usaba el correo del formulario (400 si se editó sin guardar); ahora el guardado + nota. E2E con la función interceptada |
| S12 | ❌ Confirmada → **corregida en `fix-204-b`** (PR #223, desplegado) | Decisión del owner: materno opcional en los 4 formularios y en `create/update-secretary` |
| S13 | ⚠️ Parcial → **`hotfix-068-b`** (PR #229) | "Se enviará confirmación al nuevo correo" era falso (la API de admin cambia directo): corregido. "No podrá iniciar sesión mientras esté inactiva" ya es cierto desde `fix-180-b` (ban en Auth) |
| S14 | ❌ Confirmada → **corregida en `fix-212-b`** (PR #235, migración aplicada) | Decisión del owner: mostrar el login real. `secretary_last_sign_in()` (solo admin, solo rol secretary); test SQL 5/5 en prod; la ficha muestra el login de hoy en vez de la fecha de creación |
| S15 | ❌ Confirmada → **corregida en `fix-207-b`** (PR #230) | Rango de "hoy" sin offset (Postgres lo leía en UTC) → `getChileDateTimeRange()`; botón "Ver clases activas" sin acción, quitado. Se respeta la decisión de `fix-072-m` (solo hoy) |
| S16 | ❌ Confirmada → **corregida en `fix-208-b`** (PR #231) | Horas acotadas a la lista (sede), error visible, mes actual al abrir, guard de orden. E2E |
| S17 | ❌ Confirmada → **corregida en `hotfix-066-b`** (PR #222) | Decisión del owner: se eliminó `/app/admin/usuarios` |
| S18 | ❌ Confirmada → **corregida en `fix-206-b`** (PR #226, migración aplicada) | Decisión del owner: auditar todo. Triggers en `instructors`, `vehicle_assignments`, `branch_payroll_config`; test SQL 7/7 en prod sin efectos |
| S19 | ❌ Confirmada → **corregida en `fix-209-b`** (PR #232) | Error de carga mostrado como "No hay…" + sin guard de orden en instructores/secretarias. E2E con 500 simulado |
| S20 | ❌ Confirmada → **corregida en `fix-211-b`** (PR #234) | Decisión del owner: número obligatorio en Crear y Editar; Editar sigue guardando con licencia vencida (si no, no se podría ni desactivar). Regla solo en el front: las edge functions aceptan el número vacío si se llaman directo |
| S21 | ✅ Descartada | El botón "Limpiar filtros" ya existe (`app-clear-filters-button`). "Sedes con personal = 1" con una sede elegida es coherente: todos los KPIs de la página se acotan a la sede del topbar |
| S22 | ❌ Confirmada → **corregida en `fix-210-b`** (PR #233) | Decimales (columna INTEGER → error crudo) y 0 habilitaban Guardar; ahora solo enteros > 0, con aviso |

**Hallazgo lateral:** `create-secretary` desplegado tiene código de `fix-182-b` que nunca llegó a
`main` (5 commits subidos a `fix/182-b-secretaria-invitacion` después de mergear el PR #184, entre
ellos `f68e63b2`: chequeo previo de RUT duplicado). Desplegarla desde `main` hoy lo borraría →
decisión del owner (recuperarlos en `main`). **Resuelto en PR #218.**

## Casos A–V — resultado (2026-10-07, build de producción, sin escribir datos)

**Automatizados y en verde** (`--workers=1`):
- `e2e/personal-checklist.spec.ts` (15/15): A01–A04, A07, B01–B05, C01, C02, C05, C10, C12, C13,
  C15, E01, E02, I01, I02, I06, K01, K03, K06, K11, L02, O01, O03, P01, P07, Q01, Q07.
- Ya cubiertos por los e2e de cada fix: C04/J02 (`instructores-alta`), D01/D02
  (`instructores-alta`), E08 (`instructores-licencia`), F01/F02 (`instructores-desactivar`), H03
  (`instructores-invitacion`), I13/I14 (`instructores-horas`), A08/B15/K06 con error
  (`personal-listas-error`), K12 (`secretarias-ultimo-acceso`), B07/J05 (`agenda-licencia-vencida`).
- Seguridad R01–R10: tests de BD/edge de fix-179-b, fix-180-b, fix-198-b (en verde en producción).

**Hallazgos nuevos:**
- **C05 (RUT):** el último carácter siempre se toma como DV y se **recalcula** (ASG-047). Escribir
  solo el cuerpo `11111111` deja `1.111.111-4`, porque se pierde un dígito. Un dígito mal tecleado
  también "pasa": el DV se ajusta al RUT equivocado y la validación módulo 11 deja de detectar el
  error. Decisión del owner pendiente.
- **V07/V08 (accesibilidad):** las pestañas del drawer Ajustes (Mi Perfil / Ajustes / Seguridad)
  son botones sin `role="tab"`/`aria-selected`. Menor.

**Decisiones del §5 ya tomadas hoy por el owner:** C04/J02 (avisar, hotfix-065-b), C11/L06/M07
(materno opcional, fix-204-b), E07/J05 (Agenda ofrece con aviso, fix-202-b; Editar permite vencida,
fix-211-b), F01 (avisar, fix-205-b), O01 (página eliminada, hotfix-066-b), Q08/T03/T04 (auditar,
fix-206-b). **Tomada por mí al corregir S22 (a confirmar):** Q05, tarifa 0 rechazada (fix-210-b).
**Ya resueltas antes:** L10 (fix-182-b: sin clave = RUT), R12 (fix-198-b: 403 a otra sede).

**Decisiones del owner del 2026-10-07 ("sí a todo" a las recomendaciones):**

| Caso | Decisión | Resultado |
|---|---|---|
| C05 | DV solo si falta; si está mal, error | `fix-213-b` (PR #236): `11111111` → `11.111.111-1`; un DV escrito nunca se reemplaza; guion permitido en Matrícula/inscripción |
| B06 | Filtro aparte "Vencidas" | `hotfix-069-b` (PR #237) |
| B13 | Sin buscador por ahora | Sin cambios |
| C14 | Vence hoy = vigente | Sin cambios (ya es así: `licenseStatusFromExpiry`) |
| C29 | Avisar si el correo no salió | `fix-214-b` (PR #242, `create-instructor` v21 desplegada) |
| D04/D05 | La secretaria multisede elige la sede | `fix-215-b` (PR #239): el campo estaba visible pero **bloqueado** (bug encontrado al verificarlo) |
| E13 | Avisar, como al desactivar | `hotfix-070-b` (PR #238) |
| F06 | La secretaria puede desactivar | Sin cambios |
| H06 | Sin invitaciones durante el piloto | `fix-214-b` (PR #242) |
| O04 | Botón de correo de restablecimiento en la ficha | `fix-217-b` (PR #241), solo secretarias (portal de instructores en piloto) |
| P04 | Pedir la contraseña actual | `fix-216-b` (PR #240) |
| Q05 | Tarifa 0 rechazada | Ya aplicado en `fix-210-b` |
| R11 | La secretaria no lee RUT/teléfono de otras sedes | **Spec `0049-b` (PR #246), migración aplicada.** Opción A: ve su sede y, de otras, solo personal, instructores "Ambas"/con clases de su sede y alumnos/pre-inscritos de su sede (303 → 199 usuarios para la secretaria de la sede 2). AC1–AC6 verificados; pantallas de la secretaria sin filas ni nombres perdidos |

**Quedan manuales** (crean cuentas reales, necesitan correo o dos sesiones a la vez): C03, C24,
C25, C28, E05, H02, H04, H07, L01, M02, M04, M05, N01, N02, P02, T01.

### Manuales — grupo 1 (2026-10-09, en vivo con la sesión de admin del owner, revertido)

Con Instructor2 (id 223, sede 1, ERDF21) y secretaria2 (id 33, sede 2). Foto antes/después por SQL:
todo quedó igual salvo el historial de vehículos de Instructor2 (asignación 40 cerrada hoy + 54
nueva, ambas ERDF21; SQL para dejarlo idéntico entregado al owner).

| Caso | Resultado |
|---|---|
| E10 quitar vehículo | ✅ Asignación 40 cerrada con fecha de hoy; ERDF21 aparece libre en el picker de un instructor nuevo de la sede 1 |
| E12 cambiar de sede | ✅ Sede 1 → 2: la secretaria de la sede 1 deja de verlo y la de la sede 2 lo ve. Sin aviso de clases futuras (no tiene: correcto) |
| T04/T03 auditoría de vehículo/sede | ⚠️ Sede: `users` UPDATE con `user_id` = admin. **Vehículo: `vehicle_assignments` UPDATE/INSERT con `user_id` NULL** ("Sistema"): `update-instructor` escribe asignaciones con `supabaseAdmin` (sin `x-audit-user-id`) |
| N07 grant en auditoría | ✅ "Acceso a ambas sedes: No -> Sí" (y vuelta) con el admin como autor |
| T02 antes/después | ✅ Pero la etiqueta sale **"Phone"**: falta `phone` en `audit_humanize_column()` |

**Hallazgos del grupo 1:**
1. `update-instructor` (y probablemente `create-instructor`) escribe `vehicle_assignments` sin el
   cliente de auditoría → cambios de vehículo sin autor.
2. El toast de éxito ("Instructor actualizado") queda encima del botón Guardar del drawer unos
   segundos: dos clics seguidos en Guardar cayeron en el toast y no guardaron (sin aviso).
3. `phone` sin traducir en el diccionario de auditoría.

**Hallazgos del grupo 1 — resueltos (2026-10-09):** 1 y 3 en `fix-218-b` (PR #249 + #251: autor del
cambio de vehículo en la auditoría, 48 columnas en español; deploy de `update-instructor` y
`create-instructor` v23, que además repuso fix-214-b en producción); 2 en `hotfix-071-b` (PR #250:
el toast ya no tapa "Guardar" del drawer).

### Manuales — grupo 2 (2026-10-10, dos sesiones a la vez con `e2e/personal-dos-sesiones.spec.ts`)
Admin edita a secretaria2 con clics reales desde Admin → Secretarias; ella tiene su portal abierto.
Todo revertido (sede 2, activa, sin grant, sin ban).

| Caso | Resultado |
|---|---|
| N01 | ✅ Al otorgar "Todas las sedes" le aparece el selector de sede sin recargar (AC-E3) |
| N02 | ✅ Al revocar, el selector desaparece y vuelve a su sede sin recargar |
| M04 | ✅ Al cambiarle la sede, su pantalla pasa a la sede nueva sin recargar (y de vuelta) |
| M05 | ❌→✅ Desactivada seguía dentro, viendo todas las listas vacías sin aviso. **`fix-219-b` (PR #253, migración aplicada):** ahora ve "Tu cuenta fue desactivada. Contacta al administrador." y queda en el login |

**Quedan manuales:** C03, C24, C25, C28, E05, H02, H04, H07, L01, M02, P02, T01.

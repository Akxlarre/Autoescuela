# Testing del piloto — Resumen consolidado

> **Tanda:** testing profundo del piloto Admin/Secretaria (2026-09-29) · **Estado:** borrador
> **Asignaciones:** `ASG-i-021` (montar Playwright) + `ASG-i-022` … `ASG-i-037` (una por módulo).
> Ver `specs/ASSIGNMENTS.md` → "Tanda testing profundo del piloto por módulo".

## Qué hay en esta carpeta

Un checklist por módulo, armado leyendo todo el código de cada uno. Cada archivo tiene:
§1 sospechas de bug con evidencia `archivo:línea`, §2 datos de prueba a preparar, §3 casos
(con columna para anotar ✅/❌), §4 casos con pasos numerados, §5 decisiones de negocio pendientes.

**Las sospechas NO están confirmadas en navegador** — salen de leer el código. Las marcadas
"verificada" abajo se revisaron por segunda vez en el código, pero tampoco se probaron en vivo.

| Archivo | ASG | Módulo | Tipo | Casos | Con pasos | 🔴 | 🟠 | 🟡 |
|---|---|---|---|---|---|---|---|---|
| `022-autenticacion-sesion-fase-piloto.md` | 022 | Autenticación, sesión, fase piloto | Integración/E2E | ~173 | 20 | 3 | 5 | 11 |
| `023-matricula-presencial.md` | 023 | Matrícula presencial | E2E | ~180 | 28 | 2 | 12 | 10 |
| `024a-base-alumnos-b.md` | 024 | Base de Alumnos B (lista) | Integración | ~150 | 23 | 2 | 3 | 7 |
| `024b-ficha-ex-alumnos.md` | 024 | Ficha del alumno y Ex-Alumnos | Integración | ~205 | 24 | 2 | 8 | 10 |
| `025-clase-profesional-piloto.md` | 025 | Clase Profesional visible | Integración | ~181 | 25 | 2 | 6 | 14 |
| `026-agenda-triple-match.md` | 026 | Agenda y Triple Match | E2E | ~173 | 22 | 1 | 13 | 7 |
| `027-asistencia-clase-b.md` | 027 | Asistencia B y penalización | Integración | ~150 | 22 | 5 | 8 | 5 |
| `028-pagos-descuentos.md` | 028 | Pagos y descuentos | E2E | ~180 | 16 | 3 | 10 | 7 |
| `029-contabilidad.md` | 029 | Contabilidad | Integración | ~169 | 21 | 5 | 8 | 7 |
| `030-dashboards.md` | 030 | Dashboards | Integración | ~170 | 29 | 1 | 5 | 14 |
| `031-servicios-especiales.md` | 031 | Servicios especiales | Funcional | ~149 | 26 | 2 | 7 | 7 |
| `032-flota-mantenimientos.md` | 032 | Flota y mantenimientos | Funcional | ~211 | 26 | 0 | 6 | 14 |
| `033-documentos-certificacion.md` | 033 | Documentos y certificación B | Funcional | ~239 | 36 | 4 | 9 | 13 |
| `034-instructores-secretarias-usuarios.md` | 034 | Personal y usuarios | Integración | ~220 | 29 | 2 | 6 | 14 |
| `035-tareas-notificaciones-comunicados.md` | 035 | Tareas, notificaciones, comunicados | Integración | ~184 | 22 | 1 | 7 | 14 |
| `036-auditoria-configuracion-web.md` | 036 | Auditoría y Configuración web | Funcional | ~201 | 24 | 6 | 9 | 7 |
| `037-transversal-multisede-shell.md` | 037 | Transversal: sedes, Realtime, shell, visual | E2E | ~157 | 21 | 3 | 5 | 7 |
| **Total** | | | | **~3.100** | **~415** | **44** | **127** | **168** |

Algunas 🔴 aparecen en dos archivos (el mismo bug visto desde dos módulos); sin duplicados son
unas 40.

---

## Las sospechas 🔴, agrupadas

Referencia: `archivo · S#`. Detalle y evidencia en cada archivo.

### 1. Datos accesibles sin sesión o de otra sede (seguridad) — prioridad máxima

**Edge functions que usan la clave de servicio sin validar rol ni sede** (o con `verify_jwt = false`):

| Función | Qué expone / permite | Ref. |
|---|---|---|
| `generate-contract-pdf` | Contrato con RUT y dirección, **sin sesión** | 023 · S1 |
| `generate-class-book-pdf` | Libro de clases con RUN y teléfono, **sin sesión** | 025 · S1 |
| `auto-create-next-promotions` | Crea promociones, **sin sesión** | 025 · S2 |
| `generate-certificate-professional-pdf` | Genera certificados y escribe en BD, **sin sesión** | 037 · S3 |
| `export-special-services` | Ventas de todas las sedes, **sin validar sesión** | 031 · S1 |
| `export-students` | RUT/email/teléfono de todas las sedes (verificada) | 024a · S1 |
| `generate-enrollment-sheet` | Ficha de cualquier matrícula (verificada) | 024a · S2 |
| `generate-student-license-pdf` | Carnet con nombre, RUT y foto (verificada) | 024b · S2 |
| `generate-certificate-b-pdf` | Certificado Clase B de cualquier matrícula | 033 · S3 |
| `export-certificates-zip` | Certificados de todas las sedes, incl. Profesional | 033 · S4 |
| 4 funciones de reportes contables (incl. nómina) | Caja, historial, reporte contable y nómina de otras sedes | 029 · S5 |
| `generate-audit-report` | Log de auditoría completo | 036 · S1 |
| `update-student-profile` | Secretaria cambia el email de un admin → toma de cuenta (verificada) | 024b · S1 |
| `update-instructor` | Mismo patrón que la anterior | 034 · S1 |

**RLS y Storage que filtran solo por rol, no por sede:**

| Qué | Ref. |
|---|---|
| `class_b_sessions`: cualquier secretaria modifica/borra clases de cualquier sede (verificada; el archivo la marca 🟠, se sube a este grupo) | 026 · S12 |
| `students`: INSERT/UPDATE/DELETE de cualquier sede | 037 · S2 |
| `users`: la secretaria se da el grant multi-sede o cambia `role_id` desde la consola | 034 · S2 |
| Storage `documents`: listar, leer y **sobrescribir** documentos de cualquier sede (cédulas, contratos) | 033 · S1, S2 |
| Storage `website-public`: subida anónima y sobrescritura entre sedes | 036 · S15 |
| RPC `confirm_enrollment_with_payment`: cualquier logueado confirma cualquier borrador con cualquier monto (verificada) | 037 · S1 |
| RPC de cierre nocturno y penalización ejecutables por cualquier logueado | 027 · S2 |
| `audit_log`: autoría falsificable por header e INSERT abierto a cualquier logueado | 036 · S2, S3 |
| XSS almacenado en la landing pública (`innerHTML` con texto editable) (verificada) | 036 · S14 |

### 2. Cuentas y acceso

| Qué | Ref. |
|---|---|
| `/login` muestra las credenciales de prueba y su contraseña (verificada) | 022 · S3 |
| Un usuario desactivado sigue entrando | 022 · S2 |
| Recuperar contraseña no pide la clave nueva (entra directo) (verificada en parte) | 022 · S1 |

### 3. Dinero

| Qué | Ref. |
|---|---|
| Eliminar un ingreso en Cuadratura (secretaria) corrompe el saldo del alumno y avisa éxito | 028 · S3 · 029 · S1 |
| Eliminar un anticipo (secretaria) no hace nada y avisa éxito | 029 · S2 |
| "Caja cerrada" aunque el cierre falle | 029 · S3 |
| Una caja cerrada se puede reabrir o sobrescribir | 029 · S4 |
| Sobrepago posible con 2 pagos simultáneos | 028 · S1 |
| Doble pago con Enter dos veces | 028 · S2 |
| Ventas de servicios especiales no llegan a Reportes ni al Dashboard | 031 · S2 |
| Matrícula queda activa aunque el mensaje dice "no se confirmó" | 023 · S2 |

### 4. Clases en un piloto sin portal Instructor

| Qué | Ref. |
|---|---|
| **Nadie puede poner la nota de evaluación → nadie llega a 12/12, nadie se certifica ni egresa** (verificada) | 027 · S5 |
| Clase no iniciada antes del cron (~22:00) queda `no_show`; 2 seguidas cancelan la agenda | 026 · S1 |
| Trigger antiguo posiblemente activo: 2 faltas cancelan la matrícula entera | 027 · S1 |
| "Borrar horarios" cancela todas las clases (incluidas futuras) de N alumnos sin confirmación | 027 · S4 · 030 · S1 |
| "Reactivar" revive clases canceladas de cualquier fecha | 027 · S3 |

### 5. Operación

| Qué | Ref. |
|---|---|
| Un comunicado programado a más de 200 alumnos nunca termina | 035 · S1 |
| Acciones críticas sin auditar (precios, caja, gastos, descuentos, asistencia) | 036 · S4 |

---

## Orden recomendado

**Fase 0 — Confirmar las 🔴 de seguridad (grupo 1 y 2).** Casi todas se confirman en minutos con
"Copy as fetch" desde DevTools con la sesión de una secretaria (cada archivo trae los pasos en
§4). Las que se confirmen van **directo a fix P0**, sin esperar al resto del testing: no conviene
entregar el piloto con ellas.

**Fase 1 — Decidir el hueco de la nota de evaluación (grupo 4).** Sin nota no hay certificación
ni egreso en el piloto. Decisión de negocio: habilitar la nota desde Asistencia B para
admin/secretaria, o desbloquear esa parte del portal Instructor. También definir la hora y el
comportamiento del cron `no_show` cuando la secretaria opera sola.

**Fase 2 — Resolver las decisiones de negocio (§5 de cada archivo).** Sin eso, muchos casos no se
pueden marcar ✅ ni ❌.

**Fase 3 — Preparar datos y cuentas (§2 de cada archivo).** Muchos casos requieren datos
especiales (fechas pasadas, documentos vencidos, alumnos con 2 matrículas, 12/12 prácticas).
Conviene extender el seed de spec `0008-i` una sola vez para todos los módulos.

**Fase 4 — Ejecutar**, en este orden:
1. Módulos P0: 022, 023, 024a/b, 026, 028, 029, 037.
2. Módulos P1: 025, 027, 030, 032, 033, 034, 035.
3. Módulos P2: 031, 036.
4. 029 (Contabilidad) y 030 (Dashboards) al final dentro de su grupo: validan los datos que
   generaron los demás.

**En paralelo — Playwright (`ASG-i-021`).** El test de mayor valor es el barrido de rutas de
`037` §3-B (todas las rutas × roles × anchos × temas). Después, los casos marcados **Auto ✓** de
cada archivo, empezando por los de seguridad.

## Patrones que se repiten en todo el sistema

Sirven para arreglar de raíz en vez de caso por caso (inventario completo en `037` §1):

- **Edge functions con clave de servicio que confían en el `branch_id` o el id del body** (~19).
- **RLS que filtra por rol pero no por sede** (~13 grupos de tablas).
- **Canales Realtime que escuchan tablas no publicadas** (6 canales muertos).
- **Fechas de negocio calculadas en UTC** (`toISOString().slice(0,10)`) → lo hecho después de las
  ~21:00 cae en el día siguiente (~19 grupos).
- **Llamadas a Supabase sin revisar `error`** que muestran toast de éxito igual (~13 grupos).

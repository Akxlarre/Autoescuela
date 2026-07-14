# Mapa de Flujos — Portal Secretaria

> Objetivo: guion de referencia para la reunión con la secretaria y para probar el software
> con ella en vivo. Cada flujo indica la ruta, los pasos que ella ejecutaría en su día a día
> y qué verificar durante la prueba.
>
> Fuente: análisis del código real (`app.routes.ts`, `menu-config.service.ts`, componentes de
> `features/secretaria/`) al 2026-07-14. Complementa la auditoría técnica
> `indices/SECRETARIA-AUDIT.md` (2026-06-24) — varios stubs de esa auditoría ya fueron
> implementados (dashboard, pagos, libro de clases, calificaciones).

---

## 0. Cómo entra la secretaria al sistema

1. `/login` → credenciales → si es primer login, `firstLoginGuard` la manda a
   `/force-password-change`.
2. `roleRedirectGuard` la enruta a su portal: **`/app/secretaria/dashboard`**.
3. **Anclaje de sede:** la secretaria está anclada a su sede (`currentUser().branchId`).
   No ve el selector de sedes del topbar salvo que tenga **grant multi-sede** (RF-013 / spec 0017).
4. **Grant profesional:** el grupo "Academia Profesional" del menú solo aparece si su sede
   efectiva tiene `hasProfessional = true` (guard `professionalBranchGuard`). Sin grant,
   el sidebar muestra: *"Su cuenta de secretaria no está autorizada para operar en múltiples
   sedes ni conmutar al portal de Clase Profesional."*

**Probar en reunión:** login → ¿cae en el dashboard correcto? → ¿ve solo su sede? →
¿le aparece (o no) el bloque de Clase Profesional según lo esperado para su sede?

---

## 1. Menú completo que ve la secretaria

| Grupo | Ítem | Ruta | Estado |
|---|---|---|---|
| **Operaciones Diarias** | Inicio | `/app/secretaria/dashboard` | ✅ Real |
| | Comunicación | `/app/secretaria/observaciones` | ✅ Real (tareas) |
| | Nueva Matrícula | `/app/secretaria/matricula` | ✅ Real (wizard) |
| **Academia Clase B** | Agenda | `/app/secretaria/agenda` | ✅ Real |
| | Base Alumnos B | `/app/secretaria/alumnos` | ✅ Real |
| | Asistencia B | `/app/secretaria/asistencia` | ✅ Real |
| | Certificaciones B | `/app/secretaria/certificados` | ✅ Real |
| | Ex-Alumnos B | `/app/secretaria/ex-alumnos` | ✅ Real |
| **Academia Profesional** ⚿ | Base Alumnos Prof. | `/app/secretaria/profesional/alumnos` | ✅ Real |
| | Promociones | `/app/secretaria/profesional/promociones` | ✅ Real (re-export admin) |
| | Relatores | `/app/secretaria/profesional/relatores` | ✅ Real (re-export admin) |
| | Asistencia Prof. | `/app/secretaria/profesional/asistencia` | ✅ Real (re-export admin) |
| | Calificaciones | `/app/secretaria/profesional/notas` | ✅ Real |
| | Libro de Clases | `/app/secretaria/libro-de-clases` | ✅ Real |
| | Certificados Prof. | `/app/secretaria/profesional/certificados` | ✅ Real |
| | Archivo | `/app/secretaria/profesional/archivo` | ✅ Real (re-export admin) |
| | Ex-Alumnos Prof. | `/app/secretaria/ex-alumnos-profesional` | ✅ Real |
| **Finanzas y Caja** | Caja Diaria | `/app/secretaria/contabilidad/cuadratura` | ✅ Real |
| | Venta Servicios Especiales | `/app/secretaria/servicios-especiales` | ✅ Real |
| | Pagos | `/app/secretaria/pagos` | ✅ Real |
| | Reportes Contables | `/app/secretaria/contabilidad/reportes` | ✅ Real |
| | Liquidaciones | `/app/secretaria/contabilidad/liquidaciones` | ✅ Real |
| | Comunicaciones | `/app/secretaria/comunicaciones` | ⚠️ "Próximamente" |
| **Recursos y Logística** | Instructores | `/app/secretaria/instructores` | ✅ Real |
| | DMS Documentos | `/app/secretaria/documentos` | ✅ Real |

⚿ = grupo condicionado al grant profesional de la sede (`requiresProfessional`).

**Fuera del menú pero alcanzables por URL** (no mostrar en la demo, tenerlos presentes):
`/asistencia/matriz` ("Próximamente"), `/asistencia/profesional`,
`/profesional/pre-inscritos`, `/notificaciones` (stub PLANO),
`/contabilidad/historial-cuadraturas` (real, se llega desde Caja Diaria),
`/configuracion-web` (reúsa la página de admin — revisar si corresponde a su rol).

---

## 2. Flujos operativos (guion de prueba)

### Flujo A — Inicio del día: Dashboard
**Ruta:** `/app/secretaria/dashboard` (landing tras login)

Qué ve: hero con resumen del día (clases programadas, alertas urgentes), panel de
**clases en vivo** (`app-live-classes-panel`), **acciones rápidas** y **alertas** de la escuela.

Pasos con ella:
1. Revisar que los números del hero coincidan con la realidad de SU sede.
2. Click en una clase en vivo → se abre el drawer de detalle del slot de agenda.
3. Probar cada acción rápida → ¿la lleva a donde ella espera?
4. Revisar alertas: ¿son accionables? ¿corresponden a su sede?

### Flujo B — Matricular un alumno nuevo (flujo estrella)
**Ruta:** `/app/secretaria/matricula` (guard `enrollmentDraftGuard`)

Wizard de 6 pasos: **Datos Personales → Asignación → Documentos → Contrato → Pago →
Confirmación**. Incluye lista de **borradores** (draft-list) para retomar matrículas a medias.

Pasos con ella:
1. Iniciar matrícula nueva con datos reales de un caso típico (RUT, curso, sede).
2. En Asignación: elegir curso/promoción — validar que los precios sean los vigentes.
3. Subir un documento (cédula) en el paso Documentos.
4. Generar el contrato — ¿el texto y los montos son los que ella usa hoy en papel?
5. Registrar el pago inicial (efectivo / transferencia / etc.).
6. Confirmar → verificar que el alumno aparece en **Base Alumnos B** y el pago en **Caja Diaria**.
7. Abandonar una matrícula a mitad de camino → cerrar sesión → volver → ¿aparece el borrador
   para retomarla?

### Flujo C — Agendar y gestionar clases
**Ruta:** `/app/secretaria/agenda`

Vista semanal (`app-agenda-semanal`) con slots por instructor. Click en slot → drawer de detalle.

Pasos con ella:
1. Buscar la disponibilidad de un instructor esta semana.
2. Agendar una clase práctica para un alumno.
3. Abrir el detalle de una clase existente → ¿puede reagendar/cancelar como lo hace hoy?
4. Verificar (Realtime): si otro usuario agenda a la vez, ¿se refleja sin recargar?

### Flujo D — Consultar y gestionar alumnos (Clase B)
**Rutas:** `/app/secretaria/alumnos` → detalle `/app/secretaria/alumnos/:id`

Pasos con ella:
1. Buscar un alumno por nombre/RUT.
2. Abrir su ficha: progreso, clases, pagos, documentos.
3. Ir a sus documentos (`/documentos/alumnos/:id`).
4. Probar la baja/eliminación (modal `eliminar-alumno`) con un alumno de prueba.
5. **Verificar aislamiento:** ¿aparecen solo alumnos de SU sede? (punto crítico de la auditoría).

### Flujo E — Pasar asistencia (Clase B)
**Ruta:** `/app/secretaria/asistencia`

Reúsa `app-asistencia-clase-b-content` (mismo motor que admin, anclado a su sede via
`setBranchFilter`). Marcar presentes/ausentes de una clase teórica del día.

### Flujo F — Certificaciones (Clase B)
**Ruta:** `/app/secretaria/certificados`

Incluye acción **"Generar pendientes"** (`generarPendientes()`).
1. Revisar qué alumnos están listos para certificar.
2. Generar certificados pendientes → verificar el documento resultante.

### Flujo G — Cobrar: Pagos y deudores
**Ruta:** `/app/secretaria/pagos`

Página con lista de pagos + panel de **deudores** paginado. Acciones: abrir detalle de pago
(drawer) y **Registrar Pago** (drawer, reusa el de admin).

Pasos con ella:
1. Identificar a los deudores del mes.
2. Registrar un pago de cuota de un alumno existente.
3. Abrir el detalle de un pago histórico.
4. Confirmar que el pago recién registrado impacta la **Caja Diaria**.

### Flujo H — Cerrar la caja del día
**Rutas:** `/app/secretaria/contabilidad/cuadratura` → historial en
`/app/secretaria/contabilidad/historial-cuadraturas`

Reúsa `app-cuadratura-content` + modal de **egresos**.
1. Revisar los ingresos del día (deben cuadrar con lo cobrado en Flujos B y G).
2. Registrar un egreso (ej: compra de insumos).
3. Ejecutar la cuadratura/cierre del día.
4. Ver el cierre en el historial de cuadraturas.

### Flujo I — Vender un servicio especial
**Ruta:** `/app/secretaria/servicios-especiales`

Acciones: **Registrar venta** (drawer) y **Nuevo servicio** (drawer).
1. Vender un servicio (ej: clase extra, trámite) a un cliente.
2. Verificar que la venta aparece en Caja Diaria.

### Flujo J — Comunicación interna (tareas)
**Ruta:** `/app/secretaria/observaciones` (ítem "Comunicación" del menú)

Sistema de tareas (spec 0029): KPIs de tareas, **crear tarea** (drawer), detalle de tarea
(modal), pestañas de tareas recibidas/enviadas.
1. Crear una tarea/observación para un instructor.
2. Abrir el detalle de una tarea recibida y completarla.
3. Verificar que la campana de notificaciones del topbar avisa al destinatario.

> No confundir con "Comunicaciones" (`/comunicaciones`, grupo Finanzas) que hoy muestra
> "Próximamente". Aclarar con ella cuál espera usar y para qué.

### Flujo K — Academia Profesional (solo si su sede tiene el grant)
**Rutas:** `/app/secretaria/profesional/*` y `/app/secretaria/libro-de-clases`

1. Base Alumnos Prof.: buscar un alumno del curso profesional.
2. Promociones: revisar promociones vigentes y precios.
3. Asistencia Prof. y Calificaciones: registrar asistencia y notas de una promoción.
4. Libro de Clases: revisar el libro de una promoción activa.
5. Certificados Prof.: generar pendientes (misma mecánica que Flujo F).
6. Archivo y Ex-Alumnos Prof.: consulta histórica.

**Si su sede NO tiene grant:** verificar que el grupo no aparece en el menú y que la URL
directa la rebota (guard `professionalBranchGuard`).

### Flujos de consulta (rápidos, al final de la reunión)
- **Instructores** (`/instructores`): ficha y disponibilidad de instructores de su sede.
- **DMS Documentos** (`/documentos`): buscar documentos de la escuela / plantillas descargables.
- **Reportes Contables** (`/contabilidad/reportes`): reporte mensual de su sede.
- **Liquidaciones** (`/contabilidad/liquidaciones`): liquidación de horas de un instructor.
- **Ex-Alumnos B** (`/ex-alumnos`): buscar un ex-alumno con filtros.

---

## 3. Puntos de atención durante la prueba (riesgos conocidos)

1. **Aislamiento por sede (🔴 auditoría 2026-06-24):** en *Base Alumnos B* e *Instructores*
   se detectó fuga potencial de datos de otras sedes (RLS de `students`/`users`/`instructors`
   no ancla por sede y esas facades no usaban `getActiveBranchId()`). **Verificar en vivo**
   con la cuenta real de la secretaria: ¿ve alumnos/instructores de otra sede? Idem el
   export de alumnos (se invocaba con `branch_id: null` → export global).
2. **"Comunicaciones" vs "Comunicación":** dos ítems de menú con nombre casi igual; el
   primero es placeholder. Riesgo de confusión en la demo — guiarla a "Comunicación".
3. **Notificaciones:** la campana global del shell funciona, pero la página
   `/secretaria/notificaciones` sigue en stub PLANO. No entrar ahí en la demo.
4. **`/configuracion-web` alcanzable por URL** sin estar en el menú: decidir si el rol
   secretaria debe poder editar la web pública (principio de menor privilegio).
5. **Rol `secretary` (BD) vs `secretaria` (frontend):** unificación pendiente en `AuthFacade`;
   si algo del menú/topbar se ve raro con su cuenta real, sospechar de este mapeo.

---

## 4. Checklist resumido para la reunión

- [ ] Login + redirect a dashboard de secretaria
- [ ] Dashboard: números del día correctos para su sede
- [ ] Matrícula completa de punta a punta (wizard 6 pasos) + retomar borrador
- [ ] Agendar, reagendar y cancelar una clase
- [ ] Buscar alumno, abrir ficha, ver documentos
- [ ] Pasar asistencia de una clase teórica
- [ ] Registrar un pago + verlo reflejado en Caja Diaria
- [ ] Registrar un egreso + cerrar caja + ver historial
- [ ] Vender un servicio especial
- [ ] Crear tarea de comunicación y completarla
- [ ] Generar certificados pendientes (B y Prof. si aplica)
- [ ] Academia Profesional visible/oculta según grant de su sede
- [ ] **Seguridad:** confirmar que solo ve datos de SU sede (alumnos, instructores, export)
- [ ] Recoger feedback: ¿qué le falta vs. su proceso actual en papel/planilla?

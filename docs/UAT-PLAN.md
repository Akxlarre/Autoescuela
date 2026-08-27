# Plan de Pruebas de Aceptación de Usuario (UAT) — Autoescuela

> Generado a partir de `docs/PRODUCT-VISION.md`, `indices/FACADES.md` e `indices/COMPONENTS.md`.
> Objetivo: validar que cada flujo de negocio funciona end-to-end desde la perspectiva del rol real (secretaria, admin, instructor, alumno), no solo que el código pasa lint/tests.

## Cómo usar este documento

**Esto es un barrido de una sola vez, no un checklist diario.** Los 7 paquetes (~4h) se
corren **una vez**, todos juntos, antes de empezar a operar el sistema día a día. El objetivo es
encontrar los bugs "de fondo" antes de la marcha blanca con el cliente — repetirlo completo cada
día no encuentra nada nuevo a partir del segundo día y quema al equipo.

1. Cada bloque es un **paquete de UAT** repartible a una persona/pareja de testers (ya asignado
   más abajo con Owner I/B/M).
2. Al ejecutar, marcar `[x]` y anotar bugs encontrados debajo del caso (con captura si aplica).
3. Ejecutar preferentemente en datos de un ambiente de staging/seed, no producción.
4. Reportar hallazgos como `fix-NNN` o `hotfix-NNN` según corresponda (ver `.claude/CLAUDE.md`).
5. Una vez cerrado el barrido inicial (todos los `[ ]` resueltos o convertidos en tracks), pasa a
   régimen de **uso diario** — ver sección siguiente.

## De aquí a la marcha blanca: uso diario

Después del barrido inicial, **no se vuelve a correr este checklist completo día a día.** En su
lugar:

- Cada persona usa el sistema para su operación real (matricular, agendar, cobrar, como lo haría
  la secretaria/admin de verdad) en vez de seguir una lista de casos.
- Cuando algo falle o se vea raro en el uso normal, se anota directo en la
  **[Registro de hallazgos](#registro-de-hallazgos)** al final de este documento — no hace falta
  esperar a una "sesión de UAT" para reportarlo.
- Si aparece un cambio grande de código (una feature nueva, un fix riesgoso) antes de la marcha
  blanca, se puede re-correr **solo el paquete afectado** de este documento como regresión — no
  los 7 completos.
- El día antes de la marcha blanca real con el cliente, conviene re-correr el checklist completo
  una segunda vez como verificación final.

---

## Paquete 1 — Matrícula Pública (sin auth) — Owner: B

Flujo público de auto-matrícula (wizard 6-7 pasos), Clase B y Profesional.

- [ ] Acceder al link público sin `branchId` válido → se muestra pantalla de orientación (no error crudo)
- [ ] Seleccionar tipo de licencia Clase B → avanza a datos personales
- [ ] Seleccionar tipo de licencia Profesional → muestra nota "pre-inscripción, la escuela te contactará"
- [ ] Ingresar RUT inválido → bloquea avance con feedback visual (borde rojo)
- [ ] Ingresar alumno **menor de 17 años** → bloquea avance
- [ ] Ingresar alumno **17-18 años** → muestra warning de autorización notarial pero permite avanzar
- [ ] Ingresar alumno **menor de 20 años en curso Profesional** → bloquea avance
- [ ] Ingresar email ya usado por otro alumno → error claro, no permite duplicar
- [ ] Elegir modalidad de pago (total vs abono) → precio y sesiones se recalculan correctamente
- [ ] Seleccionar instructor y horario en la grilla semanal → slots ocupados no son seleccionables
- [ ] Subir foto de carnet (válida) → preview correcto, avanza
- [ ] Intentar avanzar sin subir documento requerido → bloqueado
- [ ] Generar contrato PDF → se genera y previsualiza correctamente
- [ ] Subir contrato firmado → queda asociado a la matrícula
- [ ] Confirmar pago (Webpay o simulado) → llega a pantalla de confirmación con N° de matrícula
- [ ] **Abandonar el wizard a mitad de camino y volver** → debe ofrecer retomar el draft (no perder datos, expira a 24h)
- [ ] Intentar re-matricular a un alumno con matrícula activa en el mismo curso → bloqueado
- [ ] Re-matricular a un ex-alumno (curso completado) → pide confirmación, permite continuar y precarga datos personales

---

## Paquete 2 — Matrícula Presencial + Alumnos (Secretaria/Admin) — Owner: I

- [ ] Secretaria matricula un alumno desde el panel interno (flujo asistido) → aparece en "Base de Alumnos"
- [ ] Filtrar/buscar alumno por nombre, curso, estado → resultados correctos
- [ ] Ver ficha de alumno → progreso de clases, asistencia, pagos, documentos coherentes con lo matriculado
- [ ] Archivar un alumno sin historial (pagos/clases) → confirmación simple
- [x] Archivar un alumno **con historial** → exige escribir "borrarlo", advertencia contable — verificado 2026-08-26, el flujo exige escribir "borrarlo" y advierte impacto contable antes de confirmar.
- [ ] Ver alumno archivado en "Papelera" → restaurar → vuelve a la lista activa
- [ ] Como **Admin** con sede "Todas las escuelas" → ve columna Sede y alumnos de todas las sedes
- [ ] Como **Secretaria** → solo ve alumnos de su propia sede (nunca de otra)
- [ ] Reprogramar una clase (Clase B) desde la ficha del alumno → slot anterior libera, nuevo slot ocupa (caso NO probado como distinto del reagendado masivo de abajo — pendiente)
- [ ] Marcar inasistencia 2 veces consecutivas (mismo class_number seguido) → sistema cancela clases futuras automáticamente (penalización)
- [ ] Justificar una inasistencia → deja de contar para la penalización, queda marcada "Justificada" en la grilla
- [x] Reagendar clases penalizadas (flujo 2 pasos: selección → agendamiento masivo) → sesiones quedan reprogramadas correctamente — verificado 2026-08-26, ambos pasos (selección de clases penalizadas → agendamiento masivo) completan y las sesiones quedan reprogramadas.
- [ ] Alumno Profesional: cargar notas en Evaluaciones (grilla módulo × alumno), guardar borrador y confirmar (irreversible) → validar que no se puede editar tras confirmar
- [ ] Generar carnet/certificado de un alumno elegible (asistencia + nota + pago completo) → PDF correcto (solo se probó el caso NO elegible, abajo)
- [x] Intentar generar certificado de alumno **no elegible** → bloqueado con motivo claro — verificado 2026-08-26.

---

## Paquete 3 — Agenda y Triple Match (Secretaria/Admin/Instructor) — Owner: M

Valida la regla de negocio central del producto (`docs/PRODUCT-VISION.md` §Triple Match).

- [x] Ver agenda semanal → slots disponibles/ocupados/completados se distinguen visualmente — verificado 2026-08-12, leyenda (Disponible/Agendada/En progreso/Completada/No asistió) clara y coherente con el grid.
- [x] Filtrar agenda por instructor → solo muestra sus clases — verificado 2026-08-12, clases distintas al cambiar de instructor en el selector.
- [x] Intentar doble-agendar el mismo instructor en el mismo horario → **debe ser imposible** (bloqueo de negocio) — bug encontrado y cerrado: [fix-152-m-doble-agendado-instructor-sin-constraint-bd](../specs/fixes/fix-152-m-doble-agendado-instructor-sin-constraint-bd/fix.md). Verificado en la app 2026-08-12: slot 16:40 del 12/8 (Roberto Andrés Soto) aparece bloqueado/gris en los 4 flujos de agendamiento (nueva matrícula, reagendamiento masivo de no-asistidas, reprogramación desde ficha del alumno, flujo público).
- [x] Intentar agendar con un vehículo cuyo SOAP/revisión técnica está vencido → alertado (no bloqueante) — implementado en [fix-164-m](../specs/fixes/fix-164-m-advertencia-documentos-vehiculo-agendamiento/fix.md) + [fix-165-m](../specs/fixes/fix-165-m-advertencia-vehiculo-scheduling-real-flows/fix.md) (fix-164 lo implementó solo en la Agenda Semanal de solo lectura — `AgendaFacade`/`AgendaSlotComponent` — que ningún flujo de agendamiento real usa; el usuario probó agendar una clase con SOAP vencido sin ver ninguna advertencia y fix-165 lo corrigió en el pipeline real: `EnrollmentFacade` (nueva matrícula), `AdminAlumnoDetalleFacade` (reagendamiento masivo + reprogramación) → `ScheduleGridComponent`/grid inline propio). Ajustes de UX en [fix-166-m](../specs/fixes/fix-166-m-badge-vehiculo-color-y-mensaje-especifico/fix.md): ícono siempre amarillo (no rojo) y mensaje lista los documentos específicos vencidos/por vencer. Verificado visualmente en la app 2026-08-12.
- [x] Navegar semanas adelante/atrás, "Hoy", salto rápido de fecha → datos correctos por semana — verificado 2026-08-12, los 3 controles (flechas, "Hoy", selector de calendario) funcionan y muestran las clases correctas por semana.
- [x] Verificar que no se puede navegar más allá del límite configurado (2/3/4 meses) — "semanas fantasma" bloqueadas — bug encontrado y cerrado: [fix-162-m-agenda-navegacion-semanas-fantasma-sin-limite](../specs/fixes/fix-162-m-agenda-navegacion-semanas-fantasma-sin-limite/fix.md). El clic repetido en "Semana siguiente" adelantaba `weekStart` más allá del límite antes de que el botón se deshabilitara (race entre el signal síncrono y el fetch async), y sin request-guard las respuestas quedaban encoladas causando el "auto-navegado" con delay tras soltar el mouse. Corregido con chequeo síncrono en `AgendaFacade.goToNextWeek()` + `createRequestGuard()` en el fetch.
- [x] Instructor: ver panel "Mis clases hoy" → coincide con lo agendado por secretaría — verificado 2026-08-13, comparado dashboard de instructor ("Mi Día" / "Mis Clases de Hoy") vs dashboard de secretaria ("Clases Actuales"): misma clase 17:30, misma alumna, mismo vehículo (Chevrolet Spark XXYZ34).
- [x] Instructor: iniciar clase (KM inicial) → estado pasa a "en curso" — verificado 2026-08-13. Confirmado en pantalla: badge "En Curso" + botón pulsante + texto explícito.
- [x] Instructor: intentar iniciar una segunda clase mientras otra está "en curso" → bloqueado (exclusión mutua). Confirmado en vivo, toast muestra "El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra."
- [x] Instructor: finalizar clase (KM final, observaciones y firmas ambos opcionales) → estado pasa a "completada", asistencia registrada — verificado 2026-08-14, ambas clases del día pasan a "Completada" con toast de confirmación. Bugs encontrados y cerrados en el camino: [fix-188-m](../specs/fixes/fix-188-m-instructor-firma-rls-storage-documents/fix.md) (RLS bloqueaba subida de firmas del instructor — faltaba policy SELECT además de INSERT/UPDATE) y [fix-189-m](../specs/fixes/fix-189-m-instructor-finalizar-clase-no-actualiza-km-vehiculo/fix.md) (el km final no se propagaba a `vehicles.current_km`).
- [x] Verificar cron de fin de jornada: clases no resueltas del día quedan `no_show` automáticamente (validar al día siguiente o con dato de prueba) — verificado 2026-08-11: el cron solo cierra `scheduled`, las `in_progress` sin cerrar quedan abiertas a propósito (requieren KM final de un humano) y se destacan visualmente en el dashboard hasta que se cierran.

---

## Paquete 4 — Pagos, Cuadratura y Servicios Especiales (Secretaria/Admin) — Owner: M

- [x] Registrar un pago (abono) a una matrícula → estado de deuda del alumno se actualiza — verificado 2026-08-21: alumno Conductores MORALES, total pagado $90.000→$180.000, saldo pendiente $90.000→$0, nuevo "Pago #2" visible en historial.
- [x] Aplicar un descuento predefinido → monto se recalcula correctamente (% y fijo) — verificado 2026-08-21 tras [fix-197-m](../specs/fixes/fix-197-m-descuentos-predefinidos-sin-crud/fix.md) (desbloqueó el hallazgo #4, ya se puede crear descuentos predefinidos) y [hotfix-088-m](../specs/hotfixes/hotfix-088-m-descuento-predefinido-cursor-label-quitar/hotfix.md) (label con % / monto). Probado con "Descuento Padre Hurtado" (fijo, $30.000, $180.000→$150.000) y "Promoción fin de agosto" (20%, $36.000, $180.000→$144.000).
- [x] Registrar un pago que cancela el saldo pendiente de un alumno y de inmediato intentar registrar un segundo pago para ese mismo alumno → verificado 2026-08-24: aunque el cliente puede mostrar el saldo stale por un instante (`registrarNuevoPago` refresca en background con `void`, sin esperar antes de cerrar el drawer), el segundo pago es **rechazado a nivel de BD** por el trigger `trg_check_payment_within_pending_balance` ([fix-h024/fix-057-m](../supabase/migrations/20260723010000_fix_h024_payments_exceed_pending_balance_guard.sql)), que corre `BEFORE INSERT` en `payments` y bloquea cualquier monto que exceda `pending_balance`. No hay sobre-pago posible por esta vía. Probado tanto reabriendo el mismo drawer como con dos pestañas simultáneas — en ambos casos el segundo pago fue rechazado ("Error al guardar. Intenta de nuevo.").s
- [x] Registrar un egreso / gasto fijo → aparece en reportes de cuadratura — verificado 2026-08-24: egreso "Combustible" ($52.000, "Recarga combustible") registrado vía drawer, aparece de inmediato en la tabla "Egresos / Retiros" de cuadratura con el total actualizado a $52.000.
- [ ] Cierre de caja del día → totales cuadran contra lo ingresado manualmente
- [ ] Venta de servicio especial (catálogo) → queda registrada y visible en KPIs del módulo
- [ ] Ver Dashboard → KPIs (matrículas, pagos, clases en vivo, vehículos disponibles) coinciden con datos reales, no placeholders
- [ ] Cambiar de sede en Dashboard (admin) → KPIs se recalculan para la sede elegida
- [ ] Ver "Clases en vivo" en dashboard → refleja clases realmente `in_progress` en tiempo real (abrir en 2 pestañas y verificar Realtime)

---

## Paquete 5 — Flota, DMS y Documentos (Secretaria/Admin) — Owner: B

- [ ] Ver listado de vehículos → SOAP/revisión técnica vencidos se destacan visualmente (alerta)
- [ ] Registrar mantenimiento de un vehículo → aparece en historial + KM actualizado
- [ ] Subir documento de un alumno (por matrícula específica, no solo por alumno) → aparece en DMS ligado a la matrícula correcta
- [ ] Alumno con 2+ matrículas → cada matrícula muestra sus propios documentos, sin mezclarse
- [ ] Subir documento institucional / plantilla → visible para todos los roles con acceso
- [ ] Eliminar documento de instructor → solo permitido a Admin (validar que Secretaria no puede)
- [ ] Previsualizar documento (PDF/imagen) en el visor → carga correctamente, navegación "volver" funciona sin cerrar todo el panel
- [ ] Alertas de documentos por vencer (Dashboard/Alertas) → coincide con vehículos/alumnos reales próximos a vencer

---

## Paquete 6 — Administración, Roles y Multi-Sede (Admin) — Owner: I

- [x] Crear instructor nuevo → aparece disponible en Agenda y en pickers de horario — verificado 2026-08-26 al crear "UAT Instructor Prueba" para probar el caso siguiente.
- [x] Crear instructor con "ambas sedes" habilitado → aparece en el picker de ambas sedes, no solo la de origen — bug encontrado y cerrado: [fix-028-i-agenda-both-branches-instructor-picker](../specs/fixes/fix-028-i-agenda-both-branches-instructor-picker/fix.md). Verificado 2026-08-26/27: el instructor con `both_branches=true` ahora aparece también en el picker de Agenda de la sede que NO es la de origen.
- [ ] Crear secretaria nueva, asignarla a una sede → al loguearse, solo ve datos de esa sede
- [x] Editar email de un usuario (alumno/instructor/secretaria) a uno ya usado por otro → debe rechazar sin desincronizar Auth/tabla pública — bug encontrado y cerrado: [fix-029-i-edge-function-error-swallowed](../specs/fixes/fix-029-i-edge-function-error-swallowed/fix.md). El rechazo en BD ya funcionaba (sin desincronización), pero el error real no llegaba al usuario. Verificado 2026-08-27: el toast ahora muestra "Ya existe otro usuario registrado con ese correo electrónico."
- [ ] Ver Auditoría (`AuditoriaFacade`) → acciones críticas (crear/editar/eliminar) quedan registradas con usuario y fecha correctos
- [ ] Filtrar auditoría por sede, secretaria, acción → resultados correctos y branch-scoped
- [ ] Notificaciones: una acción de negocio (ej. nueva matrícula) genera notificación al rol correspondiente → aparece en tiempo real sin recargar (solo evidencia histórica/estructural revisada, falta prueba cross-tab en vivo)
- [ ] Tareas internas: crear tarea/observación dirigida a un usuario → destinatario la ve y puede responder/marcar estado

---

## Paquete 7 — Cross-cutting: Sesión, Responsive y Accesibilidad — Owner: B

- [ ] Login con credenciales inválidas → mensaje de error claro, sin colgar la UI
- [ ] Cerrar sesión → redirige a login, no deja datos de sesión anterior visibles al volver a entrar con otro usuario
- [ ] Revocar `can_access_both_branches` a un usuario logueado → su vista se actualiza sin necesidad de re-login (Realtime del grant)
- [ ] Probar cada módulo principal en **mobile** (< 640px) → tablas/agenda no rompen layout, no hay scroll horizontal de página
- [ ] Probar cada módulo principal en **desktop** (app-like, fill-screen) → scroll interno funciona, no scrollea el documento completo
- [ ] Modo oscuro/claro en cada módulo → contraste correcto, sin textos ilegibles
- [ ] Consola del navegador limpia (sin errores JS) al navegar los flujos críticos (matrícula, agenda, pagos)
- [ ] Sin llamadas de red con status 4xx/5xx en los flujos críticos (revisar Network tab)

---

## Resumen de reparto sugerido

| Paquete | Rol tester ideal | Duración estimada |
|---|---|---|
| 1. Matrícula Pública | QA / Secretaria | 45 min |
| 2. Matrícula Presencial + Alumnos | Secretaria | 45 min |
| 3. Agenda / Triple Match | Secretaria + Instructor | 40 min |
| 4. Pagos / Cuadratura | Secretaria / Admin | 35 min |
| 5. Flota / DMS | Secretaria / Admin | 30 min |
| 6. Administración / Roles | Admin | 30 min |
| 7. Cross-cutting | Cualquiera (QA) | 30 min |

**Total estimado:** ~4-5 horas repartidas entre el equipo en paralelo.

## Registro de hallazgos

| # | Paquete | Caso | Severidad | Descripción | Track (fix-NNN) |
|---|---|---|---|---|---|
| 1 | 3 | Doble-agendar el mismo instructor en el mismo horario | Media | No hay `UNIQUE`/`EXCLUDE` constraint en BD sobre `class_b_sessions(instructor_id, scheduled_at)` — la única protección es que la vista de disponibilidad filtra al leer, no al escribir. Condición de carrera posible con dos secretarias agendando casi simultáneo. | [fix-152-m-doble-agendado-instructor-sin-constraint-bd](../specs/fixes/fix-152-m-doble-agendado-instructor-sin-constraint-bd/fix.md) |
| 2 | 3 / 5 | Vehículo con SOAP/revisión técnica vencida no bloquea agendamiento | Alta | No existe UI para cargar/editar documentos de vehículo (SOAP, Revisión Técnica, etc.) — `FlotaFacade.upsertVehicleDocument()` existe pero ningún componente lo llama. Sin datos reales, tampoco hay validación de bloqueo al agendar. Hueco de punta a punta. | [fix-153-m-vehiculo-documentos-sin-ui-de-carga](../specs/fixes/fix-153-m-vehiculo-documentos-sin-ui-de-carga/fix.md) |
| 3 | 3 | Navegación de agenda permite pasar el límite máximo de semanas configurado | Media | `AgendaFacade.goToNextWeek()` avanzaba `weekStart` sin chequear el límite — el único freno era el botón deshabilitado, cuyo estado dependía de un fetch async lento. Clics rápidos y repetidos se colaban antes de que se deshabilitara, y sin request-guard los fetches encolados se pisaban entre sí (efecto "agenda navegando sola" con delay tras soltar el mouse). | [fix-162-m-agenda-navegacion-semanas-fantasma-sin-limite](../specs/fixes/fix-162-m-agenda-navegacion-semanas-fantasma-sin-limite/fix.md) |
| 4 | 4 | No existe forma de crear descuentos predefinidos para matrícula | Media | La tabla `discounts` y el consumo en el step de pago de matrícula (`selectPredefinedDiscount`, `enrollment-payment.facade.ts`) ya existen y funcionan, pero nunca se construyó un CRUD/UI en Admin para poblar esa tabla — solo el descuento manual es usable hoy. | [fix-197-m-descuentos-predefinidos-sin-crud](../specs/fixes/fix-197-m-descuentos-predefinidos-sin-crud/fix.md) |
| 5 | 6 | Instructor con `both_branches=true` no aparece en el picker de Agenda de la sede que NO es la de origen | Alta | `AgendaFacade.loadInstructors()` filtraba solo por `users.branch_id`, ignorando el grant `instructors.both_branches` — quedó huérfano del patrón (segunda query + merge) que sí aplican `InstructoresFacade`/`AdminAlumnoDetalleFacade` desde spec 0004-m. Invisible en QA hecho como Admin porque "Todas las sedes" salta el filtro entero. | [fix-028-i-agenda-both-branches-instructor-picker](../specs/fixes/fix-028-i-agenda-both-branches-instructor-picker/fix.md) |
| 6 | 6 | Editar un instructor con un email ya usado por otro usuario no muestra el error real (feedback genérico/ausente) | Media | `functions.invoke()` de Supabase, en un fallo no-2xx, retorna un `FunctionsHttpError` con `.message` genérico ("Edge Function returned a non-2xx status code") — el body real (`{"error":"...duplicate key..."}"`) queda sin leer en `error.context`. `ErrorSanitizerService` tampoco reconoce ese tipo de error. La BD sí rechazaba correctamente el duplicado (sin desincronizar Auth), pero el usuario no se enteraba del motivo. Mismo patrón presente en ~29 archivos más que usan `functions.invoke()` (ver DOMAIN-GOTCHAS DG-085) — solo se corrigió el call site reportado. | [fix-029-i-edge-function-error-swallowed](../specs/fixes/fix-029-i-edge-function-error-swallowed/fix.md) |

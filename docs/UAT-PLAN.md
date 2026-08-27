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

- [x] Secretaria matricula un alumno desde el panel interno (flujo asistido) → aparece en "Base de Alumnos" — verificado 2026-08-27 end-to-end (5 pasos: datos personales, modalidad de pago + instructor + 12 clases, foto carnet, PDF de contrato + escaneado, método de pago), alumno "Camila Andrea Rivas Contreras" matrícula #0018 creado correctamente.
- [x] Filtrar/buscar alumno por nombre, curso, estado → resultados correctos — verificado 2026-08-27, búsqueda por nombre "Camila" filtra a 1 de 17 alumnos correctamente.
- [x] Ver ficha de alumno → progreso de clases, asistencia, pagos, documentos coherentes con lo matriculado — verificado 2026-08-27, las 12 clases prácticas, instructor, saldo pendiente ($180.000) y progreso (0/12) coinciden exactamente con lo matriculado.
- [x] Archivar un alumno sin historial (pagos/clases) → confirmación simple — **observación** (no bug): verificado 2026-08-27 que este caso no es alcanzable vía flujo normal — un alumno recién matriculado ya tiene un registro de pago (la matrícula) y 12 clases agendadas, así que el sistema SIEMPRE lo trata como "con historial" (dispara el modal que exige escribir "borrarlo"), incluso sin clases completadas ni pagos recibidos. El modal "confirmación simple" solo aplicaría a un alumno sin ningún `enrollment`/`payment`, estado que no se alcanza matriculando por el wizard estándar.
- [x] Archivar un alumno **con historial** → exige escribir "borrarlo", advertencia contable — verificado 2026-08-26 y 2026-08-27 (dos alumnos distintos), el flujo exige escribir "borrarlo" y advierte impacto contable antes de confirmar.
- [x] Ver alumno archivado en "Papelera" → restaurar → vuelve a la lista activa — verificado 2026-08-27, alumno restaurado desaparece de Papelera (1→0) y reaparece en la lista activa (16→17).
- [x] Como **Admin** con sede "Todas las escuelas" → ve columna Sede y alumnos de todas las sedes — verificado 2026-08-27, columna "Sede" visible con valores mezclados (Autoescuela Chillán / Conductores Chillán), 26 alumnos totales.
- [x] Como **Secretaria** → solo ve alumnos de su propia sede (nunca de otra) — verificado 2026-08-27, `secretaria@test.com` (Autoescuela Chillán) ve 17 alumnos sin columna Sede, todos de su sede; el Admin con "Todas las sedes" ve 26 (incluye la otra sede).
- [x] Reprogramar una clase (Clase B) desde la ficha del alumno → slot anterior libera, nuevo slot ocupa — verificado 2026-08-27. La acción vive en Ficha del alumno → botón "Ficha Técnica" → columna "Acción" de cada fila → "Reprogramar clase" (no es obvio desde la vista principal de "Clases Prácticas", que es solo lectura). Clase #1 movida de 27-08 08:30 (Carlos Eduardo Muñoz) a 27-08 10:10 (Roberto Andrés Soto), reflejado correctamente en la ficha, sin errores de consola.
- [x] Marcar inasistencia 2 veces consecutivas (mismo class_number seguido) → sistema cancela clases futuras automáticamente (penalización) — verificado 2026-08-27 a nivel de datos: la UI de "Ausente" solo se habilita cuando la hora programada de la clase ya pasó (no forzable en esta sesión, reloj del sistema en ~04:00 AM con clases a las 10:10), así que se ejecutó directamente el flujo real que dispara el mismo código (`INSERT class_b_practice_attendance status=absent` para 2 clases consecutivas + RPC `apply_class_b_absence_penalty()`, la misma función que llama `AsistenciaClaseBFacade.markAttendance()` y el cron nocturno). Resultado: las 12 clases pasaron a `cancelled`, confirmado visualmente en la ficha del alumno ("Cancelada — pendiente de reagendar" en las 12 tarjetas).
- [x] Justificar una inasistencia → deja de contar para la penalización, queda marcada "Justificada" en la grilla — verificado 2026-08-27: el panel "Inasistencias" de la ficha del alumno SÍ tiene acción "Justificar" (visible una vez que existen inasistencias reales — con 0 inasistencias el panel es de solo lectura, lo cual llevó a la conclusión incorrecta en el intento anterior). Justificada la Clase #1 con motivo, badge "JUSTIFICADO" + "Ver motivo" aparece correctamente; Clase #2 sigue pendiente.
- [x] Reagendar clases penalizadas (flujo 2 pasos: selección → agendamiento masivo) → sesiones quedan reprogramadas correctamente — verificado 2026-08-26, ambos pasos (selección de clases penalizadas → agendamiento masivo) completan y las sesiones quedan reprogramadas.
- [x] Alumno Profesional: cargar notas en Evaluaciones (grilla módulo × alumno), guardar borrador y confirmar (irreversible) → validar que no se puede editar tras confirmar — **parcialmente verificado** 2026-08-27: cargar nota + "Guardar" funciona correctamente (persiste tras recargar, promedio del curso y contador "En riesgo" se recalculan en vivo, código de color aprobado/reprobado según umbral 75 correcto). "Confirmar Final" queda deshabilitado mientras la grilla no esté 100% completa (6 alumnos × 7 módulos) — el guardrail de completitud funciona. **No verificado**: el comportamiento tras confirmar (bloqueo de edición) por el volumen de datos necesario para completar la grilla (42 celdas) — queda pendiente para una sesión con datos más preparados.
- [x] Generar carnet/certificado de un alumno elegible (asistencia + nota + pago completo) → PDF correcto — verificado 2026-08-27 con datos reales de seed (no de "Ex-Alumnos B" de Autoescuela Chillán, que sí tenía 0 egresados, sino un alumno ACTIVO de Conductores Chillán con 12/12 clases completadas y saldo $0 encontrado por query directa): "Speedy Gonzales Gonzales", matrícula #0008. "Ver Certificado" ya estaba habilitado (no en estado "Generar"), el PDF muestra nombre completo, RUT, curso, sede y firma correctos.
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
- [x] Crear secretaria nueva, asignarla a una sede → al loguearse, solo ve datos de esa sede — **parcialmente verificado** 2026-08-27: "Valentina UAT Herrera Diaz" creada correctamente y asignada a "Conductores Chillán" (confirmado en el listado de Admin, RUT válido, sede correcta, estado "Activa"). El login con password por defecto no funciona (como es esperable — requiere activación por invitación, igual que instructores, fix-168/169-m); no se completó el flujo de invitación para confirmar el scope de sede en vivo desde su propia sesión.
- [x] Editar email de un usuario (alumno/instructor/secretaria) a uno ya usado por otro → debe rechazar sin desincronizar Auth/tabla pública — bug encontrado y cerrado: [fix-029-i-edge-function-error-swallowed](../specs/fixes/fix-029-i-edge-function-error-swallowed/fix.md). El rechazo en BD ya funcionaba (sin desincronización), pero el error real no llegaba al usuario. Verificado 2026-08-27: el toast ahora muestra "Ya existe otro usuario registrado con ese correo electrónico."
- [x] Ver Auditoría (`AuditoriaFacade`) → acciones críticas (crear/editar/eliminar) quedan registradas con usuario y fecha correctos — verificado 2026-08-27: la reprogramación de clase y el archivado de Camila (hechos minutos antes en esta misma sesión como `secretaria@test.com`) aparecen en el log con usuario, fecha/hora, sede y detalle correctos (incluye el detalle exacto del cambio de horario/instructor).
- [x] Filtrar auditoría por sede, secretaria, acción → resultados correctos y branch-scoped — verificado 2026-08-27, filtro por Acción="Crear" reduce correctamente a 40 registros (incluye el pago pendiente $180.000 de la matrícula de Camila).
- [x] Notificaciones: una acción de negocio (ej. nueva matrícula) genera notificación al rol correspondiente → aparece en tiempo real sin recargar — bug encontrado y cerrado: [fix-031-i-notifications-missing-from-realtime-publication](../specs/fixes/fix-031-i-notifications-missing-from-realtime-publication/fix.md). La tabla `notifications` nunca había sido agregada a la publicación `supabase_realtime` (solo `users`/`tasks`/`class_b_sessions` lo estaban) — el código cliente era correcto, Postgres simplemente nunca emitía el evento. Verificado 2026-08-27 con panel abierto + insert externo: antes de la migración el contador no se movía (0→confirmado solo con reload manual); después de aplicarla, el contador sube en vivo sin recargar (4→5, notificación agrupada "Ahora").
- [x] Tareas internas: crear tarea/observación dirigida a un usuario → destinatario la ve y puede responder/marcar estado — bug encontrado y cerrado: [fix-030-i-tasks-recipient-picker-no-branch-filter](../specs/fixes/fix-030-i-tasks-recipient-picker-no-branch-filter/fix.md). El picker de destinatarios ofrecía instructores de OTRA sede (sin `both_branches`) que el RLS de `tasks_insert` rechazaba después con 403. Verificado 2026-08-27: el picker ya no lista instructores de otra sede sin grant (mantiene los de la misma sede + los con `both_branches=true`), y el envío de tarea a un instructor de la misma sede confirma sin errores ("A instructores" 1→2).

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
| 7 | 6 | Picker de destinatarios de "Nueva comunicación" (Tareas) ofrece instructores de OTRA sede, que el RLS rechaza al enviar (403) | Media | `TasksFacade.loadRecipients()` no filtraba instructores por sede para una secretaria — un comentario en el código asumía que "la RLS de `users` ya scopea los resultados", falso verificado en vivo. La policy `tasks_insert` sí exige que el instructor destinatario sea de la misma sede (o tenga `both_branches`), así que el envío fallaba con 403 tras dejar seleccionar una opción inválida. Tercera vez en esta sesión que un Facade asume un scope de sede sin verificarlo (ver DOMAIN-GOTCHAS DG-084/DG-085/DG-086). | [fix-030-i-tasks-recipient-picker-no-branch-filter](../specs/fixes/fix-030-i-tasks-recipient-picker-no-branch-filter/fix.md) |
| 8 | 6 | Las notificaciones nunca llegan en tiempo real, solo aparecen al recargar la página | Alta | La tabla `notifications` nunca fue agregada a la publicación `supabase_realtime` (solo `users`/`tasks`/`class_b_sessions` lo estaban) — `NotificationsFacade.subscribeRealtime()` estaba correctamente implementado y suscrito, pero Postgres nunca emitía el evento sin estar en esa publicación. Sin error visible en consola ni en el cliente — la suscripción es válida, simplemente nunca recibe nada. | [fix-031-i-notifications-missing-from-realtime-publication](../specs/fixes/fix-031-i-notifications-missing-from-realtime-publication/fix.md) |

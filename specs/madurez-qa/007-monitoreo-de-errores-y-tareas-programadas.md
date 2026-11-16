# 007 — Monitoreo de errores y tareas programadas

> **Fase:** 2 · **Prioridad sugerida:** P1 · **Tipo sugerido:** spec
> **Depende de:** nada · **Desbloquea:** el canal de avisos que usan `001`, `008` y `009`
> **Nivel hoy:** 0 (no existe) · **Meta:** 3 (los errores llegan al equipo y los graves avisan)

## En una frase

El equipo se entera de que algo falló en producción antes de que la escuela llame.

## El concepto

Los tests responden "¿funciona lo que pensé probar?". El monitoreo responde "¿qué está pasando de
verdad?". Son complementarios: ningún conjunto de tests cubre todas las combinaciones de datos,
navegadores y momentos que ocurren en el uso real. A esto se le llama **_shift-right_**: llevar
parte del control de calidad a producción.

**Observabilidad** (_observability_) es poder responder preguntas sobre el sistema mirando lo que
emite. Sus tres fuentes clásicas:

| Fuente | Qué es | Ejemplo acá |
| ------ | ------ | ----------- |
| Registros (_logs_) | Lo que el sistema anota mientras corre | La salida de una edge function |
| Métricas (_metrics_) | Números en el tiempo | Cuántas lecturas fallaron por hora |
| Trazas (_traces_) | El camino de una petición entre componentes | Navegador, función, base |

Para un sistema de este tamaño alcanzan cuatro piezas:

1. **Captura de errores** (_error tracking_): cada excepción llega a un lugar central, agrupada con
   las iguales, con la versión de la app, la ruta y el navegador.
2. **Monitoreo de disponibilidad** (_uptime monitoring_): algo externo comprueba cada pocos
   minutos que el sitio responde.
3. **Latido** (_heartbeat_, _dead man's switch_): para tareas programadas. La tarea avisa "terminé"
   al final de cada corrida; si el aviso no llega a la hora esperada, suena la alarma. Detecta la
   **ausencia** de algo, que es lo que una alerta común no puede ver.
4. **Avisos** (_alerting_): reglas que convierten lo anterior en un mensaje a una persona.

La falla más peligrosa es la **silenciosa** (_silent failure_): el sistema sigue respondiendo y
nadie ve un error, pero dejó de hacer algo. Y el riesgo opuesto es la **fatiga de alertas**
(_alert fatigue_): si llegan demasiados avisos, se ignoran todos.

## Por qué importa acá

Verificado el 2026-11-15:

- **Los errores no salen del navegador.** `src/app/core/errors/global-error-handler.ts` hace dos
  cosas: `console.error` y un toast al usuario. Nada se envía a ningún lado.
- **Los errores que los facades capturan tampoco.** Por diseño (`swr-pattern.md`) una lectura
  fallida termina en un estado de error en pantalla. Está bien para el usuario, pero nadie del
  equipo se entera de cuántas veces pasa.
- **Ya hubo una falla silenciosa larga.** `indices/DATABASE.md:160`: la función de auditoría
  `log_change()` quedó rota por una migración del 2026-06-14 y `audit_log` no registró ninguna
  acción hasta su corrección del 2026-08-01, unas siete semanas. La función atrapaba su propio
  error y solo emitía una advertencia.
- **Hay 10 tareas programadas activas:**

| Tarea | Horario (UTC) |
| ----- | ------------- |
| `auto-create-next-promotions` | 06:00 diario |
| `auto-transition-promotion-status` | 06:00 diario |
| `auto-transition-standalone-course-status` | 06:00 diario |
| `auto-transition-theory-cycle-status` | 06:00 diario |
| `cleanup-expired-enrollment-drafts` | 03:00 diario |
| `cleanup-expired-public-enrollment` | cada 30 minutos |
| `dispatch-scheduled-announcements` | cada 15 minutos |
| `mark-end-of-day-class-b-absences` | 00:00 y 01:00 diario |
| `notify-vehicle-document-expiry` | 06:00 diario |
| `sync-holidays-monthly` | día 1 de cada mes, 07:00 |

- **En los últimos 30 días ninguna corrida figura como fallida** (por ejemplo, 2.880 corridas de
  `dispatch-scheduled-announcements`). Ese dato tranquiliza menos de lo que parece: el estado
  "exitosa" solo significa que la sentencia SQL no lanzó un error. Una función que atrapa sus
  excepciones, o una tarea que dispara una edge function por HTTP, figura exitosa aunque el
  trabajo no se haya hecho. `mark_end_of_day_class_b_absences()` procesa cada fila en su propio
  bloque que atrapa errores (`indices/DATABASE.md:134`): es correcto para no abortar el lote, y
  por eso mismo una falla en todas las filas se vería como éxito.
- **No hay monitor externo** conocido del sitio publicado.

## Qué hay hoy

- `GlobalErrorHandler` y `ErrorSanitizerService`: el punto único por donde pasan las excepciones
  no manejadas.
- `assertReadOk` y `assertWriteOk` (`core/utils/db-error.utils.ts`): el punto único por donde pasa
  toda lectura y escritura a la base. Es el lugar ideal para contar fallas.
- `version.json` publicado en cada despliegue: permite etiquetar cada error con la versión.
- El historial de corridas de las tareas programadas, en `cron.job_run_details`.
- Los registros de las edge functions en el panel de Supabase, con la retención del plan.

## Cómo se hace

### 1. Errores del navegador

| Opción | Qué es | A favor | En contra |
| ------ | ------ | ------- | --------- |
| **Servicio dedicado** (Sentry o similar) | Un SDK envía cada error a un servicio que agrupa, muestra y avisa | Listo para usar; agrupa, relaciona con la versión, traduce el código minificado | Un tercero recibe datos de los usuarios; los planes gratuitos tienen cuota |
| **Alternativa de código abierto compatible** (GlitchTip o similar) | Lo mismo, alojado por el equipo | Los datos no salen | Hay que operarlo |
| **Tabla propia** | El manejador de errores llama a una edge function que guarda en una tabla | Sin terceros, sin costo | Agrupar, avisar y limpiar hay que construirlo |

**Recomendación:** resolver primero la pregunta de datos personales (abajo). Si se puede usar un
tercero, el servicio dedicado ahorra semanas. Si no, tabla propia con lo mínimo: mensaje, ruta,
versión, rol, sede, y un conteo por hora.

En cualquier caso:

- **Limpiar los datos antes de enviar** (_scrubbing_): nada de RUT, nombres, correos ni contenido
  de formularios.
- **Etiquetar con la versión** de `version.json`.
- **Contar las fallas capturadas:** una llamada en `assertReadOk`/`assertWriteOk` o en el `catch`
  de los facades, para saber cuántas lecturas y escrituras fallan aunque el usuario vea un error
  correcto.

### 2. Edge functions

Un envoltorio común en `_shared` que registre de forma estructurada cada error y cada respuesta
5xx, con el nombre de la función.

### 3. Tareas programadas

- **Latido por tarea:** al terminar, cada tarea anota en una tabla la hora y cuántas filas
  procesó. Un chequeo aparte avisa si una tarea no latió en su ventana.
- **Consulta de fallas:** un chequeo periódico de `cron.job_run_details`.
- **Sin tragarse errores:** donde una función atrapa excepciones para seguir, además las guarda en
  una tabla de errores. Atrapar y solo advertir fue la causa del caso `log_change()`.

### 4. Disponibilidad

Un servicio externo consulta `version.json` y un punto de salud de Supabase cada pocos minutos.
Tiene que ser externo: si el chequeo vive en el mismo lugar que se cae, se cae con él.

### 5. Avisos

Definir un canal, quién lo atiende, y dos niveles: lo que avisa de inmediato (sitio caído, tarea
que no latió, salto en errores después de un despliegue) y lo que se revisa una vez por semana.

## Alcance propuesto

- Captura de errores del navegador con datos limpios y versión.
- Conteo de lecturas y escrituras fallidas.
- Latido de las 10 tareas programadas, con aviso por ausencia.
- Registro de errores atrapados en funciones de la base.
- Monitor externo de disponibilidad.
- Canal de avisos con responsables.
- Una revisión semanal de errores, de 15 minutos.

## Fuera de alcance

- Trazas distribuidas y métricas de rendimiento (`016`).
- Chequeos de integridad de datos (`008`), aunque usan este canal.
- Analítica de uso del producto.

## Cómo saber que está terminado

- [ ] Un error provocado a propósito en el build de producción aparece en el colector en menos de
      5 minutos, con la versión correcta y sin datos personales.
- [ ] Cortar la red hacia la base en una pantalla suma una falla de lectura en el conteo.
- [ ] Desactivar una tarea programada en el entorno de pruebas dispara el aviso de latido ausente.
- [ ] Una función de la base que atrapa un error deja una fila en la tabla de errores.
- [ ] Apagar el sitio de pruebas dispara el aviso de disponibilidad.
- [ ] Está escrito quién recibe cada aviso.
- [ ] Hubo al menos una revisión semanal y dejó acciones.

## Trampas conocidas

- **Datos personales en los errores.** Un mensaje de error puede traer el RUT que el usuario
  escribió; la URL puede traer un identificador. Se limpia en el origen, y se prueba.
- **Ruido.** Extensiones del navegador, cortes de red del usuario y pestañas viejas generan
  errores que no son del sistema. Filtrarlos o el colector se vuelve ilegible.
- **Código minificado.** Sin los mapas de fuente (_source maps_), el error apunta a una línea
  ilegible del build. Subirlos al colector sin publicarlos en el sitio.
- **Avisar por todo.** Empezar con tres o cuatro reglas y sumar de a una.
- **Cuotas.** Un error en bucle puede agotar la cuota mensual de un plan gratuito en una tarde;
  poner un tope por usuario y por minuto.
- **El historial de corridas crece.** Conviene confirmar si `cron.job_run_details` se limpia sola
  o hace falta una tarea de limpieza; con tareas cada 15 minutos acumula miles de filas por mes.

## Decisiones pendientes

| Decisión | De quién |
| -------- | -------- |
| Si se puede enviar información de errores a un servicio fuera de Chile (Ley 21.719) | Responsable de datos personales |
| Herramienta de captura | Equipo |
| Canal de avisos, responsables y horario | Equipo |
| Cuánto tiempo se conservan los errores | Equipo |

## Vocabulario

- **Observability:** poder entender el sistema por lo que emite.
- **Error tracking:** captura y agrupación central de errores.
- **Heartbeat / dead man's switch:** aviso periódico cuya ausencia dispara la alarma.
- **Silent failure:** falla que no produce ningún error visible.
- **Alert fatigue:** dejar de atender avisos porque son demasiados.
- **Scrubbing:** quitar datos sensibles antes de enviar.
- **Source map:** archivo que traduce el código minificado al original.
- **Shift-right:** llevar el control de calidad también a producción.

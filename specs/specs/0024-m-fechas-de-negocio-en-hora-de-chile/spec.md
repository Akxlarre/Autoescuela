# Spec 0024-m — Fechas de negocio en hora de Chile

> **Status:** done
> **Closed:** 2026-10-09
> **Created:** 2026-10-08
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-054` (`specs/assignments/ASG-i-054-fechas-de-negocio-en-utc.md`), tanda
de testing del 2026-09-29. Inventario en `specs/testing-piloto/037-transversal-multisede-shell.md` §1.8.

**Persona afectada:** Secretaria y Admin (caja, pagos, reportes); Instructor y Alumno en los
filtros de "hoy".

**Problema que resuelve:**
La fecha de negocio se calcula en muchos lugares con `new Date().toISOString().slice(0, 10)` o
equivalentes, que devuelven la fecha **UTC**. En Chile (UTC-3/-4), todo lo que se hace desde las
~20:00–21:00 queda registrado o filtrado con la fecha del día siguiente: pagos, ventas, anticipos,
egresos, "Clases hoy", fecha de ingreso de la matrícula y nombres de archivos exportados. La Caja de
hoy no muestra lo cobrado esa noche, los reportes no cuadran por día y los KPIs salen corridos.

El bug ya está confirmado en vivo (nota de Benjamín del 2026-10-06, `fix-190-b` / `ASG-i-037`): con
`timezoneId: America/Santiago` y el reloj fijado al 6-oct, "Registrar anticipo" propone
**06/10/2026 a las 15:00** (control) y **07/10/2026 a las 23:30** (bug). El test existe:
`e2e/transversal-shell.spec.ts`, casos `T02`; el de las 23:30 está marcado
`knownBug('ASG-i-054 …')`.

Estado al 2026-10-08 (grep de `toISOString().slice/split`): 43 ocurrencias en `src/app` (parte de
ellas seguras por partir de una fecha local o de mediodía, ver §1.8 del inventario) y 14 en
`supabase/functions`.

**Alcance confirmado por Matías al reclamar (2026-10-08):**

- Entran la app (`src/app`, incluidos los módulos Profesional y los nombres de archivo descargado)
  y las edge functions (`supabase/functions`).
- "Hoy" se calcula con `America/Santiago` explícito, sin depender del reloj del equipo:
  `todayIso()` de `core/utils/date.utils.ts` hoy usa la hora del navegador y pasa a hora de Chile,
  lo que alcanza también a sus usos actuales.
- La BD (`CURRENT_DATE` / `NOW()::date` en policies y funciones, por ejemplo la policy de
  `cash_closings` de la secretaria) quedaba fuera, en un track aparte. **Ampliado por Matías el
  mismo día**: pidió que al terminar no quede ningún problema de zona horaria, incluido cómo se
  almacenan las fechas en la base de datos. Por eso la spec parte con una auditoría completa
  (ver §9) y la BD entra al alcance.

**Hipótesis de valor:**
Si el día de negocio se calcula en un único lugar por capa y siempre en hora de Chile, la Caja,
los reportes y los KPIs cuadran por día a cualquier hora, y el error deja de poder escribirse.

---

## 2. User Stories

> Redactadas por Claude a partir de `inventario.md` y aprobadas por Matías el 2026-10-08.

- **US1**: Como secretaria, quiero que lo que registro de noche (pagos, anticipos, egresos, ventas)
  quede con la fecha de hoy, para que la Caja del día cuadre con lo que cobré.
- **US2**: Como admin, quiero que los reportes, KPIs y filtros por día o mes usen el día de Chile,
  para que los totales no cambien según la hora en que los miro.
- **US3**: Como admin, quiero que los documentos y reportes impresos muestren fecha y hora de Chile,
  para que coincidan con lo que pasó en la sucursal.
- **US4**: Como dev del equipo, quiero un único lugar por capa donde se calcula el día de negocio y
  un guardrail que bloquee cualquier otro camino, para que este bug no vuelva a entrar.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

> "Hora Chile" = `America/Santiago`. "Día D" = un día cualquiera; "D+1" = el siguiente.

**App — escritura**

- **AC1**: Given el reloj en las 23:30 hora Chile del día D, When abro cualquier formulario que
  propone la fecha de hoy (anticipo, egreso, gasto fijo, venta de servicio especial, mantención,
  descuento), Then la fecha propuesta es D. Incluye `T02` de `e2e/transversal-shell.spec.ts` sin
  la marca `knownBug`.
- **AC2**: Given el reloj en las 23:30 hora Chile del día D, When se guarda un registro cuya fecha
  pone el sistema (pago de matrícula, pago de pre-inscripción, alta de relator), Then la fecha
  guardada en la BD es D.

**App — lectura y filtros**

- **AC3**: Given un pago con instante 23:30 hora Chile del día D y otro con instante 00:10 de D+1,
  When consulto Caja, Dashboard y Reportes para el día D, Then aparece el primero y no el segundo.
- **AC4**: Given un registro cuyo instante es 23:30 hora Chile del día D, When se muestra su fecha
  en una lista o ficha (fecha de ingreso, egreso, término, última práctica), Then se muestra D.
- **AC5**: Given el reloj en las 23:30 hora Chile del último día del mes, When veo un KPI o filtro
  "mes actual", Then corresponde al mes que termina y no al siguiente.

**Independencia del reloj del equipo**

- **AC6**: Given la suite unitaria corriendo con el proceso en `UTC` y en `Asia/Tokyo`, When se
  ejecutan los tests de las utils de fecha y de los facades con filtros por día, Then pasan con
  los mismos resultados que en `America/Santiago`.

**Edge functions**

- **AC7**: Given una edge function invocada a las 23:30 hora Chile del día D, When escribe una fecha
  de negocio (`issued_date`, `registration_date`, `start_date`, `end_date`) o usa "hoy" como
  valor por defecto de un reporte, Then usa D.
- **AC8**: Given un PDF o reporte generado por una edge function, When imprime una fecha u hora,
  Then está en hora Chile, tanto la de generación como la de cada registro.

**Base de datos**

- **AC9**: Given la BD con las migraciones de esta spec aplicadas, When se listan policies,
  funciones, vistas, triggers y RPC vigentes, Then ninguna usa `CURRENT_DATE` ni `now()::date`
  para un día de negocio: todas pasan por una única función SQL que devuelve el día de Chile.
- **AC10**: Given la BD, When se consulta `information_schema.columns`, Then no existe ninguna
  columna `timestamp without time zone` en el esquema `public`.
- **AC11**: Given las 22:00 hora Chile del día D, When la secretaria consulta sus cierres de caja,
  Then la ventana de días permitidos se cuenta desde D y no desde D+1.
- **AC12**: Given una clase del día D sin registrar asistencia, When corre el corte de
  inasistencias, Then la marca como ausente una sola vez y con el día D, y el corte ocurre a las 21:00
  hora Chile tanto en horario de invierno como de verano.

**Guardrail**

- **AC13**: Given `npm run lint:arch`, When un archivo de `src/app` o `supabase/functions` calcula
  un día a partir de un instante fuera de la util (corte de `toISOString()`, rango de día sin
  zona, formato de fecha sin zona), Then falla nombrando la util que corresponde usar.
- **AC14**: Given el repo al cerrar la spec, When corre `npm run lint:arch`, Then pasa, y cada
  excepción que quede está declarada con su justificación.

### Edge cases obligatorios

- **AC-E1**: Given el día del cambio a horario de verano (23 horas) y el del cambio a horario de
  invierno (25 horas), When se calcula el rango de instantes de ese día, Then cubre el día completo
  y es contiguo con el del día anterior y el siguiente, sin solaparse ni dejar huecos.
- **AC-E2**: Given registros con instante 00:00:00.000 y 23:59:59.999 hora Chile del día D, When se
  filtra por D, Then ambos aparecen en D y en ningún otro día.
- **AC-E3**: Given las 23:30 hora Chile del 31 de diciembre, When se calcula "hoy", "mes actual" y
  el año de un folio o nombre de archivo, Then corresponden al año que termina.
- **AC-E4**: Given una fecha pura (nacimiento, vencimiento de licencia o documento, inicio de
  promoción), When se muestra o se compara con hoy en cualquier zona horaria del equipo, Then no se
  desplaza un día.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Corregir datos ya guardados con el día corrido (backfill histórico). Descartado por Matías:
  la BD es de desarrollo.
- ❌ Soportar sucursales en otra zona horaria. Todo el negocio opera en `America/Santiago`.
- ❌ Cambiar reglas de negocio de los cron (qué hacen); solo cuándo corren y con qué día.
- ❌ Rediseñar el formato visual de fechas (dd-mm-aaaa, textos). Solo cambia la zona con que se
  calculan.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `core/utils/date.utils.ts` (`todayIso`, `toISODate`, `getChileDateTimeRange`, `to24hTime`).
- `scripts/architect.js` y `npm run lint:arch` como lugar de los guardrails.
- `e2e/transversal-shell.spec.ts` caso `T02` (ya presente en `fix/detalles-finales`).
- Edge functions que ya fijan `America/Santiago` (`student-payment`, `public-enrollment`,
  `_shared/enrollment-sheet-format`) como modelo.

### Capacidades nuevas requeridas
- Util de día de negocio en hora Chile para la app, y su equivalente en
  `supabase/functions/_shared/`.
- Función SQL única para "hoy en Chile".
- Reglas nuevas en `lint:arch` que cubran `src/app` y `supabase/functions`.
- Corrida de tests unitarios con zona horaria forzada (`TZ`).

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna tabla nueva. Se redefinen las policies, funciones, vistas,
  triggers y RPC listados en `inventario.md` §6. Cambio de tipo de columna solo si AC10 encuentra
  alguna `timestamp` sin zona.
- Modelos UI nuevos: ninguno.
- RLS requerida: se reescribe la policy de `cash_closings` de la secretaria; sin cambio de
  permisos, solo del día de referencia.
- Las migraciones las aplica Matías; cada una se entrega como archivo idempotente.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): sin cambio visual. Cambia qué fecha proponen los formularios y qué
  registros entran en cada día en Caja, Dashboard, Reportes, Auditoría, Flota y Asistencia.
- Flujo principal (happy path): igual al actual.
- Estados especiales (loading, error, vacío): sin cambios.

---

## 8. Métricas de éxito post-launch

- Cero diferencias entre la Caja del día y los cobros registrados después de las 20:00.
- `npm run lint:arch` sin excepciones nuevas de fecha en los tracks siguientes.

---

## 9. Notas / decisiones abiertas

- [x] Matías aprobó las historias y los criterios de aceptación (2026-10-08).
- [x] Datos históricos con el día corrido: **no se corrigen** (Matías, 2026-10-08: "estamos en
      dev"). No hay track de backfill.
- [x] Corte de inasistencias: **21:00 hora Chile fija todo el año** (Matías, 2026-10-08). Hoy
      corre a las 01:00 UTC, que es 21:00 en invierno y 22:00 en verano.
- Inventario por capa: `inventario.md` en esta carpeta.
- Pedido de Matías (2026-10-08): asegurar que al cerrar no queden problemas de zona horaria en
  ninguna capa. Aristas a auditar antes de planificar, cada una con su inventario:
  1. **Escritura de "hoy"** en la app y en edge functions (el inventario §1.8).
  2. **Lectura**: timestamps de la BD convertidos a fecha con `slice(0, 10)` / `split('T')`, que
     dan el día UTC del registro.
  3. **Rangos de filtro por día o mes** sobre columnas `timestamptz` (inicio y fin del día en
     Chile, no en UTC).
  4. **Tipos de columna**: `date` vs `timestamptz` vs `timestamp` sin zona, y defaults como
     `CURRENT_DATE` o `now()`.
  5. **SQL que deriva fechas**: `CURRENT_DATE`, `NOW()::date`, `date_trunc` en policies, funciones,
     vistas, triggers y RPC.
  6. **Cron y hora de corte** (cierre nocturno, `no_show`, cadencia de promociones).
  7. **Presentación**: fechas y horas formateadas sin zona explícita, PDFs y reportes generados en
     edge functions.
  8. **Cambio de horario** (días de 23 y 25 horas) y el borde de medianoche.
  9. **Guardrail**: regla en `npm run lint:arch` que bloquee el patrón para que no vuelva a entrar.
- Criterio de Matías (2026-10-08): el objetivo no es corregir ocurrencias sino **normalizar**, de
  modo que el error no se pueda volver a escribir. Modelo propuesto, a validar en el plan:
  1. Un instante se guarda siempre como `timestamptz`; un día de negocio, siempre como `date`.
     Ninguna columna `timestamp` sin zona.
  2. Pasar de instante a día (y de día a rango de instantes) ocurre en un único lugar por capa:
     una util en la app, la misma en `_shared` de las edge functions y una función SQL. Nadie más
     calcula "hoy" ni corta un timestamp.
  3. Todo lo que se muestra o imprime se formatea con `America/Santiago` explícito.
  4. Los guardrails bloquean cualquier camino alternativo (app, edge functions y migraciones).
  5. La suite corre con el proceso en UTC y en otra zona, para que depender del reloj local falle.
- Pendiente de decidir: **datos ya guardados con el día corrido** (pagos, anticipos, egresos y
  ventas registrados de noche). Normalizar arregla lo nuevo; lo histórico requiere un backfill
  aparte, y solo es recuperable donde exista un `created_at` junto a la fecha.
- Sugerencias heredadas de la asignación: crear la util primero y reemplazar por tandas; revisar los
  cron (hora de corte del `no_show`); tests con fechas fijas a las 22:00 y 23:59 hora Chile,
  incluido el cambio de horario; al terminar, quitar la marca `knownBug` de `T02` y correr
  `npx playwright test e2e/transversal-shell.spec.ts -g T02` contra el build de producción.
- Originado de Asignación ASG-i-054 (specs/assignments/ASG-i-054-fechas-de-negocio-en-utc.md)

---

## Changelog

- 2026-10-08 — draft inicial por Matías (reclamada desde ASG-i-054)
- 2026-10-08 — alcance ampliado a normalización completa (app, edge functions, BD); historias y
  AC aprobados por Matías; status → approved

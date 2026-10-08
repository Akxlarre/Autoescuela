# Spec 0024-m — Fechas de negocio en hora de Chile

> **Status:** draft
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
(1 frase. Qué creemos que mejora cuando esto exista. Métrica si aplica.)

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

- ❌ {{cosa que NO va}}
- ❌ {{otra cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- (IDs de specs que deben estar `done` antes, o "ninguna")

### Capacidades del proyecto que se asumen existentes
- (ej. "AuthFacade con currentUser()", "tabla `users` con RLS")

### Capacidades nuevas requeridas
- (ej. "tabla `pre_enrollments` nueva", "endpoint público sin auth")

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: …
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): …
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [ ] {{pregunta pendiente para el usuario}}
- [ ] {{decisión a tomar antes de planificar}}
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
- Sugerencias heredadas de la asignación: crear la util primero y reemplazar por tandas; revisar los
  cron (hora de corte del `no_show`); tests con fechas fijas a las 22:00 y 23:59 hora Chile,
  incluido el cambio de horario; al terminar, quitar la marca `knownBug` de `T02` y correr
  `npx playwright test e2e/transversal-shell.spec.ts -g T02` contra el build de producción.
- Originado de Asignación ASG-i-054 (specs/assignments/ASG-i-054-fechas-de-negocio-en-utc.md)

---

## Changelog

- 2026-10-08 — draft inicial por Matías (reclamada desde ASG-i-054)

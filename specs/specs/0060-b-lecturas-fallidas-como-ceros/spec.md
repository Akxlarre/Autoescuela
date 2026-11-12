# Spec 0060-b — Una lectura que falla se ve como error, no como ceros o "sin datos"

> **Status:** approved (owner, 2026-11-10)
> **Created:** 2026-11-10
> **Owner:** Akxlarre
> **Priority:** P1
> **refs:** ASG-b-102 · `fix-190-b` §X01 (hallazgo) · `fix-189-b` (Agenda) y `fix-044-i` (Caja
> Diaria) como implementaciones de referencia · `fix-362-m` (guard de escrituras, mismo mecanismo)

---

## 1. Contexto de negocio

**Confirmado en vivo** (`fix-190-b`, caso X01, build de producción, 2026-10-07): con la app ya
abierta se cortó la red hacia Supabase y se navegó por el menú de la secretaria. De 15 pantallas,
11 mostraron $0, 0 o "sin datos" sin ningún aviso. El usuario no puede distinguir "no hay nada" de
"no cargó", y puede tomar una decisión con un número falso (cobrar, informar una deuda, dar un día
por cuadrado).

**Causa:** supabase-js no lanza cuando una consulta falla, devuelve `{ data, error }`. El facade lee
`const { data } = await q`, descarta `error` y sigue con `data ?? []`. Un segundo origen: el
`refreshSilently()` del patrón SWR atrapa todo con un `catch` vacío, y así lo enseña el ejemplo de
`.claude/rules/swr-pattern.md`.

**Qué cambió desde la asignación (revisión del 2026-11-10):**

- **La Caja Diaria ya está corregida** (`fix-044-i`, cerrado el 2026-10-10): sus lecturas lanzan,
  la pantalla avisa con "Reintentar" y el cierre queda bloqueado si la carga falló. Sale del
  alcance de cambios y pasa a ser referencia, junto con Agenda (`fix-189-b`).
- **El problema es más ancho que 11 pantallas.** Un conteo sobre `src/app/core/facades/` encontró
  al menos **85 lecturas que descartan `error`, en 25 de 63 facades**. Es un piso: el conteo no ve
  desestructuraciones en varias líneas. Incluye facades que la asignación no nombraba
  (`enrollment`, `dashboard`, `dashboard-alerts`, `admin-alumnos`, `admin-alumno-detalle`).
- **No se crea una abstracción nueva** (wrapper de consultas, `resource()`, componente
  "boundary"). Se evaluó y se descartó: el defecto es una línea que falta por lectura, y los
  facades ya tienen convenciones propias (SWR, `createRequestGuard`, Realtime, sede activa) que una
  primitiva nueva obligaría a migrar sin beneficio para el usuario.

Lo que sí hace falta, y es la parte estructural de esta spec, es **un guard que impida que el
defecto vuelva**: el mismo mecanismo que `unchecked-writes.guard.spec.ts` (`fix-362-m`) usa para las
escrituras, aplicado a las lecturas, con una lista de pendientes que se vacía por etapas.

## 2. User Stories

- Como **secretaria o admin**, si una pantalla no pudo cargar sus datos, quiero verlo dicho y
  poder reintentar, para no confundir una falla con "no hay nada".
- Como **secretaria o admin**, si estaba viendo datos y una actualización en segundo plano falla,
  quiero seguir viéndolos con un aviso de que pueden estar desactualizados.
- Como **dev del equipo**, quiero que los tests fallen si agrego una lectura que descarta su
  error, para que el problema no reaparezca en la próxima pantalla.

## 3. Contrato

### 3.1 En el facade

1. **Toda lectura revisa `error` y lanza** (`if (error) throw error`) antes de usar `data`.
   `data ?? []` solo es válido después de ese chequeo.
2. **Carga con varias consultas:** si los datos se combinan en un mismo total, tabla o KPI, basta
   que una falle para que la carga completa cuente como fallida. No se muestran totales armados con
   una parte de los datos.
3. **Una carga que termina bien borra el error**; el reintento y el cambio de filtro lo limpian al
   empezar.
4. El facade expone `error()` y un método público para reintentar.

### 3.2 Dos casos de falla, con resultado distinto

| Caso | Qué pasa con lo que había en pantalla | Qué ve el usuario |
|---|---|---|
| **A. Primera carga**, o **cambio de consulta** (filtro, período, sede, semana) | No se muestra como vigente: los datos de la consulta anterior se retiran | Estado de error con "Reintentar", en el lugar de la lista y de los KPIs. Nunca 0, $0 ni "sin datos" |
| **B. Refresco de la misma consulta** (re-entrada SWR, Realtime, después de guardar) | Se mantiene | Los datos, más un aviso de que no se pudieron actualizar, con "Reintentar" |

En el caso B, una acción que **guarda un valor calculado con esos datos** queda bloqueada hasta que
una carga termine bien (precedente: `cargaFallida` bloquea "Cerrar caja").

### 3.3 En la pantalla

- Sin componentes nuevos: `@if` nativo con `app-empty-state` (caso A) o `app-alert-card` (caso B).
- Los KPIs del hero siguen la misma regla: con la carga fallida no muestran 0.

## 4. Acceptance Criteria

- **AC1 — Guard de lecturas.** Existe `unchecked-reads.guard.spec.ts` junto al de escrituras:
  recorre los facades y falla si una lectura a Supabase descarta su `error`. Tiene su lista
  `PENDING` con los facades aún no migrados y tests propios del detector (incluida la
  desestructuración en varias líneas).
- **AC2 — Regla corregida.** `swr-pattern.md` y `facades.md` muestran el contrato de §3: el ejemplo
  de `refreshSilently()` deja de ser un `catch` vacío y distingue los casos A y B.
- **AC3 — Caso A.** En cada pantalla migrada, con la consulta cortada en la primera carga aparece
  el estado de error con "Reintentar"; ni la lista ni los KPIs muestran 0, $0 o "sin datos".
- **AC4 — Cambio de consulta.** Si al cambiar filtro, período o sede la nueva consulta falla, no
  quedan en pantalla los datos de la anterior.
- **AC5 — Caso B.** Un refresco en segundo plano que falla no borra lo visible y muestra el aviso.
- **AC6 — Recuperación.** "Reintentar" con la red de vuelta carga los datos y el aviso desaparece.
- **AC7 — Carga combinada.** Si falla una de varias consultas que alimentan un mismo total, la
  pantalla entra en error; no muestra un total parcial.
- **AC8 — Regresión E2E.** El método de X01 (abortar `rest/v1` con `page.route` y navegar por el
  menú) queda en `e2e/transversal-shell.spec.ts` y cubre las pantallas migradas.
- **AC9 — Cierre.** `PENDING` queda vacío. Un facade que se decida no migrar sale de la lista con
  una excepción escrita y su motivo, no en silencio.

## 5. Etapas (un PR por bloque; cada uno saca sus facades de `PENDING`)

| Etapa | Contenido |
|---|---|
| **0 — Base** | AC1 y AC2. El guard nace con todos los facades afectados en `PENDING`: esa lista es el alcance real y reemplaza al conteo aproximado de §1 |
| **1 — Dinero** | `pagos`, `reportes-contables`, `liquidaciones`, `dashboard`, `enrollment-payment` |
| **2 — Lecturas que alimentan una escritura o una decisión** | `enrollment`, `admin-alumno-detalle`, `cursos-singulares`, `servicios-especiales`, `certificacion-clase-b` |
| **3 — Listas y gestión** | `dms`, `instructores`, `asistencia-clase-b`, `tasks`, `admin-alumnos`, `dashboard-alerts` y el resto de `PENDING`. Incluye los KPIs en 0 de Alumnos y Ex-Alumnos |

El orden dentro de cada etapa y el reparto exacto se ajustan en `/spec-plan`, con la lista que
entregue el guard. `liquidaciones`, `reportes-contables` y `servicios-especiales` no aparecieron en
el conteo aproximado pero fallaron en X01: revisar a mano por qué (lectura en varias líneas, o un
error que se captura y la pantalla no muestra).

## 6. Out of scope

- **Caja Diaria** (`cuadratura.facade.ts`) y **Agenda**: ya cumplen el contrato; no se tocan.
- Wrapper de consultas, `resource()` / `rxResource()` o un componente "boundary".
- Lecturas hechas fuera de `core/facades/` (hay 2 en `core/services/ui/`, de impresión): se anotan
  para una asignación aparte si el guard las deja fuera.
- Escrituras que fallan en silencio: cubiertas por `fix-362-m` y su guard.
- **Que el cierre de caja calcule los totales en el servidor.** Hoy `cerrarCaja()` guarda los
  totales que calcula el navegador y no recarga antes de guardar; `cargaFallida` solo se activa si
  una carga falla, no si el tiempo real deja de llegar sin que se dispare ninguna. Riesgo menor,
  distinto de este: se propone como asignación aparte.

## 7. Decisiones del owner (2026-11-10)

1. **Caso B, alcance del bloqueo:** con datos sin actualizar se bloquean solo las acciones que
   guardan un valor calculado con los datos en pantalla. El resto de las escrituras sigue
   disponible y valida en la BD.
2. **Lectura secundaria que falla** (un catálogo o un nombre que acompaña a la lista, sin entrar en
   ningún total): se decide por pantalla en el plan, entre error completo o lista visible con
   aviso. En las pantallas de dinero, siempre error completo.
3. **Textos:** un mensaje por pantalla, como hoy en Agenda y Caja, con el mismo botón
   "Reintentar".

## 8. Riesgos

- **Pantallas que hoy "funcionan" van a mostrar error.** Una lectura que falla siempre por RLS o
  por una columna inexistente hoy pasa desapercibida; al lanzar, va a aparecer. Es el efecto
  buscado, pero cada etapa debe probarse con cada rol antes de salir.
- **Solapes:** `fix-073-i` (testing de Contabilidad, en curso) recorre las pantallas de la etapa 1;
  coordinar con Ignacio antes de empezarla.
- Los tests de facade que simulan `{ data: null }` sin `error` siguen pasando; los que simulen un
  error van a cambiar de resultado esperado.

## 9. Notas / decisiones abiertas

- **2026-11-10:** alcance y enfoque revisados contra el código antes de redactar (ver §1). Se
  descartó la abstracción nueva y se sumaron el guard, la corrección de la regla SWR y la
  distinción de los casos A y B, que el alcance sugerido de la asignación no traía.
- Originado de Asignación ASG-b-102 (specs/assignments/ASG-b-102-lecturas-fallidas-como-ceros.md)

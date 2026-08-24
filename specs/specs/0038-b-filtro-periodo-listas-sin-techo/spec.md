# Spec 0038-b — Ventana de período en listas históricas (sin atrapar la búsqueda)

> **Status:** done
> **Created:** 2026-08-22
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** `ASG-b-087`, derivada de la investigación `docs/research/listas-grandes-virtual-scroll.md`
(§2, §2.1, §5.1 y §6) y estresada con `/grill_me` el 2026-08-03.

**Convertida desde `fix-149-b`** el 2026-08-22, a pedido del owner: la implementación terminó
tocando 9 archivos y 4 superficies distintas, más allá de lo que el contrato de un `fix` describe
bien. **La conversión no cambió una línea de código** — solo reformula el contrato ya cumplido con
ACs verificables. El track `fix-149-b` queda como `superseded` apuntando acá.

**Persona afectada:** Admin y Secretaria (revisión de listas históricas: ex-alumnos Clase B,
ex-alumnos Profesional, historial de ventas de servicios especiales).

**Problema que resuelve:**
Tres listas históricas crecen sin techo y sin ventana de tiempo por defecto. Pero el problema de
fondo **no es performance** — es que la solución obvia (acotar por período) introduce dos fallas
peores si se implementa sin cuidado:

1. Buscar a un alumno con matrícula de hace 2 años devuelve **"0 resultados"**, y el usuario
   concluye que el alumno no existe. En una lista de *personas*, donde el caso de uso típico de
   secretaría es exactamente "¿tenemos algo de esta persona?", es el peor tipo de bug: silencioso.
2. Exportar **trunca el historial sin avisar**. Peor que (1), porque una planilla incompleta no
   "grita" el error como sí lo hace un buscador con 0 resultados.

**Hipótesis de valor:**
Una ventana por defecto acota la vista de exploración sin comprometer nunca la capacidad de
encontrar un registro viejo ni de exportar el historial completo.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero que las listas históricas se abran acotadas a lo reciente, para
  no navegar años de registros cada vez que entro.
- **US2**: Como Secretaria, quiero que buscar por nombre/RUT/expediente encuentre a la persona
  **sin importar cuándo egresó**, para no concluir que no existe cuando sí está.
- **US3**: Como Admin, quiero un **único** control de tiempo por lista, para que dos filtros no se
  contradigan entre sí.
- **US4**: Como desarrollador, quiero que la regla "el período nunca atrapa a la búsqueda" viva en
  una función pura testeable, para no reimplementarla distinto en cada lista.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given una lista histórica sin búsqueda activa, When se abre, Then muestra por defecto
  solo los registros de los **últimos 12 meses**, y el control refleja esa ventana.
- **AC2**: Given un término de búsqueda activo, When existe un registro **fuera** de la ventana que
  coincide, Then ese registro **se muestra igual**. La ventana no aplica mientras haya búsqueda.
- **AC3**: Given una búsqueda activa, Then la UI comunica que el alcance cambió con la nota
  **"Buscando en todo el historial"** bajo el selector, en vez de que el control mienta sobre lo
  que se está mostrando.
- **AC4**: Given cualquier exportación, Then parte del **dataset completo**, nunca de la vista
  recortada por la ventana.
- **AC5**: Given ex-alumnos Clase B, Then existe **un solo** control de tiempo: el selector de
  período absorbe los años concretos como opciones (`Últimos 12 meses` / `Todo el historial` /
  cada año presente en los datos). El filtro de año suelto se elimina.
- **AC6**: Given la lista de deudores (`PagosFacade`), Then la query aplica `.limit(200)`,
  ordenada por saldo descendente.
- **AC7**: Given el control de período, Then es un **Dumb compartido** (`app-period-selector`)
  reutilizado por las 4 superficies, no una recomposición por página.

### Edge cases obligatorios

- **AC-E1**: Given un registro **sin fecha**, When se aplica cualquier ventana, Then el registro
  **se conserva**. Descartarlo sería perder datos en silencio, que es justo lo que esta spec
  existe para evitar.
- **AC-E2**: Given un usuario que elige un **año viejo** (ej. 2024) en ex-alumnos Clase B, Then ve
  los registros de ese año — la ventana por defecto **no** puede vaciar el resultado. (Este era el
  bug real de tener dos controles de tiempo compitiendo.)
- **AC-E3**: Given "Limpiar filtros", Then el período vuelve al **default acotado**, no a "todo el
  historial": limpiar devuelve la vista a su estado inicial, no la deja sin techo.
- **AC-E4**: Given un egresado que egresó en **diciembre**, When la ventana es de 12 meses, Then
  entra correctamente — la comparación usa la fecha completa, no solo el año.

---

## 4. Out of scope

- **Virtual scroll** y migración de tablas hand-rolled a `p-table` → `ASG-b-088`, con benchmark
  empírico como entregable. Independiente: esta spec no lo bloquea ni depende de él.
- **`liquidaciones`**: investigada y descartada — ya está scopeada por mes
  (`liquidaciones-content.component.ts:739-748`).
- **Consolidar las 2 páginas duplicadas de ex-alumnos Clase B** → `ASG-b-096`. Esta spec cablea el
  selector **dos veces a sabiendas** para no bloquear una P1 con un refactor sin dueño.

---

## 5. Notas / decisiones

1. **El filtro es de renderizado, no de query.** El dataset completo se sigue trayendo de BD; si el
   período fuera un `.gte()` en la query, los registros viejos no estarían en memoria y la
   búsqueda no podría encontrarlos. Esta decisión es la que hace posible AC2.
2. **Componente compartido, no inline** (AC7). Son 4 puntos de consumo; recomponerlo 4 veces es
   exactamente cómo se llegó a los 221 overlines ad-hoc de `fix-078-b`.
3. **Nota en vez de deshabilitar el selector** (AC3), decisión del owner: un control que se apaga
   solo se lee como bug.
4. **Unificar el filtro de año** (AC5), decisión del owner. No era cosmético — ver AC-E2.
5. En **ex-alumnos Profesional** no hay unificación que hacer: su otro filtro es por *clase*, una
   faceta independiente del tiempo.
6. Originado de la Asignación `ASG-b-087` (`specs/assignments/ASG-b-087-*.md`).

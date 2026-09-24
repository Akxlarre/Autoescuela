# Fix: DateInputComponent — colisión de ID rompe formularios con 2+ fechas

> id: fix-038-i-date-input-id-colision
> refs: fix-037-i-qa-visual-piloto
> status: done
> created: 2026-09-22
> closed: 2026-09-24

## Root Cause

`DateInputComponent` (`src/app/shared/components/date-input/date-input.component.ts:50`)
declara `id = input<string>('date')` — el mismo valor por defecto `'date'` para **toda**
instancia que no reciba un `[id]` explícito. El template interno usa ese id tanto en
`<label [attr.for]="id()">` como en `<p-datepicker [inputId]="id()">`.

Cuando una vista renderiza 2+ `<app-date-input>` sin pasarles `[id]` propio, el DOM termina
con IDs duplicados (HTML inválido: dos `<input id="date">`). Efecto observado en vivo
(matrícula Profesional, `personal-data.component.html`): el navegador asocia ambos
`<label for="date">` al mismo input (el `aria-label` accesible fusiona los dos labels en
uno), y el segundo campo de fecha de la vista no retiene el valor que el usuario selecciona
en el calendario — bloqueando el submit del formulario (botón "Guardar y Continuar" nunca se
habilita).

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), recorrido "Matricular alumno
nuevo Profesional": Licencia previa + Fecha de obtención de licencia previa no se pueden
completar juntas.

## ACs Afectados

Ninguno — fix autónomo, hallazgo de QA sin spec previa.

- AC-1: en `personal-data.component.html`, con Tipo de Licencia = Profesional, se puede
  seleccionar "Fecha de nacimiento" Y "Fecha de obtención de la licencia previa"
  independientemente — ambos valores persisten y el wizard permite continuar.
- AC-2: `admin-pagos.component.ts`, `secretaria-pagos.component.ts`,
  `reportes-contables-content.component.ts` y `admin-auditoria.component.ts` — los filtros de
  rango de fecha (desde/hasta) funcionan independientemente uno del otro.
- AC-3: no quedan dos `<app-date-input>` en la misma vista compartiendo el id por defecto
  `'date'` (verificable: cada instancia con 2+ hermanas en el mismo archivo pasa `[id]`
  único).

## Cambio

- **`personal-data.component.html`** — agregar `[id]="'birthDate'"` al `<app-date-input>` de
  Fecha de nacimiento y `[id]="'licenseDate'"` al de Fecha de obtención de licencia previa.
- **`admin-pagos.component.ts`** — id único a cada una de las 4 instancias (ej.
  `'pagos-desde'`, `'pagos-hasta'`, y equivalentes del segundo par si aplica).
- **`secretaria-pagos.component.ts`** — mismo criterio, 4 instancias.
- **`reportes-contables-content.component.ts`** — id único a las 2 instancias.
- **`admin-auditoria.component.ts`** — id único a las 2 instancias.
- **`admin-pre-inscrito-drawer.component.ts`** — verificar la instancia que hoy no tiene
  `[id]` y agregárselo si comparte vista con la que sí lo tiene.
- Fuera de alcance: no se toca `DateInputComponent` en sí (evaluar en un fix aparte si
  conviene generar un id único automático por defecto, para que este bug no se repita en
  componentes futuros que olviden pasar `[id]`).

## Test de Regresión

- Nuevo test en `personal-data.component.spec.ts`: con `selectedCategory() === 'professional'`,
  setear `birthDate` y `licenseDate` a valores distintos vía `emitField` y confirmar que
  ambos quedan en el objeto `data()` esperado sin pisarse.
- `npm run test:ci` completo debe quedar verde.
- Manual: `/verify` en matrícula Profesional confirmando que ambas fechas se pueden
  seleccionar y el botón "Guardar y Continuar" se habilita.

## Evidencia de Verificación

- **2026-09-22, QA de `fix-037-i-qa-visual-piloto` (Bloque C, recorrido Pagos):** probé
  específicamente `admin-pagos.component.ts` — Matrícula desde (07/09/2026) y Matrícula hasta
  (20/09/2026), seleccionadas vía el ícono de calendario de cada campo — **ambos valores se
  retuvieron correctamente y de forma simultánea**, sin el síntoma descrito en el Root Cause. No
  se reprodujo la pérdida de valor en este componente con este patrón de interacción (clic en el
  ícono, no en el `<label>`). **Antes de implementar el fix**, re-verificar si:
  (a) `admin-pagos.component.ts` en verdad no está afectado (quizás ya pasa `[id]` únicos, o el
  navegador resuelve el `<label for="date">` duplicado de otra forma cuando no se hace click en
  el texto del label), o (b) el bug solo se dispara al hacer click en el `<label>` en vez del
  ícono — en cuyo caso el repro original (matrícula Profesional) usó ese camino y este no. No
  cambia el diagnóstico de causa raíz (el HTML sigue siendo inválido, 2 `id="date"` duplicados),
  pero sí puede reducir el alcance real de componentes con síntoma visible — confirmar antes de
  tocar los 5-6 archivos listados en Cambio.

- **2026-09-22, mismo recorrido — repro más grave, cross-componente:** al abrir el drawer
  "Registrar Pago" (que tiene su propio `<app-date-input>` para "Fecha de pago", también sin
  `[id]` único) **por encima** del filtro "Matrícula desde"/"Matrícula hasta" de la lista de
  fondo, el `combobox` del filtro "Matrícula desde" cambió su nombre accesible a "FECHA DE PAGO
  *" (el label del drawer) sin que el usuario tocara ese campo — confirmado en el snapshot de
  accesibilidad (Playwright), el `id="date"` duplicado hace que el navegador asocie el
  `<label for="date">` del drawer con el `<input id="date">` del filtro de fondo, no con el
  input del propio drawer. Sin error de consola, pero es un bug de accesibilidad real: un
  lector de pantalla anunciaría el campo equivocado. Refuerza que el fix debe cubrir **todo**
  `<app-date-input>` sin `[id]`, no solo los que muestran pérdida de valor visible.

- **2026-09-24, verificación de la implementación:**
  - **Alcance real vs. lo listado originalmente en Cambio:** se verificó archivo por archivo
    (no se parcheó a ciegas) cuáles de los 6 candidatos tienen efectivamente 2+
    `<app-date-input>` sin `[id]` en la misma vista. Confirmado con grep que los otros 15
    archivos del proyecto que usan `<app-date-input>` tienen exactamente 1 instancia cada uno
    (sin riesgo de colisión intra-archivo) — deliberadamente no tocados, para no exceder el
    alcance del fix.
  - Se agregó `[id]` único a: `personal-data.component.html` (`birthDate`/`licenseDate`),
    `admin-pagos.component.ts` (4 instancias: filtro desde/hasta + reporte desde/hasta),
    `secretaria-pagos.component.ts` (4 instancias, mismo patrón),
    `reportes-contables-content.component.ts` (2 instancias),
    `admin-auditoria.component.ts` (2 instancias),
    `admin-pre-inscrito-drawer.component.ts` (2 instancias: fecha obtención licencia + fecha
    emisión HVC).
  - **Hallazgo adicional durante la implementación:** `registrar-pago-drawer.component.ts` no
    estaba en la lista original de Cambio, pero es precisamente el componente que causó la
    colisión cross-componente documentada arriba (2026-09-22, "Registrar Pago" sobre el filtro
    de Pagos). Se le agregó `[id]="'registrar-pago-fecha-pago'"` a su único
    `<app-date-input>`. Confirmado vía grep que `secretaria-pagos.component.ts` reutiliza este
    mismo `RegistrarPagoDrawerComponent` (no hay una variante propia de secretaria que también
    necesitara el fix).
  - `npm run test:ci`: 2619/2624 tests verdes (los 5 restantes son fallos preexistentes no
    relacionados a este fix). Nuevo test en `personal-data.component.spec.ts` (17/17 en
    standalone) cubre la parte testeable en Vitest: que `emitField('birthDate', ...)` y
    `emitField('licenseDate', ...)` no se pisan a nivel de estado — el bug real era de DOM
    (`id` duplicado), no reproducible en Vitest en este proyecto (template rendering excluido,
    ver nota en el spec). `tsc` limpio.
  - **AC-1 (matrícula Profesional) — verificado en vivo con Playwright** contra `ng serve`:
    login admin → `/app/admin/matricula` → sede "Conductores Chillán" → tipo de licencia
    "Profesional" → tipeado "15031995" en Fecha de nacimiento y "10062020" en Fecha de
    obtención de la licencia previa. Snapshot de accesibilidad confirmó ambos campos con
    nombre accesible único (`combobox "Fecha de nacimiento *"` = 15/03/1995,
    `combobox "Fecha de obtención de la licencia previa *"` = 10/06/2020) — ningún valor se
    pisó ni se perdió. El botón "Guardar y Continuar" permanece deshabilitado en este punto,
    pero por los demás campos requeridos sin completar (Licencia previa, curso, email), no por
    el bug de este fix.
  - **AC-2 (filtros Pagos) — verificado en vivo con Playwright** en `/app/admin/pagos`:
    tipeado "01012026" en "Matrícula desde" y "30062026" en "Matrícula hasta". Snapshot
    confirmó ambos comboboxes con nombre accesible propio y valor independiente
    (`combobox "Matrícula desde"` = 01/01/2026, `combobox "Matrícula hasta"` = 30/06/2026), y
    la lista se refiltró correctamente a "0 de 37 alumnos" (comportamiento esperado para ese
    rango) — confirma que el filtro no solo retiene el valor visual, sino que también dispara
    la lógica de filtrado con el valor correcto de cada campo.
  - **AC-3:** cumplido por construcción — cada instancia tocada recibió un `[id]` único y
    descriptivo; ninguna vista queda con 2+ `<app-date-input>` compartiendo el default `'date'`.

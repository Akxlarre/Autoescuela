# Spec 0039-b — La matrícula como dato principal (rename de dominio + jerarquía + buscador)

> **Status:** draft
> **Created:** 2026-08-24
> **Owner:** b
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-b-049`, nacida de la reunión con el cliente del 2026-07-28
(*"Número matrícula debe ser más principal que el nombre del alumno"*) y **grillada el 2026-08-23**
con evidencia física aportada por el dueño. 10 decisiones cerradas (D1–D10) + D11 respondida.

**Persona afectada:** Admin y Secretaría (D5 — instructor y portal alumno quedan fuera).

**Problema que resuelve:**

El cliente identifica a los alumnos por **número de matrícula**, no por nombre, y hoy la interfaz
jerarquiza al revés. Peor: el mismo dato se llama de **cuatro formas distintas** (`Expediente`,
`Folio`, `Matrícula N°`, `#0042`) y **"Expediente" nombra dos cosas diferentes en la misma tabla**
— la columna del número y el estado documental — con un filtro rotulado "Expediente" que filtra
el estado, no la columna. El resultado es que el dato por el que la escuela realmente busca no se
puede ni leer con prioridad ni encontrar: el buscador global indexa alumnos pero `matches()` solo
compara nombre y RUT.

**Precisión que aportó la evidencia física:** el número manda en las **pantallas de gestión y en
el carnet** que emite la escuela (etiqueta `MATRICULA` + valor grande recuadrado, separado del
bloque de identidad), **no** en los formularios MTT timbrados por SEREMI, donde el identificador
es el RUT y el orden es por apellido. La anotación original era media verdad; la mitad falsa
acota el alcance.

**Hipótesis de valor:** que la secretaria pueda ir de *"leer un número en un papel"* a *"tener al
alumno en pantalla"* sin traducir por nombre — que es el flujo real de trabajo, y hoy no existe.

---

## 2. User Stories

- **US1**: Como **secretaria**, quiero **buscar un alumno tipeando su número de matrícula** en el
  buscador global, para ir de *"leo un número en un papel"* a *"tengo al alumno en pantalla"* sin
  traducir mentalmente a nombre. **Hoy es imposible.**
- **US2**: Como **admin o secretaria**, quiero **leer el número de matrícula sin buscarlo** en los
  listados, para reconocer al alumno por el dato con el que la escuela realmente lo identifica.
- **US3**: Como **admin o secretaria**, quiero que en las pantallas de detalle el número se lea
  como en el carnet —**etiqueta y valor destacado**— para confirmar de un vistazo que estoy en la
  matrícula correcta antes de cobrar o firmar.
- **US4**: Como **cualquier integrante del equipo**, quiero que el dato **se llame de una sola
  forma** en toda la app, para dejar de traducir entre `Expediente`, `Folio` y `Matrícula N°` —
  y para que un filtro rotulado "Expediente" no filtre otra cosa.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

### Bloque A — Rename de dominio (commit propio, primero)

- **AC1**: Given cualquier pantalla de Admin, Secretaría o el flujo público, When se muestra el
  número de matrícula, Then el rótulo visible es **"Matrícula"** — y no queda ninguna ocurrencia
  de `Expediente`, `Folio` ni `Matrícula N°` referida a ese dato (verificable con grep sobre
  `src/app`).
- **AC2**: Given la lista de alumnos de Admin/Secretaría, When se abre el filtro que hoy se
  rotula **"Expediente"** (`alumnos-list-content:173`), Then se rotula **"Documentos"** y sigue
  filtrando el **estado documental** — el bug de nombre desaparece sin cambiar el comportamiento.
- **AC3**: Given el modelo y el estado de UI, When se completa el rename, Then `AlumnoExpediente`
  y el signal `selectedExpediente` quedan renombrados **sin ninguna migración SQL** — verificado:
  `expediente` no existe como columna ni tabla, solo dentro de `COMMENT ON TABLE`.

### Bloque B — Jerarquía en listados (Admin + Secretaría)

- **AC4**: Given la lista de alumnos, When se renderiza una fila, Then el número de matrícula se
  muestra con **`.item-title`** (deja de ser dato secundario `text-xs`/muted) y **el nombre
  conserva la posición líder** de la fila.
- **AC5**: Given la lista de alumnos, When se carga sin tocar filtros, Then el **orden por defecto
  sigue siendo alfabético** — la lista es de *personas*, no de matrículas.
  > ⚠️ **Corrige D4 tal como estaba escrita** ("orden por número por defecto en tablas de
  > matrículas"): decidido con el owner el 2026-08-24. Ordenar por número mezclaría a la misma
  > persona, porque un alumno con refuerzo tiene 2 números del mismo correlativo (`0006-m`).

### Bloque C — Detalle (drawers, pagos)

- **AC6**: Given una pantalla de detalle cuyo contexto **ya es una matrícula**, When se muestra el
  número, Then se presenta como **etiqueta + valor recuadrado**: `.micro-label` con el texto
  "Matrícula" sobre `.kpi-value`, dentro de un contenedor con borde — replicando el carnet físico.
  **Prohibido `.kpi-label`** (deprecada en `fix-078-b`).
- **AC7**: Given una pantalla de detalle, When el usuario activa la acción de copiar, Then el
  número queda en el portapapeles y se confirma vía **`ToastService`** (nunca `MessageService`),
  con `data-llm-action` y área táctil **≥44×44** desde el día uno.

### Bloque D — Buscador global (Ctrl+K)

- **AC8**: Given un alumno con matrícula `0042`, When se tipea `0042` en el buscador global,
  Then aparece en los resultados.
- **AC9**: Given ese mismo alumno, When se tipea `42` **sin ceros a la izquierda**, Then también
  aparece — la comparación normaliza el padding.
- **AC10**: Given un resultado encontrado por número, When se muestra en la lista, Then el número
  es visible en el resultado (no solo el nombre), para confirmar por qué matcheó.

### Edge cases obligatorios

- **AC-E1**: Given alumnos con matrículas `0420`, `0142` y `4200`, When se tipea `42`, Then
  **ninguno** matchea por número. La comparación exige **match completo** tras normalizar el
  padding, nunca `includes` — sobre 4 dígitos `includes` da falsos positivos constantes (D8).
- **AC-E2**: Given un alumno con **2 matrículas** (`nroExpedientes` es un array por diseño,
  `DG-029`), When se busca por cualquiera de sus dos números, Then aparece **una sola vez** en los
  resultados, no duplicado.
- **AC-E3**: Given dos alumnos de **sedes distintas que comparten número** (la serie es por sede
  — D11), When se busca ese número con la sede en "Todas", Then aparecen ambos y **la sede se
  muestra** como dato secundario para desambiguar.
- **AC-E4**: Given la guarda existente `q.length < 2` (`global-search.facade.ts:96`), When se
  tipea **un solo carácter**, Then no se dispara búsqueda. **Consecuencia aceptada:** una
  matrícula de 1 dígito solo se encuentra tipeándola con padding (`0007`), no como `7`. Si se
  decide lo contrario, hay que bajar la guarda y medir el costo en resultados basura.
- **AC-E5**: Given un alumno **sin matrícula** (`nroExpedientes` viene como `['—']`, ver
  `admin-alumnos.facade.ts:471`), When se busca por número, Then ese alumno **nunca** matchea y
  el `—` no se trata como valor buscable.

---

## 4. Out of scope

> Transcrito de la sección "Alcance resultante → No entra" de `ASG-b-049`. Son decisiones ya
> tomadas en el grill, no re-derivables acá.

- ❌ `/admin/alumnos/:id` y `/secretaria/alumnos/:id` → el requisito se escribe **dentro de
  `ASG-b-085`** (de `i`), que reescribe esas 1654 líneas al patrón de tabs. Tocarlo acá es churn
  garantizado + conflicto en el archivo más grande del repo (D6).
- ❌ Portal instructor y portal alumno (D5). El público entra **solo** por el rename.
- ❌ Listados que replican formularios MTT → van **por apellido** e identifican por **RUT**.
  Ordenarlos por número sería contradecir un documento reglamentado.
- ❌ El **modelo de numeración** (empalme con la serie real de la escuela) → se ejecuta en la
  sincronización de marcha blanca, opción (A) seed de continuidad. Ver `DG-080`.
- ❌ **Carnet imprimible** — es un artefacto real que la escuela ya emite y ningún track cubre,
  pero es una feature nueva, no jerarquía visual. Candidato a asignación propia.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. `ASG-b-085` es **paralela**, no previa: este track le deja el requisito
  escrito para que `i` lo construya correcto de una.

### Capacidades del proyecto que se asumen existentes
- `global-search.facade.ts` con alumnos e instructores ya indexados (`fix-075-b`).
- `adminAlumnos.alumnos()` ya trae `nroExpedientes`; instructor ya trae `enrollmentNumber`.
  **Cero queries nuevas** para el matching por número (D8).
- `ToastService` para el feedback de copiar (nunca `MessageService` de PrimeNG).
- Clases del DS: `.micro-label` y `.kpi-value`. ⚠️ `.kpi-label` está **deprecada** (`fix-078-b`).

### Capacidades nuevas requeridas
- Ninguna a nivel de datos.

---

## 6. Datos y modelo (preliminar)

**No hay migración.** Verificado el 2026-08-24: `expediente` aparece en las migraciones
**solo dentro de `COMMENT ON TABLE`**, nunca como nombre de columna o tabla. El rename es de
TypeScript/UI puro.

- Tablas nuevas / modificadas: **ninguna**.
- Modelos UI: rename de `AlumnoExpediente` y del signal `selectedExpediente`.
- RLS requerida: ninguna.

---

## 7. UX y flujos (preliminar)

- **Pantallas afectadas:** listados de matrículas de Admin/Secretaría, drawers de detalle, pagos,
  y el buscador global (Ctrl+K).
- **Jerarquía (D4):** "más principal" = **orden + peso**, NO agrandar. En listados, `.item-title`.
  En detalle, **etiqueta/valor recuadrado** (`.micro-label` + `.kpi-value` en contenedor con
  borde) — que es literalmente lo que hace el carnet físico.
- **⚠️ La tensión que más fácil se implementa mal (D2 ↔ D4):** en listados **manda el nombre**
  (el número identifica una *matrícula*, no una *persona*), pero el **orden por defecto** de las
  tablas de matrículas **sí** es por número. Conviven: el nombre pesa visualmente, el orden es
  numérico. Leerlo rápido lleva a hacer una de las dos al revés.
- **Copiar (D7):** solo en contextos de detalle, nunca por fila. Área ≥44×44 desde el día uno
  (choca de frente con `ASG-b-093` si no). Precedente: `media-upload-control.component.ts:205`.

---

## 8. Métricas de éxito post-launch

- La secretaria encuentra un alumno tipeando su número en el buscador global — hoy imposible.

---

## 9. Notas / decisiones abiertas

- [ ] **Sigue sin confirmar:** si la serie de matrícula distingue Clase B de Profesional
      (pregunta 2 de D11). El dueño dijo *"es como está en el código"* pero con un *"no lo sé"*
      explícito. El código separa por (sede × grupo). **No bloquea este track** — afectaría al
      empalme de marcha blanca, no a la jerarquía visual.
- [ ] **Falta la mitad izquierda del libro manuscrito histórico** — no sabemos si ahí van N° de
      matrícula, nombre y RUT. Tampoco bloquea.
- [ ] **Alcance del rename confirmado con el owner (2026-08-24): completo.** Se barren los ~41
      archivos que mencionan `expediente`/`folio`, no solo los ~12 estimados en D9. Va en
      **commit propio y primero**: es lo que más conflictúa con el trabajo en vuelo de `m` e `i`,
      y `main` acaba de absorber todo, así que ésta es la ventana más limpia.
- [ ] ⚠️ **Coordinar con `ASG-b-096`** (pendiente, pool abierto): quiere consolidar las 2 páginas
      de ex-alumnos B en un `*-content` compartido. Si alguien la reclama mientras corre el
      rename, hay conflicto. No bloquea hoy.
- [ ] **Supuesto a confirmar — el buscador del instructor hereda el matching por número.**
      `matches(fullName, rut)` (`global-search.facade.ts:102-105`) es **una sola función
      compartida** por el branch `instructor` y el de `admin/secretaria`. Agregar el número solo
      al branch admin cuesta *más* trabajo que agregarlo a la función. Se asume que el instructor
      lo gana de rebote a costo cero, y que **eso no contradice D5**: D5 excluye la *jerarquía
      visual del portal instructor*, no el buscador. Si se prefiere lo contrario, hay que
      bifurcar `matches()` a propósito y decirlo acá.
- [ ] **Verificar el techo de resultados.** Ambos branches cortan con `.slice(0, 5)`. Si un
      número repetido entre sedes cae fuera del corte, AC-E3 no se cumple aunque la lógica de
      matching esté bien. Revisar al planificar.
- Originado de Asignación ASG-b-049 (`specs/assignments/ASG-b-049-numero-matricula-dato-principal.md`)

---

## Changelog

- 2026-08-24 — draft inicial por b, desde `ASG-b-049` (grillada, 10 decisiones + D11 respondida)
- 2026-08-24 — US1-US4 y AC1-AC10 + 5 edge cases escritos con el owner. Se **corrige D4**: el
  listado de alumnos conserva orden alfabético (es lista de personas, no de matrículas)

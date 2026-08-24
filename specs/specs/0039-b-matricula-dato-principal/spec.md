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

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: …

### Edge cases obligatorios

> Sembrados desde el grill — **completar en Gherkin**, no borrar:

- **AC-E1**: Padding del buscador — `42` **no** debe matchear `0420`, `142` ni `4200`. La
  comparación normaliza ceros a la izquierda y exige **match completo**, nunca `includes` (D8).
- **AC-E2**: Alumno con **2 matrículas** (refuerzo Clase B consume número del mismo correlativo,
  spec `0006-m`) — `nroExpedientes` es un array por diseño. Ver `DG-029`.
- **AC-E3**: Número **repetido entre sedes** (la serie es por sede — D11): con sede "Todas", la
  sede acompaña como dato secundario para desambiguar.

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
- Originado de Asignación ASG-b-049 (`specs/assignments/ASG-b-049-numero-matricula-dato-principal.md`)

---

## Changelog

- 2026-08-24 — draft inicial por b, desde `ASG-b-049` (grillada, 10 decisiones + D11 respondida)

# Tasks 0043-b — Usabilidad del compositor y el historial de comunicados

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-09-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y se termina en un sitting.
- Marcá `[x]` apenas pase su DoD.
- **Si aparece la necesidad de una migración, se coló scope** — detenete.

> ⚠️ **Red de seguridad**: los 82 tests de `0041-b`/`0042-b` cubren el envío, el consentimiento y
> la programación. Se corren antes de dar por buena cada fase: esta spec toca la superficie, no el
> comportamiento, y eso tiene que quedar demostrado.

> ⚠️ **Envíos de prueba**: siempre `dryRun`, y todo comunicado de prueba con un segmento que
> resuelva a cero. Los alumnos sembrados tienen dominio inexistente.

---

## Fase 1 — Núcleo funcional del filtrado (TDD)

- [x] **T1.1** — Escribir `core/utils/recipient-filter.utils.spec.ts` **primero**
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] Filtra por nombre sin distinguir mayúsculas ni acentos
    - [x] Sin coincidencias → lista vacía
    - [x] **El conteo de alcance NO cambia al filtrar** (AC-E1) — el test que protege la regla
          "filtrar no es excluir"
    - [x] "Quitar todos" sobre un subconjunto filtrado excluye **solo esos** (AC-E3)
    - [x] "Incluir todos" no puede incluir a quien está excluido por falta de consentimiento
    - [x] Los tests **fallan** antes de implementar

- [x] **T1.2** — Implementar `core/utils/recipient-filter.utils.ts`
  - **DoD:** funciones puras, tests verdes, documentado en `indices/UTILS.md`

---

## Fase 2 — Preview server-side (el frente de riesgo)

- [x] **T2.1** — `previewOnly` en `send-announcement` + `_shared/announcement-send.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] `previewOnly` es la **primera guarda** de la función, antes de cualquier efecto
    - [x] Devuelve `{ html }` con el wrapper de marca y las variables resueltas con datos de ejemplo
    - [x] Reutiliza `renderTemplate()` y el armado de HTML existentes; **no duplica la plantilla**
    - [x] Sigue exigiendo rol admin/secretaría (el preview no es una puerta trasera)

- [x] **T2.2** — Verificar contra la BD real que el preview no produce efectos
  - **AC ref:** AC1
  - **DoD:**
    - [x] Contar `announcement_recipients` y `notifications` antes y después: **iguales**
    - [x] No se envía ningún correo
    - [x] Datos de verificación limpiados

- [x] **T2.3** — `loadPreviewHtml()` en `AnnouncementsFacade` (tests primero)
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [x] Con cuerpo vacío **no llama** a la Edge Function y avisa (AC-E2)
    - [x] Expone el HTML y un signal de carga propio

- [x] **T2.4** — `announcement-preview-drawer.component.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] Muestra el HTML aislado (sin que los estilos del correo contaminen la app)
    - [x] Se abre desde el compositor con `data-llm-action`
    - [x] Estado de carga y de error
    - [x] Documentado en `indices/COMPONENTS.md`

---

## Fase 3 — Lista de destinatarios operable

- [x] **T3.1** — Buscador sobre la lista
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] Patrón de `ex-alumnos-content`: `searchTerm` signal + `computed` filtrado
    - [x] Se puede destildar directamente el resultado filtrado
    - [x] Sin coincidencias → mensaje explícito y **el alcance no se mueve**

- [x] **T3.2** — Acciones masivas
  - **AC ref:** AC4, AC-E3
  - **DoD:**
    - [x] "Quitar" / "Incluir" con el **número exacto que van a afectar** en la etiqueta
    - [x] Con filtro activo operan solo sobre lo visible
    - [x] El conteo de alcance se actualiza

- [x] **T3.3** — Vista de excluidos
  - **AC ref:** AC5
  - **DoD:** se puede ver solo los excluidos con su motivo, sin recorrer la lista entera

---

## Fase 4 — Jerarquía del compositor

- [x] **T4.1** — Secciones colapsables, una abierta a la vez
  - **AC ref:** AC6
  - **DoD:**
    - [x] Patrón del `ajustes-drawer` (signal + `@if` + chevron)
    - [x] Cada sección plegada muestra un resumen de una línea
    - [x] **Una sección incompleta se marca como tal en el resumen** — es lo que evita que el
          colapsable esconda un campo obligatorio vacío (riesgo alto del plan)
    - [x] "Tipo de comunicado" y "Programación" dejan de estar huérfanos: todo bajo una sección
    - [x] El hint del tipo queda **junto al selector de tipo**, no al pie de Destinatarios

- [x] **T4.2** — Medir que se cumple AC6
  - **DoD:** en un viewport de 700 px, el contenido visible por sección no excede el alto del
    viewport y el botón principal es alcanzable. **Medido en el navegador, con número.**

---

## Fase 5 — Historial

- [x] **T5.1** — Estado con peso visual propio
  - **AC ref:** AC7
  - **DoD:** se distingue programado de enviado **sin leer la fila de metadatos**

- [x] **T5.2** — Cancelar con affordance de botón
  - **AC ref:** AC8
  - **DoD:** separado de los metadatos, no un link entre texto gris; sigue con confirmación

- [x] **T5.3** — Texto del segmento diferido
  - **AC ref:** AC9
  - **DoD:** un programado **no dice "0 destinatarios"**; indica que la lista se calcula al enviar

---

## Fase 6 — Plantillas

- [x] **T6.1** — Insertar variable en la posición del cursor
  - **AC ref:** AC10
  - **DoD:** con el cursor a mitad del cuerpo, la variable entra ahí y el cursor queda después

---

## Fase 7 — Validación

- [x] **T7.1** — `npm run lint:arch` exit 0, sin regresión de ratchet
- [x] **T7.2** — `npm run test:ci` verde, **incluidos los 82 tests de 0041-b/0042-b**
- [x] **T7.3** — `npx ng build` exit 0
- [x] **T7.4** — QA manual con **las mediciones que definen los ACs**
  - [x] AC6 medido con número, no a ojo
  - [x] AC1/AC2: preview con `{{nombre}}` sustituido
  - [x] AC7/AC8/AC9 mirados como usuario, no solo verificados por código
- [x] **T7.5** — `acceptance.md` con evidencia por AC

---

## Fase 8 — Cierre

- [x] **T8.1** — `indices/` sincronizados
- [x] **T8.2** — Spec a Done en `ROADMAP.md`
- [x] **T8.3** — `status: done` y `specs/.active` limpio

---

## Tareas descubiertas durante implementación

- [x] **D1** — Volver el `bg-white` del `iframe` del preview a `bg-base`. Lo puse yo en la fase 2
      y disparó el ratchet ARCH-26 (cuota baseline: 0). El correo pinta su propio fondo, así que
      el token del `iframe` solo se ve un instante antes de cargar.
- [x] **D2** — Mover el separador `·` de la línea de estado al final del primer span. Con el
      drawer abierto la fila se angosta y la línea se parte en dos; un punto medio abriendo el
      renglón se lee como un bullet perdido. Solo se ve mirando la pantalla angosta, no el DOM.
- [x] **D3** — Corregir la medición de AC6. Comparaba el alto del elemento del drawer contra el
      viewport, pero ese alto incluye chrome fuera del contenedor scrollable. La medida que el AC
      pide es cuánto hay que scrollear, y es cero.
- [x] **D4** — Limpiar las filas sembradas para el QA del historial con
      `supabase db query --linked`: `announcements` no tiene policy de DELETE (es un registro
      auditable), así que el cliente no puede borrar lo que insertó.

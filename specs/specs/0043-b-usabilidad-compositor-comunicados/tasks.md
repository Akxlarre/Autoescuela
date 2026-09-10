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

- [ ] **T1.1** — Escribir `core/utils/recipient-filter.utils.spec.ts` **primero**
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [ ] Filtra por nombre sin distinguir mayúsculas ni acentos
    - [ ] Sin coincidencias → lista vacía
    - [ ] **El conteo de alcance NO cambia al filtrar** (AC-E1) — el test que protege la regla
          "filtrar no es excluir"
    - [ ] "Quitar todos" sobre un subconjunto filtrado excluye **solo esos** (AC-E3)
    - [ ] "Incluir todos" no puede incluir a quien está excluido por falta de consentimiento
    - [ ] Los tests **fallan** antes de implementar

- [ ] **T1.2** — Implementar `core/utils/recipient-filter.utils.ts`
  - **DoD:** funciones puras, tests verdes, documentado en `indices/UTILS.md`

---

## Fase 2 — Preview server-side (el frente de riesgo)

- [ ] **T2.1** — `previewOnly` en `send-announcement` + `_shared/announcement-send.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] `previewOnly` es la **primera guarda** de la función, antes de cualquier efecto
    - [ ] Devuelve `{ html }` con el wrapper de marca y las variables resueltas con datos de ejemplo
    - [ ] Reutiliza `renderTemplate()` y el armado de HTML existentes; **no duplica la plantilla**
    - [ ] Sigue exigiendo rol admin/secretaría (el preview no es una puerta trasera)

- [ ] **T2.2** — Verificar contra la BD real que el preview no produce efectos
  - **AC ref:** AC1
  - **DoD:**
    - [ ] Contar `announcement_recipients` y `notifications` antes y después: **iguales**
    - [ ] No se envía ningún correo
    - [ ] Datos de verificación limpiados

- [ ] **T2.3** — `loadPreviewHtml()` en `AnnouncementsFacade` (tests primero)
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [ ] Con cuerpo vacío **no llama** a la Edge Function y avisa (AC-E2)
    - [ ] Expone el HTML y un signal de carga propio

- [ ] **T2.4** — `announcement-preview-drawer.component.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] Muestra el HTML aislado (sin que los estilos del correo contaminen la app)
    - [ ] Se abre desde el compositor con `data-llm-action`
    - [ ] Estado de carga y de error
    - [ ] Documentado en `indices/COMPONENTS.md`

---

## Fase 3 — Lista de destinatarios operable

- [ ] **T3.1** — Buscador sobre la lista
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [ ] Patrón de `ex-alumnos-content`: `searchTerm` signal + `computed` filtrado
    - [ ] Se puede destildar directamente el resultado filtrado
    - [ ] Sin coincidencias → mensaje explícito y **el alcance no se mueve**

- [ ] **T3.2** — Acciones masivas
  - **AC ref:** AC4, AC-E3
  - **DoD:**
    - [ ] "Quitar" / "Incluir" con el **número exacto que van a afectar** en la etiqueta
    - [ ] Con filtro activo operan solo sobre lo visible
    - [ ] El conteo de alcance se actualiza

- [ ] **T3.3** — Vista de excluidos
  - **AC ref:** AC5
  - **DoD:** se puede ver solo los excluidos con su motivo, sin recorrer la lista entera

---

## Fase 4 — Jerarquía del compositor

- [ ] **T4.1** — Secciones colapsables, una abierta a la vez
  - **AC ref:** AC6
  - **DoD:**
    - [ ] Patrón del `ajustes-drawer` (signal + `@if` + chevron)
    - [ ] Cada sección plegada muestra un resumen de una línea
    - [ ] **Una sección incompleta se marca como tal en el resumen** — es lo que evita que el
          colapsable esconda un campo obligatorio vacío (riesgo alto del plan)
    - [ ] "Tipo de comunicado" y "Programación" dejan de estar huérfanos: todo bajo una sección
    - [ ] El hint del tipo queda **junto al selector de tipo**, no al pie de Destinatarios

- [ ] **T4.2** — Medir que se cumple AC6
  - **DoD:** en un viewport de 700 px, el contenido visible por sección no excede el alto del
    viewport y el botón principal es alcanzable. **Medido en el navegador, con número.**

---

## Fase 5 — Historial

- [ ] **T5.1** — Estado con peso visual propio
  - **AC ref:** AC7
  - **DoD:** se distingue programado de enviado **sin leer la fila de metadatos**

- [ ] **T5.2** — Cancelar con affordance de botón
  - **AC ref:** AC8
  - **DoD:** separado de los metadatos, no un link entre texto gris; sigue con confirmación

- [ ] **T5.3** — Texto del segmento diferido
  - **AC ref:** AC9
  - **DoD:** un programado **no dice "0 destinatarios"**; indica que la lista se calcula al enviar

---

## Fase 6 — Plantillas

- [ ] **T6.1** — Insertar variable en la posición del cursor
  - **AC ref:** AC10
  - **DoD:** con el cursor a mitad del cuerpo, la variable entra ahí y el cursor queda después

---

## Fase 7 — Validación

- [ ] **T7.1** — `npm run lint:arch` exit 0, sin regresión de ratchet
- [ ] **T7.2** — `npm run test:ci` verde, **incluidos los 82 tests de 0041-b/0042-b**
- [ ] **T7.3** — `npx ng build` exit 0
- [ ] **T7.4** — QA manual con **las mediciones que definen los ACs**
  - [ ] AC6 medido con número, no a ojo
  - [ ] AC1/AC2: preview con `{{nombre}}` sustituido
  - [ ] AC7/AC8/AC9 mirados como usuario, no solo verificados por código
- [ ] **T7.5** — `acceptance.md` con evidencia por AC

---

## Fase 8 — Cierre

- [ ] **T8.1** — `indices/` sincronizados
- [ ] **T8.2** — Spec a Done en `ROADMAP.md`
- [ ] **T8.3** — `status: done` y `specs/.active` limpio

---

## Tareas descubiertas durante implementación

- [ ] …

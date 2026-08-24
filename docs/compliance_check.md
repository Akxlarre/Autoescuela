# Compliance Check — Invariantes y Normativa

> Fuente que consulta la skill `grill_me` (`.claude/skills/grill_me/SKILL.md`) al estresar una
> propuesta de proceso/negocio antes de escribirla a spec. Dos capas:
>
> - **Capa A (Invariantes de integridad):** si una propuesta rompe una de estas reglas, `grill_me`
>   **la bloquea** y lo dice explícitamente. No son opinables — están sacadas de bugs reales que ya
>   costaron un fix/hotfix (`indices/DOMAIN-GOTCHAS.md`) o de la regla de negocio central del
>   producto (`docs/PRODUCT-VISION.md`).
> - **Capa B (Normativa):** si una propuesta cruza estas reglas, `grill_me` **anexa la advertencia
>   citada** pero no bloquea — la secretaría/admin puede decidir seguir bajo su criterio. Son reglas
>   externas (Ley de Tránsito, MTT) o decisiones de negocio confirmadas explícitamente por el owner.
>
> Cada entrada cita su fuente. Si una pregunta del interrogatorio se responde con una entrada de
> aquí, `grill_me` debe consultarla **en vez de preguntar**. Si una propuesta nueva revela una
> invariante o norma no listada, agrégala aquí siguiendo la convención al final.

## Capa A — Invariantes de integridad (bloqueo duro)

### INV-A01 — El Triple Match es innegociable antes de confirmar una clase
Alumno, instructor y vehículo deben verificarse **simultáneamente** disponibles: alumno sin deuda
bloqueante + horas restantes > 0 + documentos vigentes; instructor sin otra clase en ese horario +
licencia habilitada para el tipo de clase; vehículo sin otra clase en ese horario + SOAP y revisión
técnica vigentes. Ninguna propuesta puede saltarse una de las tres patas ni confirmarlas en
secuencia con hueco entre pasos (abre ventana de doble-booking).
**Fuente:** `docs/PRODUCT-VISION.md` §"El Triple Match".

### INV-A02 — Clase B es siempre 12 sesiones; agendar y pagar son independientes
El número de clases agendadas nunca se deriva de `payment_mode` ni de ningún otro campo. Siempre
son 12. Solo el monto cobrado depende de la forma de pago (`total`/`partial`).
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-023 (`fix-017-m`).

### INV-A03 — `class_number` es progreso, no cronología
No bloquear reprogramaciones "fuera de orden" asumiendo que la clase #N debe ocurrir antes que la
#N+1 en el tiempo. Las únicas invariantes reales son: exactamente 12 sesiones, sin doble-booking,
tope diario.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-022 (`fix-031-m`, revirtió `fix-030-m`).

### INV-A04 — Un tope de negocio vive en un solo lugar, nunca duplicado
Cualquier límite (ej. clases máximas por día) debe calcularse desde una única fuente compartida.
Una propuesta que lo reintroduzca hardcodeado en un componente/wizard puntual repite un bug ya
corregido en 4 puntos distintos.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-024 (`fix-062-m`).

### INV-A05 — Un pago nunca puede exceder el saldo pendiente del enrollment
Toda propuesta que registre o modifique pagos debe validar explícitamente contra el saldo real.
No asumir que un `CHECK` de BD ya acota esto — no existe.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-030 (`fix-057-m`).

### INV-A06 — Un alumno puede tener más de una matrícula activa a la vez
Ninguna vista/proceso puede asumir "la matrícula más reciente" como la única relevante — un alumno
con Clase B (deuda pendiente) y Profesional (pagada) son dos matrículas activas simultáneas.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-029 (`fix-058-b`).

### INV-A07 — Un alumno egresado (`enrollments.status = 'completed'`) se excluye de "activos"
Toda propuesta de listado/reporte de alumnos activos debe filtrar `status != 'completed'`. Un
alumno no puede aparecer simultáneamente como activo y como egresado.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-034 (`fix-084-m`).

### INV-A08 — Todo dato/proceso con scope de sede debe filtrar explícitamente por `branch_id`
No asumir que RLS ya resuelve el aislamiento entre sedes — varias policies son deliberadamente
amplias. El filtro real vive en la capa de query (`resolveBranchScope()`/`getActiveBranchId()`).
Toda propuesta que toque un flujo multi-sede nuevo debe declarar explícitamente cómo se filtra.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-014, DG-019, DG-039, DG-040 (`fix-027-b`, `fix-071-m`,
`fix-090-m`, `fix-013-i`). **Nunca "arreglar" esto tocando la RLS de `users`** — reintroduce la
regresión de `fix-002`.

### INV-A09 — Toda migración de BD se commitea a git, nunca solo vía SQL Editor
Una propuesta que implique cambio de esquema/función/trigger debe salir como migración en
`supabase/migrations/`, aunque se haya probado antes en el Dashboard de Supabase.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-035 (`fix-028-m`); regla general también en
`.claude/rules/architecture.md` ("SQL idempotentes — NUNCA alterar BD manualmente").

## Capa B — Normativa (advertencia citada, no bloqueo duro)

### NORM-B01 — Menores de 17 años requieren autorización notarial para matricularse
Aplica a cualquier propuesta de flujo de matrícula o validación de edad. Es una advertencia que la
secretaría puede resolver con el documento correspondiente, no un bloqueo automático del sistema.
**Fuente:** `docs/PRODUCT-VISION.md` §"El Problema" ("Alumnos menores de 17 años matriculados sin
autorización notarial").

### NORM-B02 — Clase Profesional (A2–A5) exige edad mínima 20 años
No confundir con la autorización notarial de menores (17/18), que es una regla distinta y no
bloquea Profesional — el bloqueo real de Profesional es la edad mínima 20.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-021 (`fix-013-b`, `fix-014-b`).

### NORM-B03 — Profesional exige licencia B con 2 años de antigüedad, contados hasta el INICIO de la promoción
La referencia legal no es la fecha de matrícula ni "hoy", sino `professional_promotions.start_date`
de la promoción elegida. Un alumno puede matricularse antes de cumplir los 2 años si, para cuando
arranca la promoción, ya los tendrá. Es advertencia no bloqueante — la secretaría puede matricular
igual bajo su criterio. Decisión de negocio confirmada explícitamente con el owner (2026-07-28).
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-037 (`fix-089-m`, `ASG-b-041`).

### NORM-B04 — El código de una promoción profesional es un ID oficial del MTT, no texto libre
`professional_promotions.code`/`promotion_courses.code` debe ser el ID numérico que asigna el
Ministerio de Transporte y Telecomunicaciones, del cual se deriva el código compuesto
(`"{id}.{sufijo_licencia}"`). Cualquier propuesta que trate ese campo como editable sin validación
cruza esta norma.
**Fuente:** `indices/DOMAIN-GOTCHAS.md` DG-006 (`fix-053-m`).

### NORM-B05 — Vehículo requiere SOAP y revisión técnica vigentes para circular/agendarse
Cubierto también por INV-A01 (Triple Match) como invariante de integridad del sistema, pero el
origen es normativo (Ley de Tránsito chilena) — cualquier propuesta que proponga "agendar igual y
regularizar después" cruza la norma, no solo la invariante del producto.
**Fuente:** `docs/PRODUCT-VISION.md` §"El Problema" ("Vehículos con SOAP vencido que siguen
circulando").

### NORM-B06 — Boletas SII y contabilidad formal quedan fuera del alcance del producto
Una propuesta que extienda el sistema hacia contabilidad completa, inventario general o compras
cruza un anti-goal explícito del producto — no es una prohibición legal, pero sí una línea de
alcance ya decidida que requiere confirmación explícita del owner antes de avanzar.
**Fuente:** `docs/PRODUCT-VISION.md` §"Anti-Goals" (#2, #5).

---

## Convención para agregar una entrada nueva

Una entrada califica para este archivo si cumple **todas**:
1. Es una regla de **negocio/proceso** (no de UI/CSS — eso va a `indices/ANTI-PATTERNS.md`; no un
   detalle de esquema sin implicancia de negocio — eso va a `indices/DOMAIN-GOTCHAS.md` solo).
2. Tiene una fuente verificable: un `DG-NNN` de `indices/DOMAIN-GOTCHAS.md`, una sección de
   `docs/PRODUCT-VISION.md`, o una decisión de negocio confirmada explícitamente por el owner con
   fecha.
3. Se puede clasificar sin ambigüedad como **Capa A** (romperla es un bug/incidente, se bloquea) o
   **Capa B** (romperla es un riesgo legal/de alcance, se advierte pero la decisión queda en manos
   del equipo).

Formato: `### INV-ANN — <título de 1 línea>` o `### NORM-BNN — <título de 1 línea>`, con el texto de
la regla y una línea `**Fuente:**`. Numeración global por capa, nunca se reutiliza.

# fix-019-m — Carnet Clase B: variantes 6/12 con color y persistencia dual

## Contexto

Tras **fix-017** (el alumno Clase B agenda **siempre las 12 clases** en la
matrícula), la generación del carnet quedó desactualizada. La Edge Function
decidía cuántas filas dibujar con `totalClases = sesiones.length <= 6 ? 6 : 12`;
como ahora siempre hay 12 sesiones, esa fórmula siempre devuelve 12 y el carnet
de 6 clases dejó de poder emitirse.

El negocio mantiene **dos carnets físicos distintos**:

- **Carnet inicial (6 clases):** se emite al matricularse. Muestra solo las
  clases 1–6. Fondo **amarillo pastel** (textos y logo deben seguir legibles).
- **Carnet completo (12 clases):** se emite cuando el alumno **completó las
  primeras 6 clases**. Muestra las 12. Fondo **verde pastel**. Las clases 1–6
  ya cursadas no requieren firma del instructor: en su columna *Firma
  Instructor* se imprime el texto **"Completada"**. Las clases 7–12 quedan
  vacías para firma real.

Sin ningún otro cambio visual respecto al carnet actual.

## Decisiones de negocio (confirmadas con el dueño)

- **Se guardan AMBOS carnets** (no se sobrescribe uno con el otro): el alumno
  puede reimprimir tanto el de 6 como el de 12 por separado. Requiere migración.
- **UI = un único disparador "Carnet" tipo dropdown** en la ficha del alumno,
  con 4 acciones agrupadas en dos secciones:
  - *Carnet 6 clases:* "Generar" / "Ver"
  - *Carnet 12 clases:* "Generar" / "Ver"
- Tras generar por primera vez cada carnet, su acción "Generar" cambia a
  **"Volver a generar…"** (permite re-emitir si se reprograma alguna clase).
- Las opciones del carnet de 12 clases están **bloqueadas (no seleccionables)**
  hasta que se completen las primeras 6 clases; al estar bloqueadas indican el
  motivo (cuántas faltan).
- "Ver" de cada carnet está bloqueado hasta que ese carnet exista.
- Texto en la celda de firma de clases ya cursadas (carnet 12): **"Completada"**.

## Hallazgos / Lógica afectada

1. **Edge Function** `supabase/functions/generate-student-license-pdf/index.ts`:
   - `totalClases = sesiones.length <= 6 ? 6 : 12` (:99) → derivar de un nuevo
     param `variant: 'initial' | 'full'`.
   - `buildCarnetPdf` (:227): pintar fondo pastel (rect relleno de página
     completa antes de bordes/textos; resetear a negro). En el loop de filas
     (:318), si `variant === 'full'` y fila ≤ 6, dibujar "Completada" centrado en
     la columna Firma Instructor.
   - Storage path por variante (`..._6.pdf` / `..._12.pdf`) y update de la
     columna correspondiente en lugar de `license_pdf_url`.
2. **Migración BD:** `enrollments` → `license_initial_url`, `license_full_url`
   (backfill desde `license_pdf_url`). Documentar en `indices/DATABASE.md`.
3. **Facade** `core/facades/admin-alumno-detalle.facade.ts`:
   - `generarCarnet(enrollmentId, variant)` (:690) reenvía `variant`.
   - Exponer `licenseInitialPath` / `licenseFullPath` (reemplaza el único
     `licensePdfPath`); cargar ambas columnas en el fetch del detalle (:318).
4. **Modelo Hero** `core/models/ui/section-hero.model.ts`: agregar campo opcional
   `menu?: SectionHeroMenuItem[]` a `SectionHeroAction` (aditivo).
5. **Section Hero** `shared/components/section-hero/section-hero.component.ts`
   (:233): cuando una acción trae `menu`, renderizar un `p-menu` (PrimeNG) en vez
   de botón plano. No rompe los 41 usos existentes.
6. **Smart Component** `features/admin/alumno-detalle/admin-alumno-detalle.component.ts`:
   - Construir el menú "Carnet" (computed) según la matriz de estados.
   - Reescribir el gate: `clasesPracticas().filter(c => c.numero <= 6 && c.completada).length >= 6` (hoy el filtro mira `numero > 6`, :888).
   - Eliminar lógica obsoleta `necesitaAgendarSegundaEtapa` / banner de "agendar
     segunda etapa" (:611, :899) y `actualizar-carnet` (:997-1010).

## Tonos pastel

- Amarillo (carnet inicial): `1 0.97 0.78` (≈ #FFF7C7)
- Verde (carnet completo): `0.85 0.94 0.82` (≈ #D9F0D1)

## Acceptance Criteria

- [ ] AC1: Generar "Carnet 6 clases" produce un PDF con **solo las clases 1–6**
  y **fondo amarillo pastel**; logo y textos legibles. Se guarda en
  `enrollments.license_initial_url`.
- [ ] AC2: Generar "Carnet 12 clases" produce un PDF con las **12 clases** y
  **fondo verde pastel**; las clases 1–6 muestran **"Completada"** en la columna
  Firma Instructor y las 7–12 quedan vacías para firma. Se guarda en
  `enrollments.license_full_url`.
- [ ] AC3: La acción "Generar Carnet 12 clases" está **deshabilitada** hasta que
  el alumno tenga las **primeras 6 clases completadas**, e indica el motivo.
- [ ] AC4: "Ver Carnet 6/12 clases" está deshabilitado mientras ese carnet no
  exista; "Generar" cambia a "Volver a generar…" una vez emitido cada uno.
- [ ] AC5: Ambos carnets coexisten (generar uno no borra el otro). Sin
  sobrescritura cruzada de archivos ni de columnas.
- [ ] AC6: El control "Carnet" en la ficha es un único dropdown con las 4
  opciones agrupadas; se elimina el flujo/banner de "agendar segunda etapa".

## Test de regresión

- `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.spec.ts`
  — gate de habilitación del carnet 12 (primeras 6 completadas) y labels
  dinámicos Generar/Volver a generar.
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts` — `generarCarnet`
  reenvía `variant` y setea el path correcto por variante.

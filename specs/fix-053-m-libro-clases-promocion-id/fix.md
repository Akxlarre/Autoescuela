---
# fix-053-m — ID numérico MTT de Promoción, propagado a sus cursos y mostrado en Libro de Clases

## Contexto

En el Libro de Clases (Cabecera), el campo "Código: professional_a2" muestra
`courses.code` — el código interno de catálogo del curso, sin ningún
significado para el usuario. Lo que el dueño realmente necesita mostrar ahí es
el **ID numérico que asigna el Ministerio de Transporte (MTT)** a cada
promoción (ej. la promoción del 27 de julio tiene ID `156`), del cual se
deriva un ID compuesto por curso: `156.2` (A2), `156.3` (A3), `156.4` (A4),
`156.5` (A5) — el sufijo es el dígito de la licencia.

Revisando el modelo de datos: `professional_promotions.code` y
`promotion_courses.code` **ya existen** en la BD (ninguna migración de
esquema nueva) pero hoy:
- `professional_promotions.code` se autogenera al crear la promoción con el
  formato `PROM-YYYY-MM` (no numérico) y es editable en el drawer "Editar
  Promoción" sin ninguna validación de formato.
- `promotion_courses.code` no se lee ni se escribe en ningún lugar del código
  — existe en la tabla pero está siempre `null`.

## Alcance

### 1. `professional_promotions.code` = ID numérico MTT
- **Crear Promoción** (`admin-promocion-crear-drawer.component.ts`): eliminar
  la autogeneración `PROM-YYYY-MM` (función `generatePromoCode`, señal
  `codigo`, bloque "Código (automático)" del template). El ID numérico no se
  asigna al crear — la promoción queda con `code = null` hasta que el MTT lo
  entregue y un admin lo cargue después vía "Editar Promoción".
- **Editar Promoción** (`admin-promocion-editar-drawer.component.ts`): el
  campo "Código" pasa a validar que sea **estrictamente numérico**
  (`/^\d+$/`) — `canSave` exige el formato válido, se agrega mensaje de error
  visible si el usuario escribe algo no numérico. Placeholder actualizado a
  `Ej: 156`.
- `CrearPromocionPayload`: se elimina el campo `code` (ya no se envía al
  crear). `PromocionesFacade.crearPromocion()` deja de insertar `code`.

### 2. Propagación a `promotion_courses.code`
- Nueva utilidad pura `core/utils/license-suffix.utils.ts`:
  ```ts
  export function licenseClassToSuffix(licenseClass: string): string {
    const m = licenseClass.match(/[2-5]/);
    return m ? m[0] : '';
  }
  ```
  con `.spec.ts` cubriendo A2→'2', A3→'3', A4→'4', A5→'5', valor inesperado→''.
- `PromocionesFacade.editarPromocion()`: tras actualizar
  `professional_promotions.code` exitosamente, si el nuevo código es numérico
  no vacío, propaga a **todos** los `promotion_courses` de esa promoción:
  `code = "{nuevoCode}.{licenseClassToSuffix(courses.license_class)}"` (ej.
  `"156.2"`). Un curso A2 de la promoción 156 → `"156.2"`.

### 3. Libro de Clases — mostrar el ID en vez del código de catálogo
- `LibroCabecera` (`core/models/ui/libro-de-clases.model.ts`): se elimina
  `courseCode` (confirmado sin otro uso en el código — solo se leía en esta
  misma vista) y se agrega `bookId: string` (el `promotion_courses.code`
  compuesto, ej. `"156.2"`).
- `LibroDeClasesFacade.loadCabecera()`: agrega `code` al `select()` de
  `promotion_courses` (ya se consulta esa tabla por `id`; solo falta pedir la
  columna) y mapea `bookId: pcRes.data.code ?? ''`.
- `libro-de-clases.component.ts`: la fila "Código: {{ cab.courseCode }}"
  pasa a **"ID: {{ cab.bookId }}"**, de solo lectura (no editable en esta
  vista — el ID numérico se edita únicamente desde "Editar Promoción", según
  decisión explícita del dueño).

### 4. Backfill de datos existentes
- Migración SQL idempotente en `supabase/migrations/` que:
  - Asigna un ID numérico secuencial coherente (ej. 100, 101, 102…, ordenado
    por `start_date`) a las promociones que hoy tienen `code` no-numérico o
    `null`.
  - Recalcula `promotion_courses.code` para todas las filas cuyo `code` no
    siga el formato `{promoCode}.{sufijo}`, usando el `code` recién asignado
    a su promoción y el `license_class` de su curso.

## Fuera de alcance

- No se toca el flujo de `crearPromocion()` para pedir el ID en el momento de
  creación — el ID se asigna después, vía Editar.
- No se valida contra un registro externo del MTT — solo se exige formato
  numérico local.
- No se modifica ninguna otra vista que muestre `PromocionCursoRow.courseCode`
  (ej. `admin-profesional-promociones`, `admin-relator-ver-drawer`) — esas
  siguen usando el código de licencia (`A2`/`A3`/…) para colores/badges, que
  es un concepto distinto al ID numérico MTT.

## Acceptance Criteria

- AC1: `licenseClassToSuffix()` tiene `.spec.ts` cubriendo A2/A3/A4/A5 y un
  caso inesperado.
- AC2: Guardar en "Editar Promoción" con un código no-numérico está
  deshabilitado (`canSave` en falso) y muestra el error correspondiente.
- AC3: Guardar un código numérico válido en "Editar Promoción" actualiza
  `professional_promotions.code` **y** el `code` de todos sus
  `promotion_courses` (test de facade verifica el `update` propagado).
- AC4: "Crear Promoción" ya no muestra ni envía un campo `code` auto-generado.
- AC5: Libro de Clases muestra "ID: {{ cab.bookId }}" en vez de "Código: ...",
  de solo lectura, con el valor de `promotion_courses.code`.
- AC6: Migración de backfill es idempotente (usa `WHERE code IS NULL OR code
  !~ ...` — reejecutarla no cambia filas ya válidas).
- AC7: `npm run test:ci` en verde; `npm run lint:arch` sin nuevas violaciones.
- AC8: `indices/DATABASE.md`, `indices/FACADES.md` actualizados con el nuevo
  significado de `code` en ambas tablas.

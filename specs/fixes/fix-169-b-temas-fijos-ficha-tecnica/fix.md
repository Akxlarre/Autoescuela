# Fix: Tema fijo por número de clase en Ficha Técnica (Clase B) + edición en Ajustes

> **id:** fix-169-b-temas-fijos-ficha-tecnica
> **refs:** ASG-m-007
> **status:** done
> **owner:** b
> **created:** 2026-09-21
> **closed:** 2026-09-22

## Contexto

En el detalle de un alumno de Clase B, la Ficha Técnica debe mostrar el tema de cada clase, fijo
según el número de clase, tanto para admin/secretaría como para el instructor en su portal.
Además, admin debe poder editar los 12 temas desde Ajustes.

## Acceptance Criteria

- [x] **AC1** — El tema de cada clase se muestra en la Ficha Técnica del detalle de alumno Clase B,
      en la vista admin/secretaría y en la del instructor.
- [x] **AC2** — Sección en Ajustes, solo admin, para editar los 12 temas.
- [x] **AC3** — Los 12 temas por defecto quedan seedeados vía migración, con los textos exactos de
      la asignación.

## Root Cause

No es un bug de código previo: es una implementación incompleta. Una primera pasada dejó el
feature **no funcional** y con la data de negocio equivocada. Los defectos, todos verificados:

### 1. La migración no aplicaba (bloqueante)

La policy RLS hacía
`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')`. Dos errores
en una línea: `users.id` es `INTEGER` y `auth.uid()` es `UUID` (la columna de enlace es
`users.supabase_uid`), y `users.role` no existe — el rol es `users.role_id` → `roles`. Postgres
rechazaba la migración completa:

```
ERROR: 42883: operator does not exist: integer = uuid
```

El trigger llamaba además a `update_updated_at_column()`, que **no existe en `public`**: solo
existe en el esquema `storage` (lo crea Supabase para sus propias tablas) y `search_path` no lo
incluye. Segundo error bloqueante, detrás del primero:

```
ERROR: 42883: function update_updated_at_column() does not exist
```

Consecuencia: `class_b_topics` no existía en la BD, así que el feature entero solo producía un
toast de error.

### 2. Los 12 temas no eran los de la asignación

Ninguna de las dos migraciones traía la lista del dueño, y entre ellas tampoco coincidían. La
primera usaba vocabulario de España ("habitáculo", "calzada", "batería, cordón y diagonal"), la
segunda otra lista inventada ("Reconocimiento del Vehículo", "Dominio del Vehículo"). Este es el
defecto más peligroso de los tres porque es **silencioso**: el código funciona y muestra datos
incorrectos.

### 3. Dos migraciones para un cambio, con un revert que no revertía

Un primer intento guardó los temas como array JSONB en `website_config.config`. El segundo creaba
la tabla e intentaba revertir el primero, pero borraba la clave equivocada: la primera escribía
`classTopics` (camelCase) y el revert borraba `class_topics` (snake_case), así que `classTopics`
quedaba para siempre en la configuración del sitio público.

### 4. El seed pisaba las ediciones del admin

`ON CONFLICT (class_number) DO UPDATE SET topic = EXCLUDED.topic`: re-aplicar la migración
reescribía en silencio los temas que el admin hubiera editado. Son valores **por defecto**.

### 5. El facade rompía sus propios tests

Inyectaba por constructor (`constructor(private supabase: SupabaseService, …)`), único caso en 60
facades del proyecto. Sus 3 tests fallaban con
`NG0202: This constructor is not compatible with Angular Dependency Injection`.

### 6. Cuatro clases CSS muertas

`bg-surface-hover`, `border-brand-default`, `ring-brand-default` y `text-brand-default` no existen
en el `@theme`, así que no generan CSS y esos estilos no se aplicaban. Subieron el ratchet de
ARCH-11 de 6 a 10.

### 7. La edición vivía donde el equipo ya había decidido que no va

Se hizo como página enrutable `/app/admin/configuracion-academica` con ítem de menú nuevo, cuando
la asignación pedía "nueva sección en **Ajustes**". `fix-167-b` (cerrado 12 días antes) corrigió
exactamente este desvío: la configuración institucional de admin vive en el
`AjustesDrawerComponent`, junto a precios, tarifas, descuentos y plantillas de comunicado.

## Cambio

- **`supabase/migrations/20260922000000_create_class_b_topics_table.sql`** — reescrita: RLS con
  `auth_user_role()`, trigger con `public.set_updated_at()` (el helper real del proyecto),
  idempotente (`DROP POLICY/TRIGGER IF EXISTS`), seed con los **12 textos exactos** de la
  asignación y `ON CONFLICT DO NOTHING`. Limpia las dos variantes de la clave JSONB. Sin policy
  DELETE a propósito: las 12 filas se editan, no se borran.
- **`supabase/migrations/20260921191200_fix169_website_config_class_topics.sql`** — **borrada**.
  No estaba aplicada en ningún entorno remoto, así que se elimina en vez de arrastrar un revert
  roto.
- **`src/app/core/facades/class-b-topics.facade.ts`** — `inject()`, signal de error expuesto,
  SWR (`initialize()` + refresh silencioso), columnas explícitas en el `select`, `maybeSingle()`
  para distinguir "sin permiso" de "error de red", y validación de tema vacío antes de la BD.
- **`src/app/core/facades/class-b-topics.facade.spec.ts`** — reescrito: 10 tests.
- **`src/app/features/admin/configuracion-academica/class-b-topics-drawer.component.ts`** —
  nuevo drawer, reemplaza la página standalone. Tokens canónicos, `loader-circle` para el
  spinner, y el modo edición no se cierra si el guardado falla.
- **`src/app/features/admin/configuracion-academica/admin-configuracion-academica.component.ts`**
  — borrada, junto con su ruta en `app.routes.ts` y su ítem en `menu-config.service.ts`.
- **`src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts`** — tarjeta
  "Temas de las Clases Prácticas (Clase B)" bajo `@if (isAdmin())`.
- **`src/app/core/facades/admin-alumno-detalle.facade.ts`** — `websiteConfigResult` →
  `classTopicsResult` (nombre heredado del enfoque descartado).

**No se tocó** el render del tema en las dos fichas (AC1): ya estaba correcto.

## Verificación

**Migración, contra la BD real, en transacción revertida:**

```
filas=12 policies=3 :: 1=Psicotécnico / Pre-conducción | 2=Partidas y detenciones |
3=Reducciones | 4=Refuerzo reducciones | 5=Retrocesos | 6=Estacionamiento subida y bajada |
7=Estacionamiento | 8=Refuerzo estacionamiento | 9=Tránsito urbano I | 10=Tránsito urbano II |
11=Tránsito urbano III | 12=Mecánica + preparación examen
```

**Tests:** `class-b-topics.facade.spec.ts` 10/10 (antes 0/3).

**Semáforos:** `lint:arch` exit 0 con ARCH-11 de vuelta en 6 (el baseline pre-existente), y
`ng build` exit 0.

### Nota de método

Las primeras sondas contra la BD fueron inválidas y casi me llevan a declarar la migración
correcta cuando no lo era: **`supabase db query --linked` solo ejecuta la primera sentencia
cuando el script tiene saltos de línea.** Un `BEGIN; <migración> SELECT …; ROLLBACK;` multilínea
devolvía "sin error" porque solo corría el `BEGIN`. Verificado con un caso de control
(`SELECT 1; SELECT 1/0;`): en una línea da *division by zero*, en dos líneas devuelve `1` sin
error. Para verificar SQL con este CLI hay que **aplanar el script a una línea** (quitando los
comentarios `--`, que si no se comen el resto) y forzar los datos al mensaje de error con un cast
inválido, porque el CLI devuelve solo el resultado de la última sentencia.

Por el mismo descuido afirmé en la revisión que `update_updated_at_column()` existía: lo busqué
en `pg_proc` **por nombre, sin mirar el esquema**. Existe, pero en `storage`.

## Pendiente (requiere decisión del dueño)

La migración **no está aplicada**. Aplicarla con `npm run supabase:push` / `supabase db push`
arrastra 4 migraciones de `main` de otros autores (`fix252_renumber_seed_enrollments`,
`repurpose_document_templates` y las 2 de la vista de agenda) que figuran como no aplicadas pero
**ya están aplicadas de hecho** — `document_templates.document_type` existe y `file_url` ya no, y
la vista de agenda ya no es materializada. Las 4 son idempotentes (la de renumeración lo
documenta explícitamente y filtra por `number LIKE 'SEED-%'`), así que el push sería un no-op
para ellas, pero registra su versión en `schema_migrations` — estado compartido del equipo.

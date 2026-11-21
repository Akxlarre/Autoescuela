---
paths:
  - "supabase/**"
  - "src/app/core/services/supabase*"
  - "src/app/core/services/*facade*"
  - "src/app/core/services/*service*"
---

# Reglas de Base de Datos (Supabase)

## Migraciones

- Todo DDL en `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql`
- **NUNCA** alterar la BD desde el Dashboard de Supabase manualmente
- Los scripts deben ser idempotentes (`CREATE TABLE IF NOT EXISTS`, etc.)
- **El timestamp de cada archivo es único.** La CLI identifica una migración solo por esos 14
  dígitos: si dos archivos lo comparten, aplica uno, registra la versión y salta el otro
  creyéndolo aplicado, sin avisar. Al crear una migración, revisa que su timestamp no exista ya.
  Guardrail: **ARCH-43** (`npm run lint:arch`).
- **Una migración se aplica con la CLI, no pegándola en el SQL Editor** (`npx supabase db push`
  en desarrollo; en producción, con `--db-url`). El SQL Editor y el MCP no registran la versión
  del archivo, y la próxima `db push` intenta aplicarla de nuevo o la da por pendiente para siempre.

## Documentación obligatoria

- Toda tabla nueva → agregar en `indices/DATABASE.md`
- Incluir columnas clave y políticas RLS en la documentación

## RLS (Row Level Security)

- **SIEMPRE** activar RLS en tablas nuevas: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Documentar cada policy: quién puede SELECT, INSERT, UPDATE, DELETE
- Usar funciones helper si hay lógica de ownership compleja
- Siempre que una migración cree, cambie o borre una política, o defina una función
  `SECURITY DEFINER`, llega con un test en `supabase/tests/` que la nombra por su timestamp y que
  prueba también lo que **no** se puede hacer. Lo exige ARCH-37 (`npm run lint:arch`) para las
  migraciones nuevas. No aplica si el cambio no altera quién accede a qué: en ese caso se declara
  con su motivo en `scripts/lib/qa-guardrails.allowlist.json`. Detalle: `testing-tdd.md`.

## Realtime

- Servicios con Supabase Realtime → usar RxJS `Observable`
- En la Facade → `toSignal()` para exponer al template
- Cancelar subscripciones en `ngOnDestroy`

## Patrón de query

```typescript
// CORRECTO: en un FacadeService o CoreService
const { data, error } = await this.supabase.client
  .from('tabla')
  .select('*')
  .order('created_at', { ascending: false });
```

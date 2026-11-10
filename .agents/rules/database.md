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

## Documentación obligatoria

- Toda tabla nueva → agregar en `indices/DATABASE.md`
- Incluir columnas clave y políticas RLS en la documentación

## RLS (Row Level Security)

- **SIEMPRE** activar RLS en tablas nuevas: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- Documentar cada policy: quién puede SELECT, INSERT, UPDATE, DELETE
- Usar funciones helper si hay lógica de ownership compleja

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

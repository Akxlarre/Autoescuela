---
name: supabase-data-model
description: >
  Trabajar con Supabase: tablas, migraciones SQL, RLS, queries, servicios que accedan a la BD.
  Activar cuando se creen o modifiquen migraciones SQL, se agreguen tablas/columnas/índices/policies,
  se implementen servicios Angular que consulten Supabase, o se configure Realtime.
  Consultar SIEMPRE indices/DATABASE.md antes de crear o modificar esquema.
  Respetar RLS en TODAS las tablas nuevas.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep
---

# Skill: supabase-data-model

## Cuándo activar

- Crear o modificar migraciones SQL en `supabase/migrations/`
- Añadir tablas, columnas, índices o políticas RLS
- Implementar servicios Angular que consulten Supabase
- Configurar Realtime subscriptions
- Documentar cambios en el modelo de datos en `indices/DATABASE.md`

## Referencias del proyecto

| Recurso | Ubicación |
|---|---|
| Índice de tablas | `indices/DATABASE.md` |
| SupabaseService | `src/app/core/services/supabase.service.ts` |
| Migraciones | `supabase/migrations/` |

## Convención de migraciones

```
YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql

Ejemplos:
20250301120000_auth_create_profiles.sql
20250301130000_products_add_category_column.sql
```

Scripts deben ser **idempotentes**:

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
```

## Patrón de query en Angular

```typescript
// CORRECTO: siempre en un FacadeService o CoreService, nunca en componente UI
const { data, error } = await this.supabase.client
  .from('tabla')
  .select('*, relacion(columna)')
  .order('created_at', { ascending: false });

if (error) throw error;
```

## Realtime

```typescript
// En un CoreService — suscribirse y exponer vía toSignal()
const channel = this.supabase.client
  .channel('tabla-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tabla' }, payload => {
    // actualizar signal interno
    this._items.update(items => [...items]); // trigger re-read
  })
  .subscribe();

// Cancelar en ngOnDestroy
ngOnDestroy(): void {
  this.supabase.client.removeChannel(channel);
}
```

## RLS — Checklist para tabla nueva

- [ ] `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- [ ] Policy SELECT definida
- [ ] Policy INSERT definida con `WITH CHECK`
- [ ] Policy UPDATE definida
- [ ] Policy DELETE definida (o bloqueada explícitamente)
- [ ] Documentada en `indices/DATABASE.md`

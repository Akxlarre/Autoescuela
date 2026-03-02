# SupabaseService

## Propósito

Cliente Supabase para auth y base de datos. Singleton que expone el cliente configurado y métodos de autenticación.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `client` | `SupabaseClient` | Cliente Supabase (para queries, storage, etc.) |
| `signUp(email, password)` | `Promise` | Registro de usuario |
| `signIn(email, password)` | `Promise` | Login |
| `signOut()` | `Promise` | Cerrar sesión |
| `getUser()` | `Promise` | Usuario actual de Supabase |

## Cuándo usarlo

- Llamadas a Supabase (auth, tablas, storage)
- Integración de AuthService con login real
- Cualquier operación que requiera el cliente Supabase

## Cuándo no usarlo

- Para estado de usuario en la app → `AuthService` (que consumirá Supabase)
- Para datos mock o desarrollo sin backend → servicios específicos

## Dependencias

- `@supabase/supabase-js`
- `environment.supabase.url`, `environment.supabase.anonKey`

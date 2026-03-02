# AuthService

## Propósito

Gestión de autenticación con Supabase. Mantiene el usuario actual desde `auth.users` y la tabla `profiles`, escucha cambios de sesión y expone login/logout.

## API pública

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `currentUser` | `Signal<User \| null>` | Usuario actual (null si no autenticado). Incluye id, name, email, role, initials, avatarUrl. |
| `isAuthenticated` | `ComputedSignal<boolean>` | true si hay usuario logueado |

| `whenReady` | `Promise<void>` | Resuelve cuando la comprobación inicial de sesión ha terminado. Usado por AuthGuard. |
| `login(email, password)` | `Promise<{ error: Error \| null }>` | Inicia sesión con Supabase. El listener actualiza currentUser. |
| `signUp(email, password, options?)` | `Promise<{ data; error }>` | Registro de usuario. options.data puede incluir display_name. |
| `resetPasswordForEmail(email)` | `Promise<{ error: Error \| null }>` | Envía correo de recuperación de contraseña. |
| `logout()` | `void` | Cierra sesión en Supabase, limpia estado y redirige a `/` |
| `setUser(user)` | `void` | Establece usuario manualmente (tests o casos edge) |

## Cuándo usarlo

- Mostrar datos del usuario actual (nombre, rol, iniciales)
- Proteger rutas con AuthGuard
- Login desde LoginComponent vía `authService.login()`

## Dependencias

- `SupabaseService` — signIn, signOut, getUser, client para query a `profiles`
- `Router` — redirección tras logout
- Modelo `User` y `getInitialsFromDisplayName` de `@core/models/user.model`

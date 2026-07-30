# fix-051-m — Login sin conexión muestra "credenciales incorrectas"

## Contexto

El dueño reportó que al intentar iniciar sesión sin conexión a internet,
aunque las credenciales sean correctas, el mensaje de error sugiere un
problema de credenciales en vez de indicar que no hay conexión.

## Causa raíz

`mapAuthError()` en `src/app/core/utils/auth-errors.utils.ts` solo reconoce
mensajes específicos de Supabase GoTrue (`Invalid login credentials`,
`Email not confirmed`, etc.). Cuando `signInWithPassword` falla por falta
de conexión, el SDK de Supabase devuelve un error de red (típicamente
`AuthRetryableFetchError`, con mensaje tipo `Failed to fetch` / `fetch failed`
y sin `status` HTTP), que no matchea ninguno de los `if` existentes y cae al
fallback genérico:

```
'Error de autenticación. Por favor, verifica tus datos e intenta de nuevo.'
```

Ese mensaje invita al usuario a revisar sus credenciales cuando el problema
real es la conexión.

## Alcance

En `src/app/core/utils/auth-errors.utils.ts`:

1. Agregar una detección de error de red **antes** de los `if` de mensajes
   específicos de GoTrue, cubriendo:
   - `error.name === 'AuthRetryableFetchError'` (nombre que usa el SDK de
     Supabase para fallos de fetch/red).
   - Mensajes que contengan `Failed to fetch`, `fetch failed`, `NetworkError`
     o `Load failed` (variantes según navegador/entorno).
2. Devolver un mensaje distinto y claro: `'Sin conexión a internet. Verifica tu red e intenta de nuevo.'`
3. Crear `src/app/core/utils/auth-errors.utils.spec.ts` cubriendo: error de
   red (por nombre y por mensaje), credenciales inválidas (regresión), y
   error desconocido (fallback genérico).

No se toca `auth.facade.ts` — ya delega el mapeo completo a `mapAuthError`.

## Acceptance Criteria

- [x] AC0: Un error con `name: 'AuthRetryableFetchError'` devuelve
  `'Sin conexión a internet. Verifica tu red e intenta de nuevo.'`.
- [x] AC1: Un error con `message: 'Failed to fetch'` (sin `name` reconocido)
  también devuelve el mensaje de sin conexión.
- [x] AC2: `'Invalid login credentials'` sigue devolviendo
  `'Correo o contraseña incorrectos.'` (no regresión).
- [x] AC3: Un error no reconocido sigue devolviendo el fallback genérico
  existente.

## Cierre

`npm run test:ci -- --run auth-errors` → 4/4 tests verdes. Fix cerrado.

## Test de regresión

`auth-errors.utils.spec.ts` (función pura, sin dependencias de Angular) cubre
los 4 casos de arriba vía `npm run test:ci`.

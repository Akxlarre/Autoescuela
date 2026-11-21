# Flujo de trabajo con desarrollo y producción

Desde el 2026-11-20 hay **dos copias del sistema**, en la cuenta nueva de Supabase:

| | Desarrollo | Producción |
|---|---|---|
| Para qué | Practicar. Datos de prueba, se puede romper | Lo real. Lo usan las escuelas |
| Proyecto Supabase | `klcwwrwfdqdciffraozq` (AutoescuelaChillan DEV) | `vbbzcfrilnolrhcwjabr` (AutoescuelaChillan PROD) |
| La usa | `ng serve`, los tests e2e, los previews de Vercel | `app.gestordeautoescuelas.cl` |
| Archivo de entorno | `environment.development.ts` (personal, no se commitea) | `environment.ts` |

El proyecto de la cuenta antigua (`skvekggejikzxhzsjmkz`) está **pausado**: no lo usen.

Cada copia tiene sus propias partes: la **base de datos** (tablas), las **functions** (PDFs, correos,
pagos) y el **front** (la app). La regla es una sola: **todo se prueba primero en desarrollo y
después se copia a producción.**

## Ejemplo: agregar "teléfono de emergencia" al alumno

**Mientras programan**, todo pasa en desarrollo:

1. Escriben la migración que agrega la columna y se aplica en **desarrollo** (las aplica Matías).
2. Cambian el front y prueban con `ng serve`, que se conecta a **desarrollo**.
3. Si cambiaron una function (por ejemplo, el PDF de la ficha), la despliegan en **desarrollo**:
   `npx supabase functions deploy <nombre>` (la CLI queda enlazada a desarrollo).

**PR y merge a `main`.** Eso **no toca producción**: las escuelas siguen viendo la versión anterior.
El CI no habla con ninguna BD, y el preview de Vercel del PR usa desarrollo. Se pueden juntar
varios merges antes de publicar.

**Al publicar**, se copia a producción **en este orden**:

1. **La migración:** se aplica la misma migración en producción, para que exista la columna.
2. **Las functions** que cambiaron:
   `npx supabase functions deploy <nombre> --project-ref vbbzcfrilnolrhcwjabr`
   Si hay un secreto nuevo: `npx supabase secrets set --project-ref vbbzcfrilnolrhcwjabr NOMBRE=valor`
3. **El front:** workflow **"Publicar producción"** en GitHub, como siempre.

El orden importa: si se publica el front antes que la migración, la app intenta guardar en una
columna que no existe y esa pantalla falla en producción.

Para saber qué copiar, lo que cambió desde la última versión publicada (reemplazar `v0.2.12` por la
última):

```powershell
git diff --name-only v0.2.12..origin/main -- supabase/migrations supabase/functions
```

## Qué cambia respecto a antes

| Antes | Ahora |
|---|---|
| Se aplicaba la migración una vez | Una vez en desarrollo y, al publicar, otra vez en producción |
| Se desplegaba la function una vez | Una vez en desarrollo y, al publicar, otra vez en producción |
| "Publicar producción" | Igual, pero va al final, después de los dos pasos anteriores |

## Reglas

- **Nunca** `supabase link` a producción. A producción se llega solo con
  `--project-ref vbbzcfrilnolrhcwjabr`, así un comando sin ese flag nunca la toca.
- Los tests e2e y los agentes trabajan solo contra desarrollo. El guard de e2e aborta si el entorno
  apunta a otro proyecto.
- **No** usar el rollback de GitHub hacia versiones `v0.2.11` o anteriores: se construyeron contra
  el proyecto antiguo, que está pausado.
- Los secretos de las functions son distintos en cada proyecto: en desarrollo, las URLs apuntan a
  `http://localhost:4200`; en producción, a `https://app.gestordeautoescuelas.cl`.

## Problemas conocidos

- **La CLI vuelve sola a la cuenta antigua** (otro `supabase login` pisa la sesión guardada). Si un
  comando responde `403` o `projects list` no muestra DEV y PROD, fijar el token de la cuenta nueva
  en la ventana de PowerShell:
  `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'` (se genera en Account preferences → Access Tokens; no
  compartirlo).
- **Vitest falla con "failed to find the runner"** si se corre desde `d:\` en minúscula: usar `D:\`.

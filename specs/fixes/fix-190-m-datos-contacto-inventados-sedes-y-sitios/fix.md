# Fix: Datos de contacto inventados en `branches` y `website_config`

> id: fix-190-m-datos-contacto-inventados-sedes-y-sitios
> refs: 0009-m-consentimiento-ley-21719 (dependencia previa) · auditoría `.compliance/` corrida 1
> status: done
> closed: 2026-08-16
> created: 2026-08-16

## Root Cause

Los datos de contacto de ambas sedes se sembraron con **placeholders de desarrollo** que nunca se
reemplazaron por los reales, y quedaron publicados como si fueran verdaderos.

La causa de que sobrevivieran hasta hoy es que **el bloque `contact` del JSONB de `website_config` no
está expuesto en el panel de administración**: los tabs de `admin/configuracion-web/` son `general` y
`hero`, no contacto. Nadie podía corregirlo desde la UI aunque lo notara.

A eso se suma un **drift entre migraciones y producción**: las direcciones sí se corrigieron a mano
directamente en la base de datos, pero el archivo de seed sigue teniendo `'Dirección Autoescuela
Chillán'`. Un entorno nuevo levantado desde las migraciones nace con datos falsos.

> Es el segundo caso del mismo patrón detectado en esta auditoría (el primero fue el bucket
> `documents`, cerrado por `20260413000001` sin que el archivo original lo reflejara). Vale como
> señal: en este proyecto **el archivo de migración no es fuente de verdad de lo que hay en producción**.

## Valores incorrectos y su reemplazo

**`branches`**

| id | Sede | Campo | Actual | Real |
|----|------|-------|--------|------|
| 1 | Autoescuela Chillán | `phone` | `+56 42 000 0001` | `+56 42 232 7800` |
| 1 | Autoescuela Chillán | `email` | `contacto@autoescuela-chillan.cl` | `otecchillan@gmail.com` |
| 1 | Autoescuela Chillán | `address` | ✅ ok en BD, ❌ placeholder en el seed | `Maipón 418, Chillán` |
| 2 | Conductores Chillán | `phone` | `+56 42 000 0002` | `+56 42 224 4030` |
| 2 | Conductores Chillán | `email` | `contacto@conductores-chillan.cl` | `conductorchillan@gmail.com` |
| 2 | Conductores Chillán | `address` | ✅ ok en BD, ❌ placeholder en el seed | `Carrera 74, Chillán` |

**`website_config` → `config.contact`** (los dos sitios públicos, todo inventado)

| branch | Campo | Actual | Real |
|--------|-------|--------|------|
| 1 | `address` | `Av. Libertad 123 (Plaza de Armas)` | `Maipón 418, Chillán` |
| 1 | `phone` | `+56 42 222 3344` | `+56 42 232 7800` |
| 1 | `email` | `contacto@autoescuelachillan.cl` | `otecchillan@gmail.com` |
| 2 | `address` | `Maipón 999 (a cuadras del Terminal de Buses)` | `Carrera 74, Chillán` |
| 2 | `phone` | `+56 42 288 8899` | `+56 42 224 4030` |
| 2 | `email` | `contacto@conductoreschillan.cl` | `conductorchillan@gmail.com` |

Confirmado por el dueño (2026-08-16): los correos públicos de los sitios son los mismos que el canal de
contacto, y la dirección `Maipón 999` es inventada.

## ACs Afectados

Ninguno de una spec cerrada. **Es dependencia previa de la spec 0009-m**:

- **0009-m AC1** (aviso del Art. 14 ter en el punto de captura) y **AC2** (política por sociedad):
  ambos muestran el **domicilio y el correo del responsable**. Publicarlos con placeholders sería
  entregar información falsa al titular, que es exactamente lo contrario del deber de información.
  Este fix debe cerrarse **antes** de implementar la 0009-m.

## Cambio

**Decisión: NO editar las migraciones ya aplicadas.** Se agrega una migración correctiva nueva. Un
entorno limpio aplica el seed (con placeholders) y luego la correctiva, terminando en el estado correcto.
Editar un archivo ya aplicado es justamente lo que hizo confusa la historia del bucket `documents`.

- **Archivo:** `supabase/migrations/<nueva>_fix_contact_data_branches_website.sql`
- **Qué cambia:**
  1. `UPDATE branches` con dirección, teléfono y correo reales de cada sede (idempotente, por `slug`).
  2. `UPDATE website_config` reemplazando `config->'contact'` (`address`, `phone`, `email`) de ambos
     registros con los valores reales de su propia sede, vía `jsonb_set`.
  3. Bloque `DO $$ ... $$` de verificación al final que **lanza excepción** si tras el update queda algún
     valor con forma de placeholder. Ver Test de Regresión.

## Test de Regresión

El harness de tests (`vitest`) es unitario con mocks y no consulta la base, así que un `.spec.ts` no
puede verificar esto. La verificación vive **en la propia migración** (bloque `DO $$` §3), que es donde
sí tiene acceso al dato y donde falla en todos los entornos por igual.

**Se afirma en positivo, no en negativo.** El primer borrador solo comprobaba que no quedaran
placeholders, y tenía un agujero: `jsonb_set` sobre una ruta anidada cuyo padre no existe **devuelve el
JSONB sin cambios, en silencio**. Si el bloque `contact` faltara, el update sería un no-op y la
comprobación negativa daría verde igual, porque tampoco encontraría el valor viejo. La versión final
exige que los valores reales **estén presentes**:

- `branches`: cada sede debe tener exactamente su `address`, `phone` y `email` reales.
- `website_config`: el bloque `contact` de cada sitio debe **coincidir con los de su propia sede**
  (join contra `branches`), lo que además garantiza que ambas fuentes no vuelvan a divergir.

Criterios de verde:

- La migración corre completa sin excepción, en local y en producción.
- Verificación visual: los dos sitios públicos muestran dirección, teléfono y correo reales.

### Resultado — ✅ VERDE en local (2026-08-16)

Ejecutada contra la base local (`supabase_db_Autoescuela`) con `ON_ERROR_STOP=1`.

**El entorno local estaba en el estado placeholder puro**, incluidas las direcciones — que solo se
habían corregido a mano en producción. O sea, se probó exactamente el escenario que motivó el fix: un
entorno levantado desde las migraciones.

Estado previo verificado:

```
branches        | Dirección Autoescuela Chillán | +56 42 000 0001 | contacto@autoescuela-chillan.cl
                | Dirección Conductores Chillán | +56 42 000 0002 | contacto@conductores-chillan.cl
website_config  | Av. Libertad 123 (Plaza de Armas)             | +56 42 222 3344 | contacto@autoescuelachillan.cl
                | Maipón 999 (a cuadras del Terminal de Buses)  | +56 42 288 8899 | contacto@conductoreschillan.cl
```

Ejecución: `UPDATE 1` ×4 → `NOTICE: fix-190: datos de contacto verificados en branches y website_config`
→ `EXIT=0`.

Estado posterior verificado:

```
branches        | Maipón 418, Chillán | +56 42 232 7800 | otecchillan@gmail.com
                | Carrera 74, Chillán | +56 42 224 4030 | conductorchillan@gmail.com
website_config  | Maipón 418, Chillán | +56 42 232 7800 | otecchillan@gmail.com
                | Carrera 74, Chillán | +56 42 224 4030 | conductorchillan@gmail.com
```

Ambas tablas coinciden campo a campo, que es lo que el bloque de verificación exige por join.
Acentos preservados correctamente (`Maipón`).

**Idempotencia:** segunda ejecución consecutiva → mismo resultado, `EXIT=0`, sin error.

### Aplicación en producción — ✅ hecha por el dueño (2026-08-16)

Reportada como aplicada por Matías el mismo día. **No verificada por el agente** (sin acceso a la base
de producción desde el entorno de desarrollo): la evidencia directa de esta sección es la corrida local.
Si el bloque `DO $$` de §3 no hubiera pasado en producción, la migración habría abortado con excepción,
así que una aplicación exitosa implica la verificación.

Nota sobre el tracking local: se ejecutó en local vía `psql` directo, para no arrastrar las otras 10
migraciones locales sin aplicar. Por eso **no quedó registrada en el tracking de migraciones local**;
cuando se corra `npx supabase migration up` se volverá a aplicar — sin problema, es idempotente y está
probado.

## Notas

- **Deuda detectada, fuera de alcance:** el bloque `contact` de `website_config` no es editable desde
  `admin/configuracion-web/`. Mientras siga así, cualquier corrección futura de contacto exige una
  migración. Candidato a Asignación aparte — no se resuelve acá para no convertir un fix de datos en una
  feature de UI.

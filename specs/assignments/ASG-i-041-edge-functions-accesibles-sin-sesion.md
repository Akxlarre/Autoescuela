# Asignación ASG-i-041 — Edge functions que responden sin sesión

> **status:** completada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-10-01
> **resulting_track:** fix-043-i-edge-functions-sin-sesion

---

> **Confirmación (2026-09-30), en vivo contra la BD del piloto, solo lectura:**
> - ✅ **`export-special-services` CONFIRMADA:** sin ningún header `Authorization` respondió 200 con
>   las ventas de todas las sedes (`branch_id: null`).
> - ⏳ **Las otras 4 siguen probables** (`generate-contract-pdf`, `generate-class-book-pdf`,
>   `auto-create-next-promotions`, `generate-certificate-professional-pdf`): no se llamaron porque
>   escriben en BD o Storage. Confirmarlas sobre datos de prueba.
> - Dato relevante para el diseño del fix: la **llave pública (anon key) pasa `verify_jwt`**. Exigir
>   "JWT válido" no alcanza: hay que verificar que sea un usuario real (`auth.getUser()`) y su rol.

## Contexto / Objetivo

Detectada leyendo el código (tanda de testing del 2026-09-29; ver la confirmación de arriba).
Cinco edge functions usan la clave de servicio (saltan RLS) y **no exigen sesión**: tienen
`verify_jwt = false` en `supabase/config.toml` o no llaman a `auth.getUser()`. Cualquiera en
internet que conozca la URL y mande un id correlativo obtendría documentos con RUT, dirección y
teléfono, o dispararía escrituras en la BD.

| Función | Qué expone / hace | Evidencia |
|---|---|---|
| `generate-contract-pdf` | URL firmada del contrato; además sobrescribe `digital_contracts.file_url` | `config.toml:357-358`; `index.ts:52-67` |
| `generate-class-book-pdf` | Libro de clases con RUN y teléfono | `config.toml:360-361`; `index.ts:40-72,259-279` |
| `auto-create-next-promotions` | Crea hasta 10 promociones por llamada | `config.toml:363-364`; `index.ts:100-129` |
| `generate-certificate-professional-pdf` | Genera certificados y escribe en BD y Storage | `index.ts:96-121,181-240` |
| `export-special-services` | Ventas de todas las sedes con `branch_id: null` | `index.ts:20-32` |

## Alcance sugerido

- **Paso 1, confirmar:** llamar cada función sin header `Authorization` (o con la anon key) y
  ver si responde con datos. Pasos en los checklists referenciados (§4). Descartar las que no se
  reproduzcan.
- Exigir sesión válida y además rol/sede (ver `ASG-i-042`, que crea el helper compartido; conviene
  coordinar o hacer ambas juntas).
- **Ojo con los llamadores legítimos sin usuario:** `auto-create-next-promotions` probablemente
  la llama un cron (por eso `verify_jwt = false`): protegerla con un secreto compartido o
  exigiendo la service key, no con sesión de usuario. `generate-contract-pdf` se usaba en la
  matrícula pública (hoy bloqueada): si se reactiva, necesitará otra forma de autorización
  (p. ej. el token de sesión del borrador).

## Referencias

- `specs/testing-piloto/023-matricula-presencial.md` S1 · `025-clase-profesional-piloto.md` S1, S2
- `specs/testing-piloto/031-servicios-especiales.md` S1 · `037-transversal-multisede-shell.md` S3 y §1 (inventario)

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/config.toml`
- `supabase/functions/{generate-contract-pdf,generate-class-book-pdf,auto-create-next-promotions,generate-certificate-professional-pdf,export-special-services}/index.ts`

## Notas para quien la reclame

- Solapa con `ASG-i-042` (mismo patrón, mismo helper). Coordinar para no crear dos helpers.

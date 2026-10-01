# Asignación ASG-i-045 — RLS que filtra por rol pero no por sede

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** b
> **claimed_at:** 2026-10-01
> **resulting_track:** 0047-b-rls-aislamiento-por-sede

---

> **Confirmación (2026-09-30), en vivo contra la BD del piloto, solo lectura (secretaria sede 1 vs
> secretaria sede 2):**
> - ✅ **`class_b_sessions` CONFIRMADA (lectura):** ambas secretarias ven las mismas 1.728 clases;
>   no hay filtro de sede en el SELECT.
> - ✅ **`special_service_sales` CONFIRMADA (lectura):** la secretaria de la sede 1 lee 4 ventas de
>   la sede 2.
> - ❌ **Corrección:** la **lectura** de `students`, `enrollments` y `payments` **sí está filtrada**
>   por sede en la BD remota (0 filas de la otra sede). Para esas tablas lo pendiente es solo la
>   **escritura** (INSERT/UPDATE/DELETE), que no se probó.
> - La BD remota difiere de las migraciones en algunos puntos: revisar `pg_policies` (consulta en
>   el Alcance) antes de diseñar.

## Contexto / Objetivo

Detectada leyendo el código (tanda de testing 2026-09-29; ver la confirmación de arriba; las policies salen de leer las
migraciones y la BD remota podría diferir porque parte del SQL se aplica a mano). En varias
tablas la RLS solo exige rol admin o secretaria, sin mirar la sede. La única barrera entre sedes
es el filtro que aplica el facade en el navegador: desde la consola, una secretaria de la sede A
puede leer, modificar o borrar datos de la sede B.

Casos principales:

| Tabla | Qué permite | Evidencia |
|---|---|---|
| `class_b_sessions` | Leer/crear/modificar/borrar clases de cualquier sede | `20260301000011_10_rls_policies.sql:346-364` (verificada: nunca redefinida) |
| `students` | INSERT/UPDATE/DELETE de cualquier sede (solo SELECT filtra) | `20260301000011…:152-156` |
| `payments` | Pagos de cualquier sede | `20260301000011…:696-705` |
| Servicios especiales | Ventas/catálogo de cualquier sede | `20260301000011…:790-813` |

El inventario completo (≈33 grupos de tablas, ≈13 con este problema) está en
`specs/testing-piloto/037-transversal-multisede-shell.md` §1.

## Alcance sugerido

- **Paso 1, confirmar contra la BD remota:** leer las policies vigentes en vez de confiar en las
  migraciones:

  ```sql
  select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where (schemaname = 'public' and tablename in
          ('class_b_sessions','students','payments','users','audit_log','special_service_sales'))
     or (schemaname = 'storage' and tablename = 'objects')
  order by schemaname, tablename, cmd;
  ```

  y
  probar desde la consola con la sesión de una secretaria (§4 de `037`, caso P08 de `024a`).
- Diseñar un patrón común (probablemente con el helper `branch_visible()` que ya existe) y
  aplicarlo tabla por tabla, incluidas las tablas hijas que no tienen `branch_id` directo
  (resolver la sede vía la matrícula o el alumno).
- Cuidar el grant multi-sede (`can_access_both_branches`) e instructores/vehículos "ambas sedes".
- Tests de regresión por tabla (secretaria A → 0 filas de B, UPDATE/DELETE rechazado).

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` S2 y §1 · `026-agenda-triple-match.md` S12
- `specs/testing-piloto/028-pagos-descuentos.md` S5 · `031-servicios-especiales.md` S5
- `.claude/rules/facades.md` §7, `indices/DOMAIN-GOTCHAS.md` DG-084…086

## Archivos involucrados (opcional, para detectar solapes)

- Nuevas migraciones de RLS

## Notas para quien la reclame

- Es el cambio de mayor riesgo de la tanda: una policy mal hecha puede dejar a alguien sin ver
  sus propios datos. Probar cada tabla con admin, secretaria de cada sede, secretaria con grant.
- Solapa con `ASG-i-046` (Storage) y `ASG-i-043` (RLS de `users`).

# Asignación ASG-i-056 — Canales de tiempo real que escuchan tablas no publicadas

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). 6 de 15 canales Realtime
escuchan al menos una tabla que no está en la publicación `supabase_realtime`. Según `fix-227-m`,
eso deja mudo **todo el canal** aunque reporte `SUBSCRIBED`: las pantallas no se actualizan solas.
Ejemplos: Base de Alumnos escucha `enrollments` (`admin-alumnos.facade.ts:119-134`); la ficha del
alumno escucha 5 tablas no publicadas (`admin-alumno-detalle.facade.ts:240-280`).

Inventario completo (canal → tablas → publicada sí/no) en
`specs/testing-piloto/037-transversal-multisede-shell.md` §1.

## Alcance sugerido

- **Paso 1, confirmar en la BD remota**:
  `select tablename from pg_publication_tables where pubname = 'supabase_realtime';`
  (las migraciones pueden no reflejar lo aplicado a mano) y probar un canal con 2 sesiones.
- Una migración que agregue las tablas que faltan (o quitar del canal las que no hacen falta).
- Revisar que cada canal tenga su `dispose`.

## Traspasado desde ASG-i-024 (Matías, 2026-10-04)

El testing de la Base de Alumnos B y de la ficha (`ASG-i-024`, track `fix-264-m`) confirmó la
sospecha en dos pantallas y dejó sin ejecutar los casos de tiempo real, porque dependen de esta
asignación. Se ejecutan acá, después de la migración.

**Ya confirmado en navegador o en la base:**

- **Base de Alumnos B:** `enrollments` no está en `supabase_realtime`. Un alumno matriculado en
  otra sesión no aparece en 10 s sin recargar (`024a` Q01, bug B10 de `fix-264-m`).
- **Ficha del alumno:** 5 de las 7 tablas del canal no están publicadas (`024b` S3, confirmado
  leyendo las migraciones; no se probó con dos sesiones).
- Al salir de cada pantalla el canal sí se cierra: se manda `phx_leave` de
  `alumnos-listado-realtime` y de `alumno-detalle-<id>` (`024a` Q05 y `024b` R04, ✅).

**Casos a ejecutar al cerrar esta asignación** (pasos en los checklists de origen):

| Caso | Checklist | Qué comprobar |
|---|---|---|
| Q01 | `024a-base-alumnos-b.md` | Dos sesiones: matricular en A → aparece en B sin recargar |
| Q02 | `024a` | Archivar y restaurar en A → se actualiza en B |
| Q03 | `024a` | Registrar un pago en A → cambian "Con deuda" y el estado en B |
| Q04 | `024a` | Subir un documento en A: el expediente en B no escucha documentos. Decidir si es aceptable |
| Q06 | `024a` | Admin y secretaria abiertos a la vez: sin cruce de datos entre sedes |
| R01 | `024b-ficha-ex-alumnos.md` | Dos sesiones: registrar un pago → la ficha abierta en B se actualiza sola |
| R02 | `024b` | El instructor marca asistencia → la grilla de la ficha en B se actualiza sola |
| R03 | `024b` | Un cambio en OTRO alumno no hace parpadear la ficha ni cambia de matrícula. Hoy el canal de la ficha no filtra por alumno: si empieza a funcionar, cualquier cambio en cualquier alumno la recargaría |

**Test E2E que ya existe:** `e2e/alumnos-b-lista.spec.ts > tiempo real > Q01 (S5)`, marcado
`knownBug('B10')`. Describe el comportamiento correcto y hoy falla a propósito. Cuando el canal
funcione, Playwright avisa que "pasó inesperadamente": ahí se le quita la marca.

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` §1 · `024a-base-alumnos-b.md` S5 · `024b-ficha-ex-alumnos.md` S3
- `specs/fixes/fix-227-m-*` y `fix-031-i-*` (mismo problema, ya visto dos veces)

## Archivos involucrados (opcional, para detectar solapes)

- Nueva migración de publicación Realtime

## Notas para quien la reclame

- Agregar tablas a la publicación aumenta el tráfico Realtime: revisar que los filtros del canal
  sean razonables.

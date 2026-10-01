# Asignación ASG-i-056 — Canales de tiempo real que escuchan tablas no publicadas

> **status:** pendiente
> **owner:** cualquiera
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

## Referencias

- `specs/testing-piloto/037-transversal-multisede-shell.md` §1 · `024a-base-alumnos-b.md` S5 · `024b-ficha-ex-alumnos.md` S3
- `specs/fixes/fix-227-m-*` y `fix-031-i-*` (mismo problema, ya visto dos veces)

## Archivos involucrados (opcional, para detectar solapes)

- Nueva migración de publicación Realtime

## Notas para quien la reclame

- Agregar tablas a la publicación aumenta el tráfico Realtime: revisar que los filtros del canal
  sean razonables.

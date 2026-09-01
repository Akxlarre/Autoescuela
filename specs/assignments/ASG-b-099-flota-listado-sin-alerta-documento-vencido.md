# Asignación ASG-b-099 — Listado de Flota no destaca vehículos con documentos vencidos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** Media
> **created:** 2026-08-31
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Detectado en el barrido UAT de Paquete 5 (Flota/DMS, `docs/UAT-PLAN.md`), caso "Ver listado
de vehículos → SOAP/revisión técnica vencidos se destacan visualmente (alerta)".

El Nissan Versa de la flota tiene un SOAP realmente vencido en la BD ("Vence: 06 MAY 2025",
badge rojo "Vencido" visible al abrir su panel de Documentación desde `/app/admin/flota`).
Pero su card en el listado principal de Flota sigue mostrando "Disponible" en verde, **sin
ningún indicador visual** de que tiene un documento vencido — hay que entrar al detalle de
cada vehículo uno por uno para descubrirlo.

El dato sí existe y se computa correctamente en otro lugar del sistema: el Dashboard admin
muestra "1 Documento vencido — Vehículos requieren atención inmediata" en Alertas
Importantes, y coincide 1:1 con este mismo vehículo. Solo falta conectar esa señal a la
card del listado de Flota.

Objetivo: que el listado de Flota (no solo el Dashboard, no solo el detalle del vehículo)
destaque visualmente qué vehículos tienen SOAP/Revisión Técnica/Permiso de
Circulación/Seguro vencidos, sin tener que entrar a cada uno.

## Root cause conocida

`src/app/shared/components/flota-list-content/flota-list-content.component.ts` no tiene
ninguna lógica de vencimiento — cero referencias a "vencid"/expiración en todo el archivo.
Nunca se conectó esa señal a la card, a diferencia del Dashboard que sí la calcula (revisar
de dónde la lee el Dashboard — probablemente `DashboardFacade` o un servicio de alertas — y
reutilizar esa misma fuente en vez de duplicar el cálculo).

Precedente relacionado (no resuelve este caso, pero es contexto): `fix-164-m` y `fix-165-m`
ya agregaron advertencia de documento vencido/por vencer, pero **solo en los flujos de
agendamiento** (Agenda semanal de solo lectura primero, luego el pipeline real de
agendamiento vía `fix-165-m`) — nunca tocaron el listado de Flota en sí.

## Alcance sugerido

- Leer el estado de documentos por vehículo en el facade de Flota (o agregar el query si no
  existe ahí) y agregar un badge/ícono de alerta a la card cuando algún documento esté
  vencido o por vencer.
- Reusar la misma fuente de verdad que ya usa el Dashboard, para no duplicar el cálculo ni
  arriesgar que diverjan (mismo patrón de lección aprendida en DOMAIN-GOTCHAS sobre no
  reimplementar lógica de scope/estado que ya existe en otro facade).
- Confirmar visualmente en `ng serve` con el Nissan Versa real del seed (ya tiene el SOAP
  vencido cargado, no hace falta fabricar datos de prueba).

## Archivos involucrados

- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- El facade de Flota (`FlotaFacade`, ver `indices/FACADES.md`)
- La fuente de datos que ya usa el Dashboard para "Documentos vencidos" (a identificar)

## Referencias

- `docs/UAT-PLAN.md` → Paquete 5, hallazgo #10 en el Registro de hallazgos
- `specs/fixes/fix-164-m-advertencia-documentos-vehiculo-agendamiento/fix.md`
- `specs/fixes/fix-165-m-advertencia-vehiculo-scheduling-real-flows/fix.md`

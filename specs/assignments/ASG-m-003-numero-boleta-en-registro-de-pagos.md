# Asignación ASG-m-003 — Campo de número de boleta al registrar un pago

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En todas las partes donde se registra un pago que llega a la autoescuela (prácticamente
siempre por una nueva matrícula o por un pago pendiente de una matrícula existente), se
necesita poder ingresar el número de boleta correspondiente a ese pago, una vez que el pago
ya fue realizado. Hay que buscar la mejor forma de integrar este campo en los flujos
existentes de registro de pago.

## Alcance sugerido

- Agregar un campo de número de boleta (texto o numérico, a definir) en el/los formulario(s)
  donde se registra un pago recibido.
- Cubrir tanto el registro de pago dentro del flujo de nueva matrícula como el registro de
  pago de una cuota/pago pendiente de una matrícula ya existente.
- Definir si el campo es obligatorio u opcional, y si se puede editar después de registrado.
- Considerar mostrar el número de boleta en el historial/detalle de pagos (relacionado con
  ASG-m-005, que agrega filtros a la tabla de Pagos).

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca el modelo de `payments`/pagos y los formularios de
  registro de pago en matrícula y en pagos pendientes.

## Notas para quien la reclame

- Confirmar con el dueño si el número de boleta debe ser único/validado contra duplicados,
  o es solo un campo de referencia libre.

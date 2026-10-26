# Asignación ASG-i-067 — Alumno de otra sede y traslado de sede (Clase B)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-10-24
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En el testing de matrícula presencial (`fix-058-i`, B3-1) la secretaria de la sede 2 intentó
matricular a un alumno que ya existía en la sede 1:

- **No lo encuentra:** por RLS no ve a los alumnos de la otra sede, así que el paso 1 no precarga
  sus datos.
- **Error crudo al guardar:** *"duplicate key value violates unique constraint users_rut_key"*. No
  se duplica nada (el RUT es único), pero el mensaje no dice qué pasó ni qué hacer.

Son dos casos distintos y la spec debe cubrir los dos:

- **(a) El alumno existe en la otra sede y no tiene matrícula activa** (egresó, canceló o nunca
  terminó): la sede nueva debería poder **reusar su ficha** y matricularlo normalmente.
- **(b) Traslado de sede:** el alumno tiene una matrícula Clase B **en curso** en la sede A y quiere
  seguir en la sede B.

**Pospuesta por Ignacio (2026-10-24)** para resolverla más adelante.

## Alcance sugerido

Conversado con Ignacio (2026-10-24), a confirmar con el equipo antes de escribir la spec.

**Caso (a) — reusar al alumno**
- Al poner el RUT en el paso 1, si el alumno existe en otra sede: aviso *"Este alumno está
  registrado en la sede X"* y se precargan sus datos para matricularlo en esta sede.
- La búsqueda va en el servidor (RPC que devuelve solo lo mínimo), porque la RLS no deja a la
  secretaria leer alumnos de otra sede.
- Nunca más el error crudo del RUT duplicado: siempre un mensaje claro.

**Caso (b) — traslado.** Dos opciones que planteó Ignacio; la spec debe elegir una:
1. **"Trasladar matrícula":** la misma matrícula cambia de sede. Sus clases agendadas se liberan y
   se vuelven a agendar con instructores y vehículos de la sede nueva; las ya hechas se mantienen.
2. **Cancelar y matricular de nuevo:** se cancela en la sede A (libera sus clases, con motivo) y se
   crea una matrícula nueva en la sede B. Lo ya pagado se reconoce como un **descuento "Traslado
   desde sede A"** en la matrícula nueva.

**Preguntas abiertas**
- ¿Quién puede trasladar: la secretaria de la sede A, la de la sede B o solo el admin? ¿Se avisa al
  admin?
- **Plata entre sedes:** con la opción 2, el dinero quedó en la caja de la sede A y la sede B lo
  descuenta. ¿Cómo lo ven los reportes y la caja de cada sede?
- ¿Qué pasa con las clases ya hechas, el ciclo teórico, el libro de clases y el certificado (que
  lleva la sede)?
- Fuera de alcance probable: Clase Profesional (flujo por promoción distinto).

## Referencias

- `fix-058-i-testing-matricula-presencial`: B3-1, casos S12/C17, decisiones M07/M08 del checklist.
- **`ASG-i-063`** (cerrar una matrícula y reiniciar el curso): se solapa con la opción 2. Si se hace
  primero, la cancelación con motivo ya existiría.
- `fix-069-i`: un pago no se borra, se anula. Un traslado no puede "mover" pagos borrándolos.
- DG-118 (una matrícula con consentimientos solo se cancela), DG-119.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/enrollment.facade.ts` (`findUserByRut`, `upsertUser`)
- `src/app/core/utils/reenrollment.utils.ts`
- `supabase/migrations/` (RPC de búsqueda por RUT entre sedes; si va la opción 1, RPC de traslado)

## Notas para quien la reclame

- La unicidad del RUT (`users_rut_key`) es global y debe seguir así: un alumno es una sola persona
  en ambas sedes.
- Cualquier lectura de otra sede va por una RPC `SECURITY DEFINER` con chequeo de rol, nunca
  abriendo la RLS de `users`/`students`.

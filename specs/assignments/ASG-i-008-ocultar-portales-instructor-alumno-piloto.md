# Asignación ASG-i-008 — Ocultar portales Instructor y Alumno para el lanzamiento piloto

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-15
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-09-19
> **resulting_track:** fix-255-m-piloto-guard-fase-portales-inscripcion

---

## Contexto / Objetivo

Decisión de alcance para la primera entrega (estudio previo + reunión de equipo, 2026-09-15):
el sistema se lanza con **Admin y Secretaria únicamente**. Instructor y Alumno no van a
interactuar con el sistema por ahora — queda para una fase posterior (ver ASG-i-009 para el
recorte adicional dentro de Clase Profesional que se decidió en la misma reunión).

**Esto NO es borrar código.** Los 4 portales siguen existiendo tal cual en el repo. Lo que se
pide es que, mientras dure esta fase, **no se pueda entrar** a `/app/instructor/**` ni a
`/app/alumno/**`, y que el menú no ofrezca esos ítems.

## Alcance sugerido

1. **Guard de fase** en `app.routes.ts` — bloquear la entrada a los grupos `instructor` y
   `alumno` (los dos `children` bajo `path: 'app'`) detrás de un guard nuevo (o una condición
   agregada a `hasRoleGuard`) que redirija a una pantalla de aviso en vez de renderizar el
   portal. Ver ASG-i-010 para qué debe mostrar esa pantalla — no usar `acceso-denegado`
   genérico, que está pensado para error de permisos, no para "todavía no habilitado".
2. **Menú** — en `menu-config.service.ts`, los casos `case 'instructor':` (línea ~37) y
   `case 'alumno':` (línea ~39) no deben devolver sus ítems mientras la fase esté activa.
3. La condición de fase (habilitado/oculto) debe vivir en **un solo lugar** — no repetir un
   `if` de fase en cada guard y en el menú por separado. Evaluar un flag centralizado (ej. un
   `const`/config en `core/` o un signal de un service pequeño) que ambos consulten, para que
   apagar la fase después sea un solo cambio, no una búsqueda por el código.
4. Si alguien intenta loguearse con una cuenta `instructor`/`alumno` real (no las de prueba),
   decidir junto con el equipo si el login debe bloquearse antes de entrar al shell, o si basta
   con que no tenga a dónde navegar una vez dentro — dejarlo explícito en el plan del track
   resultante, no asumir.

## Fuera de alcance

- No tocar la lógica de negocio de Instructor/Alumno — solo el acceso.
- No eliminar rutas, componentes, facades ni tests de esos portales.
- No afecta el checklist de evaluación práctica ni ninguna otra brecha funcional — eso quedó
  documentado aparte (ver el documento "Piloto Secretaría-Admin" del estudio de alcance).

## Referencias

- `src/app/app.routes.ts` — grupos `path: 'instructor'` y `path: 'alumno'` bajo `path: 'app'`.
- `src/app/core/services/auth/menu-config.service.ts` — casos `instructor`/`alumno`.
- Documento de estudio previo: "Piloto Secretaría-Admin" (artifact, 2026-09-14) — contiene el
  mapeo completo de qué acción de Instructor/Alumno ya está cubierta desde Admin/Secretaria.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/app.routes.ts`
- `src/app/core/services/auth/menu-config.service.ts`
- `src/app/core/guards/` (guard nuevo o extendido)

## Notas para quien la reclame

- Coordinar con ASG-i-009 (recorte de Clase Profesional) y ASG-i-010 (pantalla de aviso) —
  las tres nacieron de la misma decisión de alcance y probablemente conviene resolverlas en el
  mismo track si el mecanismo de "fase" que se diseñe acá sirve para las tres.
- P1 porque bloquea la entrega — sin esto, cualquiera con las cuentas de prueba puede seguir
  entrando a Instructor/Alumno.

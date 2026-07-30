# Spec 0021-b — Indexer: colector ROUTES.md + detección de artefactos huérfanos

> **Status:** done (2026-07-01 — ver acceptance.md)
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P2
> **Modelo Claude:** `claude-sonnet-4-6` (Sonnet 4.6) — el AST de rutas (arrays anidados, `loadComponent` con arrow functions e imports dinámicos) es de complejidad media; los huérfanos exigen cuidado con falsos positivos.

---

## 1. Contexto de negocio

**Origen:** Sesión de análisis del tooling AST (2026-07-01). El mapa de rutas vive a mano en
memoria/docs y se desactualiza; el usage map ya computa consumidores pero no expone el inverso.

**Persona afectada:** El agente (pierde tiempo redescubriendo rutas; no detecta código muerto).

**Problema que resuelve:**
1. No existe un índice de rutas: qué path carga qué componente, con qué guards. El agente lo
   reconstruye leyendo `app.routes.ts` cada vez, o confía en notas manuales desactualizadas.
2. `USAGE-MAP.md` lista consumidores por componente/directiva, pero no señala los artefactos
   de `shared/` con **cero consumidores** — candidatos a código muerto que hoy nadie ve
   (el caso "portal relator" de la auditoría UI es ejemplo de esta clase de deuda).

**Hipótesis de valor:**
El agente descubre rutas y guards sin abrir `app.routes.ts`, y el código muerto de `shared/`
aparece solo en cada sync en vez de esperar una auditoría manual.

---

## 2. User Stories

- **US1**: Como agente, quiero un `ROUTES.md` auto-generado (path → componente → guards),
  para ubicar la página correcta al recibir un requerimiento sin explorar el árbol de rutas.
- **US2**: Como humano, quiero una sección "sin consumidores detectados" en USAGE-MAP, para
  decidir qué componentes/directivas de `shared/` eliminar o reactivar.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (colector de rutas)**: Given `src/app/app.routes.ts` (y cualquier `*.routes.ts`
  adicional que exista o se agregue), When corre `indices:sync`, Then `indices/ROUTES.md`
  lista entre marcadores AUTO-GENERATED: path completo (concatenando padres de rutas
  anidadas), componente (resolviendo `loadComponent` lazy y `component` directo), guards
  (`canActivate`/`canMatch`/`canDeactivate`), y `data`/`title` si existen.
- **AC2 (fidelidad)**: Given el `app.routes.ts` actual, When se genera la tabla, Then cada
  ruta enrutable real aparece exactamente una vez (verificación manual contra el archivo:
  login, dashboard, inscripción pública, 404, etc.) y los redirects se listan como tales.
- **AC3 (huérfanos — componentes)**: Given un componente de `shared/` cuyo selector no
  aparece en ningún template de `features/`, `layout/` **ni de otros componentes `shared/`**,
  Then aparece en la sección "Sin consumidores detectados" de USAGE-MAP.
- **AC4 (huérfanos — directivas)**: Given una directiva de `core/directives/` sin apariciones
  en ningún template escaneado, Then aparece en la misma sección.
- **AC5 (disclaimer anti-falso-positivo)**: Given la sección de huérfanos, Then lleva una nota
  fija: "candidatos a revisión — un componente enrutado directo (ROUTES.md) o usado
  dinámicamente puede aparecer aquí sin estar muerto", y los componentes que SÍ aparecen en
  ROUTES.md se excluyen automáticamente de la lista.
- **AC6 (idempotencia + cache)**: Given dos corridas seguidas sin cambios, Then la segunda
  sale del cache mtime y no modifica ROUTES.md ni USAGE-MAP.md.

### Edge cases obligatorios

- **AC-E1 (shared consume shared)**: Given `app-kpi-card` usado solo dentro de otro
  componente de `shared/`, Then NO aparece como huérfano (esto obliga a extender el escaneo
  de consumidores a `shared/` mismo, que hoy `collectUsageMap` no recorre).
- **AC-E2 (rutas anidadas con children)**: Given rutas con `children` de 2+ niveles, Then el
  path mostrado es el concatenado real (`/app/dashboard`, no `dashboard`).
- **AC-E3 (guard funcional inline)**: Given un guard definido inline como arrow function en
  la ruta (no importado), Then se muestra como `(inline)` sin romper el parseo.

---

## 4. Out of scope

- ❌ Eliminar los huérfanos detectados — esta spec solo los **lista**; el borrado es decisión
  humana caso a caso (fix-tracks aparte).
- ❌ Validar que los guards funcionen — solo se indexan.
- ❌ Lazy-loading de módulos legacy (`loadChildren` con NgModule) — el proyecto es standalone.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `indices-sync.js` con AST de TypeScript, cache mtime, `injectGenerated`.
- `collectUsageMap` (se extiende para escanear también `shared/` como consumidor).
- `GUARDS.md` ya indexa los guards (ROUTES.md los referencia por nombre).

### Capacidades nuevas requeridas
- `indices/ROUTES.md` nuevo con marcadores AUTO-GENERATED.
- Registro del índice nuevo en el Discovery Gate / documentación de flujo si corresponde.

---

## 6. Datos y modelo (preliminar)

No aplica.

---

## 7. UX y flujos (preliminar)

Tabla ROUTES.md propuesta: `| Path | Componente | Guards | Lazy | Archivo |`.
Sección huérfanos en USAGE-MAP: tabla `| Artefacto | Tipo | Archivo |` + disclaimer fijo.

---

## 8. Métricas de éxito post-launch

- El agente cita ROUTES.md (en vez de abrir app.routes.ts) al ubicar páginas.
- Los stubs/huérfanos conocidos de las auditorías aparecen en la lista sin intervención manual.

---

## 9. Notas / decisiones abiertas

- [ ] ¿ROUTES.md entra en la lista de índices que levantan el Discovery Gate?
  (Propuesta: sí — es descubrimiento puro.)

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del análisis AST de la sesión).

# Spec 0020-b — Cross-reference de íconos Lucide: usados vs registrados

> **Status:** done (2026-07-01 — ver acceptance.md)
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P2
> **Modelo Claude:** `claude-sonnet-4-6` (Sonnet 4.6) — la recolección es mecánica, pero el manejo de bindings dinámicos (`[name]="expr"`) y la conversión kebab-case → PascalCase de Lucide requieren criterio para evitar falsos negativos.

---

## 1. Contexto de negocio

**Origen:** Regla de CLAUDE.md ("¡Si no lo registras, la app fallará en runtime!") + sesión de
análisis del tooling AST (2026-07-01).

**Persona afectada:** El agente (introduce el bug) y el usuario final (ve el crash o el ícono
vacío en producción).

**Problema que resuelve:**
Todo `<app-icon name="X">` requiere que el ícono esté registrado en
`LucideAngularModule.pick({...})` de `app.config.ts` (hoy línea ~277). Si falta, **falla en
runtime**, no en build. Es exactamente el tipo de contrato declarado-vs-usado que ya
verificamos para estilos (`collectStyles`): recolectar los usos, parsear el registro, y hacer
diff en lint time.

**Hipótesis de valor:**
Un crash de runtime se convierte en un error de `lint:arch` con nombre de archivo y de ícono.

---

## 2. User Stories

- **US1**: Como agente, quiero que `lint:arch` me diga qué íconos uso sin registrar, para
  corregirlo antes del build en vez de descubrirlo en el browser.
- **US2**: Como humano, quiero ver qué íconos están registrados pero sin uso, para mantener
  liviano el bundle del `pick()`.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (recolección de usos)**: Given todos los templates (`.html` + inline en `.ts`),
  When corre el check, Then recolecta cada `name="..."` estático de `<app-icon>` y de
  `<lucide-icon>` con su archivo de origen.
- **AC2 (parseo del registro)**: Given el `LucideAngularModule.pick({ A, B, ... })` de
  `app.config.ts`, When corre el check, Then extrae el set de íconos registrados vía AST
  (propiedades del ObjectLiteral, incluyendo alias `X: Y`).
- **AC3 (faltante = error)**: Given un ícono usado cuyo PascalCase no está en el `pick()`
  (kebab-case `trending-up` → `TrendingUp`), When corre `lint:arch`, Then reporta error
  (ARCH-14) con archivo, nombre kebab y el identifier exacto a agregar al `pick()`.
- **AC4 (huérfano = warning)**: Given un ícono registrado que ningún template usa, Then se
  reporta como warning informativo (candidato a remover del bundle), nunca como error.
- **AC5 (verde hoy o backlog explícito)**: Given el estado actual del repo, When se cierra la
  spec, Then el check pasa en verde (todos los usos actuales registrados) o los faltantes
  reales encontrados quedan corregidos en la misma spec.

### Edge cases obligatorios

- **AC-E1 (binding dinámico)**: Given `<app-icon [name]="expr">`, Then se reporta en una
  sección aparte "no verificable estáticamente" (conteo + archivos), sin bloquear el lint.
  Si `expr` es un ternario/union de literales resolubles, se validan los literales.
- **AC-E2 (alias en pick)**: Given `pick({ CircleAlert: AlertCircle })`, Then el nombre
  registrado a efectos del diff es la **clave** del objeto.
- **AC-E3 (ícono en string de config)**: Given nombres de ícono definidos en
  `menu-config.service.ts` u otros objetos de configuración TS (no en template), Then la spec
  decide explícitamente si se escanean (propuesta: sí, buscando `icon: '...'` en `layout/` y
  `core/services/`) o se documentan como límite conocido.

---

## 4. Out of scope

- ❌ Migrar `<lucide-icon>` directos a `<app-icon>` (si aparecen) — reportar, no refactorizar.
- ❌ Tree-shaking o cambios en cómo se registran los íconos.
- ❌ Íconos de PrimeNG (`pi pi-*`).

---

## 5. Dependencias

### Specs previas
- Ninguna. (Si 0018 se hace primero, reutilizar su `extractTemplateContent` compartido.)

### Capacidades del proyecto que se asumen existentes
- `app.config.ts` como único punto de registro (`LucideAngularModule.pick`).
- `app-icon` (`shared/components/icon/`) como wrapper canónico.
- AST walker de `architect.js`.

### Capacidades nuevas requeridas
- Decidir dónde vive el check: `architect.js` (bloquea) + sección opcional en un índice
  (`indices/STYLES.md` o `ICONS.md`) generada por `indices-sync.js` (informa).
- ⚠️ **Constraint operativo:** si toca `architect.js`, aplica el protocolo File Protector
  (humano aplica o autoriza).

---

## 6. Datos y modelo (preliminar)

No aplica.

---

## 7. UX y flujos (preliminar)

Salida de consola estilo `lint:arch`. Ejemplo de error:
`ARCH-14: Ícono 'shield-check' usado en topbar.component.ts pero ShieldCheck no está en LucideAngularModule.pick() (app.config.ts:277)`.

---

## 8. Métricas de éxito post-launch

- Cero incidentes de "ícono no renderiza / app crashea por ícono" desde el merge.
- Lista de íconos huérfanos disponible para limpieza periódica del bundle.

---

## 9. Notas / decisiones abiertas

- [ ] AC-E3: ¿escanear también objetos de config TS con `icon: '...'`? (Propuesta: sí —
  el sidebar/menú es justamente donde más íconos se declaran fuera de templates.)
- [ ] ¿Índice nuevo `ICONS.md` o sección en `STYLES.md`? (Propuesta: sección en STYLES.md,
  evitar proliferación de índices.)

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del análisis AST de la sesión).

# 🤖 Koa Agent Blueprint — Portable Spec (v5.1)

Este documento es una versión condensada y "portable" de las reglas de arquitectura, flujo de trabajo y UI de este proyecto. Está diseñado para ser entregado a cualquier Agente de IA para que pueda trabajar en armonía con nuestro sistema.

---

## 🚀 1. Flujo de Trabajo Obligatorio (5 Pasos)

Para cada tarea, el agente DEBE seguir estos pasos:

1. **DESCUBRIR:** Leer los índices en `indices/*.md` (`COMPONENTS.md`, `FACADES.md`, `DATABASE.md`, etc.). No reinventar lo que ya existe.
2. **PLANIFICAR:** Definir cambios sin violar la arquitectura Skeleton.
3. **EJECUTAR:** Escribir código priorizando la reutilización.
4. **VALIDAR:** Asegurar que el código cumple con los patrones (OnPush, Signals, Facades).
5. **SINCRONIZAR:** Al terminar, actualizar los archivos en `indices/*.md` con las nuevas definiciones.

---

## 🏗️ 2. Arquitectura Skeleton (Folder Structure)

```text
src/
├── app/
│   ├── core/      # Facades, Guards, Interceptors, Modelos e Interfaces globales.
│   ├── features/  # Smart Components (Páginas completas, ej: Dashboard).
│   ├── shared/    # Dumb Components (UI presentacional, reutilizable).
│   └── layout/    # Sidebar, Topbar, Shell de la app.
├── styles/
│   └── tokens/    # Variables SCSS. NUNCA hardcodear colores o espaciados.
supabase/          # Migraciones SQL y configuración de base de datos.
```

---

## 🛡️ 3. Reglas Arquitectónicas Críticas

- **Patrón Facade Estricto:** La UI (Components) **NUNCA** inyecta Supabase o HttpClient. Todo pasa por un Facade en `core/facades/`.
- **Detección de Cambios:** Usar `changeDetection: ChangeDetectionStrategy.OnPush` en todos los componentes.
- **Estado (Signals):** 
  - Usar `signal()` para estado síncrono.
  - Usar `RxJS` para asíncrono en Servicios/Facades, exponiéndolos con `toSignal()`.
  - Capturar errores siempre en el Facade.
- **Tipado Estricto:** Interfaces globales en `core/models/`. No duplicar tipos en componentes.
- **Base de Datos:** Cambios solo vía migraciones SQL en `supabase/migrations/`.

---

## 🎨 4. Reglas Visuales (PrimeNG & Atomic Design)

- **Prioridad de UI:** 1. Boilerplate Local -> 2. PrimeNG -> 3. Custom CSS.
- **Prohibido Tailwind Arbitrario:** No usar clases de color/espaciado arbitrarias. Usar exclusivamente **Tokens Semánticos** (`var(--ds-brand)`, `text-primary`, etc.).
- **Diseño Bento:** Utilizar el sistema de rejilla Bento establecido en `BRAND_GUIDELINES.md`.

---

## 🚫 6. Restricciones Técnicas (Guardrails)

Para pasar el control de calidad, el código DEBE evitar estos patrones legacy/prohibidos:

- **Angular Moderno:** Prohibido `*ngIf` y `*ngFor`. Usar sintaxis de control `@if` y `@for`.
- **Bindings:** Prohibido `[ngClass]` y `[ngStyle]`. Usar clases CSS o señales.
- **Signal API:** Prohibido `@Input()` y `@Output()`. Usar `input()`, `output()` y `model()` (Signal API).
- **Animaciones:** Prohibido `@angular/animations` y `@keyframes` en CSS. Usar **GSAP** para todo el movimiento.
- **Estilos:** Prohibido colores hardcodeados (ej: `text-red-500`). Usar tokens: `var(--ds-status-error)`.
- **Base de Datos:** 
  - Naming: `YYYYMMDDHHMMSS_dominio_tipo_desc.sql`.
  - Seguridad: Toda tabla nueva DEBE tener **RLS (Row Level Security)** activado.

---

## 📑 7. Mantenimiento de Índices

Si una tarea añade o modifica un componente, fachada o servicio, el agente debe actualizar la tabla correspondiente en la carpeta `indices/`. Si no tiene permisos de escritura, debe imprimir la tabla Markdown resultante para que el humano la actualice.

---

## 🚫 8. Anti-Patrones (Resumen)

- Inyectar servicios en componentes shared (Dumb components).
- Usar `any` (a menos que sea estrictamente necesario por Supabase typings).
- Lógica de negocio en el `.html` o directamente en el componente de UI.
- No manejar estados de carga (`isLoading`) y error en los Facades.

---

*Este documento resume la esencia del Koa Agent Blueprint v5.1.*

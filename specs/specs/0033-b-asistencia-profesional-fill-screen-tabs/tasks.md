# Tasks 0033-b — Asistencia Profesional: fill-screen + tabs

> Derivadas de plan.md §9. DoD por tarea = gate indicado + sin romper ACs previos.

- [x] **T1** — Extraer `firma-semanal-table.component.ts` + `resumen-alumnos-table.component.ts` (Dumb colocated en `features/admin/profesional-asistencia/`); pills `.pct-badge`/`.firma-badge` → `<app-badge>`; selección de firma local al Dumb con reset al cambiar `alumnos`; conectar en el template actual. **DoD:** `ng build` limpio, funcionalidad de firma intacta (AC3).
- [x] **T2** — Shell app-like: `.bento-grid--fill-screen-kpi` incondicional + `[appBentoReveal]`; panel `.bento-fill` (fila 3) con header de tabs [Firma semanal | Resumen] + cuerpo `overflow-y-auto`; eliminar código muerto (`getSessionClasses`, `drawerTitle`, `closeDrawer`, `.session-*`, `.resumen-table`, `.pct-badge`, `.firma-badge`), `mb-6` y el viewChild manual de GSAP. **DoD:** `ng build` limpio, AC1/AC2/AC8/AC9 estructuralmente cumplidos.
- [x] **T3** — Densidad del mapa: grid anidado `.bento-grid` → `.week-grid` compacto (auto-fit), paddings `p-4`→`p-3`/`py-3`; fix truncado "PENDIEN" en `session-day-card` (estado+conteo a línea 2); quitar `CommonModule`. **DoD:** `ng build` limpio, sin truncado ni colisión a 1440×900.
- [x] **T4** — Eliminar `secretaria-asistencia-profesional.component.ts` + su ruta en `app.routes.ts`; `npm run indices:sync` (ROUTES.md sin la ruta). **DoD:** `ng build` limpio, AC6.
- [x] **T5** — Validación integral: `npm run test:ci` verde (1350/1350), `npm run lint:arch` sin errores nuevos vs HEAD (idéntico: 0/166), `ng build`. **DoD:** AC10.
- [x] **T6** — QA visual Playwright (desktop 100vh sin scroll, tabs sin shift, drawer abierto, móvil, dark/light) + `indices/COMPONENTS.md` + `acceptance.md`. **DoD:** AC1–AC9 + edge cases con evidencia. Pendiente: visto bueno visual del owner (registrado en acceptance.md).

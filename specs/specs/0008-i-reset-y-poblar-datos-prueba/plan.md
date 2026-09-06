# Plan 0008-i — Resetear y repoblar la BD de prueba con datos masivos realistas

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-06

---

## 1. Resumen ejecutivo

(2-3 frases. Qué se va a construir técnicamente, en qué orden grueso.)

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/...` | (Smart/Dumb/Facade/Service/Migration) | … |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/...` | (agregar método X, extender tipo Y) | … |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.
> Esto se cruza con `indices/*.md` del proyecto.

### Componentes existentes que reutilizamos
- …

### Facades/Services existentes que extendemos
- …

### Componentes/Facades que NO existen y debemos crear
- …

---

## 4. Modelo de datos

> Leer `indices/DATABASE.md` primero para el grafo de dependencias real de
> `instructors`/`students` antes de definir el orden de `DELETE`.

### Migración(es) requerida(s)

```sql
-- Pseudo-SQL del reset y del seed. SQL final va en la tarea correspondiente de tasks.md.
-- Definir acá: orden de DELETE respetando FKs, y criterio exacto de exclusión de las
-- cuentas de login preservadas (admin@test.com, secretaria@test.com, secretaria2@test.com,
-- instructor@test.com, alumno@test.com).
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| … | … | … | … |

### Modelos UI/DTO

- Sin cambios.

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal o ASCII)

```
Owner ejecuta manualmente (Supabase local primero):
  1. Script de RESET (DELETE en orden FK-safe, excluyendo cuentas preservadas)
  2. Script de SEED (INSERT masivo: ~15 instructores, ~150-300 alumnos,
     ~6 meses de agenda con 3+ clases/día, matrículas/pagos/asistencia coherentes)
```

### Capas tocadas

- **Migration/Script**: `supabase/migrations/...` o script ad-hoc (definir cuál en §9 de
  `tasks.md` — no es un cambio de esquema, a confirmar si igual conviene versionarlo ahí)

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [ ] `architecture.md` — N/A (sin UI)
- [ ] `facades.md` — N/A
- [ ] `models.md` — N/A
- [ ] `visual-system.md` — N/A
- [ ] `swr-pattern.md` — N/A
- [ ] `notifications.md` — N/A
- [ ] `testing-tdd.md` — N/A (no hay lógica de aplicación nueva)
- [ ] `ai-readability.md` — N/A

---

## 7. Plan de testing

- No aplica testing unitario (es una operación de datos, no código de aplicación).
- Validación: correr el reset+seed contra Supabase **local** primero, navegar la app
  contra ese dataset y confirmar los AC1-AC6 manualmente antes de que el owner decida
  aplicarlo contra el entorno compartido.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Borrar por error una cuenta de login del equipo | Media | Excluir por email/id explícito, nunca por heurística; probar el reset contra local primero y verificar login de las 5 cuentas antes de dar por bueno |
| Dejar filas huérfanas o violar FKs al borrar | Media | Mapear el grafo de dependencias real desde `indices/DATABASE.md` antes de escribir el orden de `DELETE` |
| Dataset generado con estados imposibles en la UI (clase sin instructor, alumno sin matrícula) | Media | Generar los datos respetando las mismas invariantes que ya usa el resto del seed de prueba del proyecto |
| Volumen alto tarda demasiado en insertarse / satura Supabase local | Baja | Confirmado volumen moderado (~6 meses, ~15 instructores, ~150-300 alumnos), no el escenario de mayor volumen |

---

## 9. Orden de implementación

1. Leer `indices/DATABASE.md`, mapear FKs de `instructors`/`students` hacia abajo.
2. Escribir el script de RESET (SQL), con exclusión explícita de las 5 cuentas.
3. Validar el RESET contra Supabase local: login de las 5 cuentas sigue funcionando,
   `instructors`/`students` y dependientes quedan vacíos salvo lo preservado.
4. Escribir el script de SEED (SQL o script generador), apuntando al volumen confirmado.
5. Validar el SEED contra Supabase local: navegar listados/agenda/reportes, confirmar
   AC4-AC6.
6. Entregar ambos scripts al owner para aplicar manualmente (no se auto-ejecutan).

---

## 10. Estimación

M (1-2 días) — mapear dependencias + escribir y validar 2 scripts (reset + seed) contra
Supabase local.

---

## Changelog

- 2026-09-06 — plan pendiente de completar con /spec-plan (detalle de tablas/orden de FKs)

# Asignaciones de Equipo — {{PROYECTO}}

> Tablero vivo de tareas designadas a integrantes del equipo, **antes** de que exista
> una spec/fix/hotfix. Una Asignación no es un track — es el paso previo: alguien
> declara "esto hay que hacer, se lo asigno a X (o a quien lo tome primero)", y quien
> la reclama genera su propio track con `/assign-claim`, con contexto pre-cargado.
>
> Ciclo: `/assign-new` → esta tabla ("Pendientes") → `/assign-list` (cada dev ve lo
> suyo) → `/assign-claim` (genera spec/fix/hotfix real, con SU código de autor) →
> flujo SDD normal desde ahí.
>
> ⚠️ **Multi-rama**: si cada persona trabaja en su propia rama, este archivo puede
> quedar desactualizado entre ramas. Commiteá y pusheá los cambios acá **de inmediato**
> (antes de armar tu rama de feature) para que el resto del equipo vea la reclamación
> a tiempo. Ver sección "Conflictos entre ramas" al final.

---

## Pendientes

| ID | Título | Asignado a | Tipo sugerido | Prioridad | Creado por | Notas |
|----|--------|-----------|---------------|-----------|------------|-------|

---

## Reclamadas / En curso

| ID | Título | Reclamado por | Track resultante | Fecha |
|----|--------|----------------|-------------------|-------|

---

## Completadas

| ID | Título | Track resultante | Cerrada |
|----|--------|-------------------|---------|

---

## Convenciones

- **IDs:** `ASG-NNN`, 3 dígitos, contador **global** (no por autor) — secuencial, nunca se reutiliza.
- **`Asignado a`:** código de autor de `specs/AUTHORS.md` (ej. `m`, `b`, `i`), o `cualquiera` si es un pool abierto para quien la tome primero.
- **`Tipo sugerido`:** `spec` (feature nueva) / `fix` (bug con AC afectados) / `hotfix` (fix urgente simple) — quien reclama puede cambiarlo con `--as=` si al leer el contexto no coincide.
- **Reclamar:** solo se puede reclamar una asignación con `Asignado a: cualquiera`, o una asignada específicamente a tu propio código de autor. Una vez `Reclamada`, nadie más puede tomarla.
- **Cerrar:** marcar como `Completada` es **manual** — se mueve la fila cuando el track resultante (spec/fix/hotfix) llega a `done`/se cierra. No se sincroniza automáticamente con `/spec-verify` ni `/fix-close`.
- **Archivos involucrados:** cada `ASG-NNN-*.md` tiene una sección opcional "Archivos involucrados". Si se completa, `/assign-claim` la usa para avisar (no bloquear) si te solapás con otra asignación ya reclamada que declaró los mismos archivos — señal de alerta, no enforcement duro.

### Conflictos entre ramas

`/assign-claim` ya hace un `git fetch` + comparación contra `origin/main` en automático antes de reclamar
(best-effort: si falla por falta de red/remoto, no bloquea). Si dos personas igual reclaman la misma
asignación en paralelo (ej. por no pushear a tiempo), no hay resolución automática más allá de ese aviso
— es coordinación humana: quien se entera después, cede y reclama otra. Para minimizar el riesgo:

1. Si `/assign-claim` te avisa que tu copia está atrás, hacé `git pull` antes de continuar.
2. Al reclamar, commiteá y pusheá **solo ese cambio** (este archivo + el track nuevo) de inmediato, separado del resto de tu trabajo de feature.

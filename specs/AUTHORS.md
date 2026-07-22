# Autores — Specs, Fixes y Hotfixes

Este proyecto es multi-agente: varios devs (cada uno con su propio Claude Code) crean
specs/fixes/hotfixes en paralelo. A partir de esta convención, `specs/` se commitea al
repo (dejó de estar en `.gitignore`) para que el agente de cualquiera vea el trabajo de
todos. Para que ningún agente confunda el `fix-027` de una persona con el de otra, todo
ID de track lleva un **código de autor de una letra**.

## Códigos vigentes

| Código | Autor    |
| ------ | -------- |
| `m`    | Matías   |
| `b`    | Benjamín |
| `i`    | Ignacio  |

Si se suma alguien al equipo: agregar su código acá **antes** de que cree su primer
track, para evitar colisiones con alguien que ya esté usando esa letra.

## Cómo se reparte el trabajo entre el equipo

Antes de que alguien escriba su propia spec/fix, el trabajo se designa vía el tablero
`specs/ASSIGNMENTS.md` (capa previa a un track, no reemplaza nada de lo de abajo):

```
/assign-new "título"    → lo agrega a specs/ASSIGNMENTS.md, asignado a un código de autor (o "cualquiera")
/assign-list             → cada quien ve qué le toca a él
/assign-claim <ASG-ID>   → genera SU spec/fix/hotfix (numerado con su propio código, según las reglas de abajo)
```

Ver `specs/ASSIGNMENTS.md` para el tablero actual y las convenciones completas.

## Formato de ID (con autor)

| Track      | Formato          | Ejemplo                        |
| ---------- | ---------------- | ------------------------------- |
| **Spec**   | `NNNN-X-slug`    | `0004-m-flujo-pago`             |
| **Fix**    | `fix-NNN-X-slug` | `fix-052-m-select-default`      |
| **Hotfix** | `hotfix-NNN-X-slug` | `hotfix-003-b-crash-login`   |

`X` = código de autor (tabla arriba, una sola letra). `NNN` / `NNNN` es el contador
**propio de ese autor en ese track** — no es un contador global del repo.

## Cómo se calcula el siguiente número

Cada autor numera de forma **independiente** por track. Ejemplo: si Matías va en
`fix-050-m` y Benjamín en `fix-070-b`, el próximo fix de Matías es `fix-051-m`
(**NO** `fix-071-m`) — la numeración de Benjamín no le afecta.

Antes de crear un track nuevo, Claude debe:

1. Leer el código de autor desde `.claude/author.local.json` (gitignored, uno por
   máquina/dev). Si no existe, preguntarle al humano su código y crearlo a partir de
   `.claude/author.local.json.example`.
2. Listar las carpetas existentes bajo `specs/` (y `specs/fixes/hotfixes/` para
   hotfixes) y filtrar solo las que correspondan a ese autor: el segmento de autor
   coincide con el código (ej. para `m` → `fix-NNN-m-*`, `NNNN-m-*`).
3. Tomar el número más alto encontrado para ESE autor en ESE track y sumarle 1.
4. Si no hay ninguno previo de ese autor en ese track, partir de `001` (fix/hotfix) o
   `0001` (spec).

## Historial

Todo lo creado antes de 2026-07-18 (por Matías, trabajando solo, antes de que `specs/`
se compartiera con el equipo) fue renombrado a la convención de autor el mismo día
(ej. `fix-051-select-default-...` → `fix-051-m-select-default-...`), porque nunca
había sido commiteado — no había historial de git que romper. Rango legacy de Matías:
`fix-015-m` … `fix-051-m`, `hotfix-001-m` … `hotfix-036-m`, `0001-m-ciclos-teoricos`.
El siguiente fix de Matías es `fix-052-m`.

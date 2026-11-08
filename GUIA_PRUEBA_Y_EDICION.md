# Guía para probar y editar RR Tareas

Esta guía sirve para el primer equipo de pruebas de RR Aliados.

## 1. Qué probar

RR Tareas es una aplicación de escritorio local. No requiere cuenta, red, IA, token ni conexión con DashWeb.

Recorrido recomendado:

1. Abrir la app y crear un workspace llamado `Prueba RR`.
2. Crear una tarea de una línea: `Revisar entrega de Manuel`.
3. Crear otra de varias líneas y comprobar que la primera queda como título y el resto como descripción.
4. Cambiar estado, prioridad, etiquetas, fecha y añadir un paso de checklist.
5. Cambiar a `Notas`, crear una nota y comprobar búsqueda y archivado.
6. Probar los ayudantes visibles: siempre muestran una vista previa y solo modifican la tarea al pulsar `Aplicar`.
7. Preparar una entrega manual, comprobar la vista previa y copiarla.
8. Cambiar el selector de tema entre `Sistema`, `Claro` y `Oscuro`; comprobar que texto, controles, foco y logo siguen siendo legibles.
9. Cerrar y abrir la app; comprobar que el workspace, la tarea y el tema siguen allí.
10. Exportar un backup y revisar su contenido antes de compartirlo.

## 2. Cómo ejecutarlo desde el código

Requisitos:

- Node.js 24 o superior.
- pnpm 12 o superior.
- Rust estable.
- En Linux, las dependencias gráficas de WebKitGTK que exige Tauri.

Desde una copia del repositorio:

```bash
pnpm install
pnpm check
pnpm tauri dev
```

Comandos de verificación:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Para generar el ejecutable de escritorio:

```bash
pnpm tauri build
```

En Linux, para instalar el launcher con el logo RR después de compilar:

```bash
env HOME=/home/deadkiss ./scripts/install-desktop-entry.sh
```

El flyer listo para enviar está en `flyer/out/rr-tareas-manuel.pdf` y `flyer/out/rr-tareas-manuel.png`.

## 3. Cómo editarlo

- Trabajar en una rama propia, por ejemplo `feat/nueva-funcion`.
- Mantener el dominio sin dependencias de red en `src/core.ts`, `src/domain.ts` y `src/handoff.ts`.
- No guardar secretos, tokens, cookies ni datos de clientes en el repositorio.
- Para cambios visuales, conservar la identidad RR y el logo canónico de `public/brand/rr-logo-fucsia-on-negro.png`.
- Mantener el selector `Sistema / Claro / Oscuro` y probar cada variante con foco de teclado visible.
- Añadir o actualizar pruebas antes de abrir un pull request.
- Ejecutar `pnpm check` antes de pedir revisión.

## 4. Qué no está habilitado todavía

- No escribe automáticamente en DashWeb ni en `cm_tasks`.
- No hay modelo remoto ni subagentes dentro de la app.
- No hay atajo global.
- No hay instalador firmado.
- No hay cifrado empresarial del workspace.

La copia manual para DashWeb es deliberada: la app prepara el contenido, pero no afirma que la tarea externa haya sido creada.

## 5. Cómo reportar un hallazgo

Incluir:

- Sistema operativo y versión.
- Pasos para reproducir.
- Resultado esperado y resultado real.
- Captura saneada, sin datos personales ni información de clientes.
- Commit o rama donde ocurrió.

No adjuntar tokens, cookies, claves, conversaciones privadas ni un backup completo sin revisarlo.

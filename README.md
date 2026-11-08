# RR Tareas

Asistente flotante local de tareas y notas para RR Aliados. El núcleo funciona sin cuenta, red, IA, DashWeb ni secretos.

## Estado

MVP local verificado. El repositorio público es `rraliadosteam-prog/rraliadostask-assistant`; la licencia y los releases firmados siguen pendientes de decisión de dirección.

## Flujo útil

1. Crear o abrir un workspace local.
2. Capturar una tarea o nota: la primera línea es el título y el resto, la descripción.
3. Organizar por estado, prioridad, etiquetas, fecha y checklist.
4. Pedir una sugerencia local y revisarla antes de aplicarla.
5. Preparar la entrega manual, copiarla o exportarla y pegarla en DashWeb.

Copiar nunca confirma que una tarea haya sido creada en DashWeb.

## Arquitectura

- UI React + TypeScript.
- Shell Tauri 2 para ventana flotante/redimensionable, portapapeles, archivos locales y el logo canónico RR Aliados.
- Dominio TypeScript sin dependencias de red.
- Workspace authoritative en JSON versionado (`rr-task-workspace`, versión 2).
- Escritura atómica con backup `.bak`; un archivo corrupto no se reemplaza silenciosamente.
- `ManualAdapter` local: preview, portapapeles y exportación.
- Helpers deterministas visibles: resumir, desglosar, detectar faltantes, proponer prioridad, preparar handoff y convertir nota.

El modelo remoto no se llama en el flujo local. Los helpers del MVP se presentan como sugerencias locales, nunca como una revisión Goldfish/EGM completa.

## Desarrollo local

Requisitos: Node 24+, pnpm 12+, Rust estable y dependencias de WebKitGTK para compilar el shell nativo en Linux.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm tauri dev
```

En un escritorio Tauri:

- `pnpm tauri dev` abre la app.
- `pnpm tauri build` genera los bundles de escritorio cuando el entorno nativo esté completo.
- `pnpm tauri build --no-bundle` genera el ejecutable nativo sin instalador.
- `env HOME=/home/deadkiss ./scripts/install-desktop-entry.sh` instala el launcher `RR Tareas` con el logo RR en Linux.

La interfaz ofrece `Sistema`, `Claro` y `Oscuro`. La preferencia se guarda en el workspace y también se recuerda localmente antes de crear el primero. Los colores incluyen foco visible y contraste reforzado para texto, controles y estados.

## Datos

- Instalado: el directorio de datos de la aplicación, bajo `RR Tareas/`.
- Portable: si existe `portable.flag` junto al ejecutable, usa `data/` en esa misma carpeta.
- Cada workspace usa `workspace.json`, temporal `.tmp` y backup `.bak`.

Los datos pueden contener información sensible introducida por la persona. No hay telemetría. Los logs no deben incluir títulos, cuerpos, prompts ni rutas completas.

## Privacidad y límites

- Cero tráfico en el flujo manual.
- Sin secretos, API keys, tokens, shell, navegador, correo o ejecución de herramientas.
- No escribe en DashWeb, Hermes, `cm_tasks`, Supabase ni el Mega Dashboard.
- La exportación de backup muestra advertencia: es privada y debe revisarse antes de compartirse.
- El cifrado empresarial y la gestión de credenciales no están incluidos en este MVP.

## Verificación

Los comandos de verificación se ejecutan desde este repositorio:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Los resultados exactos de la corrida local deben quedar en `VERIFICATION.md`, generado durante la verificación, no como promesa en este README.

## Decisiones pendientes

- Organización, nombre final y visibilidad del repositorio.
- Licencia del código.
- Target de release firmado y artefactos por plataforma.
- Contrato y autorización para escritura API con DashWeb.
- Cifrado empresarial y gestión de claves.
- Integración futura con proveedor de IA y aislamiento de subagentes.

## Publicación

El repositorio público es `rraliadosteam-prog/rraliadostask-assistant`. El workflow `.github/workflows/release.yml` compila la app para Linux, Windows y macOS, adjunta los artefactos con `SHA256SUMS.txt` a un release de GitHub y se puede lanzar a mano desde **Actions → release → Run workflow**. La publicación de un tag la hace una persona con permiso de escritura en el repositorio.

El asset de marca local es `public/brand/rr-logo-fucsia-on-negro.png`, copiado desde la fuente canónica RR y usado en la interfaz, el icono nativo y el launcher Linux.

El flyer de prueba y entrega está en `flyer/out/rr-tareas-manuel.pdf` y `flyer/out/rr-tareas-manuel.png`; cubre descarga, edición, uso y privacidad.

# Contexto de chats y trabajo

## Proyecto

Aplicacion React/Vite para gestionar la Incorporacion de Activos de Cerrejon. El portal publicado esta en:

https://glencore.sharepoint.com/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/index.aspx

Los checklists se almacenan en la lista SharePoint `DB_CHECKLIST_APP` del subsitio:

https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist

Las listas del subsitio se administran desde:

https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist/_layouts/15/viewlsts.aspx?view=14

Las evidencias nuevas se guardan como archivos en `ac/SiteAssets/Incorporaciones/Evidencias/`. Los PDFs se guardan en `ac/SiteAssets/Incorporaciones/PDFs`. Las fotos del equipo se almacenan comprimidas dentro de `Metadata` del checklist. La aplicacion usa SharePoint REST y autenticacion con la sesion de Microsoft 365.

## Documentacion

- `AGENTS.md` fue actualizado para describir la arquitectura real: React 19, Vite 8, Tailwind 4, SharePoint REST, listas, evidencias, roles, metricas, build y despliegue.
- `README.md` fue ampliado con el proposito, portal, estructura, almacenamiento, permisos, plantillas, indicadores, filtros y proceso de publicacion.

## Ajustes implementados

### Filtros de tabla

En `checklist-app/src/components/CheckListAll.jsx` se implementaron filtros multi-seleccion en los encabezados de:

- `NOM. CHK.`
- `PLAN (ESP.)`
- `COMPL. (REAL)`
- `GER.`
- `SUPT.`
- `TIPO INCORP.`
- `CREAD. POR`

Cada filtro tiene buscador, checkboxes, `Todos`, `Ninguno`, contador, `Limpiar` y `Aplicar`.

Reglas actuales:

- Las selecciones se aplican con `Aplicar`.
- Un clic fuera del popover aplica automaticamente la seleccion y cierra el menu.
- `Limpiar` elimina la seleccion, aplica el filtro vacio y cierra el menu.
- `Escape` aplica la seleccion y cierra.
- El popover usa React portal y `position: fixed` para evitar recortes por el scroll de la tabla.
- El listado tiene scroll interno y el pie con acciones permanece visible.
- El icono de filtro es un embudo SVG.
- Los encabezados usan abreviaciones en mayuscula, negrita, una sola fila y sin romper palabras.
- La barra superior solo contiene, en este orden: `Crear Nueva Incorporacion`, `Nuevas Solicitudes`, `Solo con Alertas`.

### Cabecera inicial

La imagen introductoria fue reducida, el texto se alineo hacia arriba y se redujo el padding para liberar espacio vertical a la tabla.

### Exportacion y logos

`checklist-app/scripts/export-build.mjs` ahora:

- Copia los bundles JS/CSS a `export/assets`.
- Copia `dist/img` a `export/img`.
- Copia `favicon.svg` e `icons.svg`.
- Convierte las rutas de assets del `index.aspx` a rutas absolutas bajo:
  `/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/`

Esto corrige errores 404 y MIME al cargar CSS/JS desde SharePoint y asegura que se publiquen `Logo.png` y `fabiconCerrejon.png`.

## Archivos principales

- `checklist-app/src/components/CheckListAll.jsx`: listado, filtros, tabla y cabecera inicial.
- `checklist-app/src/index.css`: estilos de filtros y encabezados.
- `checklist-app/scripts/export-build.mjs`: exportacion para SharePoint.
- `checklist-app/export/index.aspx`: paquete generado, no editar manualmente.
- `README.md`: documentacion para usuarios y desarrolladores.
- `AGENTS.md`: contexto tecnico para agentes.

## Commits realizados

- `fb3f53b`: documentacion inicial completa del portal.
- `860b410`: filtros, exportacion SharePoint, rutas y logos.
- `e782eca`: cabecera introductoria compacta y README.

Rama actual: `DEV`. El ultimo push confirmado fue `e782eca`.

## Validacion

Ejecutar desde `checklist-app/`:

```bash
npm run build
```

El build termina correctamente y regenera `dist/` y `export/`. El aviso existente indica que el bundle JavaScript supera 500 KB, pero no bloquea la compilacion.

El lint global tiene errores preexistentes en archivos fuente y bundles generados; los archivos modificados han sido revisados sin errores de diagnostico.

## Como continuar en otro chat

Decir:

> Lee `AGENTS.md`, `README.md` y `CHAT_CONTEXT.md`. Continua desde el ultimo estado del proyecto.

Antes de editar, revisar `git status` y ejecutar el build despues de cambios en `checklist-app/src/`.

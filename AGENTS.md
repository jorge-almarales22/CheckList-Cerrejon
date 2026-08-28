# Agent Instructions and Project Context

This document is the working map for the current Cerrejon asset-incorporation checklist application. The modern application is under `checklist-app/`; the root files `index.html` and `tipos.js` belong to an older implementation and should not be treated as the source of truth.

## Purpose and Published Portal

The application manages the readiness and handover of new, purchased, assembled, used, or project-delivered assets. It provides templates of technical and operational tasks, responsible users, corresponsibles, planned and actual dates, progress, evidence, comments, alerts, approvals, dashboards, Gantt views, SPI indicators, equipment photos, and PDF records.

Production portal:

`https://glencore.sharepoint.com/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/index.aspx`

The generated SharePoint deployment artifact is `checklist-app/export/index.aspx`. The older URL under the `checklist` site is not the canonical current portal.

## Technology and Structure

- React 19, ReactDOM 19, Vite 8, Tailwind CSS 4, and JavaScript ES modules.
- `checklist-app/src/main.jsx` is the browser entry point.
- `checklist-app/src/App.jsx` authenticates the current SharePoint user and renders the application.
- `checklist-app/src/components/` contains the dashboard, checklist list, creation and detail workflows, charts, Gantt, people picker, navigation, footer, and SPI badge.
- `checklist-app/src/utils/sharepointApi.js` owns SharePoint REST calls, list CRUD, folders, evidence files, and hierarchy lookups.
- `checklist-app/src/utils/calculations.js` owns permission helpers, historical records, progress, task status, SPI, and dashboard metrics.
- `checklist-app/src/data/constants.js` owns SharePoint URLs, list names, permissions, templates, and task libraries.
- `checklist-app/public/` contains public icons and branding assets.
- `checklist-app/dist/` is Vite output; `checklist-app/export/` is the SharePoint-ready output.

There is no backend service or separate application database. The browser communicates directly with SharePoint REST APIs and a Power Automate/Teams webhook.

## Authentication, Roles, and Permissions

Authentication uses the Microsoft 365/SharePoint browser session through `/_api/web/currentuser`; there is no local login form or token server. The current user is assigned `Administrador` when their email is in the administrator allowlist in `src/App.jsx`; other authenticated users currently default to `Responsable`. `Desarrollador` is defined in the permission map but is not automatically assigned by the current bootstrap code.

The permission map is in `src/data/constants.js`. Task editing is allowed to administrators, the assigned responsible user, or the optional corresponsible. Only administrators or the assigned responsible user can assign a corresponsible. Client-side checks guide the UI, while SharePoint permissions remain the actual security boundary.

## Data Storage and Retrieval

Checklist records are stored in the SharePoint list `DB_CHECKLIST_APP` at the checklist site:

`https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist`

The lists for this subsite can be administered from [Contenido del sitio](https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist/_layouts/15/viewlsts.aspx?view=14). The subsite stores checklist records and legacy compatibility data; the published application lives under the `ac` site, and the deliverable/PDF library lives in the SGIA root site.

Each list item stores the checklist object as JSON in the `Data` field. The object includes metadata, type, approval status, creator, general comments, and task records. Tasks contain responsible users, optional corresponsible, baseline and actual dates, progress, evidence references, alerts, status, and comments.

Deliverables (task evidence) are stored as binary files in the SGIA root site document library, under:

`/sites/co-lmn-sgia/Documentos compartidos/Incorporación/Entregables/{tipo}/{nombre-del-checklist}/`

The type folders are `Checklist Ensamble`, `Checklist Compra Instalada`, and `Checklist Proyectos`. Images are compressed in the browser before upload. The application also reads legacy base64 evidence from the `EvidenciasChecklist` list for migrated records.

Each task has its own default subfolder inside the checklist folder, named `<orden>_<descripcion corta>` (e.g. `03_Pruebas_comisionamiento`). Users can also create additional subfolders from the evidence uploader (a folder selector per task with a "Nueva carpeta..." option) to organize many documents. Uploaded files are named `<orden>_<nombreDocOriginal>_<usuarioSinDominio>.<ext>` (e.g. `03_Informe_Pruebas_juan.perez.pdf`), where the order identifies the task, the original document name is preserved, and the user is the email prefix (before `@`). The detail view reads files from the root folder and from all subfolders of each task.

The metadata header includes an "Ir a Entregables" button (visible to all users) that opens the checklist's root folder in the SGIA document library in a new browser tab.

Equipment photos are compressed data URLs inside checklist `Metadata`. Finalized PDFs are generated in the browser with `html2canvas` and `jsPDF`, then uploaded to the same root folder of their incorporation (next to the task deliverables):

`/sites/co-lmn-sgia/Documentos compartidos/Incorporación/Entregables/{tipo}/{nombre-del-checklist}/`

Other SharePoint data sources:

- `JerarquiaL` on the SGIA root site supplies gerencia, abbreviated gerencia, and superintendencia options.
- `EquiposAC` on the `ac` site supplies process/unit options.
- `EvidenciasChecklist` is the legacy evidence compatibility source.

The application uses `/_api/contextinfo` for request digests and list item CRUD under `/_api/web/lists/getbytitle(...)/items`. PeoplePicker uses the SharePoint people search endpoint. File operations use folder creation, binary upload, listing, subfolder listing, and recycle-bin endpoints against the SGIA root site (the deliverable library is not on the `ac` site).

## Functional Areas

- Checklist list: loads records, approval inbox, filters, pagination, metrics, deletion, and template selection.
- Checklist creation: selects a template, edits tasks, assigns users, captures metadata/photos, and creates a pending record.
- Checklist detail: edits tasks, dates, progress, comments, alerts, evidence, metadata, approval, finalization, type correction, PDF generation, and Gantt visualization.
- Dashboards: expected versus real progress, progress by responsible, gerencia charts, SPI status, and task risk indicators.
- Notifications: sends comments and alerts through the configured Power Automate/Teams webhook.

Templates are defined in `src/data/constants.js`: `PROYECTO`, `COMPRA INSTALADA`, and `ENSAMBLE`, with a generic fallback list. The root `tipos.js` and root `index.html` contain duplicated legacy definitions.

## Metric Rules

- Task expected progress is elapsed baseline time, clamped to 0-100.
- Task real progress is its numeric `Avance` value.
- Inactive tasks are excluded from averages.
- Checklist expected progress uses the earliest active baseline start and latest active baseline finish.
- Checklist real progress is the average of active task progress.
- Historical migrated records use stored values until they are edited, then recalculate from tasks.
- SPI is real progress divided by expected progress, expressed as a percentage.
- SPI below 90 is `Atrasado`; 90-94 is `En riesgo`; 95 or higher is `En tiempo`.
- Progress above 90 requires evidence, and a task is complete only at 100 with evidence.

## Column Filters (Shared Popover)

The multi-select column filters are implemented by the shared component `checklist-app/src/components/ColumnFilterPopover.jsx`, which exports two pieces:

- `ColumnFilterPopover`: the popover UI (search, checkboxes, `Todos`/`Ninguno`, counter, `Limpiar`/`Aplicar`), rendered via `createPortal` into `document.body` with `position: fixed`. It closes on outside click or Escape, and applies the selection on `Aplicar` or on outside click.
- `ColumnFilterTrigger`: a self-managed button that owns its own `isOpen` state and renders the popover when open. It computes a `popoverStyle` (top/left/width/maxHeight) from the anchor button's `getBoundingClientRect()` and **must pass it to the popover via the `style` prop** — if `style` is omitted, the popover mounts off-screen and appears broken even though React state works. This was the root cause of the "filters don't open" bug fixed in commit `4407009`.

The trigger accepts `valueLabels` (an object mapping raw values to friendly labels) so popovers can display readable text (e.g. `en_rojo` → `En rojo: atrasadas o sin fecha de entrega`).

Both the main table (`CheckListAll.jsx`) and the detail view (`CheckListDetalle.jsx`) use `ColumnFilterTrigger`. In the detail view, the internal task filters (responsable, estado, avance esperado, avance real) store their selections as `Set` in React state and combine values with OR semantics within each filter. The `MIS_TAREAS` sentinel (`__mis_tareas__`) is a special responsable option that filters tasks the current user can manage. When changing checklist type, `setFilterResponsable(new Set())` resets the responsable filter.

The detail filters are **cascading**: each filter only offers the values present in the tasks that pass the *other* filters. This is implemented with a single `aplicarFiltros(items, omitir)` helper that applies all active filters except the one named in `omitir`; each filter's option pool is computed by calling it with its own key omitted (e.g. `aplicarFiltros(listadoOrdenado, 'responsable')` yields the responsable options). Already-selected values are always kept in the option list so the user can deselect them even if they no longer match the filtered set.

## Commands and Deployment

Run commands from `checklist-app/`:

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

`npm run build` runs Vite and then `scripts/export-build.mjs`. That script recreates `export/`, converts asset paths to relative SharePoint paths, renames the generated HTML to `index.aspx`, and copies JavaScript/CSS bundles. Deploy the resulting `checklist-app/export/` contents to the `Incorporaciones` SharePoint location. Do not manually edit generated files in `dist/` or `export/`; change `src/` and rebuild.

Local development can load the UI, but authentication and data calls require a valid SharePoint session and same-origin deployment. There are currently no automated tests; validation is lint plus production build and, when available, a browser smoke test against SharePoint.

## Agent Rules for This Repository

- Preserve the modern source under `checklist-app/src/` unless the task explicitly targets the legacy root app.
- Do not introduce `localStorage` as the source of truth for checklist data.
- Keep SharePoint list names, field names, folder paths, and legacy fallbacks compatible with existing data.
- Never expose or rotate the Teams/Power Automate webhook in documentation or logs.
- Avoid editing generated `dist/` and `export/` output directly; regenerate it with `npm run build`.
- Keep documentation synchronized when architecture, storage, deployment URLs, or permissions change.

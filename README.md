# Incorporacion de Activos - Cerrejon

Portal web para gestionar la incorporacion de activos nuevos, comprados, ensamblados, usados o entregados por proyectos. El sistema centraliza checklists tecnicos y operativos, responsables, fechas, avance real y esperado, evidencias, comentarios, alertas, aprobaciones, indicadores SPI, dashboards, Gantt, fotografias y actas PDF.

## Portal

Produccion: [Incorporacion de Activos](https://glencore.sharepoint.com/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/index.aspx)

El portal publicado usa SharePoint como origen de autenticacion, datos y documentos. El enlace anterior bajo el sitio `checklist` corresponde a una ubicacion antigua y no es la referencia actual.

## Tecnologia

- React 19 y ReactDOM 19
- Vite 8
- Tailwind CSS 4
- JavaScript ES modules
- SharePoint REST API
- `html2canvas` y `jsPDF` para generar PDFs
- Power Automate/Teams para notificaciones

No existe backend propio: el frontend consume directamente SharePoint desde el navegador con la sesion corporativa de Microsoft 365.

## Estructura

La aplicacion vigente esta en `checklist-app/`:

```text
checklist-app/
	src/
		App.jsx                         Autenticacion y arranque
		main.jsx                        Entrada React
		components/                     Vistas y flujos de usuario
		data/constants.js               URLs, permisos y plantillas
		utils/sharepointApi.js          API REST, listas, carpetas y archivos
		utils/calculations.js           Avances, permisos, SPI y estados
		utils/notifications.js          Alertas y comentarios por webhook
	public/                           Logos, favicon e iconos
	scripts/export-build.mjs         Generacion del paquete SharePoint
	dist/                             Salida Vite
	export/                           Paquete publicado con index.aspx
```

Los archivos `index.html` y `tipos.js` en la raiz son de una implementacion legacy anterior. La fuente de verdad actual es `checklist-app/src/`.

## Donde se guarda la informacion

### Checklists

Los checklists se guardan en la lista SharePoint `DB_CHECKLIST_APP`, en el sitio:

`https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist`

Las listas disponibles en este subsitio se administran desde [Contenido del sitio](https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist/_layouts/15/viewlsts.aspx?view=14). El subsitio `checklist` contiene los registros y compatibilidad historica; el portal publicado y la biblioteca actual de evidencias/PDFs estan en el sitio `ac`.

Cada item guarda el objeto completo serializado como JSON en el campo `Data`. Incluye los metadatos, tipo, estado de aprobacion, creador, comentarios y tareas.

### Evidencias

Las evidencias nuevas se guardan como archivos binarios en el sitio `ac`:

`/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/Evidencias/`

Se organizan por tipo (`Checklist Ensamble`, `Checklist Compra Instalada`, `Checklist Proyectos`) y por nombre del checklist. Las evidencias antiguas migradas pueden seguir leyendose desde la lista `EvidenciasChecklist`, donde fueron almacenadas como base64.

### Fotografias y PDFs

Las fotografias del equipo se comprimen y se guardan dentro de `Metadata` del checklist. Los PDFs finalizados se generan en el navegador y se suben a:

`/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/PDFs`

### Catalogos

- `JerarquiaL`, en el sitio SGIA raiz: gerencias, gerencias abreviadas y superintendencias.
- `EquiposAC`, en el sitio `ac`: unidades/procesos.

## Como se autentica y que hace cada rol

La aplicacion obtiene el usuario actual mediante `/_api/web/currentuser`. No tiene formulario de login propio ni servidor de tokens.

- `Administrador`: control total, aprobaciones, eliminacion, administracion de tareas y metadatos.
- `Responsable`: consulta los checklists permitidos y gestiona las tareas asignadas.
- `Desarrollador`: permisos definidos para checklists de desarrollo; no se asigna automaticamente en el arranque actual.

El administrador, el responsable de la tarea y su corresponsable pueden diligenciarla. Solo el administrador o el responsable original pueden asignar el corresponsable.

## Plantillas y funciones

Las plantillas actuales estan en `checklist-app/src/data/constants.js`:

- `PROYECTO`
- `COMPRA INSTALADA`
- `ENSAMBLE`

El usuario puede crear checklists, diligenciar tareas, adjuntar evidencias, registrar comentarios y alertas, aprobar/rechazar, finalizar, consultar dashboards, ver Gantt, filtrar por responsables/gerencias y descargar PDFs.

La tabla de incorporaciones incluye filtros multi-seleccion por columna en `NOM. CHK.`, `PLAN (ESP.)`, `COMPL. (REAL)`, `GER.`, `SUPT.`, `TIPO INCORP.` y `CREAD. POR`. Cada filtro ofrece busqueda, checkboxes, `Todos`, `Ninguno`, `Limpiar` y `Aplicar`. Las selecciones se aplican al pulsar `Aplicar` o al hacer clic fuera del menu; `Limpiar` elimina la seleccion y cierra el menu. Los encabezados usan abreviaciones compactas para mantenerse en una sola fila.

El detalle de un checklist incluye filtros internos sobre sus tareas: buscador general (descripcion, responsable, tarea), responsable, estado (terminadas, faltantes, en rojo), rango de avance esperado, rango de avance real y la casilla `Solo en Alerta`. Estos filtros son independientes de los filtros de la tabla principal y no los afectan.

El encabezado de la tabla se mantiene visible al hacer scroll (sticky) anclado justo debajo del Navbar: el `<main>` quita su padding superior en la vista de `checklist_all` para que el sticky se pegue al tope sin dejar una franja vacia. Cada celda del `<thead>` tiene fondo gris claro/oscuro solido y las esquinas extremas quedan redondeadas (`rounded-tl-3xl` y `rounded-tr-3xl`) para acompanar el `rounded-3xl` de la tarjeta. El modelo de bordes usa `border-separate border-spacing-0` para que las esquinas redondeadas rendericen correctamente.

La pantalla inicial mantiene una cabecera compacta de introduccion de activos: la ilustracion se muestra reducida y el texto queda alineado hacia arriba para liberar espacio vertical para la tabla de incorporaciones.

## Indicadores

El avance real de un checklist es el promedio de sus tareas activas. El avance esperado se calcula sobre la ventana de fechas baseline de esas tareas. El SPI es `real / esperado * 100`:

- Menor de 90: atrasado.
- 90 a 94: en riesgo.
- 95 o mas: en tiempo.

Una tarea con avance superior al 90% requiere evidencia; para finalizarla debe tener 100% y evidencia.

## Desarrollo y publicacion

Desde `checklist-app/`:

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

`npm run build` compila con Vite y genera automaticamente `checklist-app/export/index.aspx` junto con sus assets mediante `scripts/export-build.mjs`. Ese contenido es el que se publica en SharePoint bajo `SiteAssets/Incorporaciones/`. El exportador copia unicamente los bundles JS/CSS y transforma las referencias de assets a rutas absolutas bajo `/sites/co-lmn-sgia/ac/SiteAssets/Incorporaciones/` para evitar errores 404 y MIME al abrir `index.aspx`. Las imagenes (logos, favicon, iconos e ilustraciones) no se copian al export: ya estan publicadas en SharePoint con nombres estables y el bundle las referencia por URL relativa, por lo que no cambian entre builds. Para publicar basta reemplazar en SharePoint los 4 archivos de `export/assets/` y el `export/index.aspx`.

La ejecucion local requiere una sesion corporativa valida para autenticarse y leer/escribir SharePoint. No hay pruebas automatizadas actualmente; la validacion disponible es `npm run lint`, `npm run build` y una prueba manual del portal publicado.

## Documentacion para agentes

La referencia tecnica para continuar el trabajo esta en [AGENTS.md](AGENTS.md). Debe consultarse antes de modificar arquitectura, nombres de listas, almacenamiento o el proceso de exportacion.

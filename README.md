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
- `sweetalert2` para confirmaciones, toasts y progreso
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
			FileManager.jsx             Gestor de entregables (modal tipo Drive)
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

Las listas disponibles en este subsitio se administran desde [Contenido del sitio](https://glencore.sharepoint.com/sites/co-lmn-sgia/checklist/_layouts/15/viewlsts.aspx?view=14). El subsitio `checklist` contiene los registros y compatibilidad historica; el portal publicado esta en el sitio `ac` y la biblioteca de entregables/PDFs vive en el sitio raiz SGIA.

Cada item guarda el objeto completo serializado como JSON en el campo `Data`. Incluye los metadatos, tipo, estado de aprobacion, creador, comentarios y tareas.

### Entregables (evidencias de tareas)

Los entregables de cada tarea se guardan como archivos binarios en la biblioteca `Documentos compartidos` del sitio raiz SGIA:

`/sites/co-lmn-sgia/Documentos compartidos/Incorporación/Entregables/`

Se organizan por tipo (`Checklist Ensamble`, `Checklist Compra Instalada`, `Checklist Proyectos`) y por nombre del checklist. Cada tarea tiene su subcarpeta por defecto (`<orden>_<descripcion corta>`, ej. `03_Pruebas_comisionamiento`) y el usuario puede crear subcarpetas adicionales desde el cargue de evidencias. Los archivos se nombran `<orden>_<nombreDocOriginal>_<usuarioSinDominio>.<ext>` (ej. `03_Informe_Pruebas_juan.perez.pdf`) para conservar el nombre del documento y saber quien lo subio. Las evidencias antiguas migradas pueden seguir leyendose desde la lista `EvidenciasChecklist`, donde fueron almacenadas como base64.

#### Gestor de Entregables (`FileManager.jsx`)

Cada tarea tiene un boton **"Adjuntar evidencias"** que abre el Gestor de Entregables, un modal tipo Drive/Dropbox con:

- **Breadcrumb interactivo** para navegar entre la carpeta de la tarea y sus subcarpetas.
- **Busqueda** y filtros por tipo de archivo y fecha de subida.
- **Crear carpeta** (`+ Nueva carpeta`) y **subir archivos** (boton `Subir` o arrastrar y soltar).
- **Grid agrupado**: carpetas primero, luego archivos agrupados por tipo (IMAGENES, PDF, DOCUMENTOS, HOJAS, OTROS) con iconos genericos segun la extension (sin cargar miniaturas pesadas).
- **Menu contextual** (`...`) por elemento: Abrir, Descargar, Mover (con selector de carpetas destino) y Eliminar.
- **Drag & drop de archivos**: subida directa con compresion desactivada (calidad original) y sin limite de tamano. Al arrastrar carpetas completas, se muestra un aviso que dirige al repositorio en SharePoint (la subida recursiva de carpetas no esta soportada en el gestor).
- **Confirmaciones y progreso** con SweetAlert2: eliminacion con confirmacion + toast de exito, movimiento con indicador "Moviendo elemento...", y subida con feedback en tiempo real.

La carpeta de la tarea se crea automaticamente (con loading "Creando carpeta de entregables...") la primera vez que se sube un archivo o al usar el boton "Ir a Repositorio" en una tarea sin evidencias.

#### Drag & drop directo en la tarjeta de la tarea

Ademas del gestor, cada tarjeta de tarea acepta **arrastrar y soltar archivos directamente** sobre su seccion "Evidencias Cargadas" (sin abrir el gestor), con la misma logica de validacion de carpetas:

- **La subcarpeta de la tarea ya existe**: los archivos se suben directo ahi.
- **No existe y la tarea no tiene evidencias**: la carpeta se crea automaticamente (loading) y los archivos se suben ahi.
- **No existe y la tarea tiene evidencias** (posiblemente en la raiz sin carpeta): pregunta que hacer con los archivos arrastrados — **"Crear carpeta y mover"** (crea la carpeta, mueve los legacy y sube ahi), **"Solo subir a la raiz"** (sube a la raiz del checklist) o **"Cancelar"**.
- **Carpetas completas arrastradas**: se muestra el aviso "Accion no soportada por aqui" con boton **"Ir al repositorio"**, que valida/crea la carpeta de la tarea (loading) y redirige a SharePoint.

El dropzone de la tarjeta solo esta activo para usuarios que pueden gestionar la tarea y cuando el checklist no esta finalizado.

#### Boton "Ir a Repositorio"

El boton **"Ir a Repositorio"** de cada tarea abre la carpeta de la tarea en SharePoint en una pestana nueva. Su comportamiento depende del estado de la tarea:

- **Con evidencias** (posiblemente en la raiz sin carpeta): pregunta si desea crear la carpeta y mover las evidencias legacy a la nueva subcarpeta (flujo de migracion).
- **Sin evidencias**: crea la carpeta automaticamente (con loading "Creando carpeta para esta tarea de incorporacion...") y redirige.

### Fotografias y PDFs

Las fotografias del equipo se comprimen y se guardan dentro de `Metadata` del checklist. Los PDFs finalizados se generan en el navegador y se suben a la carpeta raiz de su incorporacion, junto a los entregables de sus tareas:

`/sites/co-lmn-sgia/Documentos compartidos/Incorporación/Entregables/{tipo}/{nombre-del-checklist}/`

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

El usuario puede crear checklists, diligenciar tareas, adjuntar evidencias (via el Gestor de Entregables), registrar comentarios y alertas, aprobar/rechazar, finalizar, consultar dashboards, ver Gantt, filtrar por responsables/gerencias y descargar PDFs.

Las confirmaciones, toasts y progresos usan **SweetAlert2** (`sweetalert2`): eliminacion de evidencias con confirmacion + toast de exito, aprobacion/finalizacion con confirmacion, migracion de evidencias legacy con progreso en tiempo real, y avisos de acciones no soportadas (como arrastrar carpetas completas). No quedan `window.confirm` ni `alert()` nativos en la aplicacion.

La tabla de incorporaciones incluye filtros multi-seleccion por columna en `NOM. CHK.`, `PLAN (ESP.)`, `COMPL. (REAL)`, `GER.`, `SUPT.`, `TIPO INCORP.` y `CREAD. POR`. Cada filtro ofrece busqueda, checkboxes, `Todos`, `Ninguno`, `Limpiar` y `Aplicar`. Las selecciones se aplican al pulsar `Aplicar` o al hacer clic fuera del menu; `Limpiar` elimina la seleccion y cierra el menu. Los encabezados usan abreviaciones compactas para mantenerse en una sola fila.

El detalle de un checklist incluye filtros internos sobre sus tareas: buscador general (descripcion, responsable, tarea), responsable, estado (terminadas, faltantes, en rojo), rango de avance esperado, rango de avance real y la casilla `Solo en Alerta`. Estos filtros son independientes de los filtros de la tabla principal y no los afectan.

Los filtros internos del detalle usan el mismo componente `ColumnFilterTrigger`/`ColumnFilterPopover` que la tabla principal, por lo que ofrecen la misma experiencia multi-seleccion: busqueda, checkboxes, `Todos`, `Ninguno`, `Limpiar` y `Aplicar`. Las selecciones se aplican al pulsar `Aplicar` o al hacer clic fuera del menu. El filtro de responsable incluye la opcion `Mis tareas (responsable o corresponsable)`; el de estado ofrece `Terminadas (100% + evidencias)`, `Faltantes (por terminar)` y `En rojo`; los de avance esperado/real ofrecen los rangos `0%`, `1-25%`, `26-50%`, `51-75%`, `76-99%` y `100%`. Los valores internos se guardan como `Set` en el estado de React y se combinan con `OR` dentro de cada filtro (una tarea pasa si cumple cualquiera de los valores seleccionados).

Los filtros internos del detalle son **en cascada**: cada filtro solo ofrece las opciones que existen en las tareas que pasan los demas filtros. Por ejemplo, si se filtra por avance real `40%`, el filtro de responsable solo mostrara las personas que tienen tareas al 40%, y el de estado solo mostrara los estados presentes en esas tareas. Los valores ya seleccionados se conservan en las opciones para poder deseleccionarlos, aunque ya no existan en el conjunto filtrado.

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

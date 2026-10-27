# Tema SIGAV aplicado al dashboard clonado

Fecha: 27 de octubre de 2026.

Referencia visual: aplicación SIGAV en `App Asociación VTF Temuco/sigav/src/app/globals.css`.
Proyecto modificado: `Desktop/proyecto/dashboard/frontend`, React/Vite.
Vista local: http://localhost:5173.

## Paleta compartida

| Uso | Valor claro |
|---|---|
| Fondo cálido | #faf7f3 |
| Morado principal | #725682 |
| Texto ciruela | #352c3a |
| Texto secundario | #6d6471 |
| Palo rosa | #f1dce2 |
| Lila suave | #eee7f2 |
| Sidebar | #f0e7ec |
| Bordes | #e5dfe5 |
| Superficies | #ffffff |

Tipografía Arial/Helvetica; paneles de 16 px de radio, acceso de 24 px, botones de 10 px y campos de 9 px. Se eliminó la descarga de tipografías Google para utilizar la misma familia local de SIGAV. Los indicadores de éxito/advertencia/error conservan significado y contraste.

## Cambios

- Tokens CSS claros y variante oscura ciruela/malva, conservando el selector de tema y la preferencia manual guardada. El modo claro es el predeterminado para visitas nuevas.
- Sidebar, header, login, tarjetas, tablas, botones y formularios con paleta SIGAV. Se mantienen logo, módulos, controles y permisos del clon.
- Los tres KPI principales comparten fila en escritorio; los gráficos y etiquetas se adaptan al ancho móvil sin recortes. Tablas conservan desplazamiento horizontal propio.
- Colores azules literales de Tesorería se sustituyeron por tokens del tema; sin cambiar valores, cálculos, validaciones financieras o endpoints.
- Botón móvil de cierre de menú con etiqueta accesible.

Archivos frontend modificados: `src/styles/index.css`, `src/components/layout/Sidebar.jsx`, `src/components/layout/Navbar.jsx`, `src/pages/LoginPage.jsx`, `src/pages/DashboardPage.jsx`, `src/pages/TreasuryPage.jsx`, `src/context/ThemeContext.jsx`, `index.html`.

## Verificación

- Compilación Vite del frontend ejecutada.
- Navegador: dashboard, login y Tesorería; tema claro y oscuro.
- Valores computados verificados: fondo rgb(250,247,243), principal #725682, sidebar rgb(240,231,236), fuente Arial/Helvetica.
- Móvil: 390×844 para dashboard/menú/Tesorería; 320×740 para login, con columnas adaptadas y sin desbordamiento del documento. Verificado abrir menú, navegar y cerrar el panel.
- Se mantiene la sesión existente; no se realizaron pagos, exportaciones ni nuevas operaciones de negocio.

No se han ejecutado suites financieras por tratarse de cambios de presentación. No se publicaron cambios en GitHub ni se modificó el backend. SIGAV Next.js sigue siendo la referencia visual y no recibió cambios de código en esta tarea.

Copias originales antes del cambio en el espacio de trabajo de comparación: `App Asociación VTF Temuco/.work/github-theme/before/`. Scripts auxiliares y copia de este documento en `.work/github-theme/`; no son dependencias de ejecución del clon.

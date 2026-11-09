# Guía Oficial de Despliegue en Producción — cPanel / INA Networks
**Sistema Web de Gestión — Asociación Gremial de Jardines Infantiles VTF Temuco**

Esta guía detalla el procedimiento paso a paso para desplegar la plataforma completa (Frontend React SPA, Backend Node.js Express y Base de Datos MySQL) en un entorno de **Web Hosting SSD con cPanel** (como INA Networks u otros proveedores cPanel con soporte para Node.js y LiteSpeed/Apache).

---

## 1. Arquitectura de Despliegue en cPanel

Para garantizar máxima estabilidad, rendimiento y evitar colisiones entre el servidor web y la API, se utiliza la siguiente separación recomendada:

```
                          ┌──────────────────────────┐
                          │   Dominio de la App      │
                          └─────────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
     https://tu-dominio.cl                         https://api.tu-dominio.cl
    ┌─────────────────────────┐                   ┌─────────────────────────┐
    │     FRONTEND REACT      │                   │    BACKEND EXPRESS      │
    │  Carpeta: public_html/  │ ── Peticiones ──> │   cPanel Node.js App    │
    │  (Archivos estáticos    │     HTTPS         │   (Phusion Passenger)   │
    │   HTML/JS/CSS/.htaccess)│                   └────────────┬────────────┘
    └─────────────────────────┘                                │
                                                               ▼
                                                  ┌─────────────────────────┐
                                                  │       MYSQL XAMPP /     │
                                                  │      cPanel Database    │
                                                  │     (localhost:3306)    │
                                                  └─────────────────────────┘
```

---

## 2. Paso 1: Configurar la Base de Datos MySQL en cPanel

1. Inicia sesión en tu cuenta de **cPanel**.
> [!IMPORTANT]
> **cPanel antepone el nombre de la cuenta a la base de datos Y al usuario.** En la cuenta de `vtftemuco.cl` el prefijo es `vtftemuc_` (los primeros 8 caracteres del usuario de cPanel). Si escribes `jardines_vtf` y `vtf`, lo que realmente se crea es:
>
> | Lo que escribes | Lo que crea cPanel (y lo que va en las variables) |
> | :--- | :--- |
> | Base: `jardines_vtf` | `DB_NAME=vtftemuc_jardines_vtf` |
> | Usuario: `vtf` | `DB_USER=vtftemuc_vtf` |
>
> Copia los nombres **exactamente como aparecen en la lista "Bases de datos actuales" / "Usuarios actuales"** de cPanel; nunca los nombres de ejemplo de esta guía. Si no coinciden, la app no se conecta (antes de esta versión, además, entraba con datos de prueba en memoria y no guardaba nada; ahora responde un error claro).

2. Ve a la sección **Bases de datos** $\rightarrow$ **Bases de datos MySQL**:
   - **Crear una nueva base de datos:** escribe `jardines_vtf`. cPanel la crea como `PREFIJO_jardines_vtf` (ej.: `vtftemuc_jardines_vtf`). Anota el nombre completo.
   - **Crear nuevo usuario de MySQL:** escribe `vtf` y genera una contraseña segura. cPanel lo crea como `PREFIJO_vtf` (ej.: `vtftemuc_vtf`). **Guarda la contraseña y el nombre completo.**
   - **Añadir usuario a la base de datos:** selecciona ese usuario y esa base, haz clic en *Añadir*, marca **TODOS LOS PRIVILEGIOS** y confirma.
3. Abre la herramienta **phpMyAdmin** desde la pantalla principal de cPanel:
   - En la columna izquierda, haz clic sobre la base de datos creada (`vtftemuc_jardines_vtf`).
   - Ve a la pestaña **Importar** e importa, **en este orden**:
     1. **`database/database.sql`** (tablas)
     2. **`database/data.sql`** (convenios, padrón de 277 socias, movimientos de apertura y noticias)
     3. **`database/admin.sql`** (6 cuentas de directiva con clave inicial `Admin123!` y cambio obligatorio al primer ingreso)
   - **Base ya instalada antes del 09-11-2026:** no reimportes; ejecuta en la pestaña *SQL* el archivo `database/migraciones/2026-11-09_directiva_y_primer_ingreso.sql`.

---

## 3. Paso 2: Crear el Subdominio para la API

1. En cPanel, dirígete a la sección **Dominios** $\rightarrow$ **Dominios** (o *Subdominios* según la versión de cPanel).
2. Haz clic en **Create A New Domain**:
   - Nombre de dominio: `api.tu-dominio.cl` *(reemplaza con tu dominio real)*.
   - **Importante:** Desmarca la casilla *"Share document root (/home/usuario/public_html) with another domain"*.
   - Define un directorio independiente (ejemplo: `api_subdomain` o `subdominios/api`).
3. Guarda los cambios.

---

## 4. Paso 3: Desplegar el Backend Node.js en cPanel

### A. Subir el código del Backend
1. Abre el **Administrador de Archivos** de cPanel.
2. En la raíz de tu cuenta de alojamiento (`/home/usuario/`), crea una carpeta llamada **`backend`** (o súbela comprimida en ZIP y extráela allí).
3. Sube únicamente los archivos de la carpeta `backend` del repositorio:
   - Carpeta `src/` (con todos sus controladores, rutas, servicios y middlewares).
   - Archivo `package.json` y `package-lock.json`.
4. **No subas:** la carpeta `node_modules` local (se instalarán limpios en Linux) ni archivos `.git`.
5. Asegúrate de que exista la carpeta vacía `uploads` dentro de `backend/` (o créala: `/home/usuario/backend/uploads`) con permisos `755` para almacenar comprobantes de tesorería y archivos del buzón de socias.

### B. Configurar la aplicación en cPanel Node.js
1. En cPanel, busca y abre la herramienta **Setup Node.js App** (o *Configurar aplicación Node.js*).
2. Haz clic en el botón **Create Application**:
   - **Node.js version:** Selecciona la versión LTS más reciente disponible (recomendado: `Node.js 20.x` o `18.x`).
   - **Application mode:** `Production`.
   - **Application root:** `backend` (o la ruta donde subiste la carpeta).
   - **Application URL:** Selecciona del desplegable tu subdominio `api.tu-dominio.cl`.
   - **Application startup file:** `src/server.js`.
3. En la sección **Environment variables** (Variables de entorno), haz clic en **Add Variable** y añade cada una de las siguientes claves:

| Variable | Valor de Producción | Descripción |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo optimizado de ejecución |
| `DB_HOST` | `localhost` | Host local de MySQL en cPanel |
| `DB_PORT` | `3306` | Puerto por defecto de MySQL |
| `DB_NAME` | `vtftemuc_jardines_vtf` | Nombre **con prefijo**, tal como lo muestra cPanel |
| `DB_USER` | `vtftemuc_vtf` | Usuario **con prefijo**, tal como lo muestra cPanel |
| `DB_PASSWORD` | `TuContraseñaSegura!` | Contraseña asignada al usuario MySQL |
| `JWT_SECRET` | *(cadena aleatoria de 64 chars)* | Clave criptográfica para firmas JWT |
| `JWT_EXPIRES_IN` | `8h` | Duración de sesión activa |
| `CORS_ORIGIN` | `https://tu-dominio.cl` | Dominio frontend autorizado |

4. Haz clic en el botón superior **Create**.
5. Tras crearse la aplicación, pulsa el botón **Run NPM Install** que aparecerá en la parte superior. Esto descargará automáticamente los paquetes necesarios en el servidor (`express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer`, etc.).
6. Haz clic en **Restart Application**.

### C. Verificar que la API responda
Abre una pestaña en tu navegador e ingresa a:
```
https://api.tu-dominio.cl/api/health
```
Debe responder con un JSON similar a:
```json
{
  "status": "ok",
  "system": "Sistema Web de Gestión — Asociación de Jardines VTF",
  "database": { "conectada": true, "error": null },
  "timestamp": "2026-11-03T21:00:00.000Z"
}
```

**Revisa `database.conectada`.** Si es `false`, el campo `error` dice por qué:

| `error` | Significado | Qué corregir |
| :--- | :--- | :--- |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña incorrectos | `DB_USER` con prefijo y `DB_PASSWORD` |
| `ER_DBACCESS_DENIED_ERROR` | El usuario no tiene permisos sobre esa base | Paso 1: "Añadir usuario a la base de datos" |
| `ER_BAD_DB_ERROR` | La base no existe con ese nombre | `DB_NAME` con prefijo |
| `ECONNREFUSED` / `ETIMEDOUT` | MySQL no responde | `DB_HOST=localhost`, `DB_PORT=3306` |

Mientras no haya conexión, la app responde **503 "El sistema no tiene conexión con la base de datos"** y no deja entrar. Reintenta sola cada 15 segundos, pero tras cambiar variables hay que pulsar **Restart**.

> **Despliegue en una sola app (recomendado, el que usa vtftemuco.cl):** si la carpeta `backend/public/` contiene el frontend compilado (`npm run build` en `frontend/` y copiar `dist/` como `public/`), la misma app Node sirve la página y la API en el mismo dominio. En ese caso el *Application startup file* es **`app.cjs`**, no hace falta subdominio `api.` ni `CORS_ORIGIN`, y el frontend se compila con `VITE_API_URL=/api`.

---

## 5. Paso 4: Compilar y Desplegar el Frontend React SPA

El Frontend es una Single Page Application (SPA) construida con Vite y React Router. Para desplegarla, se compila en un bundle estático ultra rápido.

### A. Compilar en tu máquina local
1. Abre tu terminal en la raíz del proyecto.
2. Crea el archivo `frontend/.env.production` indicando la URL pública de la API que configuraste en el Paso 3:
   ```env
   VITE_API_URL=https://api.tu-dominio.cl/api
   ```
3. Ejecuta la compilación de producción:
   ```bash
   npm --prefix frontend run build
   ```
4. Se generará la carpeta optimizada **`frontend/dist/`**. Dentro de ella ya se encuentra automáticamente incluido el archivo **`.htaccess`**, el cual le indica a LiteSpeed/Apache que redirija todas las peticiones internas (`/login`, `/socias`, `/socia/portal`, etc.) hacia `index.html` para que React Router funcione al recargar la página sin dar error 404.

### B. Subir los archivos estáticos a cPanel
1. Entra al **Administrador de Archivos** de cPanel.
2. Ingresa a la carpeta pública principal: **`public_html/`**.
   *(Si hay archivos por defecto de cPanel como `default.html`, elimínalos o muévelos)*.
3. Sube y descomprime el contenido interior de `frontend/dist/`.
4. Confirma que en `public_html/` queden directamente:
   - `index.html`
   - `.htaccess`
   - `logo-vtf.png`
   - Carpeta `assets/` (con los archivos CSS y JS compilados).

---

## 6. Paso 5: Certificados SSL HTTPS Gratuitos

1. En cPanel, busca la herramienta **Estado de SSL/TLS** (*SSL/TLS Status*).
2. Selecciona las casillas correspondientes a:
   - `tu-dominio.cl` y `www.tu-dominio.cl`
   - `api.tu-dominio.cl`
3. Haz clic en el botón azul **Run AutoSSL**.
4. En 1 o 2 minutos, cPanel (vía Sectigo o Let's Encrypt) instalará automáticamente los certificados SSL gratuitos con renovación automática.

---

## 7. Solución de Problemas Comunes (Troubleshooting)

### Error 503 "Service Unavailable" al llamar a la API
- **Causa:** Phusion Passenger no pudo arrancar Node.js o falló la conexión con la base de datos.
- **Solución:**
  1. En cPanel ve a *Setup Node.js App* y haz clic en *Restart*.
  2. Revisa el archivo de log de errores ubicado en `/home/usuario/backend/stderr.log`.
  3. Verifica que las credenciales de `DB_NAME`, `DB_USER` y `DB_PASSWORD` en las variables de entorno coincidan con las creadas en cPanel MySQL.

### Error 404 al recargar páginas internas como `/socias` o `/socia/portal`
- **Causa:** Falta el archivo `.htaccess` en `public_html/` o el Administrador de Archivos tiene oculta la visualización de archivos con punto.
- **Solución:**
  - En el Administrador de Archivos de cPanel, haz clic en *Configuración* (arriba a la derecha) y marca *"Mostrar archivos ocultos (dotfiles)"*.
  - Comprueba que el archivo `.htaccess` esté presente en `public_html/` con la siguiente regla de reescritura:
    ```apache
    <IfModule mod_rewrite.c>
      RewriteEngine On
      RewriteBase /
      RewriteRule ^index\.html$ - [L]
      RewriteCond %{REQUEST_FILENAME} !-f
      RewriteCond %{REQUEST_FILENAME} !-d
      RewriteCond %{REQUEST_FILENAME} !-l
      RewriteRule . /index.html [L]
    </IfModule>
    ```

### Error de CORS en el navegador (`Cross-Origin Request Blocked`)
- **Causa:** El backend no tiene configurado el dominio exacto del frontend en su variable `CORS_ORIGIN`.
- **Solución:**
  - En *Setup Node.js App*, edita la variable `CORS_ORIGIN` y asegúrate de que sea exactamente `https://tu-dominio.cl` (con `https://` y sin barra diagonal al final).
  - Haz clic en *Save* y luego en *Restart*.

### Error al subir comprobantes o adjuntos en el buzón
- **Causa:** La carpeta de subida de archivos no existe o no tiene permisos de escritura.
- **Solución:**
  - Crea la carpeta `/home/usuario/backend/uploads`.
  - Asegúrate de que sus permisos de Linux sean `755` o `775`.

---

## 8. Checklist de Seguridad Final

Antes de entregar los accesos definitivos a las socias y directiva:
- [ ] `https://DOMINIO/api/health` responde `"database": { "conectada": true }`.
- [ ] Cada integrante de la directiva entra con su correo `@vtftemuco.cl` (o RUT) y la clave inicial `Admin123!`, y el sistema la obliga a crear su contraseña personal antes de mostrar cualquier sección.
- [ ] Desactivar (`activo = 0`) o reemplazar la cuenta de delegada de demostración (`17.890.123-1`) cuando estén las delegadas reales.
- [ ] Asegurarse de que `JWT_SECRET` sea una clave privada única y no el valor por defecto de desarrollo.
- [ ] Verificar que el candado HTTPS esté activo en ambos dominios (`https://tu-dominio.cl` y `https://api.tu-dominio.cl`).
- [ ] Realizar una prueba de ingreso como socia (`/socia/login`) con cambio de clave obligatorio.
- [ ] Realizar una prueba de registro de egreso en Tesorería adjuntando un comprobante PDF.


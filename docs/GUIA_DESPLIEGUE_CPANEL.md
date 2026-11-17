# Guía de despliegue desde cero — cPanel (INA Networks)
**SIGAV — Asociación Gremial de Jardines Infantiles VTF Temuco**

Esta guía instala la plataforma completa en un hosting cPanel **desde cero**, con una base de datos vacía y sin restos de instalaciones anteriores. Corresponde a la rama `develop` con la V3 del padrón (socias 100 % en MySQL).

Se instala como **una sola aplicación Node.js**: la misma app sirve la página web y la API en el mismo dominio (`https://vtftemuco.cl` y `https://vtftemuco.cl/api`). No hace falta un subdominio `api.` ni configurar CORS.

```
Navegador ──HTTPS──> vtftemuco.cl ──> App Node.js "sigav-app" (Passenger, app.cjs)
                                        ├── /            página web (carpeta public/)
                                        ├── /api/...     API Express
                                        └── uploads/     comprobantes y planillas (privado)
                                               │
                                               ▼
                                      MySQL de cPanel (localhost:3306)
```

Tiempo estimado: 45 a 60 minutos.

---

## 0. Antes del martes

- [ ] **Acceso a cPanel** de vtftemuco.cl, con permiso para *Bases de datos MySQL*, *phpMyAdmin*, *Administrador de archivos* y *Setup Node.js App*.
- [ ] **Node.js 18 o superior** disponible en *Setup Node.js App* (recomendado: 20).
- [ ] **Tesorería parte solo con los saldos de apertura 2026** ($5.103.000 Asociación y $8.856.000 Cena Anual). `data.sql` ya no trae movimientos ni noticias de demostración: la Tesorera debe registrar en el sistema, con su comprobante, los movimientos reales de 2026 (pagos a Federación, recaudaciones, S.O.S, etc.) para que los saldos queden al día. Confirmar con ella que los saldos de apertura son correctos.
- [ ] **La directiva disponible el mismo día.** Las 5 cuentas de directiva parten con la clave inicial `Admin123!`, y la primera persona que entre con ella elige la clave definitiva. Cada integrante debe entrar y cambiarla **el mismo día del despliegue** (paso 8).
- [ ] En el PC: Git, Node.js 18 o superior, y el repositorio actualizado.

---

## 1. Preparar el paquete en el PC

Abrir **PowerShell** y ejecutar, en este orden:

```powershell
cd C:\Users\sebas\Documents\GitHub\dashboard
git checkout develop
git pull
```

```powershell
npm --prefix backend test
```

Las 7 suites deben terminar con `✓ 7 suites aprobadas.` (requiere el MySQL de XAMPP encendido). Si alguna falla, no se despliega.

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
```

Arma la carpeta `despliegue\` con la app y los 3 archivos SQL. El ZIP se crea con `tar`, porque el `Compress-Archive` de Windows guarda las rutas con `\` y cPanel no lo extrae bien.

```powershell
$repo = "C:\Users\sebas\Documents\GitHub\dashboard"
$salida = "$env:USERPROFILE\Desktop\despliegue"
Remove-Item -Recurse -Force $salida -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$salida\sigav-app" | Out-Null
Copy-Item "$repo\backend\app.cjs", "$repo\backend\package.json", "$repo\backend\package-lock.json" "$salida\sigav-app\"
Copy-Item -Recurse "$repo\backend\src" "$salida\sigav-app\src"
Copy-Item -Recurse "$repo\frontend\dist" "$salida\sigav-app\public"
Copy-Item "$repo\database\database.sql", "$repo\database\data.sql", "$repo\database\admin.sql" "$salida\"
cd $salida
tar -a -c -f sigav-app.zip sigav-app
```

En el escritorio queda la carpeta `despliegue` con:

| Archivo | Para qué |
| :--- | :--- |
| `sigav-app.zip` | La aplicación: `app.cjs`, `package.json`, `package-lock.json`, `src/` y `public/` (la página ya compilada) |
| `database.sql` | 1.º: crea las tablas |
| `data.sql` | 2.º: jardines, padrón, convenios, créditos y tesorería |
| `admin.sql` | 3.º: cuentas de la directiva |

> **No van en el paquete:** `node_modules` (se instala en el servidor), `.env` (las variables se configuran en cPanel) ni el contenido de `uploads/`.

---

## 2. Dejar el hosting limpio

Como la instalación es desde cero, primero hay que quitar lo anterior. **Antes de borrar, respaldar.**

1. **Respaldar la base anterior** (si existe): phpMyAdmin → clic en la base → pestaña **Exportar** → *Rápido* → **Exportar**. Guardar el `.sql`.
2. **Respaldar los comprobantes** (si existen): en el Administrador de archivos, comprimir y descargar la carpeta `uploads` de la app anterior.
3. **Detener y eliminar la app Node anterior:** *Setup Node.js App* → en la app existente, **Stop App** y luego el ícono de papelera (**Destroy**). Esto no borra los archivos.
4. **Borrar la carpeta de la app anterior** en el Administrador de archivos (por ejemplo `/home/USUARIO/sigav-app`).
5. **Borrar la base anterior:** *Bases de datos MySQL* → *Bases de datos actuales* → **Eliminar**. El usuario MySQL se puede conservar; si se conserva, anotar su contraseña.
6. **Revisar `public_html/`:** si quedaron `index.html`, `assets/` o un `.htaccess` de un despliegue anterior del frontend, moverlos a una carpeta `public_html/_respaldo/`. La app Node tiene prioridad, pero esos archivos confunden si algo falla.

---

## 3. Base de datos

### A. Crear la base y el usuario
*cPanel → Bases de datos → Bases de datos MySQL*

> [!IMPORTANT]
> **cPanel antepone el prefijo de la cuenta a la base Y al usuario.** En vtftemuco.cl el prefijo es `vtftemuc_`:
>
> | Lo que escribes | Lo que crea cPanel (y lo que va en las variables) |
> | :--- | :--- |
> | Base: `jardines_vtf` | `DB_NAME=vtftemuc_jardines_vtf` |
> | Usuario: `vtf` | `DB_USER=vtftemuc_vtf` |
>
> Copiar los nombres **exactamente como aparecen** en "Bases de datos actuales" y "Usuarios actuales". Si no coinciden, la app no se conecta.

1. **Crear nueva base de datos:** `jardines_vtf`. Anotar el nombre completo (`vtftemuc_jardines_vtf`).
2. **Crear usuario:** `vtf`, con el **Generador de contraseñas** de cPanel. Guardar la contraseña en un lugar seguro.
3. **Añadir usuario a la base de datos:** elegir ese usuario y esa base → **Añadir** → marcar **TODOS LOS PRIVILEGIOS** → **Hacer cambios**.

### B. Importar los 3 scripts
*cPanel → phpMyAdmin → clic en `vtftemuc_jardines_vtf` (columna izquierda) → pestaña **Importar***

Importar **uno por uno y en este orden**, esperando el mensaje verde "La importación se ejecutó exitosamente":

1. `database.sql`
2. `data.sql`
3. `admin.sql`

> En una base nueva **no** se ejecutan las migraciones de `database/migraciones/`: esos cambios ya vienen incluidos en `database.sql`. Las migraciones son solo para actualizar una base que ya estaba instalada.

### C. Comprobar
Pestaña **SQL**, pegar y **Continuar**:

```sql
SELECT
  (SELECT COUNT(*) FROM jardines)                          AS jardines,
  (SELECT COUNT(*) FROM socias)                            AS socias,
  (SELECT COUNT(*) FROM creditos WHERE estado = 'vigente') AS creditos_vigentes,
  (SELECT COUNT(*) FROM administradores WHERE activo = 1)  AS directiva_activa,
  (SELECT COUNT(*) FROM movimientos_tesoreria WHERE tipo = 'SALDO_APERTURA') AS aperturas;
```

Con el `data.sql` actual debe dar **23 jardines, 277 socias, 5 cuentas de directiva activas y 2 aperturas**. La cuenta de delegada de demostración (`delegada@vtftemuco.cl`) queda creada pero **desactivada**.

---

## 4. Subir la aplicación

*cPanel → Administrador de archivos*

1. Entrar a la carpeta de la cuenta, `/home/USUARIO/`, **fuera de `public_html`**: así los comprobantes y planillas no quedan expuestos en la web.
2. **Cargar** `sigav-app.zip`, seleccionarlo y pulsar **Extraer**.
3. Comprobar que exista `/home/USUARIO/sigav-app/app.cjs` y, junto a él, las carpetas `src/` y `public/`. Si se extrajo como `sigav-app/sigav-app/`, mover el contenido un nivel arriba.
4. Crear la carpeta `/home/USUARIO/sigav-app/uploads` (botón **+ Carpeta**) con permisos `755`. Ahí se guardan los comprobantes de Tesorería, los adjuntos del buzón y, en `uploads/padron/AAAA/MM/`, cada planilla Maestra Socias cargada. La app la crea sola si no existe, pero conviene dejarla lista.

---

## 5. Crear la app Node.js

*cPanel → Software → **Setup Node.js App** → **Create Application***

| Campo | Valor |
| :--- | :--- |
| Node.js version | **20** (o la más nueva disponible; mínimo 18) |
| Application mode | **Production** |
| Application root | `sigav-app` |
| Application URL | `vtftemuco.cl` (dejar vacía la ruta a la derecha) |
| Application startup file | **`app.cjs`** |

**Variables de entorno** (botón **Add Variable**, una por una):

| Variable | Valor | Nota |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `vtftemuc_jardines_vtf` | **con prefijo**, tal como aparece en cPanel |
| `DB_USER` | `vtftemuc_vtf` | **con prefijo** |
| `DB_PASSWORD` | *(la contraseña del paso 3)* | |
| `JWT_SECRET` | *(cadena aleatoria, ver abajo)* | **obligatoria**: sin ella la app no arranca |
| `JWT_EXPIRES_IN` | `8h` | duración de la sesión |

**Generar `JWT_SECRET`** en el PC (PowerShell) y pegar el resultado:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> [!IMPORTANT]
> `JWT_SECRET` es la llave que firma las sesiones. En producción la app **se niega a arrancar** si falta, si tiene menos de 32 caracteres o si es la clave de ejemplo del repositorio, porque con esa clave pública cualquiera podría fabricarse una sesión de Tesorera. No compartirla ni guardarla en el repositorio.

Luego:

1. **Create**.
2. **Run NPM Install** (botón que aparece arriba, junto a `package.json`). Espere a que termine; puede tardar 1 o 2 minutos.
3. **Restart**.

---

## 6. Certificado SSL

*cPanel → Seguridad → **SSL/TLS Status*** → marcar `vtftemuco.cl` y `www.vtftemuco.cl` → **Run AutoSSL**. En 1 o 2 minutos el candado debe aparecer en el navegador.

---

## 7. Verificar

1. **Salud de la API:** abrir `https://vtftemuco.cl/api/health`. Debe responder:
   ```json
   { "status": "ok", "database": { "conectada": true, "error": null }, ... }
   ```
   Si `conectada` es `false`, ver la tabla del paso 9.
2. **Página:** `https://vtftemuco.cl/login` muestra el ingreso de la directiva. Recargar con **F5** en `https://vtftemuco.cl/socias` no debe dar error 404.
3. **Socias:** al entrar como Tesorera, el Inicio y *Socias y Créditos* deben mostrar **277 socias** y los jardines reales (nunca "Jardín Rayito de Sol": ese nombre solo existe en los datos de prueba del código).
4. **Comprobante:** en *Tesorería → Agregar Movimiento*, registrar un egreso de prueba con un PDF adjunto y abrirlo con **Ver**. Si se usa un movimiento de prueba, anotarlo para que la Tesorera lo compense o se elimine desde phpMyAdmin.
5. **Portal de socias:** en `https://vtftemuco.cl/socia/login`, entrar con el RUT de una socia y los 6 primeros dígitos de su RUT. Debe pedir crear una contraseña propia. Una clave equivocada debe mostrar el error **en la misma pantalla**.
6. **Persistencia:** en *Setup Node.js App* pulsar **Restart** y comprobar que el movimiento y la clave de la socia siguen ahí.

---

## 8. Primer ingreso de la directiva (mismo día)

Cada integrante entra en `https://vtftemuco.cl/login` con su correo (o RUT) y la clave inicial `Admin123!`. El sistema la obliga a crear su contraseña personal antes de mostrar cualquier sección.

| Cargo | Correo | RUT |
| :--- | :--- | :--- |
| Administración | `admin@vtftemuco.cl` | 17.260.651-2 |
| Tesorera | `tesorera@vtftemuco.cl` | 16.947.343-9 |
| Presidenta | `presidenta@vtftemuco.cl` | 13.963.291-5 |
| Secretaria | `secretaria@vtftemuco.cl` | 11.354.669-7 |
| Directora | `directora@vtftemuco.cl` | 20.081.109-7 |

> [!WARNING]
> Mientras una cuenta conserve `Admin123!`, cualquiera que conozca el correo puede tomarla. Si alguien no puede entrar ese día, desactivar su cuenta en phpMyAdmin hasta que pueda:
> `UPDATE administradores SET activo = 0 WHERE correo = 'directora@vtftemuco.cl';`
> y reactivarla (`activo = 1`) cuando vaya a hacer su primer ingreso.

**Restablecer la clave de alguien de la directiva** (olvido): en phpMyAdmin, pestaña SQL:

```sql
UPDATE administradores
SET contrasena = '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6', primer_ingreso = 1
WHERE correo = 'tesorera@vtftemuco.cl';
```

Vuelve a `Admin123!` con cambio obligatorio al entrar.

**Restablecer la clave de una socia:** desde el sistema, en Socias → Ficha socia → "Restablecer clave" (Admin, Presidenta, Tesorera, Secretaria y Directora; queda en la auditoría y cierra sus sesiones). Alternativa por SQL: `UPDATE socias SET password = NULL, primer_ingreso = 1 WHERE rut = '12.345.678-5';` Vuelve a los 6 primeros dígitos de su RUT.

---

## 9. Problemas frecuentes

### `/api/health` responde `"conectada": false`

| `error` | Significa | Qué corregir |
| :--- | :--- | :--- |
| `ER_ACCESS_DENIED_ERROR` | Usuario o contraseña incorrectos | `DB_USER` con prefijo y `DB_PASSWORD` |
| `ER_DBACCESS_DENIED_ERROR` | El usuario no tiene permisos sobre esa base | Paso 3A, "Añadir usuario a la base de datos" |
| `ER_BAD_DB_ERROR` | No existe una base con ese nombre | `DB_NAME` con prefijo |
| `ECONNREFUSED` / `ETIMEDOUT` | MySQL no responde | `DB_HOST=localhost`, `DB_PORT=3306` |

Mientras no haya conexión, la app responde **503 "El sistema no tiene conexión con la base de datos"** y no deja entrar (nunca muestra datos de prueba en producción). Reintenta sola cada 15 segundos, pero **después de cambiar variables hay que pulsar Restart**.

### "We're sorry, but something went wrong" / la app no arranca
Abrir `/home/USUARIO/sigav-app/stderr.log` en el Administrador de archivos:

- `JWT_SECRET no configurado o inseguro` → paso 5: agregar `JWT_SECRET` (mínimo 32 caracteres) y **Restart**.
- `Cannot find module 'express'` (u otro paquete) → faltó **Run NPM Install**; ejecutarlo y **Restart**.
- `Cannot find module .../app.cjs` → el *Application root* o el *startup file* no coinciden con la carpeta extraída (paso 4).

### Error 404 al recargar `/socias` o `/socia/portal`
Falta la carpeta `public/` dentro de `sigav-app` (debe contener `index.html` y `assets/`). Volver a armar el paquete (paso 1) y subirlo.

### La página carga pero el ingreso dice "Network Error"
El navegador no llega a la API. Si `/api/health` sí responde, el frontend se compiló con una `VITE_API_URL` antigua (por ejemplo, apuntando a `localhost` o a un subdominio `api.`). No crear `frontend/.env.production`: sin esa variable, el build usa `/api` del mismo dominio. Recompilar (paso 1) y volver a subir `public/`.

### No se pueden subir comprobantes o planillas
La carpeta `/home/USUARIO/sigav-app/uploads` no existe o no tiene permisos de escritura: crearla con `755` (si no basta, `775`).

---

## 10. Después del despliegue

- [ ] `https://vtftemuco.cl/api/health` → `"conectada": true`.
- [ ] Las 5 cuentas de la directiva cambiaron `Admin123!` (o están desactivadas).
- [ ] La cuenta de delegada de demostración sigue desactivada; crear las delegadas reales cuando estén confirmadas.
- [ ] Candado HTTPS activo en `vtftemuco.cl` y `www.vtftemuco.cl`.
- [ ] Prueba de egreso con PDF y de ingreso de una socia hechas y anotadas.
- [ ] **Respaldo semanal:** phpMyAdmin → Exportar, y descargar la carpeta `uploads/`. (Si el plan de INA Networks incluye *JetBackup*, confirmar que respalda base y archivos).

---

## Anexo A. Actualizar una instalación existente (versiones futuras)

Para subir una versión nueva **sin perder datos**:

1. Respaldar la base (phpMyAdmin → Exportar) y la carpeta `uploads/`.
2. Ejecutar en la pestaña SQL, una sola vez y en orden de fecha, solo las migraciones nuevas de `database/migraciones/` que aún no se hayan aplicado. Para V4 es `2026-11-18_v4_creditos.sql`, que agrega las tablas de cargas y pagos de créditos sin tocar los créditos existentes; al final debe mostrar las 5 empresas con su código.
3. Armar el paquete (paso 1) y reemplazar en el servidor **solo** `src/`, `public/`, `app.cjs`, `package.json` y `package-lock.json`. **No tocar `uploads/`.**
4. **Run NPM Install** (si cambió `package.json`) y **Restart**.
5. Verificar con el paso 7.

## Anexo B. Variante con subdominio `api.`

No se usa en vtftemuco.cl. Si algún día se separa la página (en `public_html/`) de la API (en `api.vtftemuco.cl`):
- Startup file `src/server.js`, Application URL `api.vtftemuco.cl` y variable `CORS_ORIGIN=https://vtftemuco.cl` (sin barra final).
- Compilar el frontend con `frontend/.env.production` que contenga `VITE_API_URL=https://api.vtftemuco.cl/api` y subir el contenido de `frontend/dist/` (incluido `.htaccess`) a `public_html/`.
- Activar AutoSSL también para `api.vtftemuco.cl`.

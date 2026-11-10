# SIGAV — Sistema Integrado de Gestión Administrativa y Financiera

### Asociación Gremial de Trabajadores de Jardines Infantiles VTF — Temuco

[![Entorno de Ejecución](https://img.shields.io/badge/Entorno-Node.js%2020%2B-339933?style=flat-square&logo=node.js&logoColor=white)](#5-guía-de-puesta-en-marcha-entorno-local)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](#4-arquitectura-del-sistema)
[![Backend](https://img.shields.io/badge/Backend-Express%20%7C%20REST%20API-000000?style=flat-square&logo=express&logoColor=white)](#4-arquitectura-del-sistema)
[![Base de Datos](https://img.shields.io/badge/Persistencia-MySQL%20%2F%20MariaDB-4479A1?style=flat-square&logo=mysql&logoColor=white)](#53-persistencia-de-datos)
[![Versión](https://img.shields.io/badge/Versión-V3%20Padrón%20MySQL-725682?style=flat-square)](#3-estado-del-proyecto-versiones-y-hoja-de-ruta)
[![Estado de Pruebas](https://img.shields.io/badge/Validación-83%20Tests%20Pasados-success?style=flat-square)](#54-verificación-automatizada-del-sistema)

Plataforma web institucional concebida para la gobernanza corporativa, fiscalización contable, administración del padrón gremial, custodia documental y rendición periódica de cuentas de los establecimientos de Educación Parvularia Vía Transferencia de Fondos (VTF) de la comuna de Temuco.

**Producción:** [vtftemuco.cl](https://vtftemuco.cl) (cPanel, una sola aplicación Node que sirve la interfaz y la API).

---

## 1. Resumen Ejecutivo

El **Sistema Integrado de Gestión Administrativa y Financiera (SIGAV)** unifica los procesos operativos, estatutarios y de bienestar de la organización gremial, asegurando un registro fidedigno, trazable e inmutable de los recursos sociales:

* **Alcance Gremial:** Cobertura de 23 establecimientos educativos distribuidos en Temuco y Labranza.
* **Padrón Representado:** 277 trabajadoras afiliadas reales (Directoras, Educadoras de Párvulos, Técnicos, Asistentes y Auxiliares), administradas 100% en MySQL.
* **Régimen Estatutario de Cuota Social:** Valor unificado de $4.000 CLP mensuales por afiliada activa, distribuido normativamente en tres fondos autónomos:
  * **$1.000 CLP:** Aporte gremial a la Federación Nacional.
  * **$1.000 CLP:** Fondo operacional y corriente de la Asociación Local.
  * **$2.000 CLP:** Fondo de Bienestar y Evento Anual de Socias.

---

## 2. Marco de Gobernanza, Roles y Privacidad

El sistema opera bajo el principio de **mínimo privilegio (PoLP)** y estricta **segregación de funciones**, garantizando la confidencialidad de la información financiera y de convenios conforme a las normativas vigentes de protección de datos personales:

| Nivel de Acceso | Cargo / Unidad Funcional | Alcance Operativo | Perfil Financiero | Canal Institucional |
| :--- | :--- | :--- | :--- | :--- |
| **Administración Técnica** | Administrador de Plataforma | Mantenimiento de infraestructura, seguridad, bitácora y base de datos | Auditoría global y supervisión técnica | `admin@vtftemuco.cl` |
| **Tesorería General** | Tesorera Titular | Registro de ingresos, emisión de egresos, conciliación y comprobantes | Ejecución y control contable total | `tesorera@vtftemuco.cl` |
| **Presidencia Gremial** | Presidenta de la Asociación | Supervisión ejecutiva y representación institucional | **Supervisión (Solo Lectura)**; sin edición de egresos | `presidenta@vtftemuco.cl` |
| **Secretaría General** | Secretaria de la Directiva | Administración del Padrón (incorporaciones, retiros, traslados y carga de planilla) | Sin acceso a finanzas operativas | `secretaria@vtftemuco.cl` |
| **Dirección de Bienestar** | Directora de Convenios | Fiscalización y enlace con entidades de crédito social | Consolidado general de convenios | `directora@vtftemuco.cl` |
| **Delegadas de Base** | Representantes de Jardín (23) | Fiscalización de su establecimiento ante la asamblea | **Transparencia Institucional** (sin acceso a deudas individuales) | `delegada@vtftemuco.cl` |
| **Portal de Afiliadas** | Funcionarias Sindicalizadas | Buzón de consultas/denuncias, solicitudes S.O.S y noticias | Ficha personal e historial individual | *Acceso individual por RUT* |

> **Acceso y seguridad:**
> La directiva ingresa **solo** con su correo exacto `@vtftemuco.cl` o con su RUT, y debe cambiar la clave en el primer ingreso. Las sesiones usan tokens JWT y las claves se guardan con bcrypt. En producción la aplicación no arranca sin un `JWT_SECRET` propio de 32 caracteres o más. Los datos sensibles se configuran en variables de entorno (`.env`), nunca en el código fuente.

---

## 3. Estado del Proyecto: Versiones y Hoja de Ruta

El proyecto avanza por versiones según [`docs/PLAN_IMPLEMENTACION.md`](docs/PLAN_IMPLEMENTACION.md). Cada versión tiene un **prototipo** y una **remediación** (versión definitiva, persistente en MySQL y con pruebas automatizadas).

```mermaid
graph TD
    V1["V1: Consola Ejecutiva y Seguridad Base ✓"] --> V2["V2: Tesorería con Respaldo Digital ✓"]
    V2 --> V3["V3: Padrón Centralizado 100% MySQL ✓"]
    V3 --> V4["V4: Créditos y Convenios"]
    V4 --> V5["V5: Portal de Afiliadas y Buzón (prototipo)"]
    V5 --> V6["V6: Custodia Documental"]
    V6 --> V7["V7: Rendición Formal PDF y Portal Delegadas"]
    V7 --> V8["V8: Validación E2E y Despliegue Oficial"]
```

| Versión | Módulo | Estado |
| :---: | :--- | :--- |
| **V1** | Consola Ejecutiva, Directiva y Seguridad Base (PoLP) | Terminado ✓ |
| **V2** | Tesorería Robusta y Respaldo Digital Obligatorio | Terminado ✓ |
| **V3** | Padrón Centralizado 100% Persistente en MySQL | Terminado ✓ — despliegue desde cero el 10/11/2026 |
| **V4** | Módulo Independiente de Créditos y Convenios | **Siguiente** |
| **V5** | Portal de Afiliadas, Primer Ingreso y Buzón Gremial | Prototipo adelantado (falta remediación) |
| **V6** | Custodia Documental y Carpeta por Proveedor | Pendiente |
| **V7** | Rendición Formal de Cuentas (PDF) y Portal Delegadas | Pendiente |
| **V8** | Validación Integral E2E y Despliegue Oficial en cPanel | Pendiente |

### 3.1. Módulos Operativos (Entregados y Verificados)

* **Dirección de Arte Corporativa SIGAV:**
  * Sistema visual unificado: morado heráldico (`#725682`), rosa corporativo, fondos beige cálidos y superficies neutras.
  * Modo nocturno/diurno calibrado con tokens HSL y persistencia en cliente.
  * Menú de navegación lateral institucional, 100% responsivo.
* **V1 — Consola Ejecutiva y Autenticación:**
  * Ingreso con correo exacto `@vtftemuco.cl` o RUT, y cambio de clave obligatorio en el primer ingreso.
  * Indicadores calculados con datos reales: socias activas, créditos por convenio, alertas de última cuota, gráfico mensual de ingresos y egresos, y estado del pago a la Federación.
  * Saldos de Tesorería ocultos para Directora, Delegadas y Socias.
* **V2 — Tesorería y Control Financiero:**
  * Cuatro Centros de Costo: `ASOCIACION`, `CENA ANUAL`, `FEDERACION` e `ISI MUNDO COMISION`.
  * **Respaldo Digital Obligatorio:** ningún egreso se registra sin comprobante (PDF, JPG, PNG o WEBP), con su metadata guardada en MySQL.
  * Saldos calculados desde los asientos oficiales de apertura (`SALDO_APERTURA`) y correlativos atómicos.
  * Exportación del libro contable a CSV protegido contra fórmulas de Excel.
* **V3 — Padrón Centralizado de Afiliadas:**
  * 277 socias reales en 23 jardines, con búsqueda por nombre, RUT, jardín o correo y paginación en el servidor.
  * Retiro como baja lógica (`RETIRADA`) con motivo y fecha; se reactiva editando el estado y conserva créditos e historial.
  * Traslados entre jardines en transacción, con motivo obligatorio e historial.
  * Carga de la planilla **"Maestra Socias"** (Excel) con vista previa y aplicación en una sola transacción.
  * Exportación del padrón según el filtro aplicado.
* **Persistencia y estabilidad:**
  * Base de datos MySQL / MariaDB como única fuente de datos. En producción, si MySQL no está disponible la API responde **503** en vez de mostrar datos de prueba, y `/api/health` informa el estado de la conexión.
  * Fechas registradas en hora de Chile (`America/Santiago`).

### 3.2. Hoja de Ruta (Próximas Versiones)

* **V4 — Créditos y Convenios:** modelo independiente para las 4 empresas en convenio (`S.O.S`, `ISIMUNDO`, `OPTICA` y `DENTAL`), procesamiento de la planilla maestra mensual y verificación de los 4 comprobantes bancarios. Sus tablas se agregan como migración en `database/migraciones/`.
* **V5 — Portal de Afiliadas:** remediación del prototipo actual (descarga de adjuntos del buzón, límite de intentos de ingreso y solicitudes S.O.S en línea).
* **V6 — Custodia Documental:** repositorio de instrumentos legales y pagarés, ordenado por empresa proveedora (`año / mes / día`).
* **V7 — Rendición Formal de Cuentas:** consola de fiscalización para delegadas y Balance Anual en PDF para la asamblea.
* **V8 — Validación E2E y Despliegue Oficial:** pruebas de extremo a extremo, auditoría de dependencias y cierre del despliegue.

---

## 4. Arquitectura del Sistema

```text
dashboard/
├── backend/
│   ├── src/
│   │   ├── config/          # Variables de entorno y pool MySQL
│   │   ├── controllers/     # Controladores REST
│   │   ├── middlewares/     # JWT, RBAC, auditoría y carga de archivos (Multer)
│   │   ├── routes/          # Rutas de la API REST
│   │   ├── services/        # Lógica de tesorería, socias, padrón, portal y autenticación
│   │   ├── utils/           # RUT (Módulo 11), formato de socias y fechas en hora de Chile
│   │   ├── validators/      # Esquemas de validación (Zod)
│   │   └── server.js        # Configuración de Express
│   ├── app.cjs              # Punto de entrada para cPanel (Passenger)
│   ├── test/                # Suites de pruebas automatizadas (7)
│   └── uploads/             # Comprobantes y planillas cargadas
├── database/
│   ├── database.sql         # Esquema relacional
│   ├── data.sql             # Jardines, padrón, convenios, créditos y saldos de apertura
│   ├── admin.sql            # Cuentas de la directiva
│   └── migraciones/         # Cambios para bases ya instaladas
├── docs/
│   ├── PLAN_IMPLEMENTACION.md     # Plan maestro por versiones
│   ├── GUIA_DESPLIEGUE_CPANEL.md  # Instalación desde cero en cPanel
│   └── TEMA_SIGAV.md              # Sistema de diseño
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes visuales institucionales
│   │   ├── context/         # Autenticación, permisos y tema
│   │   ├── pages/           # Inicio, Tesorería, Socias y Portal de Socias
│   │   ├── routes/          # Rutas protegidas por rol
│   │   ├── services/        # Cliente de la API
│   │   └── styles/          # Tokens HSL y estilos SIGAV
│   ├── public/              # Isotipo y activos públicos
│   └── vite.config.js       # Configuración de Vite
└── README.md
```

---

## 5. Guía de Puesta en Marcha (Entorno Local)

### 5.1. Requisitos Técnicos
* **Node.js** 20 o superior y **npm**.
* **MySQL / MariaDB** (por ejemplo, XAMPP) en el puerto `3306`.
* Dos consolas de comandos (PowerShell / Terminal).

### 5.2. Despliegue de Servicios Concurrentes

**Consola 1 — Servicio Backend (API):**
```powershell
npm run dev:backend
```
*Disponible en:* `http://localhost:4000/api`

**Consola 2 — Interfaz de Usuario (Frontend):**
```powershell
npm run dev:frontend
```
*Disponible en:* `http://localhost:5173`

### 5.3. Persistencia de Datos
* **MySQL (requerido):** cree la base `jardines_vtf` e importe, en este orden:
  1. `database/database.sql` (esquema relacional).
  2. `database/data.sql` (23 jardines, padrón de 277 socias, convenios, créditos y los 2 saldos de apertura oficiales de 2026).
  3. `database/admin.sql` (cuentas de la directiva, con cambio de clave obligatorio al primer ingreso).
* **Base ya instalada:** aplique los scripts de `database/migraciones/` en orden de fecha.
* **Sin MySQL (solo desarrollo y pruebas):** el login de directiva y Tesorería responden con datos de prueba en memoria. En producción esto está desactivado y la API responde 503.

### 5.4. Verificación Automatizada del Sistema

Requiere MySQL encendido. El ejecutor crea desde cero la base `jardines_vtf_test` con los scripts de `database/` y corre las 7 suites (83 pruebas) contra ella; nunca toca `jardines_vtf`:

```powershell
npm run test:backend
```

Para verificar el empaquetado de producción de la interfaz:

```powershell
npm run build:frontend
```

### 5.5. Despliegue en Producción

La instalación en cPanel (`vtftemuco.cl`) se describe paso a paso en [`docs/GUIA_DESPLIEGUE_CPANEL.md`](docs/GUIA_DESPLIEGUE_CPANEL.md): paquete de producción, base con prefijo `vtftemuc_`, aplicación Node con `app.cjs`, variables de entorno y verificación con `/api/health`.

---

## 6. Confidencialidad y Propiedad Intelectual

> **DOCUMENTO CONFIDENCIAL**  
> Este software y su documentación técnica son propiedad exclusiva de la **Asociación de Jardines Infantiles VTF Temuco**. Queda prohibida su reproducción, distribución pública o divulgación de los datos personales contenidos en el padrón o libros contables sin la autorización expresa de la Directiva Sindical conforme a la Ley N° 19.628 sobre Protección de la Vida Privada.

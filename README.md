# Sistema Web de Gestión — Asociación de Jardines VTF

Sistema web responsive para la gestión administrativa, financiera y de transparencia de una Asociación de Jardines VTF (Vía Transferencia de Fondos).

---

## 1. Contexto Institucional

La Asociación cuenta con:
- **280 socias** (Directoras, Educadoras y Técnicos).
- **23 jardines infantiles**.
- **23 delegadas** (una representante electa por cada jardín).
- **Directiva:** Presidenta, Tesorera, Secretaria, Primera Directora y Segunda Directora.

---

## 2. Tecnologías Utilizadas (V1)

### Frontend
- **React 18** + **Vite 6**
- **React Router v6** para navegación declarativa y rutas protegidas
- **Axios** con interceptores JWT y control de expiración de sesión
- **React Hook Form** + **Zod** para validación reactiva de formularios
- **Lucide React** para iconografía institucional moderna
- **CSS3 Puro (Vanilla CSS)** con diseño anti-genérico, tipografías Google Fonts (*Plus Jakarta Sans* y *Outfit*), paleta HSL institucional suave (morado, rosado, arena cálido, gris y blanco) y sombras multicapa refinadas.

### Backend
- **Node.js 24 LTS** + **Express.js**
- **Prisma ORM 6** con modelo de datos normalizado para **PostgreSQL**
- **JWT (JSON Web Tokens)** + **bcryptjs** para hashing de contraseñas
- **Zod** para validación de datos en servidor
- **Helmet**, **CORS** y **Morgan** para seguridad y observabilidad
- **Validador de RUT chileno** con algoritmo módulo 11
- **Sistema de Auditoría** inmutable para trazabilidad de operaciones

---

## 3. Matriz de Roles y Permisos (V1)

| Rol | Correo Demo | Permisos Operativos | Visibilidad Financiera |
| :--- | :--- | :--- | :--- |
| **Tesorera** | `tesorera@vtf.cl` | Registro de ingresos, egresos, cuotas, créditos y verificación de pagos | Acceso financiero completo |
| **Presidenta** | `presidenta@vtf.cl` | Supervisión general, consulta de rendición e informes | Fondo común y reportes de gestión |
| **Secretaria** | `secretaria@vtf.cl` | Gestión de socias, jardines y estados administrativos | Sin acceso financiero sensible no autorizado |
| **Delegada** | `delegada.bambi@vtf.cl` | Representación de su jardín ante la asamblea | **Solo fondo común general y estado de su jardín** (Privacidad: Prohibido ver créditos/deudas individuales) |
| **Socia** | `socia.educadora@vtf.cl` | Consulta de su estado y cuota social | **Solo información pública y personal autorizada** |

> **Nota:** La contraseña unificada de prueba para todas las cuentas demo es: `Admin123!`

---

## 4. Estructura del Proyecto

```text
dashboard/
├── backend/
│   ├── src/
│   │   ├── config/          # Variables de entorno y cliente Prisma
│   │   ├── controllers/     # AuthController, DashboardController
│   │   ├── middlewares/     # authMiddleware, roleMiddleware, errorMiddleware
│   │   ├── routes/          # authRoutes, dashboardRoutes, index
│   │   ├── services/        # AuthService, AuditService, DashboardService, seedData
│   │   ├── utils/           # rutValidator, helpers
│   │   ├── validators/      # authValidator (Zod)
│   │   └── server.js        # Punto de entrada Express
│   ├── prisma/
│   │   ├── schema.prisma    # Esquema relacional completo PostgreSQL
│   │   └── seed.js          # Poblado de roles, jardines y convenios
│   ├── test/
│   │   └── authTest.js      # Pruebas automatizadas de autenticación y RBAC
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # UI institucional: Button, Input, Card, Badge, Sidebar, Navbar
│   │   ├── context/         # AuthContext (Sesión y roles)
│   │   ├── pages/           # LoginPage, DashboardPage, UnauthorizedPage, NotFoundPage
│   │   ├── routes/          # AppRoutes, ProtectedRoute
│   │   ├── services/        # Cliente Axios configurado
│   │   ├── styles/          # Variables HSL, diseño responsivo y tipografía
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── AGENTS.md                # Reglas de desarrollo Antigravity
├── .gitignore
├── package.json             # Scripts de orquestación raíz
└── README.md
```

---

## 5. Instrucciones de Ejecución Local

### Paso 1: Levantar el Backend
```powershell
cd backend
npm run dev
```
El servidor backend se iniciará en `http://localhost:4000`.

### Paso 2: Levantar el Frontend
En otra terminal:
```powershell
cd frontend
npm run dev
```
La aplicación web se abrirá en `http://localhost:5173`.

### Ejecutar Pruebas de Validación Automatizada
```powershell
cd backend
npm run test:auth
```

---

## 6. Hoja de Ruta de Versiones

- [x] **V1 — Base y Autenticación:** Configuración del proyecto, arquitectura limpia, Prisma ORM, autenticación JWT, RBAC por roles, auditoría y Dashboard adaptativo inicial.
- [ ] **V2 — Socias y Jardines:** CRUD de 280 socias, asignación a los 23 jardines, cargos, estados e historial inmutable.
- [ ] **V3 — Finanzas:** Cuota mensual ($4.000 CLP: $1.000 Fed, $1.000 Asoc, $2.000 Cena Anual), ingresos y egresos.
- [ ] **V4 — Créditos:** Convenios SOS, EasyMundo (comisión 2%), Dental y Óptica con control automático de cuotas.
- [ ] **V5 — Comprobantes:** Carga y verificación de boletas/facturas con workflow de aprobación por Tesorera.
- [ ] **V6 — Reportes:** Informes en Excel (ExcelJS) y Rendición Anual oficial en PDF.
- [ ] **V7 — Seguridad y Auditoría:** Fortalecimiento y bitácora forense de auditoría.
- [ ] **V8 — Final:** Optimización completa, validaciones de campo y entrega académica.

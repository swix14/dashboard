-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'PRIMERA_DIRECTORA', 'SEGUNDA_DIRECTORA', 'DELEGADA', 'SOCIA');

-- CreateEnum
CREATE TYPE "CargoSocia" AS ENUM ('DIRECTORA', 'EDUCADORA', 'TECNICO');

-- CreateEnum
CREATE TYPE "EstadoSocia" AS ENUM ('ACTIVA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('ACTIVO', 'PENDIENTE', 'CANCELADO', 'FINALIZADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "CentroCosto" AS ENUM ('ASOCIACION', 'CENA_ANUAL', 'FEDERACION', 'ISI_MUNDO_COMISION');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" "RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "sociaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jardines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delegadaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jardines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socias" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "cargo" "CargoSocia" NOT NULL,
    "estado" "EstadoSocia" NOT NULL DEFAULT 'ACTIVA',
    "jardinId" TEXT NOT NULL,
    "fechaIncorporacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_cambios_jardin" (
    "id" TEXT NOT NULL,
    "sociaId" TEXT NOT NULL,
    "jardinAnteriorId" TEXT NOT NULL,
    "jardinNuevoId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_cambios_jardin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuotas" (
    "id" TEXT NOT NULL,
    "sociaId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 4000,
    "federacionAmount" DECIMAL(65,30) NOT NULL DEFAULT 1000,
    "asociacionAmount" DECIMAL(65,30) NOT NULL DEFAULT 1000,
    "cenaAnualAmount" DECIMAL(65,30) NOT NULL DEFAULT 2000,
    "status" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "comprobanteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_credito" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionRate" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos" (
    "id" TEXT NOT NULL,
    "sociaId" TEXT NOT NULL,
    "tipoCreditoId" TEXT NOT NULL,
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "currentInstallment" INTEGER NOT NULL DEFAULT 0,
    "installmentValue" DECIMAL(65,30) NOT NULL,
    "status" "EstadoCredito" NOT NULL DEFAULT 'ACTIVO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "estimatedEndDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creditos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "amount" DECIMAL(65,30),
    "description" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" TEXT NOT NULL,
    "type" "TipoMovimiento" NOT NULL,
    "costCenter" "CentroCosto" NOT NULL DEFAULT 'ASOCIACION',
    "category" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "registeredBy" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobanteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_rut_key" ON "usuarios"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sociaId_key" ON "usuarios"("sociaId");

-- CreateIndex
CREATE UNIQUE INDEX "jardines_name_key" ON "jardines"("name");

-- CreateIndex
CREATE UNIQUE INDEX "jardines_code_key" ON "jardines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "jardines_delegadaId_key" ON "jardines"("delegadaId");

-- CreateIndex
CREATE UNIQUE INDEX "socias_rut_key" ON "socias"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_sociaId_period_key" ON "cuotas"("sociaId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_credito_code_key" ON "tipos_credito"("code");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sociaId_fkey" FOREIGN KEY ("sociaId") REFERENCES "socias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jardines" ADD CONSTRAINT "jardines_delegadaId_fkey" FOREIGN KEY ("delegadaId") REFERENCES "socias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socias" ADD CONSTRAINT "socias_jardinId_fkey" FOREIGN KEY ("jardinId") REFERENCES "jardines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cambios_jardin" ADD CONSTRAINT "historial_cambios_jardin_sociaId_fkey" FOREIGN KEY ("sociaId") REFERENCES "socias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cambios_jardin" ADD CONSTRAINT "historial_cambios_jardin_jardinAnteriorId_fkey" FOREIGN KEY ("jardinAnteriorId") REFERENCES "jardines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_cambios_jardin" ADD CONSTRAINT "historial_cambios_jardin_jardinNuevoId_fkey" FOREIGN KEY ("jardinNuevoId") REFERENCES "jardines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_sociaId_fkey" FOREIGN KEY ("sociaId") REFERENCES "socias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "comprobantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_sociaId_fkey" FOREIGN KEY ("sociaId") REFERENCES "socias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos" ADD CONSTRAINT "creditos_tipoCreditoId_fkey" FOREIGN KEY ("tipoCreditoId") REFERENCES "tipos_credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "comprobantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

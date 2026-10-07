import { prisma } from '../src/config/prisma.js';
import { INITIAL_ROLES, INITIAL_JARDINES, INITIAL_USERS } from '../src/services/seedData.js';

async function main() {
  console.log('Iniciando proceso de seeding en base de datos...');

  if (!prisma) {
    console.log('Prisma no está inicializado. Saltando seed de base de datos.');
    return;
  }

  // 1. Crear o sincronizar roles
  for (const role of INITIAL_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { id: role.id, code: role.code, name: role.name, description: role.description }
    });
  }
  console.log(`✓ ${INITIAL_ROLES.length} roles sincronizados.`);

  // 2. Crear jardines iniciales
  for (const jardin of INITIAL_JARDINES) {
    await prisma.jardin.upsert({
      where: { code: jardin.code },
      update: { name: jardin.name, address: jardin.address },
      create: { id: jardin.id, code: jardin.code, name: jardin.name, address: jardin.address }
    });
  }
  console.log(`✓ ${INITIAL_JARDINES.length} jardines VTF sincronizados.`);

  // 3. Crear tipos de crédito base
  const tiposCredito = [
    { code: 'SOS', name: 'Crédito SOS Emergencia', commissionRate: 0.0 },
    { code: 'EASYMUNDO', name: 'Convenio EasyMundo (Comisión 2%)', commissionRate: 0.02 },
    { code: 'DENTAL', name: 'Convenio Salud Dental', commissionRate: 0.0 },
    { code: 'OPTICA', name: 'Convenio Salud Óptica', commissionRate: 0.0 }
  ];

  for (const tc of tiposCredito) {
    await prisma.tipoCredito.upsert({
      where: { code: tc.code },
      update: { name: tc.name, commissionRate: tc.commissionRate },
      create: { code: tc.code, name: tc.name, commissionRate: tc.commissionRate }
    });
  }
  console.log(`✓ Tipos de crédito sincronizados.`);

  console.log('Seeding completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

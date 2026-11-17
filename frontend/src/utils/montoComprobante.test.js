// Pruebas de la lectura de montos: npm test (usa el probador de Node, sin dependencias)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerMonto, montosEnLinea } from './montoComprobante.js';

const monto = (texto) => extraerMonto(texto)?.monto ?? null;

test('PDF de transferencia: toma "Monto transferido" y no el saldo', () => {
  const texto = `Comprobante de Transferencia
Fecha: 17/11/2026 14:32
Origen: Cuenta Corriente 00-123-45678-09
Destinatario: Asociación VTF Temuco
RUT destinatario: 65.123.456-7
Monto transferido: $ 250.000
Saldo disponible: $ 1.840.500
N° de operación 987654321`;
  assert.equal(monto(texto), 250000);
  assert.equal(extraerMonto(texto).regla, 'total');
});

test('Pantallazo de app: etiqueta en una línea y monto en la siguiente', () => {
  const texto = `¡Transferencia exitosa!
Monto
$50.000
Para
Federación Nacional VTF
Comentario
Cuota noviembre`;
  assert.equal(monto(texto), 50000);
});

test('Boleta: total, no subtotal, IVA, efectivo ni vuelto', () => {
  const texto = `LIBRERIA EL ESTUDIANTE
BOLETA ELECTRONICA N° 1234567
2 RESMA CARTA 5.990 11.980
1 CARPETA 1.490
SUBTOTAL 11.437
IVA 19% 2.173
TOTAL $ 13.470
EFECTIVO $ 20.000
VUELTO $ 6.530`;
  assert.equal(monto(texto), 13470);
});

test('"Total a pagar" gana a un "Total" de ítems', () => {
  const texto = `Total ítems 3
Total a pagar $89.990`;
  assert.equal(monto(texto), 89990);
});

test('Formato con decimales y sin "$"', () => {
  assert.equal(monto('Importe: 1.250.000,00 CLP'), 1250000);
  assert.equal(monto('Total 12.990'), 12990);
});

test('Sin palabras clave: el mayor monto con "$"', () => {
  const texto = `Pago recibido
$ 3.500
$ 45.000
Gracias por su compra`;
  assert.equal(monto(texto), 45000);
  assert.equal(extraerMonto(texto).regla, 'mayor');
});

test('No confunde RUT, fechas, horas ni porcentajes con montos', () => {
  assert.deepEqual(montosEnLinea('RUT 16.947.343-9 · 17/11/2026 · 14:32 · 19%'), []);
  assert.equal(monto('RUT: 16.947.343-9\nFecha 2026-11-17'), null);
});

test('Sin montos reconocibles devuelve null', () => {
  assert.equal(monto(''), null);
  assert.equal(monto('Comprobante ilegible ### ...'), null);
  assert.equal(monto(null), null);
});

test('Ignora montos sobre el tope del sistema', () => {
  assert.equal(monto('Total $ 900.000.000'), null);
});

test('Separador de miles con espacio duro (U+00A0) de algunos PDF', () => {
  assert.equal(monto('Monto transferido $ 150 000'), 150000);
});

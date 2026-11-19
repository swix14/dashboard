import test from 'node:test';
import assert from 'node:assert';
import { puedeAcceder } from './permissions.js';

test('la Directora no ve Tesorería ni Créditos sin suplencia', () => {
  assert.strictEqual(puedeAcceder('DIRECTORA', 'TESORERIA'), false);
  assert.strictEqual(puedeAcceder('DIRECTORA', 'CREDITOS'), false);
});

test('la Presidenta no tiene los menús donde solo leía', () => {
  assert.strictEqual(puedeAcceder('PRESIDENTA', 'TESORERIA'), false);
  assert.strictEqual(puedeAcceder('PRESIDENTA', 'CREDITOS'), false);
  assert.strictEqual(puedeAcceder('PRESIDENTA', 'SOCIAS'), true);
  assert.strictEqual(puedeAcceder('PRESIDENTA', 'COMUNICACIONES'), true);
  assert.strictEqual(puedeAcceder('PRESIDENTA', 'REPORTES'), true);
});

test('la Directora suplente ve lo de la Tesorera y conserva lo suyo', () => {
  assert.strictEqual(puedeAcceder('DIRECTORA', 'TESORERIA', true), true);
  assert.strictEqual(puedeAcceder('DIRECTORA', 'CREDITOS_GESTIONAR', true), true);
  assert.strictEqual(puedeAcceder('DIRECTORA', 'COMUNICACIONES', true), true);
});

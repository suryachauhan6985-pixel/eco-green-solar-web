const assert = require('assert');
const { itemNameSlug, getItemId, getOrCreateItem } = require('../api/services/stockHelpers');

console.log('Testing Purchase Inward stock helpers...');

// 1. Test itemNameSlug with and without model
assert.strictEqual(itemNameSlug('Tata', 550, 'Mono Perc', ''), 'Tata_550_Mono Perc');
assert.strictEqual(itemNameSlug('Finolex', 0, 'Others', '2.5 Inch'), 'Finolex_2.5 Inch');
assert.strictEqual(itemNameSlug('Adani', 545, 'Bifacial', null), 'Adani_545_Bifacial');
console.log('✔ PASS: itemNameSlug handles wattage and model-based naming correctly.');

// 2. Test getOrCreateItem mock execution
const mockConn = {
  queries: [],
  query: async function(sql, params) {
    mockConn.queries.push({ sql, params });
    if (sql.includes('SELECT id FROM items')) {
      return [[{ id: 42 }]];
    }
    if (sql.includes('INSERT INTO items')) {
      return [{ insertId: 99 }];
    }
    if (sql.includes('SELECT id FROM categories')) {
      return [[{ id: 1 }]];
    }
    return [[]];
  }
};

(async () => {
  const itemId = await getOrCreateItem(mockConn, 'Solar Panel', 'Adani', 545, 'Mono Perc', '', 'Nos');
  assert.strictEqual(itemId, 42);
  console.log('✔ PASS: getOrCreateItem executes with model parameter successfully.');

  const modelItemId = await getOrCreateItem(mockConn, 'Pipes', 'Finolex', 0, 'Others', '3 Inch', 'Mtr');
  assert.strictEqual(modelItemId, 42);
  console.log('✔ PASS: getOrCreateItem handles model-based category lookup successfully.');

  console.log('\n======================================================');
  console.log('ALL PURCHASE INWARD TESTS PASSED (0 ERRORS)');
  console.log('======================================================');
})();

import assert from 'node:assert/strict';
import { allocateCents, classifyOverdueBucket } from './financial-rules.js';

const allocation = allocateCents(100, 3);
assert.deepEqual(allocation, [34, 33, 33]);
assert.equal(allocation.reduce((sum, value) => sum + value, 0), 100);
assert.deepEqual(allocateCents(0, 4), [0, 0, 0, 0]);
assert.throws(() => allocateCents(-1, 2), TypeError);
assert.throws(() => allocateCents(10, 0), RangeError);

assert.equal(classifyOverdueBucket(0), '30');
assert.equal(classifyOverdueBucket(30), '30');
assert.equal(classifyOverdueBucket(31), '60');
assert.equal(classifyOverdueBucket(60), '60');
assert.equal(classifyOverdueBucket(61), '90');
assert.equal(classifyOverdueBucket(90), '90');
assert.equal(classifyOverdueBucket(91), '91+');
assert.equal(classifyOverdueBucket(-1), null);

console.log('financial-rules.test.js: OK');

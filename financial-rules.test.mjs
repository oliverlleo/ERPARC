import assert from 'node:assert/strict';
import {
    allocateCents,
    allocateProportionally,
    classifyOverdueBucket,
    parseMoneyToCents,
    addMonthsClamped
} from './financial-rules.js';

const allocation = allocateCents(100, 3);
assert.deepEqual(allocation, [34, 33, 33]);
assert.equal(allocation.reduce((sum, value) => sum + value, 0), 100);
assert.deepEqual(allocateCents(0, 4), [0, 0, 0, 0]);
assert.throws(() => allocateCents(-1, 2), TypeError);
assert.throws(() => allocateCents(10, 0), RangeError);

assert.deepEqual(allocateProportionally(1000, [10000, 20000]), [333, 667]);
assert.equal(allocateProportionally(1000, [10000, 20000]).reduce((sum, value) => sum + value, 0), 1000);
assert.deepEqual(allocateProportionally(0, [10000, 20000]), [0, 0]);
assert.deepEqual(allocateProportionally(1, [1, 1]), [1, 0]);
assert.deepEqual(allocateProportionally(100, [0, 10, 0]), [0, 100, 0]);
assert.deepEqual(allocateProportionally(100, [0, 0]), [0, 0]);
assert.throws(() => allocateProportionally(-1, [1]), TypeError);
assert.throws(() => allocateProportionally(1, []), TypeError);

assert.equal(classifyOverdueBucket(0), '30');
assert.equal(classifyOverdueBucket(30), '30');
assert.equal(classifyOverdueBucket(31), '60');
assert.equal(classifyOverdueBucket(60), '60');
assert.equal(classifyOverdueBucket(61), '90');
assert.equal(classifyOverdueBucket(90), '90');
assert.equal(classifyOverdueBucket(91), '91+');
assert.equal(classifyOverdueBucket(-1), null);

assert.equal(parseMoneyToCents('10,50'), 1050);
assert.equal(parseMoneyToCents('10.50'), 1050);
assert.equal(parseMoneyToCents('1.234,56'), 123456);
assert.equal(parseMoneyToCents('R$ 1.234,56'), 123456);
assert.equal(parseMoneyToCents('1.234'), 123400);
assert.equal(parseMoneyToCents('.5'), 50);
assert.equal(parseMoneyToCents(12.345), 1235);
assert.equal(parseMoneyToCents('abc'), null);
assert.equal(parseMoneyToCents(''), null);
assert.equal(parseMoneyToCents(-1), -100);

const january31 = addMonthsClamped(new Date('2026-01-31T00:00:00'), 1);
assert.equal(january31.toISOString().split('T')[0], '2026-02-28');
const leapYear = addMonthsClamped(new Date('2028-01-31T00:00:00'), 1);
assert.equal(leapYear.toISOString().split('T')[0], '2028-02-29');
const reverse = addMonthsClamped(new Date('2026-02-28T00:00:00'), -1);
assert.equal(reverse.toISOString().split('T')[0], '2026-01-28');
assert.throws(() => addMonthsClamped(new Date('invalid'), 1), TypeError);
assert.throws(() => addMonthsClamped(new Date('2026-01-01T00:00:00'), 0.5), TypeError);

console.log('financial-rules.test.js: OK');

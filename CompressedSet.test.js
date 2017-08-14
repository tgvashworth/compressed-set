const CompressedSet = require('./CompressedSet');

describe('basic operation', () => {
    test('it can be initialized', () => {
        new CompressedSet();
    });

    test('it does not contain anything by default', () => {
        const set = new CompressedSet();
        expect(set.contains('a')).toBe(false);
    });

    test('it can contain a value', () => {
        const set = new CompressedSet();
        set.add('a');
        expect(set.contains('a')).toBe(true);
    });

    test('it can contain multiple values', () => {
        const values = ['a', 'b', 'c', 'd'];
        const set = new CompressedSet();
        values.forEach(v => set.add(v));
        values.forEach(v => {
            expect(set.contains(v)).toBe(true);
        });
    });
});

describe('encode + decode', () => {
    test('it is encodable when empty', () => {
        const set = new CompressedSet();
        expect(set.encode()).toBeTruthy();
    });

    test('it is encodable with a value', () => {
        const set = new CompressedSet();
        set.add('a');
        expect(set.encode()).toBeTruthy();
    });

    test('it holds the same properties when decoded from an encoding', () => {
        const set = new CompressedSet();
        set.add('a');
        const decoded = CompressedSet.decode(set.encode());
        expect(decoded.contains('a')).toBe(true);
   });
});

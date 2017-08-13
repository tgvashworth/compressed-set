const random = require('random-js')();
const bigInt = require('big-integer');
const leftPad = require('left-pad');
const MurmurHash3 = require('imurmurhash');
const URLSafeBase64 = require('urlsafe-base64');

/**
 * The HodgesSet is a lossy, compressed set data structure inspired by Jeff Hodges'
 * "The Opposite of a Bloom Filter" article:
 *     https://www.somethingsimilar.com/2012/05/21/the-opposite-of-a-bloom-filter/
 *
 * The idea is that it's useful to have a compressed, probabalistic set data structure
 * that can answer "probably not in set" with a high degree of confidence (few false positives)
 * and "probably in set" with a medium degree of confidence (some false negatives)
 *
 * It allows, for example, representing cache state over a resource-constrained network.
 *
 * Both false negatives and false positives are tunable, compromising on size at higher values.
 *
 * The HodgesSet compresses the input by taking part of the hash of the input it to find
 * an index within a constrained array, and then places some of the double-hashed input
 * at each index. It ignores collisons.
 *
 * Digest is expected a base64 encoded hexidecimal string:
 * Format:
 * [ 2 bytes for size ][ 1 byte for value_size ][ size * value_size bits for entries ]
 */

const Base64 = {
    encode: s => URLSafeBase64.encode(Buffer.from(s, 'utf8')),
    decode: s => URLSafeBase64.decode(s).toString('ascii')
};

class HodgesSet {
    constructor(size, value_size, array) {
        // increase this to reduce false negatives
        this.size = size;
        // increase this to reduce false positives
        this.value_size = value_size;

        this.size_mask = this.size - 1;
        this.array = array || Array.from({ length: size });
    }

    add(entry) {
        const { k, v } = this.kv(entry);
        this.array[k] = v;
    }

    contains(entry) {
        const { k, v } = this.kv(entry)
        return this.array[k] === v;
    }

    kv(entry) {
        const hash = hashdigest(entry);
        // JS can't do big ints so we gotta help it
        //const bitsForSize = Math.log2(this.size);
        //const characters = Math.ceil(bitsForSize / 4);
        //const reducedHex = hash.slice(-characters);
        //const reduceInt = parseInt(reducedHex, 16);
        const k = parseInt(hash, 16) & this.size_mask;
        const v = hashdigest(hash).slice(0, this.value_size);
        return { k, v };
    }

    encode() {
        const s = leftPad(this.size.toString(16), 4, '0');
        const v = leftPad(this.value_size.toString(16), 2, '0');
        const values = this.array.map(v => (v === undefined ? leftPad('', this.value_size, '\0') : v));
        if (values.length !== this.size) {
            throw Error(`Expected encoding length of ${expected} but found ${values.length}`);
        }
        return Base64.encode(`${s}${v}${values.join('')}`);
    }
}

HodgesSet.decode = function decode(encodedDigest) {
    const digest = Base64.decode(encodedDigest);

    const sizeBits = 8 * 2;
    const valueSizeBits = 8 * 1;
    const sizeStr = digest.slice(0, sizeBits / 4);
    const valueSizeStr = digest.slice(sizeStr.length, sizeStr.length + valueSizeBits / 4);
    const valuesStr = digest.slice(sizeStr.length + valueSizeStr.length);

    const size = parseInt(sizeStr, 16);
    const valueSize = parseInt(valueSizeStr, 16);

    const array = Array.from({ length: size });
    const nullVal = leftPad('', valueSize, '\0');
    for (let i = 0; i < valuesStr.length; i += 1) {
        const val = valuesStr.slice(i * valueSize, i * valueSize + valueSize);
        if (val && val !== nullVal) array[i] = val;
    }

    if (array.length !== size) {
        throw new Error(`size declared as ${size}, actual was ${array.length}`);
    }

    return new HodgesSet(size, valueSize, array);
};

function hashdigest(v) {
    return MurmurHash3(v).result().toString(16);
}


const source_ids = Array.from({ length: 20000 }).map(() =>
    bigInt.randBetween('0', '12345678987654321').toString()
)

const ids = source_ids.slice(0, 200);
const other_ids_deduped = source_ids.slice(200).filter(i => !ids.includes(i));

const sizes = [64, 128, 256, 512, 1024, 2048];
const value_sizes = [4, 5, 6, 7, 8];
const results = [];

for (let s of sizes) {
    for (let v of value_sizes) {
        const hset = new HodgesSet(s, v);

        for (let id of ids) {
            hset.add(id);
        }

        // sample a random ids from the orignal list for testing
        const test_ids = random.sample(ids, 100);

        let false_negatives = 0;
        for (let id of test_ids) {
            if (!hset.contains(id)) {
                false_negatives += 1
            }
        }

        let false_positives = 0;
        for (let id of other_ids_deduped) {
            if (hset.contains(id)) {
                false_positives += 1
            }
        }

        const set_max_size = s * (v * 4) / 8;

        results.push([s, v, set_max_size, false_negatives, false_positives]);
    }
}

console.log('configuration,size (bytes),false negatives,false positives');
results.forEach(([s, v, size, f_n, f_p]) => {
    console.log(`${s}/${v},${size},${f_n},${f_p}`);
});


function throws(f) {
    try {
        f()
    } catch(e) {
        console.log(`Threw as expected: ${e.message}`);
    }
}


console.log(HodgesSet.decode(Base64.encode("000101a")));
console.log(HodgesSet.decode(Base64.encode("000201ab")));
throws(() => HodgesSet.decode(Base64.encode("000301ab")));
console.log(HodgesSet.decode(Base64.encode("000301abc")));
console.log(HodgesSet.decode(Base64.encode("000302aabbcc")));
const h1 = new HodgesSet(1,1,['a']);
console.log(h1.encode());
console.log(HodgesSet.decode(h1.encode()));
const h2 = new HodgesSet(1,1);
h2.add('test');
console.log(HodgesSet.decode(h2.encode()).contains('test') === true);
console.log(HodgesSet.decode(HodgesSet.decode(h2.encode()).encode()).contains('test') === true);

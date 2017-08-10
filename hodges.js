const createHash = require('crypto').createHash;
const random = require('random-js')();
const bigInt = require('big-integer');

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
 * TODO: encode & decode the set, including the size and value_size parameters
 */

class HodgesSet {
    constructor(size, value_size) {
        // increase this to reduce false negatives
        this.size = size;
        // increase this to reduce false positives
        this.value_size = value_size;

        this.size_mask = this.size - 1;
        this.array = Array.from({ length: size });
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
        const hash = sha256(entry);
        // JS can't do big ints so we gotta help it
        const bitsForSize = Math.log2(this.size);
        const characters = Math.ceil(bitsForSize / 4);
        const reducedHex = hash.slice(-characters);
        const reduceInt = parseInt(reducedHex, 16);
        const k = parseInt(reducedHex, 16) & this.size_mask;
        const v = sha256(hash).slice(0, this.value_size);
        return { k, v };
    }
}

function sha256(v) {
    return createHash('sha256').update(v).digest('hex');
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



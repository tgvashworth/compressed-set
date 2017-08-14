const random = require('random-js')();
const bigInt = require('big-integer');
const leftPad = require('left-pad');

const CompressedSet = require('./CompressedSet');

const source_ids = Array.from({ length: 20000 }).map(() =>
    bigInt.randBetween('0', '12345678987654321').toString()
);

const ids = source_ids.slice(0, 200);
const other_ids_deduped = source_ids.slice(200).filter(i => !ids.includes(i));

//const sizes = [64, 128, 256, 512, 1024, 2048];
//const value_sizes = [4, 6, 8];
const results = [];

//for (let s of sizes) {
    //for (let v of value_sizes) {
        const hset = new CompressedSet();

        for (let id of ids) {
            hset.add(id);
        }

        console.log(hset.encode());

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

        const set_max_size = 512 * 8 / 8;

        results.push(['512', '8', set_max_size, false_negatives, false_positives]);
    //}
//}

console.log('configuration,size (bytes),false negatives,false positives');
results.forEach(([s, v, size, f_n, f_p]) => {
    console.log(`${s}/${v},${size},${f_n},${f_p}`);
});



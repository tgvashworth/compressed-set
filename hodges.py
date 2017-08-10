import hashlib
import random
import binascii
import json

"""
The HodgesSet is a lossy, compressed set data structure inspired by Jeff Hodges'
"The Opposite of a Bloom Filter" article:
    https://www.somethingsimilar.com/2012/05/21/the-opposite-of-a-bloom-filter/

The idea is that it's useful to have a compressed, probabalistic set data structure
that can answer "probably not in set" with a high degree of confidence (few false positives)
and "probably in set" with a medium degree of confidence (some false negatives)

It allows, for example, representing cache state over a resource-constrained network.

Both false negatives and false positives are tunable, compromising on size at higher values.

The HodgesSet compresses the input by taking part of the hash of the input it to find
an index within a constrained array, and then places some of the double-hashed input
at each index. It ignores collisons.

TODO: encode & decode the set, including the size and value_size parameters
"""
class HodgesSet:
    def __init__(self, size, value_size):
        # increase this to reduce false negatives
        self.size = size
        # increase this to reduce false positives
        self.value_size = value_size

        self.size_mask = self.size - 1
        self.array = [None for i in range(0, self.size)]

    def add(self, entry):
        (k, v) = self.kv(entry)
        self.array[k] = v

    def contains(self, entry):
        (k, v) = self.kv(entry)
        return self.array[k] == v

    def kv(self, entry):
        hash = sha256(entry)
        k = int(hash, 16) & self.size_mask
        # double hashing reduced false positives
        v = sha256(hash)[:self.value_size]
        # you could also try:
        # v = entry[-self.value_size:]
        return (k, v)

def sha256(v):
    m = hashlib.sha256()
    m.update(v)
    return m.hexdigest()

if __name__ == "__main__":
    source_ids = [str(random.randint(0, 12345678987654321)) for i in range(0, 20000)]
    # compress ids into the set
    ids = source_ids[:200]
    # generate loads of random *different* IDs that we can use to test for false positives
    other_ids_deduped = [i for i in source_ids[200:] if i not in ids]

    sizes = [64, 128, 256, 512, 1024, 2048]
    value_sizes = [4, 5, 6, 7, 8]
    results = []


    for i,s in enumerate(sizes):
        for j,v in enumerate(value_sizes):
            hset = HodgesSet(s, v)

            for id in ids:
                hset.add(id)

            # sample a random ids from the orignal list for testing
            test_ids = random.sample(ids, 100)

            false_negatives = 0
            for id in test_ids:
                if not hset.contains(id):
                    false_negatives += 1

            false_positives = 0
            for id in other_ids_deduped:
                if hset.contains(id):
                    false_positives += 1

            set_max_size = s * (v * 4) / 8

            results.append((s, v, set_max_size, false_negatives, false_positives))

    print 'configuration,size (bytes),false negatives,false positives'
    for (s, v, size, f_n, f_p) in results:
        print '%d/%d,%d,%d,%d' % (s, v, size, f_n, f_p)



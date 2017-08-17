# CompressedSet

*Note:* this is experimental and not ready for production or used anywhere.

The CompressedSet is a lossy, compressed set data structure inspired by Jeff Hodges' ["The Opposite of a Bloom Filter" article](https://www.somethingsimilar.com/2012/05/21/the-opposite-of-a-bloom-filter/)

The idea is that it's useful to have a compressed, probabilistic set data structure that can answer "probably not in set" with a high degree of confidence (very few false positives) and "probably in set" with a medium degree of confidence (some false negatives).

It allows, for example, representing cache state over a resource-constrained network.

Both false negatives and false positives are tunable, compromising on size at higher values.

The CompressedSet compresses the input set by:
* hashing (MurmurHash3) each input item to find an index within an M-length byte array
* placing N bytes of the input item (double-hash) at each index
* ignoring collisons (an index collision leads to an overwrite)

It is encoded as a URL-safe base64 encoded hexidecimal string in the following format:

    [ 2 bytes (M) ][ 1 byte (N) ][ M * N bytes ]

A test configuration, M=256 and N=3 (771 bytes total), was given an input set of 200 randomly generated IDs (3k when concatenated).

When queried with a random 100 ID subset of the input set it gave 23 false-negatives, which is a 77% true-positive (hit) rate.

When queried with 20,000 random IDs not in the input set, it returned 0 false-positives which is a 100% true-negative rate.

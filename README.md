# CompressedSet

*Note:* this is experimental and not ready for production or used anywhere.

The CompressedSet is a lossy, compressed set data structure inspired by Jeff Hodges' ["The Opposite of a Bloom Filter" article](https://www.somethingsimilar.com/2012/05/21/the-opposite-of-a-bloom-filter/)

The idea is that it's useful to have a compressed, probabalistic set data structure
that can answer "probably not in set" with a high degree of confidence (few false positives)
and "probably in set" with a medium degree of confidence (some false negatives)

It allows, for example, representing cache state over a resource-constrained network.

Both false negatives and false positives are tunable, compromising on size at higher values.

The CompressedSet compresses the input by taking part of the hash of the input it to find
an index within a constrained array, and then places some of the double-hashed input
at each index. It ignores collisons.

Digest is expected a base64 encoded hexidecimal string:

    [ 4 bits (V) ][ 4 bits (unused) ][ 4 bits (p) ][ 4 bits (q) ]
    [ p bytes (M) ][ q bytes (N) ]
    [ M * N bytes ]

To enable future extension, the encoded string contains a version number (V) to allow
identification of the encoding rules.

The bytes required for the M and N values are also encoded as p and q. These are expected
to be small, but are there to enable the CompressedSet to become very large.

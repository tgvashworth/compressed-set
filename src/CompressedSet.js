const MurmurHash3 = require("imurmurhash");
const NibbleView = require("./NibbleView");
const Base64 = require("./Base64");

/**
 * The CompressedSet is a lossy, compressed set data structure inspired by Jeff Hodges'
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
 * The CompressedSet compresses the input by taking part of the hash of the input it to find
 * an index within a constrained array, and then places some of the double-hashed input
 * at each index. It ignores collisons.
 *
 * Digest is expected a base64 encoded hexidecimal string:

    [ 4 bits (V) ][ 4 bits (unused) ][ 4 bits (p) ][ 4 bits (q) ]
    [ p bytes (M) ][ q bytes (N) ]
    [ M * N bytes ]

 * To enable future extension, the encoded string contains a version number (V) to allow
 * identification of the encoding rules.
 *
 * The bytes required for the M and N values are also encoded as p and q. These are expected
 * to be small, but are there to enable the CompressedSet to become very large.
 */

const Constants = {
  DEFAULT_P: 2,
  DEFAULT_Q: 1,

  DEFAULT_NUM_VALUES: 256,
  DEFAULT_BYTES_PER_VALUE: 3,

  V_BITS: 4,
  P_BITS: 4,
  Q_BITS: 4
};

Constants.MINIMUM_BYTE_LENGTH = Math.ceil(
  (Constants.V_BITS + Constants.P_BITS + Constants.Q_BITS) / 8
);

class CompressedSet {
  constructor(buffer) {
    if (buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new TypeError(
          "First argument to CompressedSet constructor must be an ArrayBuffer"
        );
      }

      if (buffer.byteLength < Constants.MINIMUM_BYTE_LENGTH) {
        throw new TypeError(
          `ArrayBuffer argument to CompressedSet constructor must have a byteLength of at least ${Constants.MINIMUM_BYTE_LENGTH}`
        );
      }
    }

    this.buffer = buffer || this.getBuffer(/* config goes here */);
    this.vView = new NibbleView(this.buffer, 0);
    this.pQView = new NibbleView(this.buffer, 1);

    if (!buffer) {
      this.pQView.setFirst(Constants.DEFAULT_P);
      this.pQView.setSecond(Constants.DEFAULT_Q);
    }

    this.config = {
      V: this.vView.getFirst(),
      p: this.pQView.getFirst(),
      q: this.pQView.getSecond()
    };

    this.numValuesView = new DataView(
      this.buffer,
      Constants.MINIMUM_BYTE_LENGTH,
      this.config.p
    );
    this.bytesPerValueView = new DataView(
      this.buffer,
      Constants.MINIMUM_BYTE_LENGTH + this.config.p,
      this.config.q
    );
    this.valuesView = new DataView(
      this.buffer,
      Constants.MINIMUM_BYTE_LENGTH + this.config.p + this.config.q
    );

    if (!buffer) {
      this.vView.setFirst(1);
      this.pQView.setFirst(this.config.p);
      this.pQView.setSecond(this.config.q);
      this.numValuesView.setUint16(0, Constants.DEFAULT_NUM_VALUES);
      this.bytesPerValueView.setUint8(0, Constants.DEFAULT_BYTES_PER_VALUE);
    }

    this.indexMask = this.numValues - 1;
    this.valueMask = Math.pow(2, this.bytesPerValue * 8) - 1;
  }

  getBuffer(
    {
      p = 2,
      q = 1,
      M = Constants.DEFAULT_NUM_VALUES,
      N = Constants.DEFAULT_BYTES_PER_VALUE
    } = {}
  ) {
    return new ArrayBuffer(Constants.MINIMUM_BYTE_LENGTH + p + q + M * N);
  }

  get numValues() {
    const { p: bytes } = this.config;
    return this._readBytes(this.numValuesView, bytes);
  }

  get bytesPerValue() {
    const { q: bytes } = this.config;
    return this._readBytes(this.bytesPerValueView, bytes);
  }

  toString() {
    return this.encode();
  }

  add(entry) {
    this._check(entry);
    const { k, v } = this._kv(entry);

    this._vs(v).forEach((vByte, i) => {
      this.valuesView.setUint8(k + i, vByte);
    });

    return this;
  }

  remove(entry) {
    this._check(entry);
    if (this.contains(entry)) {
      const { k, v } = this._kv(entry);
      this._vs(v).forEach((vByte, i) => {
        this.valuesView.setUint8(k + i, 0);
      });
    }

    return this;
  }

  contains(entry) {
    this._check(entry);
    const { k, v } = this._kv(entry);

    return this._vs(v).every(
      (vByte, i) => this.valuesView.getUint8(k + i) === vByte
    );
  }

  _check(entry) {
    if (typeof entry !== "string") {
      throw new TypeError("CompressedSet can only store string values");
    }
  }

  _kv(entry) {
    const hash = CompressedSet.hash(entry);
    const k = (hash & this.indexMask) * this.bytesPerValue;
    const v = CompressedSet.hash(hash.toString(16)) & this.valueMask;
    return { k, v };
  }

  _vs(v) {
    const mask = Math.pow(2, 8) - 1;
    const vs = Array.from({ length: this.bytesPerValue });
    for (let i = 0; i < this.bytesPerValue; i++) {
      const shift = this.bytesPerValue - i - 1;
      vs[i] = (v >> (shift * 8)) & mask;
    }
    return vs;
  }

  _readBytes(view, bytes) {
    return Array.from({ length: bytes }).reduce((acc, _, i) => {
      const shift = (bytes - i - 1) * 8;
      return acc | (view.getUint8(i) << shift);
    }, 0);
  }

  encode() {
    return Base64.encode(Buffer.from(this.buffer).toString("hex"));
  }
}

CompressedSet.decode = function decode(encodedDigest) {
  const digest = Base64.decode(encodedDigest);
  const byteLength = digest.length / 2;
  const arrayBuf = new ArrayBuffer(byteLength);
  const view = new DataView(arrayBuf);
  for (let i = 0; i < byteLength; i += 2) {
    const chars = digest[i] + digest[i + 1];
    view.setUint8(i, parseInt(chars, 16));
  }
  return new CompressedSet(arrayBuf);
};

CompressedSet.hash = function(v) {
  return MurmurHash3(v).result();
};

module.exports = CompressedSet;

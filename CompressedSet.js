const MurmurHash3 = require("imurmurhash");
const URLSafeBase64 = require("urlsafe-base64");

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
 * [ 2 bytes for the value count ][ 1 bytes for bytes per value ][ the rest are entries ]
 */

const Base64 = {
  encode: s => URLSafeBase64.encode(Buffer.from(s, "utf8")),
  decode: s => URLSafeBase64.decode(s).toString("ascii")
};

class CompressedSet {
  constructor(buffer) {
    const bufferByteLength =
      CompressedSet.NUM_VALUES_BYTES +
      CompressedSet.BYTES_PER_VALUE_BYTES +
      CompressedSet.DEFAULT_NUM_VALUES * CompressedSet.DEFAULT_BYTES_PER_VALUE;

    if (buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new TypeError(
          "First argument to CompressedSet constructor must be an ArrayBuffer"
        );
      }

      if (buffer.byteLength !== bufferByteLength) {
        throw new TypeError(
          `ArrayBuffer argument to CompressedSet constructor must have byteLength of ${bufferByteLength}`
        );
      }
    }

    this.buffer = buffer || new ArrayBuffer(bufferByteLength);
    this.numValuesView = new DataView(
      this.buffer,
      0,
      CompressedSet.NUM_VALUES_BYTES
    );
    this.bytesPerValueView = new DataView(
      this.buffer,
      CompressedSet.NUM_VALUES_BYTES,
      CompressedSet.BYTES_PER_VALUE_BYTES
    );
    this.valuesView = new DataView(
      this.buffer,
      CompressedSet.NUM_VALUES_BYTES + CompressedSet.BYTES_PER_VALUE_BYTES
    );

    if (!buffer) {
      this.numValuesView.setUint16(0, CompressedSet.DEFAULT_NUM_VALUES);
    }
    if (!buffer) {
      this.bytesPerValueView.setUint8(0, CompressedSet.DEFAULT_BYTES_PER_VALUE);
    }

    this.indexMask = this.numValues - 1;
    this.valueMask = Math.pow(2, this.bytesPerValue * 8) - 1;
  }

  get numValues() {
    return this.numValuesView.getUint16(0);
  }

  get bytesPerValue() {
    return this.bytesPerValueView.getUint8(0);
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

  encode() {
    return Base64.encode(Buffer.from(this.buffer).toString("hex"));
  }
}

CompressedSet.NUM_VALUES_BYTES = 2;
CompressedSet.BYTES_PER_VALUE_BYTES = 1;
CompressedSet.DEFAULT_NUM_VALUES = 256;
CompressedSet.DEFAULT_BYTES_PER_VALUE = 3;

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

class NibbleView {
  constructor(buffer, startByte) {
    this.view = new DataView(buffer, startByte, 1);
  }

  getFirst() {
    return this.view.getUint8(0) >> 4;
  }

  getSecond() {
    return this.view.getUint8(0) & (255 >> 4);
  }

  setFirst(v) {
    return this.view.setUint8(0, ((v << 4) | this.getSecond()) & 255);
  }

  setSecond(v) {
    return this.view.setUint8(0, (this.getFirst() << 4) | (v & 15));
  }
}

module.exports = NibbleView;

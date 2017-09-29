const CompressedSet = require("./CompressedSet");

describe("basic operation", () => {
  test("it can be initialized", () => {
    new CompressedSet();
  });

  test("it does not contain anything by default", () => {
    const set = new CompressedSet();
    expect(set.contains("a")).toBe(false);
  });

  test("it can contain a value", () => {
    const set = new CompressedSet();
    set.add("a");
    expect(set.contains("a")).toBe(true);
  });

  test("it can contain multiple values", () => {
    const values = ["a", "b", "c", "d"];
    const set = new CompressedSet();
    values.forEach(v => set.add(v));
    values.forEach(v => {
      expect(set.contains(v)).toBe(true);
    });
  });

  test("items can be removed", () => {
    const set = new CompressedSet();
    set.add("a");
    expect(set.contains("a")).toBe(true);
    set.remove("a");
    expect(set.contains("a")).toBe(false);
  });

  it('does not accept non-strings', () => {
    const set = new CompressedSet();
    expect(() => set.add(false)).toThrow();
    expect(() => set.add(true)).toThrow();
    expect(() => set.add({})).toThrow();
    expect(() => set.add([])).toThrow();
    expect(() => set.add(10)).toThrow();
  });

  test("it can be initialized with an ArrayBuffer", () => {
    const set = new CompressedSet();
    set.add("a");
    const copy = new CompressedSet(set.buffer);
    expect(copy.contains("a")).toBe(true);
  });

  test("it throws when initialized with something other than an ArrayBuffer", () => {
    expect(() => new CompressedSet([])).toThrow();
    expect(() => new CompressedSet({})).toThrow();
    expect(() => new CompressedSet(true)).toThrow();
    expect(() => new CompressedSet("bacon")).toThrow();
  });

  test("it throws a relevant error message when initialized with a non-ArrayBuffer", () => {
    expect(() => new CompressedSet([])).toThrow(
      "First argument to CompressedSet constructor must be an ArrayBuffer"
    );
  });

  test("it throws a relevant error message if ArrayBuffer is the wrong length", () => {
    const buf = new ArrayBuffer(1);
    expect(() => new CompressedSet(buf)).toThrow(
      "ArrayBuffer argument to CompressedSet constructor must have a byteLength of at least 2"
    );
  });
});

describe("encode + decode", () => {
  test("it is encodable when empty", () => {
    const set = new CompressedSet();
    expect(set.encode()).toBeTruthy();
  });

  test("it is encodable with a value", () => {
    const set = new CompressedSet();
    set.add("a");
    expect(set.encode()).toBeTruthy();
  });

  test("it holds the same properties when decoded from an encoding", () => {
    const set = new CompressedSet();
    set.add("a");
    const decoded = CompressedSet.decode(set.encode());
    expect(decoded.contains("a")).toBe(true);
  });
});

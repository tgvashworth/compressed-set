const URLSafeBase64 = require("urlsafe-base64");

module.exports = {
  encode: s => URLSafeBase64.encode(Buffer.from(s, "utf8")),
  decode: s => URLSafeBase64.decode(s).toString("ascii")
};


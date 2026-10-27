// Invisible Ink — hide a secret message inside ordinary text using zero-width
// characters. Optional password enables AES-256-GCM encryption (PBKDF2 key).
//
// Wire format (shared byte-for-byte with the web version so each can read the
// other's output):
//   [0..2)  magic   = 0x49 0x4B  ("IK")
//   [2]     version = 1
//   [3]     flag    = 0 plain | 1 encrypted
//   payload:
//     plain      -> deflateRaw(secret)
//     encrypted  -> salt(16) | iv(12) | AES-256-GCM(deflateRaw(secret))  (ct ends with the 16-byte tag)
// Compression: raw DEFLATE (matches the browser's CompressionStream "deflate-raw").
// Key: PBKDF2-SHA256, 200000 iterations, 32-byte key.
const crypto = require("crypto");
const zlib = require("zlib");

const ALPHABET = ["​", "‌", "‍", "⁠"]; // 2 bits each
const INVISIBLE_RE = /[​‌‍⁠]/g;

const MAGIC = [0x49, 0x4b];
const VERSION = 1;
const FLAG_PLAIN = 0;
const FLAG_ENCRYPTED = 1;
const PBKDF2_ROUNDS = 200000;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, 32, "sha256");
}

function encrypt(data, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(password, salt), iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([salt, iv, body, cipher.getAuthTag()]);
}

function decrypt(data, password) {
  const salt = data.subarray(0, 16);
  const iv = data.subarray(16, 28);
  const tag = data.subarray(data.length - 16);
  const body = data.subarray(28, data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(password, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error("Нууц үг буруу, эсвэл мессеж өөрчлөгдсөн байна");
  }
}

function bytesToInvisible(buf) {
  let out = "";
  for (const byte of buf) {
    for (let shift = 6; shift >= 0; shift -= 2) out += ALPHABET[(byte >> shift) & 3];
  }
  return out;
}

function invisibleToBytes(str) {
  if (str.length % 4 !== 0) throw new Error("Нуугдсан өгөгдөл дутуу байна");
  const buf = Buffer.alloc(str.length / 4);
  for (let i = 0; i < buf.length; i++) {
    let byte = 0;
    for (let j = 0; j < 4; j++) {
      const v = ALPHABET.indexOf(str[i * 4 + j]);
      if (v < 0) throw new Error("Нуугдсан өгөгдөлд гэнэтийн тэмдэгт оржээ");
      byte = (byte << 2) | v;
    }
    buf[i] = byte;
  }
  return buf;
}

function hide(secret, cover, password) {
  if (!secret) throw new Error("Нууц мессеж хоосон байж болохгүй");
  if (!cover.trim()) throw new Error("Далд текст хоосон байж болохгүй");
  let payload = zlib.deflateRawSync(Buffer.from(secret, "utf8"));
  const flag = password ? FLAG_ENCRYPTED : FLAG_PLAIN;
  if (password) payload = encrypt(payload, password);
  const header = Buffer.from([...MAGIC, VERSION, flag]);
  const invisible = bytesToInvisible(Buffer.concat([header, payload]));

  // Tuck the hidden run right after the first word so it survives trimming.
  const space = cover.indexOf(" ");
  const at = space === -1 ? cover.length : space;
  return cover.slice(0, at) + invisible + cover.slice(at);
}

function reveal(text, password) {
  const hidden = (text.match(INVISIBLE_RE) || []).join("");
  if (!hidden) throw new Error("Нуугдсан мессеж олдсонгүй");
  const data = invisibleToBytes(hidden);
  if (data.length < 4 || data[0] !== MAGIC[0] || data[1] !== MAGIC[1]) {
    throw new Error("Энэ нь Нууц Бэх-ийн мессеж биш бололтой");
  }
  if (data[2] !== VERSION) throw new Error(`Дэмжигдээгүй хувилбар (${data[2]})`);
  const flag = data[3];
  let payload = data.subarray(4);
  if (flag === FLAG_ENCRYPTED) {
    if (!password) throw new Error("Энэ мессеж шифрлэгдсэн — нууц үгээ оруулна уу");
    payload = decrypt(payload, password);
  } else if (flag !== FLAG_PLAIN) {
    throw new Error("Үл мэдэгдэх мессежийн формат");
  }
  return zlib.inflateRawSync(payload).toString("utf8");
}

function clean(text) {
  return text.replace(INVISIBLE_RE, "");
}

module.exports = { hide, reveal, clean };

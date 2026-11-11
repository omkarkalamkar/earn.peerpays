const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.CARD_ENC_KEY || '';
  if (hex.length !== 64) {
    throw new Error(
      'CARD_ENC_KEY must be a 64-char hex string (32 bytes). Generate with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts plaintext -> "iv:tag:ciphertext" (all hex). */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

/** Decrypts "iv:tag:ciphertext" back to plaintext. */
function decrypt(payload) {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = String(payload).split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

/** Masks a card number for display, keeping only the last 4 digits. */
function maskCardNumber(number) {
  const digits = String(number).replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
}

module.exports = { encrypt, decrypt, maskCardNumber };

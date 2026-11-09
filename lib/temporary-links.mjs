import { createHash, randomBytes } from 'node:crypto';

export const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');

export function validatePrintPayload(body) {
  if (!body || typeof body !== 'object') return false;
  const { dataUrls, pw, ph, rotated, copies } = body;
  const dimension = value => typeof value === 'string' && /^\d+(\.\d{1,4})?cm$/.test(value)
    && parseFloat(value) >= 1 && parseFloat(value) <= 28;
  if (!dimension(pw) || !dimension(ph) || typeof rotated !== 'boolean'
    || !Number.isInteger(copies) || copies < 1 || copies > 10
    || !Array.isArray(dataUrls) || dataUrls.length < 1 || dataUrls.length > 4) return false;
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_PAYLOAD_BYTES) return false;
  return dataUrls.every(url => {
    if (typeof url !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return false;
    const bytes = Buffer.from(url.slice(22), 'base64');
    return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      && bytes.toString('ascii', 12, 16) === 'IHDR'
      && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 6000
      && bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 6000;
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  verifyC2pa, parseCertificate, parseJumbf, extractC2paPayload, decodeCbor, hashWithExclusions, C2PA_STATES,
} from '../packages/core/c2pa.js';

const fixture = name => new Uint8Array(readFileSync(new URL(`./fixtures/c2pa/${name}`, import.meta.url)));
const trust = JSON.parse(readFileSync(new URL('./fixtures/c2pa/trust.json', import.meta.url), 'utf8'));

test('c2pa: ảnh không có C2PA → not_detected', async () => {
  const plain = new Uint8Array(readFileSync(new URL('./fixtures/c2pa/signed.png', import.meta.url)));
  const result = await verifyC2pa(plain.subarray(0, 8));
  assert.equal(result.state, C2PA_STATES.NOT_DETECTED);
  assert.equal(result.found, false);
});

test('c2pa: fixture tự ký có chữ ký ES256 hợp lệ và hash khớp', async () => {
  const result = await verifyC2pa(fixture('signed.png'));
  assert.equal(result.found, true);
  assert.equal(result.container, 'png');
  assert.equal(result.signatureValid, true, result.errors.join(' | '));
  assert.equal(result.hashValid, true, result.errors.join(' | '));
  assert.equal(result.signer, 'Trace Cleaner Test');
  assert.equal(result.issuer, 'Trace Cleaner Test');
  assert.equal(result.claimGenerator, 'TraceCleanerTest/1.0');
  assert.equal(result.assertionCount, 1);
});

test('c2pa: chữ ký hợp lệ nhưng signer không nằm trong trust store', async () => {
  const result = await verifyC2pa(fixture('signed.png'));
  assert.equal(result.state, C2PA_STATES.SIGNATURE_VALID_UNTRUSTED);
  assert.equal(result.trusted, false);
  assert.equal(result.trustPolicy, 'none');
});

test('c2pa: ghim fingerprint → signature_valid_pinned, không phải PKI', async () => {
  const result = await verifyC2pa(fixture('signed.png'), {
    trustedFingerprints: [trust.fingerprintSha256],
  });
  assert.equal(result.state, C2PA_STATES.SIGNATURE_VALID_PINNED);
  assert.equal(result.pinned, true);
  assert.equal(result.chainStatus, 'not_evaluated');
  assert.equal(result.trusted, true);
  assert.equal(result.trustPolicy, 'explicit');
});

test('c2pa: trust store nhận chứng chỉ PEM/DER, không chỉ fingerprint', async () => {
  const pem = trust.certPem;
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = new Uint8Array(Buffer.from(base64, 'base64'));
  const result = await verifyC2pa(fixture('signed.png'), { trustedCertificates: [der] });
  assert.equal(result.state, C2PA_STATES.SIGNATURE_VALID_PINNED);
  assert.equal(result.pinned, true);
  assert.equal(result.chainStatus, 'not_evaluated');
});

test('c2pa: asset bị sửa sau khi ký → phát hiện tampered', async () => {
  const result = await verifyC2pa(fixture('tampered-asset.png'), {
    trustedFingerprints: [trust.fingerprintSha256],
  });
  assert.equal(result.signatureValid, true);
  assert.equal(result.hashValid, false);
  assert.equal(result.state, C2PA_STATES.TAMPERED);
  assert.match(result.errors.join(' '), /hard binding/);
});

test('c2pa: chữ ký bị sửa → signature_invalid', async () => {
  const result = await verifyC2pa(fixture('bad-signature.png'));
  assert.equal(result.signatureValid, false);
  assert.equal(result.state, C2PA_STATES.SIGNATURE_INVALID);
});

test('c2pa: assertion bị đổi nhưng claim ký hash khác → manifest_invalid', async () => {
  const result = await verifyC2pa(fixture('bad-assertion-hash.png'));
  assert.equal(result.signatureValid, true);
  assert.equal(result.state, C2PA_STATES.MANIFEST_INVALID);
  assert.match(result.errors.join(' '), /assertion/);
});

test('c2pa: parseCertificate đọc subject/issuer/hiệu lực/SPKI', async () => {
  const base64 = trust.certPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = new Uint8Array(Buffer.from(base64, 'base64'));
  const cert = await parseCertificate(der);
  assert.equal(cert.subject.CN, 'Trace Cleaner Test');
  assert.equal(cert.subject.O, 'Trace Cleaner');
  assert.ok(cert.notBefore && cert.notAfter);
  assert.ok(Date.parse(cert.notAfter) > Date.now());
  assert.ok(cert.spkiDer.length > 50);
  assert.equal(cert.fingerprintSha256, trust.fingerprintSha256);
});

test('c2pa: JUMBF tree có label c2pa và manifest urn:uuid', async () => {
  const payload = extractC2paPayload(fixture('signed.png'));
  assert.equal(payload.found, true);
  const boxes = parseJumbf(payload.payload);
  const labels = [];
  const walk = list => list.forEach(box => { if (box.label) labels.push(box.label); if (box.children) walk(box.children); });
  walk(boxes);
  assert.ok(labels.includes('c2pa'));
  assert.ok(labels.some(label => label.startsWith('urn:uuid:')));
  assert.ok(labels.includes('c2pa.hash.data'));
});

test('c2pa: decoder CBOR đọc map lồng nhau', () => {
  // {"a": 1, "b": [true, -2]}
  const bytes = Uint8Array.of(0xA2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x82, 0xF5, 0x21);
  const decoded = decodeCbor(bytes).value;
  assert.equal(decoded.get('a'), 1);
  assert.deepEqual(decoded.get('b'), [true, -2]);
});

test('c2pa: không bao giờ coi signature hợp lệ là "đã xác minh" khi thiếu trust', async () => {
  const result = await verifyC2pa(fixture('signed.png'));
  assert.notEqual(result.state, C2PA_STATES.VERIFIED_TRUSTED);
  assert.notEqual(result.state, C2PA_STATES.NOT_DETECTED);
});

/* ── Adversarial C2PA/CBOR ───────────────────────────────────────── */

function u32(value) {
  return Uint8Array.of((value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF);
}

function pngChunk(type, data) {
  return concatTest([u32(data.length), new TextEncoder().encode(type), data, u32(0)]);
}

function concatTest(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

function jumbBox(type, payload, declared) {
  const length = declared ?? payload.length + 8;
  return concatTest([u32(length), new TextEncoder().encode(type), payload]);
}

function jumdPayload(label) {
  const uuid = new Uint8Array(16).fill(1);
  return concatTest([uuid, Uint8Array.of(3), new TextEncoder().encode(label), Uint8Array.of(0)]);
}

test('c2pa: CBOR từ chối depth, collection, chuỗi và trailing data', () => {
  const deep = new Uint8Array(30).fill(0x81);
  deep[29] = 0x00;
  assert.throws(() => decodeCbor(deep), error => error.reason === 'cbor_too_deep');
  assert.throws(() => decodeCbor(Uint8Array.of(0x9A, 0xFF, 0xFF, 0xFF, 0xFF)), error => error.reason === 'cbor_collection_too_large');
  assert.throws(() => decodeCbor(Uint8Array.of(0xBA, 0xFF, 0xFF, 0xFF, 0xFF)), error => error.reason === 'cbor_collection_too_large');
  assert.throws(() => decodeCbor(Uint8Array.of(0x5A, 0x00, 0x10, 0x00, 0x01)), error => error.reason === 'cbor_string_too_large');
  assert.throws(() => decodeCbor(Uint8Array.of(0x61, 0xFF)), error => error.reason === 'cbor_invalid_utf8');
  assert.throws(() => decodeCbor(Uint8Array.of(0x5F, 0x41, 0x00)), error => /cbor_/.test(error.reason));
  assert.throws(() => decodeCbor(Uint8Array.of(0xA2, 0x61)), error => error.reason === 'cbor_truncated');
  assert.throws(() => decodeCbor(Uint8Array.of(0x01, 0x02), 0, { requireComplete: true }), error => error.reason === 'cbor_trailing_data');
  assert.throws(() => decodeCbor(Uint8Array.of(0xA2, 0x61, 0x61, 0x01, 0x61, 0x61, 0x02)), error => error.reason === 'cbor_duplicate_key');
});

test('c2pa: JUMBF từ chối length sai, quá nhiều box, lồng quá sâu', () => {
  assert.throws(() => parseJumbf(jumbBox('jumb', new Uint8Array(0), 4)), error => /JUMBF/.test(error.message));
  const three = concatTest([jumbBox('free', new Uint8Array(0)), jumbBox('free', new Uint8Array(0)), jumbBox('free', new Uint8Array(0))]);
  assert.throws(() => parseJumbf(three, { maxBoxes: 2 }), error => error.reason === 'jumbf_too_many_boxes');
  let nested = jumbBox('jumd', jumdPayload('x'));
  for (let i = 0; i < 14; i++) nested = jumbBox('jumb', nested);
  assert.throws(() => parseJumbf(nested), error => error.reason === 'jumbf_too_deep');
  assert.throws(() => parseJumbf(jumbBox('jumd', Uint8Array.of(1))), error => error.reason === 'jumbf_invalid');
});

test('c2pa: PNG caBX vượt biên hoặc quá lớn bị từ chối', async () => {
  const signature = Uint8Array.of(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
  const truncated = concatTest([signature, u32(100), new TextEncoder().encode('caBX'), new Uint8Array(10)]);
  assert.equal(extractC2paPayload(truncated).invalid, 'truncated_chunk');
  const oversized = concatTest([signature, u32(4 * 1024 * 1024 + 1), new TextEncoder().encode('caBX'), new Uint8Array(0)]);
  assert.equal(extractC2paPayload(oversized).invalid, 'manifest_too_large');
  const verify = await verifyC2pa(truncated);
  assert.equal(verify.state, C2PA_STATES.MANIFEST_INVALID);
});

test('c2pa: JPEG cộng dồn nhiều APP11 vượt ngân sách bị từ chối', async () => {
  const chunk = new Uint8Array(60 * 1024);
  const segment = concatTest([Uint8Array.of(0xFF, 0xEB, 0x00, 0x00), Uint8Array.of(0x4A, 0x50), chunk]);
  const length = segment.length - 2;
  segment[2] = (length >> 8) & 0xFF;
  segment[3] = length & 0xFF;
  const parts = [Uint8Array.of(0xFF, 0xD8)];
  for (let i = 0; i < 120; i++) parts.push(segment);
  parts.push(Uint8Array.of(0xFF, 0xD9));
  const jpeg = concatTest(parts);
  assert.equal(extractC2paPayload(jpeg).invalid, 'manifest_too_large');
  assert.equal((await verifyC2pa(jpeg)).state, C2PA_STATES.MANIFEST_INVALID);
});

test('c2pa: DER length vượt biên bị từ chối', async () => {
  await assert.rejects(() => parseCertificate(Uint8Array.of(0x30, 0x84, 0xFF, 0xFF, 0xFF, 0xFF)));
});

test('c2pa: exclusion sai, chồng lấn hoặc thuật toán lạ bị từ chối', async () => {
  const asset = new Uint8Array(100);
  await assert.rejects(() => hashWithExclusions(asset, [{ start: 90, length: 20 }]), error => error.reason === 'invalid_exclusions');
  await assert.rejects(() => hashWithExclusions(asset, [{ start: -1, length: 2 }]), error => error.reason === 'invalid_exclusions');
  await assert.rejects(() => hashWithExclusions(asset, [{ start: 0, length: 20 }, { start: 10, length: 20 }]), error => error.reason === 'invalid_exclusions');
  await assert.rejects(() => hashWithExclusions(asset, [], 'md5'), error => error.reason === 'unsupported_hash_algorithm');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  verifyC2pa, parseCertificate, parseJumbf, extractC2paPayload, decodeCbor, C2PA_STATES,
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

test('c2pa: trust store tường minh → verified_trusted', async () => {
  const result = await verifyC2pa(fixture('signed.png'), {
    trustedFingerprints: [trust.fingerprintSha256],
  });
  assert.equal(result.state, C2PA_STATES.VERIFIED_TRUSTED);
  assert.equal(result.trusted, true);
  assert.equal(result.trustPolicy, 'explicit');
});

test('c2pa: trust store nhận chứng chỉ PEM/DER, không chỉ fingerprint', async () => {
  const pem = trust.certPem;
  const base64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = new Uint8Array(Buffer.from(base64, 'base64'));
  const result = await verifyC2pa(fixture('signed.png'), { trustedCertificates: [der] });
  assert.equal(result.state, C2PA_STATES.VERIFIED_TRUSTED);
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

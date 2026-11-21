#!/usr/bin/env node
/**
 * tools/make_c2pa_fixture.mjs — sinh fixture C2PA thật (ES256 + X.509 tự ký).
 *
 * Fixture dùng để test `packages/core/c2pa.js`: chữ ký được tạo bằng private key
 * tạm (không commit), và chỉ file PNG đã ký được commit. Vì vậy test chứng minh
 * được việc xác minh chữ ký thật, không phải so chuỗi.
 *
 *   node tools/make_c2pa_fixture.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, sign } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'fixtures', 'c2pa');
const work = mkdtempSync(join(tmpdir(), 'trace-c2pa-'));

/* ── CBOR encoder tối thiểu (chỉ cho fixture) ── */
const major = (type, value) => {
  if (value < 24) return Uint8Array.of((type << 5) | value);
  if (value < 256) return Uint8Array.of((type << 5) | 24, value);
  if (value < 65536) return Uint8Array.of((type << 5) | 25, value >> 8, value & 0xFF);
  return Uint8Array.of((type << 5) | 26, (value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF);
};
const cborBytes = bytes => concat([major(2, bytes.length), bytes]);
const cborText = text => { const bytes = new TextEncoder().encode(text); return concat([major(3, bytes.length), bytes]); };
const cborInt = value => (value >= 0 ? major(0, value) : major(1, -1 - value));
const cborArray = items => concat([major(4, items.length), ...items]);
const cborMap = entries => concat([major(5, entries.length), ...entries.flatMap(([key, value]) => [key, value])]);
const cborTag = (tag, value) => concat([major(6, tag), value]);

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

const u32 = value => Uint8Array.of((value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF);

function jumbBox(type, payload) {
  return concat([u32(8 + payload.length), new TextEncoder().encode(type), payload]);
}

function jumdBox(label) {
  const uuid = new Uint8Array(16);
  for (let i = 0; i < 16; i++) uuid[i] = i + 1;
  return jumbBox('jumd', concat([uuid, Uint8Array.of(0x03), new TextEncoder().encode(label), Uint8Array.of(0)]));
}

function pngChunk(type, data) {
  return concat([u32(data.length), new TextEncoder().encode(type), data, u32(crc32(concat([new TextEncoder().encode(type), data])))]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function main() {
  execFileSync('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', join(work, 'key.pem')]);
  execFileSync('openssl', ['req', '-new', '-x509', '-key', join(work, 'key.pem'), '-out', join(work, 'cert.pem'),
    '-days', '3650', '-subj', '/CN=Trace Cleaner Test/O=Trace Cleaner', '-sha256']);
  execFileSync('openssl', ['x509', '-in', join(work, 'cert.pem'), '-outform', 'DER', '-out', join(work, 'cert.der')]);
  const key = readFileSync(join(work, 'key.pem'), 'utf8');
  const certDer = new Uint8Array(readFileSync(join(work, 'cert.der')));
  const fingerprint = createHash('sha256').update(certDer).digest('hex');

  const pixels = new Uint8Array(4); // 1x1 RGBA
  const rawScanline = concat([Uint8Array.of(0), pixels]);
  const idat = await deflate(rawScanline);
  const ihdr = concat([u32(1), u32(1), Uint8Array.of(8, 6, 0, 0, 0)]);
  const head = concat([
    Uint8Array.of(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
  ]);
  const tail = pngChunk('IEND', new Uint8Array(0));

  const build = async ({ tamperSignature = false, tamperAsset = false, violateAssertion = false } = {}) => {
    const hexToBytes = hex => new Uint8Array(hex.match(/../g).map(pair => parseInt(pair, 16)));
    const caBXAt = head.length;

    // Dựng manifest với exclusion length cho trước. Độ dài chunk phụ thuộc
    // exclusion length (CBOR integer), nên lặp tới khi ổn định.
    const buildWith = async (digestHex, exclusionLength, assertionHashOverride) => {
      const assertion = cborMap([
        [cborText('alg'), cborText('sha256')],
        [cborText('exclusions'), cborArray([cborMap([
          [cborText('start'), cborInt(caBXAt)],
          [cborText('length'), cborInt(exclusionLength)],
        ])])],
        [cborText('hash'), cborBytes(hexToBytes(digestHex))],
      ]);
      const assertionHash = assertionHashOverride || createHash('sha256').update(assertion).digest();
      const claim = cborMap([
        [cborText('claim_generator'), cborText('TraceCleanerTest/1.0')],
        [cborText('dc:format'), cborText('image/png')],
        [cborText('assertions'), cborArray([
          cborMap([
            [cborText('url'), cborText('self#jumbf=c2pa.assertions/c2pa.hash.data')],
            [cborText('hash'), cborBytes(assertionHash)],
          ]),
        ])],
      ]);
      const protectedHeader = cborMap([[cborInt(1), cborInt(-7)]]);
      const unprotected = cborMap([[cborInt(33), cborArray([cborBytes(certDer)])]]);
      const sigStructure = cborArray([
        cborText('Signature1'), cborBytes(protectedHeader), cborBytes(new Uint8Array(0)), cborBytes(claim),
      ]);
      let signature = new Uint8Array(sign('sha256', sigStructure, { key, dsaEncoding: 'ieee-p1363' }));
      if (tamperSignature) signature = Uint8Array.from(signature, (byte, index) => (index === 0 ? byte ^ 0xFF : byte));
      const cose = cborTag(18, cborArray([cborBytes(protectedHeader), unprotected, cborBytes(claim), cborBytes(signature)]));

      const assertionBox = jumbBox('jumb', concat([jumdBox('c2pa.hash.data'), jumbBox('cbor', assertion)]));
      const claimBox = jumbBox('jumb', concat([jumdBox('c2pa.claim'), jumbBox('cbor', claim)]));
      const signatureBox = jumbBox('jumb', concat([jumdBox('c2pa.signature'), jumbBox('cbor', cose)]));
      const assertionStore = jumbBox('jumb', concat([jumdBox('c2pa.assertions'), assertionBox]));
      const manifest = jumbBox('jumb', concat([
        jumdBox('urn:uuid:6f2a1c33-4b7e-4b1e-9a5a-1d3f5b7c9e11'),
        assertionStore, claimBox, signatureBox,
      ]));
      return jumbBox('jumb', concat([jumdBox('c2pa'), manifest]));
    };

    let exclusionLength = 2000;
    let caBX = await buildWith('0'.repeat(64), exclusionLength);
    for (let pass = 0; pass < 8; pass++) {
      const size = 12 + caBX.length;
      if (size === exclusionLength) break;
      exclusionLength = size;
      caBX = await buildWith('0'.repeat(64), exclusionLength);
    }

    const withPlaceholder = concat([head, pngChunk('caBX', caBX), tail]);
    const signedRegion = concat([
      withPlaceholder.slice(0, caBXAt),
      withPlaceholder.slice(caBXAt + exclusionLength),
    ]);
    const digest = createHash('sha256').update(signedRegion).digest('hex');
    const assertionHash = violateAssertion
      ? createHash('sha256').update(cborMap([
        [cborText('alg'), cborText('sha256')],
        [cborText('exclusions'), cborArray([cborMap([
          [cborText('start'), cborInt(caBXAt)],
          [cborText('length'), cborInt(exclusionLength)],
        ])])],
        [cborText('hash'), cborBytes(hexToBytes(digest))],
      ])).digest()
      : undefined;
    if (violateAssertion) {
      // Claim ký hash sai: chữ ký vẫn hợp lệ nhưng assertion không khớp.
      const wrong = createHash('sha256').update('sai').digest();
      caBX = await buildWith(digest, exclusionLength, wrong);
    } else {
      caBX = await buildWith(digest, exclusionLength, assertionHash);
    }
    let full = concat([head, pngChunk('caBX', caBX), tail]);
    if (tamperAsset) {
      // Sửa 1 byte trong IDAT (ngoài vùng bị loại trừ) → hard-binding phải lệch,
      // còn chữ ký trên manifest vẫn hợp lệ.
      const idatAt = full.indexOf(0x49); // 'I' của IHDR không phải IDAT; tìm chuỗi chính xác:
      const marker = new TextEncoder().encode('IDAT');
      let index = -1;
      for (let at = 0; at + 4 < full.length; at++) {
        if (full[at] === marker[0] && full[at + 1] === marker[1] && full[at + 2] === marker[2] && full[at + 3] === marker[3]) { index = at + 7; break; }
      }
      if (index < 0 || idatAt < 0) throw new Error('fixture: không tìm thấy IDAT');
      full = Uint8Array.from(full, (byte, at) => (at === index ? byte ^ 0x01 : byte));
    }
    return full;
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'signed.png'), await build());
  writeFileSync(join(OUT, 'tampered-asset.png'), await build({ tamperAsset: true }));
  writeFileSync(join(OUT, 'bad-signature.png'), await build({ tamperSignature: true }));
  writeFileSync(join(OUT, 'bad-assertion-hash.png'), await build({ violateAssertion: true }));
  writeFileSync(join(OUT, 'trust.json'), JSON.stringify({
    fingerprintSha256: fingerprint,
    certPem: readFileSync(join(work, 'cert.pem'), 'utf8'),
    generatedBy: 'tools/make_c2pa_fixture.mjs',
    note: 'Private key chỉ tồn tại trong thư mục tạm và đã bị xoá; fixture chỉ dùng để test xác minh chữ ký.',
  }, null, 2));
  console.log('wrote fixture vào', OUT, '· fingerprint', fingerprint);
}

try {
  await main();
} finally {
  rmSync(work, { recursive: true, force: true });
}

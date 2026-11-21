import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseXml, attr, child, childrenOf, descendants, textContent, XML_ERRORS,
} from '../packages/core/xml.js';
import { PARSER_LIMITS } from '../packages/core/limits.js';

const limits = (over = {}) => ({ ...PARSER_LIMITS, ...over });

test('xml: parse document có thuộc tính và thứ tự con', () => {
  const { root, stats } = parseXml('<w:document xmlns:w="x"><w:p w:val="1">Xin chào</w:p><w:p>Hai</w:p></w:document>');
  assert.equal(root.name, 'w:document');
  assert.equal(root.localName, 'document');
  const paras = childrenOf(root, 'w:p');
  assert.equal(paras.length, 2);
  assert.equal(attr(paras[0], 'w:val'), '1');
  assert.equal(textContent(root).trim(), 'Xin chào\nHai');
  assert.equal(stats.nodes, 3);
});

test('xml: số dòng của element đúng và tăng dần (không quét lại từ đầu)', () => {
  const { root } = parseXml('<r>\n<a/>\n<b><c/></b>\n</r>');
  const [a, b] = root.children.filter(item => typeof item !== 'string');
  assert.equal(root.line, 1);
  assert.equal(a.line, 2);
  assert.equal(b.line, 3);
  assert.equal(b.children[0].line, 3);
});

test('xml: giải mã entity định nghĩa sẵn và tham chiếu số', () => {
  const { root } = parseXml('<a t="&quot;x&quot;">A &amp; B &#65; &#x1F600; &lt;tag&gt;</a>');
  assert.equal(root.attrs.t, '"x"');
  assert.equal(textContent(root), 'A & B A 😀 <tag>');
});

test('xml: CDATA được giữ nguyên, không giải mã', () => {
  const { root } = parseXml('<a><![CDATA[<b>&amp;</b>]]></a>');
  assert.equal(textContent(root), '<b>&amp;</b>');
});

test('xml: comment và processing instruction bị bỏ qua', () => {
  const { root } = parseXml('<?xml version="1.0"?><!-- c --><a>x<!-- y -->z</a>');
  assert.equal(textContent(root), 'xz');
});

test('xml: thẻ chưa đóng bị từ chối', () => {
  assert.throws(() => parseXml('<a><b></a>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: nhiều root bị từ chối', () => {
  assert.throws(() => parseXml('<a/><b/>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: text ngoài root bị từ chối', () => {
  assert.throws(() => parseXml('chào <a/>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: thuộc tính trùng bị từ chối', () => {
  assert.throws(() => parseXml('<a x="1" x="2"/>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: thuộc tính thiếu quote bị từ chối', () => {
  assert.throws(() => parseXml('<a x=1/>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: DOCTYPE bị từ chối trước khi parse', () => {
  assert.throws(
    () => parseXml('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a>&xxe;</a>'),
    error => error.reason === XML_ERRORS.DOCTYPE,
  );
});

test('xml: khai báo ENTITY riêng lẻ bị từ chối', () => {
  assert.throws(() => parseXml('<!ENTITY lol "lol"><a/>'), error => error.reason === XML_ERRORS.ENTITY);
});

test('xml: entity lạ bị từ chối, không im lặng bỏ qua', () => {
  assert.throws(() => parseXml('<a>&xxe;</a>'), error => error.reason === XML_ERRORS.UNKNOWN_ENTITY);
});

test('xml: entity không đóng bị từ chối', () => {
  assert.throws(() => parseXml('<a>&amp</a>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: độ sâu vượt giới hạn bị chặn', () => {
  const deep = '<a>'.repeat(80) + '</a>'.repeat(80);
  assert.throws(() => parseXml(deep, { limits: limits({ maxXmlDepth: 10 }) }), error => error.reason === XML_ERRORS.TOO_DEEP);
});

test('xml: số node vượt giới hạn bị chặn', () => {
  const body = Array.from({ length: 30 }, (_, i) => `<i>${i}</i>`).join('');
  assert.throws(
    () => parseXml(`<a>${body}</a>`, { limits: limits({ maxXmlNodes: 10 }) }),
    error => error.reason === XML_ERRORS.TOO_MANY_NODES,
  );
});

test('xml: kích thước vượt giới hạn bị chặn', () => {
  assert.throws(
    () => parseXml('<a>' + 'x'.repeat(500) + '</a>', { limits: limits({ maxXmlBytes: 100 }) }),
    error => error.reason === XML_ERRORS.TOO_LARGE,
  );
});

test('xml: < trong giá trị thuộc tính bị từ chối', () => {
  assert.throws(() => parseXml('<a x="<b>"/>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: descendants tìm theo localName', () => {
  const { root } = parseXml('<w:document><w:body><w:p><w:r><w:t>a</w:t></w:r></w:p></w:body></w:document>');
  assert.equal(descendants(root, 't').length, 1);
  assert.equal(descendants(root, 'w:t').length, 1);
  assert.ok(child(root, 'w:body'));
});

test('xml: textContent tách đoạn và tab trong w:p', () => {
  const { root } = parseXml('<w:body><w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t></w:r></w:p><w:p><w:r><w:t>C</w:t></w:r></w:p></w:body>');
  assert.equal(textContent(root), 'A\tB\nC\n');
});

test('xml: element rỗng tự đóng không tăng depth', () => {
  const { stats } = parseXml('<a><b/><c/></a>');
  assert.equal(stats.depth, 1);
});

test('xml: giới hạn byte là UTF-8 thật, không phải độ dài chuỗi', () => {
  assert.throws(() => parseXml('<r>ééé</r>', { maxBytes: 12 }), error => error.reason === XML_ERRORS.TOO_LARGE);
  assert.doesNotThrow(() => parseXml('<r>ééé</r>', { maxBytes: 14 }));
});

test('xml: nhận Uint8Array UTF-8, từ chối byte không hợp lệ và UTF-16', () => {
  const good = new TextEncoder().encode('<r>xin chào</r>');
  assert.equal(parseXml(good).root.name, 'r');
  assert.throws(() => parseXml(new Uint8Array([0x3C, 0xFF, 0x3E])), error => error.reason === XML_ERRORS.MALFORMED);
  assert.throws(() => parseXml(new Uint8Array([0xFF, 0xFE, 0x3C, 0x00])), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: BOM bị bỏ, control character và surrogate lẻ bị từ chối', () => {
  assert.equal(parseXml('\uFEFF<r/>').root.name, 'r');
  assert.throws(() => parseXml('<r>\u0001</r>'), error => error.reason === XML_ERRORS.MALFORMED);
  assert.throws(() => parseXml('<r>\uD800</r>'), error => error.reason === XML_ERRORS.MALFORMED);
});

test('xml: stats.bytes báo byte UTF-8 thật', () => {
  const { stats } = parseXml('<r>é</r>');
  assert.equal(stats.bytes, 9);
});

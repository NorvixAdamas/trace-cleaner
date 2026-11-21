import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DocumentSession, DOCUMENT_ERRORS, PROPOSAL_META_ALLOWED,
} from '../packages/core/document.js';

test('document: metadata không thể ghi đè id/text/baseRevision/baseText', () => {
  const session = new DocumentSession('Bản gốc');
  const revision = session.revision;
  const proposal = session.propose('Bản đề xuất', {
    id: 'hacker',
    text: 'nội dung độc hại',
    baseRevision: 'revision-gia',
    baseText: 'bản giả',
    at: '1999-01-01T00:00:00Z',
    kind: 'replace-all',
    model: 'test-model',
  });
  assert.notEqual(proposal.id, 'hacker');
  assert.equal(proposal.text, 'Bản đề xuất');
  assert.equal(proposal.baseRevision, revision);
  assert.equal(proposal.baseText, 'Bản gốc');
  assert.notEqual(proposal.at, '1999-01-01T00:00:00Z');
  assert.equal(proposal.kind, 'replace');
  assert.equal(proposal.model, 'test-model');
  assert.equal(session.proposed, 'Bản đề xuất');
});

test('document: proposal là bất biến (frozen)', () => {
  const session = new DocumentSession('x');
  const proposal = session.propose('y');
  assert.equal(Object.isFrozen(proposal), true);
  assert.throws(() => { 'use strict'; proposal.text = 'z'; }, TypeError);
  assert.equal(proposal.text, 'y');
});

test('document: chỉ field trong whitelist được giữ', () => {
  const session = new DocumentSession('x');
  const proposal = session.propose('y', {
    source: 'provider', provider: 'google', model: 'm', mode: 'proofread',
    language: 'vi', requestId: 'req_1', reason: 'r', kind: 'replace', confidence: 0.9,
    secretKey: 'AIza...', nested: { a: 1 },
  });
  for (const key of ['source', 'provider', 'model', 'mode', 'language', 'requestId', 'reason', 'confidence']) {
    assert.ok(Object.prototype.hasOwnProperty.call(proposal, key), key);
  }
  assert.equal(proposal.secretKey, undefined);
  assert.equal(proposal.nested, undefined);
  assert.deepEqual(PROPOSAL_META_ALLOWED.includes('secretKey'), false);
});

test('document: proposal cũ bị từ chối sau khi tài liệu đổi', () => {
  const session = new DocumentSession('Một');
  const proposal = session.propose('Hai');
  session.commit('Ba', 'edit');
  const result = session.acceptProposal(proposal.id);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DOCUMENT_ERRORS.STALE_REVISION);
  assert.equal(session.working, 'Ba');
  assert.equal(session.staleProposals.length, 1);
  assert.equal(session.pendingProposal(), null);
});

test('document: proposeEdits áp offset chính xác, từ chối find lệch', () => {
  const session = new DocumentSession('Xin chào thế giới');
  const ok = session.proposeEdits([{ start: 4, end: 8, find: 'chào', replace: 'chào bạn' }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.proposal.text, 'Xin chào bạn thế giới');
  const bad = session.proposeEdits([{ start: 4, end: 8, find: 'sai', replace: 'x' }]);
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, DOCUMENT_ERRORS.EDIT_REJECTED);
});

test('document: acceptEdit áp một gợi ý, ghi revision và vô hiệu gợi ý còn lại', () => {
  const session = new DocumentSession('Anh ấy đi hoc.');
  const proposal = session.propose('Anh ấy đi học.', { source: 'grammar' });
  const result = session.acceptEdit(proposal.id, {
    start: 10, end: 13, original: 'hoc', replacement: 'học', ruleId: 'vi.typo',
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(session.working, 'Anh ấy đi học.');
  assert.equal(result.revision.action, 'accept-suggestion');
  assert.equal(result.revision.ruleId, 'vi.typo');
  assert.equal(session.pendingProposal(), null);
  assert.equal(session.canUndo(), true);
  session.undo();
  assert.equal(session.working, 'Anh ấy đi hoc.');
});

test('document: acceptEdit trên proposal stale bị chặn', () => {
  const session = new DocumentSession('abc');
  const proposal = session.propose('abd');
  session.commit('xyz');
  const result = session.acceptEdit(proposal.id, { start: 2, end: 3, original: 'c', replacement: 'd' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DOCUMENT_ERRORS.STALE_REVISION);
  assert.equal(session.working, 'xyz');
});

test('document: acceptEdit với offset sai bị từ chối, không ghi bẩn tài liệu', () => {
  const session = new DocumentSession('abcdef');
  const proposal = session.propose('abcdef');
  const before = session.revisions.length;
  const result = session.acceptEdit(proposal.id, { start: 1, end: 3, original: 'zz', replacement: 'q' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DOCUMENT_ERRORS.EDIT_REJECTED);
  assert.equal(session.working, 'abcdef');
  assert.equal(session.revisions.length, before);
});

test('document: applyLocalEdit áp một gợi ý, ghi lịch sử, undo được', () => {
  const session = new DocumentSession('Anh ấy đi hoc.');
  const result = session.applyLocalEdit({ start: 10, end: 13, original: 'hoc', replacement: 'học', ruleId: 'vi.typo', category: 'spelling' });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(session.working, 'Anh ấy đi học.');
  assert.equal(result.revision.action, 'accept-suggestion');
  assert.equal(result.revision.ruleId, 'vi.typo');
  assert.equal(result.revision.category, 'spelling');
  session.undo();
  assert.equal(session.working, 'Anh ấy đi hoc.');
});

test('document: applyLocalEdit từ chối offset cũ sau khi văn bản đổi', () => {
  const session = new DocumentSession('abc def');
  assert.equal(session.applyLocalEdit({ start: 0, end: 3, original: 'abc', replacement: 'xyz' }).ok, true);
  const stale = session.applyLocalEdit({ start: 8, end: 11, original: 'def', replacement: 'ghi' });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, DOCUMENT_ERRORS.EDIT_REJECTED);
  assert.equal(session.working, 'xyz def');
});

test('document: reject ghi lại lịch sử từ chối', () => {
  const session = new DocumentSession('a');
  session.propose('b', { source: 'provider' });
  const rejected = session.reject();
  assert.equal(rejected, 'b');
  assert.equal(session.rejectedProposals.length, 1);
  assert.equal(session.rejectedProposals[0].source, 'provider');
  assert.equal(session.pendingProposal(), null);
});

test('document: compare hai revision trả diff thật', () => {
  const session = new DocumentSession('Một hai ba');
  const first = session.revision;
  session.commit('Một hai bốn', 'edit');
  const second = session.revision;
  const compared = session.compare(first, second);
  assert.equal(compared.error, undefined);
  assert.ok(compared.stats.added >= 1);
  assert.ok(compared.stats.removed >= 1);
  assert.equal(compared.from.id, first);
  assert.equal(compared.to.id, second);
});

test('document: compare revision không tồn tại báo lỗi', () => {
  const session = new DocumentSession('x');
  const compared = session.compare('r1', 'r2');
  assert.equal(compared.error, DOCUMENT_ERRORS.INVALID_REVISION);
});

test('document: restoreRevision tạo revision mới, không xoá lịch sử', () => {
  const session = new DocumentSession('gốc');
  session.commit('giữa');
  const target = session.revision;
  session.commit('cuối');
  const before = session.revisions.length;
  const restored = session.restoreRevision(target);
  assert.equal(restored.ok, true);
  assert.equal(session.working, 'giữa');
  assert.equal(session.revisions.length, before + 1);
  assert.equal(restored.revision.action, 'restore-revision');
  assert.equal(restored.revision.restoredFrom, target);
  session.undo();
  assert.equal(session.working, 'cuối');
});

test('document: history có proposalId và ruleId, snapshot có revisionCount', () => {
  const session = new DocumentSession('a');
  const proposal = session.propose('b');
  session.acceptEdit(proposal.id, { start: 0, end: 1, original: 'a', replacement: 'b', ruleId: 'x' });
  const history = session.history();
  assert.equal(history.length, 2);
  assert.equal(history[1].action, 'accept-suggestion');
  assert.equal(history[1].proposalId, proposal.id);
  assert.equal(history[1].ruleId, 'x');
  const snapshot = session.snapshot();
  assert.equal(snapshot.revisionCount, 2);
  assert.equal(snapshot.rejectedCount, 0);
});

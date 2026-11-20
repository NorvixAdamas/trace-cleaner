import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSession, DOCUMENT_ERRORS } from '../packages/core/document.js';

test('accept proposal hợp lệ tạo revision mới và giữ nguyên bản gốc', () => {
  const doc = new DocumentSession('bản gốc');
  const proposal = doc.propose('bản mới');
  const result = doc.acceptAll();
  assert.equal(result.ok, true);
  assert.equal(doc.working, 'bản mới');
  assert.equal(doc.original, 'bản gốc');
  assert.equal(result.revision.proposalId, proposal.id);
});

test('proposal cũ không ghi đè bản đã sửa (STALE_DOCUMENT_REVISION)', () => {
  const doc = new DocumentSession('v1');
  const stale = doc.propose('model trả lời cho v1');
  doc.commit('người dùng sửa thành v2');
  const result = doc.acceptProposal(stale.id);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DOCUMENT_ERRORS.STALE_REVISION);
  assert.equal(doc.working, 'người dùng sửa thành v2', 'không được ghi đè bản mới');
  assert.equal(doc.accepted, null);
  assert.equal(doc.staleProposals.length, 1);
});

test('hai phản hồi về sai thứ tự: chỉ bản mới nhất được chấp nhận', () => {
  const doc = new DocumentSession('v1');
  const first = doc.propose('kết quả A');
  const second = doc.propose('kết quả B');
  const oldResult = doc.acceptProposal(first.id);
  assert.equal(oldResult.ok, false);
  assert.equal(oldResult.error.code, DOCUMENT_ERRORS.UNKNOWN_PROPOSAL);
  assert.equal(doc.working, 'v1');
  const newResult = doc.acceptProposal(second.id);
  assert.equal(newResult.ok, true);
  assert.equal(doc.working, 'kết quả B');
});

test('expectedRevision do UI truyền vào cũng bị kiểm tra', () => {
  const doc = new DocumentSession('v1');
  const proposal = doc.propose('v2');
  doc.commit('v2 thủ công');
  const result = doc.acceptProposal(proposal.id, { expectedRevision: proposal.baseRevision });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, DOCUMENT_ERRORS.STALE_REVISION);
});

test('undo, redo và khôi phục bản gốc không mất lịch sử', () => {
  const doc = new DocumentSession('gốc');
  doc.propose('một');
  doc.acceptAll();
  doc.propose('hai');
  doc.acceptAll();
  assert.equal(doc.working, 'hai');
  assert.equal(doc.undo(), 'một');
  assert.equal(doc.redo(), 'hai');
  doc.restoreOriginal();
  assert.equal(doc.working, 'gốc');
  assert.equal(doc.canUndo(), true, 'lịch sử vẫn còn sau khi khôi phục');
  assert.ok(doc.history().length >= 4);
});

test('export không sửa bản gốc hay bản đang sửa', () => {
  const doc = new DocumentSession('gốc');
  doc.propose('mới');
  doc.acceptAll();
  const exported = doc.export('txt');
  assert.equal(exported.text, 'mới');
  assert.equal(doc.original, 'gốc');
  assert.equal(doc.working, 'mới');
});

test('proposal không còn hợp lệ sau khi chính nó được chấp nhận', () => {
  const doc = new DocumentSession('a');
  const proposal = doc.propose('b');
  assert.equal(doc.pendingProposal().id, proposal.id);
  doc.acceptProposal(proposal.id);
  assert.equal(doc.pendingProposal(), null);
  const again = doc.acceptProposal(proposal.id);
  assert.equal(again.error.code, DOCUMENT_ERRORS.NO_PROPOSAL);
});

test('diff so với revision trước đó', () => {
  const doc = new DocumentSession('one two');
  doc.commit('one three', 'manual');
  const against = doc.diffAgainst(doc.revisions[0].id);
  assert.ok(against.ops.some(op => op.type === 'insert' && op.value.includes('three')));
  assert.equal(doc.diffAgainst('rev_không_tồn_tại').error, 'INVALID_REVISION');
});

test('reject bỏ đề xuất nhưng không đụng bản đang sửa', () => {
  const doc = new DocumentSession('a');
  doc.propose('b');
  assert.equal(doc.reject(), 'b');
  assert.equal(doc.working, 'a');
  assert.equal(doc.proposed, null);
});

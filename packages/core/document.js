/**
 * packages/core/document.js — vòng đời tài liệu, không ghi đè bản gốc.
 *
 * Trạng thái tách biệt:
 *   original  → người dùng nhập, không bao giờ bị sửa
 *   working   → bản đang sửa (mọi accept mới đổi)
 *   proposed  → bản model/cleaner đề xuất, chưa chấp nhận
 *   accepted  → snapshot của lần accept gần nhất
 *   exported  → snapshot tại thời điểm xuất file
 *
 * Bất biến quan trọng: mỗi proposal ghi lại revision gốc. Khi người dùng sửa
 * tài liệu trong lúc model đang trả lời, proposal cũ trở thành stale và KHÔNG
 * được ghi đè bản mới. Đây là lỗi mất dữ liệu thật, nên nó bị chặn ở tầng core
 * chứ không chỉ ở UI.
 */

import { diffWords, diffStats } from './diff.js';

export const DOCUMENT_ERRORS = Object.freeze({
  STALE_REVISION: 'STALE_DOCUMENT_REVISION',
  NO_PROPOSAL: 'NO_PROPOSAL',
  UNKNOWN_PROPOSAL: 'UNKNOWN_PROPOSAL',
  INVALID_REVISION: 'INVALID_REVISION',
});

let counter = 0;
const nextId = prefix => `${prefix}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;

const errorResult = (code, message, extra = {}) => ({
  ok: false,
  error: { code, message, ...extra },
});

export class DocumentSession {
  /** @param {string} text @param {Record<string, unknown>} [meta] */
  constructor(text, meta = {}) {
    this.id = nextId('doc');
    this.meta = { language: null, format: 'text', ...meta };
    this.original = String(text ?? '');
    this.working = this.original;
    this.proposed = null;
    this.accepted = null;
    this.exported = null;
    this.revisions = [{
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'create',
      text: this.working,
      proposalId: null,
    }];
    this.pointer = 0;
    this.lastProposal = null;
    /** @type {Array<object>} proposal bị từ chối vì stale, để UI hiển thị */
    this.staleProposals = [];
  }

  get revision() { return this.revisions[this.pointer].id; }

  /** Đề xuất bản mới, chưa áp dụng. Proposal luôn gắn với revision hiện tại. */
  propose(text, meta = {}) {
    const proposal = {
      id: nextId('prop'),
      at: new Date().toISOString(),
      text: String(text ?? ''),
      baseRevision: this.revision,
      baseText: this.working,
      ...meta,
    };
    this.proposed = proposal.text;
    this.lastProposal = proposal;
    return proposal;
  }

  /** Proposal này còn dùng được không? */
  isProposalCurrent(proposal) {
    if (!proposal) return false;
    return proposal.baseRevision === this.revision && proposal.baseText === this.working;
  }

  /** Đang có proposal hợp lệ chưa áp dụng? */
  pendingProposal() {
    if (!this.lastProposal) return null;
    return this.isProposalCurrent(this.lastProposal) ? this.lastProposal : null;
  }

  /**
   * Chấp nhận một proposal cụ thể (id) trên một revision cụ thể.
   * Không bao giờ ghi đè khi tài liệu đã đổi.
   *
   * @param {string} [proposalId] mặc định lấy proposal gần nhất
   * @param {{expectedRevision?:string, text?:string}} [options]
   * @returns {{ok:true, revision:object}|{ok:false, error:{code:string,message:string}}}
   */
  acceptProposal(proposalId, options = {}) {
    const proposal = this.lastProposal;
    if (!proposal) return errorResult(DOCUMENT_ERRORS.NO_PROPOSAL, 'Không có đề xuất nào để chấp nhận.');
    if (proposalId && proposalId !== proposal.id) {
      return errorResult(DOCUMENT_ERRORS.UNKNOWN_PROPOSAL, 'Đề xuất này không tồn tại hoặc đã bị thay thế.', {
        proposalId,
      });
    }
    const expected = options.expectedRevision || proposal.baseRevision;
    if (expected !== this.revision) {
      this.staleProposals.push({ ...proposal, rejectedAt: new Date().toISOString(), reason: 'revision_changed' });
      return errorResult(DOCUMENT_ERRORS.STALE_REVISION,
        'Tài liệu đã được sửa sau khi đề xuất này được tạo. Hãy tạo lại đề xuất trên bản mới nhất.',
        { expectedRevision: expected, currentRevision: this.revision, proposalId: proposal.id });
    }
    if (!this.isProposalCurrent(proposal)) {
      this.staleProposals.push({ ...proposal, rejectedAt: new Date().toISOString(), reason: 'text_changed' });
      return errorResult(DOCUMENT_ERRORS.STALE_REVISION,
        'Bản đang sửa đã khác bản mà đề xuất này dựa vào. Không áp dụng để tránh mất nội dung.',
        { expectedRevision: expected, currentRevision: this.revision, proposalId: proposal.id });
    }

    const nextText = typeof options.text === 'string' ? options.text : proposal.text;
    this.accepted = nextText;
    this.working = nextText;
    this.proposed = null;
    // Proposal đã dùng xong: không thể accept lần hai, và `pendingProposal()`
    // phải trả null ngay sau khi chấp nhận.
    this.lastProposal = null;
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept',
      proposalId: proposal.id,
      baseRevision: proposal.baseRevision,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return { ok: true, revision };
  }

  /** Chấp nhận toàn bộ đề xuất đang có. Trả cùng shape với acceptProposal. */
  acceptAll(options = {}) {
    return this.acceptProposal(undefined, options);
  }

  /** Bỏ đề xuất, không đụng bản đang sửa. */
  reject(proposalId) {
    const rejected = this.lastProposal;
    if (proposalId && rejected && proposalId !== rejected.id) return null;
    this.proposed = null;
    if (rejected) this.lastProposal = null;
    return rejected ? rejected.text : null;
  }

  /** Áp một bản đã được người dùng duyệt (ví dụ sau khi sửa tay). */
  commit(text, action = 'edit') {
    this.working = String(text ?? '');
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action,
      proposalId: null,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return revision;
  }

  canUndo() { return this.pointer > 0; }
  canRedo() { return this.pointer < this.revisions.length - 1; }

  undo() {
    if (!this.canUndo()) return this.working;
    this.pointer -= 1;
    this.working = this.revisions[this.pointer].text;
    return this.working;
  }

  redo() {
    if (!this.canRedo()) return this.working;
    this.pointer += 1;
    this.working = this.revisions[this.pointer].text;
    return this.working;
  }

  /** Quay về đúng bản gốc, ghi thành một revision mới (không xoá lịch sử). */
  restoreOriginal() {
    return this.commit(this.original, 'restore-original');
  }

  /** Xuất bản hiện tại; bản gốc vẫn còn nguyên trong session. */
  export(format = 'text') {
    this.exported = { format, at: new Date().toISOString(), text: this.working, revision: this.revision };
    return this.exported;
  }

  /** So sánh bản đang sửa với bản gốc. */
  diff() {
    const ops = diffWords(this.original, this.working);
    return { ops, stats: diffStats(ops) };
  }

  /** So sánh bản đang sửa với một revision trước đó. */
  diffAgainst(revisionId) {
    const target = this.revisions.find(item => item.id === revisionId);
    if (!target) return { ops: [], stats: { added: 0, removed: 0, kept: 0 }, error: DOCUMENT_ERRORS.INVALID_REVISION };
    const ops = diffWords(target.text, this.working);
    return { ops, stats: diffStats(ops) };
  }

  history() {
    return this.revisions.map((item, index) => ({
      id: item.id,
      at: item.at,
      action: item.action,
      words: (item.text.trim().match(/\S+/g) || []).length,
      current: index === this.pointer,
    }));
  }

  snapshot() {
    return {
      id: this.id,
      original: this.original,
      working: this.working,
      proposed: this.proposed,
      accepted: this.accepted,
      exported: this.exported,
      revision: this.revision,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      pendingProposal: this.pendingProposal() ? { ...this.pendingProposal() } : null,
      staleCount: this.staleProposals.length,
    };
  }
}

export function createDocument(text, meta) {
  return new DocumentSession(text, meta);
}

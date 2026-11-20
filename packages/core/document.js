/**
 * packages/core/document.js — vòng đời tài liệu, không ghi đè bản gốc.
 *
 * Trạng thái tách biệt:
 *   original  → người dùng nhập, không bao giờ bị sửa
 *   working   → bản đang sửa (mọi accept mới đổi)
 *   proposed  → bản model/cleaner đề xuất, chưa chấp nhận
 *   accepted  → snapshot của lần accept gần nhất
 *   exported  → snapshot tại thời điểm xuất file
 */

import { diffWords, diffStats } from './diff.js';

let counter = 0;
const nextId = prefix => `${prefix}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;

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
  }

  /** Đề xuất bản mới, chưa áp dụng. Trả về proposal có id ổn định. */
  propose(text, meta = {}) {
    this.proposed = String(text ?? '');
    this.lastProposal = {
      id: nextId('prop'),
      at: new Date().toISOString(),
      text: this.proposed,
      baseRevision: this.revisions[this.pointer].id,
      ...meta,
    };
    return this.lastProposal;
  }

  /** Chấp nhận toàn bộ đề xuất hiện tại. */
  acceptAll() {
    if (this.proposed == null) return null;
    this.accepted = this.proposed;
    this.working = this.proposed;
    this.proposed = null;
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept',
      proposalId: this.lastProposal ? this.lastProposal.id : null,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return revision;
  }

  /** Bỏ đề xuất, không đụng bản đang sửa. */
  reject() {
    const rejected = this.proposed;
    this.proposed = null;
    return rejected;
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

  /** Xuất bản hiện tại; bản gốc vẫn còn nguyên trong session. */
  export(format = 'text') {
    this.exported = { format, at: new Date().toISOString(), text: this.working };
    return this.exported;
  }

  /** So sánh bản đang sửa với bản gốc. */
  diff() {
    const ops = diffWords(this.original, this.working);
    return { ops, stats: diffStats(ops) };
  }

  snapshot() {
    return {
      id: this.id,
      original: this.original,
      working: this.working,
      proposed: this.proposed,
      accepted: this.accepted,
      exported: this.exported,
      revision: this.revisions[this.pointer].id,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

export function createDocument(text, meta) {
  return new DocumentSession(text, meta);
}

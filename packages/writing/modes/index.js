/**
 * packages/writing/modes/index.js — re-export registry chế độ từ prompts.js.
 *
 * prompts.js là nguồn duy nhất (để bản extension/core/prompts.js vẫn là bản copy
 * độc lập, không import tương đối). Module này chỉ dành cho consumer ESM.
 */

export {
  MODES, MODE_ALIASES, CANONICAL_MODE_KEYS, WRITING_MODES_VERSION,
  resolveMode, getMode,
} from '../prompts.js';

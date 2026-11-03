/**
 * Upstream `queries/image.queries` is `attachments/image.repository.ts` (Phase 2d). Tools reach it through
 * `ToolContext.services.getImagesByChatId`; this path keeps the type the sandbox tool imports.
 */
export type { ChatImage } from '../../attachments/image.repository.js';

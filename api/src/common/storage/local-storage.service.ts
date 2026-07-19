import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

/** Node's fs rejections carry a `code`; narrow to it without an `any` cast. */
function errnoCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

/**
 * Stage A implementation: plain files under STORAGE_DIR (default ./storage).
 *
 * This is the only class in the codebase allowed to touch `fs` for object
 * storage. It is deliberately dumb — no caching, no streaming, no metadata.
 * Phase 0 stores small assets, and a Buffer-in/Buffer-out API is the thing a
 * future S3 adapter can implement without changing any caller.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    // Resolved once, at boot, against cwd. Anything derived from a key is then
    // checked against this absolute path rather than against a relative string.
    this.root = path.resolve(config.get<string>('STORAGE_DIR') ?? './storage');
    this.logger.log(`Local object storage rooted at ${this.root}`);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });

    // Write to a sibling temp file, then rename. rename(2) is atomic within a
    // filesystem, so a reader never observes a partially written object. The
    // temp file is a sibling (not in /tmp) to guarantee the same filesystem —
    // a cross-device rename would fail with EXDEV.
    const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temp, data, { mode: 0o600 });
      await fs.rename(temp, target);
    } catch (err) {
      // Best-effort cleanup; the original error is what the caller needs.
      await fs.unlink(temp).catch(() => undefined);
      throw err;
    }
  }

  async get(key: string): Promise<Buffer> {
    const target = this.resolveKey(key);
    try {
      return await fs.readFile(target);
    } catch (err) {
      // EISDIR: the key names a directory, which is "no such object" to a caller
      // that only ever stored bytes.
      const code = errnoCode(err);
      if (code === 'ENOENT' || code === 'EISDIR') {
        throw new NotFoundException(`No stored object for key "${key}"`);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await fs.unlink(target);
    } catch (err) {
      if (errnoCode(err) === 'ENOENT') return; // already gone; nothing to do
      throw err;
    }
  }

  /**
   * Map a caller-supplied key to an absolute path, refusing anything that would
   * escape the root.
   *
   * Keys can reach here from request data, so this is a trust boundary: without
   * the containment check, a key of `../../.env` would read the app's secrets
   * and `/etc/passwd` would resolve to exactly that. path.resolve() collapses
   * `..` segments and returns absolute inputs unchanged, so comparing the
   * *resolved* path against the root catches both without hand-parsing the key.
   */
  private resolveKey(key: string): string {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new BadRequestException('Storage key must be a non-empty string');
    }

    // A NUL byte truncates the path in the syscall layer, so `a\0../../x` could
    // pass a string check and still open something else. Reject outright.
    if (key.includes('\0')) {
      throw new BadRequestException('Storage key must not contain NUL bytes');
    }

    const target = path.resolve(this.root, key);
    const rootPrefix = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;

    // Must be strictly *inside* the root — equal to the root means the key
    // resolved to the directory itself (e.g. "." or "sub/.."), not an object.
    if (!target.startsWith(rootPrefix)) {
      throw new BadRequestException(`Storage key "${key}" escapes the storage root`);
    }

    return target;
  }
}

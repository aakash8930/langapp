import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';

/**
 * These run against a real temp directory rather than a mocked fs. The whole
 * point of this class is its interaction with the filesystem — path containment
 * and atomic replace are exactly the parts a mock would assume away.
 */
describe('LocalStorageService', () => {
  let root: string;
  let service: LocalStorageService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'langapp-storage-'));
    const config = { get: () => root } as unknown as ConfigService;
    service = new LocalStorageService(config);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes through put and get', async () => {
    await service.put('greeting.txt', Buffer.from('こんにちは'));

    expect((await service.get('greeting.txt')).toString()).toBe('こんにちは');
  });

  it('creates intermediate directories for nested keys', async () => {
    await service.put('audio/lesson-01/vocab-3.mp3', Buffer.from([0x49, 0x44, 0x33]));

    expect(await service.get('audio/lesson-01/vocab-3.mp3')).toEqual(
      Buffer.from([0x49, 0x44, 0x33]),
    );
  });

  it('replaces an existing object and leaves no temp files behind', async () => {
    await service.put('note.txt', Buffer.from('first'));
    await service.put('note.txt', Buffer.from('second'));

    expect((await service.get('note.txt')).toString()).toBe('second');
    expect(await fs.readdir(root)).toEqual(['note.txt']);
  });

  it('throws NotFoundException for a key that was never written', async () => {
    await expect(service.get('missing.txt')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an object and makes it unreadable', async () => {
    await service.put('temp.txt', Buffer.from('x'));
    await service.delete('temp.txt');

    await expect(service.get('temp.txt')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats deleting a missing key as success', async () => {
    await expect(service.delete('never-existed.txt')).resolves.toBeUndefined();
  });

  describe('key containment', () => {
    // The keys a caller must never be able to reach. Each would be a real file
    // read or write outside the storage root if resolveKey were absent.
    const escapes = ['../outside.txt', '../../etc/passwd', 'a/../../outside.txt', '/etc/passwd'];

    it.each(escapes)('rejects %s on put', async (key) => {
      await expect(service.put(key, Buffer.from('x'))).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(escapes)('rejects %s on get', async (key) => {
      await expect(service.get(key)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(escapes)('rejects %s on delete', async (key) => {
      await expect(service.delete(key)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not write outside the root when given a traversing key', async () => {
      const outside = path.join(path.dirname(root), 'outside.txt');

      await expect(service.put('../outside.txt', Buffer.from('pwned'))).rejects.toThrow();

      await expect(fs.access(outside)).rejects.toThrow();
    });

    it('rejects a key containing a NUL byte', async () => {
      await expect(service.get('a\0../../etc/passwd')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects keys that resolve to the root itself', async () => {
      await expect(service.get('.')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.get('sub/..')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a key that merely looks suspicious but stays inside', async () => {
      await service.put('lesson..01/a..b.txt', Buffer.from('fine'));

      expect((await service.get('lesson..01/a..b.txt')).toString()).toBe('fine');
    });
  });
});

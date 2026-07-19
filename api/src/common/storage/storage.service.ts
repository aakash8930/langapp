/**
 * The seam between feature modules and wherever bytes actually live.
 *
 * Feature modules depend on this abstract class, never on an implementation and
 * never on `fs` directly. Stage A binds it to LocalStorageService (writes under
 * ./storage/); a later stage can bind it to S3/R2 without touching a caller.
 *
 * It is an abstract class rather than an interface because interfaces vanish at
 * compile time and Nest needs a runtime DI token. Injecting `StorageService`
 * therefore resolves to whatever StorageModule bound it to.
 *
 * Keys are forward-slash paths relative to the storage root, e.g.
 * `audio/lesson-01/vocab-3.mp3`. Implementations must treat them as opaque
 * identifiers, not as trusted filesystem paths.
 */
export abstract class StorageService {
  /**
   * Write `data` at `key`, replacing anything already there. Creates any
   * intermediate directories. Must be atomic from a reader's perspective: a
   * concurrent get() sees either the old bytes or the new ones, never a
   * half-written file.
   */
  abstract put(key: string, data: Buffer): Promise<void>;

  /** Read the bytes at `key`. Throws NotFoundException if it does not exist. */
  abstract get(key: string): Promise<Buffer>;

  /**
   * Remove `key`. Idempotent — deleting something that is already gone is a
   * success, matching how object stores behave.
   */
  abstract delete(key: string): Promise<void>;
}

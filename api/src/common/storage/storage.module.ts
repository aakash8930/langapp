import { Global, Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

/**
 * Binds the StorageService token to the Stage A local-disk implementation.
 * Swapping in S3/R2 later is a one-line change here, with no caller touched.
 *
 * Global for the same reason as RedisModule: object storage is infrastructure
 * every feature module may need, not a domain module anyone should have to
 * import (and importing it would say nothing about domain boundaries).
 */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: LocalStorageService }],
  exports: [StorageService],
})
export class StorageModule {}

import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthReport, HealthService } from './health.service';

/**
 * Deliberately outside the versioned surface (ADR-007): a monitor or load
 * balancer pointed at `/health` should not have to know or care which version of
 * the contract the API is serving. So this answers at `/health` only, never
 * `/v1/health`.
 *
 * Version in the `@Controller` options, not `@Version()` — that decorator only
 * works on a method.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health(): Promise<HealthReport> {
    const report = await this.healthService.check();

    // A load balancer should see a non-2xx when a dependency is gone.
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}

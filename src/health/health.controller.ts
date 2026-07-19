import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthReport, HealthService } from './health.service';

@Controller('health')
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

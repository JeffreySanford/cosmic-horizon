import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Public performance endpoints used by the web UI for development/demo.
 *
 * Current implementation returns a randomly generated heatmap matrix so the
 * front-end can render something without requiring a complete backend data
 * pipeline.  This avoids 404s during local development.
 *
 * The controller is intentionally lightweight; real production data would
 * come from a database or metrics service.
 */
@Controller('metrics')
@ApiTags('Performance')
export class PerformanceController {
  @Get('heatmap')
  @ApiOperation({ summary: 'Get a CPU/GPU heatmap matrix' })
  @ApiResponse({ status: 200, description: 'Heatmap matrix returned' })
  getHeatmap(): number[][] {
    const rows = 10;
    const cols = 10;
    // generate a random matrix of numbers 0..100
    const matrix: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 100)
    );
    return matrix;
  }

  @Get('gpu-heatmap')
  @ApiOperation({ summary: 'Get a GPU heatmap matrix' })
  @ApiResponse({ status: 200, description: 'GPU heatmap matrix returned' })
  getGpuHeatmap(): number[][] {
    const rows = 10;
    const cols = 10;
    const matrix: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.random() * 100)
    );
    return matrix;
  }
}

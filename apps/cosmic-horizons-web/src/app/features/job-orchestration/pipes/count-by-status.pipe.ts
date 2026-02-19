import { Pipe, PipeTransform } from '@angular/core';
import { Job, JobStatus } from '../job.models';

@Pipe({
  name: 'countByStatus',
  standalone: false,
})
export class CountByStatusPipe implements PipeTransform {
  transform(jobs: Job[], status: JobStatus): number {
    if (!jobs) return 0;
    return jobs.filter((job) => job.status === status).length;
  }
}

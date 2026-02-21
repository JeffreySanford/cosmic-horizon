import {
  Component,
  OnInit,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { JobOrchestrationService } from '../job-orchestration.service';
import { Agent, JobSubmissionRequest } from '../job.models';
import { Observable } from 'rxjs';


@Component({
  selector: 'app-job-submission-form',
  standalone: false,
  templateUrl: './job-submission-form.component.html',
  styleUrls: ['./job-submission-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobSubmissionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly jobService = inject(JobOrchestrationService);

  @Output() jobSubmitted = new EventEmitter<void>();

  submissionForm!: FormGroup;
  agents$: Observable<Agent[]>;

  isSubmitting = false;
  submitError: string | null = null;

  // helper getter for parameters form array
  get parameters(): FormArray {
    return this.submissionForm.get('parameters') as FormArray;
  }

  constructor() {
    this.agents$ = this.jobService.getAgents();
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.submissionForm = this.fb.group({
      agentId: ['alphacal-001', Validators.required],
      jobName: ['', [Validators.required, Validators.minLength(3)]],
      dataPath: ['', Validators.required],
      cpuCores: [
        32,
        [Validators.required, Validators.min(1), Validators.max(128)],
      ],
      memoryGb: [
        128,
        [Validators.required, Validators.min(8), Validators.max(512)],
      ],
      gpuCount: [
        1,
        [Validators.required, Validators.min(0), Validators.max(8)],
      ],
      parameters: this.fb.array([]),
    });
  }

  addParameter(): void {
    this.parameters.push(
      this.fb.group({
        key: ['', Validators.required],
        value: ['', Validators.required],
      }),
    );
  }

  removeParameter(index: number): void {
    this.parameters.removeAt(index);
  }

  onSubmit(): void {
    if (this.submissionForm.invalid) {
      this.submitError = 'Please fill in all required fields';
      return;
    }

    this.isSubmitting = true;
    this.submitError = null;

    const formValue = this.submissionForm.value;
    const paramsArray: Array<{ key: string; value: string }> =
      formValue.parameters || [];
    const parameters: { [key: string]: string } = {};
    for (const p of paramsArray) {
      if (p.key) {
        parameters[p.key] = p.value;
      }
    }

    const request: JobSubmissionRequest = {
      name: formValue.jobName,
      agentId: formValue.agentId,
      parameters,
      resourceAllocation: {
        cpuCores: formValue.cpuCores,
        memoryGb: formValue.memoryGb,
        gpuCount: formValue.gpuCount,
      },
    };

    this.jobService.submitJob(request).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submissionForm.reset({
          agentId: 'alphacal-001',
          jobName: '',
          dataPath: '',
          cpuCores: 32,
          memoryGb: 128,
          gpuCount: 1,
        });
        this.jobSubmitted.emit();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.submitError = error?.message || 'Job submission failed';
      },
    });
  }
}

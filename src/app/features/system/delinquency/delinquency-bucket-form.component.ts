/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/adapters';
import { ButtonComponent } from '../../../ui/button/button.component';
import { SpinnerComponent } from '../../../ui/spinner/spinner.component';
import {
  DelinquencyBucketRequest,
  DelinquencyRangeAndBucketsManagementService,
  DelinquencyRangeResponse,
  StringEnumOptionData,
} from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Create / edit a delinquency bucket.
 *
 * A bucket is a named, ordered set of ranges, so the form is a name, a type, and the ranges to
 * include. The type options and the selectable ranges both come from
 * `GET /delinquency/buckets/template` rather than being hardcoded — the platform owns that
 * vocabulary, and the template endpoint existed unused while this screen had no create path at
 * all (its "Create Bucket" button routed to a page that did not exist).
 */
@Component({
  selector: 'app-delinquency-bucket-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ButtonComponent, SpinnerComponent],
  template: `
    <div class="form-container">
      <section class="entity-card">
        <h2>{{ (isEditMode() ? 'SYSTEM.EDIT_BUCKET' : 'SYSTEM.CREATE_BUCKET') | appTranslate }}</h2>

        @if (isLoading()) {
          <app-spinner data-testid="delinquency-bucket-loading" />
        } @else {
          <form #bucketForm="ngForm" (ngSubmit)="onSubmit()">
            <div class="form-grid">
              <div class="form-field">
                <label for="bucketName">{{ 'SYSTEM.BUCKET_NAME' | appTranslate }}</label>
                <input
                  id="bucketName"
                  type="text"
                  name="name"
                  data-testid="delinquency-bucket-name"
                  [(ngModel)]="bucket().name"
                  required
                />
              </div>

              <div class="form-field">
                <label for="bucketType">{{ 'SYSTEM.BUCKET_TYPE' | appTranslate }}</label>
                <select
                  id="bucketType"
                  name="bucketType"
                  data-testid="delinquency-bucket-type"
                  [(ngModel)]="bucket().bucketType"
                  required
                >
                  @for (option of bucketTypes(); track option.id) {
                    <option [value]="option.id">{{ option.value }}</option>
                  }
                </select>
              </div>
            </div>

            <fieldset class="range-picker">
              <legend>{{ 'SYSTEM.BUCKET_RANGES' | appTranslate }}</legend>
              @if (availableRanges().length === 0) {
                <p data-testid="delinquency-bucket-no-ranges">
                  {{ 'SYSTEM.BUCKET_NO_RANGES' | appTranslate }}
                </p>
              } @else {
                @for (range of availableRanges(); track range.id) {
                  <label class="range-option">
                    <input
                      type="checkbox"
                      [checked]="isSelected(range.id)"
                      (change)="onToggleRange(range.id, $event)"
                      [attr.data-testid]="'delinquency-bucket-range-' + range.id"
                    />
                    <span
                      >{{ range.classification }} ({{ range.minimumAgeDays }}&ndash;{{
                        range.maximumAgeDays
                      }})</span
                    >
                  </label>
                }
              }
            </fieldset>

            <div class="form-actions">
              <app-button
                type="button"
                intent="secondary"
                emphasis="quiet"
                [disabled]="isSaving()"
                (click)="onCancel()"
                >{{ 'COMMON.CANCEL' | appTranslate }}</app-button
              >
              <app-button
                type="submit"
                intent="primary"
                data-testid="delinquency-bucket-save"
                [disabled]="bucketForm.invalid || isSaving()"
                >{{ (isSaving() ? 'COMMON.SAVING' : 'COMMON.SAVE') | appTranslate }}</app-button
              >
            </div>
          </form>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .entity-card {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
      }
      h2 {
        margin: 0 0 16px;
        font-size: 1.1rem;
      }
      .range-picker {
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 16px;
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .range-picker legend {
        padding: 0 8px;
        font-weight: 600;
      }
      .range-option {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class DelinquencyBucketFormComponent implements OnInit {
  private readonly delinquencyService = inject(DelinquencyRangeAndBucketsManagementService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/delinquency';

  readonly bucket = signal<DelinquencyBucketRequest>({ ranges: [] });
  readonly availableRanges = signal<DelinquencyRangeResponse[]>([]);
  readonly bucketTypes = signal<StringEnumOptionData[]>([]);
  readonly isEditMode = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  private bucketId?: number;

  ngOnInit(): void {
    this.loadTemplate();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.bucketId = Number(id);
    this.isEditMode.set(true);
    this.load();
  }

  private loadTemplate(): void {
    this.delinquencyService.getDelinquencyBucketsTemplate().subscribe({
      next: (template) => {
        this.availableRanges.set(template.rangesOptions ?? []);
        const types = template.bucketTypeOptions ?? [];
        this.bucketTypes.set(types);
        // The type is required, and leaving it blank means the form opens invalid with Save
        // disabled and nothing saying which field is at fault. Most buckets are regular ones.
        if (!this.isEditMode() && !this.bucket().bucketType && types[0]?.id) {
          this.bucket.update((current) => ({ ...current, bucketType: types[0].id }));
        }
      },
      // The ranges list is the part that matters; a failure here leaves the name and type usable
      // and the form honest about having nothing to pick from.
      error: () => {
        this.availableRanges.set([]);
        this.bucketTypes.set([]);
      },
    });
  }

  private load(): void {
    if (!this.bucketId) {
      return;
    }
    this.isLoading.set(true);
    this.delinquencyService.getDelinquencyBucketsDelinquencyBucketId(this.bucketId).subscribe({
      next: (data) => {
        this.bucket.set({
          name: data.name,
          // The response wraps the type as {id, code, value}; the request wants the bare id.
          bucketType: data.bucketType?.id,
          ranges: (data.ranges ?? [])
            .map((range) => range.id)
            .filter((id): id is number => typeof id === 'number'),
        });
        this.isLoading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to load delinquency bucket');
        this.isLoading.set(false);
      },
    });
  }

  isSelected(rangeId: number | undefined): boolean {
    return rangeId !== undefined && (this.bucket().ranges ?? []).includes(rangeId);
  }

  onToggleRange(rangeId: number | undefined, event: Event): void {
    if (rangeId === undefined) {
      return;
    }
    const checked = (event.target as HTMLInputElement | null)?.checked ?? false;

    this.bucket.update((current) => {
      const ranges = new Set(current.ranges);
      if (checked) {
        ranges.add(rangeId);
      } else {
        ranges.delete(rangeId);
      }
      return { ...current, ranges: [...ranges] };
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    const payload = this.bucket();
    const request$ =
      this.isEditMode() && this.bucketId
        ? this.delinquencyService.putDelinquencyBucketsDelinquencyBucketId(this.bucketId, payload)
        : this.delinquencyService.postDelinquencyBuckets(payload);

    request$.subscribe({
      next: () => {
        this.notifications.success('Delinquency bucket saved');
        void this.router.navigate([this.LIST_PATH]);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    void this.router.navigate([this.LIST_PATH]);
  }
}

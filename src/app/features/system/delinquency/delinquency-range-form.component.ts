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
import { DelinquencyRangeAndBucketsManagementService, DelinquencyRangeRequest } from '../../../api';
import { NotificationService } from '../../../core/services/notification.service';
import { FINERACT_LOCALE } from '../../../core/utils/date-formatter';

/**
 * Create / edit a delinquency range.
 *
 * The management screen has always rendered "Create Range" and a per-row edit button, both
 * routing to `ranges/create` and `ranges/edit/:id`. Neither route existed and neither component
 * had been written, so both buttons landed on "Page not found" — while delete worked, leaving a
 * screen that could only ever remove delinquency configuration.
 */
@Component({
  selector: 'app-delinquency-range-form',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ButtonComponent, SpinnerComponent],
  template: `
    <div class="form-container">
      <section class="entity-card">
        <h2>{{ (isEditMode() ? 'SYSTEM.EDIT_RANGE' : 'SYSTEM.CREATE_RANGE') | appTranslate }}</h2>

        @if (isLoading()) {
          <app-spinner data-testid="delinquency-range-loading" />
        } @else {
          <form #rangeForm="ngForm" (ngSubmit)="onSubmit()">
            <div class="form-grid">
              <div class="form-field">
                <label for="classification">{{
                  'SYSTEM.RANGE_CLASSIFICATION' | appTranslate
                }}</label>
                <input
                  id="classification"
                  type="text"
                  name="classification"
                  data-testid="delinquency-range-classification"
                  [(ngModel)]="range().classification"
                  required
                />
              </div>

              <div class="form-field">
                <label for="minimumAgeDays">{{ 'SYSTEM.RANGE_MIN_AGE_DAYS' | appTranslate }}</label>
                <input
                  id="minimumAgeDays"
                  type="number"
                  name="minimumAgeDays"
                  data-testid="delinquency-range-min"
                  [(ngModel)]="range().minimumAgeDays"
                  required
                />
              </div>

              <div class="form-field">
                <label for="maximumAgeDays">{{ 'SYSTEM.RANGE_MAX_AGE_DAYS' | appTranslate }}</label>
                <input
                  id="maximumAgeDays"
                  type="number"
                  name="maximumAgeDays"
                  data-testid="delinquency-range-max"
                  [(ngModel)]="range().maximumAgeDays"
                />
              </div>
            </div>

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
                data-testid="delinquency-range-save"
                [disabled]="rangeForm.invalid || isSaving()"
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
    `,
  ],
})
export class DelinquencyRangeFormComponent implements OnInit {
  private readonly delinquencyService = inject(DelinquencyRangeAndBucketsManagementService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly LIST_PATH = '/system/delinquency';

  readonly range = signal<DelinquencyRangeRequest>({});
  readonly isEditMode = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  private rangeId?: number;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.rangeId = Number(id);
    this.isEditMode.set(true);
    this.load();
  }

  private load(): void {
    if (!this.rangeId) {
      return;
    }
    this.isLoading.set(true);
    this.delinquencyService.getDelinquencyRangesDelinquencyRangeId(this.rangeId).subscribe({
      next: (data) => {
        this.range.set({
          classification: data.classification,
          minimumAgeDays: data.minimumAgeDays,
          maximumAgeDays: data.maximumAgeDays,
        });
        this.isLoading.set(false);
      },
      error: () => {
        this.notifications.error('Failed to load delinquency range');
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);
    // `minimumAgeDays` and `maximumAgeDays` are numbers, so the platform wants a locale with them.
    const payload: DelinquencyRangeRequest = { ...this.range(), locale: FINERACT_LOCALE };
    const request$ =
      this.isEditMode() && this.rangeId
        ? this.delinquencyService.putDelinquencyRangesDelinquencyRangeId(this.rangeId, payload)
        : this.delinquencyService.postDelinquencyRanges(payload);

    request$.subscribe({
      next: () => {
        this.notifications.success('Delinquency range saved');
        void this.router.navigate([this.LIST_PATH]);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onCancel(): void {
    void this.router.navigate([this.LIST_PATH]);
  }
}

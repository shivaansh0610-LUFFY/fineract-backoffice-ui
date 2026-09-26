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
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../core/services/notification.service';
import { formatDateToFineract } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  HolidaysService,
  OfficesService,
  PostHolidaysRequest,
  PutHolidaysHolidayIdRequest,
  GetOfficesResponse,
} from '../../api';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * The `YYYY-MM-DD` an `ion-datetime` binds to.
 *
 * The platform sends dates as `[year, month, day]` arrays here despite the generated model typing
 * them as strings, so both shapes are handled; anything else yields an empty picker rather than a
 * date the user did not choose.
 */
function pickerDate(value: unknown): string | null {
  if (Array.isArray(value) && value.length >= 3) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`;
  }
  return typeof value === 'string' && value ? value.split('T', 1)[0] : null;
}

@Component({
  selector: 'app-holiday-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    TooltipDirective,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'HOLIDAYS.CREATE_HOLIDAY' | translate }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #holidayForm="ngForm" (ngSubmit)="onSubmit()" class="holiday-form">
            <div class="form-grid">
              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.HOLIDAY_NAME_DESC' | translate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'HOLIDAYS.NAME' | translate"
                  name="name"
                  [(ngModel)]="holiday.name"
                  required
                ></ion-input>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.APPLICABLE_OFFICES_DESC' | translate"
              >
                <ion-label position="stacked">{{
                  'HOLIDAYS.APPLICABLE_OFFICES' | translate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'HOLIDAYS.APPLICABLE_OFFICES' | translate"
                  interface="popover"
                  name="offices"
                  [(ngModel)]="selectedOfficeIds"
                  multiple
                  required
                >
                  @for (office of offices(); track office.id) {
                    <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.FROM_DATE_DESC' | translate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.FROM_DATE' | translate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="fromDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="fromDate-picker"
                      data-testid="fromDate-picker"
                      presentation="date"
                      name="fromDate"
                      [(ngModel)]="fromDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.TO_DATE_DESC' | translate"
              >
                <ion-label position="stacked">{{ 'HOLIDAYS.TO_DATE' | translate }}</ion-label>
                @if (pickersReady()) {
                  <ion-datetime-button datetime="toDate-picker"></ion-datetime-button>
                }
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="toDate-picker"
                      data-testid="toDate-picker"
                      presentation="date"
                      name="toDate"
                      [(ngModel)]="toDate"
                      required
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </ion-item>

              <ion-item
                fill="outline"
                class="full-width"
                [appTooltip]="'HELP.RESCHEDULING_TYPE_DESC' | translate"
              >
                <ion-label position="stacked">{{
                  'HOLIDAYS.RESCHEDULING_TYPE' | translate
                }}</ion-label>
                <ion-select
                  [attr.aria-label]="'HOLIDAYS.RESCHEDULING_TYPE' | translate"
                  interface="popover"
                  name="reschedulingType"
                  [(ngModel)]="reschedulingType"
                  required
                >
                  @for (option of reschedulingTypeOptions(); track option.id) {
                    <ion-select-option [value]="option.id">{{ option.value }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              @if (reschedulingType === 2) {
                <ion-item
                  fill="outline"
                  class="full-width"
                  [appTooltip]="'HELP.REPAYMENTS_RESCHEDULED_TO_DESC' | translate"
                >
                  <ion-label position="stacked">{{
                    'HOLIDAYS.REPAYMENTS_RESCHEDULED_TO' | translate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button
                      datetime="repaymentsRescheduledTo-picker"
                    ></ion-datetime-button>
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="repaymentsRescheduledTo-picker"
                        data-testid="repaymentsRescheduledTo-picker"
                        presentation="date"
                        name="repaymentsRescheduledTo"
                        [(ngModel)]="repaymentsRescheduledTo"
                        required
                      ></ion-datetime>
                    </ng-template>
                  </ion-modal>
                </ion-item>
              }
            </div>

            <ion-item
              fill="outline"
              class="full-width"
              [appTooltip]="'HELP.HOLIDAY_DESCRIPTION_DESC' | translate"
            >
              <ion-label position="stacked">{{ 'HOLIDAYS.DESCRIPTION' | translate }}</ion-label>
              <ion-textarea
                [attr.aria-label]="'HOLIDAYS.DESCRIPTION' | translate"
                name="description"
                [(ngModel)]="holiday.description"
                rows="3"
              ></ion-textarea>
            </ion-item>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="holidayForm.invalid || isSaving() || selectedOfficeIds.length === 0"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  {{ 'COMMON.SAVING' | translate }}
                } @else {
                  {{ 'COMMON.SAVE' | translate }}
                }
              </ion-button>
            </div>
          </form>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 900px;
        margin: 0 auto;
      }
      .holiday-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class HolidayFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly holidaysService = inject(HolidaysService);
  private readonly officesService = inject(OfficesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  private readonly LIST_PATH = '/settings/holidays';

  readonly isSaving = signal(false);
  /**
   * True when editing an existing holiday.
   *
   * The platform only accepts an update while the holiday is still pending activation, which is
   * the same condition the list uses to offer the action, so this screen is never reached for an
   * active one.
   */
  readonly isEditMode = signal(false);
  private holidayId?: number;
  holiday: PostHolidaysRequest = {};
  fromDate: string | null = null;
  toDate: string | null = null;
  repaymentsRescheduledTo: string | null = null;

  readonly offices = signal<GetOfficesResponse[]>([]);
  selectedOfficeIds: number[] = [];

  reschedulingType = 2; // Default to 'Reschedule to specified date'
  readonly reschedulingTypeOptions = signal<{ id: number; value: string }[]>([]);
  ngOnInit(): void {
    this.loadOffices();
    this.loadReschedulingOptions();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.holidayId = Number(id);
      this.isEditMode.set(true);
      this.loadHoliday();
    }
  }

  private loadHoliday(): void {
    if (!this.holidayId) {
      return;
    }
    this.holidaysService.getHolidaysHolidayId(this.holidayId).subscribe({
      next: (data) => {
        this.holiday = { name: data.name };
        this.fromDate = pickerDate(data.fromDate);
        this.toDate = pickerDate(data.toDate);
        this.repaymentsRescheduledTo = pickerDate(data.repaymentsRescheduledTo);
        // A holiday that names a date to move repayments to was created with that rule; one that
        // does not carries the "next repayment date" rule instead.
        this.reschedulingType = this.repaymentsRescheduledTo ? 2 : 1;
        if (typeof data.officeId === 'number') {
          this.selectedOfficeIds = [data.officeId];
        }
      },
      error: () => this.notifications.error('Failed to load holiday'),
    });
  }

  private loadOffices(): void {
    this.officesService.getOffices(true).subscribe({
      next: (data) => {
        this.offices.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load offices', err);
        this.notifications.error('Failed to load offices');
      },
    });
  }

  private loadReschedulingOptions(): void {
    this.holidaysService.getHolidaysTemplate().subscribe({
      next: (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          this.reschedulingTypeOptions.set(parsed || []);
        } catch {
          this.reschedulingTypeOptions.set([
            { id: 1, value: 'Reschedule to next repayment date' },
            { id: 2, value: 'Reschedule to specified date' },
          ]);
        }
      },
      error: () => {
        this.reschedulingTypeOptions.set([
          { id: 1, value: 'Reschedule to next repayment date' },
          { id: 2, value: 'Reschedule to specified date' },
        ]);
      },
    });
  }

  onSubmit(): void {
    if (!this.fromDate || !this.toDate) {
      return;
    }

    if (this.reschedulingType === 2 && !this.repaymentsRescheduledTo) {
      return;
    }

    this.isSaving.set(true);

    const payload: Record<string, unknown> = {
      name: this.holiday.name,
      description: this.holiday.description,
      fromDate: formatDateToFineract(this.fromDate),
      toDate: formatDateToFineract(this.toDate),
      offices: this.selectedOfficeIds.map((id) => ({ officeId: id })),
      reschedulingType: this.reschedulingType,
      dateFormat: 'dd MMMM yyyy',
      locale: 'en',
    };

    if (this.reschedulingType === 2 && this.repaymentsRescheduledTo) {
      payload['repaymentsRescheduledTo'] = formatDateToFineract(this.repaymentsRescheduledTo);
    }

    const request$ =
      this.isEditMode() && this.holidayId
        ? this.holidaysService.putHolidaysHolidayId(
            this.holidayId,
            payload as PutHolidaysHolidayIdRequest,
          )
        : this.holidaysService.postHolidays(payload as PostHolidaysRequest);

    request$.subscribe({
      next: () => {
        this.notifications.success(
          this.isEditMode() ? 'Holiday updated successfully' : 'Holiday created successfully',
        );
        this.router.navigate([this.LIST_PATH]);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Failed to save holiday', err);
      },
    });
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}

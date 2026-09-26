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
import { toIsoDate } from '../../core/utils/date-formatter';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
} from '@ionic/angular/standalone';
import {
  TellerCashManagementService,
  OfficesService,
  PostTellersRequest,
  PutTellersRequest,
  GetOfficesResponse,
} from '../../api';
import { createPickersReady } from '../../shared/utils/pickers-ready';

/**
 * Component for creating and editing branch tellers.
 *
 * Provides a template-driven form that binds directly to Fineract OpenAPI
 * request models. Supports the full lifecycle of teller entity management.
 *
 * @example
 * <app-teller-form></app-teller-form>
 */
@Component({
  selector: 'app-teller-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonSpinner,
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
            {{
              isEditMode()
                ? ('TELLERS.EDIT_TELLER' | translate)
                : ('TELLERS.CREATE_TELLER' | translate)
            }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #tellerForm="ngForm" (ngSubmit)="onSubmit()" class="teller-form">
            <ion-grid class="ion-no-padding">
              <ion-row>
                <!-- Name -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.TELLER_NAME_DESC' | translate">
                    <ion-label position="stacked">{{ 'TELLERS.NAME' | translate }}</ion-label>
                    <ion-input
                      [attr.aria-label]="'TELLERS.NAME' | translate"
                      type="text"
                      name="name"
                      [(ngModel)]="teller().name"
                      required
                      id="teller-name-input"
                      data-testid="teller-name-input"
                    ></ion-input>
                  </ion-item>
                </ion-col>

                <!-- Office -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.TELLER_OFFICE_DESC' | translate">
                    <ion-label position="stacked">{{ 'TELLERS.OFFICE' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'TELLERS.OFFICE' | translate"
                      interface="popover"
                      name="officeId"
                      [(ngModel)]="teller().officeId"
                      required
                      [disabled]="isEditMode()"
                      id="teller-office-select"
                      data-testid="teller-office-select"
                    >
                      @for (office of offices(); track office.id) {
                        <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Description -->
                <ion-col size="12">
                  <ion-item
                    fill="outline"
                    [appTooltip]="'HELP.TELLER_DESCRIPTION_DESC' | translate"
                    class="full-width"
                  >
                    <ion-label position="stacked">{{
                      'TELLERS.DESCRIPTION' | translate
                    }}</ion-label>
                    <ion-textarea
                      [attr.aria-label]="'TELLERS.DESCRIPTION' | translate"
                      name="description"
                      [(ngModel)]="teller().description"
                      rows="3"
                      id="teller-description-textarea"
                      data-testid="teller-description-textarea"
                    ></ion-textarea>
                  </ion-item>
                </ion-col>

                <!-- Start Date -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.TELLER_START_DATE_DESC' | translate">
                    <ion-label position="stacked">{{ 'TELLERS.START_DATE' | translate }}</ion-label>
                    @if (pickersReady()) {
                      <ion-datetime-button
                        datetime="teller-start-date-picker"
                      ></ion-datetime-button>
                    }
                    <ion-modal [keepContentsMounted]="true">
                      <ng-template>
                        <ion-datetime
                          id="teller-start-date-picker"
                          data-testid="teller-start-date-picker"
                          presentation="date"
                          (ionChange)="onStartDateChange($event)"
                        ></ion-datetime>
                      </ng-template>
                    </ion-modal>
                  </ion-item>
                </ion-col>

                <!-- Status -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.TELLER_STATUS_DESC' | translate">
                    <ion-label position="stacked">{{ 'TELLERS.STATUS' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'TELLERS.STATUS' | translate"
                      interface="popover"
                      name="status"
                      [(ngModel)]="teller().status"
                      required
                      id="teller-status-select"
                      data-testid="teller-status-select"
                    >
                      <ion-select-option value="ACTIVE">{{
                        'COMMON.ACTIVE' | translate
                      }}</ion-select-option>
                      <ion-select-option value="INACTIVE">{{
                        'COMMON.INACTIVE' | translate
                      }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>

                <!-- Usage -->
                <ion-col size="12" size-md="6">
                  <ion-item fill="outline" [appTooltip]="'HELP.TELLER_USAGE_DESC' | translate">
                    <ion-label position="stacked">{{ 'TELLERS.USAGE' | translate }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'TELLERS.USAGE' | translate"
                      interface="popover"
                      name="usage"
                      [(ngModel)]="usage"
                      required
                      id="teller-usage-select"
                      data-testid="teller-usage-select"
                    >
                      <ion-select-option [value]="1">Cashier</ion-select-option>
                    </ion-select>
                  </ion-item>
                </ion-col>
              </ion-row>
            </ion-grid>

            <div class="form-actions">
              <ion-button
                fill="clear"
                color="medium"
                type="button"
                (click)="onCancel()"
                [disabled]="isSaving()"
                id="teller-cancel-btn"
                data-testid="teller-cancel-btn"
              >
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button
                color="primary"
                type="submit"
                [disabled]="tellerForm.invalid || isSaving()"
                id="teller-submit-btn"
                data-testid="teller-submit-btn"
              >
                @if (isSaving()) {
                  <ion-spinner name="crescent" slot="start"></ion-spinner>
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
      .teller-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
    `,
  ],
})
export class TellerFormComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  /** Service for teller management API calls */
  private readonly tellerService = inject(TellerCashManagementService);
  /** Service for retrieving office hierarchy */
  private readonly officesService = inject(OfficesService);
  /** Router for post-submission navigation */
  private readonly router = inject(Router);
  /** Activated route for retrieving the teller ID in edit mode */
  private readonly route = inject(ActivatedRoute);

  /** Base path for the teller list view */
  private readonly LIST_PATH = '/tellers';

  /** The unique identifier for the teller being edited */
  tellerId: number | null = null;
  /** Indicates if the component is in edit mode */
  readonly isEditMode = signal(false);
  /** State of the save operation */
  readonly isSaving = signal(false);

  /** Post request model instance for template data binding */
  readonly teller = signal<PostTellersRequest>({
    status: 'ACTIVE',
  });

  /** Usage value, not in PostTellersRequest but needed for form */
  usage = 1;

  /** Formatted start date for Fineract API */
  startDate: Date = new Date();
  /** List of available offices for teller assignment */
  readonly offices = signal<GetOfficesResponse[]>([]);

  /**
   * Component initialization.
   * Loads office data and checks for edit mode parameters.
   */
  ngOnInit(): void {
    this.loadOffices();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.tellerId = +id;
        this.isEditMode.set(true);
        this.loadTellerData();
      }
    });
  }

  /**
   * Retrieves the office list from the API.
   */
  private loadOffices(): void {
    this.officesService.getOffices(true).subscribe((data) => {
      this.offices.set(data);
    });
  }

  /**
   * Retrieves existing teller data for population in edit mode.
   */
  private loadTellerData(): void {
    if (!this.tellerId) return;
    this.tellerService.getTellersTellerId(this.tellerId).subscribe((data) => {
      const dateArray = data.startDate as unknown as number[];
      if (dateArray) {
        this.startDate = new Date(dateArray[0], dateArray[1] - 1, dateArray[2]);
      }
      this.teller.set({
        name: data.name,
        officeId: data.officeId,
        description: (data as Record<string, unknown>)['description'] as string,
        status: data.status as PostTellersRequest.StatusEnum,
      });
    });
  }

  onStartDateChange(event: CustomEvent): void {
    if (event.detail.value) {
      this.startDate = new Date(event.detail.value as string);
    }
  }

  /**
   * Form-submission handler.
   * Dispatches create or update requests based on the current mode.
   */
  onSubmit(): void {
    this.isSaving.set(true);
    const formattedDate = toIsoDate(this.startDate);

    if (this.isEditMode() && this.tellerId) {
      const payload: Record<string, unknown> = {
        name: this.teller().name,
        description: this.teller().description,
        startDate: formattedDate,
        status: this.teller().status === 'ACTIVE' ? 300 : 400,
        dateFormat: 'yyyy-MM-dd',
        locale: 'en',
      };
      this.tellerService.putTellersTellerId(this.tellerId, payload as PutTellersRequest).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      const payload: Record<string, unknown> = {
        ...this.teller(),
        startDate: formattedDate,
        status: this.teller().status === 'ACTIVE' ? 300 : 400,
        dateFormat: 'yyyy-MM-dd',
        locale: 'en',
      };

      this.tellerService.postTellers(payload as PostTellersRequest).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  /**
   * Handles user cancellation of the form operation.
   */
  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}

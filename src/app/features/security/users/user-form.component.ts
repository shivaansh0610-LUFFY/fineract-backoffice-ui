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
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  UsersService,
  PostUsersRequest,
  PutUsersUserIdRequest,
  GetUsersTemplateResponse,
  RoleData,
} from '../../../api';

/**
 * Component for creating and editing system users.
 */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    IonButton,
    IonSpinner,
    IonInput,
    IonItem,
    IonLabel,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonCheckbox,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ isEditMode() ? ('USERS.EDIT_USER' | translate) : ('USERS.CREATE_USER' | translate) }}
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <form #userForm="ngForm" (ngSubmit)="onSubmit()" class="user-form">
            <div class="form-grid">
              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'USERS.USERNAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'USERS.USERNAME' | translate"
                  name="username"
                  [(ngModel)]="user().username"
                  required
                  [disabled]="isEditMode()"
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.FIRST_NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.FIRST_NAME' | translate"
                  name="firstname"
                  [(ngModel)]="user().firstname"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'CLIENTS.LAST_NAME' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'CLIENTS.LAST_NAME' | translate"
                  name="lastname"
                  [(ngModel)]="user().lastname"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.EMAIL' | translate }}</ion-label>
                <ion-input
                  [attr.aria-label]="'COMMON.EMAIL' | translate"
                  type="email"
                  name="email"
                  [(ngModel)]="user().email"
                  required
                ></ion-input>
              </ion-item>

              <ion-item fill="outline">
                <ion-label position="stacked">{{ 'COMMON.OFFICE' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'COMMON.OFFICE' | translate"
                  interface="popover"
                  name="officeId"
                  [(ngModel)]="user().officeId"
                  required
                >
                  @for (office of offices(); track office['id']) {
                    <ion-select-option [value]="office['id']">{{
                      office['name']
                    }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>

              @if (!isEditMode()) {
                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'USERS.PASSWORD' | translate }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'USERS.PASSWORD' | translate"
                    type="password"
                    name="password"
                    [(ngModel)]="user().password"
                    required
                  ></ion-input>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'USERS.REPEAT_PASSWORD' | translate
                  }}</ion-label>
                  <ion-input
                    [attr.aria-label]="'USERS.REPEAT_PASSWORD' | translate"
                    type="password"
                    name="repeatPassword"
                    [(ngModel)]="user().repeatPassword"
                    required
                  ></ion-input>
                </ion-item>
              }

              <ion-item fill="outline" class="full-width">
                <ion-label position="stacked">{{ 'USERS.ROLES' | translate }}</ion-label>
                <ion-select
                  [attr.aria-label]="'USERS.ROLES' | translate"
                  interface="popover"
                  name="roles"
                  [(ngModel)]="user().roles"
                  multiple
                  required
                >
                  @for (role of availableRoles(); track role.id) {
                    <ion-select-option [value]="role.id">{{ role.name }}</ion-select-option>
                  }
                </ion-select>
              </ion-item>
            </div>

            <div class="checkbox-container" style="display: flex; gap: 16px; flex-wrap: wrap;">
              <ion-checkbox name="passwordNeverExpires" [(ngModel)]="user().passwordNeverExpires">
                {{ 'USERS.PASSWORD_NEVER_EXPIRES' | translate }}
              </ion-checkbox>

              <ion-checkbox name="sendPasswordToEmail" [(ngModel)]="user().sendPasswordToEmail">
                {{ 'USERS.SEND_PASSWORD_TO_EMAIL' | translate }}
              </ion-checkbox>
            </div>

            <div class="form-actions">
              <ion-button fill="clear" type="button" (click)="onCancel()" [disabled]="isSaving()">
                {{ 'COMMON.CANCEL' | translate }}
              </ion-button>
              <ion-button color="primary" type="submit" [disabled]="userForm.invalid || isSaving()">
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
      .user-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-container {
        padding: 8px 0;
      }
    `,
  ],
})
export class UserFormComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly LIST_PATH = '/security/users';

  userId: number | null = null;
  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);

  readonly user = signal<PostUsersRequest>({
    passwordNeverExpires: false,
    sendPasswordToEmail: false,
    roles: [],
  });

  readonly offices = signal<Record<string, unknown>[]>([]);
  readonly availableRoles = signal<RoleData[]>([]);

  ngOnInit(): void {
    this.loadMetadata();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.userId = +id;
        this.isEditMode.set(true);
        this.loadUserData();
      }
    });
  }

  private loadMetadata(): void {
    this.usersService.getUsersTemplate().subscribe((template: GetUsersTemplateResponse) => {
      this.offices.set((template.allowedOffices as unknown as Record<string, unknown>[]) || []);
      this.availableRoles.set(template.availableRoles || []);
    });
  }

  private loadUserData(): void {
    if (!this.userId) return;
    this.usersService.getUsersUserId(this.userId).subscribe((data) => {
      this.user.set({
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        officeId: data.officeId,
        passwordNeverExpires: data.passwordNeverExpires,
        sendPasswordToEmail: false,
        roles: data.selectedRoles?.map((r) => r.id!) || [],
      });
    });
  }

  onSubmit(): void {
    this.isSaving.set(true);

    if (this.isEditMode() && this.userId) {
      const putRequest: PutUsersUserIdRequest = {
        firstname: this.user().firstname,
        lastname: this.user().lastname,
        email: this.user().email,
        officeId: this.user().officeId,
        roles: this.user().roles,
        sendPasswordToEmail: this.user().sendPasswordToEmail,
      };

      this.usersService.putUsersUserId(this.userId, putRequest).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    } else {
      this.usersService.postUsers(this.user()).subscribe({
        next: () => this.router.navigate([this.LIST_PATH]),
        error: () => this.isSaving.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate([this.LIST_PATH]);
  }
}

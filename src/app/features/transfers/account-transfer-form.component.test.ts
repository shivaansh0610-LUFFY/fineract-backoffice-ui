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

import { createSpyObj, SpyObj } from '../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountTransferFormComponent } from './account-transfer-form.component';
import { AccountTransfersService, OfficesService, ClientService } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { provideTranslateTesting } from '../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('AccountTransferFormComponent', () => {
  let component: AccountTransferFormComponent;
  let fixture: ComponentFixture<AccountTransferFormComponent>;
  let transfersServiceSpy: SpyObj<AccountTransfersService>;
  let officesServiceSpy: SpyObj<OfficesService>;
  let clientServiceSpy: SpyObj<ClientService>;
  let routerSpy: SpyObj<Router>;
  let activatedRouteQueryParams: Record<string, string>;

  beforeEach(async () => {
    transfersServiceSpy = createSpyObj(['postAccounttransfers']);
    officesServiceSpy = createSpyObj(['getOffices']);
    clientServiceSpy = createSpyObj(['getClients', 'getClientsClientIdAccounts']);
    routerSpy = createSpyObj(['navigate']);

    officesServiceSpy.getOffices.mockReturnValue(
      of([{ id: 1, name: 'Head Office' }]) as unknown as Observable<never>,
    );
    clientServiceSpy.getClients.mockReturnValue(
      of({ pageItems: [{ id: 10, displayName: 'John Doe' }] }) as unknown as Observable<never>,
    );
    clientServiceSpy.getClientsClientIdAccounts.mockReturnValue(
      of({
        savingsAccounts: [{ id: 22, accountNo: 'S01', productName: 'Savings A' }],
        loanAccounts: [{ id: 11, accountNo: 'L01', productName: 'Loan A' }],
      }) as unknown as Observable<never>,
    );

    activatedRouteQueryParams = {
      fromOfficeId: '1',
      fromClientId: '10',
      fromAccountId: '22',
      fromAccountType: '2',
    };

    await TestBed.configureTestingModule({
      imports: [AccountTransferFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: AccountTransfersService, useValue: transfersServiceSpy },
        { provide: OfficesService, useValue: officesServiceSpy },
        { provide: ClientService, useValue: clientServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: activatedRouteQueryParams,
            },
          },
        },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountTransferFormComponent);
    component = fixture.componentInstance;
    routerSpy.navigate.mockClear();
  });

  it('should create and load offices, client list, and accounts on init', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(officesServiceSpy.getOffices).toHaveBeenCalled();
    expect(clientServiceSpy.getClients).toHaveBeenCalled();
    expect(clientServiceSpy.getClientsClientIdAccounts).toHaveBeenCalledWith(10);
    expect(component.fromAccounts()).toHaveLength(1);
    expect(component.fromAccounts()[0].id).toBe(22);
  });

  it('should support switching office and loading clients', () => {
    fixture.detectChanges();
    component.request.toOfficeId = '1';
    component.onOfficeChange('to');

    expect(clientServiceSpy.getClients).toHaveBeenCalledWith(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(component.toClients()).toHaveLength(1);
  });

  it('should load loan accounts when account type changes to loan', () => {
    fixture.detectChanges();
    component.request.toClientId = '10';
    component.request.toAccountType = '1';
    component.onAccountTypeChange('to');

    expect(clientServiceSpy.getClientsClientIdAccounts).toHaveBeenCalledWith(10);
    expect(component.toAccounts()).toHaveLength(1);
    expect(component.toAccounts()[0].id).toBe(11); // Loan A
  });

  it('should submit transfer request successfully', () => {
    transfersServiceSpy.postAccounttransfers.mockReturnValue(
      of({}) as unknown as Observable<never>,
    );
    fixture.detectChanges();

    component.request.fromOfficeId = '1';
    component.request.fromClientId = '10';
    component.request.fromAccountId = '22';
    component.request.fromAccountType = '2';
    component.request.toOfficeId = '1';
    component.request.toClientId = '10';
    component.request.toAccountId = '22';
    component.request.toAccountType = '2';
    component.request.transferAmount = '100';
    component.request.transferDescription = 'Payment';
    component.transferDate = new Date(2026, 5, 16);

    component.onSubmit();

    expect(transfersServiceSpy.postAccounttransfers).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', '10']);
  });

  it('should handle submission error', () => {
    transfersServiceSpy.postAccounttransfers.mockReturnValue(
      throwError(() => new Error('Error')) as unknown as Observable<never>,
    );
    vi.spyOn(console, 'error');
    fixture.detectChanges();

    component.onSubmit();
    expect(console.error).toHaveBeenCalled();
  });

  it('should navigate away on cancel', () => {
    fixture.detectChanges();
    routerSpy.navigate.mockClear();
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients/view', '10']);
  });

  it('should navigate to clients list on cancel if no client ID is set', () => {
    fixture.detectChanges();
    component.request.fromClientId = undefined;
    routerSpy.navigate.mockClear();
    component.onCancel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients']);
  });

  // Regression coverage for #585: required fields carried no visible marker, and an invalid
  // field produced no on-screen message even after the user interacted with it.
  describe('required-field feedback', () => {
    it('marks every required field and leaves the optional description unmarked', () => {
      fixture.detectChanges();

      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      const markerCount = (html.match(/class="required-marker"/g) ?? []).length;
      // fromOfficeId, fromClientId, fromAccountType, fromAccountId,
      // toOfficeId, toClientId, toAccountType, toAccountId, transferAmount.
      expect(markerCount).toBe(9);
    });

    it('shows no field error until the user has touched the field', () => {
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="transfer-amount-error"]')).toBeNull();
    });

    it('shows the required message once an empty required field is blurred', () => {
      fixture.detectChanges();

      const amountInput = fixture.nativeElement.querySelector('#transfer-amount-input')!;
      amountInput.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('[data-testid="transfer-amount-error"]');
      expect(error).not.toBeNull();
      // provideTranslateTesting() loads no catalogue, so the pipe renders the key itself.
      expect(error!.textContent).toContain('COMMON.REQUIRED');
    });

    it('hides the field error again once the field is filled in', () => {
      fixture.detectChanges();
      const amountInput = fixture.nativeElement.querySelector('#transfer-amount-input')!;
      amountInput.dispatchEvent(new CustomEvent('ionBlur'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="transfer-amount-error"]')).not.toBeNull();

      // Go through the same event the CVA itself listens for (it reads `$event.target.value`,
      // not `detail`), rather than mutating the bound property directly, so this exercises
      // what a real keystroke does.
      (amountInput as HTMLInputElement).value = '100';
      amountInput.dispatchEvent(new CustomEvent('ionInput'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="transfer-amount-error"]')).toBeNull();
    });

    it('shows a hint next to the submit button while the form is incomplete', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('[data-testid="transfer-submit-hint"]');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toContain('COMMON.COMPLETE_REQUIRED_FIELDS');
    });

    it('hides the submit hint once every required field is filled in', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.request.fromOfficeId = '1';
      component.request.fromClientId = '10';
      component.request.fromAccountType = '2';
      component.request.fromAccountId = '22';
      component.request.toOfficeId = '1';
      component.request.toClientId = '10';
      component.request.toAccountType = '2';
      component.request.toAccountId = '22';
      component.request.transferAmount = '100';
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="transfer-submit-hint"]')).toBeNull();
    });
  });
});

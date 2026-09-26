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

/**
 * Every bulk-import entity the screen offers is one the platform recognises.
 *
 * `GET /imports?entityType=` takes the platform's own vocabulary, and for seven of the eighteen
 * entries this screen offers it is not the word the screen used: `clients`, `savingsaccounts`,
 * `glaccounts`, `journalentries`, `recurringdepositaccounts`, `loanrepayments` and
 * `recurringdeposittransactions` are all refused with a 404. `clients` is the initial selection,
 * so the import history 404'd on first load, and `loadImportHistory` logs the failure to the
 * console and leaves the table empty — nothing on screen said why.
 *
 * Only a real backend can answer this. A mocked spec would assert that the UI sends the word the
 * mock was written to expect, which is how the wrong seven survived in the first place.
 *
 *   npm run test:e2e:local -- e2e/bulk-import-entity-types.spec.ts
 */

import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';

test.use({ video: 'on', trace: 'on' });

test('every offered entity type is one the platform accepts', async ({ page }) => {
  await login(page);
  await page.goto('/system/bulk-import', { waitUntil: 'networkidle' });

  // The screen's own list, so a new entry added later is covered without touching this spec.
  // Scoped to the entity picker: an unscoped `ion-select-option` query also collects the
  // paginator's page sizes, and "5 → 404" is a confusing way to report a passing screen.
  const entities = await page.evaluate(() => {
    const select = document.querySelector('[data-testid="bulk-import-entity-type"]');
    return [...(select?.querySelectorAll('ion-select-option') ?? [])].map((option) => ({
      value: String((option as HTMLElement & { value?: unknown }).value ?? ''),
      label: option.textContent?.trim() ?? '',
    }));
  });
  expect(entities.length, 'no entity types rendered').toBeGreaterThan(10);

  const refused: string[] = [];

  for (const entity of entities) {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/imports?entityType='), { timeout: 20000 }),
      page.evaluate((value) => {
        const select = document.querySelector('[data-testid="bulk-import-entity-type"]') as
          (HTMLElement & { value?: unknown }) | null;
        if (!select) {
          return;
        }
        select.value = value;
        select.dispatchEvent(new CustomEvent('ionChange', { detail: { value }, bubbles: true }));
      }, entity.value),
    ]);

    if (response.status() !== 200) {
      const sent = decodeURIComponent(new URL(response.url()).searchParams.get('entityType') ?? '');
      refused.push(`${entity.label} sent "${sent}" → ${response.status()}`);
    }
  }

  expect(refused, `entity types the platform refused:\n  ${refused.join('\n  ')}`).toEqual([]);
});

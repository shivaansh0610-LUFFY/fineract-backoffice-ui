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
 * `.form-grid` reflows to one column when two will not fit, at both viewports.
 *
 * `repeat(2, 1fr)` cannot narrow past its content — `1fr` is `minmax(auto, 1fr)`, so the column
 * holding the widest control keeps its intrinsic width and the other collapses. At 320px, the
 * project's declared minimum, that rendered GL Code and Account Usage 4px wide on Create GL
 * Account and pushed the right-hand column of Create Loan 52px past its card.
 *
 * Neither defect moves `document.scrollWidth`, so a page-overflow assertion cannot see them.
 * These cases measure the controls themselves instead: every field wide enough to use, and
 * nothing extending past the card that contains it.
 *
 * The desktop half is not a formality — a fix that simply stacked everything would pass the
 * narrow assertions while making every form on a 1280px screen a single tall column.
 *
 *   npm run test:e2e:local -- e2e/form-layout-reflow.spec.ts
 */

import { test, expect, Page } from './fixtures';
import { login } from './utils/fineract-login';

/** The narrowest viewport the project supports; see scripts/check-responsive.mjs. */
const NARROW = { width: 320, height: 844 };
const WIDE = { width: 1280, height: 900 };

/**
 * Forms that had the collapse, plus one that did not, so a regression that only ever fires on
 * the two known-bad routes still gets caught somewhere else.
 */
const FORMS = [
  { name: 'Create GL Account', path: '/accounting/chart-of-accounts/create' },
  { name: 'Create Loan', path: '/loans/create' },
  { name: 'Create Office', path: '/organization/offices/create' },
  { name: 'Create Staff', path: '/organization/staff/create' },
];

/** Geometry of every field on the form, and of the card that should contain them. */
async function measureFields(page: Page) {
  return page.evaluate(() => {
    const deep = (selector: string): Element[] => {
      const found: Element[] = [];
      const walk = (root: Document | ShadowRoot) => {
        found.push(...root.querySelectorAll(selector));
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot) {
            walk(element.shadowRoot);
          }
        }
      };
      walk(document);
      return found;
    };

    const card = document.querySelector('ion-card')?.getBoundingClientRect();
    const fields = deep('ion-item')
      .map((item) => {
        const box = item.getBoundingClientRect();
        const label = item.querySelector('ion-label')?.textContent?.trim() ?? '';
        return { label, width: Math.round(box.width), right: Math.round(box.right) };
      })
      // Zero-width entries are controls in a collapsed section, not the ones under test.
      .filter((field) => field.width > 0);

    return { cardRight: card ? Math.round(card.right) : null, fields };
  });
}

test.describe('form layout at the narrow viewport', () => {
  test.use({ viewport: NARROW });

  for (const form of FORMS) {
    test(`${form.name} gives every field a usable width at 320px`, async ({ page }) => {
      await login(page);
      await page.goto(form.path);
      // Create Loan holds a spinner until its products resolve, and `networkidle` can land
      // before that: measuring then finds no fields at all.
      await expect(page.locator('ion-item, .form-field').first()).toBeVisible();

      const { cardRight, fields } = await measureFields(page);
      expect(fields.length, `${form.name} rendered no fields`).toBeGreaterThan(0);

      // 120px is generous: it is below any sensible field but far above the 4px slivers the
      // two-column grid produced, so this fails loudly on a collapse without pinning the design.
      const collapsed = fields.filter((field) => field.width < 120);
      expect(
        collapsed,
        `fields collapsed at 320px: ${collapsed.map((f) => `${f.label} ${f.width}px`).join(', ')}`,
      ).toEqual([]);

      // A field wider than its card is one the user cannot finish reading.
      if (cardRight !== null) {
        const overflowing = fields.filter((field) => field.right > cardRight + 1);
        expect(
          overflowing,
          `fields past the card edge (${cardRight}px): ${overflowing
            .map((f) => `${f.label} ends at ${f.right}px`)
            .join(', ')}`,
        ).toEqual([]);
      }
    });
  }

  test('no page-level horizontal scroll at 320px', async ({ page }) => {
    await login(page);
    for (const form of FORMS) {
      await page.goto(form.path);
      await expect(page.locator('ion-item, .form-field').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${form.name} scrolls horizontally by ${overflow}px`).toBeLessThanOrEqual(2);
    }
  });
});

test.describe('form layout at the wide viewport', () => {
  test.use({ viewport: WIDE });

  test('Create GL Account still uses more than one column at 1280px', async ({ page }) => {
    await login(page);
    await page.goto('/accounting/chart-of-accounts/create');
    await expect(page.locator('ion-item').first()).toBeVisible();

    // Two fields sharing a row is the whole point of the grid; asserting on distinct `left`
    // offsets says that without pinning an exact column count.
    const distinctRows = await page.evaluate(() => {
      const items = [...document.querySelectorAll('ion-item')]
        .map((item) => item.getBoundingClientRect())
        .filter((box) => box.width > 0);
      const tops = new Set(items.map((box) => Math.round(box.top)));
      return { fields: items.length, rows: tops.size };
    });

    expect(distinctRows.fields).toBeGreaterThan(2);
    expect(
      distinctRows.rows,
      'every field landed on its own row — the grid collapsed on desktop too',
    ).toBeLessThan(distinctRows.fields);
  });
});

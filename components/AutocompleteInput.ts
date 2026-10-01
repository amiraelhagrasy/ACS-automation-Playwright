import { expect, type Locator, type Page } from '@playwright/test';
import { ModalComponent } from './ModalComponent';

//wraps the site's autocomplete widget: fill the input, wait for the matching suggestion in the ".autocomplete-result"
//dropdown, click it. Used for every autocomplete field across the app (transport company, loading country/port,
//currency, destination country/port, etc.). Uses fill() rather than pressSequentially(): fields elsewhere in this
//app that live-filter as you type have hung on pressSequentially() when the field re-renders mid-keystroke (see
//newImportManifest.ts's searchByReferenceNumber() history) - fill() has worked reliably here and avoids that risk:
export class AutocompleteInput {
    private readonly modal: ModalComponent;

    constructor(private readonly page: Page) {
        this.modal = new ModalComponent(page);
    }

    async select(input: Locator, value: string): Promise<void> {
        //the default 5s expect timeout (playwright.config.ts) isn't always enough right after a page navigation
        //(e.g. right after clicking a "create" button) - give it more headroom than other post-navigation waits
        //elsewhere in this codebase, since even 15s has intermittently not been enough under load:
        await expect(input).toBeVisible({ timeout: 25_000 });

        //a leftover popup (e.g. a welcome/license notice right after a fresh login) can sit over this field and
        //block the click indefinitely, same class of issue clickAirServices() already guards against (confirmed
        //live, 2026-09-22: hung 160+ retries before the whole run timed out). Only close a modal REACTIVELY,
        //after a plain attempt actually fails - this field is very often filled from inside a legitimate wizard
        //modal, so closing one preemptively on every attempt risks dismissing that wizard itself instead of an
        //actual stray popup:
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) {
                await this.modal.closeIfPresent();
            }

            const filled = await input
                .click({ timeout: 15_000 })
                .then(() => input.fill(value, { timeout: 15_000 }))
                .then(() => true)
                .catch(() => false);

            if (filled) {
                break;
            }
        }

        const option = this.page
            .locator('.autocomplete-result')
            .filter({ hasText: value })
            .and(this.page.locator(':visible'))
            .first();

        await expect(option).toBeVisible({ timeout: 10_000 });
        await option.click();
    }

    //some autocomplete fields (e.g. export manifest's "رقم وكيل الشحن") show a fixed, unfiltered list of options
    //regardless of what's typed - the typed value just triggers the dropdown to open, it doesn't filter by text.
    //For those, pick the first visible result instead of filtering by the typed value:
    async selectFirst(input: Locator, triggerText: string): Promise<void> {
        //the default 5s expect timeout (playwright.config.ts) isn't always enough right after a page navigation
        //(e.g. right after clicking a "create" button) - give it more headroom than other post-navigation waits
        //elsewhere in this codebase, since even 15s has intermittently not been enough under load:
        await expect(input).toBeVisible({ timeout: 25_000 });

        //same stray-popup-blocks-the-click-or-fill issue select() above guards against:
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) {
                await this.modal.closeIfPresent();
            }

            const filled = await input
                .click({ timeout: 15_000 })
                .then(() => input.fill(triggerText, { timeout: 15_000 }))
                .then(() => true)
                .catch(() => false);

            if (filled) {
                break;
            }
        }

        const option = this.page
            .locator('.autocomplete-result')
            .and(this.page.locator(':visible'))
            .first();

        await expect(option).toBeVisible({ timeout: 10_000 });
        await option.click();
    }
}

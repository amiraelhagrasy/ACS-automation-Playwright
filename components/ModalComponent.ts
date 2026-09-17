import type { Page } from '@playwright/test';

//wraps the site's "vx1 modal show" popup pattern used for license warnings, delete confirmations, and success
//alerts. Every method re-queries the live DOM rather than caching a single Locator up front, since Playwright
//locators re-resolve lazily anyway and these popups get replaced/re-rendered in place between calls:
export class ModalComponent {
    constructor(private readonly page: Page) {}

    private locator() {
        return this.page.locator('div.vx1.modal.show');
    }

    //closes the topmost popup via its "إغلاق" button, falling back to the "x" close icon. Scoped to .last() for
    //the same stacked-popup reason as confirmIfPresent()/closeAllIfPresent():
    async closeIfPresent(): Promise<void> {
        //wait up to 3s for a modal to appear at all (e.g. right after a navigation) before checking count/acting:
        const appeared = await this.locator()
            .first()
            .waitFor({ state: 'visible', timeout: 3_000 })
            .then(() => true)
            .catch(() => false);

        if (!appeared) {
            return;
        }

        const modals = this.locator();
        const count = await modals.count();
        const modal = modals.last();

        const closeTextButton = modal.getByRole('button', { name: 'إغلاق' });
        const hasCloseTextButton = await closeTextButton.isVisible().catch(() => false);

        if (hasCloseTextButton) {
            await closeTextButton.click();
        } else {
            await modal.locator('#modelcloseicon').click({ force: true });
        }

        //don't waitFor(hidden) on modal itself - .last() re-resolves to whichever modal is now on top once this
        //one closes (e.g. a second, previously-stacked-underneath popup), not the one we just clicked, so instead
        //wait for the overall count to decrease, same as closeAllIfPresent():
        await this.page
            .waitForFunction(
                (expectedCount) => document.querySelectorAll('div.vx1.modal.show').length < expectedCount,
                count,
                { timeout: 10_000 }
            )
            .catch(() => {});
    }

    //clicks a named button (e.g. "نعم") on the topmost popup, if present - for confirm-style dialogs where
    //confirming, not closing, is the goal (e.g. "هل أنت متأكد من تنفيذ عملية حذف؟"). Scoped to .last() for the same
    //reason as closeAllIfPresent(): a stacked leftover popup (e.g. an unclosed success alert from a prior action)
    //can sit on top of/alongside this one, and an unscoped locator risks the click targeting or being blocked by
    //the wrong one:
    async confirmIfPresent(buttonName: string): Promise<void> {
        const modal = this.locator().last();

        const visible = await modal
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false);

        if (!visible) {
            return;
        }

        await modal.getByRole('button', { name: buttonName }).click();
        await this.page.waitForTimeout(1_000);
    }

    //closes every stacked popup, one at a time (topmost/most recently opened first). Some flows stack a second
    //popup (e.g. a success alert) on top of an underlying one (e.g. an edit-form modal), and closeIfPresent()
    //alone can't cleanly handle that: with two matches, its .isVisible()/.waitFor() calls operate ambiguously
    //across both instead of the specific one on top. Always targeting .last() avoids that:
    async closeAllIfPresent(): Promise<void> {
        while (true) {
            const modals = this.locator();
            const count = await modals.count();

            if (count === 0) {
                return;
            }

            const modal = modals.last();

            //identical stacked modals (e.g. the same license-expiry warning appearing more than once) can end up
            //visually overlapping such that .last()'s own close icon gets covered by another stacked modal's
            //content instead of being the true topmost element at that point - force bypasses that pointer-event
            //interception check since we've already confirmed via count/visibility that a modal to close exists:
            await modal.locator('#modelcloseicon').click({ force: true });

            //don't waitFor(hidden) on modal itself - .last() re-resolves to whichever modal is now on top once
            //this one closes, not the one we just clicked, so instead wait for the overall count to decrease:
            await this.page
                .waitForFunction(
                    (expectedCount) => document.querySelectorAll('div.vx1.modal.show').length < expectedCount,
                    count,
                    { timeout: 10_000 }
                )
                .catch(() => {});
        }
    }
}

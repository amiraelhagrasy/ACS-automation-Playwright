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

        //confirmed live, 2026-09-28: a new "الشروط والأحكام" (Terms & Conditions) popup can show up on login,
        //blocking everything - it has neither an "إغلاق" button nor a #modelcloseicon, only "قبول" (Accept), so
        //the old fallback chain hung the full 45s trying to click a close icon that doesn't exist on it. Checked
        //before the other two:
        //confirmed live, 2026-09-29: the "الشروط والأحكام" modal's body is very long (hundreds of lines of legal
        //text), and its "قبول" button at the very bottom can still be unrendered at the instant this check runs
        //even though the modal container itself has already appeared - an instant isVisible() (no wait) then
        //wrongly reports false, falling through to #modelcloseicon, which doesn't exist on this modal and hangs
        //the full 45s. Give it a short real wait instead of a single instant check:
        const acceptButton = modal.getByRole('button', { name: 'قبول' });
        const hasAcceptButton = await acceptButton
            .waitFor({ state: 'visible', timeout: 3_000 })
            .then(() => true)
            .catch(() => false);

        const closeTextButton = modal.getByRole('button', { name: 'إغلاق' });
        const hasCloseTextButton = await closeTextButton
            .waitFor({ state: 'visible', timeout: 3_000 })
            .then(() => true)
            .catch(() => false);

        if (hasAcceptButton) {
            //confirmed live, 2026-09-30: the قبول button can pass every actionability check (visible, enabled,
            //stable) yet still get reported as intercepted by its OWN parent .modal-footer - a rendering/overlay
            //quirk, not a real blocker. force bypasses that spurious "receives events" check, same as the
            //#modelcloseicon fallback below already does:
            await acceptButton.click({ force: true });
        } else if (hasCloseTextButton) {
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
        //confirmed live, 2026-09-28: the portal's backend can reject every single "قبول" (Accept) click on the
        //"الشروط والأحكام" popup with its own "تعذر قبول الشروط والأحكام، يرجى المحاولة مرة أخرى" alert - a genuine
        //portal-side failure, not a click/timing issue, since it repeats identically on both Chrome and Firefox no
        //matter how many times it's retried. Without a cap, this loop would retry forever, quietly burning the
        //whole surrounding test/fixture timeout (confirmed: turned a 120s fixture hang into a 600s test-timeout
        //hang) instead of failing fast with a diagnosable reason:
        for (let iteration = 0; iteration < 5; iteration++) {
            const modals = this.locator();
            const count = await modals.count();

            if (count === 0) {
                return;
            }

            const modal = modals.last();

            const rejectionAlert = modal.getByText('تعذر قبول الشروط والأحكام');
            if (await rejectionAlert.isVisible().catch(() => false)) {
                throw new Error(
                    'ModalComponent.closeAllIfPresent(): the portal rejected accepting "الشروط والأحكام" ' +
                        '(تعذر قبول الشروط والأحكام، يرجى المحاولة مرة أخرى) - this is a portal-side failure, not ' +
                        'something a retry here can fix.'
                );
            }

            //confirmed live, 2026-09-28: the "الشروط والأحكام" (Terms & Conditions) popup - see closeIfPresent()'s
            //own comment - has no #modelcloseicon at all, only a "قبول" (Accept) button, so check for that first.
            //confirmed live, 2026-09-29: this modal's body is very long and its "قبول" button can still be
            //unrendered at the instant this check runs - use a short real wait, not an instant isVisible():
            const acceptButton = modal.getByRole('button', { name: 'قبول' });
            const hasAcceptButton = await acceptButton
                .waitFor({ state: 'visible', timeout: 3_000 })
                .then(() => true)
                .catch(() => false);

            const postClickTimeoutMs = 10_000;

            if (hasAcceptButton) {
                //confirmed live, 2026-09-30: same spurious "own .modal-footer intercepts pointer events" issue as
                //closeIfPresent() above - force bypasses it:
                await acceptButton.click({ force: true });
                //a one-off screenshot once showed a loading spinner still on this button, suggesting a genuinely
                //slow (but real) backend request - tried extending this wait to 25s on that theory, but a fuller
                //run showed the SAME popup stuck for a full 10-minute test timeout with the button back in its
                //resting state (no spinner) - i.e. the portal keeps rejecting/re-showing this popup regardless of
                //how long we wait, matching the already-documented persistent-rejection issue, not a slow request.
                //Reverted: a longer wait here doesn't fix a persistent rejection, it just fails slower:
            } else {
                //identical stacked modals (e.g. the same license-expiry warning appearing more than once) can end up
                //visually overlapping such that .last()'s own close icon gets covered by another stacked modal's
                //content instead of being the true topmost element at that point - force bypasses that pointer-event
                //interception check since we've already confirmed via count/visibility that a modal to close exists:
                await modal.locator('#modelcloseicon').click({ force: true });
            }

            //don't waitFor(hidden) on modal itself - .last() re-resolves to whichever modal is now on top once
            //this one closes, not the one we just clicked, so instead wait for the overall count to decrease:
            await this.page
                .waitForFunction(
                    (expectedCount) => document.querySelectorAll('div.vx1.modal.show').length < expectedCount,
                    count,
                    { timeout: postClickTimeoutMs }
                )
                .catch(() => {});
        }
    }
}

import { ViewTransitManifestPage } from './viewTransit';

//page object for the ECL (خطاب تعديل إلكتروني) flow on an accepted transit manifest - mirrors
//CreateNewExportEclPage, reusing the same generic button-text/data-i18n based methods since the ECL screens
//themselves aren't manifest-type-specific. Extends ViewTransitManifestPage for the shared search/status/view
//methods further up the chain (NewImportManPage). Like export (and unlike import), transit manifests only
//have one ECL type - clicking "إنشاء خطاب تعديل إلكتروني" lands directly on the header edit screen, no ECL type
//selection step:
export class CreateNewTransitEclPage extends ViewTransitManifestPage {

    // ---- 1) create the ECL ----

    //clicks "إنشاء خطاب تعديل إلكتروني" on the manifest's header screen:
    async clickCreateElectronicAmendmentLetterButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'إنشاء خطاب تعديل إلكتروني' });

        await this.waitForPageIdle();
        await button.click();
    }

    // ---- 2) view the opened ECL letter ----

    //opens the (draft) ECL letter row from the ECL History tab's table:
    async openEclLetterRow(): Promise<void> {
        const row = this.page.locator('tbody tr').filter({
            has: this.page.locator('td[test-attr="shipping_agent_ecl_ecl_seq_no"]'),
        }).first();

        await this.waitForPageIdle();
        await row.click();
    }

    //reads the ECL number ("رقم خطاب التعديل الإلكتروني") from the first row in the ECL History tab's table:
    async getEclSeqNo(): Promise<string> {
        const cell = this.page.locator('td[test-attr="shipping_agent_ecl_ecl_seq_no"]').first();

        return (await cell.textContent())?.trim() ?? '';
    }

    // ---- 3) poll ECL status ----

    //reads the "الحالة" (Status) cell for an ECL row in the ECL History tab's table, given its ECL number:
    async getEclStatus(eclNumber: string): Promise<string> {
        const row = this.page.locator('tbody tr').filter({
            has: this.page.locator(
                'td[test-attr="shipping_agent_ecl_ecl_seq_no"]',
                { hasText: eclNumber }
            ),
        });

        const statusCell = row.locator('td[test-attr^="shipping_agent_air_manifest_status"]');

        return (await statusCell.textContent())?.trim() ?? '';
    }

    //calls refreshView() and checks the ECL's status every intervalMs, until it matches expectedStatus or timeoutMs
    //elapses. Returns true if the status was reached in time, false otherwise:
    async waitForEclStatus(
        eclNumber: string,
        expectedStatus: string,
        refreshView: () => Promise<void>,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 60_000;
        const timeoutMs = options.timeoutMs ?? 120_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await refreshView();

            const currentStatus = await this.getEclStatus(eclNumber);
            console.log(`ECL ${eclNumber} status: ${currentStatus}`);

            if (currentStatus === expectedStatus) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }
}

import type { Page } from '@playwright/test';
import { ViewManifestPage } from '../Import Manifest/viewManifestPage';

//the manifest list/search/view flow (search-by-reference, verify-displayed, open-by-reference, etc.) is identical
//to the import manifest (same test-attrs, same generic table markup), so this extends ViewManifestPage to
//reuse it, same as ViewExportManifestPage does. No transit-specific bill methods yet - add them here once the
//transit bill sub-wizard ("إضافة بوليصة شحن جوي للترانزيت") is automated:
export class ViewTransitManifestPage extends ViewManifestPage {
    constructor(page: Page) {
        super(page);
    }
}

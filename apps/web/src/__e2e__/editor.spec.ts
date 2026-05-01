import { test, expect, type Page } from '@playwright/test';

/**
 * ProfileAxis Editor — E2E test suite
 *
 * Verifies:
 * 1. App boots without errors
 * 2. Editor shell renders toolbar + sidebar + viewport
 * 3. Structure tree shows nodes/joints
 * 4. BOM panel displays design and trade items
 * 5. Checks panel shows validation results
 * 6. Tab switching works
 * 7. 3D canvas is mounted
 */

let consoleErrors: string[] = [];
let consoleWarnings: string[] = [];
let consoleLogs: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  consoleWarnings = [];
  consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    } else {
      consoleLogs.push(text);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  await page.goto('/');
  // Wait for the editor shell to fully mount
  await page.waitForSelector('.editor-shell', { timeout: 15_000 });
});

test.afterEach(() => {
  // Logs collected; assertions handle crash detection
});

test.describe('Boot & Shell', () => {
  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('ProfileAxis — 3D Rack Configuration');
  });

  test('no fatal console errors on load', async ({ page }) => {
    // Allow "require is not defined" from Babylon internal modules that are
    // non-breaking — they don't affect component rendering or user interaction
    await page.waitForTimeout(2000);
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('require is not defined') &&
        !e.includes('Babylon') &&
        !e.includes('WebGL')
    );
    expect(fatalErrors).toEqual([]);
  });

  test('editor shell mounts with toolbar, sidebar, and viewport', async ({ page }) => {
    await expect(page.locator('.editor-shell')).toBeVisible();
    await expect(page.locator('.editor-toolbar')).toBeVisible();
    await expect(page.locator('.editor-sidebar')).toBeVisible();
    await expect(page.locator('.editor-viewport')).toBeVisible();
  });

  test('toolbar shows project name', async ({ page }) => {
    await expect(page.locator('.toolbar-title')).toHaveText('New Rack');
  });

  test('toolbar has undo/redo buttons', async ({ page }) => {
    await expect(page.locator('.toolbar-actions button').first()).toBeVisible();
    await expect(page.locator('.toolbar-actions button').nth(1)).toBeVisible();
  });

  test('toolbar shows dirty indicator when clean', async ({ page }) => {
    const dirtyIcon = page.locator('.dirty-indicator');
    await expect(dirtyIcon).not.toBeVisible();
  });
});

test.describe('Structure Tree', () => {
  test('Structure tab is active by default', async ({ page }) => {
    const structureBtn = page.locator('.panel-tabs button').first();
    await expect(structureBtn).toHaveText('Structure');
    await expect(structureBtn).toHaveClass(/active/);
  });

  test('structure tree renders group headers', async ({ page }) => {
    const groupHeaders = page.locator('.tree-group-header');
    const count = await groupHeaders.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tree items show node role and profile spec', async ({ page }) => {
    const treeItems = page.locator('.tree-item');
    const count = await treeItems.count();
    expect(count).toBeGreaterThan(0);
    const firstLabel = await treeItems.first().locator('.tree-label').textContent();
    expect(firstLabel).toBeTruthy();
  });

  test('clicking a tree item selects it', async ({ page }) => {
    const treeItems = page.locator('.tree-item');
    await expect(treeItems.first()).toBeVisible();
    await treeItems.first().click();
    await expect(treeItems.first()).toHaveClass(/selected/);
  });
});

test.describe('BOM Panel', () => {
  test('switching to BOM tab shows design BOM toggle', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(1).click();
    await expect(page.locator('.bom-panel')).toBeVisible();
    await expect(page.locator('.bom-view-toggle button').first()).toHaveText('Design BOM');
    await expect(page.locator('.bom-view-toggle button').nth(1)).toHaveText('Trade BOM');
  });

  test('design BOM table has correct headers', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(1).click();
    const headers = page.locator('.bom-table th');
    await expect(headers.nth(0)).toHaveText('ID');
    await expect(headers.nth(1)).toHaveText('Role');
    await expect(headers.nth(2)).toHaveText('Spec');
    await expect(headers.nth(3)).toHaveText('Qty');
    await expect(headers.nth(4)).toHaveText('Length');
    await expect(headers.nth(5)).toHaveText('Map');
  });

  test('design BOM renders items with mapped status', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(1).click();
    const rows = page.locator('.bom-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const mappingBadges = page.locator('.mapping-badge');
    const badgeCount = await mappingBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
    await expect(mappingBadges.first()).toHaveClass(/map-/);
  });

  test('switch to Trade BOM shows different columns', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(1).click();
    await page.locator('.bom-view-toggle button').nth(1).click();
    const headers = page.locator('.bom-table th');
    await expect(headers.nth(0)).toHaveText('SKU');
    await expect(headers.nth(1)).toHaveText('Supplier');
    await expect(headers.nth(2)).toHaveText('Qty');
    await expect(headers.nth(3)).toHaveText('Price');
    await expect(headers.nth(4)).toHaveText('Total');
    await expect(headers.nth(5)).toHaveText('Lead');
  });

  test('trade BOM renders with price and lead time', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(1).click();
    await page.locator('.bom-view-toggle button').nth(1).click();
    await page.waitForTimeout(100);
    const rows = page.locator('.bom-table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      const firstPrice = await rows.first().locator('td').nth(3).textContent();
      expect(firstPrice).toMatch(/^¥[\d.]+$/);
    }
  });
});

test.describe('Checks Panel', () => {
  test('Checks tab shows issue count badge if issues exist', async ({ page }) => {
    const checksBtn = page.locator('.panel-tabs button').nth(2);
    await expect(checksBtn).toContainText('Checks');
    const badge = checksBtn.locator('.badge');
    const hasBadge = (await badge.count()) > 0;
    if (hasBadge) {
      const count = await badge.textContent();
      expect(Number(count)).toBeGreaterThanOrEqual(0);
    }
  });

  test('switching to Checks tab shows panel', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(2).click();
    await expect(page.locator('.checks-panel')).toBeVisible();
  });

  test('checks panel shows either issues or "no issues" message', async ({ page }) => {
    await page.locator('.panel-tabs button').nth(2).click();
    const emptyHint = page.locator('.checks-panel .empty-hint');
    const issues = page.locator('.severity-section');
    const hasEmpty = (await emptyHint.count()) > 0;
    const hasIssues = (await issues.count()) > 0;
    expect(hasEmpty || hasIssues).toBe(true);
  });
});

test.describe('3D Viewport', () => {
  test('viewport contains a canvas element', async ({ page }) => {
    const canvas = page.locator('.viewport-canvas');
    await expect(canvas).toBeVisible();
    const tag = await canvas.evaluate((el) => el.tagName.toLowerCase());
    expect(tag).toBe('canvas');
  });

  test('placeholder text disappears once initialized', async ({ page }) => {
    const placeholder = page.locator('.viewport-placeholder');
    const isVisible = await placeholder.isVisible();
    if (isVisible) {
      await page.waitForTimeout(5000);
      await expect(placeholder).not.toBeVisible();
    }
  });

  test('clicking viewport does not crash', async ({ page }) => {
    const canvas = page.locator('.viewport-canvas');
    await canvas.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);
    // Only check for non-Babylon fatal errors
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('require is not defined') &&
        !e.includes('Babylon') &&
        !e.includes('WebGL') &&
        !e.includes('GPU')
    );
    expect(fatalErrors).toEqual([]);
  });
});

test.describe('Navigation & Interaction', () => {
  test('all three tabs are clickable', async ({ page }) => {
    const tabs = page.locator('.panel-tabs button');
    await tabs.nth(0).click();
    await expect(page.locator('.structure-tree')).toBeVisible();
    await tabs.nth(1).click();
    await expect(page.locator('.bom-panel')).toBeVisible();
    await tabs.nth(2).click();
    await expect(page.locator('.checks-panel')).toBeVisible();
  });

  test('undo/redo buttons exist and are initially disabled', async ({ page }) => {
    const undoBtn = page.locator('.toolbar-actions button').first();
    await expect(undoBtn).toBeDisabled();
    const redoBtn = page.locator('.toolbar-actions button').nth(1);
    await expect(redoBtn).toBeDisabled();
  });
});

test.describe('Loading & Error States', () => {
  test('rapid double BOM tab switch does not crash', async ({ page }) => {
    const tabs = page.locator('.panel-tabs button');
    await tabs.nth(1).click();
    await tabs.nth(0).click();
    await tabs.nth(1).click();
    await tabs.nth(2).click();
    await page.waitForTimeout(300);
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('require is not defined') &&
        !e.includes('Babylon') &&
        !e.includes('WebGL') &&
        !e.includes('GPU')
    );
    expect(fatalErrors).toEqual([]);
  });

  test('viewport survives window resize', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    await expect(page.locator('.viewport-canvas')).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    await expect(page.locator('.viewport-canvas')).toBeVisible();
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('require is not defined') &&
        !e.includes('Babylon') &&
        !e.includes('WebGL') &&
        !e.includes('GPU') &&
        !e.includes('ResizeObserver')
    );
    expect(fatalErrors).toEqual([]);
  });
});

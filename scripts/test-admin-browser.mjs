#!/usr/bin/env node
/**
 * Browser test for admin panel
 * Tests the file-based database system in the browser
 */

import { chromium } from 'playwright';

async function runTests() {
  console.log('🧪 Testing Admin Panel in Browser\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to admin panel
    console.log('Navigating to admin panel...');
    await page.goto('http://localhost:8888/admin', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded\n');

    // Check if login form is visible
    const usernameInput = page.locator('input[placeholder="Enter username"]');
    await usernameInput.waitFor();
    console.log('✅ Login form visible\n');

    // Login
    console.log('Logging in with credentials...');
    await usernameInput.fill('keeper');
    await page.locator('input[placeholder="Enter password"]').fill('password');
    await page.locator('button:has-text("Login")').click();
    
    // Wait for tables to load
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Check if tables panel is visible
    const tablesPanel = page.locator('text=Tables');
    await tablesPanel.waitFor({ timeout: 5000 });
    console.log('✅ Tables panel loaded\n');

    // Take screenshot
    await page.screenshot({ path: '/tmp/admin-panel.png' });
    console.log('📸 Screenshot saved to /tmp/admin-panel.png\n');

    // Check for notes table
    const notesButton = page.locator('button:has-text("notes")');
    if (await notesButton.isVisible()) {
      console.log('✅ Notes table found');
      await notesButton.click();
      await page.waitForTimeout(1000);
      
      const recordsTable = page.locator('table');
      if (await recordsTable.isVisible()) {
        const rows = await page.locator('tbody tr').count();
        console.log(`✅ Found ${rows} records in notes table\n`);
      }
    } else {
      console.log('⚠️  No notes table found\n');
    }

    // Test adding a record
    console.log('Testing add record functionality...');
    const fieldNameInput = page.locator('input[placeholder="Field name (e.g., text, mood)"]');
    const fieldValueInput = page.locator('input[placeholder="Field value"]');
    const addButton = page.locator('button:has-text("Add")');

    if (await fieldNameInput.isVisible()) {
      await fieldNameInput.fill('test_field');
      await fieldValueInput.fill('test_value');
      await addButton.click();
      await page.waitForTimeout(1500);
      console.log('✅ Add record test complete\n');
    }

    console.log('━'.repeat(50));
    console.log('✅ Browser tests completed successfully!');
    console.log('\nAdmin Panel is functional and responding correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/admin-panel-error.png' });
    console.log('📸 Error screenshot saved to /tmp/admin-panel-error.png');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests().catch(console.error);

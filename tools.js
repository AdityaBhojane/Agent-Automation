import { tool } from "@openai/agents";
import { z } from 'zod';
import { chromium } from 'playwright';

export const browser = await chromium.launch({
    headless: false,
    chromiumSandbox: true,
    args: ['--disable-extensions', '--disable-file-system'],
});

let page;

export const openBrowser = tool({
    name: 'open_browser',
    description: 'Open a new browser instance',
    parameters: z.object({}),
    async execute() {
        console.log("\n🚀 TOOL CALLED: open_browser");
        page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 800 });
        console.log("\n✅ SUCCESS: Browser opened successfully with viewport 1280x800");
        return "Browser opened successfully";
    }
});


export const openURL = tool({
    name: 'open_url',
    description: 'Navigate to a specific URL',
    parameters: z.object({
        url: z.string().url().describe('The URL to navigate to'),
    }),
    async execute(input) {
        const { url } = input;
        console.log(`\n🚀 TOOL CALLED: open_url - Navigating to: ${url}`);


        if (!page) {
            console.log("\n❌ ERROR: No browser page available");
            return "No browser page available. Please open browser first.";
        }


        try {
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 45000
            });
            await page.waitForTimeout(2000); // Additional wait for page stabilization
            console.log(`\n✅ SUCCESS: Successfully navigated to ${url}`);
            return `Navigated to ${url}`;
        } catch (error) {
            console.log(`\n❌ ERROR: Failed to navigate to ${url} - ${error.message}`);
            return `Failed to navigate to ${url}: ${error.message}`;
        }
    }
});


export const takeScreenShot = tool({
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current page and return base64',
    parameters: z.object({
        context: z.string().describe('Description of what action was performed or what to expect in the screenshot')
    }),
    async execute(input) {
        const { context } = input;
        console.log(`\n🚀 TOOL CALLED: take_screenshot - ${context}`);


        if (!page) {
            console.log("\n❌ ERROR: No browser page available");
            return "No browser page available.";
        }


        try {
            const buffer = await page.screenshot({
                fullPage: true,
                type: 'jpeg',
                quality: 30,
                path: `screenshot-${Date.now()}.jpeg`
            });
            console.log(`\n📸 SUCCESS: Screenshot captured - ${context}`);
            const ss = buffer.toString('base64');
            return 'Screenshot taken';
        } catch (error) {
            console.log(`\n❌ ERROR: Failed to take screenshot - ${error.message}`);
            return `Screenshot failed: ${error.message}`;
        }
    },
});


export const findAndClick = tool({
    name: 'find_and_click',
    description: 'Find an element by text, placeholder, or selector and click it',
    parameters: z.object({
        identifier: z.string().describe('Text, placeholder, label, or CSS selector to identify the element'),
        elementType: z.string().describe('Type of element (button, link, input, etc.)')
    }),
    async execute(input) {
        const { identifier, elementType } = input;
        console.log(`\n🚀 TOOL CALLED: find_and_click - Looking for: "${identifier}"`);


        if (!page) {
            console.log("\n❌ ERROR: No browser page available");
            return "No browser page available.";
        }


        try {
            // Try multiple strategies to find the element
            const selectors = [
                `button:has-text("${identifier}")`,
                `a:has-text("${identifier}")`,
                `input[placeholder*="${identifier}" i]`,
                `[aria-label*="${identifier}" i]`,
                `label:has-text("${identifier}")`,
                `text=${identifier}`,
                identifier // Try as direct selector
            ];


            let element = null;
            let foundSelector = '';


            for (const selector of selectors) {
                try {
                    element = page.locator(selector).first();
                    if (await element.isVisible({ timeout: 3000 })) {
                        foundSelector = selector;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }


            if (!element || !foundSelector) {
                console.log(`\n❌ ERROR: Element "${identifier}" not found`);
                return `Element "${identifier}" not found`;
            }


            await element.click();
            await page.waitForTimeout(1000); // Wait for action to complete
            console.log(`\n✅ SUCCESS: Clicked on "${identifier}" using selector: ${foundSelector}`);
            return `Clicked on ${identifier}`;
        } catch (error) {
            console.log(`\n❌ ERROR: Failed to click - ${error.message}`);
            return `Click failed: ${error.message}`;
        }
    }
});


export const fillFormFields = tool({
    name: 'fill_form_fields',
    description: 'Fill multiple form fields at once to reduce API calls',
    parameters: z.object({
        fields: z.array(z.object({
            fieldIdentifier: z.string().describe('Label text, placeholder, or field name'),
            value: z.string().describe('Value to fill in the field'),
            fieldType: z.string().describe('Expected field type (text, email, password, etc.)')
        })).describe('Array of field objects to fill')
    }),
    async execute(input) {
        const { fields } = input;
        console.log(`\n🚀 TOOL CALLED: fill_form_fields - Filling ${fields.length} fields`);


        if (!page) {
            console.log("\n❌ ERROR: No browser page available");
            return "No browser page available.";
        }


        const results = [];


        for (const field of fields) {
            const { fieldIdentifier, value, fieldType } = field;
            console.log(`\n🔧 Processing field: "${fieldIdentifier}" with value: "${value}"`);


            try {
                const selectors = [
                    `input[placeholder*="${fieldIdentifier}" i]`,
                    `input[aria-label*="${fieldIdentifier}" i]`,
                    `input[name*="${fieldIdentifier}" i]`,
                    `input[id*="${fieldIdentifier}" i]`,
                    `label:has-text("${fieldIdentifier}") + input, label:has-text("${fieldIdentifier}") ~ input`,
                    `//label[contains(., '${fieldIdentifier}')]/following::input[1]`
                ];


                if (fieldType) {
                    selectors.unshift(`input[type="${fieldType}"][placeholder*="${fieldIdentifier}" i]`);
                }


                let element = null;
                let usedSelector = '';


                for (const selector of selectors) {
                    try {
                        element = page.locator(selector).first();
                        if (await element.isVisible({ timeout: 3000 })) {
                            usedSelector = selector;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }


                if (!element || !usedSelector) {
                    console.log(`\n❌ ERROR: Field "${fieldIdentifier}" not found`);
                    results.push(`Field "${fieldIdentifier}" not found`);
                    continue;
                }


                await element.fill(value);
                await page.waitForTimeout(300);
                console.log(`\n✅ SUCCESS: Filled "${fieldIdentifier}" with "${value}"`);
                results.push(`Filled ${fieldIdentifier} with ${value}`);
            } catch (error) {
                console.log(`\n❌ ERROR: Failed to fill field "${fieldIdentifier}" - ${error.message}`);
                results.push(`Failed to fill ${fieldIdentifier}: ${error.message}`);
            }
        }


        return results.join('\n');
    }
});


export const scrollPage = tool({
    name: 'scroll_page',
    description: 'Scroll the page vertically or to a specific element',
    parameters: z.object({
        direction: z.enum(['up', 'down', 'to-element']).describe('Scroll direction or target'),
        pixels: z.number().describe('Number of pixels to scroll (for up/down)'),
        elementIdentifier: z.string().describe('Element identifier for scroll-to-element')
    }),
    async execute(input) {
        const { direction, pixels = 500, elementIdentifier } = input;
        console.log(`\n🚀 TOOL CALLED: scroll_page - ${direction} ${pixels ? pixels + 'px' : ''}`);


        if (!page) {
            console.log("\n❌ ERROR: No browser page available");
            return "No browser page available.";
        }


        try {
            if (direction === 'to-element' && elementIdentifier) {
                const element = page.locator(`text=${elementIdentifier}`).first();
                await element.scrollIntoViewIfNeeded();
                await page.waitForTimeout(1000);
            } else {
                const scrollAmount = direction === 'up' ? -pixels : pixels;
                await page.evaluate((amount) => {
                    window.scrollBy(0, amount);
                }, scrollAmount);
                await page.waitForTimeout(800);
            }


            console.log(`\n✅ SUCCESS: Scrolled ${direction}`);
            return `Scrolled ${direction}`;
        } catch (error) {
            console.log(`\n❌ ERROR: Failed to scroll - ${error.message}`);
            return `Scroll failed: ${error.message}`;
        }
    }
});


export const closeBrowser = tool({
    name: "close_browser",
    description: "Close the browser instance",
    parameters: z.object({}),
    async Execute() {
        console.log("\n🚀 TOOL CALLED: close_browser");
        try {
            if (page) {
                await page.close();
                page = null;
            }
            await browser.close();
            console.log("\n✅ SUCCESS: Browser closed successfully");
            return "Browser closed";
        } catch (error) {
            console.log(`\n❌ ERROR: Failed to close browser - ${error.message}`);
            return `Close failed: ${error.message}`;
        }
    }
});
import 'dotenv/config';
import { Agent, OpenAIProvider, Runner, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { browser, closeBrowser, fillFormFields, findAndClick, openBrowser, openURL, scrollPage, takeScreenShot } from './tools.js';


// Initialize OpenAI client
const openaiClient = new OpenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});


const modelProvider = new OpenAIProvider({ openAIClient: openaiClient });
setDefaultOpenAIClient(openaiClient);
setOpenAIAPI("chat_completions");
setTracingDisabled(true);


const fridayAgent = new Agent({
    name: 'Website Automation Expert',
    instructions: `
        You are an expert web automation agent that performs precise website interactions.


        IMPORTANT: Use fill_form_fields to fill all form fields in one operation to minimize API calls.


        CORE WORKFLOW:
        1. OPEN_BROWSER → OPEN_URL → ANALYZE → ACT → VERIFY → CONTINUE
        2. Always start with open_browser, then open_url to the target website, then take screenshot
        3. After navigation, take a single screenshot to analyze the page
        4. Use fill_form_fields to fill multiple fields at once to minimize API calls
        5. After filling the form take screenshot and then click on the action button, and then call close browser
        6. Only take additional screenshots when absolutely necessary for verification
        7. Close browser if the task is completed or failed


        API CALL OPTIMIZATION:
        - Use fill_form_fields to process multiple form fields in a single API call
        - Minimize screenshots - only capture when the UI has significantly changed
        - Plan all form filling in a single operation when possible
        - Avoid unnecessary intermediate steps


        SCREENSHOT STRATEGY:
        - Take initial screenshot after page load to understand layout
        - Only take additional screenshots if something unexpected happens
        - Avoid screenshots after each form field fill


        ACTION PRINCIPLES:
        - Use find_and_click for buttons and interactive elements
        - Use fill_form_fields for all form inputs in one go when possible
        - Scroll only when needed to reveal hidden elements


        CRITICAL RULES:
        1. Use fill_form_fields to process all related form fields together
        2. Minimize API calls by batching operations
        3. Close the browser when task is complete
        4. Be methodical and efficient with actions
    `,
    tools: [
        openBrowser,
        openURL,
        takeScreenShot,
        findAndClick,
        fillFormFields,
        scrollPage,
        closeBrowser
    ],
    model: 'gemini-2.5-flash',
});


async function automate(query) {
    try {
        const runner = new Runner({ modelProvider });
        const result = await runner.run(fridayAgent, query);
        console.log("- Task completed successfully:", result.finalOutput);
        return result;
    } catch (error) {
        console.error("- task Automation failed:", error);
        try {
            if (browser) {
                await browser.close();
            }
        } catch (cleanupError) {
            console.error("Cleanup failed:", cleanupError);
        }
        throw error;
    }
}


automate(`
    Go to this website https://ui.chaicode.com/ and in the sidebar click on LOGIN(It will redirect to baseurl/auth/login), fill the login form and click on signin after checking the rememberme checkbox.
`).then(() => {
    console.log("✅ Task completed successfully");
}).catch((error) => {
    console.error("❌ Task failed:", error);
});


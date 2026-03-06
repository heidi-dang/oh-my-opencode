import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import * as os from "node:os";
import color from "picocolors";
import { createRequire } from "node:module";

// playwright is imported dynamically inside the function to avoid top-level resolution errors in the binary

async function resolvePlaywright(): Promise<any> {
    // 1. Try normal dynamic import (works in dev and some environments)
    try {
        return await import("playwright");
    } catch (e) {
        // Fall through
    }

    // 2. Try to resolve relative to the physical binary location
    // The native binary is typically at: node_modules/@heidi-dang/oh-my-opencode-PLATFORM/bin/oh-my-opencode
    // We want to look for node_modules/playwright in parent directories
    const binaryDir = dirname(process.execPath);
    let currentDir = binaryDir;

    for (let i = 0; i < 6; i++) {
        const potentialPath = join(currentDir, "node_modules", "playwright");
        if (existsSync(potentialPath)) {
            try {
                // Use createRequire to bypass Bun's virtual filesystem if necessary
                const require = createRequire(join(currentDir, "index.js"));
                return require("playwright");
            } catch (e) {
                // Continue searching
            }
        }
        const parent = dirname(currentDir);
        if (parent === currentDir) break;
        currentDir = parent;
    }

    throw new Error("Cannot find package 'playwright'. Please ensure it's installed via 'npm install -g @heidi-dang/oh-my-opencode'.");
}

export interface MasterLoginOptions {
    force: boolean;
}

export async function masterLogin(options: MasterLoginOptions): Promise<number> {
    const configPath = join(os.homedir(), ".ygka_config.json");

    if (existsSync(configPath) && !options.force) {
        console.log(`${color.yellow("[exists]")} ${color.dim(configPath)}`);
        console.log(color.dim("YGKA config already exists. Use --force to overwrite."));
        return 0;
    }

    let playwrightModule: any;
    try {
        playwrightModule = await resolvePlaywright();
    } catch (err) {
        console.error(color.red("\n[error] Playwright not found."));
        console.log(color.dim("This command requires Playwright to automate the login process."));
        console.log(color.dim("Please try running: npm install -g @heidi-dang/oh-my-opencode"));
        console.log(color.dim(`Diagnostic: looked for 'playwright' in ${dirname(process.execPath)} and parents.`));
        return 1;
    }

    console.log(color.cyan("🚀 Launching browser for ChatGPT login..."));
    console.log(color.dim("Please log in to chat.openai.com in the window that appears."));
    console.log(color.dim("Once logged in, return here. I will automatically detect the session."));

    const { chromium } = playwrightModule;
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://chat.openai.com/auth/login");

    // Poll for the session token in cookies
    let sessionToken: string | null = null;
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    const spinner = ["|", "/", "-", "\\"];
    let spinnerIdx = 0;

    while (Date.now() - startTime < timeout) {
        const cookies = await context.cookies();
        const sessionCookie = cookies.find((c: any) => c.name === "__Secure-next-auth.session-token");

        if (sessionCookie) {
            sessionToken = sessionCookie.value;
            break;
        }

        process.stdout.write(`\r${color.blue(spinner[spinnerIdx])} Waiting for login... `);
        spinnerIdx = (spinnerIdx + 1) % spinner.length;
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    process.stdout.write("\r"); // Clear spinner line

    if (!sessionToken) {
        console.error(color.red("\n[error] Login timed out or session token not found."));
        await browser.close();
        return 1;
    }

    console.log(color.green("\n[ok] Session token captured successfully!"));

    // Attempt to extract access token as well if possible (optional but helpful)
    let accessToken: string | undefined;
    try {
        const sessionResponse = await page.evaluate(async () => {
            try {
                const res = await fetch("/api/auth/session");
                return await res.json();
            } catch (e) {
                return null;
            }
        });
        accessToken = (sessionResponse as any)?.accessToken;
    } catch (e) {
        // Ignore if we can't get access token yet, session token is enough
    }

    await browser.close();

    const config = {
        session_token: sessionToken,
        access_token: accessToken,
        browser_name: "playwright-internal"
    };

    try {
        mkdirSync(dirname(configPath), { recursive: true });
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
        console.log(`${color.green("[ok]")} Saved YGKA config to ${color.white(configPath)}`);
        return 0;
    } catch (err) {
        console.error(color.red(`[error] Failed to write config: ${err instanceof Error ? err.message : String(err)}`));
        return 1;
    }
}

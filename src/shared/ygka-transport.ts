import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface YGKAConfig {
    access_token?: string;
    session_token?: string;
    browser_name?: string;
}

/**
 * YGKATransport handles communication with ChatGPT using the reverse-engineered 
 * session-based approach (unofficial API), similar to YGKA.
 */
export class YGKATransport {
    private config: YGKAConfig | null = null;
    private readonly configPath: string;

    constructor() {
        this.configPath = path.join(os.homedir(), '.ygka_config.json');
        this.loadConfig();
    }

    private loadConfig() {
        if (fs.existsSync(this.configPath)) {
            try {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                this.config = JSON.parse(data);
            } catch (error) {
                console.error('Error loading YGKA config:', error);
            }
        }
    }

    public isConfigured(): boolean {
        return !!(this.config?.access_token || this.config?.session_token);
    }

    public async queryStream(prompt: string): Promise<Response> {
        if (!this.isConfigured()) {
            throw new Error('YGKA is not configured. Please run `oh-my-opencode master-login` first.');
        }

        const accessToken = this.config?.access_token || await this.refreshAccessToken();

        if (!accessToken) {
            throw new Error('Failed to retrieve or refresh ChatGPT access token.');
        }

        try {
            const response = await fetch('https://chatgpt.com/backend-api/conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'text/event-stream',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                    'chatgpt-account-id': '', // Optional, but some implementations use it
                },
                body: JSON.stringify({
                    action: 'next',
                    messages: [
                        {
                            id: crypto.randomUUID(),
                            author: { role: 'user' },
                            content: { content_type: 'text', parts: [prompt] },
                            metadata: {}
                        }
                    ],
                    model: 'auto', // Let ChatGPT decide or use 'text-davinci-002-render-sha'
                    parent_message_id: crypto.randomUUID(),
                    timezone_offset_min: -600,
                    history_and_training_disabled: false,
                    force_paragen: false,
                    force_paragen_model_slug: "",
                    force_null_assistant: false,
                    force_offline: false,
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`ChatGPT API responded with ${response.status}: ${errorBody}`);
            }

            return response;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`YGKA Stream Failed: ${error.message}`);
            }
            throw error;
        }
    }

    public async query(prompt: string): Promise<string> {
        const response = await this.queryStream(prompt);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to read response body stream.');

        let lastMessage = '';
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr) as any;
                        if (data.message?.content?.parts?.[0]) {
                            lastMessage = data.message.content.parts[0];
                        }
                    } catch (e) {
                        // Ignore malformed JSON in stream chunks
                    }
                }
            }
        }

        return lastMessage || 'No response received from ChatGPT.';
    }

    private async refreshAccessToken(): Promise<string | null> {
        // If we only have a session_token, we must exchange it for an access_token
        if (!this.config?.session_token) return null;

        try {
            const response = await fetch('https://chatgpt.com/api/auth/session', {
                headers: {
                    'Cookie': `__Secure-next-auth.session-token=${this.config.session_token}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) return null;
            const data = (await response.json()) as any;

            // PRE-VALIDATION PROVIDER ERROR CHECK
            if (data && (data.error || data.message || data.code)) {
                const errorObj = data.error || data;
                const errorMessage = errorObj.message || errorObj.error || data.message || "";
                const errorCode = errorObj.code || data.code || "";

                if (errorMessage.toLowerCase().includes("at capacity") || 
                    errorMessage.toLowerCase().includes("unavailable") ||
                    errorCode === "model_at_capacity" ||
                    errorCode === "service_unavailable") {
                    throw new Error(`ProviderTemporaryUnavailable: ${errorMessage || "The model is currently at capacity or unavailable."}`);
                }
            }

            if (data.accessToken) {
                // Update config with new access token
                if (this.config) { // Ensure config is not null before updating
                    this.config.access_token = data.accessToken;
                    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
                }
            }

            return data.accessToken || null;
        } catch (error) {
            return null;
        }
    }
}

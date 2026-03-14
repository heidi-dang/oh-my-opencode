# Local Model Support for Heidi Agent

The Heidi agent in oh-my-opencode now supports local models through OpenAI-compatible providers like Ollama.

## Configuration

### 1. Set up Ollama (or any OpenAI-compatible provider)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama server
ollama serve

# Pull a model
ollama pull llama3.2:latest
# Or other models:
ollama pull qwen2.5:latest
ollama pull deepseek-coder:latest
ollama pull codellama:latest
```

### 2. Configure OpenCode

Add a custom provider to your OpenCode configuration (`~/.config/opencode/opencode.json` or `.opencode/opencode.json`):

```json
{
  "provider": {
    "ollama": {
      "baseURL": "http://localhost:11434/v1",
      "apiKey": "ollama",
      "models": {
        "llama3.2:latest": {
          "id": "llama3.2:latest",
          "name": "Llama 3.2",
          "cost": {
            "input": 0,
            "output": 0
          },
          "limit": {
            "context": 128000,
            "input": 128000,
            "output": 128000
          },
          "tool_call": true,
          "temperature": true
        },
        "qwen2.5:latest": {
          "id": "qwen2.5:latest",
          "name": "Qwen 2.5",
          "cost": {
            "input": 0,
            "output": 0
          },
          "limit": {
            "context": 32768,
            "input": 32768,
            "output": 32768
          },
          "tool_call": true,
          "temperature": true
        },
        "deepseek-coder:latest": {
          "id": "deepseek-coder:latest",
          "name": "DeepSeek Coder",
          "cost": {
            "input": 0,
            "output": 0
          },
          "limit": {
            "context": 128000,
            "input": 128000,
            "output": 128000
          },
          "tool_call": true,
          "temperature": true
        }
      }
    }
  },
  "model": "ollama/llama3.2:latest"
}
```

### 3. Configure oh-my-opencode

Optionally configure Heidi to prefer local models in `~/.config/opencode/oh-my-opencode.jsonc`:

```jsonc
{
  "agents": {
    "heidi": {
      "model": "ollama/llama3.2:latest"
    }
  },
  "disabled_agents": ["sisyphus"]
}
```

## Supported Local Models

The Heidi agent includes fallback support for these local models:

- `llama3.2:latest` - Meta's Llama 3.2 series
- `qwen2.5:latest` - Alibaba's Qwen 2.5 series  
- `deepseek-coder:latest` - DeepSeek's code-specialized model
- `codellama:latest` - Meta's Code Llama series

## Usage

1. **Select Heidi Agent**: Choose "Heidi" from the agent dropdown in OpenCode
2. **Model Selection**: The Heidi agent will automatically use the configured local model
3. **Local Model Optimization**: When using a local model, Heidi automatically:
   - Uses more concise responses
   - Optimizes tool call efficiency
   - Breaks down complex tasks when needed

## Troubleshooting

### Model Not Available

If the model doesn't appear in the dropdown:

1. Check that Ollama is running: `ollama list`
2. Verify the OpenCode provider configuration
3. Restart OpenCode to refresh the model cache

### Performance Issues

Local models may have higher latency:

1. Use smaller models for faster responses (e.g., `llama3.2:3b` instead of `llama3.2:8b`)
2. Ensure sufficient RAM (recommend 16GB+ for 7B models)
3. Consider GPU acceleration if available

### Model Quality

For best results with local models:

1. Use code-specialized models like `deepseek-coder` for coding tasks
2. Provide clear, specific instructions
3. Break complex tasks into smaller steps

## Alternative Local Providers

The same configuration works with other OpenAI-compatible providers:

- **Llama.cpp**: Change `baseURL` to your Llama.cpp server
- **LM Studio**: Default URL is `http://localhost:1234/v1`
- **Text Generation WebUI**: Default URL is `http://localhost:5000/v1`

Just update the `baseURL` in the provider configuration accordingly.

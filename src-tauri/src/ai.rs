/// AI module — wraps async-openai for non-streaming and streaming completions.
/// Supports any OpenAI-compatible endpoint (OpenAI, DeepSeek, Ollama, custom).
///
/// Also provides `extract_fields()` — a kumo `LlmClient` bridge that uses the
/// same async-openai client to drive kumo's structured JSON extraction pipeline.
use anyhow::{Context, Result};
use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client,
};
use futures::StreamExt;
use std::pin::Pin;
use std::future::Future;
use kumo::llm::{LlmClient, TokenUsage};
use kumo::error::KumoError;
use serde_json::Value;
use crate::models::AiCallConfig;

/// Build an async-openai client from our config struct.
fn build_client(cfg: &AiCallConfig) -> Client<OpenAIConfig> {
    let openai_cfg = OpenAIConfig::new()
        .with_api_base(&cfg.base_url)
        .with_api_key(&cfg.api_key);
    Client::with_config(openai_cfg)
}

/// Non-streaming chat completion — returns the full assistant message.
pub async fn complete(cfg: &AiCallConfig, system: &str, user: &str) -> Result<String> {
    let client = build_client(cfg);

    let request = CreateChatCompletionRequestArgs::default()
        .model(&cfg.model)
        .max_tokens(cfg.max_tokens)
        .temperature(cfg.temperature)
        .messages([
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system)
                .build()?
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(user)
                .build()?
                .into(),
        ])
        .build()?;

    let response = client
        .chat()
        .create(request)
        .await
        .context("LLM API request failed")?;

    let text = response
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .ok_or_else(|| anyhow::anyhow!("LLM returned empty choices"))?;

    Ok(text)
}

/// Streaming chat completion — calls `on_token` for each delta, then returns.
pub async fn stream_with_callback<F>(
    cfg: &AiCallConfig,
    system: &str,
    user: &str,
    mut on_token: F,
) -> Result<()>
where
    F: FnMut(String) + Send,
{
    let client = build_client(cfg);

    let request = CreateChatCompletionRequestArgs::default()
        .model(&cfg.model)
        .max_tokens(cfg.max_tokens)
        .temperature(cfg.temperature)
        .messages([
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system)
                .build()?
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(user)
                .build()?
                .into(),
        ])
        .build()?;

    let mut stream = client
        .chat()
        .create_stream(request)
        .await
        .context("LLM streaming request failed")?;

    while let Some(result) = stream.next().await {
        let chunk = result.context("Stream chunk error")?;
        if let Some(delta) = chunk
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.delta.content)
        {
            on_token(delta);
        }
    }

    Ok(())
}

// ─── kumo LlmClient bridge ────────────────────────────────────────────────────

/// Bridges kumo's `LlmClient` trait onto the project's existing `async-openai`
/// client, so kumo's structured-extraction pipeline reuses the same provider
/// config without pulling in a second HTTP client.
pub struct KumoLlmBridge {
    pub cfg: AiCallConfig,
}

impl LlmClient for KumoLlmBridge {
    fn extract_json<'life0, 'life1, 'life2, 'async_trait>(
        &'life0 self,
        schema: &'life1 Value,
        html: &'life2 str,
    ) -> Pin<Box<dyn Future<Output = Result<(Value, TokenUsage), KumoError>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        'life1: 'async_trait,
        'life2: 'async_trait,
        Self: 'async_trait,
    {
        // kumo's built-in helpers: strip scripts/styles, then render the prompt
        let cleaned = kumo::llm::prompt::strip_scripts_and_styles(html);
        let user_prompt = kumo::llm::prompt::render_user_prompt(
            kumo::llm::prompt::DEFAULT_USER_PROMPT,
            &cleaned,
        );
        let system_prompt = format!(
            "{}\nRespond ONLY with a valid JSON object that matches this schema (no markdown, no explanation):\n{}",
            kumo::llm::prompt::DEFAULT_SYSTEM_PROMPT,
            schema
        );
        let cfg = self.cfg.clone();

        Box::pin(async move {
            let raw = complete(&cfg, &system_prompt, &user_prompt)
                .await
                .map_err(|e| KumoError::Llm(e.to_string()))?;

            // Parse the JSON response — handle optional markdown fences
            let json = parse_json_response(&raw)
                .map_err(|e| KumoError::Llm(format!("JSON parse failed: {e}")))?;

            // TokenUsage not tracked here (async-openai doesn't expose it easily)
            Ok((json, TokenUsage::default()))
        })
    }
}

/// Parse a JSON value from an LLM response, tolerating markdown code fences.
fn parse_json_response(text: &str) -> Result<Value, serde_json::Error> {
    // Try direct parse first
    if let Ok(v) = serde_json::from_str(text) {
        return Ok(v);
    }
    // Strip ```json ... ``` or ``` ... ``` wrapper
    let inner = if let Some(start) = text.find("```") {
        let after_fence = &text[start + 3..];
        let content_start = after_fence.find('\n').map(|i| i + 1).unwrap_or(0);
        let content = &after_fence[content_start..];
        content.rfind("```").map(|i| content[..i].trim()).unwrap_or(content.trim())
    } else {
        text.trim()
    };
    serde_json::from_str(inner)
}

/// Structured extraction using kumo's LlmClient pipeline.
///
/// `schema`  — JSON Schema object describing the fields to extract  
/// `html`    — raw page HTML (will be cleaned internally)  
///
/// Returns the extracted JSON value, or an error string.
pub async fn extract_fields(
    cfg: &AiCallConfig,
    schema: &Value,
    html: &str,
) -> Result<Value> {
    let bridge = KumoLlmBridge { cfg: cfg.clone() };
    let (data, _usage) = bridge
        .extract_json(schema, html)
        .await
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    Ok(data)
}

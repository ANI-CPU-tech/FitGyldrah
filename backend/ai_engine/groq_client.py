"""
groq_client.py
──────────────
Thin wrapper around LangChain's ChatGroq.
Handles the API call, JSON parsing, and token extraction.
Isolated here so swapping the model or provider is a one-line change.
"""

import json
import re
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL = getattr(settings, "GROQ_MODEL", "llama3-70b-8192")
DEFAULT_TEMPERATURE = getattr(settings, "GROQ_TEMPERATURE", 0.4)
DEFAULT_MAX_TOKENS = getattr(settings, "GROQ_MAX_TOKENS", 4096)


def _strip_markdown_fences(text: str) -> str:
    """Strip ```json ... ``` fences the model sometimes adds despite instructions."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def call_groq(
    system_prompt: str,
    user_prompt: str,
    model: str = DEFAULT_MODEL,
    temperature: float = DEFAULT_TEMPERATURE,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> dict:
    """
    Call Groq via LangChain ChatGroq and return a structured result dict.

    Returns:
        {
            "content":           <parsed dict from JSON response>,
            "raw_text":          <raw string from model>,
            "prompt_tokens":     <int>,
            "completion_tokens": <int>,
            "total_tokens":      <int>,
            "model":             <str>,
        }

    Raises:
        RuntimeError  — API call failed (retriable)
        ValueError    — Response is not valid JSON (not retriable)
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage

    api_key = getattr(settings, "GROQ_API_KEY", None)
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not configured. "
            "Add GROQ_API_KEY=gsk_... to your .env and settings.py."
        )

    llm = ChatGroq(
        api_key=api_key,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    logger.info(f"[Groq] Calling model={model} ...")

    try:
        response = llm.invoke(messages)
    except Exception as exc:
        logger.error(f"[Groq] API call failed: {exc}")
        raise RuntimeError(f"Groq API call failed: {exc}") from exc

    raw_text = response.content

    # Extract token usage
    usage = getattr(response, "usage_metadata", {}) or {}
    prompt_tokens = usage.get("input_tokens", 0)
    completion_tokens = usage.get("output_tokens", 0)
    total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

    logger.info(
        f"[Groq] Done. tokens={prompt_tokens}+{completion_tokens}={total_tokens}"
    )

    # Parse JSON — strip fences first
    clean = _strip_markdown_fences(raw_text)
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.error(f"[Groq] JSON parse failed. Raw (first 500): {raw_text[:500]}")
        raise ValueError(
            f"Model returned non-JSON: {exc}. Raw (first 300 chars): {raw_text[:300]}"
        ) from exc

    return {
        "content": parsed,
        "raw_text": raw_text,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "model": model,
    }

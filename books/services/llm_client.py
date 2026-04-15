import json
import logging
import requests
from django.conf import settings
logger=logging.getLogger(__name__)
class LLMClient:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = "https://api.openai.com/v1"
        self.model = settings.OPENAI_MODEL
    def chat_completion(self, messages, temperature=0.7, max_tokens=1000):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
 
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
 
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
 
        except requests.exceptions.ConnectionError:
            logger.error("Cannot connect to OpenAI API")
            raise ConnectionError(
                "Cannot connect to OpenAI API. Check your internet connection."
            )
        except requests.exceptions.HTTPError as e:
            logger.error(f"OpenAI API error: {e.response.status_code} - {e.response.text}")
            raise
        except (KeyError, IndexError) as e:
            logger.error(f"Unexpected OpenAI response format: {e}")
            raise ValueError("Unexpected response format from OpenAI")
    def generate_json(self, messages, temperature=0.3):
        messages = messages.copy()
        if messages and messages[0]["role"] == "system":
            messages[0]["content"] += "\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        text = self.chat_completion(messages, temperature=temperature, max_tokens=1500)
 
        # Clean up common formatting issues
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
 
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.error(f"OpenAI returned invalid JSON: {text[:200]}")
            raise ValueError("OpenAI returned invalid JSON")
llm_client = LLMClient()
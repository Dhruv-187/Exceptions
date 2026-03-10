import json
import logging

logger = logging.getLogger(__name__)

def validate_and_parse_json(response_text: str) -> dict:
    """
    Validates that the response from Gemini is correctly formatted JSON.
    Strips markdown and parses the JSON.
    Returns:
        dict: The parsed JSON.
    Raises:
        ValueError: If JSON is invalid or missing required keys.
    """
    clean_text = response_text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    if clean_text.startswith("```"):
        clean_text = clean_text[3:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]

    try:
        data = json.loads(clean_text)
        if "symptoms" not in data:
            raise ValueError("Missing 'symptoms' key in JSON response.")
        if not isinstance(data["symptoms"], list):
            raise ValueError("'symptoms' must be a list.")
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from Gemini: {clean_text}")
        raise ValueError("Invalid JSON format") from e

from llmx import TextGenerator
from llmx.datamodel import TextGenerationConfig, TextGenerationResponse, Message


class GeminiTextGenerator(TextGenerator):
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash-lite"):
        super().__init__(provider="gemini", model_name=model)
        self._model_name = model
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai

    def count_tokens(self, text) -> int:
        if isinstance(text, str):
            return len(text) // 4
        return sum(len(str(m)) // 4 for m in text)

    def generate(
        self,
        messages: list[dict] | str,
        config: TextGenerationConfig = TextGenerationConfig(),
        **kwargs,
    ) -> TextGenerationResponse:
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]

        system_instruction = None
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_instruction = m["content"]
            else:
                chat_messages.append(m)

        if not chat_messages:
            chat_messages = [{"role": "user", "content": ""}]

        model = self._genai.GenerativeModel(
            self._model_name,
            system_instruction=system_instruction,
        )

        history = [
            {"role": "model" if m["role"] == "assistant" else "user",
             "parts": [m["content"]]}
            for m in chat_messages[:-1]
        ]
        last = chat_messages[-1]["content"]

        gen_config = self._genai.GenerationConfig(
            temperature=config.temperature if config.temperature is not None else 0,
        )
        try:
            chat = model.start_chat(history=history)
            response = chat.send_message(last, generation_config=gen_config)
            content = response.text or ""
        except Exception as e:
            raise RuntimeError(f"Gemini error: {e}") from e

        return TextGenerationResponse(
            text=[Message(role="assistant", content=content)],
            config=config,
            response=response,
        )

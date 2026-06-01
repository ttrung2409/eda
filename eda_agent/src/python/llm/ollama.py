import ollama
from llmx import TextGenerator
from llmx.datamodel import TextGenerationConfig, TextGenerationResponse, Message


class OllamaTextGenerator(TextGenerator):
    def __init__(self, model: str = "llama3.1:8b"):
        super().__init__(provider="ollama", model_name=model)
        self.model = model

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

        options = {}
        if config.max_tokens:
            options["num_predict"] = config.max_tokens

        try:
            response = ollama.chat(model=self.model, messages=messages, options=options or None)
        except ollama.ResponseError as e:
            raise RuntimeError(f"Ollama error: {e}") from e
        except Exception as e:
            raise RuntimeError(
                f"Could not reach Ollama. Is it running? Try: ollama serve\n({e})"
            ) from e

        content = response.message.content or ""
        return TextGenerationResponse(
            text=[Message(role="assistant", content=content)],
            config=config,
            response=response,
        )

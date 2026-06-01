import state


def handle(params: dict) -> dict:
    from lida import Manager, TextGenerationConfig
    provider = params["provider"]
    model = params["model"]
    if provider == "ollama":
        from llm import OllamaTextGenerator
        text_gen = OllamaTextGenerator(model=model)
    elif provider == "gemini":
        from llm import GeminiTextGenerator
        text_gen = GeminiTextGenerator(api_key=params["apiKey"], model=model)
    else:
        raise ValueError(f"Unknown provider: {provider}")
    state.text_gen = text_gen
    state.lida = Manager(text_gen=text_gen)
    state.config = TextGenerationConfig(model=model, temperature=0)
    return {"ok": True}

import state


def handle(params: dict) -> dict:
    if state.text_gen is None:
        raise RuntimeError("Call init first")
    response = state.text_gen.generate(params["messages"], state.config)
    reply = response.text[0].content if response.text else ""
    return {"reply": reply}

import state


def handle(params: dict) -> dict:
    if state.lida is None:
        raise RuntimeError("Call init first")
    from lida.datamodel import Persona
    from llmx import TextGenerationConfig
    summary = params.get("summary")
    n = params.get("n", 5)
    persona_text = params.get("persona", "")
    existing = params.get("existingGoals", [])
    if existing:
        exclude = "Avoid repeating these already-suggested questions: " + "; ".join(existing) + "."
        persona_text = (persona_text + " " + exclude).strip() if persona_text else exclude
    persona = Persona(persona=persona_text, rationale="") if persona_text else None
    config = TextGenerationConfig(model=state.config.model, temperature=0.7) if existing else state.config
    goals = state.lida.goals(summary, n=n, persona=persona, textgen_config=config)
    return {
        "goals": [
            {
                "question": g.question if hasattr(g, "question") else str(g),
                "visualization": getattr(g, "visualization", ""),
                "rationale": getattr(g, "rationale", ""),
            }
            for g in goals
        ]
    }

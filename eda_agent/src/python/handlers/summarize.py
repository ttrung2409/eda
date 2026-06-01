import state


def handle(_: dict) -> dict:
    if state.lida is None or state.df is None:
        raise RuntimeError("Call init and loadData first")
    if state.cached_summary is not None:
        return {"summary": state.cached_summary}
    summary = state.lida.summarize(state.df, summary_method="default", textgen_config=state.config)
    if not isinstance(summary, dict):
        # Pydantic model: use .dict() for full recursive serialization
        summary = summary.dict() if hasattr(summary, "dict") else vars(summary)
    state.cached_summary = summary
    return {"summary": summary}

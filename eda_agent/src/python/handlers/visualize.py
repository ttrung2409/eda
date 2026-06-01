import state


def handle(params: dict) -> dict:
    if state.lida is None:
        raise RuntimeError("Call init first")
    goal = (
        params["goal"]
        + " Always include a legend that clearly identifies which data points belong to which category or group."
        + " Always decode categorical values into their original readable text labels — never display raw encoded numbers."
    )
    charts = state.lida.visualize(
        summary=params["summary"],
        goal=goal,
        textgen_config=state.config,
        library="matplotlib",
    )
    if not charts:
        raise ValueError("No charts returned")
    chart = charts[0]
    if not chart.status:
        raise ValueError(f"Chart generation failed: {chart.error}")
    return {"code": chart.code}

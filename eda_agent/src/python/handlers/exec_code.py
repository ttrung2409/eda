import io
import pandas as pd
from contextlib import redirect_stdout
import state


def handle(params: dict) -> dict:
    if state.df is None:
        raise RuntimeError("Call loadData first")
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            exec(params["code"], {"data": state.df, "pd": pd})  # noqa: S102
        result = buf.getvalue().strip()
        return {"result": result or "(no output)"}
    except Exception as e:
        return {"result": f"Error: {e}"}

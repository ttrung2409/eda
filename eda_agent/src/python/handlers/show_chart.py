import matplotlib.pyplot as plt
import pandas as pd
import state


def handle(params: dict) -> dict:
    if state.df is None:
        raise RuntimeError("Call loadData first")
    plt.switch_backend("TkAgg")
    exec(params["code"], {"data": state.df, "pd": pd})  # noqa: S102
    plt.show()
    return {"ok": True}

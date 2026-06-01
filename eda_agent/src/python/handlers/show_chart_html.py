import matplotlib.pyplot as plt
import mpld3
import pandas as pd
import state


def handle(params: dict) -> dict:
    if state.df is None:
        raise RuntimeError("Call loadData first")
    plt.switch_backend("Agg")
    plt.close("all")
    exec(params["code"], {"data": state.df, "pd": pd})  # noqa: S102
    fig = plt.gcf()
    for ax in fig.axes:
        ax.set_title("")
    chart_html = mpld3.fig_to_html(fig)
    plt.close("all")
    html = f"""<!doctype html>
<html><head><style>
  html, body {{ margin: 0; padding: 0; background: #fff; overflow-x: auto; overflow-y: hidden; }}
  ::-webkit-scrollbar:vertical {{ display: none; }}
</style></head>
<body>
{chart_html}
<script>
  new ResizeObserver(function() {{
    var h = document.documentElement.getBoundingClientRect().height;
    window.parent.postMessage({{ type: 'chartHeight', height: Math.ceil(h) + 2 }}, '*');
  }}).observe(document.body);
</script>
</body></html>"""
    return {"html": html}

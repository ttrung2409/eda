"""NDJSON worker: reads {id, method, params} lines from stdin, writes {id, result|error} to stdout."""
import sys
import json

from handlers import init, load_data, summarize, goals, visualize, show_chart, show_chart_html, exec_code, chat


class _Encoder(json.JSONEncoder):
    def default(self, obj):
        try:
            import numpy as np, pandas as pd, datetime
            if isinstance(obj, np.integer): return int(obj)
            if isinstance(obj, np.floating): return float(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            if isinstance(obj, np.bool_): return bool(obj)
            if isinstance(obj, (pd.Timestamp, datetime.datetime, datetime.date)): return obj.isoformat()
        except ImportError:
            pass
        return super().default(obj)

HANDLERS = {
    "init": init.handle,
    "loadData": load_data.handle,
    "summarize": summarize.handle,
    "goals": goals.handle,
    "visualize": visualize.handle,
    "showChart": show_chart.handle,
    "showChartHtml": show_chart_html.handle,
    "execCode": exec_code.handle,
    "chat": chat.handle,
}


def main() -> None:
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        msg_id = "unknown"
        try:
            msg = json.loads(line)
            msg_id = msg["id"]
            method = msg["method"]
            params = msg.get("params", {})
            handler = HANDLERS.get(method)
            if handler is None:
                response = {"id": msg_id, "error": {"code": "UNKNOWN_METHOD", "message": f"Unknown method: {method}"}}
            else:
                response = {"id": msg_id, "result": handler(params)}
        except Exception as e:
            response = {"id": msg_id, "error": {"code": "HANDLER_ERROR", "message": str(e)}}

        try:
            sys.stdout.write(json.dumps(response, cls=_Encoder) + "\n")
        except (TypeError, ValueError) as e:
            sys.stdout.write(json.dumps({"id": msg_id, "error": {"code": "SERIALIZE_ERROR", "message": str(e)}}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()

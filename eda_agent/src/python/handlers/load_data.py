import pandas as pd
import state


def handle(params: dict) -> dict:
    path = params["filePath"]
    if state.df is not None and path == state.loaded_path and state.cached_schema is not None:
        return {"schema": state.cached_schema, "shape": list(state.df.shape)}
    with open(path, "r") as f:
        sample = f.read(4096)
    delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    state.df = pd.read_csv(path, sep=delimiter)
    state.loaded_path = path
    state.cached_summary = None
    schema = []
    for col in state.df.columns:
        dtype = str(state.df[col].dtype)
        samples = [str(s) for s in state.df[col].dropna().head(3).tolist()]
        schema.append({"column": col, "dtype": dtype, "samples": samples})
    state.cached_schema = schema
    return {"schema": schema, "shape": list(state.df.shape)}

"""
DuarteOS MCP Server: Data Analyzer
Analise de dados com pandas, numpy e matplotlib.
Requer: pip install fastmcp pandas numpy matplotlib seaborn
"""

from fastmcp import FastMCP
import json
import os
import tempfile

mcp = FastMCP("data-analyzer", instructions="Analise de dados, estatisticas e visualizacoes")


@mcp.tool()
def analyze_csv(file_path: str) -> str:
    """Analisa um arquivo CSV e retorna estatisticas descritivas."""
    import pandas as pd

    df = pd.read_csv(file_path)
    stats = {
        "shape": list(df.shape),
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "null_counts": df.isnull().sum().to_dict(),
        "describe": df.describe(include="all").to_dict(),
        "sample": df.head(5).to_dict(orient="records"),
    }
    return json.dumps(stats, indent=2, default=str)


@mcp.tool()
def query_dataframe(file_path: str, query: str) -> str:
    """Executa uma query pandas em um CSV. Ex: 'df[df.age > 30].head(10)'"""
    import pandas as pd

    df = pd.read_csv(file_path)
    try:
        result = eval(query, {"df": df, "pd": pd})
        if hasattr(result, "to_dict"):
            return json.dumps(result.to_dict(orient="records"), indent=2, default=str)
        return str(result)
    except Exception as e:
        return f"Erro na query: {e}"


@mcp.tool()
def create_chart(
    file_path: str,
    chart_type: str,
    x_column: str,
    y_column: str,
    title: str = "Chart",
    output_path: str = "",
) -> str:
    """Cria graficos a partir de CSV. chart_type: bar, line, scatter, hist, box, pie"""
    import pandas as pd
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns

    df = pd.read_csv(file_path)

    fig, ax = plt.subplots(figsize=(10, 6))

    chart_funcs = {
        "bar": lambda: sns.barplot(data=df, x=x_column, y=y_column, ax=ax),
        "line": lambda: sns.lineplot(data=df, x=x_column, y=y_column, ax=ax),
        "scatter": lambda: sns.scatterplot(data=df, x=x_column, y=y_column, ax=ax),
        "hist": lambda: df[x_column].hist(ax=ax, bins=30),
        "box": lambda: sns.boxplot(data=df, x=x_column, y=y_column, ax=ax),
        "pie": lambda: df[x_column].value_counts().plot.pie(ax=ax, autopct="%1.1f%%"),
    }

    if chart_type not in chart_funcs:
        return f"Tipo invalido. Use: {', '.join(chart_funcs.keys())}"

    chart_funcs[chart_type]()
    ax.set_title(title)
    plt.tight_layout()

    if not output_path:
        output_path = os.path.join(tempfile.gettempdir(), f"chart_{chart_type}.png")

    plt.savefig(output_path, dpi=150)
    plt.close()

    return f"Grafico salvo em: {output_path}"


@mcp.tool()
def correlate(file_path: str) -> str:
    """Calcula matriz de correlacao para colunas numericas de um CSV."""
    import pandas as pd

    df = pd.read_csv(file_path)
    numeric_cols = df.select_dtypes(include=["number"])
    corr = numeric_cols.corr()
    return json.dumps(corr.to_dict(), indent=2, default=str)


if __name__ == "__main__":
    mcp.run()

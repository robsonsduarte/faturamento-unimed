"""
DuarteOS MCP Server: Web Scraper
Scraping avancado com requests + BeautifulSoup.
Requer: pip install fastmcp requests beautifulsoup4 lxml
"""

from fastmcp import FastMCP
import json

mcp = FastMCP("web-scraper", instructions="Web scraping avancado com parsing estruturado")


@mcp.tool()
def scrape_page(url: str, selector: str = "body") -> str:
    """Faz scrape de uma pagina e retorna o texto do seletor CSS especificado."""
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DuarteOS/2.0; +https://github.com/robsonsduarte/duarteos-core-ai)"
    }
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    elements = soup.select(selector)

    results = []
    for el in elements[:50]:  # Limit to 50 elements
        results.append({"tag": el.name, "text": el.get_text(strip=True)[:500], "attrs": dict(el.attrs)})

    return json.dumps(results, indent=2, ensure_ascii=False)


@mcp.tool()
def extract_links(url: str, pattern: str = "") -> str:
    """Extrai todos os links de uma pagina. Filtra por pattern se fornecido."""
    import requests
    from bs4 import BeautifulSoup
    import re

    headers = {"User-Agent": "Mozilla/5.0 (compatible; DuarteOS/2.0)"}
    response = requests.get(url, headers=headers, timeout=30)
    soup = BeautifulSoup(response.text, "lxml")

    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if pattern and not re.search(pattern, href, re.IGNORECASE):
            continue
        links.append({"href": href, "text": text[:200]})

    return json.dumps(links[:100], indent=2, ensure_ascii=False)


@mcp.tool()
def extract_tables(url: str) -> str:
    """Extrai tabelas HTML de uma pagina e retorna como JSON."""
    import requests
    from bs4 import BeautifulSoup

    headers = {"User-Agent": "Mozilla/5.0 (compatible; DuarteOS/2.0)"}
    response = requests.get(url, headers=headers, timeout=30)
    soup = BeautifulSoup(response.text, "lxml")

    tables = []
    for table in soup.find_all("table"):
        headers_row = [th.get_text(strip=True) for th in table.find_all("th")]
        rows = []
        for tr in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
            if cells:
                rows.append(cells)
        tables.append({"headers": headers_row, "rows": rows[:100]})

    return json.dumps(tables, indent=2, ensure_ascii=False)


@mcp.tool()
def scrape_structured(url: str, selectors: str) -> str:
    """Extrai dados estruturados com multiplos seletores CSS.
    selectors: JSON com nome->seletor. Ex: {"titulo": "h1", "preco": ".price"}
    """
    import requests
    from bs4 import BeautifulSoup

    headers = {"User-Agent": "Mozilla/5.0 (compatible; DuarteOS/2.0)"}
    response = requests.get(url, headers=headers, timeout=30)
    soup = BeautifulSoup(response.text, "lxml")

    sel_dict = json.loads(selectors)
    result = {}

    for name, selector in sel_dict.items():
        elements = soup.select(selector)
        result[name] = [el.get_text(strip=True)[:500] for el in elements[:20]]

    return json.dumps(result, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()

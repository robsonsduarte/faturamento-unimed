"""
DuarteOS MCP Server: Input Analyzer
Analisa PRDs, workflows N8N e URLs para extrair requisitos de sistema.
Requer: pip install fastmcp requests beautifulsoup4 lxml pyyaml
"""

from fastmcp import FastMCP
import json
import os
import re

mcp = FastMCP("input-analyzer", instructions="Analisa PRDs, workflows N8N e URLs para gerar blueprints de sistema")


@mcp.tool()
def detect_input_type(input_path: str) -> str:
    """Detecta o tipo de input: prd, n8n_workflow, url, ou briefing."""
    if input_path.startswith("http://") or input_path.startswith("https://"):
        return json.dumps({"type": "url", "value": input_path})

    if os.path.isfile(input_path):
        ext = os.path.splitext(input_path)[1].lower()

        if ext in (".md", ".txt", ".pdf"):
            return json.dumps({"type": "prd", "path": input_path, "extension": ext})

        if ext == ".json":
            try:
                with open(input_path, "r") as f:
                    data = json.load(f)
                if "nodes" in data or "workflow" in data:
                    return json.dumps({"type": "n8n_workflow", "path": input_path})
                return json.dumps({"type": "json_config", "path": input_path})
            except json.JSONDecodeError:
                return json.dumps({"type": "unknown", "path": input_path, "error": "Invalid JSON"})

        return json.dumps({"type": "prd", "path": input_path, "extension": ext})

    # Plain text briefing
    return json.dumps({"type": "briefing", "text": input_path})


@mcp.tool()
def analyze_prd(file_path: str) -> str:
    """Analisa um PRD (Product Requirements Document) e extrai requisitos estruturados."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract sections
    sections = {}
    current_section = "intro"
    current_content = []

    for line in content.split("\n"):
        if line.startswith("#"):
            if current_content:
                sections[current_section] = "\n".join(current_content).strip()
            current_section = line.lstrip("#").strip().lower()
            current_content = []
        else:
            current_content.append(line)

    if current_content:
        sections[current_section] = "\n".join(current_content).strip()

    # Extract features (bullet points, numbered lists)
    features = []
    for section_name, section_content in sections.items():
        for line in section_content.split("\n"):
            line = line.strip()
            if re.match(r"^[-*]\s+", line) or re.match(r"^\d+\.\s+", line):
                feature = re.sub(r"^[-*\d.]+\s+", "", line).strip()
                if len(feature) > 10:  # Filter out short items
                    features.append({"text": feature, "source_section": section_name})

    # Extract potential data models (words that appear as nouns/entities)
    entity_patterns = [
        r"(?:tabela|table|modelo|model|entidade|entity)\s+[`\"']?(\w+)[`\"']?",
        r"(?:usuario|user|admin|cliente|client|paciente|patient|produto|product|pedido|order|item|categoria|category|post|comment|task|projeto|project)",
    ]

    entities = set()
    for pattern in entity_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        entities.update(m.lower() for m in matches if len(m) > 2)

    # Extract user roles
    role_patterns = [
        r"(?:role|papel|perfil|tipo de usuario)[\s:]+[`\"']?(\w+)[`\"']?",
        r"(?:admin|administrador|usuario|user|cliente|client|paciente|patient|medico|doctor|gerente|manager)",
    ]

    roles = set()
    for pattern in role_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        roles.update(m.lower() for m in matches if len(m) > 2)

    # Detect tech stack mentions
    stack_keywords = {
        "next.js": "nextjs", "nextjs": "nextjs", "react": "react",
        "vue": "vue", "nuxt": "nuxt", "svelte": "svelte",
        "supabase": "supabase", "firebase": "firebase",
        "prisma": "prisma", "drizzle": "drizzle",
        "postgres": "postgresql", "postgresql": "postgresql",
        "mysql": "mysql", "mongodb": "mongodb",
        "tailwind": "tailwind", "shadcn": "shadcn",
        "stripe": "stripe", "clerk": "clerk",
        "vercel": "vercel", "docker": "docker",
    }

    detected_stack = {}
    content_lower = content.lower()
    for keyword, tech in stack_keywords.items():
        if keyword in content_lower:
            detected_stack[tech] = True

    result = {
        "type": "prd_analysis",
        "sections": list(sections.keys()),
        "total_words": len(content.split()),
        "features": features[:50],
        "entities": sorted(entities),
        "roles": sorted(roles),
        "detected_stack": detected_stack,
        "has_auth_requirement": any(
            w in content_lower
            for w in ["login", "autenticacao", "authentication", "auth", "registro", "signup", "sign up"]
        ),
        "has_payment": any(
            w in content_lower
            for w in ["pagamento", "payment", "stripe", "checkout", "assinatura", "subscription", "plano", "pricing"]
        ),
        "has_notification": any(
            w in content_lower
            for w in ["notificacao", "notification", "email", "push", "sms", "webhook"]
        ),
        "has_file_upload": any(
            w in content_lower
            for w in ["upload", "arquivo", "file", "imagem", "image", "foto", "photo", "anexo", "attachment"]
        ),
        "has_realtime": any(
            w in content_lower
            for w in ["realtime", "real-time", "tempo real", "websocket", "sse", "live", "chat"]
        ),
        "raw_content_preview": content[:3000],
    }

    return json.dumps(result, indent=2, ensure_ascii=False)


@mcp.tool()
def analyze_n8n_workflow(file_path: str) -> str:
    """Analisa um workflow N8N exportado (JSON) e extrai features e fluxos."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Handle both single workflow and multi-workflow exports
    workflows = []
    if "nodes" in data:
        workflows.append(data)
    elif "workflow" in data:
        workflows.append(data["workflow"])
    elif isinstance(data, list):
        workflows = data

    all_nodes = []
    all_connections = []
    triggers = []
    actions = []
    integrations = set()

    for workflow in workflows:
        nodes = workflow.get("nodes", [])
        connections = workflow.get("connections", {})

        for node in nodes:
            node_type = node.get("type", "")
            node_name = node.get("name", "")
            node_info = {
                "name": node_name,
                "type": node_type,
                "parameters": node.get("parameters", {}),
            }

            all_nodes.append(node_info)

            # Classify nodes
            if "trigger" in node_type.lower() or "webhook" in node_type.lower():
                triggers.append(node_info)
            else:
                actions.append(node_info)

            # Extract integrations
            parts = node_type.split(".")
            if len(parts) > 1:
                integrations.add(parts[0].replace("n8n-nodes-base.", ""))

        all_connections.extend(
            [{"from": k, "to": list(v.keys()) if isinstance(v, dict) else v}
             for k, v in connections.items()]
        )

    # Map N8N patterns to features
    feature_map = {
        "webhook": "API endpoint / webhook receiver",
        "httpRequest": "Integracao com API externa",
        "postgres": "Operacoes de banco de dados PostgreSQL",
        "mysql": "Operacoes de banco de dados MySQL",
        "gmail": "Envio/recebimento de emails",
        "slack": "Notificacoes Slack",
        "telegram": "Bot Telegram",
        "stripe": "Processamento de pagamentos",
        "googleSheets": "Integracao Google Sheets",
        "spreadsheetFile": "Processamento de planilhas",
        "if": "Logica condicional / branching",
        "switch": "Roteamento multi-path",
        "set": "Transformacao de dados",
        "code": "Logica customizada (codigo)",
        "cron": "Agendamento / cron job",
        "schedule": "Agendamento de tarefas",
    }

    inferred_features = []
    for integration in integrations:
        for key, feature in feature_map.items():
            if key.lower() in integration.lower():
                inferred_features.append(feature)

    result = {
        "type": "n8n_analysis",
        "workflow_count": len(workflows),
        "total_nodes": len(all_nodes),
        "triggers": triggers,
        "actions": actions[:30],
        "integrations": sorted(integrations),
        "connections_count": len(all_connections),
        "inferred_features": list(set(inferred_features)),
        "has_webhook": any("webhook" in t["type"].lower() for t in triggers),
        "has_cron": any("cron" in t["type"].lower() or "schedule" in t["type"].lower() for t in triggers),
        "has_database": any(
            db in str(integrations).lower()
            for db in ["postgres", "mysql", "mongodb", "supabase"]
        ),
        "has_email": any(
            e in str(integrations).lower()
            for e in ["gmail", "email", "sendgrid", "mailgun"]
        ),
        "has_payment": any("stripe" in str(integrations).lower() for _ in [1]),
    }

    return json.dumps(result, indent=2, ensure_ascii=False)


@mcp.tool()
def analyze_website(url: str) -> str:
    """Analisa um site e extrai estrutura, design, features e UX patterns."""
    import requests
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except Exception as e:
        return json.dumps({"error": str(e), "url": url})

    soup = BeautifulSoup(response.text, "lxml")

    # Extract navigation/pages
    nav_links = []
    for nav in soup.find_all(["nav", "header"]):
        for a in nav.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)
            if text and len(text) < 50 and not href.startswith("#"):
                nav_links.append({"text": text, "href": href})

    # Extract page structure
    headings = []
    for level in range(1, 4):
        for h in soup.find_all(f"h{level}"):
            headings.append({"level": level, "text": h.get_text(strip=True)[:100]})

    # Extract forms (features)
    forms = []
    for form in soup.find_all("form"):
        inputs = []
        for inp in form.find_all(["input", "select", "textarea"]):
            inputs.append({
                "type": inp.get("type", inp.name),
                "name": inp.get("name", ""),
                "placeholder": inp.get("placeholder", ""),
            })
        forms.append({"action": form.get("action", ""), "inputs": inputs})

    # Extract colors from inline styles and CSS classes
    colors = set()
    style_tags = soup.find_all("style")
    for style in style_tags:
        hex_colors = re.findall(r"#[0-9a-fA-F]{3,8}", style.string or "")
        colors.update(hex_colors[:20])

    # Detect features from content
    page_text = soup.get_text().lower()
    detected_features = {
        "has_login": any(w in page_text for w in ["login", "sign in", "entrar", "fazer login"]),
        "has_signup": any(w in page_text for w in ["sign up", "register", "criar conta", "cadastro"]),
        "has_pricing": any(w in page_text for w in ["pricing", "precos", "planos", "plans"]),
        "has_dashboard": any(w in page_text for w in ["dashboard", "painel", "analytics"]),
        "has_search": bool(soup.find("input", {"type": "search"}) or soup.find("input", {"placeholder": re.compile(r"search|busca", re.I)})),
        "has_footer": bool(soup.find("footer")),
        "has_sidebar": bool(soup.find(class_=re.compile(r"sidebar|side-nav|sidenav", re.I))),
        "has_modal": bool(soup.find(class_=re.compile(r"modal|dialog", re.I))),
        "has_table": bool(soup.find("table")),
        "has_cards": bool(soup.find(class_=re.compile(r"card", re.I))),
    }

    # Extract meta info
    title = soup.find("title")
    description = soup.find("meta", {"name": "description"})
    og_image = soup.find("meta", {"property": "og:image"})

    result = {
        "type": "website_analysis",
        "url": url,
        "title": title.get_text(strip=True) if title else "",
        "description": description.get("content", "") if description else "",
        "og_image": og_image.get("content", "") if og_image else "",
        "navigation": nav_links[:20],
        "headings": headings[:30],
        "forms": forms[:10],
        "colors_found": sorted(colors)[:15],
        "detected_features": detected_features,
        "total_links": len(soup.find_all("a")),
        "total_images": len(soup.find_all("img")),
        "total_forms": len(forms),
        "has_javascript": bool(soup.find_all("script")),
        "has_responsive_meta": bool(soup.find("meta", {"name": "viewport"})),
    }

    return json.dumps(result, indent=2, ensure_ascii=False)


@mcp.tool()
def generate_blueprint(
    project_name: str,
    analysis_json: str,
    stack: str = "nextjs+supabase",
    include_auth: bool = True,
) -> str:
    """Gera um BLUEPRINT.md estruturado a partir da analise de input.
    analysis_json: JSON string retornado por analyze_prd, analyze_n8n_workflow, ou analyze_website
    stack: nextjs+supabase (default), nuxt+postgres, svelte+postgres
    """
    analysis = json.loads(analysis_json)
    input_type = analysis.get("type", "unknown")

    # Build blueprint structure
    blueprint = {
        "project_name": project_name,
        "input_type": input_type,
        "stack": stack,
        "auth": include_auth,
    }

    # Extract features based on input type
    if input_type == "prd_analysis":
        blueprint["features"] = [f["text"] for f in analysis.get("features", [])]
        blueprint["entities"] = analysis.get("entities", [])
        blueprint["roles"] = analysis.get("roles", ["user", "admin"])
        blueprint["has_payment"] = analysis.get("has_payment", False)
        blueprint["has_notification"] = analysis.get("has_notification", False)
        blueprint["has_file_upload"] = analysis.get("has_file_upload", False)
        blueprint["has_realtime"] = analysis.get("has_realtime", False)
        blueprint["detected_stack"] = analysis.get("detected_stack", {})

    elif input_type == "n8n_analysis":
        blueprint["features"] = analysis.get("inferred_features", [])
        blueprint["integrations"] = analysis.get("integrations", [])
        blueprint["has_webhook"] = analysis.get("has_webhook", False)
        blueprint["has_cron"] = analysis.get("has_cron", False)
        blueprint["has_payment"] = analysis.get("has_payment", False)
        blueprint["has_email"] = analysis.get("has_email", False)
        blueprint["entities"] = ["workflow", "execution", "log"]
        blueprint["roles"] = ["admin", "operator"]

    elif input_type == "website_analysis":
        features = []
        detected = analysis.get("detected_features", {})
        if detected.get("has_login"): features.append("Sistema de login")
        if detected.get("has_signup"): features.append("Cadastro de usuarios")
        if detected.get("has_pricing"): features.append("Pagina de precos/planos")
        if detected.get("has_dashboard"): features.append("Dashboard com metricas")
        if detected.get("has_search"): features.append("Busca")
        if detected.get("has_table"): features.append("Listagens em tabela")
        if detected.get("has_cards"): features.append("Cards de conteudo")
        if detected.get("has_sidebar"): features.append("Navegacao lateral")

        blueprint["features"] = features
        blueprint["navigation"] = [n["text"] for n in analysis.get("navigation", [])]
        blueprint["colors"] = analysis.get("colors_found", [])
        blueprint["entities"] = []
        blueprint["roles"] = ["user", "admin"] if detected.get("has_login") else ["user"]
        blueprint["reference_url"] = analysis.get("url", "")
        blueprint["reference_title"] = analysis.get("title", "")

    # Generate markdown blueprint
    md_lines = [
        f"# Blueprint: {project_name}",
        "",
        f"**Input:** {input_type}",
        f"**Stack:** {stack}",
        f"**Auth:** {'Sim' if include_auth else 'Nao'}",
        "",
        "## Features",
        "",
    ]

    for i, feature in enumerate(blueprint.get("features", []), 1):
        md_lines.append(f"{i}. {feature}")

    md_lines.extend([
        "",
        "## Data Models",
        "",
    ])

    for entity in blueprint.get("entities", []):
        md_lines.append(f"- `{entity}`")

    md_lines.extend([
        "",
        "## Roles",
        "",
    ])

    for role in blueprint.get("roles", []):
        md_lines.append(f"- `{role}`")

    md_lines.extend([
        "",
        "## Capabilities",
        "",
        f"- Payment: {'Sim' if blueprint.get('has_payment') else 'Nao'}",
        f"- Notifications: {'Sim' if blueprint.get('has_notification') else 'Nao'}",
        f"- File Upload: {'Sim' if blueprint.get('has_file_upload') else 'Nao'}",
        f"- Realtime: {'Sim' if blueprint.get('has_realtime') else 'Nao'}",
        "",
        "## Raw Analysis",
        "",
        "```json",
        json.dumps(blueprint, indent=2, ensure_ascii=False),
        "```",
    ])

    return "\n".join(md_lines)


if __name__ == "__main__":
    mcp.run()

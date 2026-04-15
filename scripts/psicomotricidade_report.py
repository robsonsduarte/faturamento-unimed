"""
Relatorio de procedimentos de PSICOMOTRICIDADE nos lotes TISS UNIMED Marco 2026.

Faz parse dos XMLs TISS (namespace ans:) e extrai todas as guias que contem
ao menos um procedimento com 'PSICOMOTRICIDADE' na descricao.

Saida: tabela formatada (Lote, Guia, Carteira Beneficiario, Sessoes, Valor Total)
       + soma total dos valores.
"""

import xml.etree.ElementTree as ET
import os
from decimal import Decimal

LOTES_DIR = "/Users/robsonduarte/Desktop/LOTES UNIMED MARCO 26"
TARGET_LOTES = [640, 641, 643, 644, 646, 649]
KEYWORD = "PSICOMOTRICIDADE"
NS_URI = "http://www.ans.gov.br/padroes/tiss/schemas"
NS = {"ans": NS_URI}


def get_text(elem, xpath):
    """Retorna o texto de um subelemento ou string vazia."""
    node = elem.find(xpath, NS)
    if node is not None and node.text:
        return node.text.strip()
    return ""


def parse_lote(filepath: str, lote_num: int) -> list[dict]:
    """
    Parseia um XML TISS e retorna lista de guias com procedimentos
    de psicomotricidade.
    """
    try:
        tree = ET.parse(filepath)
    except ET.ParseError as e:
        print(f"[ERRO] Falha ao parsear {filepath}: {e}")
        return []

    root = tree.getroot()
    results = []

    guias = root.findall(".//ans:guiaSP-SADT", NS)

    for guia in guias:
        # Verificar se algum procedimento contem psicomotricidade
        procs_executados = guia.findall(".//ans:procedimentoExecutado", NS)
        psico_procs = []

        for proc in procs_executados:
            descricao = get_text(proc, "ans:procedimento/ans:descricaoProcedimento")
            if KEYWORD in descricao.upper():
                psico_procs.append(proc)

        if not psico_procs:
            continue

        # Numero da guia (preferir numeroGuiaOperadora, fallback para numeroGuiaPrestador)
        num_guia = get_text(guia, "ans:dadosAutorizacao/ans:numeroGuiaOperadora")
        if not num_guia:
            num_guia = get_text(guia, "ans:cabecalhoGuia/ans:numeroGuiaPrestador")

        # Identificacao do beneficiario (TISS nao inclui nome, apenas carteira)
        carteira = get_text(guia, "ans:dadosBeneficiario/ans:numeroCarteira")

        # Valor total da guia (bloco valorTotal no nivel da guia)
        valor_total_str = get_text(guia, "ans:valorTotal/ans:valorTotalGeral")
        try:
            valor_total = Decimal(valor_total_str) if valor_total_str else Decimal("0")
        except Exception:
            valor_total = Decimal("0")

        # Contar sessoes de psicomotricidade
        sessoes = len(psico_procs)

        # Nome do profissional executor (pode ajudar a identificar)
        prof_nome = ""
        if psico_procs:
            prof_nome = get_text(psico_procs[0], "ans:equipeSadt/ans:nomeProf")

        results.append({
            "lote": lote_num,
            "guia": num_guia,
            "carteira": carteira,
            "sessoes": sessoes,
            "valor_total": valor_total,
            "profissional": prof_nome,
        })

    return results


def format_brl(value: Decimal) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def main():
    all_results = []

    for lote_num in TARGET_LOTES:
        filepath = os.path.join(LOTES_DIR, f"lote-{lote_num}.xml")
        if not os.path.exists(filepath):
            print(f"[AVISO] Arquivo nao encontrado: {filepath}")
            continue

        results = parse_lote(filepath, lote_num)
        all_results.extend(results)
        print(f"Lote {lote_num}: {len(results)} guia(s) com psicomotricidade encontrada(s)")

    if not all_results:
        print("\nNenhuma guia com psicomotricidade encontrada.")
        return

    # Ordenar por lote, depois por guia
    all_results.sort(key=lambda r: (r["lote"], r["guia"]))

    # Calcular larguras das colunas
    col_lote      = max(5, max(len(str(r["lote"])) for r in all_results))
    col_guia      = max(14, max(len(r["guia"]) for r in all_results))
    col_carteira  = max(22, max(len(r["carteira"]) for r in all_results))
    col_sessoes   = max(7, max(len(str(r["sessoes"])) for r in all_results))
    col_valor     = max(15, max(len(format_brl(r["valor_total"])) for r in all_results))
    col_prof      = max(10, max(len(r["profissional"]) for r in all_results))

    sep = (
        f"+{'-' * (col_lote + 2)}"
        f"+{'-' * (col_guia + 2)}"
        f"+{'-' * (col_carteira + 2)}"
        f"+{'-' * (col_sessoes + 2)}"
        f"+{'-' * (col_valor + 2)}"
        f"+{'-' * (col_prof + 2)}+"
    )

    header = (
        f"| {'Lote':<{col_lote}} "
        f"| {'Guia Operadora':<{col_guia}} "
        f"| {'Carteira Beneficiario':<{col_carteira}} "
        f"| {'Sessoes':<{col_sessoes}} "
        f"| {'Valor Total':<{col_valor}} "
        f"| {'Profissional':<{col_prof}} |"
    )

    print()
    print("=" * len(sep))
    print("  PROCEDIMENTOS DE PSICOMOTRICIDADE — LOTES UNIMED MARCO 2026")
    print("=" * len(sep))
    print(sep)
    print(header)
    print(sep)

    total = Decimal("0")
    for r in all_results:
        valor_fmt = format_brl(r["valor_total"])
        row = (
            f"| {str(r['lote']):<{col_lote}} "
            f"| {r['guia']:<{col_guia}} "
            f"| {r['carteira']:<{col_carteira}} "
            f"| {str(r['sessoes']):<{col_sessoes}} "
            f"| {valor_fmt:<{col_valor}} "
            f"| {r['profissional']:<{col_prof}} |"
        )
        print(row)
        total += r["valor_total"]

    print(sep)
    print()
    print(f"  Total de guias encontradas : {len(all_results)}")
    print(f"  Soma total dos valores     : {format_brl(total)}")
    print()


if __name__ == "__main__":
    main()

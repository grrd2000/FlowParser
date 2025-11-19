import re
import pdfplumber
import pandas as pd


re_row1 = re.compile(
    r"^(\d{2}\.\d{2}\.\d{4})"      # data operacji
    r"\s+(\S+)"                    # identyfikator
    r"\s+(.*?)"                    # typ operacji
    r"\s+([-+]?\d[\d ]*,\d{2})"    # kwota
    r"\s+([-+]?\d[\d ]*,\d{2})$"   # saldo
)

re_row2 = re.compile(
    r"^(\d{2}\.\d{2}\.\d{4})(?:\s+(.*))?$"
)

STOP_PHRASES = ("Saldo do przeniesienia", "Saldo końcowe")


def parse_pko_statement(pdf_path: str) -> pd.DataFrame:
    
    records = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.splitlines() if l.strip()]

            # znajdź nagłówek
            start_idx = None
            for i, line in enumerate(lines):
                if line.startswith("Data operacji") and "Identyfikator operacji" in line:
                    start_idx = i + 2  # pomiń 2 linie nagłówka
                    break
            if start_idx is None:
                continue

            data_lines = lines[start_idx:]
            n = len(data_lines)
            i = 0

            while i < n:
                l1 = data_lines[i]
                m1 = re_row1.match(l1)
                if not m1:
                    i += 1
                    continue

                if i + 1 >= n:
                    break
                l2 = data_lines[i + 1]
                m2 = re_row2.match(l2)
                if not m2:
                    i += 1
                    continue

                data_operacji, ident, typ, kwota, saldo = m1.groups()
                data_waluty, opis_first = m2.groups()
                opis_parts = []
                if opis_first:
                    opis_parts.append(opis_first)

                j = i + 2
                while j < n:
                    line_j = data_lines[j]
                    if re_row1.match(line_j):
                        break
                    if any(phrase in line_j for phrase in STOP_PHRASES):
                        break
                    opis_parts.append(line_j)
                    j += 1

                opis_full = " ".join(opis_parts).strip()

                for phrase in STOP_PHRASES:
                    idx = opis_full.find(phrase)
                    if idx != -1:
                        opis_full = opis_full[:idx].strip()

                records.append({
                    "operation_date": data_operacji,
                    "value_date": data_waluty,
                    "operation_id": ident,
                    "operation_type": typ,
                    "amount": kwota,
                    "balance": saldo,
                    "description": opis_full,
                })

                i = j 


    df = pd.DataFrame(records)

    print(df.describe())
    print(df.info())
    print(df)

    # df.to_excel("pko_wyciąg.xlsx", index=False)

    print(DQ_check_balance_continuity(df))

    return df




# DQ check: ciągłość sald

def DQ_check_balance_continuity(df: pd.DataFrame) -> bool:

    df_check = df.copy()

    def parse_pl_amount(x):
        if pd.isna(x):
            return None
        s = str(x).replace("\u00a0", "").replace(" ", "").replace(",", ".")
        s = s.replace("+", "")
        try:
            return float(s)
        except ValueError:
            return None

    df_check["amount"] = df_check["amount"].apply(parse_pl_amount)
    df_check["balance"] = df_check["balance"].apply(parse_pl_amount)

    breaks = []

    for i in range(len(df_check) - 1):
        s0 = df_check.loc[i, "balance"]
        k1 = df_check.loc[i + 1, "amount"]
        s1 = df_check.loc[i + 1, "balance"]

        if pd.isna(s0) or pd.isna(k1) or pd.isna(s1):
            print(f"  Pomijam rekordy {i} i {i+1} z powodu brakujących danych.")
            continue

        if (s0 + k1).round(2) != s1:
            breaks.append((i, i + 1, s0, k1, s1))

    if not breaks:
        print("Ciągłość sald OK — wszystkie rekordy spójne.")
        return True
    else:
        print("Nieciągłości sald:")
        for (i, j, s0, k1, s1) in breaks:
            print(
                f"  {i} -> {j}: "
                f"{s0:.2f} + {k1:.2f} ≠ {s1:.2f} -> {s0 + k1:.2f}\t{df_check.loc[j, 'Identyfikator operacji']}"
            )
        return False

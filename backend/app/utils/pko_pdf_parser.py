import re
import pdfplumber
import pandas as pd


# "WYCIĄG za okres 01.09.2025 - 30.09.2025"
RE_PERIOD = re.compile(r"WYCIĄG za okres\s+(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})", re.IGNORECASE)

# "Data: 01.10.2025" (data wygenerowania wyciągu)
RE_STATEMENT_DATE = re.compile(r"Data:\s*(\d{2}\.\d{2}\.\d{4})", re.IGNORECASE)

# "strona 1/26" -> interesuje nas 26 (łączna liczba stron)
RE_PAGE_TOTAL = re.compile(r"strona\s+\d+\s*/\s*(\d+)", re.IGNORECASE)

# "Nr rachunku/karty: 12 3456 7890 1234 5678 9012 3456"
RE_ACCOUNT_NUMBER = re.compile(r"Nr rachunku/karty:\s*([0-9 ]+)", re.IGNORECASE)

# Nazwisko i imię właściciela rachunku
RE_OWNER_BLOCK = re.compile(r"Nr IBAN.*?\n([A-ZĄĆĘŁŃÓŚŻŹ0-9 .'-]+)\n.*?Rodzaj rachunku:", re.DOTALL)

# "Rodzaj rachunku: Konto Oszczędnościowe SUPER"
RE_ACCOUNT_TYPE = re.compile(r"Rodzaj rachunku:\s*(.+)", re.IGNORECASE)

# "Waluta rachunku: PLN"
RE_ACCOUNT_CURRENCY = re.compile(r"Waluta rachunku:\s*([A-Z]{3,})", re.IGNORECASE)

# liczby w formacie polskim: opcjonalny znak, tysiące ze spacjami, przecinek, 2 miejsca
PL_AMOUNT_PATTERN = r"[-+]?\d[\d ]*,\d{2}"

# "Obroty MA 1 234,56"
RE_TURNOVER_MA = re.compile(rf"Obroty MA\s+({PL_AMOUNT_PATTERN})", re.IGNORECASE)

# "Obroty WN -3 890,69"
RE_TURNOVER_WN = re.compile(rf"Obroty WN\s+({PL_AMOUNT_PATTERN})", re.IGNORECASE)

# "Saldo poprzednie -12 345,67"
RE_PREVIOUS_BALANCE = re.compile(rf"Saldo poprzednie\s+({PL_AMOUNT_PATTERN})", re.IGNORECASE)


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
    
    account_info = {}
    statement_info = {}
    transactions = []

    with pdfplumber.open(pdf_path) as pdf:

        page0 = pdf.pages[0]
        text0 = page0.extract_text() or ""
        lines = [l.strip() for l in text0.splitlines() if l.strip()]

        header_idx = None
        for i, line in enumerate(lines):
            if line.startswith("Data operacji") and "Identyfikator operacji" in line:
                header_idx = i
                break

        if header_idx is None:
            raise RuntimeError("Nie znalazłem nagłówka tabeli na 1. stronie")

        header_lines = lines[:header_idx]
        header_text = "\n".join(header_lines)

        print(header_text)

        statement_info["period_start"], statement_info["period_end"] = RE_PERIOD.search(header_text).groups()
        statement_info["statement_date"] = RE_STATEMENT_DATE.search(header_text).group(1)
        statement_info["pages_total"] = int(RE_PAGE_TOTAL.search(header_text).group(1))
        statement_info["turnover_ma"] = RE_TURNOVER_MA.search(header_text).group(1)
        statement_info["turnover_wn"] = RE_TURNOVER_WN.search(header_text).group(1)
        statement_info["previous_balance"] = RE_PREVIOUS_BALANCE.search(header_text).group(1)

        account_info["account_number"] = RE_ACCOUNT_NUMBER.search(header_text).group(1)
        account_info["account_owner"] = RE_OWNER_BLOCK.search(header_text).group(1).strip()
        account_info["account_type"] = RE_ACCOUNT_TYPE.search(header_text).group(1)
        account_info["account_currency"] = RE_ACCOUNT_CURRENCY.search(header_text).group(1)

        print("\nInformacje o rachunku:")
        for k, v in account_info.items():
            print(f"  {k}: \t{v}")

        print("\nInformacje o wyciągu:")
        for k, v in statement_info.items():
            print(f"  {k}: \t{v}")

        print("\n")

        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.splitlines() if l.strip()]

            start_idx = None
            for i, line in enumerate(lines):
                if line.startswith("Data operacji") and "Identyfikator operacji" in line:
                    start_idx = i + 2 
                    break
            if start_idx is None:
                continue

            header_lines = lines[:start_idx - 2]
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

                transactions.append({
                    "operation_date": data_operacji,
                    "value_date": data_waluty,
                    "operation_id": ident,
                    "operation_type": typ,
                    "amount": kwota,
                    "balance": saldo,
                    "description": opis_full,
                })

                i = j 


    df_transactions = pd.DataFrame(transactions)

    print(df_transactions.describe())
    print(df_transactions.info())
    print(df_transactions)

    # df.to_excel("pko_wyciąg.xlsx", index=False)

    # print(DQ_check_balance_continuity(df_transactions))
    DQ_check_balance_continuity(df_transactions)

    return df_transactions




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

#!/usr/bin/env python3
"""
Seed script: reads both Excel files and populates the SQLite database.
Run: python3 scripts/seed.py
"""

import sqlite3
import re
import os
import sys

try:
    import openpyxl
    import xlrd
except ImportError:
    print("Missing dependencies. Run: pip3 install openpyxl xlrd")
    sys.exit(1)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db")
XLSX_2025 = os.path.join(os.path.dirname(__file__), "..", "Coro Oficial Repertorio 2025.xlsx")
XLS_2020 = os.path.join(os.path.dirname(__file__), "..", "Listado de Himnos 2020.xls")


def normalize(title: str) -> str:
    """Normalize title for deduplication: lowercase, collapse whitespace, strip."""
    if not title:
        return ""
    t = str(title).strip()
    t = re.sub(r"[\t\r\n]+", " ", t)
    t = re.sub(r" {2,}", " ", t)
    return t.lower()


def parse_comentarios(raw):
    """Parse Comentarios field from 2025 file into (tag, hymnary_number)."""
    if not raw:
        return None, None
    text = str(raw).strip()
    hymn_number = None
    tag = None

    # Extract hymnary number e.g. "Himnario /359"
    m = re.search(r"[Hh]imnario\s*/?\s*(\d+)", text)
    if m:
        hymn_number = int(m.group(1))
        tag = "Himnario"
        return tag, hymn_number

    # Keyword mapping
    keywords = {
        "CIPSA": "CIPSA",
        "Funeral": "Funeral",
        "Bienvenida": "Bienvenida",
        "Predicacion": "Predicacion",
        "Predicación": "Predicacion",
        "Santa Cena": "Santa Cena",
    }
    for k, v in keywords.items():
        if k.lower() in text.lower():
            tag = v
            break

    return tag, hymn_number


def parse_2020(path):
    """Parse the 2020 XLS file. Returns dict keyed by normalized title."""
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_name("Listado 2020")
    hymns = {}
    for i in range(1, ws.nrows):  # skip header row 0
        row = ws.row_values(i)
        raw_title = row[0] if len(row) > 0 else ""
        composer = str(row[1]).strip() if len(row) > 1 and row[1] else None
        version = str(row[2]).strip() if len(row) > 2 and row[2] else None
        hymn_type = str(row[3]).strip() if len(row) > 3 and row[3] else None
        observation = str(row[4]).strip() if len(row) > 4 and row[4] else None
        conference = str(row[5]).strip() if len(row) > 5 and row[5] else ""

        title = str(raw_title).strip()
        title = re.sub(r"[\t]+", " ", title).strip()
        if not title:
            continue

        key = normalize(title)
        hymns[key] = {
            "title": title,
            "composer": composer or None,
            "version": version or None,
            "hymnType": hymn_type or None,
            "soloistNote": observation or None,
            "inConference2021": 1 if conference else 0,
        }
    return hymns


def parse_2025(path):
    """Parse the 2025 XLSX file. Returns list of hymn dicts."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Himnos CIPSA 2025"]
    hymns = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue  # skip header
        # row: (N, title, demo, comentarios)
        raw_title = row[1] if len(row) > 1 else None
        demo = row[2] if len(row) > 2 else None
        comentarios = row[3] if len(row) > 3 else None

        if not raw_title:
            continue
        title = str(raw_title).strip()
        if not title:
            continue

        has_demo = str(demo).strip().upper() == "SI" if demo else False
        tag, hymn_number = parse_comentarios(comentarios)

        hymns.append({
            "title": title,
            "hasDemo": 1 if has_demo else 0,
            "tag": tag,
            "hymnaryNumber": hymn_number,
        })
    return hymns


def seed():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # Wipe existing data (idempotent re-runs)
    cur.execute("DELETE FROM Hymn")
    con.commit()

    # Parse both files
    hymns_2020 = parse_2020(XLS_2020)
    hymns_2025 = parse_2025(XLSX_2025)

    rows = []
    matched_keys = set()

    # Process 2025 hymns (all ACTIVE)
    for h in hymns_2025:
        key = normalize(h["title"])
        if key in hymns_2020:
            # Merge: 2025 status wins, 2020 provides metadata
            h2020 = hymns_2020[key]
            matched_keys.add(key)
            rows.append((
                h["title"],
                "ACTIVE",
                "BOTH",
                h["hasDemo"],
                h["tag"],
                h["hymnaryNumber"],
                h2020["composer"],
                h2020["version"],
                h2020["hymnType"],
                h2020["soloistNote"],
                h2020["inConference2021"],
            ))
        else:
            rows.append((
                h["title"],
                "ACTIVE",
                "2025",
                h["hasDemo"],
                h["tag"],
                h["hymnaryNumber"],
                None, None, None, None, 0,
            ))

    # Process remaining 2020 hymns (BACKLOG)
    for key, h in hymns_2020.items():
        if key in matched_keys:
            continue
        rows.append((
            h["title"],
            "BACKLOG",
            "2020",
            0,
            None,
            None,
            h["composer"],
            h["version"],
            h["hymnType"],
            h["soloistNote"],
            h["inConference2021"],
        ))

    cur.executemany("""
        INSERT INTO Hymn (
            title, status, source,
            hasDemo, tag, hymnaryNumber,
            composer, version, hymnType, soloistNote, inConference2021,
            createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, rows)
    con.commit()

    total = len(rows)
    active = sum(1 for r in rows if r[1] == "ACTIVE")
    backlog = sum(1 for r in rows if r[1] == "BACKLOG")
    merged = len(matched_keys)

    print(f"Seed completo:")
    print(f"  Total:   {total}")
    print(f"  Activos: {active} (de 2025)")
    print(f"  Backlog: {backlog} (de 2020)")
    print(f"  Merged:  {merged} (aparecen en ambos)")
    con.close()


if __name__ == "__main__":
    seed()

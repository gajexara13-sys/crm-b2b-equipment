"""Russian name and position declension utilities.

Surname declension uses explicit rule-based logic (reliable for all common
Russian patterns).  First names and patronymics use pymorphy3 as usual.
"""
from __future__ import annotations

try:
    import pymorphy3 as _pm
    _morph = _pm.MorphAnalyzer()
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

_VOWELS = set("аеёиоуыэюя")


# ---------------------------------------------------------------------------
# Rule-based surname dative (more reliable than pymorphy3 for surnames)
# ---------------------------------------------------------------------------

def _surname_dative(surname: str, gender: str | None) -> str:
    """Return dative form of a Russian surname using explicit rules.

    Returns the original string unchanged when the surname is non-declining
    or the pattern cannot be determined safely.
    """
    s = surname
    lo = s.lower()

    # ── Never decline ──────────────────────────────────────────────────────
    # Ukrainian: -енко, -ко  (but NOT -ков which ends in -ов)
    if lo.endswith("енко"):
        return s
    if lo.endswith("ко") and not lo.endswith("ков"):
        return s
    # Georgian
    if lo.endswith(("дзе", "швили")):
        return s
    # Plural-form surnames
    if lo.endswith(("ых", "их")):
        return s

    # ── Adjective-style feminine: -ская / -цкая ────────────────────────────
    if lo.endswith(("ская", "цкая")):
        return s[:-2] + "ой"          # Соколовская → Соколовской

    # ── Adjective-style masculine: -ский / -цкий ──────────────────────────
    if lo.endswith(("ский", "цкий")):
        return s[:-2] + "ому"         # Соколовский → Соколовскому

    # ── General adjective-style feminine -ая ──────────────────────────────
    if lo.endswith("ая") and gender == "femn":
        return s[:-2] + "ой"

    # ── -ова / -ева / -ёва (feminine of -ов/-ев) ──────────────────────────
    if lo.endswith(("ова", "ева", "ёва")):
        return s[:-1] + "ой"          # Иванова → Ивановой

    # ── -ов / -ев / -ёв (masculine) ───────────────────────────────────────
    if lo.endswith(("ов", "ев", "ёв")):
        return s + "у"                # Иванов → Иванову  (NOT Ивановому!)

    # ── -ина / -ына (feminine of -ин/-ын) ────────────────────────────────
    if lo.endswith(("ина", "ына")):
        return s[:-1] + "ой"          # Ильина → Ильиной

    # ── -ин / -ын (masculine) ─────────────────────────────────────────────
    if lo.endswith(("ин", "ын")):
        return s + "у"                # Ильин → Ильину

    # ── Caucasian -ян / -янц ─────────────────────────────────────────────
    if lo.endswith(("янц", "ян")):
        if gender == "femn":
            return s                  # female Caucasian — don't decline
        return s + "у"                # Петросян → Петросяну

    # ── Consonant-ending surnames ─────────────────────────────────────────
    if lo[-1] not in _VOWELS:
        if gender == "femn":
            return s                  # Анна Блок → Анне Блок (no change)
        if gender == "masc":
            if lo[-1] == "й":
                return s[:-1] + "ю"  # Толстой → Толстому? No: Толстой→Толстому
            if lo[-1] == "ь":
                return s[:-1] + "ю"  # Врубель → Врубелю
            return s + "у"            # Блок → Блоку
        # Unknown gender + consonant: don't guess
        return s

    # ── Ends in a vowel other than patterns above ─────────────────────────
    # (e.g. Дюма, Гюго — don't decline)
    return s


# ---------------------------------------------------------------------------
# pymorphy3 helper (for first names and patronymics)
# ---------------------------------------------------------------------------

def _inflect_word(word: str, case: str, gender: str | None = None,
                  prefer_surn: bool = False) -> str:
    if not _AVAILABLE or not word:
        return word
    parses = _morph.parse(word)
    if not parses:
        return word
    if prefer_surn:
        surn = [p for p in parses if "Surn" in str(p.tag)]
        if surn:
            if gender:
                gend = [p for p in surn if gender in str(p.tag)]
                if gend:
                    surn = gend
            parses = surn
    best = parses[0]
    inflected = best.inflect({case})
    if inflected:
        result = inflected.word
        if word[0].isupper():
            result = result[0].upper() + result[1:]
        return result
    return word


# ---------------------------------------------------------------------------
# Gender detection
# ---------------------------------------------------------------------------

def _detect_gender_from_parts(parts: list[str]) -> str | None:
    """Detect gender from patronymic suffix (3rd word)."""
    if len(parts) >= 3:
        pat = parts[2].lower()
        if pat.endswith(("ович", "евич")):
            return "masc"
        if pat.endswith(("овна", "евна", "вна", "ична", "инична")):
            return "femn"
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_full_name(full_name: str) -> dict:
    """
    Parse a Russian full name (Фамилия Имя Отчество) into declined forms.

    Returns dict with:
      nominative       – original: «Иванов Иван Иванович»
      dative_short     – «Иванову И.И.»  (used in «Кому» block of letter)
      greeting         – «Иван Иванович» (used in salutation «Уважаемый …!»)
      last_name_dative – «Иванову»
    """
    parts = full_name.strip().split()
    if not parts:
        return {"nominative": full_name, "dative_short": full_name,
                "greeting": full_name}

    gender = _detect_gender_from_parts(parts)
    last = parts[0]
    first = parts[1] if len(parts) >= 2 else ""
    patronymic = parts[2] if len(parts) >= 3 else ""

    # Surname: rule-based (avoids pymorphy3 adjective mis-analysis)
    last_dat = _surname_dative(last, gender)

    # First name and patronymic: pymorphy3
    first_dat = _inflect_word(first, "datv", gender=gender) if first else ""
    pat_dat = _inflect_word(patronymic, "datv", gender=gender) if patronymic else ""

    first_initial = f"{first[0]}." if first else ""
    pat_initial = f"{patronymic[0]}." if patronymic else ""

    return {
        "nominative": full_name,
        "dative_short": f"{last_dat} {first_initial}{pat_initial}".strip(),
        "dative_full": f"{last_dat} {first_dat} {pat_dat}".strip(),
        "greeting": f"{first} {patronymic}".strip() if first else full_name,
        "last_name": last,
        "first_name": first,
        "patronymic": patronymic,
        "last_name_dative": last_dat,
        "gender": gender or "unknown",
    }


def inflect_position(position: str, case: str = "datv") -> str:
    """Inflect each word of a job title to the given grammatical case.
    «Генеральный директор» → «Генеральному директору»
    """
    if not position:
        return position
    return " ".join(_inflect_word(w, case) for w in position.split())

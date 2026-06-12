"""
Minecraft Diamond-Backed Currency Banking — Database Layer
Extracted from the tkinter admin dashboard for web use.
"""

import sqlite3
import os
import shutil
import hashlib
import string
import csv
import json
import secrets
from datetime import datetime, timedelta
from contextlib import contextmanager

DB_NAME = "minecraft_bank.db"


def get_db_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), DB_NAME)


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS players (
            username TEXT PRIMARY KEY,
            date_opened TEXT NOT NULL DEFAULT (datetime('now')),
            diamond_balance REAL NOT NULL DEFAULT 0,
            note_balance REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','frozen','closed')),
            notes TEXT DEFAULT '',
            last_interest_calc TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE IF NOT EXISTS notes (
            serial_number TEXT PRIMARY KEY,
            denomination INTEGER NOT NULL,
            date_issued TEXT NOT NULL DEFAULT (datetime('now')),
            status TEXT NOT NULL DEFAULT 'held_in_reserve'
                CHECK(status IN ('circulating','redeemed','destroyed','held_in_reserve','lost')),
            issued_to TEXT DEFAULT NULL, redeemed_by TEXT DEFAULT NULL,
            redemption_date TEXT DEFAULT NULL, comments TEXT DEFAULT '',
            book_signed INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (issued_to) REFERENCES players(username),
            FOREIGN KEY (redeemed_by) REFERENCES players(username));
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            type TEXT NOT NULL CHECK(type IN (
                'deposit_diamonds','withdraw_diamonds','issue_notes','redeem_notes',
                'transfer','fee','interest_payment','loan_disbursement',
                'loan_repayment','adjustment')),
            player TEXT, player2 TEXT DEFAULT NULL,
            amount REAL NOT NULL, serial_numbers TEXT DEFAULT '',
            running_balance REAL DEFAULT 0, notes TEXT DEFAULT '',
            FOREIGN KEY (player) REFERENCES players(username));
        CREATE TABLE IF NOT EXISTS loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrower TEXT NOT NULL, principal REAL NOT NULL,
            interest_rate REAL NOT NULL,
            interest_type TEXT NOT NULL DEFAULT 'simple' CHECK(interest_type IN ('simple','compound')),
            compounding_period TEXT NOT NULL DEFAULT 'weekly'
                CHECK(compounding_period IN ('daily','weekly','bi-weekly')),
            issue_date TEXT NOT NULL DEFAULT (datetime('now')),
            due_date TEXT NOT NULL, remaining_balance REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active','paid_off','defaulted','restructured')),
            collateral TEXT DEFAULT '', notes TEXT DEFAULT '',
            FOREIGN KEY (borrower) REFERENCES players(username));
        CREATE TABLE IF NOT EXISTS loan_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            amount REAL NOT NULL, notes TEXT DEFAULT '',
            FOREIGN KEY (loan_id) REFERENCES loans(id));
        CREATE TABLE IF NOT EXISTS vault_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            previous_amount REAL NOT NULL, new_amount REAL NOT NULL,
            change_amount REAL NOT NULL, reason TEXT NOT NULL DEFAULT '');

        CREATE TABLE IF NOT EXISTS discord_links (
            discord_id TEXT PRIMARY KEY,
            minecraft_username TEXT DEFAULT NULL,
            verification_code TEXT DEFAULT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','verified','rejected','revoked')),
            requested_username TEXT DEFAULT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            verified_at TEXT DEFAULT NULL,
            FOREIGN KEY (minecraft_username) REFERENCES players(username));
        CREATE TABLE IF NOT EXISTS pending_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN (
                'link_account','transfer','loan_request','loan_payment',
                'deposit','withdrawal','other')),
            discord_id TEXT NOT NULL,
            player TEXT DEFAULT NULL,
            amount REAL DEFAULT 0,
            details TEXT DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','approved','denied','cancelled','expired')),
            admin_notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            resolved_at TEXT DEFAULT NULL,
            resolved_by TEXT DEFAULT 'admin',
            notified_discord INTEGER NOT NULL DEFAULT 0);

        CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower);
        CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
        CREATE INDEX IF NOT EXISTS idx_discord_links_username ON discord_links(minecraft_username);
        CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_requests(status);
        CREATE INDEX IF NOT EXISTS idx_pending_discord ON pending_requests(discord_id);
        """)
        # Migrations for existing databases
        for stmt in [
            "ALTER TABLE notes ADD COLUMN book_signed INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE pending_requests ADD COLUMN notified_discord INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN last_interest_calc TEXT DEFAULT NULL",
        ]:
            try:
                conn.execute(stmt)
            except sqlite3.OperationalError:
                pass
        conn.execute("UPDATE players SET last_interest_calc=datetime('now') WHERE last_interest_calc IS NULL")
        defaults = {
            'currency_name': 'Diamond Note', 'denominations': '1,5,20,64',
            'default_interest_rate': '5.0', 'default_compounding': 'weekly',
            'reserve_warning_yellow': '80', 'reserve_warning_red': '50',
            'redemption_fee_pct': '0', 'redemption_fee_flat': '0',
            'serial_prefix': 'D', 'vault_diamonds': '0',
            'discord_bot_token': '', 'discord_admin_channel': '',
            'discord_admin_user_id': '',
            'max_loan_amount': '256', 'max_transfer_amount': '640',
            'savings_interest_rate': '10.0', 'savings_compound_period': 'daily',
            'savings_payout_days': '7',
            'next_interest_payout': '',
            'last_interest_payout': '',
        }
        for k, v in defaults.items():
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))


# --- Settings ---

def get_setting(key):
    with get_connection() as c:
        r = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return r['value'] if r else None


def set_setting(key, value):
    with get_connection() as c:
        c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))


def get_denominations():
    v = get_setting('denominations')
    return [int(x.strip()) for x in v.split(',') if x.strip()] if v else [1, 5, 20, 64]


# --- Serial Numbers ---

def _check_chars(base):
    h = hashlib.sha256(base.encode()).hexdigest()[:4]
    az = string.ascii_uppercase
    return az[int(h[:2], 16) % 26] + az[int(h[2:4], 16) % 26]


def generate_serial_numbers(denomination, count):
    pfx = get_setting('serial_prefix') or 'D'
    with get_connection() as c:
        start = c.execute("SELECT COUNT(*) FROM notes WHERE denomination=?",
                          (denomination,)).fetchone()[0] + 1
        serials = []
        for i in range(count):
            base = f"{pfx}{denomination}-{start+i:06d}"
            serials.append(f"{base}-{_check_chars(base)}")
        for s in serials:
            c.execute("INSERT INTO notes (serial_number, denomination) VALUES (?, ?)",
                      (s, denomination))
        return serials


# --- Notes ---

def get_notes(status=None, denomination=None, search=None, signed=None, limit=500):
    with get_connection() as c:
        q, p = "SELECT * FROM notes WHERE 1=1", []
        if status:
            q += " AND status=?"
            p.append(status)
        if denomination:
            q += " AND denomination=?"
            p.append(denomination)
        if signed is not None:
            q += " AND book_signed=?"
            p.append(1 if signed else 0)
        if search:
            q += " AND (serial_number LIKE ? OR issued_to LIKE ? OR redeemed_by LIKE ? OR comments LIKE ?)"
            p.extend([f"%{search}%"] * 4)
        q += " ORDER BY date_issued DESC LIMIT ?"
        p.append(limit)
        return [dict(r) for r in c.execute(q, p).fetchall()]


def get_note(serial):
    with get_connection() as c:
        r = c.execute("SELECT * FROM notes WHERE serial_number=?", (serial,)).fetchone()
        return dict(r) if r else None


def update_note_status(serial, new_status, player=None):
    with get_connection() as c:
        n = c.execute("SELECT * FROM notes WHERE serial_number=?", (serial,)).fetchone()
        if not n:
            raise ValueError(f"Note {serial} not found")
        u = {"status": new_status}
        if new_status == 'circulating' and player:
            u['issued_to'] = player
        elif new_status == 'redeemed' and player:
            u['redeemed_by'] = player
            u['redemption_date'] = datetime.now().isoformat()
        sets = ','.join(f'{k}=?' for k in u)
        c.execute(f"UPDATE notes SET {sets} WHERE serial_number=?",
                  list(u.values()) + [serial])


def set_book_signed(serial, signed=True):
    with get_connection() as c:
        c.execute("UPDATE notes SET book_signed=? WHERE serial_number=?",
                  (1 if signed else 0, serial))


def get_note_stats():
    with get_connection() as c:
        return [dict(r) for r in c.execute(
            "SELECT denomination, status, COUNT(*) as cnt FROM notes GROUP BY denomination, status"
        ).fetchall()]


def get_circulating_value():
    with get_connection() as c:
        return c.execute(
            "SELECT COALESCE(SUM(denomination),0) FROM notes WHERE status='circulating'"
        ).fetchone()[0]


def book_text(serial, denomination, date_issued=None):
    date_str = (date_issued or '')[:10] or datetime.now().strftime("%Y-%m-%d")
    ds = "Diamond" if denomination == 1 else "Diamonds"
    page1 = (
        f"DIAMOND BANK\n\n"
        f"Official {ds} Note\n"
        f"Value: {denomination} {ds}\n\n"
        f"Backed 1:1 by\nvault diamonds.\n\n"
        f"SN: {serial}"
    )
    page2 = (
        f"SN: {serial}\n"
        f"Value: {denomination}\n"
        f"Issued: {date_str}\n\n"
        f"Redeem at the bank\nfor {denomination} {ds}.\n\n"
        f"DO NOT COPY\nCounterfeits will\nbe confiscated."
    )
    return page1, page2


# --- Players ---

def add_player(username):
    with get_connection() as c:
        c.execute("INSERT INTO players (username) VALUES (?)", (username,))


def get_players(search=None, status=None):
    with get_connection() as c:
        q, p = "SELECT * FROM players WHERE 1=1", []
        if status:
            q += " AND status=?"
            p.append(status)
        if search:
            q += " AND (username LIKE ? OR notes LIKE ?)"
            p.extend([f"%{search}%"] * 2)
        return [dict(r) for r in c.execute(q + " ORDER BY username", p).fetchall()]


def get_player(username):
    with get_connection() as c:
        r = c.execute("SELECT * FROM players WHERE username=?", (username,)).fetchone()
        return dict(r) if r else None


def get_player_book_value(username):
    with get_connection() as c:
        r = c.execute(
            "SELECT COALESCE(SUM(denomination),0) FROM notes WHERE issued_to=? AND status='circulating'",
            (username,)).fetchone()
        return r[0]


def update_player(username, **kw):
    with get_connection() as c:
        u = {k: v for k, v in kw.items()
             if k in {'diamond_balance', 'note_balance', 'status', 'notes'}}
        if u:
            sets = ','.join(f'{k}=?' for k in u)
            c.execute(f"UPDATE players SET {sets} WHERE username=?",
                      list(u.values()) + [username])


# --- Transactions ---

def add_transaction(type_, player, amount, player2=None, serial_numbers='', notes=''):
    with get_connection() as c:
        pl = get_player(player) if player else None
        bal = (pl['diamond_balance'] + pl['note_balance']) if pl else 0
        c.execute(
            "INSERT INTO transactions (type,player,player2,amount,serial_numbers,running_balance,notes) "
            "VALUES (?,?,?,?,?,?,?)",
            (type_, player, player2, amount, serial_numbers, bal, notes))


def get_transactions(player=None, type_=None, search=None, limit=500):
    with get_connection() as c:
        q, p = "SELECT * FROM transactions WHERE 1=1", []
        if player:
            q += " AND (player=? OR player2=?)"
            p.extend([player] * 2)
        if type_:
            q += " AND type=?"
            p.append(type_)
        if search:
            q += " AND (player LIKE ? OR player2 LIKE ? OR notes LIKE ? OR serial_numbers LIKE ?)"
            p.extend([f"%{search}%"] * 4)
        return [dict(r) for r in c.execute(
            q + " ORDER BY timestamp DESC LIMIT ?", p + [limit]).fetchall()]


# --- Loans ---

def create_loan(borrower, principal, rate, itype, cperiod, due, collateral='', notes=''):
    with get_connection() as c:
        c.execute(
            "INSERT INTO loans (borrower,principal,interest_rate,interest_type,"
            "compounding_period,due_date,remaining_balance,collateral,notes) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (borrower, principal, rate, itype, cperiod, due, principal, collateral, notes))
        lid = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        c.execute(
            "INSERT INTO transactions (type,player,amount,notes) "
            "VALUES ('loan_disbursement',?,?,?)",
            (borrower, principal, f"Loan #{lid}"))
        c.execute("UPDATE players SET note_balance=note_balance+? WHERE username=?",
                  (principal, borrower))
        return lid


def get_loans(borrower=None, status=None):
    with get_connection() as c:
        q, p = "SELECT * FROM loans WHERE 1=1", []
        if borrower:
            q += " AND borrower=?"
            p.append(borrower)
        if status:
            q += " AND status=?"
            p.append(status)
        return [dict(r) for r in c.execute(
            q + " ORDER BY issue_date DESC", p).fetchall()]


def get_loan(lid):
    with get_connection() as c:
        r = c.execute("SELECT * FROM loans WHERE id=?", (lid,)).fetchone()
        return dict(r) if r else None


def calculate_accrued_interest(lid):
    loan = get_loan(lid)
    if not loan or loan['status'] != 'active':
        return 0
    days = (datetime.now() - datetime.fromisoformat(loan['issue_date'])).days
    pd_map = {'daily': 1, 'weekly': 7, 'bi-weekly': 14}
    pd = pd_map.get(loan['compounding_period'], 7)
    periods = days / pd
    rate = loan['interest_rate'] / 100.0
    if loan['interest_type'] == 'simple':
        interest = loan['principal'] * rate * periods
    else:
        interest = loan['principal'] * ((1 + rate) ** periods - 1)
    with get_connection() as c:
        paid = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM loan_payments WHERE loan_id=?",
            (lid,)).fetchone()[0]
    return max(0, loan['principal'] + interest - paid)


def record_loan_payment(lid, amount, notes=''):
    with get_connection() as c:
        loan = c.execute("SELECT * FROM loans WHERE id=?", (lid,)).fetchone()
        if not loan:
            raise ValueError("Loan not found")
        c.execute("INSERT INTO loan_payments (loan_id,amount,notes) VALUES (?,?,?)",
                  (lid, amount, notes))
        nb = loan['remaining_balance'] - amount
        if nb <= 0:
            c.execute("UPDATE loans SET remaining_balance=0, status='paid_off' WHERE id=?",
                      (lid,))
        else:
            c.execute("UPDATE loans SET remaining_balance=? WHERE id=?", (nb, lid))
        c.execute(
            "INSERT INTO transactions (type,player,amount,notes) "
            "VALUES ('loan_repayment',?,?,?)",
            (loan['borrower'], amount, f"Loan #{lid}"))
        c.execute("UPDATE players SET note_balance=note_balance-? WHERE username=?",
                  (amount, loan['borrower']))


def get_loan_payments(lid):
    with get_connection() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM loan_payments WHERE loan_id=? ORDER BY timestamp DESC",
            (lid,)).fetchall()]


def update_loan(lid, **kw):
    with get_connection() as c:
        u = {k: v for k, v in kw.items()
             if k in {'interest_rate', 'interest_type', 'compounding_period',
                       'due_date', 'remaining_balance', 'status', 'collateral', 'notes'}}
        if u:
            sets = ','.join(f'{k}=?' for k in u)
            c.execute(f"UPDATE loans SET {sets} WHERE id=?",
                      list(u.values()) + [lid])


# --- Vault ---

def get_vault_diamonds():
    v = get_setting('vault_diamonds')
    return float(v) if v else 0


def update_vault(new_amount, reason=''):
    old = get_vault_diamonds()
    with get_connection() as c:
        c.execute(
            "INSERT INTO vault_log (previous_amount,new_amount,change_amount,reason) "
            "VALUES (?,?,?,?)",
            (old, new_amount, new_amount - old, reason))
        c.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('vault_diamonds',?)",
                  (str(new_amount),))


def get_vault_log(limit=100):
    with get_connection() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM vault_log ORDER BY timestamp DESC LIMIT ?",
            (limit,)).fetchall()]


def get_reserve_ratio():
    vault = get_vault_diamonds()
    circ = get_circulating_value()
    with get_connection() as c:
        dep = c.execute(
            "SELECT COALESCE(SUM(diamond_balance),0) FROM players").fetchone()[0]
    liab = circ + dep
    return (vault / liab * 100) if liab > 0 else 100.0


# --- Complex Operations ---

def deposit_diamonds(player, amount, notes=''):
    with get_connection() as c:
        c.execute("UPDATE players SET diamond_balance=diamond_balance+? WHERE username=?",
                  (amount, player))
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('deposit_diamonds',?,?,?,?)",
            (player, amount, p['diamond_balance'] + p['note_balance'], notes))


def withdraw_diamonds(player, amount, notes=''):
    with get_connection() as c:
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        if p['diamond_balance'] < amount:
            raise ValueError("Insufficient balance")
        c.execute("UPDATE players SET diamond_balance=diamond_balance-? WHERE username=?",
                  (amount, player))
        p2 = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('withdraw_diamonds',?,?,?,?)",
            (player, amount, p2['diamond_balance'] + p2['note_balance'], notes))


def add_digital_balance(player, amount, notes=''):
    with get_connection() as c:
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        if not p:
            raise ValueError(f"Player '{player}' not found")
        c.execute("UPDATE players SET note_balance=note_balance+? WHERE username=?",
                  (amount, player))
        p2 = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('deposit_diamonds',?,?,?,?)",
            (player, amount, p2['diamond_balance'] + p2['note_balance'],
             f"Digital credit: {notes}"))


def remove_digital_balance(player, amount, notes=''):
    with get_connection() as c:
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        if not p:
            raise ValueError(f"Player '{player}' not found")
        if p['note_balance'] < amount:
            raise ValueError(
                f"Insufficient digital balance ({p['note_balance']:,.0f} < {amount:,.0f})")
        c.execute("UPDATE players SET note_balance=note_balance-? WHERE username=?",
                  (amount, player))
        p2 = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('withdraw_diamonds',?,?,?,?)",
            (player, amount, p2['diamond_balance'] + p2['note_balance'],
             f"Digital debit: {notes}"))


def accrue_savings_interest(username):
    rate = float(get_setting('savings_interest_rate') or 0)
    if rate <= 0:
        return 0
    with get_connection() as c:
        p = c.execute("SELECT * FROM players WHERE username=?", (username,)).fetchone()
        if not p or p['status'] != 'active':
            return 0
        last_calc_str = p['last_interest_calc']
        if p['note_balance'] <= 0:
            c.execute("UPDATE players SET last_interest_calc=? WHERE username=?",
                      (datetime.now().isoformat(), username))
            return 0
        last_calc = datetime.fromisoformat(last_calc_str) if last_calc_str else datetime.now()
        now = datetime.now()
        days_elapsed = (now - last_calc).total_seconds() / 86400
        if days_elapsed < 0.01:
            return 0
        daily_rate = (rate / 100) / 365
        interest = p['note_balance'] * ((1 + daily_rate) ** days_elapsed - 1)
        interest = round(interest, 2)
        if interest < 0.01:
            return 0
        new_bal = p['note_balance'] + interest
        c.execute("UPDATE players SET note_balance=?, last_interest_calc=? WHERE username=?",
                  (new_bal, now.isoformat(), username))
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('interest_payment',?,?,?,?)",
            (username, interest, new_bal + p['diamond_balance'],
             f"Savings interest: {rate}% annual on {p['note_balance']:,.2f} for {days_elapsed:.1f} days"))
        return interest


def accrue_all_interest():
    total = 0
    for p in get_players(status='active'):
        total += accrue_savings_interest(p['username'])
    days = int(get_setting('savings_payout_days') or 7)
    next_payout = (datetime.now() + timedelta(days=days)).isoformat()
    set_setting('next_interest_payout', next_payout)
    set_setting('last_interest_payout', datetime.now().isoformat())
    return total


def get_next_payout_info():
    next_str = get_setting('next_interest_payout')
    days = int(get_setting('savings_payout_days') or 7)
    if not next_str:
        next_dt = datetime.now() + timedelta(days=days)
        set_setting('next_interest_payout', next_dt.isoformat())
        next_str = next_dt.isoformat()
    next_dt = datetime.fromisoformat(next_str)
    now = datetime.now()
    remaining = next_dt - now
    if remaining.total_seconds() <= 0:
        return next_dt, "NOW - due!", True
    total_secs = int(remaining.total_seconds())
    d = total_secs // 86400
    h = (total_secs % 86400) // 3600
    m = (total_secs % 3600) // 60
    parts = []
    if d > 0:
        parts.append(f"{d}d")
    if h > 0:
        parts.append(f"{h}h")
    if m > 0:
        parts.append(f"{m}m")
    time_str = " ".join(parts) if parts else "<1m"
    return next_dt, time_str, False


def get_pending_interest(username):
    rate = float(get_setting('savings_interest_rate') or 0)
    if rate <= 0:
        return 0
    with get_connection() as c:
        p = c.execute("SELECT * FROM players WHERE username=?", (username,)).fetchone()
        if not p or p['note_balance'] <= 0:
            return 0
        last_calc_str = p['last_interest_calc']
        last_calc = datetime.fromisoformat(last_calc_str) if last_calc_str else datetime.now()
        days_elapsed = (datetime.now() - last_calc).total_seconds() / 86400
        daily_rate = (rate / 100) / 365
        interest = p['note_balance'] * ((1 + daily_rate) ** days_elapsed - 1)
        return round(interest, 2)


def issue_notes_to_player(player, serials, notes=''):
    with get_connection() as c:
        tv = 0
        for s in serials:
            n = c.execute("SELECT * FROM notes WHERE serial_number=?", (s,)).fetchone()
            if not n:
                raise ValueError(f"Note {s} not found")
            if n['status'] != 'held_in_reserve':
                raise ValueError(f"Note {s} unavailable ({n['status']})")
            c.execute("UPDATE notes SET status='circulating', issued_to=? WHERE serial_number=?",
                      (player, s))
            tv += n['denomination']
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,serial_numbers,running_balance,notes) "
            "VALUES ('issue_notes',?,?,?,?,?)",
            (player, tv, ','.join(serials), p['diamond_balance'] + p['note_balance'], notes))


def redeem_notes_from_player(player, serials, notes=''):
    with get_connection() as c:
        tv = 0
        for s in serials:
            n = c.execute("SELECT * FROM notes WHERE serial_number=?", (s,)).fetchone()
            if not n:
                raise ValueError(f"Note {s} not found")
            c.execute(
                "UPDATE notes SET status='redeemed', redeemed_by=?, redemption_date=? "
                "WHERE serial_number=?",
                (player, datetime.now().isoformat(), s))
            tv += n['denomination']
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,serial_numbers,running_balance,notes) "
            "VALUES ('redeem_notes',?,?,?,?,?)",
            (player, tv, ','.join(serials), p['diamond_balance'] + p['note_balance'], notes))


def record_transfer(frm, to, amount, notes=''):
    with get_connection() as c:
        p_from = c.execute("SELECT * FROM players WHERE username=?", (frm,)).fetchone()
        if not p_from:
            raise ValueError(f"Player '{frm}' not found")
        if p_from['note_balance'] < amount:
            raise ValueError(
                f"{frm} has insufficient note balance "
                f"({p_from['note_balance']:,.0f} < {amount:,.0f})")
        c.execute("UPDATE players SET note_balance=note_balance-? WHERE username=?",
                  (amount, frm))
        c.execute("UPDATE players SET note_balance=note_balance+? WHERE username=?",
                  (amount, to))
        p1 = c.execute("SELECT * FROM players WHERE username=?", (frm,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,player2,amount,running_balance,notes) "
            "VALUES ('transfer',?,?,?,?,?)",
            (frm, to, amount, p1['diamond_balance'] + p1['note_balance'], notes))


def record_fee(player, amount, notes=''):
    with get_connection() as c:
        c.execute("UPDATE players SET note_balance=note_balance-? WHERE username=?",
                  (amount, player))
        p = c.execute("SELECT * FROM players WHERE username=?", (player,)).fetchone()
        c.execute(
            "INSERT INTO transactions (type,player,amount,running_balance,notes) "
            "VALUES ('fee',?,?,?,?)",
            (player, amount, p['diamond_balance'] + p['note_balance'], notes))


# --- Discord Link Management ---

def create_link_request(discord_id, requested_username):
    code = secrets.token_hex(3).upper()
    with get_connection() as c:
        existing = c.execute("SELECT * FROM discord_links WHERE discord_id=?",
                             (discord_id,)).fetchone()
        if existing and existing['status'] == 'verified':
            raise ValueError(
                f"Already linked to {existing['minecraft_username']}. Ask admin to unlink first.")
        taken = c.execute(
            "SELECT * FROM discord_links WHERE minecraft_username=? AND status='verified'",
            (requested_username,)).fetchone()
        if taken:
            raise ValueError(
                f"Minecraft account '{requested_username}' is already linked.")
        pending_other = c.execute(
            "SELECT * FROM discord_links WHERE requested_username=? AND status='pending' AND discord_id!=?",
            (requested_username, str(discord_id))).fetchone()
        if pending_other:
            raise ValueError(
                f"Minecraft account '{requested_username}' already has a pending link request.")
        c.execute("DELETE FROM discord_links WHERE discord_id=? AND status!='verified'",
                  (discord_id,))
        c.execute(
            "INSERT INTO discord_links (discord_id, requested_username, verification_code, status) "
            "VALUES (?, ?, ?, 'pending')",
            (discord_id, requested_username, code))
        c.execute(
            "INSERT INTO pending_requests (type, discord_id, player, details, status) "
            "VALUES ('link_account', ?, ?, ?, 'pending')",
            (discord_id, requested_username, json.dumps({"code": code})))
    return code


def approve_link(discord_id):
    with get_connection() as c:
        link = c.execute(
            "SELECT * FROM discord_links WHERE discord_id=? AND status='pending'",
            (discord_id,)).fetchone()
        if not link:
            raise ValueError("No pending link for this Discord ID")
        username = link['requested_username']
        existing = c.execute("SELECT * FROM players WHERE username=?",
                             (username,)).fetchone()
        if not existing:
            c.execute("INSERT INTO players (username) VALUES (?)", (username,))
        c.execute(
            "UPDATE discord_links SET status='verified', minecraft_username=?, verified_at=? "
            "WHERE discord_id=?",
            (username, datetime.now().isoformat(), discord_id))
        c.execute(
            "UPDATE pending_requests SET status='approved', resolved_at=? "
            "WHERE discord_id=? AND type='link_account' AND status='pending'",
            (datetime.now().isoformat(), discord_id))


def deny_link(discord_id, reason=''):
    with get_connection() as c:
        c.execute(
            "UPDATE discord_links SET status='rejected' WHERE discord_id=? AND status='pending'",
            (discord_id,))
        c.execute(
            "UPDATE pending_requests SET status='denied', admin_notes=?, resolved_at=? "
            "WHERE discord_id=? AND type='link_account' AND status='pending'",
            (reason, datetime.now().isoformat(), discord_id))


def revoke_link(discord_id):
    with get_connection() as c:
        c.execute(
            "UPDATE discord_links SET status='revoked', minecraft_username=NULL "
            "WHERE discord_id=?",
            (discord_id,))


def get_link(discord_id=None, username=None):
    with get_connection() as c:
        if discord_id:
            r = c.execute("SELECT * FROM discord_links WHERE discord_id=?",
                          (discord_id,)).fetchone()
        elif username:
            r = c.execute(
                "SELECT * FROM discord_links WHERE minecraft_username=? AND status='verified'",
                (username,)).fetchone()
        else:
            return None
        return dict(r) if r else None


def get_all_links(status=None):
    with get_connection() as c:
        q, p = "SELECT * FROM discord_links WHERE 1=1", []
        if status:
            q += " AND status=?"
            p.append(status)
        return [dict(r) for r in c.execute(
            q + " ORDER BY created_at DESC", p).fetchall()]


def get_username_for_discord(discord_id):
    link = get_link(discord_id=discord_id)
    if link and link['status'] == 'verified':
        return link['minecraft_username']
    return None


# --- Pending Requests ---

def create_request(type_, discord_id, player, amount=0, details=None):
    with get_connection() as c:
        c.execute(
            "INSERT INTO pending_requests (type, discord_id, player, amount, details) "
            "VALUES (?, ?, ?, ?, ?)",
            (type_, discord_id, player, amount, json.dumps(details or {})))
        return c.execute("SELECT last_insert_rowid()").fetchone()[0]


def get_pending_requests(status='pending', type_=None, limit=100):
    with get_connection() as c:
        q, p = "SELECT * FROM pending_requests WHERE 1=1", []
        if status:
            q += " AND status=?"
            p.append(status)
        if type_:
            q += " AND type=?"
            p.append(type_)
        q += " ORDER BY created_at DESC LIMIT ?"
        p.append(limit)
        return [dict(r) for r in c.execute(q, p).fetchall()]


def get_request(rid):
    with get_connection() as c:
        r = c.execute("SELECT * FROM pending_requests WHERE id=?", (rid,)).fetchone()
        return dict(r) if r else None


def resolve_request(rid, new_status, admin_notes=''):
    with get_connection() as c:
        req = c.execute("SELECT * FROM pending_requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise ValueError("Request not found")
        if req['status'] != 'pending':
            raise ValueError("Request already resolved")
        c.execute(
            "UPDATE pending_requests SET status=?, admin_notes=?, resolved_at=? WHERE id=?",
            (new_status, admin_notes, datetime.now().isoformat(), rid))
        return dict(req)


def approve_request(rid, admin_notes=''):
    req = get_request(rid)
    if not req:
        raise ValueError("Request not found")
    if req['status'] != 'pending':
        raise ValueError("Already resolved")
    details = json.loads(req['details']) if req['details'] else {}

    if req['type'] == 'link_account':
        approve_link(req['discord_id'])
        return resolve_request(rid, 'approved', admin_notes)
    elif req['type'] == 'transfer':
        to_player = details.get('to_player', '')
        if not to_player:
            raise ValueError("Missing target player")
        record_transfer(req['player'], to_player, req['amount'],
                        f"Discord transfer: {details.get('reason', '')}")
        return resolve_request(rid, 'approved', admin_notes)
    elif req['type'] == 'loan_request':
        rate = float(get_setting('default_interest_rate') or 5.0)
        cperiod = get_setting('default_compounding') or 'weekly'
        due_days = int(details.get('term_days', 30))
        due = (datetime.now() + timedelta(days=due_days)).strftime("%Y-%m-%d")
        collateral = details.get('collateral', '')
        create_loan(req['player'], req['amount'], rate, 'simple', cperiod, due,
                     collateral, f"Discord loan request: {details.get('reason', '')}")
        return resolve_request(rid, 'approved', admin_notes)
    elif req['type'] == 'loan_payment':
        loan_id = details.get('loan_id')
        if not loan_id:
            raise ValueError("Missing loan ID")
        record_loan_payment(int(loan_id), req['amount'], "Discord payment")
        return resolve_request(rid, 'approved', admin_notes)
    elif req['type'] == 'deposit':
        add_digital_balance(req['player'], req['amount'],
                            f"Book deposit: {details.get('details', '')}")
        return resolve_request(rid, 'approved', admin_notes)
    elif req['type'] == 'withdrawal':
        remove_digital_balance(req['player'], req['amount'],
                               f"Book withdrawal: {details.get('denominations', '')}")
        return resolve_request(rid, 'approved', admin_notes)
    else:
        return resolve_request(rid, 'approved', admin_notes)


def deny_request(rid, reason=''):
    req = get_request(rid)
    if not req:
        raise ValueError("Request not found")
    if req['type'] == 'link_account':
        deny_link(req['discord_id'], reason)
    return resolve_request(rid, 'denied', reason)


# --- Dashboard Stats ---

def get_dashboard_stats():
    with get_connection() as c:
        s = {}
        s['vault'] = get_vault_diamonds()
        s['circ'] = get_circulating_value()
        s['ratio'] = get_reserve_ratio()
        s['players'] = c.execute(
            "SELECT COUNT(*) FROM players WHERE status='active'").fetchone()[0]
        s['loans_count'] = c.execute(
            "SELECT COUNT(*) FROM loans WHERE status='active'").fetchone()[0]
        s['loans_value'] = c.execute(
            "SELECT COALESCE(SUM(remaining_balance),0) FROM loans WHERE status='active'"
        ).fetchone()[0]
        s['deposits'] = c.execute(
            "SELECT COALESCE(SUM(diamond_balance),0) FROM players").fetchone()[0]
        s['note_bals'] = c.execute(
            "SELECT COALESCE(SUM(note_balance),0) FROM players").fetchone()[0]
        s['overdue'] = c.execute(
            "SELECT COUNT(*) FROM loans WHERE status='active' AND due_date<?",
            (datetime.now().isoformat(),)).fetchone()[0]
        s['recent'] = [dict(r) for r in c.execute(
            "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 15").fetchall()]
        s['pending_requests'] = c.execute(
            "SELECT COUNT(*) FROM pending_requests WHERE status='pending'").fetchone()[0]
        for d, l in [(7, '7d'), (30, '30d')]:
            co = (datetime.now() - timedelta(days=d)).isoformat()
            s[f'int_{l}'] = c.execute(
                "SELECT COALESCE(SUM(amount),0) FROM transactions "
                "WHERE type='interest_payment' AND timestamp>=?",
                (co,)).fetchone()[0]
        s['int_all'] = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM transactions "
            "WHERE type='interest_payment'").fetchone()[0]
        s['fee_all'] = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM transactions "
            "WHERE type='fee'").fetchone()[0]
        s['circ_denom'] = {}
        for r in c.execute(
            "SELECT denomination, COUNT(*) as cnt FROM notes "
            "WHERE status='circulating' GROUP BY denomination"
        ).fetchall():
            s['circ_denom'][r['denomination']] = r['cnt']
        return s


# --- Backup & Export ---

def backup_database(dest_dir=None):
    src = get_db_path()
    if not dest_dir:
        dest_dir = os.path.dirname(src)
    dest = os.path.join(
        dest_dir,
        f"minecraft_bank_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
    shutil.copy2(src, dest)
    return dest


def export_transactions_csv(filepath, **filt):
    txns = get_transactions(**filt)
    if not txns:
        return 0
    with open(filepath, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=txns[0].keys())
        w.writeheader()
        w.writerows(txns)
    return len(txns)

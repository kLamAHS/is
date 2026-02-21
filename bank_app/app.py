"""
Minecraft Diamond Bank — Web Admin Dashboard
Flask web application replacing the tkinter desktop app.
"""

import os
import io
import csv
import json
import secrets
from datetime import datetime, timedelta

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, jsonify, Response, session
)

from database import (
    init_database, get_setting, set_setting, get_denominations,
    generate_serial_numbers,
    get_notes, get_note, update_note_status, set_book_signed, get_note_stats,
    get_circulating_value, book_text,
    add_player, get_players, get_player, get_player_book_value, update_player,
    add_transaction, get_transactions,
    create_loan, get_loans, get_loan, calculate_accrued_interest,
    record_loan_payment, get_loan_payments, update_loan,
    get_vault_diamonds, update_vault, get_vault_log, get_reserve_ratio,
    deposit_diamonds, withdraw_diamonds, add_digital_balance,
    remove_digital_balance, accrue_all_interest, get_next_payout_info,
    get_pending_interest, issue_notes_to_player, redeem_notes_from_player,
    record_transfer, record_fee,
    get_link, get_all_links, revoke_link,
    get_pending_requests, get_request, approve_request, deny_request,
    get_dashboard_stats, backup_database, get_connection,
)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))


# --- Page Routes ---

@app.route('/')
def dashboard():
    stats = get_dashboard_stats()
    yw = float(get_setting('reserve_warning_yellow') or 80)
    rd = float(get_setting('reserve_warning_red') or 50)
    return render_template('dashboard.html', stats=stats, yw=yw, rd=rd)


@app.route('/players')
def players_page():
    search = request.args.get('search', '').strip() or None
    status = request.args.get('status', '')
    status = None if status in ('', 'All') else status
    players = get_players(search=search, status=status)
    for p in players:
        p['book_value'] = get_player_book_value(p['username'])
    rate = float(get_setting('savings_interest_rate') or 0)
    payout_info = None
    if rate > 0:
        next_dt, time_str, is_due = get_next_payout_info()
        payout_info = {
            'rate': rate,
            'time_str': time_str,
            'is_due': is_due,
            'payout_days': get_setting('savings_payout_days') or '7',
        }
    return render_template('players.html', players=players, search=search or '',
                           status=status or 'All', rate=rate, payout_info=payout_info)


@app.route('/notes')
def notes_page():
    search = request.args.get('search', '').strip() or None
    status = request.args.get('status', '')
    status = None if status in ('', 'All') else status
    denom = request.args.get('denomination', '')
    denom = int(denom) if denom and denom != 'All' else None
    signed_filter = request.args.get('signed', 'All')
    signed = None
    if signed_filter == 'Signed':
        signed = True
    elif signed_filter == 'Unsigned':
        signed = False
    notes = get_notes(status=status, denomination=denom, search=search, signed=signed)
    stats = get_note_stats()
    tot = sum(s['cnt'] for s in stats)
    circ = sum(s['cnt'] for s in stats if s['status'] == 'circulating')
    cv = sum(s['denomination'] * s['cnt'] for s in stats if s['status'] == 'circulating')
    res = sum(s['cnt'] for s in stats if s['status'] == 'held_in_reserve')
    with get_connection() as c:
        unsigned = c.execute(
            "SELECT COUNT(*) FROM notes WHERE book_signed=0 "
            "AND status IN ('held_in_reserve','circulating')"
        ).fetchone()[0]
    denoms = get_denominations()
    active_players = [p['username'] for p in get_players(status='active')]
    return render_template('notes.html', notes=notes, denoms=denoms,
                           search=search or '', filter_status=status or 'All',
                           filter_denom=str(denom) if denom else 'All',
                           filter_signed=signed_filter,
                           tot=tot, circ=circ, cv=cv, res=res, unsigned=unsigned,
                           active_players=active_players)


@app.route('/transactions')
def transactions_page():
    player = request.args.get('player', '').strip() or None
    type_ = request.args.get('type', '')
    type_ = None if type_ in ('', 'All') else type_
    search = request.args.get('search', '').strip() or None
    txns = get_transactions(player=player, type_=type_, search=search)
    total = sum(t['amount'] for t in txns)
    active_players = [p['username'] for p in get_players(status='active')]
    return render_template('transactions.html', txns=txns, total=total,
                           filter_player=player or '', filter_type=type_ or 'All',
                           search=search or '', active_players=active_players)


@app.route('/loans')
def loans_page():
    status = request.args.get('status', '')
    status = None if status in ('', 'All') else status
    loans = get_loans(status=status)
    for loan in loans:
        loan['accrued'] = calculate_accrued_interest(loan['id'])
    tot = sum(l['remaining_balance'] for l in loans if l['status'] == 'active')
    ac = sum(1 for l in loans if l['status'] == 'active')
    active_players = [p['username'] for p in get_players(status='active')]
    return render_template('loans.html', loans=loans, total_outstanding=tot,
                           active_count=ac, filter_status=status or 'All',
                           active_players=active_players,
                           default_rate=get_setting('default_interest_rate') or '5.0',
                           default_compounding=get_setting('default_compounding') or 'weekly')


@app.route('/vault')
def vault_page():
    vault = get_vault_diamonds()
    ratio = get_reserve_ratio()
    yw = float(get_setting('reserve_warning_yellow') or 80)
    rd = float(get_setting('reserve_warning_red') or 50)
    circ = get_circulating_value()
    with get_connection() as c:
        dep = c.execute(
            "SELECT COALESCE(SUM(diamond_balance),0) FROM players").fetchone()[0]
        lns = c.execute(
            "SELECT COALESCE(SUM(remaining_balance),0) FROM loans WHERE status='active'"
        ).fetchone()[0]
    log = get_vault_log(50)
    return render_template('vault.html', vault=vault, ratio=ratio, yw=yw, rd=rd,
                           circ=circ, dep=dep, loans_outstanding=lns, log=log)


@app.route('/requests')
def requests_page():
    status = request.args.get('status', 'pending')
    status = None if status == 'All' else status
    reqs = get_pending_requests(status=status)
    return render_template('requests.html', reqs=reqs,
                           filter_status=status or 'All')


@app.route('/reports')
def reports_page():
    return render_template('reports.html')


@app.route('/settings')
def settings_page():
    keys = [
        'currency_name', 'denominations', 'serial_prefix',
        'default_interest_rate', 'default_compounding',
        'reserve_warning_yellow', 'reserve_warning_red',
        'redemption_fee_pct', 'redemption_fee_flat',
        'savings_interest_rate', 'savings_payout_days',
        'discord_bot_token', 'discord_admin_channel', 'discord_admin_user_id',
        'max_loan_amount', 'max_transfer_amount',
    ]
    settings = {k: get_setting(k) or '' for k in keys}
    from database import get_db_path
    return render_template('settings.html', settings=settings, db_path=get_db_path())


# --- API Endpoints ---

@app.route('/api/dashboard')
def api_dashboard():
    return jsonify(get_dashboard_stats())


# Players API

@app.route('/api/players', methods=['POST'])
def api_add_player():
    data = request.json or request.form
    username = data.get('username', '').strip()
    if not username:
        return jsonify({'error': 'Username required'}), 400
    try:
        add_player(username)
        return jsonify({'ok': True, 'username': username})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/players/<username>')
def api_player_detail(username):
    p = get_player(username)
    if not p:
        return jsonify({'error': 'Player not found'}), 404
    p['book_value'] = get_player_book_value(username)
    p['pending_interest'] = get_pending_interest(username)
    p['rate'] = float(get_setting('savings_interest_rate') or 0)
    link = get_link(username=username)
    p['discord'] = link['discord_id'] if link else None
    p['recent_txns'] = get_transactions(player=username, limit=10)
    p['active_loans'] = get_loans(borrower=username, status='active')
    return jsonify(p)


@app.route('/api/players/<username>/digital', methods=['POST'])
def api_player_digital(username):
    data = request.json or request.form
    action = data.get('action', 'add')
    amount = float(data.get('amount', 0))
    notes = data.get('notes', '')
    if amount <= 0:
        return jsonify({'error': 'Positive amount required'}), 400
    try:
        if action == 'add':
            add_digital_balance(username, amount, notes)
        else:
            remove_digital_balance(username, amount, notes)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/players/<username>/freeze', methods=['POST'])
def api_player_freeze(username):
    p = get_player(username)
    if not p:
        return jsonify({'error': 'Player not found'}), 404
    new_status = 'frozen' if p['status'] == 'active' else 'active'
    update_player(username, status=new_status)
    return jsonify({'ok': True, 'new_status': new_status})


@app.route('/api/interest/payout', methods=['POST'])
def api_interest_payout():
    rate = float(get_setting('savings_interest_rate') or 0)
    if rate <= 0:
        return jsonify({'error': 'Savings interest rate is 0%'}), 400
    total = accrue_all_interest()
    return jsonify({'ok': True, 'total': total, 'rate': rate})


# Notes API

@app.route('/api/notes/generate', methods=['POST'])
def api_generate_notes():
    data = request.json or request.form
    denom = int(data.get('denomination', 1))
    count = int(data.get('count', 1))
    if count < 1 or count > 1000:
        return jsonify({'error': 'Count must be 1-1000'}), 400
    try:
        serials = generate_serial_numbers(denom, count)
        return jsonify({'ok': True, 'serials': serials, 'count': len(serials)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/notes/<serial>/signed', methods=['POST'])
def api_toggle_signed(serial):
    note = get_note(serial)
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    new_val = not note.get('book_signed', 0)
    set_book_signed(serial, new_val)
    return jsonify({'ok': True, 'signed': new_val})


@app.route('/api/notes/bulk-signed', methods=['POST'])
def api_bulk_signed():
    data = request.json
    serials = data.get('serials', [])
    signed = data.get('signed', True)
    count = 0
    for s in serials:
        try:
            set_book_signed(s, signed)
            count += 1
        except Exception:
            pass
    return jsonify({'ok': True, 'count': count})


@app.route('/api/notes/<serial>/status', methods=['POST'])
def api_update_note_status(serial):
    data = request.json or request.form
    new_status = data.get('status')
    player = data.get('player', '').strip() or None
    try:
        update_note_status(serial, new_status, player)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/notes/issue', methods=['POST'])
def api_issue_notes():
    data = request.json
    player = data.get('player', '').strip()
    serials = data.get('serials', [])
    notes = data.get('notes', '')
    if not player:
        return jsonify({'error': 'Player required'}), 400
    if not serials:
        return jsonify({'error': 'No notes selected'}), 400
    if not get_player(player):
        return jsonify({'error': f"Player '{player}' not found"}), 404
    try:
        issue_notes_to_player(player, serials, notes)
        total = sum(get_note(s)['denomination'] for s in serials if get_note(s))
        return jsonify({'ok': True, 'count': len(serials), 'total': total})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/notes/redeem', methods=['POST'])
def api_redeem_notes():
    data = request.json
    player = data.get('player', '').strip()
    serials = data.get('serials', [])
    notes = data.get('notes', '')
    if not player:
        return jsonify({'error': 'Player required'}), 400
    if not serials:
        return jsonify({'error': 'No notes selected'}), 400
    if not get_player(player):
        return jsonify({'error': f"Player '{player}' not found"}), 404
    try:
        redeem_notes_from_player(player, serials, notes)
        return jsonify({'ok': True, 'count': len(serials)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/notes/<serial>/preview')
def api_note_preview(serial):
    note = get_note(serial)
    if not note:
        return jsonify({'error': 'Note not found'}), 404
    p1, p2 = book_text(serial, note['denomination'], note['date_issued'])
    return jsonify({'page1': p1, 'page2': p2, 'serial': serial,
                    'denomination': note['denomination'],
                    'signed': bool(note.get('book_signed', 0))})


# Transactions API

@app.route('/api/transactions', methods=['POST'])
def api_record_transaction():
    data = request.json or request.form
    type_ = data.get('type', '')
    player = data.get('player', '').strip()
    amount = float(data.get('amount', 0))
    player2 = data.get('player2', '').strip() or None
    serials = data.get('serials', '').strip()
    notes = data.get('notes', '').strip()

    if not player:
        return jsonify({'error': 'Player required'}), 400
    if amount <= 0:
        return jsonify({'error': 'Positive amount required'}), 400

    try:
        if type_ == 'deposit_diamonds':
            deposit_diamonds(player, amount, notes)
        elif type_ == 'withdraw_diamonds':
            withdraw_diamonds(player, amount, notes)
        elif type_ == 'transfer' and player2:
            record_transfer(player, player2, amount, notes)
        elif type_ == 'fee':
            record_fee(player, amount, notes)
        elif type_ == 'issue_notes' and serials:
            issue_notes_to_player(player,
                                  [x.strip() for x in serials.split(',') if x.strip()],
                                  notes)
        elif type_ == 'redeem_notes' and serials:
            redeem_notes_from_player(player,
                                     [x.strip() for x in serials.split(',') if x.strip()],
                                     notes)
        else:
            add_transaction(type_, player, amount, player2, serials, notes)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# Loans API

@app.route('/api/loans', methods=['POST'])
def api_create_loan():
    data = request.json or request.form
    borrower = data.get('borrower', '').strip()
    principal = float(data.get('principal', 0))
    rate = float(data.get('rate', 5.0))
    itype = data.get('interest_type', 'simple')
    cperiod = data.get('compounding_period', 'weekly')
    due = data.get('due_date', '')
    collateral = data.get('collateral', '')
    notes = data.get('notes', '')

    if not borrower or not get_player(borrower):
        return jsonify({'error': f"Player '{borrower}' not found"}), 400
    if principal <= 0:
        return jsonify({'error': 'Positive principal required'}), 400
    try:
        datetime.strptime(due, "%Y-%m-%d")
    except ValueError:
        return jsonify({'error': 'Invalid due date (YYYY-MM-DD)'}), 400

    try:
        lid = create_loan(borrower, principal, rate, itype, cperiod, due,
                          collateral, notes)
        return jsonify({'ok': True, 'loan_id': lid})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/loans/<int:lid>')
def api_loan_detail(lid):
    loan = get_loan(lid)
    if not loan:
        return jsonify({'error': 'Loan not found'}), 404
    loan['accrued'] = calculate_accrued_interest(lid)
    loan['payments'] = get_loan_payments(lid)
    if loan['status'] == 'active' and loan['due_date']:
        due = datetime.fromisoformat(loan['due_date'])
        if due < datetime.now():
            loan['overdue_days'] = (datetime.now() - due).days
    return jsonify(loan)


@app.route('/api/loans/<int:lid>/payment', methods=['POST'])
def api_loan_payment(lid):
    data = request.json or request.form
    amount = float(data.get('amount', 0))
    notes = data.get('notes', '')
    if amount <= 0:
        return jsonify({'error': 'Positive amount required'}), 400
    try:
        record_loan_payment(lid, amount, notes)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/loans/<int:lid>/default', methods=['POST'])
def api_loan_default(lid):
    try:
        update_loan(lid, status='defaulted')
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/loans/<int:lid>/restructure', methods=['POST'])
def api_loan_restructure(lid):
    data = request.json or request.form
    loan = get_loan(lid)
    if not loan:
        return jsonify({'error': 'Loan not found'}), 404
    try:
        new_rate = float(data.get('rate', loan['interest_rate']))
        new_due = data.get('due_date', loan['due_date'])
        new_bal = float(data.get('remaining_balance', loan['remaining_balance']))
        datetime.strptime(new_due, "%Y-%m-%d")
        update_loan(lid, interest_rate=new_rate, due_date=new_due,
                    remaining_balance=new_bal, status='active',
                    notes=f"{loan['notes'] or ''}\nRestructured {datetime.now():%Y-%m-%d}")
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# Vault API

@app.route('/api/vault', methods=['POST'])
def api_vault_update():
    data = request.json or request.form
    action = data.get('action', 'set')
    amount = float(data.get('amount', 0))
    reason = data.get('reason', '').strip()
    if not reason:
        return jsonify({'error': 'Reason required'}), 400

    current = get_vault_diamonds()
    if action == 'add':
        if amount <= 0:
            return jsonify({'error': 'Positive amount required'}), 400
        new_total = current + amount
        update_vault(new_total, f"+{amount:.0f}: {reason}")
    elif action == 'withdraw':
        if amount <= 0:
            return jsonify({'error': 'Positive amount required'}), 400
        if amount > current:
            return jsonify({'error': f"Can't withdraw {amount:.0f} - vault only has {current:.0f}"}), 400
        new_total = current - amount
        update_vault(new_total, f"-{amount:.0f}: {reason}")
    else:
        if amount < 0:
            return jsonify({'error': 'Cannot be negative'}), 400
        update_vault(amount, f"Set to {amount:.0f}: {reason}")

    return jsonify({'ok': True, 'new_total': get_vault_diamonds(),
                    'ratio': get_reserve_ratio()})


@app.route('/api/vault/calculate')
def api_vault_calculate():
    issue_amount = float(request.args.get('amount', 0))
    v = get_vault_diamonds()
    circ = get_circulating_value()
    with get_connection() as c:
        dep = c.execute(
            "SELECT COALESCE(SUM(diamond_balance),0) FROM players").fetchone()[0]
    cl = circ + dep
    nl = cl + issue_amount
    cr = (v / cl * 100) if cl > 0 else 100
    nr = (v / nl * 100) if nl > 0 else 100
    yw = float(get_setting('reserve_warning_yellow') or 80)
    rd = float(get_setting('reserve_warning_red') or 50)
    if nr < rd:
        verdict = "CRITICAL"
    elif nr < yw:
        verdict = "WARNING"
    else:
        verdict = "Safe to issue"
    mx = max(0, (v / (yw / 100)) - cl) if yw > 0 else float('inf')
    return jsonify({
        'current_ratio': cr, 'new_ratio': nr,
        'verdict': verdict, 'max_at_yellow': mx
    })


# Requests API

@app.route('/api/requests/<int:rid>/approve', methods=['POST'])
def api_approve_request(rid):
    data = request.json or request.form
    admin_notes = data.get('admin_notes', '')
    try:
        approve_request(rid, admin_notes)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/requests/<int:rid>/deny', methods=['POST'])
def api_deny_request(rid):
    data = request.json or request.form
    reason = data.get('reason', '')
    try:
        deny_request(rid, reason)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/requests/<int:rid>')
def api_request_detail(rid):
    req = get_request(rid)
    if not req:
        return jsonify({'error': 'Request not found'}), 404
    details = json.loads(req['details']) if req['details'] else {}
    req['parsed_details'] = details
    link = get_link(discord_id=req['discord_id'])
    req['link_status'] = (f"Linked to: {link['minecraft_username']}"
                          if link and link['status'] == 'verified'
                          else "NOT LINKED")
    if req['type'] == 'transfer' and req['player']:
        p = get_player(req['player'])
        if p:
            req['sender_balance'] = p['note_balance']
    if req['type'] == 'loan_request' and req['player']:
        existing = get_loans(borrower=req['player'], status='active')
        req['existing_loans'] = len(existing)
    if req['type'] == 'loan_payment':
        lid = details.get('loan_id')
        if lid:
            loan = get_loan(int(lid))
            if loan:
                req['loan_remaining'] = loan['remaining_balance']
                req['loan_owed'] = calculate_accrued_interest(int(lid))
    return jsonify(req)


@app.route('/api/links/revoke', methods=['POST'])
def api_revoke_link():
    data = request.json or request.form
    discord_id = data.get('discord_id', '')
    if not discord_id:
        return jsonify({'error': 'Discord ID required'}), 400
    revoke_link(discord_id)
    return jsonify({'ok': True})


@app.route('/api/links')
def api_links():
    links = get_all_links()
    return jsonify(links)


# Settings API

@app.route('/api/settings', methods=['POST'])
def api_save_settings():
    data = request.json or request.form
    try:
        for k, v in data.items():
            v = str(v).strip()
            if k == 'denominations':
                pts = [int(x.strip()) for x in v.split(',') if x.strip()]
                if not pts:
                    return jsonify({'error': 'Need at least one denomination'}), 400
                v = ','.join(str(p) for p in sorted(pts))
            elif k in ('default_interest_rate', 'reserve_warning_yellow',
                       'reserve_warning_red', 'redemption_fee_pct',
                       'redemption_fee_flat', 'max_loan_amount',
                       'max_transfer_amount', 'savings_interest_rate',
                       'savings_payout_days'):
                if v:
                    float(v)
            set_setting(k, v)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/backup', methods=['POST'])
def api_backup():
    try:
        path = backup_database()
        return jsonify({'ok': True, 'path': path})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# Reports / Export

@app.route('/api/export/<report_type>')
def api_export(report_type):
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == 'transactions':
        txns = get_transactions(limit=10000)
        writer.writerow(['ID', 'Time', 'Type', 'Player', 'Player2', 'Amount',
                         'Balance', 'Serials', 'Notes'])
        for t in txns:
            writer.writerow([t['id'], t['timestamp'], t['type'], t['player'],
                             t['player2'] or '', t['amount'], t['running_balance'],
                             t['serial_numbers'] or '', t['notes'] or ''])

    elif report_type == 'player_statement':
        username = request.args.get('player', '')
        if not username or not get_player(username):
            return jsonify({'error': 'Player not found'}), 404
        txns = get_transactions(player=username, limit=10000)
        writer.writerow(['ID', 'Time', 'Type', 'Amount', 'Balance', 'Notes'])
        for t in txns:
            writer.writerow([t['id'], t['timestamp'], t['type'], t['amount'],
                             t['running_balance'], t['notes'] or ''])

    elif report_type == 'loans':
        loans = get_loans()
        writer.writerow(['ID', 'Borrower', 'Principal', 'Rate', 'Type', 'Due',
                         'Remaining', 'Status'])
        for l in loans:
            writer.writerow([l['id'], l['borrower'], l['principal'],
                             l['interest_rate'], l['interest_type'],
                             (l['due_date'] or '')[:10], l['remaining_balance'],
                             l['status']])

    elif report_type == 'circulation':
        notes = get_notes(limit=10000)
        writer.writerow(['Serial', 'Denom', 'Status', 'Issued', 'To', 'By'])
        for n in notes:
            writer.writerow([n['serial_number'], n['denomination'], n['status'],
                             (n['date_issued'] or '')[:10], n['issued_to'] or '',
                             n['redeemed_by'] or ''])

    elif report_type == 'reserve':
        logs = get_vault_log(1000)
        writer.writerow(['Time', 'Previous', 'New', 'Change', 'Reason'])
        for l in logs:
            writer.writerow([l['timestamp'], l['previous_amount'],
                             l['new_amount'], l['change_amount'],
                             l['reason'] or ''])

    elif report_type == 'pnl':
        with get_connection() as c:
            fees = c.execute(
                "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='fee'"
            ).fetchone()[0]
            interest = c.execute(
                "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='interest_payment'"
            ).fetchone()[0]
            defs = c.execute(
                "SELECT COALESCE(SUM(remaining_balance),0) FROM loans WHERE status='defaulted'"
            ).fetchone()[0]
        writer.writerow(['Category', 'Amount'])
        writer.writerow(['Fees', fees])
        writer.writerow(['Interest', interest])
        writer.writerow(['Revenue', fees + interest])
        writer.writerow(['Defaults', -defs])
        writer.writerow(['Net', fees + interest - defs])

    else:
        return jsonify({'error': 'Unknown report type'}), 400

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={report_type}.csv'}
    )


if __name__ == '__main__':
    init_database()
    print("\n" + "=" * 50)
    print("MINECRAFT DIAMOND BANK — Web Admin")
    print("=" * 50)
    print(f"\nServer starting on http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)

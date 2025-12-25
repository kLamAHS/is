"""
Churn Pre-Mortem Application
============================

Client-facing web application for running SCR analysis.

Flow:
1. Client enters access code + company name
2. Uploads CSV data
3. System processes and generates report
4. Client downloads PDF

Run with: python app.py
"""

import os
import uuid
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, send_file, session, jsonify
)
from werkzeug.utils import secure_filename
import pandas as pd
import threading
import time

from scr_analyzer import SCRAnalyzer
from report_generator import (
    ChurnAnalysisResult, generate_report,
    get_wasted_money_items, get_wont_fix_items, get_strategic_moves
)

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Configuration
UPLOAD_FOLDER = 'uploads'
REPORTS_FOLDER = 'reports'
ALLOWED_EXTENSIONS = {'csv'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(REPORTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Access codes - in production, move to database or env vars
# Format: code -> {uses_remaining, expires, client_name}
ACCESS_CODES = {
    'DEMO2024': {'uses_remaining': 999, 'expires': '2025-12-31', 'client_name': 'Demo'},
    # Add client-specific codes here
}

# Job tracking
JOBS = {}  # job_id -> {status, progress, result_path, error}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_access_code(code):
    """Check if access code is valid"""
    if code not in ACCESS_CODES:
        return False, "Invalid access code"

    info = ACCESS_CODES[code]

    if info['uses_remaining'] <= 0:
        return False, "Access code has been used"

    if datetime.now() > datetime.strptime(info['expires'], '%Y-%m-%d'):
        return False, "Access code has expired"

    return True, info['client_name']


def use_access_code(code):
    """Decrement access code uses"""
    if code in ACCESS_CODES:
        ACCESS_CODES[code]['uses_remaining'] -= 1


def run_analysis_job(job_id, filepath, company_name):
    """Background job to run analysis"""
    try:
        JOBS[job_id]['status'] = 'processing'
        JOBS[job_id]['progress'] = 10

        # Load data
        df = pd.read_csv(filepath)
        JOBS[job_id]['progress'] = 20

        # Run analysis
        analyzer = SCRAnalyzer()
        JOBS[job_id]['progress'] = 30

        result = analyzer.analyze(df)
        JOBS[job_id]['progress'] = 70

        # Generate report
        safe_name = company_name.lower().replace(" ", "_").replace("/", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"{safe_name}_churn_premortem_{timestamp}.pdf"
        report_path = os.path.join(REPORTS_FOLDER, report_filename)

        analysis_result = ChurnAnalysisResult(
            company_name=company_name,
            analysis_date=datetime.now().strftime("%B %d, %Y"),
            scr_score=result.scr_score,
            exploration_score=result.exploration_score,
            decisiveness_score=result.decisiveness_score,
            weight_volatility=result.weight_volatility,
            regime_instability=result.regime_instability,
            alpha_over_time=result.alpha_trajectory,
            time_labels=result.time_periods,
            user_count=result.user_count,
            days_analyzed=result.days_analyzed,
            data_coverage=result.data_coverage,
            regime=result.regime,
            wasted_money=get_wasted_money_items(result.regime),
            wont_fix=get_wont_fix_items(result.regime),
            strategic_moves=[m[0] for m in get_strategic_moves(result.regime)]
        )

        JOBS[job_id]['progress'] = 90
        generate_report(analysis_result, report_path)

        # Store results
        JOBS[job_id]['status'] = 'complete'
        JOBS[job_id]['progress'] = 100
        JOBS[job_id]['result_path'] = report_path
        JOBS[job_id]['result_filename'] = report_filename
        JOBS[job_id]['scr_score'] = result.scr_score
        JOBS[job_id]['regime'] = result.regime
        JOBS[job_id]['user_count'] = result.user_count
        JOBS[job_id]['confidence'] = result.confidence

        # Cleanup uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)

    except Exception as e:
        JOBS[job_id]['status'] = 'error'
        JOBS[job_id]['error'] = str(e)

        # Cleanup on error
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/')
def index():
    """Landing page"""
    return render_template('index.html')


@app.route('/start', methods=['POST'])
def start_analysis():
    """Validate access code and start upload flow"""
    access_code = request.form.get('access_code', '').strip().upper()

    valid, result = validate_access_code(access_code)
    if not valid:
        flash(result, 'error')
        return redirect(url_for('index'))

    session['access_code'] = access_code
    session['client_name'] = result
    return redirect(url_for('upload'))


@app.route('/upload')
def upload():
    """Data upload page"""
    if 'access_code' not in session:
        flash('Please enter an access code first', 'error')
        return redirect(url_for('index'))

    return render_template('upload.html', client_name=session.get('client_name', ''))


@app.route('/process', methods=['POST'])
def process():
    """Handle file upload and start processing"""
    if 'access_code' not in session:
        flash('Session expired. Please start over.', 'error')
        return redirect(url_for('index'))

    company_name = request.form.get('company_name', '').strip()
    if not company_name:
        flash('Please enter a company name', 'error')
        return redirect(url_for('upload'))

    if 'datafile' not in request.files:
        flash('No file uploaded', 'error')
        return redirect(url_for('upload'))

    file = request.files['datafile']
    if file.filename == '':
        flash('No file selected', 'error')
        return redirect(url_for('upload'))

    if not allowed_file(file.filename):
        flash('Only CSV files are accepted', 'error')
        return redirect(url_for('upload'))

    # Save uploaded file
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(filepath)

    # Validate CSV structure
    try:
        df = pd.read_csv(filepath, nrows=5)
        if 'user_id' not in df.columns or 'timestamp' not in df.columns:
            flash('CSV must contain "user_id" and "timestamp" columns', 'error')
            os.remove(filepath)
            return redirect(url_for('upload'))
    except Exception as e:
        flash(f'Error reading CSV: {str(e)}', 'error')
        os.remove(filepath)
        return redirect(url_for('upload'))

    # Use access code
    use_access_code(session['access_code'])

    # Create job
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        'status': 'queued',
        'progress': 0,
        'company_name': company_name,
        'started_at': datetime.now().isoformat()
    }

    # Start background processing
    thread = threading.Thread(
        target=run_analysis_job,
        args=(job_id, filepath, company_name)
    )
    thread.start()

    session['job_id'] = job_id
    return redirect(url_for('processing'))


@app.route('/processing')
def processing():
    """Processing status page"""
    job_id = session.get('job_id')
    if not job_id or job_id not in JOBS:
        flash('No active analysis found', 'error')
        return redirect(url_for('index'))

    job = JOBS[job_id]
    if job['status'] == 'complete':
        return redirect(url_for('results'))
    elif job['status'] == 'error':
        flash(f"Analysis failed: {job.get('error', 'Unknown error')}", 'error')
        return redirect(url_for('upload'))

    return render_template('processing.html', job=job)


@app.route('/status')
def status():
    """AJAX endpoint for job status"""
    job_id = session.get('job_id')
    if not job_id or job_id not in JOBS:
        return jsonify({'status': 'not_found'})

    job = JOBS[job_id]
    return jsonify({
        'status': job['status'],
        'progress': job.get('progress', 0)
    })


@app.route('/results')
def results():
    """Results page with download link"""
    job_id = session.get('job_id')
    if not job_id or job_id not in JOBS:
        flash('No results found', 'error')
        return redirect(url_for('index'))

    job = JOBS[job_id]
    if job['status'] != 'complete':
        return redirect(url_for('processing'))

    return render_template('results.html', job=job)


@app.route('/download')
def download():
    """Download the generated report"""
    job_id = session.get('job_id')
    if not job_id or job_id not in JOBS:
        flash('No report found', 'error')
        return redirect(url_for('index'))

    job = JOBS[job_id]
    if job['status'] != 'complete' or 'result_path' not in job:
        flash('Report not ready', 'error')
        return redirect(url_for('processing'))

    return send_file(
        job['result_path'],
        as_attachment=True,
        download_name=job['result_filename']
    )


# Admin routes (protect these in production)
@app.route('/admin/codes')
def admin_codes():
    """View access codes (protect this route in production)"""
    return jsonify(ACCESS_CODES)


@app.route('/admin/create_code', methods=['POST'])
def admin_create_code():
    """Create a new access code"""
    data = request.json
    code = data.get('code', secrets.token_hex(4).upper())

    ACCESS_CODES[code] = {
        'uses_remaining': data.get('uses', 1),
        'expires': data.get('expires', (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')),
        'client_name': data.get('client_name', 'Client')
    }

    return jsonify({'code': code, 'info': ACCESS_CODES[code]})


if __name__ == '__main__':
    print("\n" + "="*50)
    print("CHURN PRE-MORTEM APPLICATION")
    print("="*50)
    print(f"\nServer starting on http://localhost:5000")
    print(f"\nDemo access code: DEMO2024")
    print("="*50 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5000)

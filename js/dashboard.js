// Running on every dashboard page load for dashboard authentication
async function checkAuth(){
    try{
        const res = await fetch('/api/dashboard', {
            credentials: 'include'
        });
        if (res.status === 401){
            window.location.href = '/login.html';
            return null;
        }
        return await res.json();
    } catch(err){
        window.location.href = '/login.html';
        return null;
    }
}

// Populate Overview Page with data
async function renderOverview(content){
    content.innerHTML = '<h2>Overview</h2><p>Loading...</p>';
    const res  = await fetch('/api/overview', { credentials: 'include' });
    const json = await res.json();
    if(!json.success){
        content.innerHTML = '<h2>Overview</h2><p style="color:red">Failed to load.</p>';
        return;
    }

    const d = json.data;
    const avgLoadSec = d.avgLoad ? (d.avgLoad / 1000).toFixed(2) + 's' : '—';

    // Color code load time
    const loadColor = !d.avgLoad ? '#95a5a6'
        : d.avgLoad > 3000 ? '#e74c3c'
        : d.avgLoad > 1500 ? '#f39c12'
        : '#2ecc71';

    // Color code errors
    const errorColor = d.totalErrors === 0 ? '#2ecc71'
        : d.totalErrors < 10 ? '#f39c12'
        : '#e74c3c';

    content.innerHTML = `
        <h2>Overview</h2>
        <p id="overview-p">All-time stats · Errors and interactions from last 7 days</p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px">
            <div class="metric-card" style="border-color:#3498db">
                <p class="metric-card-header">Total Pageviews</p>
                <p class="metric-card-data">${Number(d.totalPageviews).toLocaleString()}</p>
            </div>
            <div class="metric-card" style="border-color:#9b59b6">
                <p class="metric-card-header">Unique Sessions</p>
                <p class="metric-card-data">${Number(d.uniqueSessions).toLocaleString()}</p>
            </div>
            <div class="metric-card" style="border-color:${loadColor}">
                <p class="metric-card-header"">Avg Load Time</p>
                <p class="metric-card-data" style="color:${loadColor}">${avgLoadSec}</p>
                <p class="metric-card-subtitle">${d.avgLoad > 3000 ? '⚠ Slow' : d.avgLoad > 1500 ? '~ Moderate' : '✓ Good'}</p>
            </div>
            <div class="metric-card" style="border-color:${errorColor}">
                <p class="metric-card-header">Errors (7 days)</p>
                <p class="metric-card-data" style="color:${errorColor}">${Number(d.totalErrors).toLocaleString()}</p>
                <p class="metric-card-subtitle">${d.totalErrors === 0 ? '✓ No errors' : d.totalErrors < 10 ? '~ Some errors' : '⚠ High errors'}</p>
            </div>
            <div class="metric-card" style="border-color:#2ecc71">
                <p class="metric-card-header"">Interactions (7 days)</p>
                <p class="metric-card-data">${Number(d.totalInteractions).toLocaleString()}</p>
            </div>
            <div class="metric-card" style="border-color:#e67e22">
                <p class="metric-card-header">Top Page</p>
                <p class="metric-card-data" style="font-size:16px;">${d.topPage ? (d.topPage.url.split('/').pop() || '/') : '—'}</p>
                <p class="metric-card-subtitle">${d.topPage ? Number(d.topPage.visits).toLocaleString() + ' visits' : ''}</p>
            </div>
        </div>
    `;
}

// Saving Reports
async function saveReport(section, startID, endID){
    const name = prompt('Enter a name for this report:');
    if(!name){
        return;
    }
    const comments = prompt('Add any comments (optional):') || '';

    // grab whatever dates the analyst currently has loaded
    const start = document.getElementById(startID).value;
    const end   = document.getElementById(endID).value;

    const res = await fetch('/api/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, section, analyst_comments: comments, start, end })
    });
    const data = await res.json();
    alert(data.success ? 'Report saved!' : (data.error || 'Failed to save.'));
}

// Populate reports section
async function renderReports(content, user){
    content.innerHTML = '<h2>Saved Reports</h2><p>Loading...</p>';
    const res  = await fetch('/api/reports', { credentials: 'include' });
    const json = await res.json();

    if(!json.success){
        content.innerHTML = '<h2>Saved Reports</h2><p style="color:red">Failed to load reports.</p>';
        return;
    }

    const reports = json.reports;
    content.innerHTML = '<h2>Saved Reports</h2><div id="report-list"></div>';
    const list = document.getElementById('report-list');

    if(reports.length === 0){
        list.innerHTML = '<p>No saved reports yet.</p>';
        return;
    }

    reports.forEach(r => {
        const card = document.createElement('div');
        card.className = 'report-card';
        
        const info = document.createElement('div');
        info.innerHTML = `
            <strong>${r.name}</strong>
            <span style="margin-left:12px;font-size:12px;color:#888">${r.section} — saved ${r.created_at} by ${r.created_by}</span>
            ${r.analyst_comments ? `<p style="margin-top:6px">${r.analyst_comments}</p>` : ''}
        `;
        card.addEventListener('click', () => {
            window.location.hash = `#/reports/${r.id}`;
        });

        card.appendChild(info);

        // only show delete access for super_admin
        if(user.role === 'super_admin'){
            const delBtn = document.createElement('button');
            delBtn.id = 'delete-btn';
            delBtn.textContent = 'Delete Report';
            delBtn.style.cssText = 'margin-left:12px;';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // prevent card click navigating to report
                if(!confirm(`Delete "${r.name}"?`)){
                    return;
                }
                const res  = await fetch(`/api/reports/${r.id}`, { method: 'DELETE', credentials: 'include' });
                const data = await res.json();
                if(data.success){
                    renderReports(content, user);
                }
                else{
                    alert(data.error || 'Failed to delete.');
                }
            });
            card.appendChild(delBtn);
        }

        list.appendChild(card);
    });
}

// Rendering a specific report for view
async function renderReportDetail(content, id){
    content.innerHTML = '<p>Loading...</p>';
    const res  = await fetch(`/api/reports/${id}`, { credentials: 'include' });
    const json = await res.json();
    if(!json.success){
        content.innerHTML = '<p style="color:red">Report not found.</p>';
        return;
    }

    const report   = json.report;
    const snapshot = report.snapshot;
    const meta     = snapshot.meta || {};
    const byPage   = snapshot.byPage || [];
    if(report.section === 'performance'){
        content.innerHTML = `
            <button onclick="window.location.hash='#/reports'">← Back to Reports</button>
            <button id="export-btn" >⬇ Export PDF</button>
            <h2>${report.name}</h2>
            <p style="color:#888">
                Section: <strong>${report.section}</strong> &nbsp;|&nbsp;
                Period: <strong>${meta.start || '—'} to ${meta.end || '—'}</strong> &nbsp;|&nbsp;
                Saved: <strong>${report.created_at}</strong> by <strong>${report.created_by}</strong>
            </p>
            ${report.analyst_comments ? `
                <div style="background:#fffce6;border-left:4px solid #f4b400;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
                    <strong>Analyst Comments</strong>
                    <p style="margin-top: 6px">${report.analyst_comments}</p>
                </div>` 
            : ''}
            <canvas id="report-bar" style="width:100%;max-height:300px;margin-bottom:24px"></canvas>
            <table>
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Avg Load</th>
                        <th>Min Load</th>
                        <th>Max Load</th>
                        <th>Avg TTFB</th>
                        <th>Avg DOM</th>
                        <th>Samples</th>
                    </tr>
                </thead>
                <tbody id="report-tbody"></tbody>
            </table>
        `;
        document.getElementById('export-btn').addEventListener('click', async () => {
            const btn = document.getElementById('export-btn');
            btn.textContent = 'Generating...';
            btn.disabled = true;
            const res  = await fetch(`/api/reports/${id}/export`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            btn.disabled = false;
            btn.textContent = '⬇ Export PDF';
            if(data.success){
                window.open(data.url, '_blank');
            } else {
                alert(data.error || 'Export failed.');
            }
        });

        // Render report table
        const tbody = document.getElementById('report-tbody');
        byPage.forEach(row => {
            const tr = document.createElement('tr');
            if((row.avg_load_ms || 0) > 3000)      tr.style.borderLeft = '4px solid #e74c3c';
            else if((row.avg_load_ms || 0) > 1500) tr.style.borderLeft = '4px solid #f39c12';
            else                                    tr.style.borderLeft = '4px solid #2ecc71';
            [
                row.url,
                (row.avg_load_ms  ?? '—') + ' ms',
                (row.min_load_ms  ?? '—') + ' ms',
                (row.max_load_ms  ?? '—') + ' ms',
                (row.avg_ttfb_ms  ?? '—') + ' ms',
                (row.avg_dom_ms   ?? '—') + ' ms',
                row.samples ?? '—'
            ].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Render report chart
        const top10 = byPage.slice(0, 10);
        new Chart(document.getElementById('report-bar'), {
            type: 'bar',
            data: {
                labels: top10.map(r => r.url.split('/').pop() || r.url),
                datasets: [
                    { label: 'Avg Load (ms)', data: top10.map(r => r.avg_load_ms || 0), backgroundColor: 'rgba(52,152,219,0.8)' },
                    { label: 'Avg TTFB (ms)', data: top10.map(r => r.avg_ttfb_ms || 0), backgroundColor: 'rgba(46,204,113,0.8)' },
                    { label: 'Max Load (ms)', data: top10.map(r => r.max_load_ms || 0), backgroundColor: 'rgba(231,76,60,0.4)' }
                ]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: `Performance Report — ${meta.start} to ${meta.end}` } }
            }
        });
    }
    else if(report.section === 'errors'){
        const byMessage = snapshot.byMessage || [];
        content.innerHTML = `
            <button onclick="window.location.hash='#/reports'" style="margin-bottom:16px">← Back to Reports</button>
            <button id="export-btn">⬇ Export PDF</button>
            <h2>${report.name}</h2>
            <p style="color:#888">
                Section: <strong>${report.section}</strong> &nbsp;|&nbsp;
                Period: <strong>${meta.start || '—'} to ${meta.end || '—'}</strong> &nbsp;|&nbsp;
                Saved: <strong>${report.created_at}</strong> by <strong>${report.created_by}</strong>
            </p>
            ${report.analyst_comments ? `
                <div style="background:#fffce6;border-left:4px solid #f4b400;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
                    <strong>Analyst Comments</strong>
                    <p style="margin-top:6px;">${report.analyst_comments}</p>
                </div>` : ''}
            <canvas id="report-bar" style="width:100%;max-height:260px;margin-bottom:24px"></canvas>
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Error Message</th>
                        <th>Occurrences</th>
                        <th>Affected Sessions</th>
                        <th>Affected Pages</th>
                        <th>First Seen</th>
                        <th>Last Seen</th>
                    </tr>
                </thead>
                <tbody id="report-tbody"></tbody>
            </table>
        `;
        document.getElementById('export-btn').addEventListener('click', async () => {
            const btn = document.getElementById('export-btn');
            btn.textContent = 'Generating...';
            btn.disabled = true;
            const res  = await fetch(`/api/reports/${id}/export`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            btn.disabled = false;
            btn.textContent = '⬇ Export PDF';
            if(data.success){
                window.open(data.url, '_blank');
            } else {
                alert(data.error || 'Export failed.');
            }
        });

        // Chart — top errors by occurrences
        const top10 = byMessage.slice(0, 10);
        new Chart(document.getElementById('report-bar'), {
            type: 'bar',
            data: {
                labels: top10.map(r => r.error_message.substring(0, 30)),
                datasets: [{
                    label: 'Occurrences',
                    data: top10.map(r => r.occurrences),
                    backgroundColor: 'rgba(231,76,60,0.8)'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { beginAtZero: true } },
                plugins: { title: { display: true, text: `Top Errors — ${meta.start} to ${meta.end}` } }
            }
        });

        // Table
        const tbody = document.getElementById('report-tbody');
        byMessage.forEach(row => {
            const tr = document.createElement('tr');
            [row.type, row.error_message, row.occurrences, row.affected_sessions, row.affected_pages, row.first_seen, row.last_seen].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val ?? '—';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    } else if(report.section === 'behavioral'){
        const byPage = snapshot.byPage || [];
        content.innerHTML = `
            <button onclick="window.location.hash='#/reports'" style="margin-bottom:16px">← Back to Reports</button>
            <button id="export-btn">⬇ Export PDF</button>
            <h2>${report.name}</h2>
            <p style="color:#888">
                Section: <strong>${report.section}</strong> &nbsp;|&nbsp;
                Period: <strong>${meta.start || '—'} to ${meta.end || '—'}</strong> &nbsp;|&nbsp;
                Saved: <strong>${report.created_at}</strong> by <strong>${report.created_by}</strong>
            </p>
            ${report.analyst_comments ? `
                <div style="background:#fffce6;border-left:4px solid #f4b400;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
                    <strong>Analyst Comments</strong>
                    <p style="margin-top:6p">${report.analyst_comments}</p>
                </div>` : ''}
            <div style="display:flex;gap:24px;margin-bottom:24px">
                <div style="width:280px;height:280px;flex-shrink:0">
                    <canvas id="report-doughnut"></canvas>
                </div>
                <div style="flex:1;height:280px">
                    <canvas id="report-bar"></canvas>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Total Interactions</th>
                        <th>Clicks</th>
                        <th>Scrolls</th>
                        <th>Keydowns</th>
                        <th>Idles</th>
                    </tr>
                </thead>
                <tbody id="report-tbody"></tbody>
            </table>
        `;
        document.getElementById('export-btn').addEventListener('click', async () => {
            const btn = document.getElementById('export-btn');
            btn.textContent = 'Generating...';
            btn.disabled = true;
            const res  = await fetch(`/api/reports/${id}/export`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            btn.disabled = false;
            btn.textContent = '⬇ Export PDF';
            if(data.success){
                window.open(data.url, '_blank');
            } else {
                alert(data.error || 'Export failed.');
            }
        });

        // Doughnut chart
        const eventBreakdown = snapshot.eventBreakdown || [];
        if(eventBreakdown.length > 0){
            new Chart(document.getElementById('report-doughnut'), {
                type: 'doughnut',
                data: {
                    labels: eventBreakdown.map(r => r.type),
                    datasets: [{
                        data: eventBreakdown.map(r => r.count),
                        backgroundColor: [
                            'rgba(52,152,219,0.8)',
                            'rgba(46,204,113,0.8)',
                            'rgba(231,76,60,0.8)',
                            'rgba(243,156,18,0.8)',
                            'rgba(155,89,182,0.8)',
                            'rgba(26,188,156,0.8)'
                        ]
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { title: { display: true, text: 'Event Type Breakdown' } }
                }
            });
        }

        // Bar chart
        const top10 = byPage.slice(0, 10);
        new Chart(document.getElementById('report-bar'), {
            type: 'bar',
            data: {
                labels: top10.map(r => r.url.split('/').pop() || r.url),
                datasets: [
                    { label: 'Clicks',   data: top10.map(r => r.clicks   || 0), backgroundColor: 'rgba(52,152,219,0.8)'  },
                    { label: 'Scrolls',  data: top10.map(r => r.scrolls  || 0), backgroundColor: 'rgba(46,204,113,0.8)'  },
                    { label: 'Keydowns', data: top10.map(r => r.keydowns || 0), backgroundColor: 'rgba(243,156,18,0.8)'  },
                    { label: 'Idles',    data: top10.map(r => r.idles    || 0), backgroundColor: 'rgba(231,76,60,0.4)'   }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: `Interactions per Page — ${meta.start} to ${meta.end}` } }
            }
        });

        // Table
        const tbody = document.getElementById('report-tbody');
        byPage.forEach(row => {
            const tr = document.createElement('tr');
            [row.url, row.total_interactions, row.clicks ?? 0, row.scrolls ?? 0, row.keydowns ?? 0, row.idles ?? 0].forEach(val => {
                const td = document.createElement('td');
                td.textContent = val;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
}

// Rendering performance charts and table
let perfBarChart  = null;
let perfLineChart = null;

function renderPerfTable(byPage){
    const tbody = document.getElementById('perf-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    byPage.forEach(row => {
        const tr = document.createElement('tr');
        // Color code slow pages
        if((row.avg_load_ms || 0) > 3000)      tr.style.borderLeft = '4px solid #e74c3c';
        else if((row.avg_load_ms || 0) > 1500) tr.style.borderLeft = '4px solid #f39c12';
        else                                    tr.style.borderLeft = '4px solid #2ecc71';

        [
            row.url,
            (row.avg_load_ms  ?? '—') + ' ms',
            (row.min_load_ms  ?? '—') + ' ms',
            (row.max_load_ms  ?? '—') + ' ms',
            (row.avg_ttfb_ms  ?? '—') + ' ms',
            (row.avg_dom_ms   ?? '—') + ' ms',
            row.samples ?? '—'
        ].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function renderPerfCharts(byPage, trend){
    // Bar chart — top 10 pages load time breakdown
    const top10 = byPage.slice(0, 10);
    if(perfBarChart) perfBarChart.destroy();
    perfBarChart = new Chart(document.getElementById('perf-bar'), {
        type: 'bar',
        data: {
            labels: top10.map(r => r.url.split('/').pop() || r.url),
            datasets: [
                {
                    label: 'Avg Load (ms)',
                    data: top10.map(r => r.avg_load_ms || 0),
                    backgroundColor: 'rgba(52, 152, 219, 0.8)'
                },
                {
                    label: 'Avg TTFB (ms)',
                    data: top10.map(r => r.avg_ttfb_ms || 0),
                    backgroundColor: 'rgba(46, 204, 113, 0.8)'
                },
                {
                    label: 'Max Load (ms)',
                    data: top10.map(r => r.max_load_ms || 0),
                    backgroundColor: 'rgba(231, 76, 60, 0.4)'
                }
            ]
        },
        options: {
            scales: { y: { beginAtZero: true } },
            plugins: { title: { display: true, text: 'Load Time Breakdown — Top 10 Pages' } }
        }
    });

    // Line chart — daily trend
    if(perfLineChart) perfLineChart.destroy();
    if(trend.length > 0){
        perfLineChart = new Chart(document.getElementById('perf-line'), {
            type: 'line',
            data: {
                labels: trend.map(r => r.date),
                datasets: [
                    {
                        label: 'Avg Load (ms)',
                        data: trend.map(r => r.avg_load_ms || 0),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52,152,219,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Avg TTFB (ms)',
                        data: trend.map(r => r.avg_ttfb_ms || 0),
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46,204,113,0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: 'Daily Avg Load Time Trend' } }
            }
        });
    }
}

// Loading a Specific Performance Data
async function loadPerfData(){
    const start = document.getElementById('perf-start').value;
    const end   = document.getElementById('perf-end').value;
    const res   = await fetch(`/api/performance?start=${start}&end=${end}`, { credentials: 'include' });
    const json  = await res.json();
    if(!json.success){ 
        document.getElementById('perf-error').textContent = json.error || 'Failed to load.';
        return;
    }
    renderPerfCharts(json.data.byPage, json.data.trend);
    renderPerfTable(json.data.byPage);
}

// Rendering the performance page
async function renderPerformance(content){
    const now   = new Date();
    const week  = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const start = week.toISOString().slice(0, 10);

    content.innerHTML = `
        <h2>Performance Data</h2>
        <p id="perf-error" style="color:red"></p>

        <div style="margin-bottom:16px">
            <label>From: <input type="date" id="perf-start" value="${start}"></label>
            <label style="margin-left:12px">To: <input type="date" id="perf-end" value="${today}"></label>
            <button id="perf-btn" style="margin-left:12px">Load</button>
            <button id="save-report-btn" style="margin-left:12px">💾 Save Report</button>
        </div>

        <canvas id="perf-bar"  style="width:100%;max-height:300px;margin-bottom:24px"></canvas>
        <canvas id="perf-line" style="width:100%;max-height:240px;margin-bottom:24px"></canvas>

        <table>
            <thead>
                <tr>
                    <th>URL</th>
                    <th>Avg Load</th>
                    <th>Min Load</th>
                    <th>Max Load</th>
                    <th>Avg TTFB</th>
                    <th>Avg DOM</th>
                    <th>Samples</th>
                </tr>
            </thead>
            <tbody id="perf-tbody"></tbody>
        </table>
    `;

    document.getElementById('perf-btn').addEventListener('click', loadPerfData);
    document.getElementById('save-report-btn').addEventListener('click', () => saveReport('performance', 'perf-start', 'perf-end'));
    await loadPerfData();
}

// Render Error Charts and table
let errorLineChart = null;
let errorBarChart  = null;

function renderErrorTable(byMessage){
    const tbody = document.getElementById('error-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    byMessage.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';

        [
            row.type,
            row.error_message,
            row.occurrences,
            row.affected_sessions,
            row.affected_pages,
            row.first_seen,
            row.last_seen
        ].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val ?? '—';
            tr.appendChild(td);
        });

        // Expandable row showing full error message
        const detailTr = document.createElement('tr');
        detailTr.style.display = 'none';
        const detailTd = document.createElement('td');
        detailTd.colSpan = 7;
        detailTd.id = "error-table";
        detailTd.textContent = row.error_message;
        detailTr.appendChild(detailTd);

        tr.addEventListener('click', () => {
            detailTr.style.display = detailTr.style.display === 'none' ? '' : 'none';
        });

        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
    });
}

function renderErrorCharts(trend, byMessage){
    // Line chart — daily trend
    if(errorLineChart) errorLineChart.destroy();
    if(trend.length > 0){
        errorLineChart = new Chart(document.getElementById('error-line'), {
            type: 'line',
            data: {
                labels: trend.map(r => r.date),
                datasets: [{
                    label: 'Errors per Day',
                    data: trend.map(r => r.error_count),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231,76,60,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: 'Daily Error Trend' } }
            }
        });
    }

    // Bar chart — top errors by occurrences
    if(errorBarChart) errorBarChart.destroy();
    const top10 = byMessage.slice(0, 10);
    if(top10.length > 0){
        errorBarChart = new Chart(document.getElementById('error-bar'), {
            type: 'bar',
            data: {
                labels: top10.map(r => r.error_message.substring(0, 30)),
                datasets: [{
                    label: 'Occurrences',
                    data: top10.map(r => r.occurrences),
                    backgroundColor: 'rgba(231,76,60,0.8)'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { beginAtZero: true } },
                plugins: { title: { display: true, text: 'Top Errors by Occurrences' } }
            }
        });
    }
}

// Loading a specific Error Data
async function loadErrorData(){
    const start = document.getElementById('error-start').value;
    const end   = document.getElementById('error-end').value;
    const res   = await fetch(`/api/errors?start=${start}&end=${end}`, { credentials: 'include' });
    const json  = await res.json();
    if(!json.success){
        document.getElementById('error-msg').textContent = json.error || 'Failed to load.';
        return;
    }
    renderErrorCharts(json.data.trend, json.data.byMessage);
    renderErrorTable(json.data.byMessage);
}

// Populate Error page
async function renderErrors(content){
    const now = new Date();
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const start = week.toISOString().slice(0, 10);

    content.innerHTML = `
        <h2>Error Data</h2>
        <p id="error-msg" style="color:red"></p>

        <div style="margin-bottom:16px">
            <label>From: <input type="date" id="error-start" value="${start}"></label>
            <label style="margin-left:12px">To: <input type="date" id="error-end" value="${today}"></label>
            <button id="error-btn" style="margin-left:12px">Load</button>
            <button id="error-save-btn" style="margin-left:12px">💾 Save Report</button>
        </div>

        <canvas id="error-bar"  style="width:100%;max-height:260px;margin-bottom:24px"></canvas>
        <canvas id="error-line" style="width:100%;max-height:260px;margin-bottom:24px"></canvas>

        <p style="font-size:12px;color:#888">Click a row to expand full error details.</p>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Error Message</th>
                    <th>Occurrences</th>
                    <th>Affected Sessions</th>
                    <th>Affected Pages</th>
                    <th>First Seen</th>
                    <th>Last Seen</th>
                </tr>
            </thead>
            <tbody id="error-tbody"></tbody>
        </table>
    `;

    document.getElementById('error-btn').addEventListener('click', loadErrorData);
    document.getElementById('error-save-btn').addEventListener('click', () => saveReport('errors', 'error-start', 'error-end'));
    await loadErrorData();
}

// Rendering Behevaioral Charts and Table
let behavBarChart      = null;
let behavDoughnutChart = null;
let behavLineChart     = null;

function renderBehavCharts(eventBreakdown, byPage, trend){
    // Doughnut — event type breakdown
    if(behavDoughnutChart) behavDoughnutChart.destroy();
    if(eventBreakdown.length > 0){
        behavDoughnutChart = new Chart(document.getElementById('behav-doughnut'), {
            type: 'doughnut',
            data: {
                labels: eventBreakdown.map(r => r.type),
                datasets: [{
                    data: eventBreakdown.map(r => r.count),
                    backgroundColor: [
                        'rgba(52,152,219,0.8)',
                        'rgba(46,204,113,0.8)',
                        'rgba(231,76,60,0.8)',
                        'rgba(243,156,18,0.8)',
                        'rgba(155,89,182,0.8)',
                        'rgba(26,188,156,0.8)'
                    ]
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Event Type Breakdown' } }
            }
        });
    }

    // Bar chart — interactions per page
    if(behavBarChart) behavBarChart.destroy();
    const top10 = byPage.slice(0, 10);
    if(top10.length > 0){
        behavBarChart = new Chart(document.getElementById('behav-bar'), {
            type: 'bar',
            data: {
                labels: top10.map(r => r.url.split('/').pop() || r.url),
                datasets: [
                    { label: 'Clicks',   data: top10.map(r => r.clicks   || 0), backgroundColor: 'rgba(52,152,219,0.8)'  },
                    { label: 'Scrolls',  data: top10.map(r => r.scrolls  || 0), backgroundColor: 'rgba(46,204,113,0.8)'  },
                    { label: 'Keydowns', data: top10.map(r => r.keydowns || 0), backgroundColor: 'rgba(243,156,18,0.8)'  },
                    { label: 'Idles',    data: top10.map(r => r.idles    || 0), backgroundColor: 'rgba(231,76,60,0.4)'   }
                ]
            },
            options: {
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: 'Interactions per Page — Top 10' } }
            }
        });
    }

    // Line chart — daily trend
    if(behavLineChart) behavLineChart.destroy();
    if(trend.length > 0){
        behavLineChart = new Chart(document.getElementById('behav-line'), {
            type: 'line',
            data: {
                labels: trend.map(r => r.date),
                datasets: [{
                    label: 'Total Interactions',
                    data: trend.map(r => r.total_interactions),
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155,89,182,0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { title: { display: true, text: 'Daily Interaction Trend' } }
            }
        });
    }
}

function renderBehavTable(byPage){
    const tbody = document.getElementById('behav-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    byPage.forEach(row => {
        const tr = document.createElement('tr');
        [
            row.url,
            row.total_interactions,
            row.clicks    ?? 0,
            row.scrolls   ?? 0,
            row.keydowns  ?? 0,
            row.idles     ?? 0
        ].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// Loading a specific Behavioral Data
async function loadBehavData(){
    const start = document.getElementById('behav-start').value;
    const end   = document.getElementById('behav-end').value;
    const res   = await fetch(`/api/behavioral?start=${start}&end=${end}`, { credentials: 'include' });
    const json  = await res.json();
    if(!json.success){
        document.getElementById('behav-error').textContent = json.error || 'Failed to load.';
        return;
    }
    renderBehavCharts(json.data.eventBreakdown, json.data.byPage, json.data.trend);
    renderBehavTable(json.data.byPage);
}

// Populate Behavioral Page
async function renderBehavioral(content){
    const now   = new Date();
    const week  = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);
    const start = week.toISOString().slice(0, 10);

    content.innerHTML = `
        <h2>Behavioral Data</h2>
        <p id="behav-error" style="color:red"></p>

        <div style="margin-bottom:16px">
            <label>From: <input type="date" id="behav-start" value="${start}"></label>
            <label style="margin-left:12px">To: <input type="date" id="behav-end" value="${today}"></label>
            <button id="behav-btn" style="margin-left:12px">Load</button>
            <button id="behav-save-btn" style="margin-left:12px">💾 Save Report</button>
        </div>

        <div style="display:flex;gap:24px;margin-bottom:24px">
            <div style="width:280px;height:280px;flex-shrink:0">
                <canvas id="behav-doughnut"></canvas>
            </div>
            <div style="flex:1;height:280px">
                <canvas id="behav-bar"></canvas>
            </div>
        </div>
        <div style="height:200px;margin-bottom:24px;width:100%">
            <canvas id="behav-line"></canvas>
        </div>

        <table>
            <thead>
                <tr>
                    <th>URL</th>
                    <th>Total Interactions</th>
                    <th>Clicks</th>
                    <th>Scrolls</th>
                    <th>Keydowns</th>
                    <th>Idles</th>
                </tr>
            </thead>
            <tbody id="behav-tbody"></tbody>
        </table>
    `;

    document.getElementById('behav-btn').addEventListener('click', loadBehavData);
    document.getElementById('behav-save-btn').addEventListener('click', () => saveReport('behavioral', 'behav-start', 'behav-end'));
    await loadBehavData();
}


// Create User Mangement Table
function buildTable(users, content){
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        [u.username, u.display_name, u.role].forEach(val => {
            const td = document.createElement('td');
            td.textContent = val ?? '—';
            tr.appendChild(td);
        });

        // Allowed sections column
        const sectionsTd = document.createElement('td');
        if(u.role === 'analyst'){
            if(u.allowed_sections && u.allowed_sections.length > 0){
                sectionsTd.textContent = u.allowed_sections.join(', ');
            }
            else{
                sectionsTd.textContent = 'none';
            }
        }
        else if(u.role === 'super_admin'){
            sectionsTd.textContent = 'all';
        }
        else if(u.role === 'viewer'){
            sectionsTd.textContent = 'none';
        }
        else{
            sectionsTd.textContent = '-';
        }
        tr.appendChild(sectionsTd);

        const createdTd = document.createElement('td');
        createdTd.textContent = u.created_at ?? '—';
        tr.appendChild(createdTd);

        const actionTd = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️ Edit';
        editBtn.style.marginRight = '6px';
        editBtn.addEventListener('click', () => {
            const newName = prompt('New display name:', u.display_name);
            if(newName === null) return;
            const newRole = prompt('New role (viewer/analyst/super_admin):', u.role);
            if(newRole === null) return;

            let allowed_sections = undefined;
            if(newRole === 'analyst'){
                const input = prompt('Allowed sections (comma separated: performance,errors,behavioral):', (u.allowed_sections || []).join(','));
                if(input === null) return;
                allowed_sections = input.split(',').map(s => s.trim()).filter(Boolean);
            }

            fetch(`/api/users/${u.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: newName, role: newRole, allowed_sections })
            }).then(r => r.json()).then(d => {
                if(d.success) renderAdmin(content);
                else alert(d.error || 'Failed to update.');
            });
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Remove User';
        delBtn.id = 'delete-btn';
        delBtn.addEventListener('click', async () => {
            if(!confirm(`Delete "${u.username}"?`)) return;
            const res  = await fetch(`/api/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
            const data = await res.json();
            if(data.success) renderAdmin(content);
            else alert(data.error || 'Failed to delete.');
        });

        actionTd.appendChild(editBtn);
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    });
}

// Populate admin page
async function renderAdmin(content){
    const res  = await fetch('/api/users', { credentials: 'include' });
    const json = await res.json();
    const users = json.users || [];

    content.innerHTML = `
        <h2>User Management</h2>
        <table id="users-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Allowed Sections</th>
                    <th>Created At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="users-tbody"></tbody>
        </table>
        <hr>
        <h3>Add User</h3>
        <form style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
            <input type="text"     id="new-username" placeholder="Username">
            <input type="text"     id="new-name"     placeholder="Display Name">
            <input type="password" id="new-password" placeholder="Password">
            <select id="new-role">
                <option value="viewer">Viewer</option>
                <option value="analyst">Analyst</option>
                <option value="super_admin">Super Admin</option>
            </select>
            <button id="add-user-btn">Add User</button>
        </form>
        <div id="sections-checkboxes" style="display:none;margin-bottom:8px">
            <strong>Allowed Sections:</strong>
            <label><input type="checkbox" value="performance"> Performance</label>
            <label style="margin-left:8px"><input type="checkbox" value="errors"> Errors</label>
            <label style="margin-left:8px"><input type="checkbox" value="behavioral"> Behavioral</label>
        </div>
        <p id="add-user-msg"></p>
    `;

    // Show/hide sections checkboxes based on role selection
    document.getElementById('new-role').addEventListener('change', function(){
        document.getElementById('sections-checkboxes').style.display =
            this.value === 'analyst' ? 'block' : 'none';
    });

    buildTable(users, content);

    document.getElementById('add-user-btn').addEventListener('click', async () => {
        const username     = document.getElementById('new-username').value.trim();
        const display_name = document.getElementById('new-name').value.trim();
        const password     = document.getElementById('new-password').value;
        const role         = document.getElementById('new-role').value;
        const msg          = document.getElementById('add-user-msg');

        if(!username || !display_name || !password){
            msg.style.color = 'red';
            msg.textContent = 'All fields are required.';
            return;
        }

        // Collect checked sections if analyst
        let allowed_sections = [];
        if(role === 'analyst'){
            document.querySelectorAll('#sections-checkboxes input[type="checkbox"]').forEach(cb => {
                if(cb.checked) allowed_sections.push(cb.value);
            });
        }

        const res  = await fetch('/api/users', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, display_name, password, role, allowed_sections })
        });
        const data = await res.json();
        if(data.success){
            msg.style.color = 'green';
            msg.textContent = 'User added!';
            renderAdmin(content);
        } else {
            msg.style.color = 'red';
            msg.textContent = data.error || 'Failed to add user.';
        }
    });
}

// Route Handler
function handleRoute(hash, user){
    const content = document.getElementById('content');
    const reportMatch = hash.match(/^#\/reports\/(\d+)$/);
    if(reportMatch){
        renderReportDetail(content, reportMatch[1]);
        return;
    }
    switch(hash){
        case '#/overview':
            renderOverview(content);
            break;
        case '#/reports':
            renderReports(content, user);
            break;
        case '#/performance':
            renderPerformance(content);
            break;
        case '#/errors':
            renderErrors(content);
            break;
        case '#/behavioral':
            renderBehavioral(content);
            break;
        case '#/admin':
            renderAdmin(content);
            break;
        default:
            renderOverview(content);
    }
}

// Router to get hash and activate hash value
function route(user) {
    const hash = window.location.hash || '#/overview';
    // Update active sidebar link
    document.querySelectorAll('.sidebar a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === hash);
    });
    handleRoute(hash, user);
}

// Rendering access links for users with access to them
function buildNav(user){
    const sidebar = document.querySelector('.sidebar');
    if(user.role === 'super_admin'){
        const sections = ['performance', 'errors', 'behavioral', 'admin'];
        sections.forEach(section => {
            const a = document.createElement('a');
            a.href = `#/${section}`;
            a.textContent = section.replace(section.charAt(0), section.charAt(0).toUpperCase());
            sidebar.appendChild(a);
        });
    }
    else if(user.role === 'analyst'){
        user.allowed_sections.forEach(section => {
            const a = document.createElement('a');
            a.href = `#/${section}`;
            a.textContent = section.replace(section.charAt(0), section.charAt(0).toUpperCase());
            sidebar.appendChild(a);
        });
    }
}

// Usage: On page load
checkAuth().then(async data => {
    if(data){
        // Rendering Performance/Error/Admin Page on every page load for users with access
        const user = data.data;
        document.getElementById('user-display').textContent = user.display_name || user.username;
        buildNav(user);

        // Calling route whenever the sidebar link changes
        window.addEventListener('hashchange', () => route(user));
        route(user);

        // Calling logout endpoint whenver we want to sign out
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', async() => {
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = '/login.html';
        }); 
    }
});

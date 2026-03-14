<?php
// Start a session
session_start();

// Include access to helper functions from auth.php
require_once 'auth.php';

$allowed_origins = ['https://test.jperez.site'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if(in_array($origin, $allowed_origins)){
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle CORS preflight
if($_SERVER['REQUEST_METHOD'] === 'OPTIONS'){
    http_response_code(200);
    exit;
}

// Read raw input stream and decode manually
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

$allowed_types = ['static', 'performance', 'js-error', 'promise-rejection-error', 'resource-error', 'idle', 'mousemove', 'click', 'scroll', 'keydown', 'keyup', 'enteredPage', 'leftPage'];

// Database connection
$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'analytics';
$dbuser = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$dsn = 'mysql:host=' . $host . ';dbname=' . $dbname . ';charset=utf8mb4';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strips base path if behind a subdirectory
$path = preg_replace('#^.*/api#', '/api', $path);


// Getting the overview Page
if($method === 'GET' && $path === '/api/overview'){
    requireAuth();
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Total pageviews
    $stmt = $pdo->query('SELECT COUNT(*) AS total FROM pageviews WHERE type = "enteredPage"');
    $totalPageviews = $stmt->fetch()['total'];

    // Unique sessions
    $stmt = $pdo->query('SELECT COUNT(DISTINCT session_id) AS total FROM pageviews');
    $uniqueSessions = $stmt->fetch()['total'];

    // Avg load time
    $stmt = $pdo->query('
        SELECT ROUND(AVG(JSON_EXTRACT(payload, "$.totalLoadTime"))) AS avg_load
        FROM pageviews
        WHERE type = "performance"
        AND JSON_EXTRACT(payload, "$.totalLoadTime") IS NOT NULL
    ');
    $avgLoad = $stmt->fetch()['avg_load'] ?? 0;

    // Total errors (last 7 days)
    $stmt = $pdo->query('
        SELECT COUNT(*) AS total FROM pageviews
        WHERE type IN ("js-error", "promise-rejection-error", "resource-error")
        AND DATE(client_timestamp) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    ');
    $totalErrors = $stmt->fetch()['total'];

    // Total interactions (last 7 days)
    $stmt = $pdo->query('
        SELECT COUNT(*) AS total FROM pageviews
        WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
        AND DATE(client_timestamp) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    ');
    $totalInteractions = $stmt->fetch()['total'];

    // Most visited page
    $stmt = $pdo->query('
        SELECT url, COUNT(*) AS visits
        FROM pageviews WHERE type = "enteredPage"
        GROUP BY url ORDER BY visits DESC LIMIT 1
    ');
    $topPage = $stmt->fetch();

    jsonResponse(['success' => true, 'data' => [
        'totalPageviews'    => $totalPageviews,
        'uniqueSessions'    => $uniqueSessions,
        'avgLoad'           => $avgLoad,
        'totalErrors'       => $totalErrors,
        'totalInteractions' => $totalInteractions,
        'topPage'           => $topPage
    ]]);
}


// Donwloading report
if($method === 'POST' && preg_match('#^/api/reports/(\d+)/export$#', $path, $m)){
    requireAuth();
    require_once 'fpdf.php';

    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $stmt = $pdo->prepare('
        SELECT r.*, u.display_name AS created_by
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = :id
    ');
    $stmt->execute([':id' => $m[1]]);
    $report = $stmt->fetch();
    if(!$report) jsonResponse(['success' => false, 'error' => 'Report not found'], 404);

    $snapshot = json_decode($report['snapshot'], true) ?: [];
    $meta     = $snapshot['meta'] ?? [];
    $section  = $report['section'];

    $pdf = new FPDF();
    $pdf->AddPage();
    $pdf->SetMargins(15, 15, 15);

    // Header
    $pdf->SetFont('Arial', 'B', 18);
    $pdf->Cell(0, 10, $report['name'], 0, 1, 'C');
    $pdf->SetFont('Arial', 'I', 10);
    $pdf->Cell(0, 6, 'Section: ' . $section . '   |   Period: ' . ($meta['start'] ?? '—') . ' to ' . ($meta['end'] ?? '—'), 0, 1, 'C');
    $pdf->Cell(0, 6, 'Saved by: ' . $report['created_by'] . '   |   Generated: ' . date('Y-m-d H:i'), 0, 1, 'C');
    $pdf->Ln(4);

    // Analyst comments
    if(!empty($report['analyst_comments'])){
        $pdf->SetFillColor(255, 252, 230);
        $pdf->SetDrawColor(244, 180, 0);
        $pdf->SetFont('Arial', 'B', 11);
        $pdf->Cell(0, 8, 'Analyst Comments', 1, 1, 'L', true);
        $pdf->SetFont('Arial', '', 10);
        $pdf->SetFillColor(255, 252, 230);
        $pdf->MultiCell(0, 6, $report['analyst_comments'], 1, 'L', true);
        $pdf->Ln(4);
        $pdf->SetDrawColor(0);
    }

    // Table based on section
    if($section === 'performance'){
        $headers = ['URL', 'Avg Load', 'Min Load', 'Max Load', 'Avg TTFB', 'Avg DOM', 'Samples'];
        $widths  = [55, 20, 20, 20, 20, 20, 18];
        $rows    = $snapshot['byPage'] ?? [];

        $pdf->SetFont('Arial', 'B', 9);
        $pdf->SetFillColor(30, 60, 114);
        $pdf->SetTextColor(255, 255, 255);
        foreach($headers as $i => $h){
            $pdf->Cell($widths[$i], 8, $h, 1, 0, 'C', true);
        }
        $pdf->Ln();
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFont('Arial', '', 8);
        $fill = false;
        foreach($rows as $row){
            $pdf->SetFillColor($fill ? 240 : 255, $fill ? 240 : 255, $fill ? 240 : 255);
            $vals = [
                substr($row['url'] ?? '', 0, 35),
                ($row['avg_load_ms'] ?? '—') . ' ms',
                ($row['min_load_ms'] ?? '—') . ' ms',
                ($row['max_load_ms'] ?? '—') . ' ms',
                ($row['avg_ttfb_ms'] ?? '—') . ' ms',
                ($row['avg_dom_ms']  ?? '—') . ' ms',
                $row['samples'] ?? '—'
            ];
            foreach($vals as $i => $val){
                $pdf->Cell($widths[$i], 7, $val, 1, 0, 'L', true);
            }
            $pdf->Ln();
            $fill = !$fill;
            if($pdf->GetY() > 260) $pdf->AddPage();
        }

    } else if($section === 'errors'){
        $headers = ['Type', 'Error Message', 'Occurrences', 'Sessions', 'Last Seen'];
        $widths  = [35, 75, 25, 25, 33];
        $rows    = $snapshot['byMessage'] ?? [];

        $pdf->SetFont('Arial', 'B', 9);
        $pdf->SetFillColor(30, 60, 114);
        $pdf->SetTextColor(255, 255, 255);
        foreach($headers as $i => $h){
            $pdf->Cell($widths[$i], 8, $h, 1, 0, 'C', true);
        }
        $pdf->Ln();
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFont('Arial', '', 8);
        $fill = false;
        foreach($rows as $row){
            $pdf->SetFillColor($fill ? 240 : 255, $fill ? 240 : 255, $fill ? 240 : 255);
            $vals = [
                $row['type'] ?? '—',
                substr($row['error_message'] ?? '', 0, 45),
                $row['occurrences'] ?? '—',
                $row['affected_sessions'] ?? '—',
                $row['last_seen'] ?? '—'
            ];
            foreach($vals as $i => $val){
                $pdf->Cell($widths[$i], 7, $val, 1, 0, 'L', true);
            }
            $pdf->Ln();
            $fill = !$fill;
            if($pdf->GetY() > 260) $pdf->AddPage();
        }

    } else if($section === 'behavioral'){
        $headers = ['URL', 'Total', 'Clicks', 'Scrolls', 'Keydowns', 'Idles'];
        $widths  = [70, 22, 22, 22, 22, 22];
        $rows    = $snapshot['byPage'] ?? [];

        $pdf->SetFont('Arial', 'B', 9);
        $pdf->SetFillColor(30, 60, 114);
        $pdf->SetTextColor(255, 255, 255);
        foreach($headers as $i => $h){
            $pdf->Cell($widths[$i], 8, $h, 1, 0, 'C', true);
        }
        $pdf->Ln();
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFont('Arial', '', 8);
        $fill = false;
        foreach($rows as $row){
            $pdf->SetFillColor($fill ? 240 : 255, $fill ? 240 : 255, $fill ? 240 : 255);
            $vals = [
                substr($row['url'] ?? '', 0, 45),
                $row['total_interactions'] ?? '—',
                $row['clicks']   ?? 0,
                $row['scrolls']  ?? 0,
                $row['keydowns'] ?? 0,
                $row['idles']    ?? 0
            ];
            foreach($vals as $i => $val){
                $pdf->Cell($widths[$i], 7, $val, 1, 0, 'L', true);
            }
            $pdf->Ln();
            $fill = !$fill;
            if($pdf->GetY() > 260) $pdf->AddPage();
        }
    }

    // Save file
    $filename = 'report-' . $m[1] . '-' . date('Ymd-His') . '.pdf';
    $filepath = __DIR__ . '/exports/' . $filename;
    $pdf->Output('F', $filepath);

    jsonResponse(['success' => true, 'url' => '/exports/' . $filename]);
}




// Getting report section 
if($method === 'GET' && $path === '/api/reports'){
    requireAuth();
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $stmt = $pdo->prepare('
        SELECT r.id, r.name, r.section, r.analyst_comments, r.created_at, u.display_name AS created_by
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        ORDER BY r.created_at DESC
    ');
    $stmt->execute();
    jsonResponse(['success' => true, 'reports' => $stmt->fetchAll()]);
}

// Getting a report
if($method === 'GET' && preg_match('#^/api/reports/(\d+)$#', $path, $m)){
    requireAuth();
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $stmt = $pdo->prepare('
        SELECT r.*, u.display_name AS created_by
        FROM reports r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = :id
    ');
    $stmt->execute([':id' => $m[1]]);
    $report = $stmt->fetch();
    if(!$report){
        jsonResponse(['success' => false, 'error' => 'Report not found'], 404);
    }
    $report['snapshot'] = json_decode($report['snapshot'], true);
    jsonResponse(['success' => true, 'report' => $report]);
}

// Deleting a report
if($method === 'DELETE' && preg_match('#^/api/reports/(\d+)$#', $path, $m)){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] === 'viewer'){
        jsonResponse(['success' => false, 'error' => 'Analyst or Admin Access required'], 403);
    }
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $stmt = $pdo->prepare('DELETE FROM reports WHERE id = :id');
    $stmt->execute([':id' => $m[1]]);
    jsonResponse(['success' => true]);
}

// Creating a report
if($method === 'POST' && $path === '/api/reports'){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] === 'viewer'){
        jsonResponse(['success' => false, 'error' => 'Analyst or Admin Access required'], 403);
    }

    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $name     = $data['name']             ?? '';
    $section  = $data['section']          ?? '';
    $comments = $data['analyst_comments'] ?? '';
    $start    = $data['start']            ?? date('Y-m-d', strtotime('-7 days'));
    $end      = $data['end']              ?? date('Y-m-d');

    // Run the query to snapshot current data
    if($section === 'performance'){
        $stmt = $pdo->prepare('
            SELECT
                url,
                COUNT(*)                                                                AS samples,
                ROUND(AVG(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS avg_load_ms,
                ROUND(MIN(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS min_load_ms,
                ROUND(MAX(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS max_load_ms,
                ROUND(AVG(
                    JSON_EXTRACT(payload, "$.timingObject.responseStart") -
                    JSON_EXTRACT(payload, "$.timingObject.requestStart")
                ))                                                                     AS avg_ttfb_ms,
                ROUND(AVG(
                    JSON_EXTRACT(payload, "$.timingObject.domContentLoadedEventEnd") -
                    JSON_EXTRACT(payload, "$.timingObject.startTime")
                ))                                                                     AS avg_dom_ms
            FROM pageviews
            WHERE type = "performance"
              AND JSON_EXTRACT(payload, "$.totalLoadTime") IS NOT NULL
              AND DATE(client_timestamp) BETWEEN :start AND :end
            GROUP BY url
            ORDER BY avg_load_ms DESC
            LIMIT 50
        ');
        $stmt->execute([':start' => $start, ':end' => $end]);
        $snapshot = [
            'meta'   => ['start' => $start, 'end' => $end],
            'byPage' => $stmt->fetchAll()
        ];    
    } else if ($section === 'errors'){
        $stmt = $pdo->prepare('
            SELECT
                type,
                COALESCE(
                    JSON_UNQUOTE(JSON_EXTRACT(payload, "$.message")),
                    JSON_UNQUOTE(JSON_EXTRACT(payload, "$.src")),
                    "Unknown"
                )                                   AS error_message,
                COUNT(*)                            AS occurrences,
                MIN(client_timestamp)               AS first_seen,
                MAX(client_timestamp)               AS last_seen,
                COUNT(DISTINCT session_id)          AS affected_sessions,
                COUNT(DISTINCT url)                 AS affected_pages
            FROM pageviews
            WHERE type IN ("js-error", "promise-rejection-error", "resource-error")
            AND DATE(client_timestamp) BETWEEN :start AND :end
            GROUP BY type, error_message
            ORDER BY occurrences DESC
            LIMIT 50
        ');
        $stmt->execute([':start' => $start, ':end' => $end]);
        $snapshot = [
            'meta'      => ['start' => $start, 'end' => $end],
            'byMessage' => $stmt->fetchAll()
        ];
    } else if($section === 'behavioral'){
        $stmt = $pdo->prepare('
            SELECT
                url,
                COUNT(*) AS total_interactions,
                SUM(type = "click")     AS clicks,
                SUM(type = "scroll")    AS scrolls,
                SUM(type = "keydown")   AS keydowns,
                SUM(type = "idle")      AS idles
            FROM pageviews
            WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
            AND DATE(client_timestamp) BETWEEN :start AND :end
            GROUP BY url
            ORDER BY total_interactions DESC
            LIMIT 20
        ');
        $stmt->execute([':start' => $start, ':end' => $end]);
        $byPage = $stmt->fetchAll();
    
        // Save event breakdown
        $stmt2 = $pdo->prepare('
            SELECT type, COUNT(*) AS count
            FROM pageviews
            WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
            AND DATE(client_timestamp) BETWEEN :start AND :end
            GROUP BY type
            ORDER BY count DESC
        ');
        $stmt2->execute([':start' => $start, ':end' => $end]);
        $eventBreakdown = $stmt2->fetchAll();

        $snapshot = [
            'meta'           => ['start' => $start, 'end' => $end],
            'byPage'         => $byPage,
            'eventBreakdown' => $eventBreakdown
        ];
    } else{
        jsonResponse(['success' => false, 'error' => 'Unknown section'], 400);
    }

    $stmt = $pdo->prepare('
        INSERT INTO reports (name, section, snapshot, analyst_comments, created_by)
        VALUES (:name, :section, :snapshot, :comments, :created_by)
    ');
    $stmt->execute([
        ':name'       => $name,
        ':section'    => $section,
        ':snapshot'   => json_encode($snapshot),
        ':comments'   => $comments,
        ':created_by' => $user['id']
    ]);

    jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
}

// Getting performance data
if($method === 'GET' && $path === '/api/performance'){
    requireAuth();
    checkUser('performance');
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));
    $end   = $_GET['end']   ?? date('Y-m-d');

    // Aggregated per page
    $stmt = $pdo->prepare('
        SELECT
            url,
            COUNT(*)                                                                AS samples,
            ROUND(AVG(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS avg_load_ms,
            ROUND(MIN(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS min_load_ms,
            ROUND(MAX(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS max_load_ms,
            ROUND(AVG(
                JSON_EXTRACT(payload, "$.timingObject.responseStart") -
                JSON_EXTRACT(payload, "$.timingObject.requestStart")
            ))                                                                     AS avg_ttfb_ms,
            ROUND(AVG(
                JSON_EXTRACT(payload, "$.timingObject.domContentLoadedEventEnd") -
                JSON_EXTRACT(payload, "$.timingObject.startTime")
            ))                                                                     AS avg_dom_ms
        FROM pageviews
        WHERE type = "performance"
          AND DATE(client_timestamp) BETWEEN :start AND :end
          AND JSON_EXTRACT(payload, "$.totalLoadTime") IS NOT NULL
        GROUP BY url
        ORDER BY avg_load_ms DESC
        LIMIT 50
    ');
    $stmt->execute([':start' => $start, ':end' => $end]);
    $byPage = $stmt->fetchAll();

    // Daily trend
    $stmt2 = $pdo->prepare('
        SELECT
            DATE(client_timestamp)                                                 AS date,
            ROUND(AVG(JSON_EXTRACT(payload, "$.totalLoadTime")))                   AS avg_load_ms,
            ROUND(AVG(
                JSON_EXTRACT(payload, "$.timingObject.responseStart") -
                JSON_EXTRACT(payload, "$.timingObject.requestStart")
            ))                                                                     AS avg_ttfb_ms,
            COUNT(*)                                                               AS samples
        FROM pageviews
        WHERE type = "performance"
          AND DATE(client_timestamp) BETWEEN :start AND :end
          AND JSON_EXTRACT(payload, "$.totalLoadTime") IS NOT NULL
        GROUP BY DATE(client_timestamp)
        ORDER BY date ASC
    ');
    $stmt2->execute([':start' => $start, ':end' => $end]);
    $trend = $stmt2->fetchAll();

    jsonResponse(['success' => true, 'data' => ['byPage' => $byPage, 'trend' => $trend]]);
}

// Getting error data
if($method === 'GET' && $path === '/api/errors'){
    requireAuth();
    checkUser('errors');

    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));
    $end = $_GET['end'] ?? date('Y-m-d');

    // Aggregated by error message
    $stmt = $pdo->prepare('
        SELECT
            type,
            COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(payload, "$.message")),
                JSON_UNQUOTE(JSON_EXTRACT(payload, "$.src")),
                "Unknown"
            )                                   AS error_message,
            COUNT(*)                            AS occurrences,
            MIN(client_timestamp)               AS first_seen,
            MAX(client_timestamp)               AS last_seen,
            COUNT(DISTINCT session_id)          AS affected_sessions,
            COUNT(DISTINCT url)                 AS affected_pages
        FROM pageviews
        WHERE type IN ("js-error", "promise-rejection-error", "resource-error")
          AND DATE(client_timestamp) BETWEEN :start AND :end
        GROUP BY type, error_message
        ORDER BY occurrences DESC
        LIMIT 50
    ');
    $stmt->execute([':start' => $start, ':end' => $end]);
    $byMessage = $stmt->fetchAll();

    // Daily trend
    $stmt2 = $pdo->prepare('
        SELECT
            DATE(client_timestamp)  AS date,
            COUNT(*)                AS error_count
        FROM pageviews
        WHERE type IN ("js-error", "promise-rejection-error", "resource-error")
          AND DATE(client_timestamp) BETWEEN :start AND :end
        GROUP BY DATE(client_timestamp)
        ORDER BY date ASC
    ');
    $stmt2->execute([':start' => $start, ':end' => $end]);
    $trend = $stmt2->fetchAll();

    jsonResponse(['success' => true, 'data' => ['byMessage' => $byMessage, 'trend' => $trend]]);
}

// Getting Behavioral Data
if($method === 'GET' && $path === '/api/behavioral'){
    requireAuth();
    checkUser('behavioral');

    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    $start = $_GET['start'] ?? date('Y-m-d', strtotime('-7 days'));
    $end = $_GET['end'] ?? date('Y-m-d');

    // Getting type breakdown (for doughnut chart)
    $stmt = $pdo->prepare('
        SELECT
            type,
            COUNT(*) AS count
        FROM pageviews
        WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
          AND DATE(client_timestamp) BETWEEN :start AND :end
        GROUP BY type
        ORDER BY count DESC
    ');
    $stmt->execute([':start' => $start, ':end' => $end]);
    $eventBreakdown = $stmt->fetchAll();

    // Interactions per page (for bar chart)
    $stmt2 = $pdo->prepare('
        SELECT
            url,
            COUNT(*) AS total_interactions,
            SUM(type = "click")     AS clicks,
            SUM(type = "scroll")    AS scrolls,
            SUM(type = "keydown")   AS keydowns,
            SUM(type = "idle")      AS idles
        FROM pageviews
        WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
          AND DATE(client_timestamp) BETWEEN :start AND :end
        GROUP BY url
        ORDER BY total_interactions DESC
        LIMIT 20
    ');
    $stmt2->execute([':start' => $start, ':end' => $end]);
    $byPage = $stmt2->fetchAll();

    // Daily trend
    $stmt3 = $pdo->prepare('
        SELECT
            DATE(client_timestamp) AS date,
            COUNT(*) AS total_interactions
        FROM pageviews
        WHERE type IN ("click", "scroll", "idle", "mousemove", "keydown", "keyup")
          AND DATE(client_timestamp) BETWEEN :start AND :end
        GROUP BY DATE(client_timestamp)
        ORDER BY date ASC
    ');
    $stmt3->execute([':start' => $start, ':end' => $end]);
    $trend = $stmt3->fetchAll();

    jsonResponse(['success' => true, 'data' => [
        'eventBreakdown' => $eventBreakdown,
        'byPage'         => $byPage,
        'trend'          => $trend
    ]]);
}

// Accessing Admin Panel
if($method === 'GET' && $path === '/api/admin'){
    requireAuth();
    $user = $_SESSION['user'];
    if (($user['role'] ?? '') !== 'super_admin') {
        jsonResponse(['success' => false, 'error' => 'Admin Access Required'], 403);
    }
    jsonResponse(['success' => true, 'data' => $user]);
}

// GET all users
if($method === 'GET' && $path === '/api/users'){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] !== 'super_admin'){
        jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $stmt = $pdo->query('
        SELECT id, username, display_name, role, created_at, last_login
        FROM users ORDER BY created_at
    ');
    $users = $stmt->fetchAll();

    // Fetch allowed sections for each user
    foreach($users as &$u){
        $stmt2 = $pdo->prepare('
            SELECT s.name FROM user_sections us
            JOIN sections s ON us.section_id = s.id
            WHERE us.user_id = :id
        ');
        $stmt2->execute([':id' => $u['id']]);
        $u['allowed_sections'] = $stmt2->fetchAll(PDO::FETCH_COLUMN);
    }
    jsonResponse(['success' => true, 'users' => $users]);
}

// POST create user
if($method === 'POST' && $path === '/api/users'){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] !== 'super_admin'){
        jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $username        = $data['username']         ?? '';
    $display_name    = $data['display_name']      ?? '';
    $password        = $data['password']          ?? '';
    $role            = $data['role']              ?? 'viewer';
    $allowed_sections = $data['allowed_sections'] ?? [];

    $validRoles = ['super_admin', 'analyst', 'viewer'];
    if(!in_array($role, $validRoles)) $role = 'viewer';

    $hash = password_hash($password, PASSWORD_BCRYPT);

    try{
        $stmt = $pdo->prepare('
            INSERT INTO users (username, display_name, password_hash, role)
            VALUES (:username, :display_name, :hash, :role)
        ');
        $stmt->execute([
            ':username'     => $username,
            ':display_name' => $display_name,
            ':hash'         => $hash,
            ':role'         => $role
        ]);
        $newId = $pdo->lastInsertId();

        // Insert allowed sections if analyst
        if($role === 'analyst' && !empty($allowed_sections)){
            foreach($allowed_sections as $section){
                $stmt2 = $pdo->prepare('
                    INSERT INTO user_sections (user_id, section_id)
                    SELECT :user_id, id FROM sections WHERE name = :name
                ');
                $stmt2->execute([':user_id' => $newId, ':name' => $section]);
            }
        }

        jsonResponse(['success' => true, 'id' => $newId]);
    } catch(PDOException $e){
        if($e->getCode() === '23000'){
            jsonResponse(['success' => false, 'error' => 'Username already exists'], 409);
        }
        throw $e;
    }
}

// PUT update user
if($method === 'PUT' && preg_match('#^/api/users/(\d+)$#', $path, $m)){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] !== 'super_admin'){
        jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $targetId = $m[1];
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
    $stmt->execute([':id' => $targetId]);
    $target = $stmt->fetch();
    if(!$target) jsonResponse(['success' => false, 'error' => 'User not found'], 404);

    $display_name     = $data['display_name']     ?? $target['display_name'];
    $role             = $data['role']              ?? $target['role'];
    $allowed_sections = $data['allowed_sections']  ?? null;
    $validRoles       = ['super_admin', 'analyst', 'viewer'];
    if(!in_array($role, $validRoles)) $role = $target['role'];

    $stmt = $pdo->prepare('
        UPDATE users SET display_name = :display_name, role = :role WHERE id = :id
    ');
    $stmt->execute([':display_name' => $display_name, ':role' => $role, ':id' => $targetId]);

    // Update allowed sections if analyst and sections provided
    if($role === 'analyst' && $allowed_sections !== null){
        // Delete existing sections
        $stmt2 = $pdo->prepare('DELETE FROM user_sections WHERE user_id = :id');
        $stmt2->execute([':id' => $targetId]);
        // Insert new ones
        foreach($allowed_sections as $section){
            $stmt3 = $pdo->prepare('
                INSERT INTO user_sections (user_id, section_id)
                SELECT :user_id, id FROM sections WHERE name = :name
            ');
            $stmt3->execute([':user_id' => $targetId, ':name' => $section]);
        }
    }

    jsonResponse(['success' => true]);
}

// DELETE user
if($method === 'DELETE' && preg_match('#^/api/users/(\d+)$#', $path, $m)){
    requireAuth();
    $user = $_SESSION['user'];
    if($user['role'] !== 'super_admin'){
        jsonResponse(['success' => false, 'error' => 'Admin access required'], 403);
    }

    $targetId = $m[1];

    // Prevent self deletion
    if($targetId == $user['id']){
        jsonResponse(['success' => false, 'error' => 'Cannot delete your own account'], 400);
    }

    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = :id');
    $stmt->execute([':id' => $targetId]);
    $target = $stmt->fetch();
    if(!$target) jsonResponse(['success' => false, 'error' => 'User not found'], 404);

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
    $stmt->execute([':id' => $targetId]);
    jsonResponse(['success' => true]);
}

// Loging in
if($method === 'POST' && $path === '/api/login'){
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    try{
        $pdo = new PDO($dsn, $dbuser, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        $user = authenticate($pdo, $username, $password);
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        jsonResponse(['success' => true, 'data' => $user]);
    } catch(PDOException $e){
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Accessing Dashboard
if($method === 'GET' && $path === '/api/dashboard'){
    requireAuth();
    $user = $_SESSION['user'];
    // $username = $user['username'];
    // var_dump($_SESSION['user']);
    jsonResponse(['success' => true, 'data' => $user]);
}

// Logging out
if($method === 'POST' && $path === '/api/logout'){
    session_destroy();
    jsonResponse(['success' => true]);
}

// Parse request
$path = $_SERVER['PATH_INFO'] ?? '/';
error_log('PATH_INFO: ' . $path);
error_log('REQUEST_URI: ' . $_SERVER['REQUEST_URI']);
$parts = explode('/', trim($path, '/'));
$resource = $parts[0] ?? '';
$id = isset($parts[1]) && $parts[1] !== '' ? (int)$parts[1] : null;

// Only handle /pageviews routes
if($resource !== 'pageviews'){
    http_response_code(404);
    echo json_encode(['error' => 'Not Found']);
    exit;
}

try{
    // Creating connection with options
    $pdo = new PDO($dsn, $dbuser, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    // Route by method
    switch($method){
        case 'GET': 
            if($id === null){
                $stmt = $pdo->query('SELECT * FROM pageviews ORDER BY id DESC');
                $pageviews = $stmt->fetchAll();
                echo json_encode($pageviews);
            }
            else{
                $stmt = $pdo->prepare('SELECT * FROM pageviews WHERE id = :id');
                $stmt->execute([':id' => $id]);
                $pageview = $stmt->fetch();
                if(!$pageview){
                    http_response_code(404);
                    echo json_encode(['error' => 'Pageview not found']);
                    exit;
                }
                echo json_encode($pageview);
            }
            break;
        case 'POST' : 
            // Reject invalid data
            if(!$data || empty($data['url'])){
                http_response_code(400);
                echo json_encode(['error' => 'Invalid json']);
                exit;
            }
            $type = $data['type'] ?? null;
            if(!in_array($type, $allowed_types)){
                http_response_code(400);
                echo json_encode(['error' => 'Invalid type']);
                exit;
            }

            // Creating new data
            $stmt =$pdo->prepare(
                'INSERT INTO pageviews (url, type, user_agent, viewport_width,
                viewport_height, referrer, client_timestamp, server_timestamp,
                client_ip, session_id, payload)
                VALUES (:url, :type, :user_agent, :viewport_width, :viewport_height,
                :referrer, :client_timestamp, :server_timestamp, :client_ip,
                :session_id, :payload)'
            );
            $stmt->execute([
                ':url'              => substr($data['url'] ?? '', 0, 2048),
                ':type'             => $type,
                ':user_agent'       => substr($data['user_agent'] ?? '', 0, 512),
                ':viewport_width'   => isset($data['viewport_width']) ? (int)$data['viewport_width'] : null,
                ':viewport_height'  => isset($data['viewport_height']) ? (int)$data['viewport_height'] : null,
                ':referrer'         => substr($data['referrer'] ?? '', 0, 2048),
                ':client_timestamp' => !empty($data['client_timestamp']) ? date('Y-m-d H:i:s', strtotime($data['client_timestamp'])) : null,        
                ':server_timestamp' => date('Y-m-d H:i:s'),
                ':client_ip'        => $_SERVER['REMOTE_ADDR'] ?? '',
                ':session_id'       => substr($data['session_id'] ?? '', 0, 64),
                ':payload'          => isset($data['payload']) ? json_encode($data['payload']) : null
            ]);

            // Returning the new data inputted
            $id = $pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT * FROM pageviews WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $newPageview = $stmt->fetch();
            echo json_encode($newPageview);
            break;
        case 'PUT' : 
            // Reject invalid data
            if(!$data || empty($data['url'])){
                http_response_code(400);
                echo json_encode(['error' => 'Invalid json']);
                exit;
            }
            // First checking if this id exists
            $stmt = $pdo->prepare('SELECT * FROM pageviews WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $existing = $stmt->fetch();
            if(!$existing){
                http_response_code(404);
                echo json_encode(['error' => 'Pageview not found']);
                exit;
            }

            // MERGE: Use submitted values, fallback to existing values
            $url = $data['url']                           ?? $existing['url'];
            $type = $data['type']                         ?? $existing['type'];
            if(!in_array($type, $allowed_types)){
                http_response_code(400);
                echo json_encode(['error' => 'Invalid type']);
                exit;
            }
            $user_agent = $data['user_agent']             ?? $existing['user_agent'];
            $viewport_width = $data['viewport_width']     ?? $existing['viewport_width'];
            $viewport_height = $data['viewport_height']   ?? $existing['viewport_height'];
            $referrer = $data['referrer']                 ?? $existing['referrer'];
            $client_timestamp = $data['client_timestamp'] ?? $existing['client_timestamp'];
            $server_timestamp = $data['server_timestamp'] ?? $existing['server_timestamp'];
            $client_ip = $data['client_ip']               ?? $existing['client_ip'];
            $session_id = $data['session_id']             ?? $existing['session_id'];
            $payload = $data['payload']                   ?? $existing['payload'];

            // Update data based on id
            $stmt = $pdo->prepare(
                'UPDATE pageviews
                SET url = :url, type = :type, user_agent = :user_agent, viewport_width = :viewport_width,
                viewport_height = :viewport_height, referrer = :referrer, client_timestamp = :client_timestamp,
                server_timestamp = :server_timestamp, client_ip = :client_ip, session_id = :session_id,
                payload = :payload
                WHERE id = :id'
            );
            $stmt->execute([
                ':url'              => substr($url, 0, 2048),
                ':type'             => $type,
                ':user_agent'       => substr($user_agent, 0, 512),
                ':viewport_width'   => isset($viewport_width) ? (int)$viewport_width : null,
                ':viewport_height'  => isset($viewport_height) ? (int)$viewport_height : null,
                ':referrer'         => substr($referrer, 0, 2048),
                ':client_timestamp' => !empty($client_timestamp) ? date('Y-m-d H:i:s', strtotime($client_timestamp)) : null,        
                ':server_timestamp' => $server_timestamp,
                ':client_ip'        => $client_ip,
                ':session_id'       => substr($session_id, 0, 64),
                ':payload'          => isset($payload) ? json_encode($payload) : null,
                ':id'               => $id
            ]);

            // Return updated data
            $stmt = $pdo->prepare('SELECT * FROM pageviews WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $updated = $stmt->fetch();
            echo json_encode($updated);
            break;
        case 'DELETE' : 
            // First checking if this id exists
            $stmt = $pdo->prepare('SELECT * FROM pageviews WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $deleted = $stmt->fetch();

            if(!$deleted){
                http_response_code(404);
                echo json_encode(['error' => 'Pageview not found']);
                exit;
            }

            $stmt = $pdo->prepare('DELETE FROM pageviews WHERE id = :id');
            $stmt->execute([':id' => $id]);
            echo json_encode(['message' => 'Pageview deleted', 'pageview' => $deleted]);
            break;
        default: 
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch(PDOException $e){
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}

?>
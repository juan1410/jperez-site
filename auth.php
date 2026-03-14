<?php

// JSON helper function
function jsonResponse($data, int $status = 200): void{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Helper function for protected routes
function requireAuth(): void{
    if(empty($_SESSION['user'])){
        jsonResponse(['success' => false, 'error' => 'Authentication required'], 401);
    }
}

// Helper function to fetch the allowed sections for an analyst
function fetchAllowedSections($user, $pdo){
    $stmt = $pdo->prepare('
        SELECT s.name
        FROM user_sections us
        JOIN sections s ON us.section_id = s.id
        WHERE us.user_id = :id
    ');
    $stmt->execute([':id' => $user['id']]);
    $sections = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $user['allowed_sections'] = $sections;
    return $user;
}

// Helper function to authenticate login credentials
function authenticate($pdo, $username, $password){
    $stmt = $pdo->prepare(
        'SELECT id, username, password_hash, display_name, role FROM users where username = ?'
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if(!$user || !password_verify($password, $user['password_hash'])){
        jsonResponse(['success' => false, 'error' => 'Invalid Credentials'], 401);
    }
    if($user['role'] === 'analyst'){
        $user = fetchAllowedSections($user, $pdo);
    }
    return $user;
}

// Helper function to authenticate certain endpoints analysts or admins can access
function checkUser($endpoint){
    $user = $_SESSION['user'] ?? '';
    $role = $user['role'] ?? '';
    if($role === 'viewer'){
        jsonResponse(['success' => false, 'error' => 'Analyst or Admin Access Required'], 403);
    }
    else if ($role === 'analyst'){
        if(!in_array($endpoint, $user['allowed_sections'])){
            jsonResponse(['success' => false, 'error' => $endpoint . ' Access Required'], 403);
        }
    }
}
?>
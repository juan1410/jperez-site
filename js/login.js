const form = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try{
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({username, password})
        });

        const data = await res.json();

        if(res.ok && data.success){
            window.location.href = '/dashboard.html';
        } else{
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.hidden = false;
        }
    } catch(err){
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.hidden = false;
    }
});
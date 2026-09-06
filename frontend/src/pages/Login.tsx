const API_BASE = 'http://localhost:8000'

function Login() {
  const handleLogin = () => {
    // Full page navigation, not fetch — the OAuth redirect chain and
    // Set-Cookie happen outside of CORS/JS entirely.
    window.location.href = `${API_BASE}/auth/login`
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Revue</h1>
      <p>An autonomous GitHub PR review agent with persistent memory.</p>
      <button onClick={handleLogin}>Login with GitHub</button>
    </div>
  )
}

export default Login

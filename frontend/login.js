document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(e.target);
    const user = {
        username: data.get("username"),
        password: data.get("password")
    };

    try {
        const resp = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });

        const result = await resp.json();

        if (!resp.ok) {
            alert(result.message || "Invalid username or password");
            return;
        }

        // Save token (optional but recommended)
        if (result.token) {
            localStorage.setItem("token", result.token);
        }

        // ⭐ REDIRECT TO HOME PAGE
        window.location.href = "index.html";

    } catch (err) {
        console.error("Login failed:", err);
        alert("Network error. Is the backend running?");
    }
});

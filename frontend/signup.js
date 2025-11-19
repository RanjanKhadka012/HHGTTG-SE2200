document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(e.target);

    const newUser = {
        name: data.get("name"),
        email: data.get("email"),
        username: data.get("username"),
        password: data.get("password")
    };

    try {
        const resp = await fetch("http://localhost:3000/api/auth/signup", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(newUser)
        });

        let result = null;
        try {
            result = await resp.json();
        } catch (e) {
            // backend returned plain text or HTML
        }

        if (!resp.ok) {
            console.error("Signup error status:", resp.status, "body:", result);

            // More specific messages based on status code
            if (resp.status === 409) {
                alert(result?.message || "Username already taken.");
            } else if (resp.status === 400) {
                alert(result?.message || "Bad signup data. Check required fields.");
            } else if (resp.status === 404) {
                alert("Signup endpoint not found. Check the URL /api/auth/signup.");
            } else {
                alert(result?.message || `Signup failed with status ${resp.status}.`);
            }
            return;
        }

        alert("Account created! You can now log in.");
        window.location.href = "login.html";
    } catch (err) {
        console.error("Network or CORS error:", err);
        alert("Sign-up failed (network/backend error). Check if the backend is running.");
    }
});

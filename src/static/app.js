document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const teacherOnlyNote = document.getElementById("teacher-only-note");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const userButton = document.getElementById("user-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginButton = document.getElementById("close-login");

  let isTeacher = false;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function renderAuthState() {
    if (isTeacher) {
      authStatus.textContent = "Teacher View";
      userButton.textContent = "Logout";
      userButton.classList.add("logged-in");
      signupForm.classList.remove("hidden");
      teacherOnlyNote.classList.add("hidden");
      signupContainer.querySelector("h3").textContent = "Sign Up for an Activity";
    } else {
      authStatus.textContent = "Student View";
      userButton.textContent = "👤";
      userButton.classList.remove("logged-in");
      signupForm.classList.add("hidden");
      teacherOnlyNote.classList.remove("hidden");
      signupContainer.querySelector("h3").textContent = "Teacher Actions";
    }
  }

  async function syncAuthState() {
    try {
      const response = await fetch("/auth/me");
      const auth = await response.json();
      isTeacher = Boolean(auth.is_teacher);
      renderAuthState();
    } catch (error) {
      isTeacher = false;
      renderAuthState();
      console.error("Error checking auth state:", error);
    }
  }

  async function loginTeacher(username, password) {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || "Invalid credentials");
    }

    isTeacher = true;
    renderAuthState();
    return result;
  }

  async function logoutTeacher() {
    const response = await fetch("/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to logout");
    }

    isTeacher = false;
    renderAuthState();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      if (isTeacher) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacher) {
      showMessage("Only teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacher) {
      showMessage("Only teachers can register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userButton.addEventListener("click", async () => {
    if (isTeacher) {
      try {
        await logoutTeacher();
        await fetchActivities();
        showMessage("Logged out successfully.", "success");
      } catch (error) {
        showMessage("Failed to logout.", "error");
      }
      return;
    }

    loginModal.classList.remove("hidden");
  });

  closeLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      await loginTeacher(username, password);
      loginModal.classList.add("hidden");
      loginForm.reset();
      await fetchActivities();
      showMessage("Teacher login successful.", "success");
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  // Initialize app
  syncAuthState().then(fetchActivities);
});

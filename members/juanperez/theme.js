const toggleButton = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    toggleButton.checked = true; 
} else {
    document.documentElement.setAttribute("data-theme", "dark");
    toggleButton.checked = false; 
}

toggleButton.addEventListener("change", () => {
    if (toggleButton.checked) {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    }
});

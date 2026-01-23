document.getElementById("create-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const projects = JSON.parse(localStorage.getItem("project-cards")) || [];

    projects.push({
        title: document.getElementById("create-title").value,
        image: document.getElementById("create-image").value,
        alt: document.getElementById("create-alt").value,
        description: document.getElementById("create-description").value,
        link: document.getElementById("create-link").value
    });

    localStorage.setItem("project-cards", JSON.stringify(projects));
    alert("Project created! Reload Projects page to see it.");
});

document.getElementById("update-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const index = parseInt(document.getElementById("update-index").value, 10);
    const projects = JSON.parse(localStorage.getItem("project-cards")) || [];

    if (!projects[index]){
        return alert("No project at that index!");
    }

    if (document.getElementById("update-title").value) {ho
        projects[index].title = document.getElementById("update-title").value;
    }
    if (document.getElementById("update-image").value) {
        projects[index].image = document.getElementById("update-image").value;
    }
    if (document.getElementById("update-alt").value) {
        projects[index].alt = document.getElementById("update-alt").value;
    }
    if (document.getElementById("update-description").value) {
        projects[index].description = document.getElementById("update-description").value;
    }
    if (document.getElementById("update-link").value) {
        projects[index].link = document.getElementById("update-link").value;
    }

    localStorage.setItem("project-cards", JSON.stringify(projects));
    alert("Project updated! Reload Projects page to see changes.");
});

document.getElementById("delete-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const index = parseInt(document.getElementById("delete-index").value, 10);
    const projects = JSON.parse(localStorage.getItem("project-cards")) || [];

    if (!projects[index]){
        return alert("No project at this index!");
    }

    projects.splice(index, 1);
    localStorage.setItem("project-cards", JSON.stringify(projects));

    alert("Project deleted! Reload Projects page to see changes.");
});

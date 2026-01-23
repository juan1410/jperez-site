const localData = [
    {
        "title": "Portfolio Website",
        "image": "about-image1.JPG",
        "alt": "Profile preview",
        "description": "A responsive web portfolio I built myself using HTML, CSS, and JS.",
        "link": "https://hw5-site.pages.dev/"
    },
    {
        "title": "Smart Door Watch",
        "image": "smartwatch.JPG",
        "alt": "Smart Door Project previe",
        "description": "A prototype using a Raspberry Pi and Galaxy Watch to unlock a servo-controlled door (Currently in Progress).",
        "link": "https://github.com/jar04/UCSD-CSE-118-Team-8"
    }
];
if (!localStorage.getItem("project-cards")) {
    localStorage.setItem("project-cards", JSON.stringify(localData));
}

function showProjects(data) {
    const container = document.getElementById("project-cards");
    container.innerHTML = ""; 

    data.forEach(item => {
        const card = document.createElement("project-card");

        card.innerHTML = `
            <h2 slot="title">${item.title}</h2>

            <p slot="description">${item.description}</p>

            <picture slot="image">
                <img src="${item.image}" alt="${item.alt}">
            </picture>

            <a slot="link" href="${item.link}"></a>
        `;

        container.appendChild(card);
    });
}


document.getElementById("load-local").addEventListener("click", () => {
    const data = JSON.parse(localStorage.getItem("project-cards"));
    showProjects(data);
});


document.getElementById("load-remote").addEventListener("click", () => {
    fetch("https://my-json-server.typicode.com/juan1410/project-data/projects/")
        .then(res => res.json())
        .then(data => showProjects(data))
        .catch(err => console.error("Remote fetch error:", err));
});

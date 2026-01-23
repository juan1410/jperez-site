class ProjectCard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                .card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    background: var(--main-color);
                    border: 4px solid var(--second-color, lightblue);
                    border-radius: 12px;
                    margin: var(--main-padding, 0) 0 2rem;
                    padding: 0.5rem;
                    max-width: 400px;
                    // max-height: 380px;
                    transition: transform 0.2s, filter 0.2s;
                    text-decoration: none;
                }

                .card:hover {
                    background: var(--second-color);
                    transform: scale(1.05);
                }

                .card:hover ::slotted(h2),
                .card:hover ::slotted(p) {
                    color: var(--main-color) !important; /* test color */
                }

                @media screen and (max-width: 890px){
                    .card{
                        max-width: 450px;
                }

                @media screen and (max-width: 650px){
                    .card{
                        max-width: 300px;
                }

            </style>

            <a class="card" target="_blank">
                <slot name="image"></slot>
                <slot name="title"></slot>
                <slot name="description"></slot>
            </a>
        `;
    }

    connectedCallback() {
        const link = this.querySelector('[slot="link"]');
        const anchor = this.shadowRoot.querySelector('a');

        if (link) {
            anchor.href = link.getAttribute('href');
        }
    }
}

customElements.define('project-card', ProjectCard);



const nameField = document.querySelector("#name");
const emailField = document.querySelector("#email");
const commentsField = document.querySelector("#comments");

const errorOut = document.querySelector("#error-message");
const infoOut = document.querySelector("#info-message");
const form = document.querySelector(".contact-form");

function showError(msg) {
    errorOut.textContent = msg;
    errorOut.style.opacity = "1";

    setTimeout(() => {
        errorOut.style.opacity = "0";
    }, 2500);
}

function flashField(field) {
    field.style.backgroundColor = "#ffb3b3";
    setTimeout(() => {
        field.style.backgroundColor = "";
    }, 300);
}

nameField.addEventListener("input", () => {
    const allowed = /^[A-Za-z ]*$/;
    const currentChar = nameField.value.slice(-1);

    if (!allowed.test(nameField.value)) {
        showError(`Illegal character: "${currentChar}" (Only letters and spaces allowed)`);
        flashField(nameField);

        nameField.value = nameField.value.replace(/[^A-Za-z ]/g, "");
    }
});

let oldEmailValue = "";
emailField.addEventListener("input", () => {
    const newValue = emailField.value;
    const illegalChars = newValue.replace(/[A-Za-z0-9@._-]/g, "");

    if (illegalChars.length > 0) {
        const badChar = illegalChars[0];
        showError(`Illegal email character: "${badChar}".`);
        flashField(emailField);
        emailField.value = newValue.replace(/[^A-Za-z0-9@._-]/g, "");
    }
    oldEmailValue = emailField.value;
});


commentsField.addEventListener("input", () => {
    const remaining = commentsField.maxLength - commentsField.value.length;

    infoOut.textContent = `${remaining} characters remaining`;

    if (remaining <= 20 && remaining > 0) {
        infoOut.style.color = "orange";
    } else if (remaining === 0) {
        infoOut.style.color = '#FF474c';
    } else {
        infoOut.style.color = "";
    }

    if (commentsField.value.length > commentsField.maxLength) {
        commentsField.setCustomValidity("Too many characters.");
    } else {
        commentsField.setCustomValidity("");
    }
});

commentsField.addEventListener("focus", () => {
    infoOut.style.opacity = "1";
});

commentsField.addEventListener("blur", () => {
    infoOut.style.opacity = "0"; 
});

function validateName() {
    nameField.setCustomValidity("");  

    if (nameField.value.length > 0 && nameField.value[0] !== nameField.value[0].toUpperCase()) {
        nameField.setCustomValidity("Name must start with an uppercase letter.");
    } else if (nameField.value.length < nameField.minLength) {
        nameField.setCustomValidity("Name must be at least 3 characters long.");
    } else if(nameField.value.length > nameField.maxLength){
        nameField.setCustomValidity("Name must be less than 30 characeters long.")
    }
}

function validateEmail() {
    emailField.setCustomValidity("");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
    if (emailField.value.startsWith("@")) {
        emailField.setCustomValidity("Email cannot start with @.");
    } else if (!emailPattern.test(emailField.value)) {
        emailField.setCustomValidity("Please enter a valid email with a domain (e.g., example@gmail.com).");
    }
}

function validateComments() {
    commentsField.setCustomValidity("");

    if (commentsField.value.length < commentsField.minLength) {
        commentsField.setCustomValidity("Comments must be at least 5 characters long.");
    }
}

nameField.addEventListener("input", validateName);
emailField.addEventListener("input", validateEmail);
commentsField.addEventListener("input", validateComments);


let form_errors = []; 
form.addEventListener("submit", (e) => {
    validateName();
    validateEmail();
    validateComments();

    if (!form.checkValidity()) {
        e.preventDefault();
        if (!nameField.checkValidity()) {
        form_errors.push({
            field: "name",
            value: nameField.value,
            reason: nameField.validationMessage,
        });
        }
        if (!emailField.checkValidity()) {
        form_errors.push({
            field: "email",
            value: emailField.value,
            reason: emailField.validationMessage,
        });
        }
        if (!commentsField.checkValidity()) {
        form_errors.push({
            field: "comments",
            value: commentsField.value,
            reason: commentsField.validationMessage,
        });
        }

        showError("Please fix the red fields before submitting.");
        form.reportValidity();
        return;
    }

    const hidden = document.querySelector('#form-errors');
    hidden.value = JSON.stringify(form_errors);
});
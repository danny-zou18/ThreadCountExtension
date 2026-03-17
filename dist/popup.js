"use strict";
const button = document.getElementById("changeText");
const message = document.getElementById("message");
if (button && message) {
    button.addEventListener("click", () => {
        message.textContent = "It works with TypeScript!";
    });
}

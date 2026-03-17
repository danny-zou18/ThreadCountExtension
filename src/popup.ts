const button = document.getElementById("changeText") as HTMLButtonElement | null;
const message = document.getElementById("message") as HTMLParagraphElement | null;

if (button && message) {
  button.addEventListener("click", () => {
    message.textContent = "It works with TypeScript!";
  });
}
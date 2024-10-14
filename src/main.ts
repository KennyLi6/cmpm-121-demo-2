import "./style.css";

const APP_NAME = "Ensuring Deno is working as expected";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;
app.innerHTML = APP_NAME;

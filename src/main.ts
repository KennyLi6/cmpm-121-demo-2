import "./style.css";

const APP_NAME = "Drawer";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;

const header = document.createElement("h1");
header.innerHTML = APP_NAME;
app.append(header);

const canvasSize = 256;
const canvas = document.createElement("canvas");
canvas.width = canvas.height = canvasSize;
app.append(canvas);

const context = canvas.getContext('2d') as CanvasRenderingContext2D;
if (!context) { //check if context of canvas actually exists
    console.error("Context not found!");
}

const canvasColor = '#34BAEB'
context.fillStyle = canvasColor;
context.fillRect(0, 0, canvasSize, canvasSize);

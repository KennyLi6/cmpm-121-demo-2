import "./style.css";

const APP_NAME = "Drawer";
const app = document.querySelector<HTMLDivElement>("#app")!;

document.title = APP_NAME;

const header = document.createElement("h1");
header.innerHTML = APP_NAME;
app.append(header);

const canvas_size = 256;
const canvas = document.createElement("canvas");
canvas.width = canvas.height = canvas_size;
app.append(canvas);

const context = canvas.getContext('2d') as CanvasRenderingContext2D;
if (!context) { //check if context of canvas actually exists
    console.error("Context not found!");
}

const canvas_color = '#34BAEB'
context.fillStyle = canvas_color;
context.fillRect(0, 0, canvas_size, canvas_size);

let currently_drawing = false;

function startDrawing(event: MouseEvent) {
    currently_drawing = true;
    drawLine(event);
}

function drawLine(event: MouseEvent) {
    if (!currently_drawing) return;
    const canvas_bounds = canvas.getBoundingClientRect();
    const mouseX = event.clientX - canvas_bounds.left;
    const mouseY = event.clientY - canvas_bounds.top;

    context.lineTo(mouseX, mouseY);
    context.stroke();
}

function stopDrawing() {
    currently_drawing = false;
    context.beginPath();
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", drawLine)
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
// if we don't stop drawing when cursor leaves canvas, line will snap to next 
// spot user enters canvas from

app.append(document.createElement("div"));

const clear_button = document.createElement("button");
clear_button.innerHTML = "Clear canvas"
app.append(clear_button);

// might not need to have a function if user can't clear in other ways
function clearCanvas() {
    context.fillRect(0, 0, canvas_size, canvas_size);
}

clear_button.addEventListener("click", clearCanvas);
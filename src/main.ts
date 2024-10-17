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

interface Point {
    x: number;
    y: number;
    display(context: CanvasRenderingContext2D): void;
    drag(x: number, y: number): void;
}

function createPoint(x: number, y: number): Point {
    return {
        x,
        y,
        display(context) {
            context.lineTo(this.x, this.y);
        },
        drag(newX: number, newY: number) {
            this.x = newX;
            this.y = newY;
        }
    }
}

function drag(mouse: MouseEvent) {
    if (currently_drawing) return;

    const canvasBounds = canvas.getBoundingClientRect();
    const newX = mouse.clientX - canvasBounds.left;
    const newY = mouse.clientY - canvasBounds.top;

    current_points.pop();
    current_points.push(createPoint(newX, newY));

    trigger_drawing_changed();
}

let drawing_points: Point[][] = [];
let current_points: Point[] = [];

function startDrawing(event: MouseEvent) {
    currently_drawing = true;
    redo_stack = [];
    drawLine(event);
}

function drawLine(event: MouseEvent) {
    if (!currently_drawing) return;
    const canvas_bounds = canvas.getBoundingClientRect();
    const mouseX = event.clientX - canvas_bounds.left;
    const mouseY = event.clientY - canvas_bounds.top;
    current_points.push(createPoint(mouseX, mouseY));
    trigger_drawing_changed();
}

function trigger_drawing_changed() {
    canvas.dispatchEvent(new Event('drawing-changed'));
}

function drawLinesOnCanvas() {
    context.fillRect(0, 0, canvas_size, canvas_size);
    
    for (const session of drawing_points) {
        context.beginPath();
        context.moveTo(session[0].x, session[0].y);
        for (let i = 1; i < session.length; i++) {
            const point = session[i];
            point.display(context);
        }
        context.stroke();
        context.closePath();
    }

    if (currently_drawing) { //make sure to draw what is currently being drawn
        context.beginPath();
        context.moveTo(current_points[0].x, current_points[0].y);
        for (let i = 1; i < current_points.length; i++) {
            const point = current_points[i];
            point.display(context);
        }
        context.stroke();
        context.closePath();
    }
}

function stopDrawing() {
    currently_drawing = false;
    if (current_points.length <= 0) return; //check so that not push when mouse leaves canvas
    drawing_points.push(current_points);
    current_points = [];
}

canvas.addEventListener("drawing-changed", drawLinesOnCanvas); 
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", drawLine)
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
// if we don't stop drawing when cursor leaves canvas, line will snap to next 
// spot user enters canvas from

// div is only used to get the button to appear under the canvas
app.append(document.createElement("div"));

const clear_button = document.createElement("button");
clear_button.innerHTML = "Clear canvas"
app.append(clear_button);

// might not need to have a function if user can't clear in other ways
function clearCanvas() {
    context.fillRect(0, 0, canvas_size, canvas_size);
    drawing_points = [];
    redo_stack = [];
}

clear_button.addEventListener("click", clearCanvas);

const undo_button = document.createElement("button");
undo_button.innerHTML = "Undo"
app.append(undo_button);

function undo_command() {
    if (drawing_points.length <= 0) return;
    redo_stack.push(drawing_points.pop()!);
    trigger_drawing_changed();
}

undo_button.addEventListener("click", undo_command);

const redo_button = document.createElement('button');
redo_button.innerHTML = "Redo"
app.append(redo_button);

let redo_stack: Point[][] = [];

function redo_command() {
    if (redo_stack.length <= 0) return;
    drawing_points.push(redo_stack.pop()!);
    trigger_drawing_changed();
}

redo_button.addEventListener("click", redo_command);
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

const context = canvas.getContext("2d") as CanvasRenderingContext2D;
if (!context) {
  //check if context of canvas actually exists
  console.error("Context not found!");
}

const canvas_color = "#34BAEB";
context.fillStyle = canvas_color;
context.fillRect(0, 0, canvas_size, canvas_size);

let currently_drawing = false;

interface Point {
  x: number;
  y: number;
  display(context: CanvasRenderingContext2D): void;
  drag(x: number, y: number): void;
}

interface DrawingSession {
  points: Point[];
  lineWidth: number;
}

interface ButtonConfig {
  name: string;
  text: string;
  action: () => void;
}

const buttonsToMake: ButtonConfig[] = [
  {
    name: "clear_button",
    text: "Clear canvas",
    action: clearCanvas,
  },
  {
    name: "undo_button",
    text: "Undo",
    action: undo_command,
  },
  {
    name: "redo_button",
    text: "Redo",
    action: redo_command,
  },
  {
    name: "thin_button",
    text: "Thin",
    action: createThicknessChange(1),
  },
  {
    name: "thick_button",
    text: "Thick",
    action: createThicknessChange(5),
  },
];

// div is only used to get the button to appear under the canvas
app.append(document.createElement("div"));

for (let i = 0; i < buttonsToMake.length; i++) {
  const button = document.createElement("button");
  button.innerHTML = buttonsToMake[i].text;
  button.addEventListener("click", buttonsToMake[i].action);
  app.append(button);
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
    },
  };
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

let drawing_points: DrawingSession[] = [];
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
  canvas.dispatchEvent(new Event("drawing-changed"));
}

function drawLinesOnCanvas() {
  context.fillRect(0, 0, canvas_size, canvas_size);

  for (const session of drawing_points) {
    drawSession(session, context);
  }

  //make sure to draw what is currently being drawn
  if (currently_drawing) {
    drawSession(
      {
        points: current_points,
        lineWidth: context.lineWidth,
      },
      context
    );
  }
}

function drawSession(
  session: DrawingSession,
  context: CanvasRenderingContext2D
) {
  if (session.points.length === 0) return;

  context.save();
  context.lineWidth = session.lineWidth;
  context.beginPath();
  context.moveTo(session.points[0].x, session.points[0].y);
  for (let i = 1; i < session.points.length; i++) {
    const point = session.points[i];
    point.display(context);
  }
  context.stroke();
  context.closePath();
  context.restore();
}

function stopDrawing() {
  currently_drawing = false;
  if (current_points.length <= 0) return; //check so that not push when mouse leaves canvas
  drawing_points.push({
    points: current_points,
    lineWidth: context.lineWidth,
  });
  current_points = [];
}

canvas.addEventListener("drawing-changed", drawLinesOnCanvas);
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", drawLine);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
// if we don't stop drawing when cursor leaves canvas, line will snap to next
// spot user enters canvas from

// might not need to have a function if user can't clear in other ways
function clearCanvas() {
  context.fillRect(0, 0, canvas_size, canvas_size);
  drawing_points = [];
  redo_stack = [];
}

function undo_command() {
  if (drawing_points.length <= 0) return;
  const lastSession = drawing_points.pop();
  if (lastSession) {
    redo_stack.push(lastSession);
  }
  trigger_drawing_changed();
}

let redo_stack: DrawingSession[] = [];

function redo_command() {
  if (redo_stack.length <= 0) return;
  const lastSession = redo_stack.pop();
  if (lastSession) {
    drawing_points.push(lastSession);
  }
  trigger_drawing_changed();
}

function thicknessChange(value: number) {
  context.lineWidth = value;
  trigger_tool_moved();
}

function createThicknessChange(value: number): () => void {
  return () => thicknessChange(value);
}

const tool_moved = new CustomEvent("tool-moved", {
  detail: {
    cursorStyle: ".",
  },
});

function trigger_tool_moved() {
  document.dispatchEvent(tool_moved);
}

function changeToolStyle(event: Event) {
  const customEvent = event as CustomEvent<{ cursorStyle: string }>;
  const styleDetail = customEvent.detail;

  canvas.addEventListener("mousemove", (moveEvent) => {
    const canvasBounds = canvas.getBoundingClientRect();
    const mouseX = moveEvent.clientX - canvasBounds.left;
    const mouseY = moveEvent.clientY - canvasBounds.top;
    context.save();
    trigger_drawing_changed();
    document.body.style.cursor = "none";
    context.font = `25px Arial`;
    context.fillStyle = "black";
    context.fillText(styleDetail.cursorStyle, mouseX, mouseY);
    context.restore();
  });
}

function revertCursorStyle() {
  document.body.style.cursor = "default";
  trigger_drawing_changed();
}

canvas.addEventListener("mouseleave", revertCursorStyle);
canvas.addEventListener("mouseenter", trigger_tool_moved);
document.addEventListener("tool-moved", changeToolStyle);

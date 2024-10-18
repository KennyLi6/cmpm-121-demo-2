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

interface DrawingAction {
  type: "line" | "emoji";
  data: DrawingSession | EmojiPlacement;
}

interface EmojiPlacement {
  x: number;
  y: number;
  emoji: string;
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
    action: undoCommand,
  },
  {
    name: "redo_button",
    text: "Redo",
    action: redoCommand,
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
  {
    name: "emoji1_button",
    text: "🥴",
    action: createCursorChange("🥴"),
  },
  {
    name: "emoji2_button",
    text: "🥵",
    action: createCursorChange("🥵"),
  },
  {
    name: "emoji3_button",
    text: "🤕",
    action: createCursorChange("🤕"),
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

  triggerDrawingChanged();
}

let drawing_points: DrawingAction[] = [];
let current_points: Point[] = [];

let currentTool: "drawing" | "emoji" = "drawing";
let currentEmoji: string | null = null;

function startDrawing(event: MouseEvent) {
  if (currentTool !== "drawing") return;
  currently_drawing = true;
  redo_stack = [];
  drawLine(event);
}

interface EmojiPlacement {
  x: number;
  y: number;
  emoji: string;
}

function placeEmoji(event: MouseEvent) {
  if (currentTool !== "emoji" || !currentEmoji) return;

  const canvasBounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - canvasBounds.left;
  const mouseY = event.clientY - canvasBounds.top;

  drawing_points.push({
    type: "emoji",
    data: { x: mouseX, y: mouseY, emoji: currentEmoji },
  });
  redo_stack = [];
  triggerDrawingChanged();
}

function drawLine(event: MouseEvent) {
  if (!currently_drawing) return;
  const canvas_bounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - canvas_bounds.left;
  const mouseY = event.clientY - canvas_bounds.top;
  current_points.push(createPoint(mouseX, mouseY));
  triggerDrawingChanged();
}

function triggerDrawingChanged() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

function drawLinesOnCanvas() {
  context.fillRect(0, 0, canvas_size, canvas_size);

  for (const session of drawing_points) {
    if (session.type === "line") {
      drawSession(session.data as DrawingSession, context);
    } else if (session.type === "emoji") {
      const emoji = session.data as EmojiPlacement;
      context.font = `25px Arial`;
      context.fillText(emoji.emoji, emoji.x, emoji.y);
    }
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
    type: "line",
    data: {
      points: current_points,
      lineWidth: context.lineWidth,
    },
  });
  current_points = [];
}

canvas.addEventListener("drawing-changed", drawLinesOnCanvas);
canvas.addEventListener("mousedown", (event) => {
  if (currentTool === "drawing") {
    startDrawing(event);
  } else if (currentTool === "emoji") {
    placeEmoji(event);
  }
});
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

function undoCommand() {
  if (drawing_points.length <= 0) return;
  const lastSession = drawing_points.pop();
  if (lastSession) {
    redo_stack.push(lastSession);
  }
  triggerDrawingChanged();
}

let redo_stack: DrawingAction[] = [];

function redoCommand() {
  if (redo_stack.length <= 0) return;
  const lastSession = redo_stack.pop();
  if (lastSession) {
    drawing_points.push(lastSession);
  }
  triggerDrawingChanged();
}

function thicknessChange(value: number) {
  context.lineWidth = value;
  currentTool = "drawing"; // Reset to drawing mode
  currentEmoji = null; // Clear current emoji

  // Revert to drawing cursor
  changeCursorToDot();
  triggerToolMoved();
}

function createThicknessChange(value: number): () => void {
  return () => thicknessChange(value);
}

const tool_moved = new CustomEvent("tool-moved", {
  detail: {
    cursorStyle: ".",
  },
});

function triggerToolMoved() {
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
    triggerDrawingChanged();
    document.body.style.cursor = "none";
    context.font = `25px Arial`;
    context.fillStyle = "black";
    context.fillText(styleDetail.cursorStyle, mouseX, mouseY);
    context.restore();
  });
}

function revertCursorStyle() {
  document.body.style.cursor = "default";
  triggerDrawingChanged();
}

canvas.addEventListener("mouseleave", revertCursorStyle);
canvas.addEventListener("mouseenter", triggerToolMoved);
document.addEventListener("tool-moved", changeToolStyle);

function changeCursorStyle(style: string) {
  tool_moved.detail.cursorStyle = style;
  currentTool = "emoji";
  currentEmoji = style;
  triggerToolMoved();
}

function createCursorChange(style: string): () => void {
  return () => changeCursorStyle(style);
}

function changeCursorToDot() {
  tool_moved.detail.cursorStyle = ".";
  triggerToolMoved();
}

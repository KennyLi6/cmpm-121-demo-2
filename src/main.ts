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
context.textAlign = "center";
context.textBaseline = "middle";

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
  rotation: number;
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

const thin_width = 1;
const thick_width = 5;

const buttonsToMake: ButtonConfig[] = [
  {
    name: "export_button",
    text: "Export",
    action: exportCanvas,
  },
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
    action: createThicknessChange(thin_width),
  },
  {
    name: "thick_button",
    text: "Thick",
    action: createThicknessChange(thick_width),
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
  {
    name: "custom_emoji_button",
    text: "+",
    action: createCustomEmoji,
  },
];

// div is only used to get the button to appear under the canvas
app.append(document.createElement("div"));

const custom_attribute = "custom_button";

createButtons(buttonsToMake, app, custom_attribute);

function createButtons(
  buttonConfigs: ButtonConfig[],
  container: HTMLElement,
  attribute: string
): void {
  for (let i = 0; i < buttonConfigs.length; i++) {
    const button = document.createElement("button");
    button.innerHTML = buttonConfigs[i].text;
    button.addEventListener("click", buttonConfigs[i].action);
    button.setAttribute("data-custom-button", attribute);
    container.append(button);
  }
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

  triggerDrawingChanged(canvas);
}

let drawing_points: DrawingAction[] = [];
let current_points: Point[] = [];

let currentTool: "drawing" | "emoji" = "drawing";
let currentEmoji: string | null = null;

function startDrawing(event: MouseEvent) {
  if (currentTool !== "drawing") return;
  currently_drawing = true;
  redo_stack = [];
  drawLine(event, canvas);
}

interface EmojiPlacement {
  x: number;
  y: number;
  emoji: string;
}

let cursor_rotation = 0;

function placeEmoji(event: MouseEvent) {
  if (currentTool !== "emoji" || !currentEmoji) return;

  const canvasBounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - canvasBounds.left;
  const mouseY = event.clientY - canvasBounds.top;

  drawing_points.push({
    type: "emoji",
    data: {
      x: mouseX,
      y: mouseY,
      emoji: currentEmoji,
      rotation: cursor_rotation,
    },
  });
  redo_stack = [];
  triggerDrawingChanged(canvas);
}

function drawLine(event: MouseEvent, canvas: HTMLCanvasElement) {
  if (!currently_drawing) return;
  const canvas_bounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - canvas_bounds.left;
  const mouseY = event.clientY - canvas_bounds.top;
  current_points.push(createPoint(mouseX, mouseY));
  triggerDrawingChanged(canvas);
}

function triggerDrawingChanged(canvas: HTMLCanvasElement) {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

function createDrawLinesOnCanvas(
  context: CanvasRenderingContext2D,
  canvasSize: number
): () => void {
  return () => drawLinesOnCanvas(context, canvasSize);
}

function drawLinesOnCanvas(
  context: CanvasRenderingContext2D,
  canvasSize: number
) {
  context.fillRect(0, 0, canvasSize, canvasSize);

  for (const session of drawing_points) {
    if (session.type === "line") {
      drawSession(session.data as DrawingSession, context);
    } else if (session.type === "emoji") {
      drawRotatedEmoji(context, session.data as EmojiPlacement);
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

const emoji_font_size = 25;

function drawRotatedEmoji(
  context: CanvasRenderingContext2D,
  emojiData: EmojiPlacement
) {
  const { emoji, x, y, rotation } = emojiData;
  context.save();
  context.font = `${emoji_font_size}px Arial`;
  context.translate(x, y);
  context.rotate(rotation);
  context.fillText(emoji, 0, 0);
  context.restore();
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

canvas.addEventListener(
  "drawing-changed",
  createDrawLinesOnCanvas(context, canvas_size)
);
canvas.addEventListener("mousedown", (event) => {
  if (currentTool === "drawing") {
    startDrawing(event);
  } else if (currentTool === "emoji") {
    placeEmoji(event);
  }
});
canvas.addEventListener("mousemove", (event: MouseEvent) =>
  drawLine(event, canvas)
);
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
  triggerDrawingChanged(canvas);
}

let redo_stack: DrawingAction[] = [];

function redoCommand() {
  if (redo_stack.length <= 0) return;
  const lastSession = redo_stack.pop();
  if (lastSession) {
    drawing_points.push(lastSession);
  }
  triggerDrawingChanged(canvas);
}

function thicknessChange(value: number) {
  context.lineWidth = value;
  currentTool = "drawing";
  currentEmoji = null;
  changeCursorToDot();
  triggerToolMoved();
}

function createThicknessChange(value: number): () => void {
  return () => thicknessChange(value);
}

interface ToolDetail {
  cursorStyle: string;
  rotation: number;
}

const tool_moved = new CustomEvent("tool-moved", {
  detail: {
    cursorStyle: ".",
    rotation: 0,
  },
});

function triggerToolMoved() {
  document.dispatchEvent(tool_moved);
}

function changeToolStyle(event: Event) {
  const customEvent = event as CustomEvent<{
    cursorStyle: string;
    rotation?: number;
  }>;
  const styleDetail = customEvent.detail;

  canvas.addEventListener("mousemove", (moveEvent) => {
    const canvasBounds = canvas.getBoundingClientRect();
    const mouseX = moveEvent.clientX - canvasBounds.left;
    const mouseY = moveEvent.clientY - canvasBounds.top;
    context.save();
    triggerDrawingChanged(canvas);
    document.body.style.cursor = "none";
    context.font = `25px Arial`;
    context.fillStyle = "black";
    if (
      styleDetail.cursorStyle.match(emojiRegex) &&
      styleDetail.rotation !== undefined
    ) {
      context.translate(mouseX, mouseY);
      const radians = styleDetail.rotation * (Math.PI / 180);
      cursor_rotation = radians;
      context.rotate(radians);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(styleDetail.cursorStyle, 0, 0);
    } else {
      context.fillText(styleDetail.cursorStyle, mouseX, mouseY);
    }
    context.restore();
  });
}

function revertCursorStyle() {
  document.body.style.cursor = "default";
  triggerDrawingChanged(canvas);
}

canvas.addEventListener("mouseleave", revertCursorStyle);
canvas.addEventListener("mouseenter", triggerToolMoved);
document.addEventListener("tool-moved", changeToolStyle);

function changeCursorStyle(style: string) {
  tool_moved.detail.cursorStyle = style;
  tool_moved.detail.rotation = Math.random() * 360;
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

function clearCreatedButtons(
  container: HTMLElement,
  dataAttribute: string
): void {
  const buttons = container.querySelectorAll(
    `button[data-custom-button='${dataAttribute}']`
  );
  buttons.forEach((button) => button.remove());
}

const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;

function createCustomEmoji() {
  let emoji: string | null = null;
  while (!emoji || !emojiRegex.test(emoji)) {
    emoji = prompt("Enter an emoji:");
  }
  // swap position of newly made button and add custom emoji button
  const custom_emoji_button = buttonsToMake.pop() as ButtonConfig;
  buttonsToMake.push({
    name: "custom_emoji",
    text: emoji,
    action: createCursorChange(emoji),
  });
  buttonsToMake.push(custom_emoji_button);
  clearCreatedButtons(app, custom_attribute);
  createButtons(buttonsToMake, app, custom_attribute);
}

const hq_canvas_size = 1024;

function exportCanvas() {
  const hq_canvas = document.createElement("canvas");
  hq_canvas.width = hq_canvas_size;
  hq_canvas.height = hq_canvas_size;

  const hq_context = hq_canvas.getContext("2d");
  if (!hq_context) {
    throw new Error("Unable to get 2D context");
  }
  hq_context.fillStyle = canvas_color;
  hq_context.scale(4, 4);

  drawLinesOnCanvas(hq_context, hq_canvas_size);
  const anchor = document.createElement("a");
  anchor.href = hq_canvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
}

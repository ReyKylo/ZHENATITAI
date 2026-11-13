import { createRoot, jsx } from "../vendor/react-runtime.js";
import { Root } from "./auth.js";

createRoot(document.getElementById("root")).render(jsx(Root, {}));

import { render } from "preact";

import { App } from "./app";
import "./index.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app mount point in index.html");
}

render(<App />, root);
